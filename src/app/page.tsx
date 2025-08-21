"use client";

import { useEffect, useRef, useState } from "react";
import Scene from "./Components/Scene";

type GVec = { x: number; y: number; z: number };
type MotionPermissionState = "granted" | "denied" | "prompt";

function magnitude(g: GVec) {
  return Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
}

function computePitchRoll(g: GVec) {
  const m = magnitude(g) || 1;
  const gx = g.x / m, gy = g.y / m, gz = g.z / m;
  const pitchRad = Math.atan2(-gx, Math.sqrt(gy * gy + gz * gz));
  const rollRad  = Math.atan2(gy, gz);
  return { pitchDeg: (pitchRad * 180) / Math.PI, rollDeg: (rollRad * 180) / Math.PI };
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPlayRef = useRef(0);
  const lastGRef = useRef<GVec>({ x: 0, y: 0, z: 0 });
  const stillRef = useRef(true);

  // Init audio (user gesture)
  const initAudio = async () => {
    if (!audioCtxRef.current) {
      const AudioCtor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioCtor) {
        audioCtxRef.current = new AudioCtor();
      }
    }
    if (!audioRef.current) {
      const el = new Audio("/pour.mp3");
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      audioRef.current = el;
    }
    try {
      await audioCtxRef.current?.resume();
    } catch {
      /* noop */
    }
  };

  const playPour = async () => {
    const now = Date.now();
    if (now - lastPlayRef.current < 1000) return;
    lastPlayRef.current = now;

    const el = audioRef.current;
    if (el) {
      try {
        el.currentTime = 0;
        await el.play();
        return;
      } catch {
        // fall through to WebAudio beep
      }
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 600;
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.15, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.start();
    osc.stop(t0 + 0.28);
  };

  const startSensors = async () => {
    await initAudio();

    // iOS DeviceMotion permission
    type DMClass = typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<MotionPermissionState>;
    };
    const DM = (window as Window & { DeviceMotionEvent?: DMClass }).DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === "function") {
      try {
        const response = await DM.requestPermission();
        if (response !== "granted") {
          alert("Motion permission denied. The app needs motion access.");
          return;
        }
      } catch {
        alert("Motion permission request failed.");
        return;
      }
    }

    // Some Androids need DeviceOrientation permission too
    type DOClass = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<MotionPermissionState>;
    };
    const DO = (window as Window & { DeviceOrientationEvent?: DOClass }).DeviceOrientationEvent;
    if (DO && typeof DO.requestPermission === "function") {
      try {
        await DO.requestPermission();
      } catch {
        /* ignore */
      }
    }

    let lastStillCheck = 0;

    const onMotion = (e: DeviceMotionEvent) => {
      const ag = e.accelerationIncludingGravity;
      if (!ag) return;
      const g: GVec = { x: ag.x ?? 0, y: ag.y ?? 0, z: ag.z ?? 0 };

      const delta =
        Math.abs(g.x - lastGRef.current.x) +
        Math.abs(g.y - lastGRef.current.y) +
        Math.abs(g.z - lastGRef.current.z);

      lastGRef.current = g;

      const now = performance.now();
      if (now - lastStillCheck > 120) {
        stillRef.current = delta < 0.25;
        lastStillCheck = now;
      }

      const { pitchDeg } = computePitchRoll(g);
      const pouring = pitchDeg > 60;
      if (pouring) void playPour();
    };

    window.addEventListener("devicemotion", onMotion, { passive: true });
    setStarted(true);

    // Cleanup when navigating away
    return () => {
      window.removeEventListener("devicemotion", onMotion);
    };
  };

  const [hideUi, setHideUi] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setHideUi(true), 1200);
    return () => clearTimeout(t);
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
            background:
              "radial-gradient(100% 100% at 50% 50%, rgba(0,0,0,0.6), rgba(0,0,0,0.9))",
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
            Start (enable motion &amp; sound)
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
