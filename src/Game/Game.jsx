import React, { useEffect, useRef, useState } from "react";
import { useStoryblokApi } from "@storyblok/react";
import { useNavigate } from "react-router-dom";
import DotGrid from "../components/DotGrid";


/* ===================== Color Utilities ===================== */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const DEFAULT_PRIMARY = "#fa9f42"; // orange

function normalizeHex(h) {
  if (!h) return null;
  let s = String(h).trim();
  if (s.startsWith("#")) s = s.slice(1);
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[0], g = s[1], b = s[2];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}
function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return { r: 255, g: 255, b: 255 };
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max-min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}
function rgbToHex(r, g, b) {
  const to2 = (n) => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}
function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function gridColorFromBackground(bgHex) {
  const lum = relativeLuminance(bgHex);
  if (!Number.isFinite(lum)) return shade(bgHex, -0.1, 0);
  if (lum >= 0.75) return shade(bgHex, -0.35, -0.05);
  if (lum >= 0.6) return shade(bgHex, -0.28, -0.04);
  if (lum >= 0.45) return shade(bgHex, -0.18, -0.03);
  if (lum >= 0.3) return shade(bgHex, 0.12, -0.05);
  return shade(bgHex, 0.2, -0.05);
}
function shade(hex, dL = 0, dS = 0) {
  const { r, g, b } = hexToRgb(hex);
  let { h, s, l } = rgbToHsl(r, g, b);
  s = clamp01(s + dS);
  l = clamp01(l + dL);
  return hslToHex(h, s, l);
}
// helper for alpha output as CSS hsla()
// helper for alpha output as CSS hsla()
function hslToCss(h, s, l, a = 1) {
  const H = Math.round(h);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `hsla(${H} ${S}% ${L}% / ${a})`;
}
function dotPaletteFromPrimary(primaryHex, bgHex) {
  const primary = normalizeHex(primaryHex);
  const bg = normalizeHex(bgHex);
  if (!primary || !bg) {
    return { base: "#A8A8A8", active: "#7A7A7A" }; // safe fallback
  }

  const { r, g, b } = hexToRgb(primary);
  const { h, s } = rgbToHsl(r, g, b);
  const bgLum = relativeLuminance(bg); // 0 (black) → 1 (white)

  // relative lightness for base = just a little darker than bg
  // e.g. bgLum 0.9 → base 0.75
  let baseLight = clamp01(bgLum - 0.001 );

  // keep saturation soft so it blends
  const baseSat   = clamp01(0.15 + s * 0.30);
  const activeSat = clamp01(baseSat + 0.75);

  // active = slightly darker than base, not black
  const DARKEN_STEP = 0.05;
  let activeLight = clamp01(Math.max(0.25, baseLight - DARKEN_STEP));

  return {
    base: hslToHex(h, baseSat, baseLight),
    active: hslToHex(h, activeSat, activeLight),
  };
}




function deriveThemeFromPrimary(primaryHex) {
  const fallback = DEFAULT_PRIMARY;
  const p = normalizeHex(primaryHex) || fallback;
  const { r, g, b } = hexToRgb(p);
  const { h, s } = rgbToHsl(r, g, b);

  const bg = hslToHex(h, Math.max(0.40, Math.min(0.65, s * 0.9 + 0.2)), 0.82);
   const grid = gridColorFromBackground(bg);
  const text = "#161513";
  const tileSolid = "#2B2A26";
  const coin = "#F1C65C";
  const { base: dotBase, active: dotActive } = dotPaletteFromPrimary(p, bg);


  return {
    primary: p,
    bg,
    grid,
    text,
    cardBg: "rgba(255, 243, 214, 0.97)",
    cardBorder: "rgba(31, 30, 26, 0.3)",
    cardShadow: "0 8px 22px rgba(0,0,0,0.22)",
    btnBg: "rgba(255, 239, 204, 0.98)",
    btnBorder: "rgba(31, 30, 26, 0.32)",
    btnShadow: "0 5px 16px rgba(0,0,0,0.2)",
    tileSolid,
    tileEnemy: "#E14848", // fixed
    tileGoal:  "#58B883", // fixed
    player:    "#2D2C28", // fixed
    coin,
    dotBase,
    dotActive,
  };
}
const DEFAULT_THEME = deriveThemeFromPrimary(DEFAULT_PRIMARY);
const rgbaFromHex = (hex, a = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/* ===================== Asset Helper ===================== */
function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/* Rounded rect helper */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}

