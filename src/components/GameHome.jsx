import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import "./Target.css";
export default function GameHome({
  onPlay,
  audioSrc,
  title = "GAME BLOK",
  logoSrc = "/logos.png",
}) {
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef(null);

  const dust = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 1 + Math.random() * 2,
        d: 6 + Math.random() * 10,
      })),
    []
  );

  const play = useCallback(() => {
    if (typeof onPlay === "function") onPlay();
    else if (typeof window !== "undefined") window.location.href = "/game";
  }, [onPlay]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        play();
      } else if (e.key.toLowerCase() === "m") {
        setIsMuted((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = isMuted;
    if (!isMuted) el.play().catch(() => {});
    else el.pause();
  }, [isMuted]);

  return (
    <div className="crt-wrap">
      {/* BACKGROUND */}
      <div className="bg-wrap">
        <div className="paper" />
        <div className="grid" />

        {dust.map((p, i) => (
          <motion.span
            key={i}
            className="dust"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0], y: [0, -10, 0] }}
            transition={{ duration: p.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s }}
          />
        ))}

        <div className="scanlines" />
        <div className="vignette" />
        <div className="rgb-fringe" />
        <div className="flicker" />
      </div>

      {/* CONTENT (centered) */}
      <div className="content">
        {logoSrc ? (
          <motion.img
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            src={logoSrc}
            alt="logo"
            className="logo"
            draggable={false}
          />
        ) : (
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="title"
          >
            {title}
          </motion.h1>
        )}

        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={play}
          className="cursor-target btn btn-primary pixel mt-8"
          aria-label="Play"
        >
          <span className="btn-sheen" />
          <span className="btn-ripple" />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className=" btn-text">Play</span>
        </motion.button>

        <div className="controls">
          <button
            type="button"
            onClick={() => setIsMuted((v) => !v)}
            className="cursor-target btn btn-chip pixel"
            aria-pressed={!isMuted}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title="[M] toggle sound"
          >
            {isMuted ? <IconMute /> : <IconVolume />}
            <span>{isMuted ? "Muted" : "Sound On"}</span>
          </button>
          <span className="hint">[Space] Play • [M] Mute • [W][A][S][D] Move</span>
        </div>
      </div>

      {audioSrc ? <audio ref={audioRef} src={audioSrc} loop preload="auto" /> : null}
      <style>{css}</style>
    </div>
  );
}

/* Icons */
function IconMute() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" opacity=".3" />
      <path d="M5 9v6h4l5 5V4L9 9H5zm13.59 3 2.7-2.7-1.41-1.41L17.17 10.6l-2.7-2.7-1.41 1.41 2.7 2.7-2.7 2.7 1.41 1.41 2.7-2.7 2.71 2.7 1.41-1.41L18.59 12z" />
    </svg>
  );
}
function IconVolume() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 10v4h4l5 5V5L7 10H3z" />
      <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

