// inkling-live — local server: takes a topic, spawns the `claude` CLI (your existing
// subscription — no API key), parses the NDJSON draw-commands out of its streaming
// output, and broadcasts each command over WebSocket to the stage page, which draws
// them stroke-by-stroke. The recording you make of that window IS the content.
const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 4141;
const MODEL = process.env.LIVE_MODEL || 'sonnet'; // fast first stroke; override with LIVE_MODEL
const LOG = path.join(__dirname, 'last-run.ndjson');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () =>
  console.log(`👁  inkling-live stage → http://localhost:${PORT}  (model: ${MODEL})`));
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
wss.on('connection', ws => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });
const cast = obj => { const s = JSON.stringify(obj); for (const c of clients) { try { c.send(s); } catch (e) {} } };

// ---- the drawing brain's instructions (the whole "authoring" contract) ----
const BRAIN = (topic) => `You are the live drawing brain of a hand-drawn explainer mascot.
Explain this topic visually: "${topic}"

OUTPUT FORMAT — CRITICAL: output ONLY newline-delimited JSON commands (NDJSON). No prose,
no markdown fences, no commentary. Every line is one JSON object. Nothing else.

Canvas: 1600x900, white paper. Hand-drawn ink style: black #1c1c1c strokes, orange #e8730c
accent (use sparingly, for THE key thing), muted #7a7164 for secondary labels.
The mascot lives on the LEFT (x < 330). Draw ONLY in x:360-1560, y:90-800.

Structure: 3-5 visual BEATS. One idea per beat. LESS TEXT, MORE SHAPES — boxes, arrows,
circles, simple metaphor drawings. Labels <= 4 words. Title <= 5 words.

Commands (one per line):
{"op":"say","text":"short spoken line, <=12 words"}     mascot speech caption
{"op":"mascot","pose":"think"}                           poses: think | point | happy | idle
{"op":"title","text":"the title"}
{"op":"path","d":"M 400 300 C ...","stroke":"#1c1c1c","width":4,"dur":900}   freehand SVG path, slightly wobbly (use gentle C curves, never ruler-straight)
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

app.post('/ask', (req, res) => {
  const topic = String(req.body.topic || '').trim();
  if (!topic) return res.status(400).json({ error: 'no topic' });
  if (child) { try { child.kill('SIGTERM'); } catch (e) {} child = null; }

  fs.writeFileSync(LOG, '');
  cast({ op: '_status', state: 'thinking', topic });
  console.log(`[ask] "${topic}" → claude (${MODEL})`);

  child = spawn('claude', [
    '-p', BRAIN(topic),
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--model', MODEL,
    '--disallowedTools', '*',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let buf = '';          // accumulated agent TEXT (the NDJSON it writes)
  let processed = 0;     // how much of buf we've already parsed
  let stdoutRest = '';   // partial stdout line
  let sentDone = false;
  let started = false;

  const takeNewLines = () => {
    const upto = buf.lastIndexOf('\n');
    if (upto <= processed) return;
    const chunk = buf.slice(processed, upto);
    processed = upto;
    for (let line of chunk.split('\n')) {
      line = line.trim();
      if (!line || line[0] !== '{') continue;
      let cmd; try { cmd = JSON.parse(line); } catch (e) { continue; }
      if (!cmd.op) continue;
      if (!started) { started = true; cast({ op: '_status', state: 'drawing' }); }
      if (cmd.op === 'done') sentDone = true;
      fs.appendFileSync(LOG, JSON.stringify(cmd) + '\n');
      cast(cmd);
    }
  };

  child.stdout.on('data', d => {
    stdoutRest += d.toString();
    const lines = stdoutRest.split('\n'); stdoutRest = lines.pop();
    for (const l of lines) {
      if (!l.trim()) continue;
      let ev; try { ev = JSON.parse(l); } catch (e) { continue; }
      // streaming text deltas
      if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
        buf += ev.event.delta.text; takeNewLines();
      }
      // complete assistant message (fallback / final authority)
      if (ev.type === 'assistant' && ev.message?.content) {
        const full = ev.message.content.filter(b => b.type === 'text').map(b => b.text).join('');
        if (full.length > buf.length) { buf = full; takeNewLines(); }
      }
    }
  });
  child.stderr.on('data', d => { const s = d.toString().trim(); if (s) console.error('[claude]', s.slice(0, 200)); });
  child.on('close', (code) => {
    buf += '\n'; takeNewLines();
    if (!sentDone) cast({ op: 'done' });
    cast({ op: '_status', state: 'done' });
    console.log(`[done] claude exited ${code}`);
    child = null;
  });

  res.json({ ok: true });
});

app.post('/stop', (_req, res) => {
  if (child) { try { child.kill('SIGTERM'); } catch (e) {} child = null; }
  cast({ op: '_status', state: 'done' });
  res.json({ ok: true });
});
