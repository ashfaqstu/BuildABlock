import React, { useEffect, useRef, useState } from "react";
import { useStoryblokApi } from "@storyblok/react";
import DotGrid from "../components/DotGrid";
import { useNavigate } from "react-router-dom";

// ---------- Defaults (used as fallback) ----------
const DEFAULT_PRIMARY = "#58B883";
const DEFAULT_THEME = (primary = DEFAULT_PRIMARY) => ({
  bg: "#F3EAD7",
  grid: "#E9E2CF",
  text: "#1F1E1A",
  cardBg: "rgba(255, 247, 228, 0.85)",
  cardBorder: "rgba(31, 30, 26, 0.25)",
  cardShadow: "0 6px 20px rgba(0,0,0,0.18)",
  btnBg: "rgba(255, 243, 221, 0.9)",
  btnBorder: "rgba(31, 30, 26, 0.25)",
  btnShadow: "0 4px 12px rgba(0,0,0,0.15)",
  tileSolid: "#2B2A26",
  tileEnemy: "#D74B4B",
  tileGoal:  primary,          // <- primary used here
  player: "#2D2C28",
  coin: "#E6C35C",
});

// ---------- Small utils ----------
const isHexColor = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((c||"").trim());
const pickPrimaryFromContent = (content) => {
  const maybe =
    content?.primary_color ||
    content?.theme?.primary ||
    content?.colors?.primary ||
    null;
  return isHexColor(maybe) ? maybe.trim() : DEFAULT_PRIMARY;
};

