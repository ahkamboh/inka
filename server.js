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
const MODEL = process.env.LIVE_MODEL || 'opus'; // smarter explainers; override with LIVE_MODEL (sonnet = faster first stroke)
const LOG = path.join(__dirname, 'last-run.ndjson');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inkling-live-'));

const app = express();
app.use(express.json({ limit: '40mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/tasks-vision', express.static(path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision')));
app.use('/models', express.static(path.join(__dirname, 'models')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));

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
const ICON_NAMES = 'person brain lightbulb gear cloud server phone laptop chart magnifier heart star database lock rocket money';
const BRAIN = (topic, framePath) => `You are the live drawing brain of a hand-drawn explainer mascot, performing a SLIDE SHOW on screen while the user records.
${framePath ? `THE USER'S CAMERA IS ON. FIRST use the Read tool to open ${framePath} — it is the live camera/screen frame from this exact moment. Look at it. Your FIRST "say" line must react naturally to something you actually SEE. Weave what you see into the explainer where it helps.` : ''}
The user asked (spoken aloud): "${topic}"

OUTPUT FORMAT — CRITICAL: ${framePath ? 'after Reading the frame, ' : ''}output ONLY newline-delimited JSON commands (NDJSON). No prose, no markdown fences. Every line is one JSON object.

Canvas: 1600x900 per slide. Hand-drawn ink style: black #1c1c1c strokes, orange #e8730c
accent (sparingly, for THE key thing), muted #7a7164 for secondary labels.
The mascot lives on the LEFT (x < 330). Draw ONLY in x:360-1560, y:90-800.

STRUCTURE: 3-5 SLIDES. You are a TEACHER at a whiteboard — each slide is one lesson beat
where the board FILLS UP as you talk. Open every slide with the slide op.

HARD VALIDITY RULE — every slide MUST contain exactly ONE main diagram:
- flow      → processes, pipelines, cause→effect ("how X happens")
- compare   → before/after, with/without, X vs Y ("why X beats Y")
- bars      → real quantities ("how much/many/fast")
- icon(2.2+) + 2-3 callout → anatomy ("what X is made of, labeled")
- bignum + bars or icons → one shocking number, then ground it
A slide that is only a title + a note is INVALID OUTPUT — never produce one.
Around the diagram add: 1 note (the concrete number/example) + 1-2 short labels/callouts.
Target 6-12 drawn elements per slide: a full, organized whiteboard — not a poster, not empty.
Say-lines narrate WHILE it draws, like a teacher pointing: "watch — first your phone asks
the router..." — every diagram part gets mentioned as it appears.

EXAMPLE OF ONE CORRECT SLIDE (imitate this density and rhythm, adapted to your topic):
{"op":"say","text":"Watch how your text message actually travels."}
{"op":"slide","title":"How A Text Travels"}
{"op":"mascot","pose":"draw"}
{"op":"flow","y":450,"items":[{"icon":"phone","label":"your phone"},{"icon":"cloud","label":"nearest tower"},{"icon":"server","label":"carrier switch"},{"icon":"phone","label":"their phone"}]}
{"op":"say","text":"Four hops, city to city, in under a second."}
{"op":"callout","x":700,"y":450,"tx":480,"ty":640,"text":"radio waves start here"}
{"op":"note","x":1180,"y":620,"w":300,"h":90,"text":"whole trip: ~0.3 seconds"}
{"op":"mascot","pose":"point"}
{"op":"pause","ms":600}

TEACH WITH CONCRETE EXAMPLES — this is the most important rule. EVERY slide must ground its
idea in a specific, tangible example: real numbers ("32 gigabytes", "0.2 seconds"), a mini
scenario ("you order pizza; the app must..."), a named everyday object (a mailbox, a
recipe, a traffic light). Say the example out loud in the say line AND show it visually
(a note with the numbers, icons acting out the scenario, an arrow chain of the steps).
Abstract statements without an example are not allowed. 

Commands (one per line):
{"op":"slide","title":"3-5 word headline"}                start a NEW slide (auto-draws the headline)
{"op":"say","text":"short spoken line, <=12 words"}       mascot voice-over (speaks while you draw)
{"op":"mascot","pose":"think"}                             poses: think | point | happy | idle
{"op":"icon","name":"brain","x":700,"y":300,"scale":1.6,"color":"#1c1c1c"}   pre-drawn icon. names: ${ICON_NAMES}. scale 1-3, use 1.4+ for main visuals
{"op":"flow","y":470,"items":[{"icon":"phone","label":"you tap order"},{"icon":"server","label":"app finds a driver"},{"icon":"person","label":"food at your door"}]}   process/cause-effect chain, 2-4 nodes, auto-aligned. icon optional (label-only = box node)
{"op":"compare","left":{"title":"without cache","lines":["every ask hits the DB","300 ms each"]},"right":{"title":"with cache","lines":["answer remembered","5 ms"]}}   before/after · with/without · X vs Y (max 4 lines each)
{"op":"bars","y":380,"items":[{"label":"walking","value":5,"unit":"km/h"},{"label":"cycling","value":20,"unit":"km/h"}]}   REAL quantities as bars (2-4), values written, biggest auto-orange
{"op":"callout","x":800,"y":450,"tx":1150,"ty":300,"text":"the part that learns"}   annotation from a spot on your hero icon to a short label (anatomy diagrams)
{"op":"bignum","x":960,"y":440,"value":"86 billion","label":"neurons in your head"}   ONE striking number as the slide hero
{"op":"path","d":"M 400 300 C ...","stroke":"#1c1c1c","width":4,"dur":900}   freehand SVG path (gentle wobbly C curves)
{"op":"circle","cx":800,"cy":400,"r":60,"stroke":"#e8730c","width":4}
{"op":"rect","x":700,"y":300,"w":220,"h":90,"rx":12,"stroke":"#1c1c1c","width":4}
{"op":"note","x":900,"y":250,"w":240,"h":110,"text":"sticky note text"}      orange sticky note with text
{"op":"arrow","x1":500,"y1":400,"x2":700,"y2":400,"stroke":"#1c1c1c"}
{"op":"text","x":760,"y":350,"text":"label","size":30,"color":"#1c1c1c"}     size 26-40
{"op":"pause","ms":800}
{"op":"done"}                                              MUST be the last line

Pacing: open with a say (hook) + think pose. Then per slide: slide op → say what this slide
shows → compose it (an icon or two + arrows + 2-4 labels) → small pause. Alternate
think/point/happy. 25-45 commands total. Finish with a happy pose + one-line takeaway say,
then {"op":"done"}.`;

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
