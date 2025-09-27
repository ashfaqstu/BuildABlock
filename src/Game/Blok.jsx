import React, { useEffect, useRef, useState } from "react";
import { useStoryblokApi } from "@storyblok/react";

export default function Platformer() {
  const storyblokApi = useStoryblokApi();

  // ---- constants ----
  const COIN_FPS = 12;
  const DEFAULT_COLS = 13;
  const DEFAULT_ROWS = 9;
  const makeGrid = (rows, cols, fill = 0) =>
    Array.from({ length: rows }, () => Array(cols).fill(fill));

  // ---- API-driven state ----
  const levelRef = useRef(makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0));     // 0 empty, 1 solid, 2 enemy
  const coinMapRef = useRef(makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0));   // 0 none, 1 coin
  const [levelTitle, setLevelTitle] = useState("Level");
  const [coinFrames, setCoinFrames] = useState([]);
  const [coinReady, setCoinReady] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  // ---- helpers ----
  function parseGridSmart(s, fallbackRows = DEFAULT_ROWS, fallbackCols = DEFAULT_COLS) {
    if (!s || typeof s !== "string") return makeGrid(fallbackRows, fallbackCols, 0);
    const body = s.replace(/\r\n/g, "\n").trim().replace(/,\s*$/m, ""); // tolerate trailing comma
    try {
      const arr = JSON.parse(`[${body}]`);
      return arr.map(row => row.map(v => (typeof v === "string" ? parseInt(v, 10) : v)));
    } catch {
      // line-by-line fallback
      const rows = [];
      body.split("\n").forEach(line => {
        let ln = line.trim();
        if (!ln) return;
        if (ln.endsWith(",")) ln = ln.slice(0, -1);
        if (!ln.startsWith("[")) return;
        try {
          rows.push(JSON.parse(ln).map(v => (typeof v === "string" ? parseInt(v, 10) : v)));
        } catch {}
      });
      if (!rows.length) return makeGrid(fallbackRows, fallbackCols, 0);
      const cols = Math.max(...rows.map(r => r.length));
      return rows.map(r => (r.length === cols ? r : r.concat(Array(cols - r.length).fill(0))));
    }
  }

  const coinsRef = useRef([]);
  const rebuildCoinsFromMap = () => {
    const arr = [];
    const rows = coinMapRef.current.length;
    const cols = coinMapRef.current[0]?.length || 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((coinMapRef.current[r]?.[c] ?? 0) == 1) arr.push({ c, r, taken: false });
      }
    }
    coinsRef.current = arr;
  };

  // ---- fetch Storyblok ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storyblokApi.get("cdn/stories/game", { version: "published" });
        const content = res?.data?.story?.content || {};
        const lv = content?.level?.[0] || {};

        setLevelTitle(lv?.Title || "Level");

        levelRef.current = parseGridSmart(lv?.map);
        coinMapRef.current = parseGridSmart(lv?.coin_map);
        rebuildCoinsFromMap();
        if (!cancelled) setMapsReady(true);

        // coin frames (animated)
        const frames = (content?.assets?.[0]?.frames ?? []).map(f => f.filename);
        const sorted = frames.slice().sort((a, b) => {
          const na = parseInt((a.split("/").pop() || "").replace(".png", ""), 10);
          const nb = parseInt((b.split("/").pop() || "").replace(".png", ""), 10);
          return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
        });
        if (sorted.length) {
          const imgs = await Promise.all(sorted.map(url => new Promise((resv, rej) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resv(img);
            img.onerror = rej;
            img.src = url;
          })));
          if (!cancelled) { setCoinFrames(imgs); setCoinReady(true); }
        } else {
          if (!cancelled) { setCoinFrames([]); setCoinReady(false); }
        }
      } catch (e) {
        console.error("Storyblok load error:", e);
        // keep safe defaults so UI still works
        levelRef.current = makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0);
        coinMapRef.current = makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0);
        rebuildCoinsFromMap();
        setMapsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [storyblokApi]);

  // ---- game state ----
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const tileRef = useRef(64);
  const [canvasSize, setCanvasSize] = useState({ w: DEFAULT_COLS * tileRef.current, h: DEFAULT_ROWS * tileRef.current });

  const COLS = () => (levelRef.current[0]?.length || DEFAULT_COLS);
  const ROWS = () => (levelRef.current.length || DEFAULT_ROWS);

  const player = useRef({
    x: 1 * tileRef.current + tileRef.current * 0.1,
    y: 6 * tileRef.current,
    w: tileRef.current * 0.6,
    h: tileRef.current * 0.6,
    vx: 0, vy: 0,
    speed: 280, jump: 800,
    onGround: false,
    color: "#111111",
  });

  const keys = useRef({ left: false, right: false, up: false });

  const recomputeSize = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cols = COLS(), rows = ROWS();
    const newTile = Math.max(20, Math.floor(Math.min((vw - 24) / cols, (vh - 24) / rows)));
    const oldTile = tileRef.current;
    if (newTile !== oldTile) {
      const s = newTile / oldTile;
      player.current.x *= s; player.current.y *= s;
      player.current.w *= s; player.current.h *= s;
      tileRef.current = newTile;
    }
    setCanvasSize({ w: cols * tileRef.current, h: rows * tileRef.current });
  };

  // Only size/loop when maps are ready
  useEffect(() => {
    if (!mapsReady) return;
    recomputeSize();
    const onResize = () => recomputeSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mapsReady]);

  const tileAt = (px, py) => {
    const TILE = tileRef.current;
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || col >= COLS() || row < 0 || row >= ROWS()) return 1; // OOB = solid
    return levelRef.current[row][col];
  };
  const isSolid = (v) => v == 1;
  const isEnemy = (v) => v == 2;

  const rectVsWorld = (r) => {
    const TILE = tileRef.current;
    let { x, y, w, h, vx, vy } = r;

    // Horizontal
    x += vx;
    const left = x, right = x + w, top = y + 1, bottom = y + h - 1;
    if (vx > 0) {
      if (isSolid(tileAt(right, top)) || isSolid(tileAt(right, bottom))) {
        x = Math.floor(right / TILE) * TILE - w - 0.01; vx = 0;
      }
    } else if (vx < 0) {
      if (isSolid(tileAt(left, top)) || isSolid(tileAt(left, bottom))) {
        x = Math.floor(left / TILE + 1) * TILE + 0.01; vx = 0;
      }
    }

    // Vertical
    y += vy;
    const nleft = x + 1, nright = x + w - 1, ntop = y, nbottom = y + h;
    let onGround = false;
    if (vy > 0) {
      if (isSolid(tileAt(nleft, nbottom)) || isSolid(tileAt(nright, nbottom))) {
        y = Math.floor(nbottom / TILE) * TILE - h - 0.01; vy = 0; onGround = true;
      }
    } else if (vy < 0) {
      if (isSolid(tileAt(nleft, ntop)) || isSolid(tileAt(nright, ntop))) {
        y = Math.floor(ntop / TILE + 1) * TILE + 0.01; vy = 0;
      }
    }
    return { x, y, vx, vy, onGround };
  };

  const resetPlayer = () => {
    const TILE = tileRef.current;
    Object.assign(player.current, { x: 1 * TILE + TILE * 0.1, y: 6 * TILE, vx: 0, vy: 0, onGround: false });
    rebuildCoinsFromMap();
    setScore(0);
  };

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // ---- main loop (only starts after mapsReady) ----
  useEffect(() => {
    if (!mapsReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let last = performance.now();
    const gravity = 1600, maxFall = 900, friction = 0.85;
    let coinTime = 0;

    const loop = (t) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;

      const TILE = tileRef.current;
      const W = COLS() * TILE, H = ROWS() * TILE;
      canvas.width = W; canvas.height = H;

      const P = player.current;

      // physics
      const accel = P.speed;
      let targetVX = 0;
      if (keys.current.left) targetVX -= accel;
      if (keys.current.right) targetVX += accel;
      P.vx = targetVX * dt;
      P.vy += gravity * dt; if (P.vy > maxFall) P.vy = maxFall;

      const solved = rectVsWorld({ x: P.x, y: P.y, w: P.w, h: P.h, vx: P.vx, vy: P.vy * dt });
      P.x = solved.x; P.y = solved.y; P.vx = solved.vx; P.vy = solved.vy / dt; P.onGround = solved.onGround;
      if (P.onGround) P.vx *= friction;

      // bg + grid
      ctx.fillStyle = "#faf1d8"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#e7dfc6"; ctx.lineWidth = 1;
      for (let c = 0; c <= COLS(); c++) { ctx.beginPath(); ctx.moveTo(c*TILE+0.5,0); ctx.lineTo(c*TILE+0.5,H); ctx.stroke(); }
      for (let r = 0; r <= ROWS(); r++) { ctx.beginPath(); ctx.moveTo(0,r*TILE+0.5); ctx.lineTo(W,r*TILE+0.5); ctx.stroke(); }

      // draw solids (1) & enemies (2)
      let died = false;
      for (let r = 0; r < ROWS(); r++) {
        for (let c = 0; c < COLS(); c++) {
          const val = levelRef.current[r][c];
          if (val == 0) continue;
          const x = c * TILE, y = r * TILE;
          if (val == 1) {
            ctx.fillStyle = "#21201b";
            ctx.fillRect(x, y, TILE, TILE);
          } else if (val == 2) {
            ctx.fillStyle = "#e54848";
            ctx.fillRect(x, y, TILE, TILE);
            if (overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) died = true;
          }
        }
      }
      if (died) resetPlayer();

      // coins (animated)
      const coinSize = TILE * 0.4;
      const frameCount = coinFrames.length || 1;
      if (coinReady && frameCount > 0) coinTime += dt;
      const frameIdx = coinReady ? Math.floor(coinTime * COIN_FPS) % frameCount : 0;

      coinsRef.current.forEach((coin) => {
        if (coin.taken) return;
        const cx = coin.c * TILE + TILE * 0.5 - coinSize / 2;
        const cy = coin.r * TILE + TILE * 0.5 - coinSize / 2;
        if (overlaps(P.x, P.y, P.w, P.h, cx, cy, coinSize, coinSize)) { coin.taken = true; setScore((s) => s + 1); }
        if (!coin.taken) {
          if (coinReady) ctx.drawImage(coinFrames[frameIdx], cx, cy, coinSize, coinSize);
          else { ctx.beginPath(); ctx.fillStyle = "#f5c542"; ctx.arc(cx + coinSize/2, cy + coinSize/2, coinSize/2, 0, Math.PI*2); ctx.fill(); }
        }
      });

      // HUD
      ctx.fillStyle = "#111";
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.font = `${Math.min(TILE * 0.5, 48)}px system-ui, Arial, sans-serif`;
      ctx.fillText(`Score: ${scoreRef.current}`, TILE * 0.5, TILE * 0.9);
      ctx.font = `${Math.min(TILE * 0.35, 32)}px system-ui, Arial, sans-serif`;
      ctx.fillText(levelTitle, TILE * 0.5, TILE * 1.5);

      // player
      ctx.fillStyle = P.color;
      ctx.fillRect(P.x, P.y, P.w, P.h);

      if (running) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const down = (e) => {
      if (["ArrowLeft","a","A"].includes(e.key)) keys.current.left = true;
      if (["ArrowRight","d","D"].includes(e.key)) keys.current.right = true;
      if (["w","W","ArrowUp"].includes(e.key) || e.code === "Space") keys.current.up = true;
      if ((["Space","w","W","ArrowUp"].includes(e.key) || e.code === "Space") && player.current.onGround) {
        player.current.vy = -player.current.jump; player.current.onGround = false;
      }
      if (e.key === "r" || e.key === "R") resetPlayer();
      if (e.key === "Escape") setRunning((r) => !r);
    };
    const up = (e) => {
      if (["ArrowLeft","a","A"].includes(e.key)) keys.current.left = false;
      if (["ArrowRight","d","D"].includes(e.key)) keys.current.right = false;
      if (["w","W","ArrowUp"].includes(e.key) || e.code === "Space") keys.current.up = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [running, coinFrames, coinReady, mapsReady, levelTitle]);

  // ---- UI ----
  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", background: "#faf1d8" }}>
      <div style={{ position: "fixed", top: 12, right: 12, display: "flex", gap: 8, zIndex: 10 }}>
        <button onClick={() => window.history.back()} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #444", background: "#222", color: "#faf1d8", cursor: "pointer", fontSize: 14 }}>
          Back
        </button>
        <button onClick={() => resetPlayer()} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #444", background: "#222", color: "#faf1d8", cursor: "pointer", fontSize: 14 }}>
          Reset
        </button>
      </div>

      <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
        {mapsReady ? (
          <canvas
            ref={canvasRef}
            style={{
              width: canvasSize.w, height: canvasSize.h,
              maxWidth: "100%", maxHeight: "100%",
              borderRadius: 14, boxShadow: "0 12px 36px rgba(0,0,0,0.25)", background: "#faf1d8"
            }}
          />
        ) : (
          <div style={{ fontFamily: "system-ui", color: "#111", opacity: 0.6 }}>Loading level…</div>
        )}
      </div>
    </div>
  );
}
