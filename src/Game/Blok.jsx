import React, { useEffect, useRef, useState } from "react";

/**
 * Minimal Platformer — Fullscreen Canvas
 * - Transparent instructions painted in the background
 * - Back & Reset buttons at top-right
 * - Coins & scoring (top-left HUD)
 * - Cream grid theme, black blocks & player
 */
export default function Platformer() {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);

  // Grid
  const COLS = 13;
  const ROWS = 9;
  const tileRef = useRef(64);
  const [canvasSize, setCanvasSize] = useState({
    w: COLS * tileRef.current,
    h: ROWS * tileRef.current,
  });

  // Level: 0 empty, 1 solid
  const level = useRef([
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,1,0],
    [0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,1,0,0,0,0,0,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
  ]);

  // Coins (tile positions). Reset restores from this seed.
  const coinSeed = [
    { c: 2, r: 3 }, { c: 5, r: 4 }, { c: 8, r: 3 },
    { c: 10, r: 5 }, { c: 11, r: 6 }, { c: 6, r: 2 },
  ];
  const coinsRef = useRef(coinSeed.map(({ c, r }) => ({ c, r, taken: false })));

  const player = useRef({
    x: 1 * tileRef.current + tileRef.current * 0.1,
    y: 6 * tileRef.current,
    w: tileRef.current * 0.6,
    h: tileRef.current * 0.6,
    vx: 0,
    vy: 0,
    speed: 280,
    jump: 520,
    onGround: false,
    color: "#111111",
  });

  const keys = useRef({ left: false, right: false, up: false });

  const recomputeSize = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availW = Math.max(160, vw - 24);
    const availH = Math.max(160, vh - 24);
    const newTile = Math.max(
      20,
      Math.floor(Math.min(availW / COLS, availH / ROWS))
    );

    const oldTile = tileRef.current;
    if (newTile !== oldTile) {
      const scale = newTile / oldTile;
      player.current.x *= scale;
      player.current.y *= scale;
      player.current.w *= scale;
      player.current.h *= scale;
      tileRef.current = newTile;
    }
    setCanvasSize({ w: COLS * tileRef.current, h: ROWS * tileRef.current });
  };

  const tileAt = (px, py) => {
    const TILE = tileRef.current;
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
    return level.current[row][col];
  };

  const rectVsWorld = (r) => {
    const TILE = tileRef.current;
    let { x, y, w, h, vx, vy } = r;

    // Horizontal
    x += vx;
    const left = x;
    const right = x + w;
    const top = y + 1;
    const bottom = y + h - 1;

    if (vx > 0) {
      if (tileAt(right, top) || tileAt(right, bottom)) {
        x = Math.floor(right / TILE) * TILE - w - 0.01;
        vx = 0;
      }
    } else if (vx < 0) {
      if (tileAt(left, top) || tileAt(left, bottom)) {
        x = Math.floor(left / TILE + 1) * TILE + 0.01;
        vx = 0;
      }
    }

    // Vertical
    y += vy;
    const nleft = x + 1;
    const nright = x + w - 1;
    const ntop = y;
    const nbottom = y + h;

    let onGround = false;

    if (vy > 0) {
      if (tileAt(nleft, nbottom) || tileAt(nright, nbottom)) {
        y = Math.floor(nbottom / TILE) * TILE - h - 0.01;
        vy = 0;
        onGround = true;
      }
    } else if (vy < 0) {
      if (tileAt(nleft, ntop) || tileAt(nright, ntop)) {
        y = Math.floor(ntop / TILE + 1) * TILE + 0.01;
        vy = 0;
      }
    }
    return { x, y, vx, vy, onGround };
  };

  const resetPlayer = () => {
    const TILE = tileRef.current;
    Object.assign(player.current, {
      x: 1 * TILE + TILE * 0.1,
      y: 6 * TILE,
      vx: 0,
      vy: 0,
      onGround: false,
    });
    // reset coins & score
    coinsRef.current = coinSeed.map(({ c, r }) => ({ c, r, taken: false }));
    setScore(0);
  };

  // AABB overlap check
  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.background = "#faf1d8";

    const onResize = () => recomputeSize();
    recomputeSize();
    window.addEventListener("resize", onResize);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let last = performance.now();
    const gravity = 1600;
    const maxFall = 900;
    const friction = 0.85;

    const loop = (t) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;

      const TILE = tileRef.current;
      const WIDTH = COLS * TILE;
      const HEIGHT = ROWS * TILE;
      canvas.width = WIDTH;
      canvas.height = HEIGHT;

      const P = player.current;

      // --- Physics ---
      const accel = P.speed;
      let targetVX = 0;
      if (keys.current.left) targetVX -= accel;
      if (keys.current.right) targetVX += accel;
      P.vx = targetVX * dt;

      P.vy += gravity * dt;
      if (P.vy > maxFall) P.vy = maxFall;

      const solved = rectVsWorld({
        x: P.x,
        y: P.y,
        w: P.w,
        h: P.h,
        vx: P.vx,
        vy: P.vy * dt,
      });
      P.x = solved.x;
      P.y = solved.y;
      P.vx = solved.vx;
      P.vy = solved.vy / dt;
      P.onGround = solved.onGround;
      if (P.onGround) P.vx *= friction;

      // --- Draw background ---
      ctx.fillStyle = "#faf1d8";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Grid
      ctx.strokeStyle = "#e7dfc6";
      ctx.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * TILE + 0.5, 0);
        ctx.lineTo(c * TILE + 0.5, HEIGHT);
        ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * TILE + 0.5);
        ctx.lineTo(WIDTH, r * TILE + 0.5);
        ctx.stroke();
      }

      // Transparent instructions watermark
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#111";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.floor(TILE * 0.6)}px system-ui, Arial, sans-serif`;
      ctx.fillText("←/→ or A/D  •  Jump: Space/W/↑  •  Reset: R  •  Pause: Esc", WIDTH / 2, HEIGHT * 0.12);
      ctx.restore();

      // Solids
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (level.current[r][c] === 1) {
            const x = c * TILE;
            const y = r * TILE;
            ctx.fillStyle = "#21201b";
            ctx.fillRect(x, y, TILE, TILE);
          }
        }
      }

      // Coins & pick-up
      const coinSize = TILE * 0.4;
      coinsRef.current.forEach((coin) => {
        if (coin.taken) return;
        const cx = coin.c * TILE + TILE * 0.5 - coinSize / 2;
        const cy = coin.r * TILE + TILE * 0.5 - coinSize / 2;

        // Check overlap with player
        if (overlaps(P.x, P.y, P.w, P.h, cx, cy, coinSize, coinSize)) {
          coin.taken = true;
          setScore((s) => s + 1);
        }

        // draw coin
        if (!coin.taken) {
          ctx.beginPath();
          ctx.fillStyle = "#f5c542";
          ctx.arc(cx + coinSize / 2, cy + coinSize / 2, coinSize / 2, 0, Math.PI * 2);
          ctx.fill();
          // subtle inner highlight
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(cx + coinSize * 0.35, cy + coinSize * 0.35, coinSize * 0.18, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Player
      ctx.fillStyle = P.color;
      ctx.fillRect(P.x, P.y, P.w, P.h);

      // HUD: score (top-left)
      ctx.fillStyle = "#111";
      ctx.font = `${Math.floor(TILE * 0.5)}px system-ui, Arial, sans-serif`;
      ctx.fillText(`Score: ${score}`, TILE * 0.5, TILE * 0.7);

      if (running) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const down = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keys.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keys.current.right = true;
      if (["w", "W", "ArrowUp"].includes(e.key) || e.code === "Space")
        keys.current.up = true;

      if ((["Space","w","W","ArrowUp"].includes(e.key) || e.code === "Space") && player.current.onGround) {
        player.current.vy = -player.current.jump;
        player.current.onGround = false;
      }
      if (e.key === "r" || e.key === "R") resetPlayer();
      if (e.key === "Escape") setRunning((r) => !r);
    };
    const up = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keys.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keys.current.right = false;
      if (["w", "W", "ArrowUp"].includes(e.key) || e.code === "Space")
        keys.current.up = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("resize", onResize);
    };
  }, [running, score]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#faf1d8",
      }}
    >
      {/* Top-right controls */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          display: "flex",
          gap: 8,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #444",
            background: "#222",
            color: "#faf1d8",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Back
        </button>
        <button
          onClick={resetPlayer}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #444",
            background: "#222",
            color: "#faf1d8",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: canvasSize.w,
            height: canvasSize.h,
            maxWidth: "100%",
            maxHeight: "100%",
            borderRadius: 14,
            boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
            background: "#faf1d8",
          }}
        />
      </div>
    </div>
  );
}