/* ===================== Component ===================== */
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
  const levelsRef = useRef([]); // [{title, map, coin, tileImg, levelPrimary, spawn}]
  const levelRef = useRef(makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0));
  const coinMapRef = useRef(makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0));
  const [levelTitle, setLevelTitle] = useState("Level");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [coinFrames, setCoinFrames] = useState([]);
  const [coinReady, setCoinReady] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  // theme
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const currentTileImgRef = useRef(null);
  const enemySpriteRef = useRef(null);
  const [overlaySrc, setOverlaySrc] = useState(null);

  // spawn for current level
  const spawnRef = useRef({ r: 6, c: 1 });

  // overlays / phase
  const [phase, setPhase] = useState("play"); // "play" | "passed" | "won"
  const passTimerRef = useRef(0);

  // ---- audio ----
  const jumpSfxRef = useRef(null);
  const hitSfxRef  = useRef(null);
  const passSfxRef = useRef(null);
  const scorePoolRef = useRef([]);
  const scoreIdxRef = useRef(0);

  useEffect(() => {
    const POOL_SIZE = 4;
    scorePoolRef.current = Array.from({ length: POOL_SIZE }, () => {
      const a = new Audio("/assets/sfx/score.mp3");
      a.preload = "auto";
      a.volume = 0.65;
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

  // ---- parsers ----
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

  function parseGridWithSpawn(s, fallbackRows = DEFAULT_ROWS, fallbackCols = DEFAULT_COLS) {
    if (!s || typeof s !== "string") {
      return { grid: makeGrid(fallbackRows, fallbackCols, 0), spawn: null };
    }
    const body = s.replace(/\r\n/g, "\n").trim().replace(/,\s*$/m, "");
    const rows = [];
    let spawn = null;
    body.split("\n").forEach((line) => {
      let ln = line.trim();
      if (!ln) return;
      if (ln.endsWith(",")) ln = ln.slice(0, -1);
      ln = ln.replace(/^\[/, "").replace(/\]$/, "");
      const tokens = ln.split(",").map(t => t.trim()).filter(Boolean);
      const row = tokens.map((tok, idx) => {
        if (tok === "*" || tok === '"*"' || tok === "'*'") {
          if (!spawn) spawn = { r: rows.length, c: idx };
          return 0;
        }
        const n = parseInt(tok, 10);
        return Number.isFinite(n) ? n : 0;
      });
      rows.push(row);
    });
    if (!rows.length) return { grid: makeGrid(fallbackRows, fallbackCols, 0), spawn: null };
    const cols = Math.max(...rows.map(r => r.length));
    const grid = rows.map(r => (r.length === cols ? r : r.concat(Array(cols - r.length).fill(0))));
    return { grid, spawn };
  }

  const coinsRef = useRef([]);
  const rebuildCoinsFromMap = () => {
    const arr = [];
    const rows = coinMapRef.current.length;
    const cols = coinMapRef.current[0]?.length || 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((coinMapRef.current[r]?.[c] ?? 0) === 1) arr.push({ c, r, taken: false });
      }
    }
    coinsRef.current = arr;
  };

  const COLS = () => (levelRef.current[0]?.length || DEFAULT_COLS);
  const ROWS = () => (levelRef.current.length || DEFAULT_ROWS);

  const player = useRef({
    x: 1 * 64 + 64 * 0.1,
    y: 6 * 64,
    w: 64 * 0.6,
    h: 64 * 0.6,
    vx: 0, vy: 0,
    speed: 280, jump: 800,
    onGround: false,
    color: "#2D2C28",
  });

  const keys = useRef({ left: false, right: false, up: false });
  const clearInputsAndFocus = () => {
    keys.current = { left: false, right: false, up: false };
    if (document && document.activeElement) {
      try { document.activeElement.blur(); } catch {}
    }
  };

  const tileRef = useRef(64);
  const [canvasSize, setCanvasSize] = useState({ w: DEFAULT_COLS * tileRef.current, h: DEFAULT_ROWS * tileRef.current });
  const canvasRef = useRef(null);

  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // screen shake
  const shakeMsRef = useRef(0);

  // ----- Delay Shadow (ghost trail) -----
  const SHADOW_STEPS = 10;
  const SHADOW_ALPHA = 0.14;
  const shadowTrailRef = useRef([]);

  // ===== NEW: Walking enemies (tile 7) =====
  const walkersRef = useRef([]); // {x,y,w,h,dir,speed,ox,oy}

  function buildWalkersAndCleanMap(rawMap) {
    const TILE = tileRef.current;
    const map = rawMap.map(row => row.slice());
    const walkers = [];

    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === 7) {
          // turn this tile into empty
          map[r][c] = 0;

          const w = TILE * 0.7;
          const h = TILE * 0.6;
          const x = c * TILE + (TILE - w) / 2;

          // Find the top of the nearest ground beneath
          let rr = r;
          while (rr + 1 < map.length && map[rr + 1][c] !== 1) rr++;
          // If there is ground below, align on top, else just use current row bottom
          const hasGround = rr + 1 < map.length && map[rr + 1][c] === 1;
          const y = (hasGround ? (rr + 1) : (r + 1)) * TILE - h;

          walkers.push({
            x, y, w, h,
            dir: Math.random() < 0.5 ? -1 : 1,
            speed: 100, // px/s
            ox: x, oy: y
          });
        }
      }
    }
    return { cleaned: map, walkers };
  }

  // ---------- Fancy Draws ----------
  const drawEnemyStar = (ctx, x, y, TILE, t) => {
    const cx = x + TILE/2, cy = y + TILE/2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((t * 0.004) % (Math.PI * 2));
    const g = ctx.createRadialGradient(0,0,0, 0,0,TILE*0.5);
    g.addColorStop(0, "rgba(255, 120, 120, 0.65)");
    g.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0,0,TILE*0.48,0,Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    const spikes = 6;
    const R1 = TILE * 0.40;
    const R2 = TILE * 0.18;
    for (let i=0;i<spikes*2;i++){
      const ang = (i*Math.PI)/spikes;
      const rr = (i%2===0) ? R1 : R2;
      const px = Math.cos(ang)*rr, py = Math.sin(ang)*rr;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fillStyle = "#E14848";
    ctx.fill();
    ctx.lineWidth = Math.max(1, TILE*0.04);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
    ctx.restore();
  };

  const drawFancyGoal = (ctx, x, y, TILE, t) => {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const r = TILE * 0.42;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.004);
    const outer = r * (0.9 + 0.08 * pulse);
    const inner = r * (0.55 + 0.05 * pulse);

    const g = ctx.createRadialGradient(cx, cy, inner * 0.6, cx, cy, outer);
    g.addColorStop(0, "rgba(255,255,255,0.65)");
    g.addColorStop(0.5, "rgba(152, 235, 190, 0.45)");
    g.addColorStop(1, "rgba(88, 184, 131, 0.15)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.fill();

    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner);
    g2.addColorStop(0, "rgba(255,255,255,0.85)");
    g2.addColorStop(1, "rgba(88, 184, 131, 0.85)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.save();
    ctx.fillStyle = rgbaFromHex("#0d0c0b", 0.95);
    ctx.font = `${Math.max(14, Math.floor(TILE * 0.34))}px system-ui, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const bob = Math.sin(t * 0.004) * (TILE * 0.05);
    ctx.fillText("GOAL!", cx, y - 6 + bob);
    ctx.restore();
  };

  const drawDottedBlock = (ctx, x, y, TILE, t, color) => {
    ctx.save();
    ctx.lineWidth = Math.max(1.25, TILE * 0.08);
    ctx.setLineDash([Math.max(3, TILE * 0.18), Math.max(3, TILE * 0.18)]);
    ctx.lineDashOffset = (t * 0.06) % (TILE * 0.36);
    ctx.strokeStyle = color;
    const inset = ctx.lineWidth / 2;
    ctx.strokeRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2);
    ctx.restore();
  };

  // ---- Storyblok fetch ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storyblokApi.get("cdn/stories/game", { version: "published" });
        const content = res?.data?.story?.content || {};
        const levelBlocks = Array.isArray(content?.level) ? content.level : [];

        const built = [];
        for (let i = 0; i < levelBlocks.length; i++) {
          const blk = levelBlocks[i];
          const title = blk?.Title || `Level ${i + 1}`;
          const { grid: parsedMap, spawn } = parseGridWithSpawn(blk?.map);
          const coin = parseGridSmart(blk?.coin_map);
          
          const rawTheme = typeof blk?.theme === "string" ? blk.theme.trim() : "";
          const lowered = rawTheme.toLowerCase();
          const isDefaultTheme = !rawTheme || lowered === "default";
          const levelPrimary = !isDefaultTheme ? normalizeHex(rawTheme) : null;

          const tileURL = blk?.tiles?.filename || "";
          const tileImg = await loadImage(tileURL);
          
          const overlayURL = blk?.overlay?.filename || "";
          const overlay = overlayURL ? overlayURL : null;

          built.push({
            title,
            map: parsedMap,
            coin,
            tileImg,
            levelPrimary,
            spawn,
            useDefaultTheme: isDefaultTheme || !levelPrimary,
            overlay,
          });
        }

        if (!built.length) {
          built.push({
            title: "Level 1",
            map: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
            coin: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
            tileImg: null,
            levelPrimary: null,
            spawn: { r: 6, c: 1 },
            useDefaultTheme: true,
            overlay: null,
          });
        }

        if (cancelled) return;
        levelsRef.current = built;
        loadLevelIndex(0);

        const enemyAsset = (content?.assets || []).find((asset) => asset?.component === "enemy");
        if (enemyAsset?.sprite?.filename) {
          const sprite = await loadImage(enemyAsset.sprite.filename);
          if (!cancelled) enemySpriteRef.current = sprite;
        } else if (!cancelled) {
          enemySpriteRef.current = null;
        }

        // coin frames
        const frames = (content?.assets?.[0]?.frames ?? []).map(f => f.filename);
        const sorted = frames.slice().sort((a, b) => {
          const na = parseInt((a.split("/").pop() || "").replace(".png", ""), 10);
          const nb = parseInt((b.split("/").pop() || "").replace(".png", ""), 10);
          return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
        });
        if (sorted.length) {
          const imgs = await Promise.all(sorted.map(url => loadImage(url)));
          if (!cancelled) { setCoinFrames(imgs.filter(Boolean)); setCoinReady(true); }
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
          levelPrimary: null,
          spawn: { r: 6, c: 1 },
          useDefaultTheme: true,
          overlay: null,
        }];
        enemySpriteRef.current = null;
        loadLevelIndex(0);
      }
    })();
    return () => { cancelled = true; clearTimeout(passTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyblokApi]);

  function recomputeSize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cols = COLS(), rows = ROWS();
    const desired = Math.min((vw - 24) / cols, (vh - 24) / rows);
    const rawTile = Math.max(20, Math.floor(desired));
    const oldTile = tileRef.current;
    const newTile = Number.isFinite(rawTile) && rawTile > 0 ? rawTile : oldTile;
    if (newTile !== oldTile) {
      const s = newTile / oldTile;
      if (Number.isFinite(s) && s > 0) {
        player.current.x *= s; player.current.y *= s;
        player.current.w *= s; player.current.h *= s;
        tileRef.current = newTile;
      }
    }
    setCanvasSize({ w: cols * tileRef.current, h: rows * tileRef.current });
  }

  useEffect(() => {
    if (!mapsReady) return;
    recomputeSize();
    const onResize = () => recomputeSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mapsReady]);

  function tileAt(px, py) {
    const TILE = tileRef.current;
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || col >= COLS() || row < 0 || row >= ROWS()) return 1;
    return levelRef.current[row][col];
  }
  const isSolid = (v) => v === 1;
  const isEnemy = (v) => v === 2 || v === 4 || v === 7;
  const isGoal  = (v) => v === 3 || v === 6;

  function rectVsWorld(r) {
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
  }

  function resetPlayer(options = {}) {
    const { themeOverride, keepScore = false } = options;

    const rawTile = tileRef.current;
    const TILE = Number.isFinite(rawTile) && rawTile > 0 ? rawTile : 64;
    const spawnSource = spawnRef.current || { r: 6, c: 1 };
    const spawn = {
      r: Number.isFinite(spawnSource.r) ? spawnSource.r : 0,
      c: Number.isFinite(spawnSource.c) ? spawnSource.c : 0,
    };

    const rawSize = TILE * 0.6;
    const fallbackSize = Math.max(12, TILE * 0.5);
    const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : fallbackSize;

    const px = spawn.c * TILE + TILE * 0.1;
    const py = spawn.r * TILE;
    Object.assign(player.current, {
      x: Number.isFinite(px) ? px : 0,
      y: Number.isFinite(py) ? py : 0,
      w: Number.isFinite(size) && size > 0 ? size : player.current.w,
      h: Number.isFinite(size) && size > 0 ? size : player.current.h,
      vx: 0,
      vy: 0,
      onGround: false,
      speed: Number.isFinite(player.current.speed) && player.current.speed > 0 ? player.current.speed : 280,
      jump: Number.isFinite(player.current.jump) && player.current.jump > 0 ? player.current.jump : 800,
    });
    
    const playerColor = themeOverride?.player || theme.player || DEFAULT_THEME.player;
    player.current.color = playerColor;

    rebuildCoinsFromMap();
    shadowTrailRef.current = [];
     if (!keepScore) setScore(0);
  }

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  function loadLevelIndex(idx) {
    clearTimeout(passTimerRef.current);
    const L = levelsRef.current[idx];
    if (!L) return;

    // Build walkers and clean map (remove 7 markers)
    const { cleaned, walkers } = buildWalkersAndCleanMap(L.map);

    levelRef.current = cleaned;
    
    const rows = cleaned.length;
    const cols = cleaned[0]?.length || 0;

    const normalizeCoinMap = (raw, targetRows, targetCols) => {
      if (!targetRows || !targetCols) return [];
      const out = Array.from({ length: targetRows }, (_, r) => {
        const sourceRow = raw?.[r] || [];
        return Array.from({ length: targetCols }, (_, c) => {
          const val = sourceRow?.[c];
          const n = typeof val === "number" ? val : parseInt(val, 10);
          return Number.isFinite(n) && n > 0 ? 1 : 0;
        });
      });
      return out;
    };

    coinMapRef.current = normalizeCoinMap(L.coin, rows, cols);
    currentTileImgRef.current = L.tileImg || null;
    walkersRef.current = walkers;

     const nextTheme = !L.levelPrimary || L.useDefaultTheme
      ? DEFAULT_THEME
      : deriveThemeFromPrimary(L.levelPrimary);
    setTheme(nextTheme);
    setOverlaySrc(L.overlay || null);
    setLevelTitle(L.title || `Level ${idx + 1}`);

    const clampSpawn = (spawn, maxRows, maxCols) => {
      const fallbackR = Math.max(0, (maxRows || 1) - 1);
      const fallback = { r: fallbackR, c: 0 };
      const src = spawn && Number.isFinite(spawn.r) && Number.isFinite(spawn.c) ? spawn : fallback;
      const clamp = (v, limit) => {
        if (!Number.isFinite(v)) return 0;
        if (!Number.isFinite(limit) || limit <= 0) return 0;
        return Math.min(limit - 1, Math.max(0, v));
      };
      return { r: clamp(src.r, maxRows || 1), c: clamp(src.c, maxCols || 1) };
    };

    spawnRef.current = clampSpawn(L.spawn, rows, cols);

     resetPlayer({ themeOverride: nextTheme });

    setMapsReady(true);
    setCurrentLevel(idx);
    setPhase("play");
    recomputeSize();
    clearInputsAndFocus();
  }

  function advanceLevel() {
    clearTimeout(passTimerRef.current);
    const next = currentLevel + 1;
    if (next < levelsRef.current.length) {
      loadLevelIndex(next);
    } else {
      setPhase("won");
      clearInputsAndFocus();
    }
  }

  // ---- main loop ----
  const rafRef = useRef(0);
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
      if (!Number.isFinite(P.w) || !Number.isFinite(P.h) || P.w <= 0 || P.h <= 0) {
        const size = TILE * 0.6;
        P.w = Number.isFinite(size) && size > 0 ? size : TILE * 0.6 || 32;
        P.h = P.w;
      }
      if (!Number.isFinite(P.x) || !Number.isFinite(P.y)) {
        const spawn = spawnRef.current || { r: 6, c: 1 };
        P.x = spawn.c * TILE + TILE * 0.1;
        P.y = spawn.r * TILE;
        P.vx = 0;
        P.vy = 0;
      }
      // physics (player)
      if (phase === "play") {
        const accel = P.speed;
        let targetVX = 0;
        if (keys.current.left) targetVX -= accel;
        if (keys.current.right) targetVX += accel;
        P.vx = targetVX * dt;
        P.vy += gravity * dt; if (P.vy > maxFall) P.vy = maxFall;

        const solved = rectVsWorld({ x: P.x, y: P.y, w: P.w, h: P.h, vx: P.vx, vy: P.vy * dt });
        P.x = solved.x; P.y = solved.y; P.vx = solved.vx; P.vy = solved.vy / dt; P.onGround = solved.onGround;
        if (P.onGround) P.vx *= friction;
      }

      // walkers AI
      if (phase === "play") {
        walkersRef.current.forEach((Wk) => {
          // Edge & wall detection
          const aheadX = Wk.dir < 0 ? Wk.x - 2 : Wk.x + Wk.w + 2;
          const topY = Wk.y + 2;
          const bottomY = Wk.y + Wk.h - 2;

          // Wall ahead?
          if (isSolid(tileAt(aheadX, topY)) || isSolid(tileAt(aheadX, bottomY))) {
            Wk.dir *= -1;
          } else {
            // Edge check at foot in front
            const footX = Wk.dir < 0 ? Wk.x - 1 : Wk.x + Wk.w + 1;
            const footY = Wk.y + Wk.h + 1;
            if (!isSolid(tileAt(footX, footY))) {
              Wk.dir *= -1;
            } else {
              Wk.x += Wk.dir * Wk.speed * dt;
            }
          }
        });
      }

      // Record shadow trail
      shadowTrailRef.current.push({ x: P.x, y: P.y, w: P.w, h: P.h });
      if (shadowTrailRef.current.length > SHADOW_STEPS) shadowTrailRef.current.shift();

      // shake
      let shakeX = 0, shakeY = 0;
      if (shakeMsRef.current > 0) {
        shakeMsRef.current -= dt * 1000;
        const m = Math.max(0, shakeMsRef.current) / 1000;
        const amp = Math.min(1, m) * 8;
        shakeX = (Math.random() * 2 - 1) * amp;
        shakeY = (Math.random() * 2 - 1) * amp;
      }
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // bg + grid
      ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
      for (let c = 0; c <= COLS(); c++) { ctx.beginPath(); ctx.moveTo(c*TILE+0.5,0); ctx.lineTo(c*TILE+0.5,H); ctx.stroke(); }
      for (let r = 0; r <= ROWS(); r++) { ctx.beginPath(); ctx.moveTo(0,r*TILE+0.5); ctx.lineTo(W,r*TILE+0.5); ctx.stroke(); }

      // tiles & interactions
      let died = false;
      let reachedGoal = false;

      for (let r = 0; r < ROWS(); r++) {
        for (let c = 0; c < COLS(); c++) {
          const val = levelRef.current[r][c];
          if (val === 0) continue;
          const x = c * TILE, y = r * TILE;

          if (val === 1) {
            ctx.fillStyle = theme.tileSolid;
            ctx.fillRect(x, y, TILE, TILE);
            const tex = currentTileImgRef.current;
            if (tex) {
              ctx.globalAlpha = 0.96;
              ctx.drawImage(tex, x, y, TILE, TILE);
              ctx.globalAlpha = 1;
            }
          } else if (val === 2) {
            drawEnemyStar(ctx, x, y, TILE, t);
            if (phase === "play" && overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) died = true;
          } else if (val === 3) {
            drawFancyGoal(ctx, x, y, TILE, t);
            if (phase === "play" && overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) reachedGoal = true;
          } else if (val === 4) {
            // Invisible enemy
            if (phase === "play" && overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) died = true;
          } else if (val === 5) {
            // Ghost platform
            drawDottedBlock(ctx, x, y, TILE, t, rgbaFromHex(theme.text, 0.9));
          } else if (val === 6) {
            // Invisible goal
            if (phase === "play" && overlaps(P.x, P.y, P.w, P.h, x, y, TILE, TILE)) reachedGoal = true;
          }
        }
      }

      // draw walkers & collide with player
      const enemySprite = enemySpriteRef.current;
      const hasEnemySprite = enemySprite && enemySprite.width && enemySprite.height;
      walkersRef.current.forEach((Wk) => {
        if (hasEnemySprite) {
          const scale = Math.min(Wk.w / enemySprite.width, Wk.h / enemySprite.height);
          const drawW = enemySprite.width * scale;
          const drawH = enemySprite.height * scale;
          const drawX = Wk.x + (Wk.w - drawW) / 2;
          const drawY = Wk.y + (Wk.h - drawH) / 2;
          ctx.drawImage(enemySprite, drawX, drawY, drawW, drawH);
        } else {
          ctx.save();
          const radius = Math.max(3, TILE * 0.08);
          ctx.fillStyle = "#C53939";
          roundRect(ctx, Wk.x, Wk.y, Wk.w, Wk.h, radius);
          ctx.fill();
          ctx.lineWidth = Math.max(1, TILE * 0.04);
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.stroke();
          // highlight
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          roundRect(ctx, Wk.x + 2, Wk.y + 2, Wk.w - 4, Math.max(2, Wk.h * 0.2), radius * 0.6);
          ctx.fill();
          ctx.restore();
        }

        // collide
        if (phase === "play" && overlaps(P.x, P.y, P.w, P.h, Wk.x, Wk.y, Wk.w, Wk.h)) {
          died = true;
        }
      });

      // coins
      const coinSize = TILE * 0.4;
      const frameCount = coinFrames.length || 1;
      if (coinReady && frameCount > 0) coinTime += dt;
      const frameIdx = coinReady ? Math.floor(coinTime * COIN_FPS) % frameCount : 0;

      coinsRef.current.forEach((coin) => {
        if (coin.taken) return;
        const cx = coin.c * TILE + TILE * 0.5 - coinSize / 2;
        const cy = coin.r * TILE + TILE * 0.5 - coinSize / 2;
        if (phase === "play" && overlaps(P.x, P.y, P.w, P.h, cx, cy, coinSize, coinSize)) {
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

      // delay shadow ghosts
      ctx.save();
      ctx.filter = "blur(1.2px)";
      for (let i = 0; i < shadowTrailRef.current.length; i++) {
        const s = shadowTrailRef.current[i];
        const k = (i + 1) / SHADOW_STEPS;
        const a = SHADOW_ALPHA * k;
        const shrink = 1 - k * 0.12;
        const ox = (1 - k) * 6, oy = (1 - k) * 4;

        const w = s.w * shrink;
        const h = s.h * shrink;
        const x = s.x + (s.w - w) * 0.5 - ox;
        const y = s.y + (s.h - h) * 0.5 - oy;

        ctx.globalAlpha = a;
        ctx.fillStyle = "#000000";
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.filter = "none";

      // player on top
      ctx.fillStyle = theme.player;
      ctx.fillRect(P.x, P.y, P.w, P.h);

      ctx.restore(); // end shake

      // outcomes
      if (phase === "play") {
        if (died) {
          shakeMsRef.current = 450;
          try { const a = hitSfxRef.current; a && (a.currentTime = 0, a.volume = 0.8, a.play()); } catch {}
          setTimeout(() => {
            resetPlayer();
            clearInputsAndFocus();
          }, 300);
        } else if (reachedGoal) {
          setPhase("passed");
          clearInputsAndFocus();
          try { const a = passSfxRef.current; a && (a.currentTime = 0, a.volume = 0.9, a.play()); } catch {}
          clearTimeout(passTimerRef.current);
          passTimerRef.current = setTimeout(() => {
            advanceLevel();
          }, 2000);
        }
      }

      if (running) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const down = (e) => {
      if (phase !== "play") {
        if (e.key === "r" || e.key === "R") resetPlayer();
        return;
      }
      if (["ArrowLeft","a","A"].includes(e.key)) keys.current.left = true;
      if (["ArrowRight","d","D"].includes(e.key)) keys.current.right = true;
      if (["w","W","ArrowUp"].includes(e.key) || e.code === "Space") keys.current.up = true;

      if ((["Space","w","W","ArrowUp"].includes(e.key) || e.code === "Space") && player.current.onGround) {
        player.current.vy = -player.current.jump;
        player.current.onGround = false;
        const a = jumpSfxRef.current;
        if (a) { try { a.currentTime = 0; a.volume = 0.6; a.play(); } catch {} }
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
  }, [running, coinFrames, coinReady, mapsReady, levelTitle, currentLevel, theme, phase]);

  /* ===================== UI ===================== */
  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", color: theme.text, background: theme.bg, position: "relative" }}>
      {/* SFX */}
      <audio ref={jumpSfxRef}  src="/assets/sfx/jump.mp3"   preload="auto" />
      <audio ref={hitSfxRef}   src="/assets/sfx/over.mp3"    preload="auto" />
      <audio ref={passSfxRef}  src="/assets/sfx/passed.mp3" preload="auto" />

      {/* Background dots */}
      <div
        style={{
          width: "100%", height: "100%", position: "absolute", top: 0, left: 0,
          zIndex: 0, pointerEvents: "none", background: theme.bg
        }}
      >
        <DotGrid
          dotSize={10}
          gap={15}
          baseColor={theme.dotBase}
          activeColor={theme.dotActive}
          proximity={120}
          shockRadius={240}
          shockStrength={4.5}
          resistance={820}
          returnDuration={1.5}
        />
      </div>

      {/* Top-right controls */}
      <div style={{ position: "fixed", top: 12, right: 12, display: "flex", gap: 8, zIndex: 10 }}>
        <button
          onClick={() => navigate('/')}
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
          Home
        </button>
        <button
          onClick={() => { resetPlayer(); clearInputsAndFocus(); }}
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

      {/* LEFT HUD */}
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
            minWidth: 160,
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
            minWidth: 160,
            fontWeight: 700,
          }}
        >
          Score: {score}
        </div>
      </div>

      {/* Game canvas */}
       <div style={{ height: "100%", display: "grid", placeItems: "center", position: "relative", zIndex: 1 }}>
        {mapsReady ? (
          <div
            style={{
               position: "relative",
              width: canvasSize.w,
              height: canvasSize.h,
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 16,
              boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
              background: theme.bg,
               overflow: "hidden",
            }}
         >
            <canvas
              ref={canvasRef}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                background: theme.bg,
                position: "relative",
                zIndex: 1,
              }}
            />
            {overlaySrc && (
              <img
                src={overlaySrc}
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "fill",
                  pointerEvents: "none",
                  imageRendering: "pixelated",
                   zIndex: 2,
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ fontFamily: "system-ui", color: theme.text, opacity: 0.7 }}>
            Loading level…
          </div>
        )}
      </div>

      {/* Overlays */}
      {phase === "passed" && (
        <div
          style={{
            position: "fixed", inset: 0, display: "grid", placeItems: "center",
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)", zIndex: 20
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: "24px 28px",
              borderRadius: 16,
              background: theme.cardBg,
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              boxShadow: theme.cardShadow,
              fontFamily: "system-ui, Arial, sans-serif",
              textAlign: "center",
              minWidth: 260
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>🎉 Congratulations!</div>
            <div style={{ opacity: 0.8 }}>Next round starts in a moment…</div>
          </div>
        </div>
      )}

      {phase === "won" && (
        <div
          style={{
            position: "fixed", inset: 0, display: "grid", placeItems: "center",
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", zIndex: 30
          }}
        >
          <div
            style={{
              padding: "28px 32px",
              borderRadius: 18,
              background: theme.cardBg,
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
              fontFamily: "system-ui, Arial, sans-serif",
              textAlign: "center",
              minWidth: 320
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>🏆 You’ve won the game!</div>
            <div style={{ opacity: 0.8, marginBottom: 16 }}>Great run!</div>
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: `1.5px solid ${theme.btnBorder}`,
                background: theme.btnBg,
                color: theme.text,
                cursor: "pointer",
                fontSize: 14,
                boxShadow: theme.btnShadow,
                fontWeight: 700
              }}
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
