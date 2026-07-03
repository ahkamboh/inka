// inkling-live — local server: hears you (Whisper, local), sees you (camera frame →
// Claude vision), and streams the agent's NDJSON draw-commands over WebSocket to the
// stage, which draws them stroke-by-stroke. Record the window = the content. No API key —
// it drives your existing `claude` CLI.
const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 4141;
const MODEL = process.env.LIVE_MODEL || 'sonnet'; // fast first stroke; override with LIVE_MODEL
const LOG = path.join(__dirname, 'last-run.ndjson');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inkling-live-'));

const app = express();
app.use(express.json({ limit: '40mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () =>
  console.log(`👁  inkling-live stage → http://localhost:${PORT}  (model: ${MODEL})`));
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
wss.on('connection', ws => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });
const cast = obj => { const s = JSON.stringify(obj); for (const c of clients) { try { c.send(s); } catch (e) {} } };

// ---- persistent Whisper worker (model loads once; ~0.6s per transcription after) ----
let whisper = null, whisperReady = false, whisperQueue = [];
function bootWhisper() {
  whisper = spawn('python3', [path.join(__dirname, 'whisper_worker.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let rest = '';
  whisper.stdout.on('data', d => {
    rest += d.toString();
    const lines = rest.split('\n'); rest = lines.pop();
    for (const l of lines) {
      if (!l.trim()) continue;
      let m; try { m = JSON.parse(l); } catch (e) { continue; }
      if (m.ready) { whisperReady = true; console.log('[whisper] ready (base model loaded)'); continue; }
      const cb = whisperQueue.shift(); if (cb) cb(m);
    }
  });
  whisper.stderr.on('data', () => {});
  whisper.on('close', () => { whisperReady = false; console.log('[whisper] worker died — restarting'); setTimeout(bootWhisper, 1000); });
}
bootWhisper();
const transcribe = audioPath => new Promise(resolve => { whisperQueue.push(resolve); whisper.stdin.write(audioPath + '\n'); });

// ---- persistent Kokoro TTS worker (natural female voice; loads once) ----
const AUDIO_DIR = path.join(TMP, 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
app.use('/audio', express.static(AUDIO_DIR));
let tts = null, ttsReady = false, ttsCbs = new Map(), ttsSeq = 0;
function bootTTS() {
  if (!fs.existsSync(path.join(__dirname, 'models', 'kokoro-v1.0.onnx'))) {
    console.log('[tts] kokoro model not found — captions will use browser voice');
    return;
  }
  tts = spawn('python3', [path.join(__dirname, 'tts_worker.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let rest = '';
  tts.stdout.on('data', d => {
    rest += d.toString();
    const lines = rest.split('\n'); rest = lines.pop();
    for (const l of lines) {
      if (!l.trim()) continue;
      let m; try { m = JSON.parse(l); } catch (e) { continue; }
      if (m.ready) { ttsReady = true; console.log(`[tts] kokoro ready (voice: ${m.voice})`); pregenLines(); continue; }
      const cb = ttsCbs.get(m.id); if (cb) { ttsCbs.delete(m.id); cb(m); }
    }
  });
  tts.stderr.on('data', () => {});
  tts.on('close', () => { ttsReady = false; console.log('[tts] worker died — restarting'); setTimeout(bootTTS, 1500); });
}
bootTTS();
function ttsGen(text) { // -> Promise<audio url | null>
  if (!ttsReady) return Promise.resolve(null);
  const id = ++ttsSeq, file = `say-${id}.wav`;
  return new Promise(resolve => {
    const to = setTimeout(() => { ttsCbs.delete(id); resolve(null); }, 6000); // never stall the show
    ttsCbs.set(id, m => { clearTimeout(to); resolve(m.ok ? '/audio/' + file : null); });
    tts.stdin.write(JSON.stringify({ id, text, path: path.join(AUDIO_DIR, file) }) + '\n');
  });
}
// fixed lines (greeting / next prompts) — pre-generate once so they play instantly
const FIXED = {
  greeting: "Hey! I'm inkling. Ask me anything — just talk, and I'll draw it for you!",
  next1: 'Done! What should I draw next?', next2: 'What else should I explain?',
  next3: 'Ask me another one!', next4: "Next topic — I'm listening!",
};
async function pregenLines() {
  for (const [k, text] of Object.entries(FIXED)) {
    const id = ++ttsSeq, file = `fixed-${k}.wav`;
    await new Promise(resolve => {
      ttsCbs.set(id, () => resolve());
      tts.stdin.write(JSON.stringify({ id, text, path: path.join(AUDIO_DIR, file) }) + '\n');
    });
  }
  console.log('[tts] fixed lines pre-generated');
  cast({ op: '_voices', greeting: '/audio/fixed-greeting.wav',
    next: ['/audio/fixed-next1.wav', '/audio/fixed-next2.wav', '/audio/fixed-next3.wav', '/audio/fixed-next4.wav'] });
}

// ---- the drawing brain's contract ----
const BRAIN = (topic, framePath) => `You are the live drawing brain of a hand-drawn explainer mascot, performing on screen while the user records.
${framePath ? `THE USER'S CAMERA IS ON. FIRST use the Read tool to open ${framePath} — it is the live camera/screen frame from this exact moment. Look at it. Your FIRST "say" line must react naturally to something you actually SEE (the person, their gesture, the object or screen they're showing). Weave what you see into the explainer where it helps.` : ''}
The user asked (spoken aloud): "${topic}"

OUTPUT FORMAT — CRITICAL: ${framePath ? 'after Reading the frame, ' : ''}output ONLY newline-delimited JSON commands (NDJSON). No prose, no markdown fences. Every line is one JSON object.

Canvas: 1600x900, white paper. Hand-drawn ink style: black #1c1c1c strokes, orange #e8730c
accent (sparingly, for THE key thing), muted #7a7164 for secondary labels.
The mascot lives on the LEFT (x < 330). Draw ONLY in x:360-1560, y:90-800.

Structure: 3-5 visual BEATS. One idea per beat. LESS TEXT, MORE SHAPES — boxes, arrows,
circles, simple metaphor drawings. Labels <= 4 words. Title <= 5 words.

Commands (one per line):
{"op":"say","text":"short spoken line, <=12 words"}     mascot speech caption
{"op":"mascot","pose":"think"}                           poses: think | point | happy | idle
{"op":"title","text":"the title"}
{"op":"path","d":"M 400 300 C ...","stroke":"#1c1c1c","width":4,"dur":900}   freehand SVG path, slightly wobbly (gentle C curves, never ruler-straight)
{"op":"circle","cx":800,"cy":400,"r":60,"stroke":"#e8730c","width":4}
{"op":"rect","x":700,"y":300,"w":220,"h":90,"rx":12,"stroke":"#1c1c1c","width":4}
{"op":"arrow","x1":500,"y1":400,"x2":700,"y2":400,"stroke":"#1c1c1c"}
{"op":"text","x":760,"y":350,"text":"label","size":30,"color":"#1c1c1c"}     size 26-40
{"op":"pause","ms":800}
{"op":"clear"}                                            end of beat: wipe drawings (mascot stays)
{"op":"done"}                                             MUST be the last line

Pacing: open with say+think, then title. Each beat: say what you're about to show, mascot
pose, then draw it (3-8 shapes/labels), small pause. Alternate think/point/happy so the
mascot feels alive. 20-40 commands total. Finish with a happy pose, a one-line takeaway
say, then {"op":"done"}.`;

let child = null;

function runBrain(topic, framePath) {
  if (child) { try { child.kill('SIGTERM'); } catch (e) {} child = null; }
  fs.writeFileSync(LOG, '');
  cast({ op: '_status', state: 'thinking', topic });
  console.log(`[ask] "${topic}"${framePath ? ' +frame' : ''} → claude (${MODEL})`);

  const args = ['-p', BRAIN(topic, framePath),
    '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
    '--model', MODEL];
  args.push(framePath ? '--allowedTools' : '--disallowedTools', framePath ? 'Read' : '*');

  child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let buf = '', processed = 0, stdoutRest = '', sentDone = false, started = false;
  let sayChain = Promise.resolve();
  const takeNewLines = () => {
    const upto = buf.lastIndexOf('\n');
    if (upto <= processed) return;
    const chunk = buf.slice(processed, upto); processed = upto;
    for (let line of chunk.split('\n')) {
      line = line.trim();
      if (!line || line[0] !== '{') continue;
      let cmd; try { cmd = JSON.parse(line); } catch (e) { continue; }
      if (!cmd.op) continue;
      if (!started) { started = true; cast({ op: '_status', state: 'drawing' }); }
      if (cmd.op === 'done') sentDone = true;
      fs.appendFileSync(LOG, JSON.stringify(cmd) + '\n');
      if (cmd.op === 'say' && ttsReady) {
        // sequence-preserving async: hold the op until its audio exists (usually <1s,
        // while earlier ops are still drawing), then broadcast with the audio url.
        sayChain = sayChain.then(async () => { cmd.audio = await ttsGen(String(cmd.text || '')); cast(cmd); });
      } else if (cmd.op === 'done') {
        sayChain = sayChain.then(() => cast(cmd));      // done must come after the last say
      } else {
        cast(cmd);
      }
    }
  };
  child.stdout.on('data', d => {
    stdoutRest += d.toString();
    const lines = stdoutRest.split('\n'); stdoutRest = lines.pop();
    for (const l of lines) {
      if (!l.trim()) continue;
      let ev; try { ev = JSON.parse(l); } catch (e) { continue; }
      if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
        buf += ev.event.delta.text; takeNewLines();
      }
      if (ev.type === 'assistant' && ev.message?.content) {
        const full = ev.message.content.filter(b => b.type === 'text').map(b => b.text).join('');
        if (full.length > buf.length) { buf = full; takeNewLines(); }
      }
    }
  });
  child.stderr.on('data', d => { const s = d.toString().trim(); if (s) console.error('[claude]', s.slice(0, 200)); });
  child.on('close', (code) => {
    buf += '\n'; takeNewLines();
    if (!started) {
      // model answered in prose (or nothing) — never dead-end the show
      console.log('[warn] run produced no draw ops; raw head:', buf.slice(0, 200));
      sayChain = sayChain.then(async () => {
        const cmd = { op: 'say', text: "Hmm, that one stumped me — ask me something else!" };
        cmd.audio = await ttsGen(cmd.text); cast(cmd);
      });
    }
    sayChain.then(() => { if (!sentDone) cast({ op: 'done' }); });
    cast({ op: '_status', state: 'done' });
    console.log(`[done] claude exited ${code}`);
    child = null;
  });
}

const b64ToFile = (dataUrl, file) => {
  const b = Buffer.from(String(dataUrl).replace(/^data:[^,]*,/, ''), 'base64');
  fs.writeFileSync(file, b); return file;
};

// typed ask (fallback) — optional frame too
app.post('/ask', (req, res) => {
  const topic = String(req.body.topic || '').trim();
  if (!topic) return res.status(400).json({ error: 'no topic' });
  let framePath = null;
  if (req.body.frame) framePath = b64ToFile(req.body.frame, path.join(TMP, `frame-${Date.now()}.jpg`));
  runBrain(topic, framePath);
  res.json({ ok: true });
});

// spoken ask: audio (+ optional camera frame) → whisper → brain
app.post('/ask-voice', async (req, res) => {
  if (!req.body.audio) return res.status(400).json({ error: 'no audio' });
  if (!whisperReady) return res.status(503).json({ error: 'whisper still loading — try again in a few seconds' });
  const audioPath = b64ToFile(req.body.audio, path.join(TMP, `ask-${Date.now()}.webm`));
  let framePath = null;
  if (req.body.frame) framePath = b64ToFile(req.body.frame, path.join(TMP, `frame-${Date.now()}.jpg`));
  cast({ op: '_status', state: 'transcribing' });
  const r = await transcribe(audioPath);
  if (r.error || !r.text) { cast({ op: '_status', state: 'done' }); return res.json({ ok: false, error: r.error || 'heard nothing' }); }
  cast({ op: '_status', state: 'heard', text: r.text });
  runBrain(r.text, framePath);
  res.json({ ok: true, heard: r.text });
});

app.post('/stop', (_req, res) => {
  if (child) { try { child.kill('SIGTERM'); } catch (e) {} child = null; }
  cast({ op: '_status', state: 'done' });
  res.json({ ok: true });
});
