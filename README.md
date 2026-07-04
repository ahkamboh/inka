# 🎀 inka

**A little AI teacher who hand-draws whiteboard slides around you, in realtime, while she talks.**

Talk to her — no buttons, no typing. She listens, thinks, then draws a hand-drawn slide deck on screen (or over your live camera, AR-style) while explaining out loud in a natural voice. Flip her slides by waving your hand in the air, or just say *"explain slide 2 again."*

Built in a weekend to test how far local models on a Mac can go. Answer: far.

<!-- demo video/gif here -->

---

## What she does

- 🎙 **Hands-free voice** — open mic with voice-activity detection: just talk, pause, she answers
- 🎨 **Draws while she speaks** — hand-drawn diagram slides (flows, comparisons, bar charts, callouts) stroke-by-stroke, narration synced to the ink
- 📷 **Camera AR mode** — the stage becomes your live webcam; she and the drawings float over your video (this is the mode you screen-record)
- 🖐 **Hand-gesture slides** — swipe your hand in the air to flip slides (MediaPipe, in-browser)
- 🗣 **Voice deck control** — *"next slide"*, *"go to slide 3"*, *"explain slide 2 again"* → she flips there and re-teaches the same drawing in fresh words
- 👧 **Inka herself** — a 3D character (Three.js): blinks, thinks with a bubble, points at the board, scribbles with her pencil, talks with her mouth moving

## How local is it?

| part | model | where it runs |
|---|---|---|
| 👂 Ears | Whisper `base` (persistent worker) | **your machine** — ~0.6s per utterance |
| 🗣 Voice | Kokoro-82M (`af_heart`) | **your machine** — wavs pre-generated ahead of playback |
| 🖐 Eyes | MediaPipe HandLandmarker | **your machine** — realtime, in-browser, served locally |
| 🧠 Brain | `claude` CLI (Opus; Sonnet for re-explains) | cloud, via your existing Claude Code login — **no API key handling** |

Measured on an M-series Mac: she talks *while* drawing with voice/ink activity ~80% of the show; worst dead gap in a 64-second lesson was **1.2s**.

The brain is the only cloud piece. Swap it for a local LLM and the whole teacher runs on airplane mode — that's the roadmap.

## Quickstart

**Prereqs:** macOS (M-series recommended) · Node 18+ · Python 3 · [Claude Code](https://claude.com/claude-code) installed & logged in (`claude` on PATH) · Chrome.

```bash
git clone https://github.com/ahkamboh/inka && cd inka
npm install

# python workers (ears + voice)
pip3 install openai-whisper kokoro-onnx soundfile

# one-time model downloads (~360MB total, all local)
mkdir -p models
curl -L -o models/kokoro-v1.0.onnx  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o models/voices-v1.0.bin   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
curl -L -o models/hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

npm start          # → http://localhost:4141
```

Open it in Chrome → **click anywhere** (browsers require one gesture for mic/audio) → she greets you → just talk.

## Controls

| you do | she does |
|---|---|
| talk, then pause ~1.5s | takes that as your question and starts a lesson |
| **📷 camera** (top-right) | switches the stage to your live webcam (AR mode) |
| 🖐 fast horizontal hand-swipe (camera mode) | next / previous slide |
| say *"next slide"* / *"go back"* / *"slide 3"* | flips instantly (no model call) |
| say *"explain slide 2 again"* / *"repeat that"* | jumps there and re-teaches it in new words |
| ask anything new | clears the board, new lesson |
| ← / → keys, or the dots up top | manual slide nav |

## How it works

```
your voice ──► Whisper worker (persistent, ~0.6s)
                   │ transcript (+ a camera frame if 📷 is on — the brain can SEE it)
                   ▼
             claude CLI ── streams NDJSON draw-ops (slide/say/flow/compare/bars/callout/…)
                   │
        ordered pipeline: every say's wav is synthesized by Kokoro IN PARALLEL the
        moment it's parsed; the chain only preserves order — no generation stalls
                   ▼
             WebSocket ──► the stage (public/index.html)
                             ├─ SVG slide deck: engine-laid-out diagrams, live auto-centering,
                             │  draw-on strokes, local handwriting fonts (Caveat + Patrick Hand)
                             ├─ say = sync point: narration and its beat's ink start together
                             └─ Inka (public/mascot3d.js): Three.js rig driven by pose ops
```

**The slide contract:** the brain must give every slide exactly one main diagram — a `flow` (process), `compare` (before/after), `bars` (real quantities), icon + `callout`s (anatomy), or `bignum` (one striking number) — grounded in a concrete example. Layout is computed by the engine, so slides come out clean every time.

## Config

| env | default | what |
|---|---|---|
| `LIVE_MODEL` | `opus` | brain model for lessons (`sonnet` = faster first stroke) |
| `KOKORO_VOICE` | `af_heart` | her voice (any voice in the Kokoro voices file) |
| `PORT` | `4141` | server port |

## Honest notes

- The brain runs through your **Claude Code subscription** (the `claude` CLI) — no API keys are stored or handled by this repo. Everything else is fully local.
- Voice commands are English keyword-based ("slide two", "again", "repeat") — deliberately conservative so normal questions never get mistaken for commands.
- Chrome recommended; the mic/audio need one click on page load (browser autoplay policy — there's no way around it).
- Built and tested on an M-series Mac. Other platforms: the Node/Python parts are portable, your mileage on latency may vary.

## License

MIT © 2026 [Ali Hamza Kamboh (@ahkamboh)](https://github.com/ahkamboh)

<sub>Sister projects: [inkling](https://github.com/ahkamboh/inkling) (the offline explainer-video renderer this grew from) · [mascot-maker](https://github.com/ahkamboh/mascot-maker) · [scrolltape](https://github.com/ahkamboh/scrolltape)</sub>