/* Full CSS (includes background layers + centered layout) */
const css = `
:root {
  --amber: #fa9f42;
  --ink: #111418;
  --paper: #faf7f2;
  --grid: rgba(17,20,24,0.06);
  --chipFill: rgba(250,159,66,0.10);
  --chipEdge: rgba(250,159,66,0.55);
  --pixel: 6px;
  --radius: 16px;
  --font: ui-monospace, Menlo, Monaco, Consolas, "Cascadia Mono", "Fira Code", monospace;
}
* { box-sizing: border-box; font-family: var(--font); }
html, body, #root { height: 100%; }

/* CRT shell */
.crt-wrap {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  color: var(--ink);
  background: var(--paper);
  border-radius: 18px;
  transform: translateZ(0);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    inset 0 -2px 12px rgba(17,20,24,0.05);
}

/* Background layers */
.bg-wrap { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }

.paper {
  position: absolute; inset: -3%;
  background:
    radial-gradient(1000px 520px at 50% -10%, rgba(250,159,66,0.18) 0%, rgba(250,159,66,0) 60%),
    radial-gradient(900px 520px at 85% 120%, rgba(250,159,66,0.12) 0%, rgba(250,159,66,0) 70%),
    var(--paper);
  filter: saturate(1.02);
}

.grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 44px 44px, 44px 44px;
  background-position: -1px -1px, -1px -1px;
  mask-image: radial-gradient(120% 120% at 50% 50%, black 35%, transparent 95%);
}

/* Dust particles */
.dust {
  position: absolute;
  background: rgba(17,20,24,0.35);
  border-radius: 2px;
  filter: blur(0.2px);
}

/* CRT overlays */
.scanlines {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px);
  background-size: 100% 3px;
  mix-blend-mode: multiply;
}
.vignette {
  position: absolute; inset: 0;
  box-shadow: inset 0 0 120px rgba(0,0,0,0.18), inset 0 0 280px rgba(0,0,0,0.08);
  border-radius: 18px;
}
.rgb-fringe {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,255,0.06), rgba(0,0,255,0.06));
  mix-blend-mode: color-dodge;
  opacity: 0.35;
  filter: blur(0.3px);
}
@keyframes flicker { 0%,100% { opacity: .03 } 50% { opacity: .08 } }
.flicker {
  position: absolute; inset: 0;
  background: #fff;
  mix-blend-mode: overlay;
  animation: flicker 2.2s ease-in-out infinite;
  opacity: .04;
}

/* Centered content */
.content {
  position: relative;
  z-index: 1;
  min-height: 100dvh;
  max-width: 820px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;  /* centers vertically */
  gap: 20px;
  text-align: center;
}

/* Bigger, centered logo/title */
.logo {
  height: clamp(110px, 20vw, 200px);
  width: auto;
  filter: drop-shadow(0 0 18px rgba(250,159,66,0.5));
}
.title {
  font-size: clamp(42px, 7.5vw, 78px);
  letter-spacing: 0.18em;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
  text-shadow:
    0 0 1px rgba(17,20,24,0.25),
    0 0 14px rgba(250,159,66,0.35);
}

/* Pixel edge helper */
.pixel {
  clip-path: polygon(var(--pixel) 0, calc(100% - var(--pixel)) 0, 100% var(--pixel),
    100% calc(100% - var(--pixel)), calc(100% - var(--pixel)) 100%, var(--pixel) 100%,
    0 calc(100% - var(--pixel)), 0 var(--pixel));
  image-rendering: pixelated;
}

/* Buttons */
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transform: translateZ(0);
  outline: none;
}
.btn:focus-visible { box-shadow: 0 0 0 3px rgba(250,159,66,0.45); }

.btn-primary {
  padding: 14px 22px;
  color: #111418;
  background: linear-gradient(180deg, rgba(250,159,66,0.24), rgba(250,159,66,0.12));
  box-shadow:
    inset 0 0 0 1px rgba(250,159,66,0.7),
    0 10px 28px rgba(17,20,24,0.12);
  transition: transform 120ms ease, filter 120ms ease, box-shadow 200ms ease;
}
.btn-primary:hover {
  filter: saturate(1.04);
  box-shadow:
    inset 0 0 0 1px rgba(250,159,66,0.9),
    0 14px 34px rgba(17,20,24,0.16),
    0 0 22px rgba(250,159,66,0.35);
}
.btn-primary:active { transform: translateY(1px); }

.btn-sheen {
  pointer-events: none;
  position: absolute; inset: 0;
  background: linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%);
  mix-blend-mode: screen;
  transform: translateX(-120%);
  animation: sheen 2.6s ease-in-out infinite;
  opacity: 0.55;
  border-radius: inherit;
}
@keyframes sheen {
  0%,10% { transform: translateX(-120%) skewX(-12deg); }
  45%    { transform: translateX(120%)  skewX(-12deg); }
  100%   { transform: translateX(120%)  skewX(-12deg); }
}

.btn-ripple {
  pointer-events: none;
  position: absolute; inset: 0;
  background: radial-gradient(240px 80px at 50% 50%, rgba(250,159,66,0.25), rgba(250,159,66,0) 70%);
  filter: blur(10px);
  opacity: 0;
  animation: ripple 2.8s ease-in-out infinite;
  border-radius: inherit;
}
@keyframes ripple {
  0%   { opacity: 0;   transform: scale(.9); }
  30%  { opacity: .22; transform: scale(1); }
  60%  { opacity: .12; transform: scale(1.08); }
  100% { opacity: 0;   transform: scale(1.12); }
}

.btn-text { font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; }

.btn-chip {
  padding: 8px 12px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--chipFill), rgba(250,159,66,0.05));
  box-shadow:
    inset 0 0 0 1px var(--chipEdge),
    0 6px 18px rgba(17,20,24,0.08);
  font-size: 12px;
}
.btn-chip:hover {
  box-shadow:
    inset 0 0 0 1px rgba(250,159,66,0.9),
    0 8px 22px rgba(17,20,24,0.10);
}

.controls { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.hint { font-size: 11px; color: rgba(17,20,24,0.6); }
`;