const loadImage = (url) => new Promise((resolve) => {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return resolve(null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = url;
});

// ---------- Component ----------
export default function Game() {
  const navigate = useNavigate();
  const storyblokApi = useStoryblokApi();

  // ---- constants ----
  const COIN_FPS = 12;
  const DEFAULT_COLS = 13;
  const DEFAULT_ROWS = 9;

  const makeGrid = (rows, cols, fill = 0) =>
    Array.from({ length: rows }, () => Array(cols).fill(fill));

  // ---- API-driven state ----
  const levelsRef = useRef([]); // [{title, map, coin, tileImg}]
  const levelRef = useRef(makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0));   // 0 empty, 1 solid, 2 enemy, 3 goal
  const coinMapRef = useRef(makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0)); // 0 none, 1 coin
  const currentTileImgRef = useRef(null);

  const [levelTitle, setLevelTitle] = useState("Level");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [coinFrames, setCoinFrames] = useState([]);
  const [coinReady, setCoinReady] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  // theme (with primary from API, fallback)
  const [theme, setTheme] = useState(DEFAULT_THEME());

  // ---- audio ----
  const jumpSfxRef   = useRef(null);
  const passedSfxRef = useRef(null);
  const overSfxRef   = useRef(null);
  const scorePoolRef = useRef([]);     // overlapping coin pickup sfx pool
  const scoreIdxRef  = useRef(0);

  useEffect(() => {
    const POOL_SIZE = 4;
    scorePoolRef.current = Array.from({ length: POOL_SIZE }, () => {
      const a = new Audio("/assets/sfx/score.mp3");
      a.preload = "auto";
      a.volume = 0.6;
      return a;
    });
    return () => {
      scorePoolRef.current.forEach(a => { a.pause(); a.src = ""; });
      scorePoolRef.current = [];
    };
  }, []);

  const playScoreSfx = () => {
    const pool = scorePoolRef.current;
    if (!pool.length) return;
    const a = pool[scoreIdxRef.current++ % pool.length];
    try { a.currentTime = 0; a.play(); } catch {}
  };

  // ---- helpers ----
  function parseGridSmart(s, fallbackRows = DEFAULT_ROWS, fallbackCols = DEFAULT_COLS) {
    if (!s || typeof s !== "string") return makeGrid(fallbackRows, fallbackCols, 0);
    const body = s.replace(/\r\n/g, "\n").trim().replace(/,\s*$/m, "");
    try {
      const arr = JSON.parse(`[${body}]`);
      return arr.map(row => row.map(v => (typeof v === "string" ? parseInt(v, 10) : v)));
    } catch {
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

  const keys = useRef({ left: false, right: false, up: false });
  const clearInputsAndFocus = () => {
    keys.current.left = keys.current.right = keys.current.up = false;
    const el = document.activeElement;
    if (el && typeof el.blur === "function") el.blur();
  };

  const loadLevelIndex = (idx) => {
    const L = levelsRef.current[idx];
    if (!L) return;
    levelRef.current = L.map;
    coinMapRef.current = L.coin;
    currentTileImgRef.current = L.tileImg || null;
    setLevelTitle(L.title || `Level ${idx + 1}`);
    rebuildCoinsFromMap();
    const TILE = tileRef.current;
    Object.assign(player.current, { x: 1 * TILE + TILE * 0.1, y: 6 * TILE, vx: 0, vy: 0, onGround: false });
    setMapsReady(true);
    setCurrentLevel(idx);
    recomputeSize();
    shadowTrailRef.current = [];
    clearInputsAndFocus();
  };

  const advanceLevel = () => {
    const next = currentLevel + 1;
    if (next < levelsRef.current.length) {
      loadLevelIndex(next);
    }
  };

  // ---- fetch Storyblok + theme primary + per-level tiles ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storyblokApi.get("cdn/stories/game", { version: "published" });
        const content = res?.data?.story?.content || {};

        // primary color -> theme
        const primary = pickPrimaryFromContent(content);
        if (!cancelled) setTheme(DEFAULT_THEME(primary));

        // levels
        const levelBlocks = Array.isArray(content?.level) ? content.level : [];

        // prepare levels with possible tile image
        const built = await Promise.all(
          levelBlocks.map(async (blk, i) => {
            const title = blk?.Title || `Level ${i + 1}`;
            const map = parseGridSmart(blk?.map);
            const coin = parseGridSmart(blk?.coin_map);
            let tileImg = null;
            const tileURL = blk?.tiles?.filename || "";
            if (tileURL) tileImg = await loadImage(tileURL);
            return { title, map, coin, tileImg };
          })
        );

        const valid = built.filter(L => L.map?.length && L.map[0]?.length);
        if (!valid.length) {
          valid.push({
            title: "Level 1",
            map: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
            coin: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
            tileImg: null,
          });
        }

        levelsRef.current = valid;
        if (!cancelled) loadLevelIndex(0);

        // coin frames
        const frames = (content?.assets?.[0]?.frames ?? []).map(f => f.filename);
        const sorted = frames.slice().sort((a, b) => {
          const na = parseInt((a.split("/").pop() || "").replace(".png", ""), 10);
          const nb = parseInt((b.split("/").pop() || "").replace(".png", ""), 10);
          return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
        });
        if (sorted.length) {
          const imgs = await Promise.all(sorted.map(url => loadImage(url)));
          const ready = imgs.filter(Boolean);
          if (!cancelled) { setCoinFrames(ready); setCoinReady(ready.length > 0); }
        } else if (!cancelled) {
          setCoinFrames([]); setCoinReady(false);
        }
      } catch (e) {
        console.error("Storyblok load error:", e);
        levelsRef.current = [{
          title: "Level 1",
          map: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
          coin: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
          tileImg: null,
        }];
        loadLevelIndex(0);
      }
    })();
    return () => { cancelled = true; };
  }, [storyblokApi]); // eslint-disable-line

  // ---- game state ----
  const canvasRef = useRef(null);
  const gameWrapRef = useRef(null);
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
    color: "#2D2C28",
  });

  // ----- Delay Shadow (ghost trail) -----
  const SHADOW_STEPS = 10;
  const SHADOW_ALPHA = 0.14;
  const shadowTrailRef = useRef([]); // [{x,y,w,h}...]

  // ----- Overlays -----
  // overlay = null | { kind: 'levelComplete' } | { kind: 'gameWin' }
  const [overlay, setOverlay] = useState(null);
  const overlayRef = useRef({ active: false, kind: null });
  const nextLevelTimerRef = useRef(null);

  // ----- Screen shake -----
  const shakeRef = useRef({ t: 0, dur: 0, mag: 0 });
  const startShake = (durMs = 350, mag = 12) => {
    shakeRef.current = { t: durMs, dur: durMs, mag };
  };

  // ----- Death debounce -----
  const deathTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (nextLevelTimerRef.current) clearTimeout(nextLevelTimerRef.current);
      if (deathTimerRef.current) clearTimeout(deathTimerRef.current);
    };
  }, []);

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
  const isGoal  = (v) => v == 3;

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
    shadowTrailRef.current = [];
    setScore(0);
  };

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // ---- Fancy goal tile drawing + label ----
  const drawFancyGoal = (ctx, x, y, TILE, t) => {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const r = TILE * 0.42;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.004);
    const outer = r * (0.9 + 0.08 * pulse);
    const inner = r * (0.55 + 0.05 * pulse);

    // Glow ring
    const g = ctx.createRadialGradient(cx, cy, inner * 0.6, cx, cy, outer);
    g.addColorStop(0, "rgba(255,255,255,0.65)");
    g.addColorStop(0.5, "rgba(152, 235, 190, 0.45)");
    g.addColorStop(1, "rgba(88, 184, 131, 0.15)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.fill();

    // Portal disc (use theme.tileGoal tone)
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner);
    g2.addColorStop(0, "rgba(255,255,255,0.85)");
    g2.addColorStop(1, "rgba(88, 184, 131, 0.85)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fill();

    // Rotating starburst
    ctx.translate(cx, cy);
    ctx.rotate((t * 0.002) % (Math.PI * 2));
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, TILE * 0.03);
    const spikes = 8;
    const R1 = inner * (0.55 + 0.1 * pulse);
    const R2 = inner * (0.9 + 0.05 * pulse);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i * Math.PI) / spikes;
      const rr = i % 2 === 0 ? R2 : R1;
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // "GOAL!" label above
    ctx.save();
    ctx.font = `${Math.max(12, TILE * 0.28)}px system-ui, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = Math.max(2, TILE * 0.05);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText("GOAL!", cx, y - TILE * 0.08);
    ctx.fillText("GOAL!", cx, y - TILE * 0.08);
    ctx.restore();
  };

  // ---- Rotating red enemy star ----
  const drawEnemyStar = (ctx, x, y, TILE, t) => {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const spikes = 8;
    const outerR = TILE * 0.45;
    const innerR = TILE * 0.20;
    const rot = (t * 0.003) % (Math.PI * 2);

    ctx.save();
    // soft outer glow
    const glow = ctx.createRadialGradient(cx, cy, innerR * 0.3, cx, cy, outerR * 1.2);
    glow.addColorStop(0, "rgba(255, 120, 120, 0.55)");
    glow.addColorStop(1, "rgba(255, 80, 80, 0.05)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // star shape
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // glossy red fill
    const grad = ctx.createLinearGradient(0, -outerR, 0, outerR);
    grad.addColorStop(0, "#FF7A7A");
    grad.addColorStop(0.5, "#D74B4B");
    grad.addColorStop(1, "#A52020");
    ctx.fillStyle = grad;
    ctx.fill();

    // bright rim
    ctx.lineWidth = Math.max(1.5, TILE * 0.06);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();
    ctx.restore();
  };

  // ---- main loop ----
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
      const overlayActive = overlayRef.current.active;

      // physics (pause during overlay)
      if (!overlayActive) {
        const accel = P.speed;
        let targetVX = 0;
        if (keys.current.left) targetVX -= accel;
        if (keys.current.right) targetVX += accel;
        P.vx = targetVX * dt;
        P.vy += gravity * dt; if (P.vy > maxFall) P.vy = maxFall;

        const solved = rectVsWorld({ x: P.x, y: P.y, w: P.w, h: P.h, vx: P.vx, vy: P.vy * dt });
        P.x = solved.x; P.y = solved.y; P.vx = solved.vx; P.vy = solved.vy / dt; P.onGround = solved.onGround;
        if (P.onGround) P.vx *= friction;

        // Record shadow trail
        shadowTrailRef.current.push({ x: P.x, y: P.y, w: P.w, h: P.h });
        if (shadowTrailRef.current.length > SHADOW_STEPS) shadowTrailRef.current.shift();
      }

      // bg + grid
      ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
      for (let c = 0; c <= COLS(); c++) { ctx.beginPath(); ctx.moveTo(c*TILE+0.5,0); ctx.lineTo(c*TILE+0.5,H); ctx.stroke(); }
      for (let r = 0; r <= ROWS(); r++) { ctx.beginPath(); ctx.moveTo(0,r*TILE+0.5); ctx.lineTo(W,r*TILE+0.5); ctx.stroke(); }

      // tiles & collisions
      let died = false;
      let reachedGoal = false;
      for (let r = 0; r < ROWS(); r++) {
        for (let c = 0; c < COLS(); c++) {
          const val = levelRef.current[r][c];
          if (val == 0) continue;
          const x = c * TILE, y = r * TILE;

          if (val == 1) {
            // Base solid block
            ctx.fillStyle = theme.tileSolid;
            ctx.fillRect(x, y, TILE, TILE);

            // Optional overlay tile texture (per-level)
            const tex = currentTileImgRef.current;
            if (tex) {
              // draw texture on top, scaled to tile
              ctx.globalAlpha = 0.95;
              ctx.drawImage(tex, x, y, TILE, TILE);
              ctx.globalAlpha = 1;
            }
          } else if (val == 2) {
            // Enemy star
            drawEnemyStar(ctx, x, y, TILE, t);
            if (!overlayActive && overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) died = true;
          } else if (val == 3) {
            // Fancy goal + label
            drawFancyGoal(ctx, x, y, TILE, t);
            if (!overlayActive && overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) reachedGoal = true;
          }
        }
      }

      // death or goal handling
      if (!overlayActive) {
        if (died) {
          // SHAKE + over SFX, then reset
          if (!deathTimerRef.current) {
            startShake(380, 13);
            const o = overSfxRef.current;
            if (o) { try { o.currentTime = 0; o.volume = 0.9; o.play(); } catch {} }
            deathTimerRef.current = setTimeout(() => {
              deathTimerRef.current = null;
              resetPlayer();
              clearInputsAndFocus();
            }, 420);
          }
        } else if (reachedGoal) {
          // Determine if last level
          const next = currentLevel + 1;
          const isFinal = next >= levelsRef.current.length;

          // play passed sfx
          const p = passedSfxRef.current;
          if (p) { try { p.currentTime = 0; p.volume = 0.8; p.play(); } catch {} }

          if (isFinal) {
            overlayRef.current.active = true;
            overlayRef.current.kind = "gameWin";
            setOverlay({ kind: "gameWin" });
            clearInputsAndFocus();
          } else {
            overlayRef.current.active = true;
            overlayRef.current.kind = "levelComplete";
            setOverlay({ kind: "levelComplete" });
            clearInputsAndFocus();
            // Auto-advance after 2s
            nextLevelTimerRef.current = setTimeout(() => {
              overlayRef.current.active = false;
              overlayRef.current.kind = null;
              setOverlay(null);
              advanceLevel();
              clearInputsAndFocus();
            }, 2000);
          }
        }

        // coins (animated) + score SFX trigger
        const coinSize = TILE * 0.4;
        const frameCount = coinFrames.length || 1;
        if (coinReady && frameCount > 0) coinTime += dt;
        const frameIdx = coinReady ? Math.floor(coinTime * COIN_FPS) % frameCount : 0;

        coinsRef.current.forEach((coin) => {
          if (coin.taken) return;
          const cx = coin.c * TILE + TILE * 0.5 - coinSize / 2;
          const cy = coin.r * TILE + TILE * 0.5 - coinSize / 2;
          if (overlaps(P.x, P.y, P.w, P.h, cx, cy, coinSize, coinSize)) {
            coin.taken = true;
            setScore((s) => s + 1);
            playScoreSfx();
          }
          if (!coin.taken) {
            if (coinReady) ctx.drawImage(coinFrames[frameIdx], cx, cy, coinSize, coinSize);
            else {
              ctx.beginPath(); ctx.fillStyle = theme.coin;
              ctx.arc(cx + coinSize/2, cy + coinSize/2, coinSize/2, 0, Math.PI*2); ctx.fill();
            }
          }
        });
      } else {
        // Overlay active: freeze visuals for coins
        const coinSize = TILE * 0.4;
        const frameCount = coinFrames.length || 1;
        const frameIdx = coinReady && frameCount ? Math.floor(coinTime * COIN_FPS) % frameCount : 0;
        coinsRef.current.forEach((coin) => {
          if (coin.taken) return;
          const cx = coin.c * TILE + TILE * 0.5 - coinSize / 2;
          const cy = coin.r * TILE + TILE * 0.5 - coinSize / 2;
          if (coinReady) ctx.drawImage(coinFrames[frameIdx], cx, cy, coinSize, coinSize);
          else {
            ctx.beginPath(); ctx.fillStyle = theme.coin;
            ctx.arc(cx + coinSize/2, cy + coinSize/2, coinSize/2, 0, Math.PI*2); ctx.fill();
          }
        });
      }

      // Draw delay shadow ghosts
      ctx.save();
      ctx.filter = "blur(1.2px)";
      for (let i = 0; i < shadowTrailRef.current.length; i++) {
        const s = shadowTrailRef.current[i];
        const k = (i + 1) / SHADOW_STEPS;
        const a = SHADOW_ALPHA * k;
        const shrink = 1 - k * 0.12;
        const ox = (1 - k) * 6;
        const oy = (1 - k) * 4;

        const w = s.w * shrink;
        const h = s.h * shrink;
        const x = s.x + (s.w - w) * 0.5 - ox;
        const y = s.y + (s.h - h) * 0.5 - oy;

        ctx.globalAlpha = a;
        ctx.fillStyle = "#2D2C28";
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.filter = "none";

      // player (on top)
      ctx.fillStyle = player.current.color;
      ctx.fillRect(P.x, P.y, P.w, P.h);

      // Screen shake transform on wrapper
      if (shakeRef.current.t > 0 && gameWrapRef.current) {
        shakeRef.current.t -= dt * 1000;
        const k = Math.max(shakeRef.current.t, 0) / shakeRef.current.dur; // 1..0
        const m = shakeRef.current.mag * (0.2 + 0.8 * k);
        const rx = (Math.random() * 2 - 1) * m;
        const ry = (Math.random() * 2 - 1) * m;
        gameWrapRef.current.style.transform = `translate(${rx}px, ${ry}px)`;
        if (shakeRef.current.t <= 0) gameWrapRef.current.style.transform = "translate(0,0)";
      }

      if (running) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const down = (e) => {
      // ignore keydowns during overlay (but allow Escape to pause)
      if (overlayRef.current.active && e.key !== "Escape") return;

      if (["ArrowLeft","a","A"].includes(e.key)) keys.current.left = true;
      if (["ArrowRight","d","D"].includes(e.key)) keys.current.right = true;
      if (["w","W","ArrowUp"].includes(e.key) || e.code === "Space") keys.current.up = true;

      // Jump with SFX (onGround only)
      if ((["Space","w","W","ArrowUp"].includes(e.key) || e.code === "Space") && player.current.onGround) {
        player.current.vy = -player.current.jump;
        player.current.onGround = false;
        const a = jumpSfxRef.current;
        if (a) { try { a.currentTime = 0; a.volume = 0.55; a.play(); } catch {} }
      }

      if (e.key === "r" || e.key === "R") { resetPlayer(); clearInputsAndFocus(); }
      if (e.key === "Escape") setRunning((r) => !r);
    };

    const up = (e) => {
      // DO NOT block keyups during overlay; this fixes "stuck keys"
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
  }, [running, coinFrames, coinReady, mapsReady, levelTitle, currentLevel, theme]);

  // ---- UI ----
  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", color: theme.text }}>
      {/* Preloaded SFX */}
      <audio ref={jumpSfxRef}   src="/assets/sfx/jump.mp3"   preload="auto" />
      <audio ref={passedSfxRef} src="/assets/sfx/passed.mp3" preload="auto" />
      <audio ref={overSfxRef}   src="/assets/sfx/over.mp3"   preload="auto" />

      {/* Background dots */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: -1,
          pointerEvents: "none",
          background: theme.bg,
        }}
      >
        <DotGrid
          dotSize={10}
          gap={15}
          baseColor="#EADFC6"
          activeColor="#151411"
          proximity={120}
          shockRadius={220}
          shockStrength={4.2}
          resistance={800}
          returnDuration={1.6}
        />
      </div>

      {/* Top-right controls */}
      <div style={{ position: "fixed", top: 12, right: 12, display: "flex", gap: 8, zIndex: 10 }}>
        <button
          onClick={(e) => { navigate('/'); e.currentTarget.blur(); }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1.5px solid ${theme.btnBorder}`,
            background: theme.btnBg,
            color: theme.text,
            cursor: "pointer",
            fontSize: 14,
            boxShadow: theme.btnShadow,
          }}
        >
          Back
        </button>
        <button
          onClick={(e) => { resetPlayer(); e.currentTarget.blur(); }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1.5px solid ${theme.btnBorder}`,
            background: theme.btnBg,
            color: theme.text,
            cursor: "pointer",
            fontSize: 14,
            boxShadow: theme.btnShadow,
          }}
        >
          Reset
        </button>
      </div>

      {/* LEFT FIXED HUD */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontFamily: "system-ui, Arial, sans-serif",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1.5px solid ${theme.cardBorder}`,
            background: theme.cardBg,
            color: theme.text,
            boxShadow: theme.cardShadow,
            minWidth: 140,
            fontWeight: 700,
          }}
        >
          Level: {levelTitle || `Level ${currentLevel + 1}`}
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1.5px solid ${theme.cardBorder}`,
            background: theme.cardBg,
            color: theme.text,
            boxShadow: theme.cardShadow,
            minWidth: 140,
            fontWeight: 700,
          }}
        >
          Score: {score}
        </div>
      </div>

      {/* Game canvas (+ shake wrapper) */}
      <div style={{ marginTop:"15px", height: "100%", display: "grid", placeItems: "center", zIndex: 1 }}>
        {mapsReady ? (
          <div ref={gameWrapRef} style={{ willChange: "transform" }}>
            <canvas
              ref={canvasRef}
              style={{
                width: canvasSize.w,
                height: canvasSize.h,
                maxWidth: "100%",
                maxHeight: "100%",
                borderRadius: 16,
                boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
                background: theme.bg,
              }}
            />
          </div>
        ) : (
          <div style={{ fontFamily: "system-ui", color: theme.text, opacity: 0.7 }}>
            Loading level…
          </div>
        )}
      </div>

      {/* Overlays */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: overlay ? "rgba(0,0,0,0.25)" : "transparent",
          backdropFilter: overlay ? "blur(2px)" : "none",
          opacity: overlay ? 1 : 0,
          transition: "opacity 220ms ease",
          pointerEvents: overlay ? "auto" : "none",
          zIndex: 20,
        }}
      >
        {overlay?.kind === "levelComplete" && (
          <div
            style={{
              padding: "22px 28px",
              borderRadius: 16,
              background: theme.cardBg,
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              boxShadow: theme.cardShadow,
              fontFamily: "system-ui, Arial, sans-serif",
              fontWeight: 800,
              fontSize: 28,
              textAlign: "center",
            }}
          >
            🎉 Congratulations!
            <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.8, marginTop: 6 }}>
              Next round starting…
            </div>
          </div>
        )}

        {overlay?.kind === "gameWin" && (
          <div
            style={{
              padding: "24px 30px",
              borderRadius: 18,
              background: theme.cardBg,
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              boxShadow: theme.cardShadow,
              fontFamily: "system-ui, Arial, sans-serif",
              textAlign: "center",
              minWidth: 280,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 30, marginBottom: 8 }}>🏆 Congratulations!</div>
            <div style={{ fontWeight: 700, fontSize: 18, opacity: 0.9, marginBottom: 18 }}>
              You have won the game.
            </div>
            <button
              onClick={(e) => { navigate('/'); e.currentTarget.blur(); }}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: `1.5px solid ${theme.btnBorder}`,
                background: theme.btnBg,
                color: theme.text,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
                boxShadow: theme.btnShadow,
              }}
            >
              Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
