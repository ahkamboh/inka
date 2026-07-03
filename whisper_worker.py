#!/usr/bin/env python3
# Persistent Whisper worker: loads the model ONCE, then transcribes each audio path
# sent on stdin (one per line), replying with one JSON line per request.
import sys, json
import whisper

model = whisper.load_model("base")
print(json.dumps({"ready": True}), flush=True)

for line in sys.stdin:
    path = line.strip()
    if not path:
        continue
    try:
        r = model.transcribe(path, fp16=False)
        print(json.dumps({"text": r["text"].strip()}), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)[:200]}), flush=True)
