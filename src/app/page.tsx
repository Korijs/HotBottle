"use client";

import { useEffect, useRef, useState } from "react";
import Scene from "./Components/Scene";

type GVec = { x: number; y: number; z: number };

function magnitude(g: GVec) {
  return Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
}

function computePitchRoll(g: GVec) {
  // Normalize gravity vector
  const m = magnitude(g) || 1;
  const gx = g.x / m, gy = g.y / m, gz = g.z / m;

  // Pitch (front-back), Roll (left-right)
  // These formulas work well enough across devices:
  const pitchRad = Math.atan2(-gx, Math.sqrt(gy * gy + gz * gz)); // -π..π
  const rollRad  = Math.atan2(gy, gz);                             // -π..π

  return { pitchDeg: pitchRad * 180 / Math.PI, rollDeg: rollRad * 180 / Math.PI };
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playingRef = useRef(false);
  const lastPlayRef = useRef(0);
  const lastGRef = useRef<GVec>({ x: 0, y: 0, z: 0 });
  const stillRef = useRef(true);

  // Init audio (on user gesture)
  const initAudio = async () => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
    }
    if (!audioRef.current) {
      const el = new Audio("/pour.mp3");
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      audioRef.current = el;
    }
    // iOS needs resume on user gesture
    try { await audioCtxRef.current!.resume(); } catch {}
  };

  const playPour = async () => {
    // Debounce: don’t fire more than once per 1s
    const now = Date.now();
    if (now - lastPlayRef.current < 1000) return;
    lastPlayRef.current = now;

    const el = audioRef.current;
    if (el) {
      try {
        el.currentTime = 0;
        await el.play();
        playingRef.current = true;
        el.onended = () => (playingRef.current = false);
        return;
      } catch {}
    }

    // Fallback: quick beep via WebAudio if file missing or blocked
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  };

  const startSensors = async () => {
    await initAudio();

    // iOS permission flow (DeviceMotion)
    // You only get this function on iOS Safari 13+
    const dm: any = (window as any).DeviceMotionEvent;
    if (dm && typeof dm.requestPermission === "function") {
      try {
        const response = await dm.requestPermission();
        if (response !== "granted") {
          alert("Motion permission denied. The app needs motion access.");
          return;
        }
      } catch {
        alert("Motion permission request failed.");
        return;
      }
    }

    // Also try DeviceOrientation (some Androids behave better)
    const doEvt: any = (window as any).DeviceOrientationEvent;
    if (doEvt && typeof doEvt.requestPermission === "function") {
      try { await doEvt.requestPermission(); } catch {}
    }

    // Listen for motion (including gravity)
    let lastStillCheck = 0;

    const onMotion = (e: DeviceMotionEvent) => {
      // accelerationIncludingGravity is widely supported
      const ag = e.accelerationIncludingGravity;
      if (!ag) return;

      const g = { x: ag.x ?? 0, y: ag.y ?? 0, z: ag.z ?? 0 };

      // Detect "stillness": small changes over brief time window
      const delta =
        Math.abs(g.x - lastGRef.current.x) +
        Math.abs(g.y - lastGRef.current.y) +
        Math.abs(g.z - lastGRef.current.z);

      lastGRef.current = g;

      const now = performance.now();
      if (now - lastStillCheck > 120) {
        // Heuristic thresholds:
        // delta < 0.25 ~ pretty still; > 0.8 ~ moving
        stillRef.current = delta < 0.25;
        lastStillCheck = now;
      }

      // Compute pitch/roll from gravity vector
      const { pitchDeg } = computePitchRoll(g);

      // “Pouring” when the phone is tipped forward enough.
      // In portrait, pitch ~ 0 upright, > ~60 = neck down.
      const pouring = pitchDeg > 60;

      if (pouring) playPour();
    };

    window.addEventListener("devicemotion", onMotion, { passive: true });

    setStarted(true);

    // Clean up on nav
    return () => window.removeEventListener("devicemotion", onMotion);
  };

  // Hide UI after start
  const [hideUi, setHideUi] = useState(false);
  useEffect(() => {
    if (started) {
      const t = setTimeout(() => setHideUi(true), 1200);
      return () => clearTimeout(t);
    }
  }, [started]);

  return (
    <div style={{ height: "100dvh", width: "100vw", position: "relative", overflow: "hidden" }}>
      <Scene getIsStill={() => stillRef.current} />
      {!started && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "radial-gradient(100% 100% at 50% 50%, rgba(0,0,0,0.6), rgba(0,0,0,0.9))",
          }}
        >
          <button
            onClick={startSensors}
            style={{
              fontSize: 18,
              padding: "14px 22px",
              borderRadius: 999,
              border: "1px solid #444",
              color: "#fff",
              background: "linear-gradient(#1a1a1a, #121212)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
            }}
          >
            Start (enable motion & sound)
          </button>
        </div>
      )}
      {started && !hideUi && (
        <div style={{ position: "absolute", top: 12, left: 12, color: "#bbb", fontSize: 12 }}>
          Hold upright to just see the bottle. Tip forward to “pour”.
        </div>
      )}
    </div>
  );
}
