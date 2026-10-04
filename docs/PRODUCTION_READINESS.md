# Production readiness

## Current local product

VENT already runs the private core loop on one machine:

1. Browser microphone capture and local voice-activity detection.
2. Local Ollama audio transcription with `gemma4:e2b`.
3. Local low-latency listener response with `gemma3:1b`.
4. Configurable custom-voice synthesis, with system speech as a temporary fallback.
5. Journal persistence in the browser.

This is appropriate for a private single-user demo. It is not yet a multi-user production architecture. Local limits include cold-model latency, one concurrent GPU workload, browser permission differences, no account recovery, and browser-local journal storage.

## Latency budget

| Stage | Local target | Production target |
| --- | ---: | ---: |
| End-of-turn detection | 350–450 ms | 200–350 ms |
| First transcript | 1–3 s warm | 200–600 ms streaming |
| Listener decision | 300–900 ms warm | 150–500 ms |
| First voice audio | 250–900 ms | 100–400 ms streaming |

The client now uses a 2,048-sample capture buffer and about 380 ms of trailing silence instead of the earlier ~850 ms wait. Ollama models are kept warm for ten minutes and Gemma audio reasoning is disabled for short transcription.

Measured on the current local machine with a short synthetic voice turn:

- model warm-up during Connecting: 3.19 s from fully unloaded state
- first turn after warm-up: 324 ms transcription + 137 ms response
- subsequent warm turn: 147 ms transcription + 95 ms response

This keeps the warm model work below 250 ms; perceived delay is then dominated by end-of-turn detection and voice playback startup.

## Custom voice

The app calls `POST /api/voice/speak`, which proxies an OpenAI-compatible local voice server configured with:

```dotenv
VENT_TTS_BASE_URL=http://127.0.0.1:8880
VENT_TTS_MODEL=openvoice-v2
VENT_TTS_VOICE=vent-calm
```

OpenVoice V2 is the recommended identity layer because its code and models permit commercial use and it can clone tone color from a short reference. A production wrapper should expose `/v1/audio/speech`, cache the extracted speaker embedding at startup, keep the model warm, and stream encoded audio chunks.

To create `vent-calm`, we need one consented voice reference:

- 20–30 seconds of clean WAV audio
- one speaker, no music, no reverb
- calm conversational delivery, not announcer delivery
- the exact transcript of that recording
- explicit permission to synthesize and ship that voice

Do not use a celebrity, public figure, or unconsented recording.

## Production path

1. Replace browser-local journal storage with encrypted user-scoped storage.
2. Move transport to a realtime session with streaming ASR and streaming TTS.
3. Keep the listener action contract and mascot gesture mapping unchanged.
4. Add interruption, barge-in, echo cancellation, and latency tracing.
5. Add deletion/export controls before inviting external users.
6. Review crisis behavior and privacy copy with qualified specialists.

