#!/usr/bin/env python3
# Persistent Kokoro TTS worker: loads the model ONCE, then turns each JSON request on
# stdin ({"id":..., "text":..., "path":...}) into a natural-voice wav, replying with one
# JSON line per request. Voice: warm female English (af_heart) — override with KOKORO_VOICE.
import sys, json, os
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "models", "kokoro-v1.0.onnx")
VOICES = os.path.join(HERE, "models", "voices-v1.0.bin")
VOICE = os.environ.get("KOKORO_VOICE", "af_heart")

kokoro = Kokoro(MODEL, VOICES)
print(json.dumps({"ready": True, "voice": VOICE}), flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        samples, sr = kokoro.create(req["text"], voice=VOICE, speed=1.06)
        sf.write(req["path"], samples, sr)
        print(json.dumps({"id": req["id"], "ok": True}), flush=True)
    except Exception as e:
        print(json.dumps({"id": req.get("id"), "error": str(e)[:200]}), flush=True)
