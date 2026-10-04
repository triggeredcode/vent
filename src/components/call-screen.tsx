"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { bytesToBase64, encodeMonoWav } from "@/lib/wav";
import { scenes, type SceneProps, type VentScene } from "./scenes";
import type { CallFlavor, CallMode, CallTurn, ListenerAction, ListenerTone } from "@/lib/types";

export interface CallResult {
  mode: CallMode;
  turns: CallTurn[];
  seconds: number;
}

type Phase = "connecting" | "ringing" | "listening" | "hearing" | "thinking" | "speaking" | "error";

const greetings: Record<CallMode, string[]> = {
  vent: ["Hey, you. What's going on?", "Hey. I've got time — what's up?", "Hi there. Talk to me.", "Hey! Okay, what happened?"],
  journal: ["Hey! So what's been happening today?", "Hi! Okay, tell me everything — how was today?", "Hey you! What did today look like?", "Hey! I want the full story — how was your day?"],
};

const statusCopy: Record<Phase, string> = {
  connecting: "calling…",
  ringing: "ringing…",
  listening: "",
  hearing: "",
  thinking: "",
  speaking: "",
  error: "",
};

// Voice activity detection, tuned for a 2,048-sample buffer (~43 ms at 48 kHz).
const START_FRAMES = 2;
const END_SILENCE_FRAMES = 11; // ~470 ms of quiet ends a turn
const MIN_TURN_SECONDS = 0.45;
const MAX_TURN_SECONDS = 25;
// Speakers bleed into the mic, so VENT never listens to itself: the mic is deaf while
// VENT speaks and for a short echo tail afterwards. Tap the mascot to cut VENT off.
const ECHO_TAIL_MS = 450;

function formatTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function playRing(context: AudioContext, at: number) {
  [0, 0.42].forEach((offset) => {
    const gain = context.createGain();
    const low = context.createOscillator();
    const high = context.createOscillator();
    low.frequency.value = 440;
    high.frequency.value = 480;
    const start = at + offset;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.04, start + 0.03);
    gain.gain.setValueAtTime(0.04, start + 0.36);
    gain.gain.linearRampToValueAtTime(0, start + 0.4);
    low.connect(gain); high.connect(gain); gain.connect(context.destination);
    low.start(start); high.start(start);
    low.stop(start + 0.42); high.stop(start + 0.42);
  });
}

const sceneFlavor: Record<VentScene, CallFlavor> = { breathe: "calm", punch: "fired", sweat: "breathless" };

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function CallScreen({ mode, scene, onEnd }: { mode: CallMode; scene: VentScene; onEnd: (result: CallResult) => void }) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [gesture, setGesture] = useState<ListenerAction | "rest">("rest");
  const [attempt, setAttempt] = useState(0);
  const [tone, setTone] = useState<ListenerTone | null>(null);
  const flavor: CallFlavor = mode === "vent" ? sceneFlavor[scene] : "bright";
  const levelListenersRef = useRef(new Set<(level: number) => void>());
  const subscribeLevel = useCallback((listener: (level: number) => void) => {
    levelListenersRef.current.add(listener);
    return () => { levelListenersRef.current.delete(listener); };
  }, []);

  const turnsRef = useRef<CallTurn[]>([]);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const recordingRef = useRef(false);
  const speechCountRef = useRef(0);
  const failuresRef = useRef(0);
  const mutedRef = useRef(false);
  const speakerRef = useRef(true);
  const stopPlaybackRef = useRef<() => void>(() => undefined);
  const deafUntilRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  /** Drives the mascot from VENT's own voice: louder syllables, bigger bounce. */
  const followVoice = useCallback((audio: HTMLAudioElement) => {
    const context = audioContextRef.current;
    const orb = levelRef.current;
    if (!context || !orb) return () => undefined;
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyser.connect(context.destination);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let smooth = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      smooth = smooth * 0.6 + Math.min(1, Math.sqrt(sum / samples.length) * 5) * 0.4;
      orb.style.setProperty("--voice", smooth.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); orb.style.setProperty("--voice", "0"); source.disconnect(); analyser.disconnect(); };
  }, []);
  const levelRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef(false);
  const secondsRef = useRef(0);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { speakerRef.current = speakerOn; if (!speakerOn) stopPlaybackRef.current(); }, [speakerOn]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  const settle = useCallback(() => {
    if (!liveRef.current) return;
    setPhase(recordingRef.current ? "hearing" : busyRef.current ? "thinking" : "listening");
  }, []);

  const speak = useCallback(async (text: string, action: ListenerAction | "rest") => {
    if (!text || !liveRef.current) return;
    setGesture(action);
    if (!speakerRef.current) { await wait(Math.min(2600, 500 + text.length * 45)); setGesture("rest"); return; }
    speakingRef.current = true;
    setPhase("speaking");
    try {
      const response = await fetch("/api/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, flavor }) });
      if (!response.ok) throw new Error("voice unavailable");
      const url = URL.createObjectURL(await response.blob());
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        const stopLevels = followVoice(audio);
        const done = () => { stopLevels(); URL.revokeObjectURL(url); stopPlaybackRef.current = () => undefined; resolve(); };
        stopPlaybackRef.current = () => { audio.pause(); done(); };
        audio.onended = done;
        audio.onerror = done;
        if (!liveRef.current) { done(); return; }
        void audio.play().catch(done);
      });
    } catch {
      await new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) { resolve(); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find((voice) => /samantha|veena|rishi|daniel/i.test(voice.name)) ?? voices.find((voice) => voice.lang.startsWith("en")) ?? null;
        utterance.rate = 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        stopPlaybackRef.current = () => { window.speechSynthesis.cancel(); resolve(); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    } finally {
      deafUntilRef.current = performance.now() + ECHO_TAIL_MS;
      speakingRef.current = false;
      stopPlaybackRef.current = () => undefined;
      setGesture("rest");
      settle();
    }
  }, [flavor, followVoice, settle]);

  const processNextRef = useRef<() => Promise<void>>(async () => undefined);
  const processNext = useCallback(async () => {
    if (busyRef.current || !liveRef.current) return;
    const audio = queueRef.current.shift();
    if (!audio) return;
    busyRef.current = true;
    if (!recordingRef.current) setPhase("thinking");
    const speechMark = speechCountRef.current;
    let reply: { text: string; action: ListenerAction } | null = null;
    try {
      const response = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio, format: "wav", mode, flavor, history: turnsRef.current.slice(-16) }),
      });
      const data = await response.json() as { transcript?: string; text?: string; action?: ListenerAction; tone?: ListenerTone; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Voice turn failed");
      failuresRef.current = 0;
      if (data.transcript) {
        // The listener reads the emotional weather of each line; the poster's colours follow it.
        if (data.tone) setTone(data.tone);
        turnsRef.current.push({ speaker: "you", text: data.transcript });
        // If they started talking again while we were thinking, a reply would interrupt them — stay quiet.
        const interrupted = speechCountRef.current !== speechMark || queueRef.current.length > 0;
        if (!interrupted && data.text && data.action !== "silence") reply = { text: data.text, action: data.action ?? "acknowledge" };
        turnsRef.current.push(reply ? { speaker: "vent", text: reply.text, action: reply.action } : { speaker: "vent", text: "", action: "silence" });
        if (!reply) { setGesture("silence"); window.setTimeout(() => setGesture((current) => current === "silence" ? "rest" : current), 1400); }
      }
    } catch {
      failuresRef.current += 1;
      if (failuresRef.current >= 2 && liveRef.current) {
        setError("The line dropped. Is Ollama still running?");
        setPhase("error");
      }
    } finally {
      busyRef.current = false;
    }
    if (reply) await speak(reply.text, reply.action);
    settle();
    if (queueRef.current.length) void processNextRef.current();
  }, [flavor, mode, settle, speak]);
  useEffect(() => { processNextRef.current = processNext; }, [processNext]);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let processor: ScriptProcessorNode | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let timer: number | undefined;
    const chunks: Float32Array[] = [];
    const preRoll: Float32Array[] = [];
    let loudFrames = 0;
    let quietFrames = 0;
    let noiseFloor = 0.006;

    const flush = (sampleRate: number) => {
      const captured = chunks.splice(0);
      recordingRef.current = false;
      quietFrames = 0;
      const duration = captured.reduce((total, chunk) => total + chunk.length, 0) / sampleRate;
      if (duration < MIN_TURN_SECONDS) { settle(); return; }
      queueRef.current.push(bytesToBase64(encodeMonoWav(captured, sampleRate)));
      void processNext();
      settle();
    };

    const start = async () => {
      setPhase("connecting");
      setError("");
      liveRef.current = false;
      try {
        context = new AudioContext();
        audioContextRef.current = context;
        await context.resume();
        const [health] = await Promise.all([fetch(`/api/voice/status?mode=${mode}&flavor=${flavor}`, { cache: "no-store" }), wait(700)]);
        if (!health.ok) throw new Error("models");
        if (disposed) return;
        setPhase("ringing");
        playRing(context, context.currentTime + 0.05);
        playRing(context, context.currentTime + 2.05);
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        await wait(2400);
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }

        const sampleRate = context.sampleRate;
        source = context.createMediaStreamSource(stream);
        processor = context.createScriptProcessor(2048, 1, 1);
        processor.onaudioprocess = (event) => {
          const samples = new Float32Array(event.inputBuffer.getChannelData(0));
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
          const rms = Math.sqrt(sum / samples.length);
          const deaf = mutedRef.current || speakingRef.current || performance.now() < deafUntilRef.current;
          const level = deaf ? 0 : Math.min(1, rms * 14);
          levelRef.current?.style.setProperty("--level", level.toFixed(3));
          levelListenersRef.current.forEach((listener) => listener(level));
          if (mutedRef.current) { chunks.length = 0; recordingRef.current = false; loudFrames = 0; return; }

          if (speakingRef.current || performance.now() < deafUntilRef.current) {
            preRoll.length = 0;
            loudFrames = 0;
            return;
          }

          const threshold = Math.max(0.014, noiseFloor * 3.2);
          if (!recordingRef.current) {
            if (rms < threshold) noiseFloor = noiseFloor * 0.97 + rms * 0.03;
            preRoll.push(samples);
            if (preRoll.length > 6) preRoll.shift();
            loudFrames = rms > threshold ? loudFrames + 1 : 0;
            if (loudFrames >= START_FRAMES) {
              chunks.push(...preRoll.splice(0));
              recordingRef.current = true;
              speechCountRef.current += 1;
              quietFrames = 0;
              setPhase("hearing");
            }
            return;
          }

          chunks.push(samples);
          quietFrames = rms > threshold * 0.8 ? 0 : quietFrames + 1;
          const recorded = chunks.length * samples.length / sampleRate;
          if (quietFrames >= END_SILENCE_FRAMES || recorded > MAX_TURN_SECONDS) flush(sampleRate);
        };
        source.connect(processor);
        processor.connect(context.destination);

        liveRef.current = true;
        setSeconds(0);
        timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
        setPhase("listening");
        const options = greetings[mode];
        const greeting = options[Math.floor(Math.random() * options.length)];
        turnsRef.current.push({ speaker: "vent", text: greeting, action: "acknowledge" });
        void speak(greeting, "acknowledge");
      } catch (problem) {
        if (disposed) return;
        setPhase("error");
        setError(problem instanceof DOMException && problem.name === "NotAllowedError" ? "VENT needs your microphone to hear you." : "VENT couldn't connect. Is Ollama running?");
      }
    };

    void start();
    return () => {
      disposed = true;
      liveRef.current = false;
      window.clearInterval(timer);
      stopPlaybackRef.current();
      window.speechSynthesis?.cancel();
      processor?.disconnect();
      source?.disconnect();
      void context?.close();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt, flavor, mode, processNext, settle, speak]);

  const live = phase !== "connecting" && phase !== "ringing" && phase !== "error";
  const status = muted && live ? "muted" : live ? formatTime(seconds) : statusCopy[phase];

  const ventScene = mode === "vent" ? scenes[scene] : null;
  const sceneProps: SceneProps = { phase, tone, muted, subscribeLevel };

  return <main className={`call-screen call-${mode} phase-${phase} ${ventScene ? `vent-scene vent-scene-${scene} ${ventScene.theme}` : ""}`} data-tone={tone ?? undefined}>
    {ventScene
      ? <div className="scene-backdrop" aria-hidden="true"><ventScene.Backdrop {...sceneProps} /></div>
      : <div className="poster-art" aria-hidden="true"><span className="shape-sun" /><span className="shape-moon" /><span className="shape-ring" /><span className="shape-leaf" /><span className="shape-dot" /></div>}

    <header className="call-identity">
      <span className="call-kicker">{ventScene ? ventScene.kicker : "TODAY'S PAGE"}</span>
      <h1>Vent</h1>
      <div className="call-state" aria-live="polite">{phase === "error" ? error : status}</div>
    </header>

    <div className="call-body">
      {ventScene
        ? <div className="scene-host" ref={levelRef} onClick={() => stopPlaybackRef.current()} role="button" tabIndex={-1} aria-label="Tap to interrupt VENT"><ventScene.Stage {...sceneProps} /></div>
        : <div className={`listener-orb ${muted ? "muted" : ""} ${phase} gesture-${gesture}`} ref={levelRef} onClick={() => stopPlaybackRef.current()} role="button" tabIndex={-1} aria-label="Tap to interrupt VENT">
          <span className="voice-ring" /><span className="voice-ring" />
          <span className="speak-wave" /><span className="speak-wave" /><span className="speak-wave" />
          <Image src="/vent-listener.png" alt="VENT, listening" width={300} height={300} priority />
        </div>}
      {phase === "error" && <button className="retry-call" onClick={() => setAttempt((value) => value + 1)}>Call again</button>}
    </div>

    <div className="ios-controls">
      <button onClick={() => setMuted((value) => !value)} className={`call-control ${muted ? "selected" : ""}`} aria-pressed={muted}><span><Icon name={muted ? "micOff" : "mic"} /></span>mute</button>
      <button className="call-control" disabled><span><Icon name="keypad" /></span>keypad</button>
      <button onClick={() => setSpeakerOn((value) => !value)} className={`call-control ${!speakerOn ? "selected" : ""}`} aria-pressed={!speakerOn}><span><Icon name={speakerOn ? "audio" : "audioOff"} /></span>audio</button>
      <button className="call-control" disabled><span><Icon name="plus" /></span>add call</button>
      <button className="call-control" disabled><span><Icon name="video" /></span>FaceTime</button>
      <button className="call-control" disabled><span><Icon name="person" /></span>contacts</button>
    </div>
    <button onClick={() => onEnd({ mode, turns: turnsRef.current.filter((turn) => turn.text), seconds: secondsRef.current })} className="end-call" aria-label="End call"><Icon name="phone" /></button>
  </main>;
}
