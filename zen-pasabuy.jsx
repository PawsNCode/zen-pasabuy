import { useState, useEffect, useMemo, useRef } from "react";

/* ─────────────────────────────  ZEN PASABUY v6  ────────────────────────────
   Japan→PH pasabuy pricing system.
   v6: sourcing fees in ¥ · pre-order workflow (take orders first, mark items
   as bought, dispatch, then close as received & paid) with color-coded order
   cards (red → blue → green → completed) · inventory search · orders search
   with status + date filters.
──────────────────────────────────────────────────────────────────────────── */

const SWEETIES_THEME = {
  primary: "#801d5c", accent: "#c02e80", pink: "#cd81a9", muted: "#af8a8f",
  bg: "#fff4fb", bg2: "#fbe9f3", border: "#f2d6e6", paper: "#ffffff",
  ink: "#3a2a33", soft: "#fbf2f8", good: "#5a8a6a",
};
const THEME_PRESETS = [
  /* ── light ── */
  { name: "Sweeties 🌸", dark: false, theme: { ...SWEETIES_THEME } },
  { name: "Matcha", dark: false, theme: { primary: "#3d5a3e", accent: "#6b8f5e", pink: "#a3bf8f", muted: "#8a9a7f", bg: "#f4f8ef", bg2: "#e8f0dd", border: "#dce8cd", paper: "#ffffff", ink: "#2a332a", soft: "#eef4e6", good: "#3d7a4e" } },
  { name: "Yozora", dark: false, theme: { primary: "#2c2a4a", accent: "#7067cf", pink: "#a29bde", muted: "#8d89a8", bg: "#f3f2fb", bg2: "#e9e7f7", border: "#ddd9f0", paper: "#ffffff", ink: "#26243a", soft: "#efedf9", good: "#4e7a6a" } },
  { name: "Hanami", dark: false, theme: { primary: "#a8365b", accent: "#e0688c", pink: "#f0a8bd", muted: "#b28a95", bg: "#fff6f7", bg2: "#fbe6eb", border: "#f6d8de", paper: "#ffffff", ink: "#3a2530", soft: "#fdeff2", good: "#5a8a6a" } },
  /* ── dark ── */
  { name: "Sakura Night", dark: true, theme: { primary: "#d4488f", accent: "#ff7fb6", pink: "#8f5c78", muted: "#a98da0", bg: "#170f1c", bg2: "#221528", border: "#3a2740", paper: "#241a2b", ink: "#f6e8f1", soft: "#2d2036", good: "#63b98c" } },
  { name: "Sumi Ink", dark: true, theme: { primary: "#c9536e", accent: "#e8798f", pink: "#7c5a63", muted: "#9c9198", bg: "#121214", bg2: "#1b1b1f", border: "#33323a", paper: "#1f1f24", ink: "#efedf0", soft: "#27262d", good: "#5fb08a" } },
  { name: "Fuji Night", dark: true, theme: { primary: "#5b74c9", accent: "#8ea6f0", pink: "#5d6a92", muted: "#939bb5", bg: "#0f1320", bg2: "#161c2c", border: "#2a3350", paper: "#1a2033", ink: "#e8ecfa", soft: "#212840", good: "#5fb08a" } },
  { name: "Matcha Night", dark: true, theme: { primary: "#6f9f63", accent: "#96c98a", pink: "#5f7a58", muted: "#93a48d", bg: "#0f150f", bg2: "#161e16", border: "#2b382a", paper: "#1a231a", ink: "#e9f2e7", soft: "#212c20", good: "#7fc78f" } },
  { name: "Kuro Gold", dark: true, theme: { primary: "#c8a45a", accent: "#e5c684", pink: "#7d6a44", muted: "#a09781", bg: "#111010", bg2: "#1a1817", border: "#37322a", paper: "#201d1a", ink: "#f3eee3", soft: "#282420", good: "#78b58a" } },
];

/* order lifecycle colors (consistent across themes so red/blue/green always read) */
const PHASE = {
  sourcing: { color: "#c25462", label: "SOURCING", note: "items still being bought" },
  review: { color: "#d99a2b", label: "CHECK PRICES", note: "all items bought — review before dispatch" },
  ready: { color: "#4f6db0", label: "READY", note: "reviewed, ready to dispatch" },
  dispatched: { color: "#5a8a6a", label: "DISPATCHED", note: "on its way" },
  completed: { color: "#af8a8f", label: "RECEIVED & PAID ✓", note: "order closed" },
};

const DEFAULT_SETTINGS = {
  rateMode: "live", manualRate: 0.385, liveRate: null, liveRateAt: null,
  buffer: 5, negotiation: 10,
  tiers: [
    { id: "basic", name: "Basic", desc: "Easy to find, everyday items", margin: 20 },
    { id: "select", name: "Select", desc: "Hard to find, needs hunting", margin: 32 },
    { id: "rare", name: "Rare", desc: "Limited, exclusive, seasonal", margin: 45 },
  ],
  sourcing: [
    { id: "online", name: "Online order", feeJpy: 160, note: "Delivered to your address" },
    { id: "nearby", name: "Nearby store", feeJpy: 300, note: "Quick local trip" },
    { id: "city", name: "City run", feeJpy: 520, note: "Train fare + half a day" },
    { id: "hunt", name: "Multi-store hunt", feeJpy: 830, note: "Full-day hunting" },
  ],
  shipping: [
    { id: "hand", name: "Hand-carry", note: "Coming home in your own luggage — no box cost", liters: 0, feeJpy: 0 },
    { id: "xs", name: "Tiny", note: "Sachet, keychain, single charm", liters: 0.5, feeJpy: 35 },
    { id: "s", name: "Small", note: "Snack box, one skincare bottle", liters: 1.5, feeJpy: 100 },
    { id: "m", name: "Medium", note: "About a shoebox", liters: 4, feeJpy: 270 },
    { id: "l", name: "Large", note: "Roughly a quarter of a jumbo box", liters: 8, feeJpy: 540 },
    { id: "xl", name: "Bulky", note: "Plushie, big carton, bedding", liters: 15, feeJpy: 1000 },
  ],
  box: { costJpy: 14000, liters: 260, fillPct: 80 },
  guidesExpanded: true,
  theme: { ...SWEETIES_THEME },
  displayCcy: "jpy", // "jpy" (default) or "php" — which currency leads everywhere
  memory: { shops: [], locations: [], customers: [], products: [] },
};

const DANGER = "#d64545"; /* losses always show in red, in every theme */

/* ── accounts ──────────────────────────────────────────────────────────────
   Passwords are stored as SHA-256 hashes of `PW_SALT:password`, never as
   plain text. Add a tester by generating a hash in Set-up → Accounts
   (owner only) and pasting a new line into this list.
   Logins:  niz / 6348  ·  fujidemands / 1234
──────────────────────────────────────────────────────────────────────────── */
const PW_SALT = "zen-pasabuy-2026";
const USERS = [
  { u: "niz", name: "Niz", owner: true, h: "3c6aca2e5073d0823c8d283c9569752e63428a01942267669583b628aa519ad3" },
  { u: "fujidemands", name: "Fuji Demands", h: "16470cce93cc44987ab099bf008695666909b65eb3ed67dfcdcf260f46922225" },
];
const SESSION_KEY = "zp-session";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LEGACY_KEY = "pawsabuy-data"; // kept so data from earlier versions carries over

/* ── app version — bump BOTH lines on every push to GitHub ── */
const APP_VERSION = "7.8.1";
const APP_UPDATED = "Aug 12, 2026 · 10:40 PM PHT";

/* helpers */
const roundUp5 = (n) => Math.ceil(n / 5) * 5;
const roundUp10 = (n) => Math.ceil(n / 10) * 10;
const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 });
const yen = (n) => "¥" + Number(n || 0).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
const pct = (n) => (isFinite(n) ? Math.round(n) + "%" : "—");
/* signed money: +₱120 or −₱45 */
const signedPeso = (n) => (n < 0 ? "−" : "+") + "₱" + Math.abs(Math.round(n || 0)).toLocaleString("en-PH");
const today = () => new Date().toISOString().slice(0, 10);
const monthName = (ym) => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-PH", { month: "short", year: "numeric" });
};

function computePrice(unitJpy, tierMargin, feePhp, rate, settings, shipPhp) {
  const ship = shipPhp || 0;
  const landed = unitJpy * rate;
  const bufferAmt = landed * (settings.buffer / 100);
  const trueCost = landed + bufferAmt + feePhp + ship;
  const floor = roundUp5(trueCost * (1 + tierMargin / 100));
  const list = roundUp10(floor * (1 + settings.negotiation / 100));
  return { landed, bufferAmt, fee: feePhp, ship, trueCost, floor, list, profitAtList: list - trueCost, profitAtFloor: floor - trueCost };
}

/* ¥ per litre of box space, from the box cost the user entered in Set-up */
function yenPerLitre(box) {
  const b = box || {};
  const liters = Number(b.liters) || 0;
  const fill = (Number(b.fillPct) || 100) / 100;
  if (!(liters > 0) || !(fill > 0)) return 0;
  return (Number(b.costJpy) || 0) / liters / fill;
}

async function fetchLiveRate() {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 1000,
      messages: [{ role: "user", content: 'Search for the current JPY to PHP exchange rate. Respond ONLY with a JSON object, no markdown, no other text: {"rate": <PHP per 1 JPY as a plain number, e.g. 0.39>}' }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await response.json();
  const text = (data.content || []).filter((i) => i.type === "text").map((i) => i.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const m = clean.match(/\{[\s\S]*?\}/);
  const parsed = JSON.parse(m ? m[0] : clean);
  const r = parseFloat(parsed.rate);
  if (!(r > 0.05 && r < 5)) throw new Error("rate out of range");
  return r;
}

const resizePhoto = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 360;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.68));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });

function allocateFIFO(product, qty, draftUsed = {}) {
  const lots = [...(product.lots || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || a.id - b.id);
  let need = qty;
  const allocs = [];
  for (const lot of lots) {
    const avail = (lot.remaining || 0) - (draftUsed[lot.id] || 0);
    if (avail <= 0) continue;
    const take = Math.min(avail, need);
    allocs.push({ lotId: lot.id, qty: take, unitCost: lot.unitCost, unitJpy: lot.unitJpy, date: lot.date, store: lot.store });
    need -= take;
    if (need === 0) break;
  }
  return { allocs, short: need };
}
const productStock = (p) => (p.lots || []).reduce((a, l) => a + (l.remaining || 0), 0);
const productBought = (p) => (p.lots || []).reduce((a, l) => a + (l.qty || 0), 0);
const latestLot = (p) => {
  const lots = [...(p?.lots || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || a.id - b.id);
  return lots[lots.length - 1] || null;
};
const productAvgCost = (p) => {
  const q = productBought(p);
  return q ? (p.lots || []).reduce((a, l) => a + l.unitCost * l.qty, 0) / q : 0;
};

/* derive the lifecycle phase of an order */
const orderPhase = (o) => {
  if (o.status === "completed") return "completed";
  if (o.status === "dispatched") return "dispatched";
  if (!(o.lines || []).every((l) => l.bought)) return "sourcing";
  return o.reviewed === false ? "review" : "ready";
};

const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/* spreadsheet colours: theme for the chrome, fixed green/red for money */
const GAIN_HEX = "#2e7d4f";
const LOSS_HEX = "#c62828";
const hexToRgb = (hex) => {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};
const rgbToHex = ({ r, g, b }) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/* relative luminance, 0 = black, 1 = white */
const lum = (hex) => {
  const c = hexToRgb(hex);
  if (!c) return 1;
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
/* blend a colour toward white (amt 0..1) — used for readable pale row stripes */
const tint = (hex, amt) => {
  const c = hexToRgb(hex);
  if (!c) return "#f5f5f5";
  return rgbToHex({ r: c.r + (255 - c.r) * amt, g: c.g + (255 - c.g) * amt, b: c.b + (255 - c.b) * amt });
};
/* darken toward black (amt 0..1) */
const shade = (hex, amt) => {
  const c = hexToRgb(hex);
  if (!c) return "#333333";
  return rgbToHex({ r: c.r * (1 - amt), g: c.g * (1 - amt), b: c.b * (1 - amt) });
};
/* spreadsheets are always read on a white page, so text is always dark */
const SHEET_INK = "#1f2430";

const argb = (hex, fallback = "FF000000") => {
  const h = String(hex || "").replace("#", "").trim();
  return h.length === 6 ? "FF" + h.toUpperCase() : fallback;
};

/* ExcelJS is loaded on first export so it never slows the app down */
let excelLoading = null;
function ensureExcel() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (excelLoading) return excelLoading;
  excelLoading = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    el.onload = () => resolve(window.ExcelJS);
    el.onerror = () => { excelLoading = null; reject(new Error("offline")); };
    document.head.appendChild(el);
  });
  return excelLoading;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


/* ── app logo: shopping bag holding Mt Fuji + a cherry blossom ── */
function ZenLogo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Zen Pasabuy" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id="zpBag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a02670" />
          <stop offset="100%" stopColor="#801d5c" />
        </linearGradient>
        <linearGradient id="zpSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff4fb" />
          <stop offset="100%" stopColor="#fbe0ef" />
        </linearGradient>
        <linearGradient id="zpFuji" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c02e80" />
          <stop offset="100%" stopColor="#801d5c" />
        </linearGradient>
        <clipPath id="zpInner">
          <path d="M14.5 22h35l-2.6 32.2a4.4 4.4 0 0 1-4.4 4.05H21.5a4.4 4.4 0 0 1-4.4-4.05Z" />
        </clipPath>
      </defs>
      <path d="M23 24v-6.5a9 9 0 0 1 18 0V24" fill="none" stroke="url(#zpBag)" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M11.6 18.5h40.8a2.6 2.6 0 0 1 2.6 2.8l-2.7 33.4A7 7 0 0 1 45.3 61H18.7a7 7 0 0 1-7-6.3L9 21.3a2.6 2.6 0 0 1 2.6-2.8Z" fill="url(#zpBag)" />
      <path d="M14.5 22h35l-2.6 32.2a4.4 4.4 0 0 1-4.4 4.05H21.5a4.4 4.4 0 0 1-4.4-4.05Z" fill="url(#zpSky)" />
      <g clipPath="url(#zpInner)">
        <path d="M32 30.5 47.5 59H16.5Z" fill="url(#zpFuji)" />
        <path d="M32 30.5l5.6 10.3-2.4-1.6-2 2.2-2.4-2.6-2.3 2.3-2.2-1.6-2 1.5Z" fill="#fff8fc" />
        <path d="M6 59c5-6.5 10-9 14-6.2 3.6 2.5 5 4.4 6 6.2Z" fill="#cd81a9" opacity=".75" />
        <path d="M58 59c-4.6-7.2-9.4-9.8-13.6-6.6-3.4 2.6-4.8 4.6-5.6 6.6Z" fill="#cd81a9" opacity=".55" />
      </g>
      <g transform="translate(42.2 29.4)">
        <g fill="#ffd7ea">
          <ellipse cx="0" cy="-5.4" rx="3.05" ry="4.5" />
          <ellipse cx="0" cy="-5.4" rx="3.05" ry="4.5" transform="rotate(72)" />
          <ellipse cx="0" cy="-5.4" rx="3.05" ry="4.5" transform="rotate(144)" />
          <ellipse cx="0" cy="-5.4" rx="3.05" ry="4.5" transform="rotate(216)" />
          <ellipse cx="0" cy="-5.4" rx="3.05" ry="4.5" transform="rotate(288)" />
        </g>
        <circle cx="0" cy="0" r="1.9" fill="#c02e80" />
      </g>
      <ellipse cx="20.5" cy="31" rx="1.7" ry="2.5" transform="rotate(-25 20.5 31)" fill="#ffd7ea" />
    </svg>
  );
}

/* ─────────────────────────────  APP  ───────────────────────────── */
function ZenPasabuy({ user, onLogout }) {
  /* each account keeps its own data on this device; the owner keeps the original key */
  const STORAGE_KEY = user?.owner ? LEGACY_KEY : `${LEGACY_KEY}:${user?.u || "guest"}`;
  const [tab, setTab] = useState("price");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [storageWarn, setStorageWarn] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [hashOut, setHashOut] = useState("");
  const [dTiers, setDTiers] = useState(null);      // unsaved tier edits
  const [dSourcing, setDSourcing] = useState(null); // unsaved sourcing edits
  const [dShipping, setDShipping] = useState(null); // unsaved shipping-class edits
  const [dBox, setDBox] = useState(null);           // unsaved box-cost edits
  const [guideOpen, setGuideOpen] = useState({});   // per-page tutorial open/closed
  const [hashPw, setHashPw] = useState("");
  const backupRef = useRef(null);
  const pagePhotoRef = useRef(null);
  const newPhotoRef = useRef(null);

  /* Price it state */
  const [pTarget, setPTarget] = useState("new");
  const [pName, setPName] = useState("");
  const [pStore, setPStore] = useState("");
  const [pDate, setPDate] = useState(today());
  const [pTotalJpy, setPTotalJpy] = useState("");
  const [pQty, setPQty] = useState("1");
  const [pPhoto, setPPhoto] = useState(null);
  const [tierId, setTierId] = useState("basic");
  const [showMath, setShowMath] = useState(false);
  const [sourceId, setSourceId] = useState("nearby");
  const [shipId, setShipId] = useState("s");

  /* Orders state */
  const emptyDraft = () => ({ customer: "", location: "", orderDate: today(), eta: "", lines: [] });
  const [draft, setDraft] = useState(emptyDraft());
  const [showDraft, setShowDraft] = useState(false);
  const [lineProdId, setLineProdId] = useState("custom");
  const [lineQty, setLineQty] = useState("1");
  const [lineSell, setLineSell] = useState("");
  const [lineName, setLineName] = useState("");
  const [lineUnitJpy, setLineUnitJpy] = useState("");
  const [openOrder, setOpenOrder] = useState(null);
  const [editOrderId, setEditOrderId] = useState(null);
  const [eProdId, setEProdId] = useState("custom");
  const [eQty, setEQty] = useState("1");
  const [eSell, setESell] = useState("");
  const [eName, setEName] = useState("");
  const [eJpy, setEJpy] = useState("");
  const [period, setPeriod] = useState("month");
  const [orderSearch, setOrderSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all"); // all | sourcing | ready | dispatched | completed
  const [locFilter, setLocFilter] = useState("all");
  const [ordView, setOrdView] = useState("cards"); // cards | sheet

  /* Inventory */
  const [pageId, setPageId] = useState(null);
  const [invSearch, setInvSearch] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [invView, setInvView] = useState("cards"); // cards | sheet

  const T = { ...SWEETIES_THEME, ...(settings.theme || {}) };
  const ping = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const refreshRate = async (silent) => {
    setRateBusy(true);
    try {
      const r = await fetchLiveRate();
      setSettings((s) => ({ ...s, liveRate: r, liveRateAt: new Date().toISOString() }));
      if (!silent) ping(`Live rate updated: ¥1 = ₱${r}`);
    } catch (e) {
      if (!silent) ping("Couldn't fetch the live rate — using your saved rate.");
    }
    setRateBusy(false);
  };

  useEffect(() => {
    (async () => {
      let s = DEFAULT_SETTINGS;
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res?.value) {
          const d = JSON.parse(res.value);
          if (d.settings) {
            s = { ...DEFAULT_SETTINGS, ...d.settings, theme: { ...SWEETIES_THEME, ...(d.settings.theme || {}) } };
            /* migrate ₱ sourcing fees → ¥ */
            s.sourcing = (s.sourcing || []).map((x) => (x.feeJpy != null ? x : { ...x, feeJpy: Math.round((x.fee || 0) / 0.385) }));
            /* shipping classes arrived in v7.8 — give older data the starter set */
            if (!Array.isArray(s.shipping) || !s.shipping.length) s.shipping = DEFAULT_SETTINGS.shipping.map((x) => ({ ...x }));
            if (!s.box) s.box = { ...DEFAULT_SETTINGS.box };
          }
          let prods = [];
          if (Array.isArray(d.products)) prods = d.products;
          else if (Array.isArray(d.items)) prods = d.items.map((i) => ({ id: i.id, name: i.name, qty: 1, unitJpy: i.jpy, unitCost: i.cost, floor: i.floor, list: i.list, date: i.date, store: "", tierName: i.tierName || "" }));
          prods = prods.map((p) =>
            Array.isArray(p.lots)
              ? p
              : { id: p.id, name: p.name, photo: p.photo || null, tierName: p.tierName || "", list: p.list, floor: p.floor, lots: [{ id: p.id, date: p.date || today(), store: p.store || "", qty: p.qty || 1, remaining: p.qty || 1, totalJpy: p.totalJpy || (p.unitJpy || 0) * (p.qty || 1), unitJpy: p.unitJpy || 0, unitCost: p.unitCost || 0 }] }
          );
          setProducts(prods);
          if (Array.isArray(d.orders)) {
            /* migrate paid flag → status + bought flags */
            setOrders(d.orders.map((o) => ({
              ...o,
              status: o.status || (o.paid ? "completed" : "open"),
              reviewed: o.reviewed != null ? o.reviewed : true,
              lines: (o.lines || []).map((l) => ({ ...l, bought: l.bought != null ? l.bought : true })),
            })));
          }
        }
      } catch (e) { /* first visit */ }
      setSettings(s);
      setLoaded(true);
      refreshRate(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const ok = await window.storage.set(STORAGE_KEY, JSON.stringify({ settings, products, orders }));
        setStorageWarn(!ok);
      } catch (e) { console.error("save failed", e); setStorageWarn(true); }
    })();
  }, [settings, products, orders, loaded]);

  /* drafts follow the saved settings until the user starts editing */
  useEffect(() => { setDTiers(settings.tiers.map((t) => ({ ...t }))); }, [settings.tiers]);
  useEffect(() => { setDSourcing(settings.sourcing.map((x) => ({ ...x }))); }, [settings.sourcing]);
  useEffect(() => { setDShipping((settings.shipping || []).map((x) => ({ ...x }))); }, [settings.shipping]);
  useEffect(() => { setDBox({ ...DEFAULT_SETTINGS.box, ...(settings.box || {}) }); }, [settings.box]);

  const rate = settings.rateMode === "live" && settings.liveRate ? settings.liveRate : settings.manualRate || 0.385;
  const toYen = (php) => (rate ? php / rate : 0);
  /* M = the currency the user chose to lead with, M2 = the other one */
  const showYen = (settings.displayCcy || "jpy") === "jpy";
  const M = (php) => (showYen ? yen(toYen(php)) : peso(php));
  const M2 = (php) => (showYen ? peso(php) : yen(toYen(php)));
  const signedM = (php) => (php < 0 ? "−" : "+") + M(Math.abs(php)).replace(/^[−+]/, "");

  const tier = settings.tiers.find((t) => t.id === tierId) || settings.tiers[0];
  const source = settings.sourcing.find((s) => s.id === sourceId) || settings.sourcing[0];
  const feePhp = (s) => (s?.feeJpy || 0) * rate;

  const shipClasses = (settings.shipping && settings.shipping.length ? settings.shipping : DEFAULT_SETTINGS.shipping);
  const shipClass = shipClasses.find((s) => s.id === shipId) || shipClasses[0];
  const shipPhp = (s) => (s?.feeJpy || 0) * rate;

  const restockProduct = products.find((p) => p.id === Number(pTarget));
  const totalJpyNum = parseFloat(pTotalJpy) || 0;
  const qtyNum = Math.max(1, parseInt(pQty) || 1);
  const unitJpy = totalJpyNum / qtyNum;
  const result = useMemo(
    () => (unitJpy > 0 && tier ? computePrice(unitJpy, tier.margin, feePhp(source), rate, settings, shipPhp(shipClass)) : null),
    [unitJpy, tier, source, shipClass, rate, settings] // eslint-disable-line
  );

  /* choosing a product to restock prefills the form from its most recent purchase */
  const startRestock = (id) => {
    setPTarget(String(id));
    const p = products.find((x) => x.id === Number(id));
    const lot = latestLot(p);
    if (lot) {
      setPStore(lot.store || "");
      setPQty(String(lot.qty || 1));
      setPTotalJpy(String(Math.round(lot.totalJpy || 0)));
    }
    setPDate(today());
    setPPhoto(null);
    const t = settings.tiers.find((x) => x.name === p?.tierName);
    if (t) setTierId(t.id);
    if (lot?.shipId && shipClasses.some((x) => x.id === lot.shipId)) setShipId(lot.shipId);
  };

  const attachNewPhoto = async (file) => {
    try { setPPhoto(await resizePhoto(file)); ping("Photo attached"); }
    catch (e) { ping("That image couldn't be read"); }
  };

  const saveProduct = () => {
    if (!result) return;
    const lot = { id: Date.now(), date: pDate || today(), store: pStore.trim(), qty: qtyNum, remaining: qtyNum, totalJpy: totalJpyNum, unitJpy, unitCost: result.trueCost, shipId: shipClass?.id || null, shipName: shipClass?.name || "", shipJpy: shipClass?.feeJpy || 0 };
    let nextProducts;
    let msg;
    if (restockProduct) {
      nextProducts = products.map((p) => (p.id === restockProduct.id ? { ...p, lots: [...p.lots, lot], list: result.list, floor: result.floor, tierName: tier.name, photo: pPhoto || p.photo } : p));
      remember("shops", pStore);
      msg = `Restocked ${restockProduct.name} · +${qtyNum} pc(s) 🗻`;
    } else {
      nextProducts = [{ id: Date.now() + 1, name: pName.trim() || "Untitled find", photo: pPhoto, tierName: tier.name, list: result.list, floor: result.floor, lots: [lot] }, ...products];
      remember("shops", pStore);
      remember("products", pName);
      msg = "Product saved with stock 🗻";
    }
    /* any waiting order line for this product is now filled automatically */
    const res = autoFulfil(nextProducts, orders);
    setProducts(res.products);
    if (res.filled) setOrders(res.orders);
    ping(res.filled ? `${msg} — filled ${res.summary}${res.repriced.length ? ` · repriced ${res.repriced.join(", ")} to stay profitable` : ""}` : msg);
    setPName(""); setPStore(""); setPTotalJpy(""); setPQty("1"); setPPhoto(null); setPDate(today()); setPTarget("new");
  };

  const setProductPhoto = async (id, file) => {
    try {
      const photo = await resizePhoto(file);
      setProducts(products.map((p) => (p.id === id ? { ...p, photo } : p)));
      ping("Photo saved");
    } catch (e) { ping("That image couldn't be read"); }
  };

  const removeProduct = (id) => {
    const used = orders.some((o) => o.lines.some((l) => l.productId === id));
    if (used && !window.confirm("This product appears in saved orders. Delete anyway? (Order records keep their numbers.)")) return;
    if (pageId === id) setPageId(null);
    setProducts(products.filter((p) => p.id !== id));
  };

  /* order lines */
  const lineProduct = products.find((p) => p.id === Number(lineProdId));
  const draftUsedFor = (productId) => {
    const used = {};
    draft.lines.forEach((l) => {
      if (l.productId === productId && Array.isArray(l.allocs)) l.allocs.forEach((a) => { used[a.lotId] = (used[a.lotId] || 0) + a.qty; });
    });
    return used;
  };
  const draftAvail = (p) => productStock(p) - Object.values(draftUsedFor(p.id)).reduce((a, b) => a + b, 0);

  useEffect(() => { if (lineProduct) setLineSell(String(lineProduct.list)); }, [lineProdId]); // eslint-disable-line

  const addLine = () => {
    const q = Math.max(1, parseInt(lineQty) || 1);
    const sell = parseFloat(lineSell) || 0;
    let line;
    if (lineProduct) {
      const { allocs, short } = allocateFIFO(lineProduct, q, draftUsedFor(lineProduct.id));
      if (short > 0) return ping(`Only ${q - short} pc(s) of ${lineProduct.name} left in stock`);
      const cost = allocs.reduce((a, x) => a + x.unitCost * x.qty, 0) / q;
      const uj = allocs.reduce((a, x) => a + x.unitJpy * x.qty, 0) / q;
      line = { id: Date.now(), productId: lineProduct.id, name: lineProduct.name, qty: q, unitJpy: uj, unitCost: cost, sell: sell || lineProduct.list, allocs, bought: true };
    } else {
      if (!lineName.trim()) return ping("Type what the customer is asking for");
      line = { id: Date.now(), productId: null, name: lineName.trim(), qty: 1, unitJpy: 0, unitCost: 0, sell: 0, allocs: null, bought: false, estimated: true, request: true };
    }
    if (!line.request && line.sell <= 0) return ping("Set a selling price first");
    setDraft({ ...draft, lines: [...draft.lines, line] });
    remember("products", line.name);
    setLineQty("1"); setLineSell(lineProduct ? String(lineProduct.list) : ""); setLineName(""); setLineUnitJpy("");
    ping(lineProduct ? `Reserved ${line.qty} pc(s) from stock` : "Pre-order item added — mark it Bought once you have it");
  };

  /* suggested selling prices for a product (or a freshly computed item) */
  const priceSuggestions = (floor, best) => [
    { key: "floor", label: "Floor", value: floor, note: "lowest safe" },
    { key: "best", label: "Best", value: best, note: "recommended" },
    { key: "premium", label: "Premium", value: roundUp10(best * 1.12), note: "rare / rush" },
  ];

  /* when stock arrives, fill any order line still waiting for that product */
  const autoFulfil = (prodList, orderList) => {
    const used = {}; // lotId -> qty taken in this pass
    let filled = 0;
    const names = {};
    const repriced = [];
    const newOrders = orderList.map((o) => {
      if (o.status === "completed") return o;
      let touched = false;
      const lines = o.lines.map((l) => {
        if (l.bought) return l;
        const match = prodList.find((p) => p.name.trim().toLowerCase() === (l.name || "").trim().toLowerCase());
        if (!match) return l;
        const { allocs, short } = allocateFIFO(match, l.qty, used);
        if (short > 0) return l; // not enough stock yet — leave it waiting
        allocs.forEach((a) => { used[a.lotId] = (used[a.lotId] || 0) + a.qty; });
        const cost = allocs.reduce((a, x) => a + x.unitCost * x.qty, 0) / l.qty;
        const uj = allocs.reduce((a, x) => a + x.unitJpy * x.qty, 0) / l.qty;
        /* the estimate is now a real cost — lift the selling price if it would lose money */
        let sell = l.sell;
        if (!(sell > 0) || sell < match.floor || sell < cost) { sell = Math.max(match.list, roundUp10(cost * 1.15)); repriced.push(l.name); }
        touched = true; filled += 1;
        names[l.name] = (names[l.name] || 0) + l.qty;
        return { ...l, bought: true, productId: match.id, unitCost: cost, unitJpy: uj, allocs, sell, estimated: false };
      });
      return touched ? { ...o, lines, reviewed: false } : o;
    });
    if (!filled) return { products: prodList, orders: orderList, filled: 0, summary: "", repriced: [] };
    const newProducts = prodList.map((p) => ({
      ...p,
      lots: p.lots.map((lot) => (used[lot.id] ? { ...lot, remaining: Math.max(0, lot.remaining - used[lot.id]) } : lot)),
    }));
    const summary = Object.entries(names).map(([n, q]) => `${q}× ${n}`).join(", ");
    return { products: newProducts, orders: newOrders, filled, summary, repriced: [...new Set(repriced)] };
  };

  const lineMath = (l) => {
    const spent = l.unitCost * l.qty;
    const revenue = l.sell * l.qty;
    const profit = revenue - spent;
    return { spent, revenue, profit, margin: spent > 0 ? (profit / spent) * 100 : 0 };
  };
  const orderMath = (o) => {
    const t = o.lines.reduce((a, l) => { const m = lineMath(l); return { spent: a.spent + m.spent, revenue: a.revenue + m.revenue, profit: a.profit + m.profit }; }, { spent: 0, revenue: 0, profit: 0 });
    return { ...t, margin: t.spent > 0 ? (t.profit / t.spent) * 100 : 0, units: o.lines.reduce((a, l) => a + l.qty, 0) };
  };

  const applyAllocs = (prods, lines, sign) =>
    prods.map((p) => {
      const mine = lines.filter((l) => l.productId === p.id && Array.isArray(l.allocs));
      if (!mine.length) return p;
      const delta = {};
      mine.forEach((l) => l.allocs.forEach((a) => { delta[a.lotId] = (delta[a.lotId] || 0) + a.qty; }));
      return { ...p, lots: p.lots.map((lot) => (delta[lot.id] ? { ...lot, remaining: Math.max(0, Math.min(lot.qty, lot.remaining + sign * delta[lot.id])) } : lot)) };
    });

  const saveOrder = () => {
    if (!draft.customer.trim()) return ping("Whose order is this? Add a customer name");
    if (!draft.lines.length) return ping("Add at least one item to the order");
    setProducts((prods) => applyAllocs(prods, draft.lines, -1));
    setOrders([{ id: Date.now(), ...draft, customer: draft.customer.trim(), status: "open", reviewed: draft.lines.every((l) => l.bought) }, ...orders]);
    remember("customers", draft.customer);
    remember("locations", draft.location);
    remember("products", ...draft.lines.map((l) => l.name));
    setDraft(emptyDraft()); setShowDraft(false);
    ping("Order saved 🌸");
  };
  const removeOrder = (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    if (!window.confirm("Delete this order? Reserved stock goes back to inventory.")) return;
    setProducts((prods) => applyAllocs(prods, o.lines, +1));
    setOrders(orders.filter((x) => x.id !== id));
    ping("Order deleted — stock returned");
  };

  /* lifecycle actions */
  /* ── editing a saved order ── */
  const removeLineFromOrder = (orderId, lineId) => {
    const o = orders.find((x) => x.id === orderId);
    const l = o?.lines.find((x) => x.id === lineId);
    if (!o || !l) return;
    if (o.lines.length === 1) return ping("An order needs at least one item — delete the whole order instead");
    if (!window.confirm(`Remove ${l.name} × ${l.qty} from ${o.customer}'s order?${Array.isArray(l.allocs) ? " Its stock goes back to inventory." : ""}`)) return;
    if (Array.isArray(l.allocs)) setProducts((prods) => applyAllocs(prods, [l], +1));
    setOrders(orders.map((x) => (x.id === orderId ? { ...x, lines: x.lines.filter((y) => y.id !== lineId) } : x)));
    ping("Item removed");
  };

  const markReviewed = (id) => {
    setOrders(orders.map((o) => (o.id === id ? { ...o, reviewed: true } : o)));
    ping("Checked — ready to dispatch 🌸");
  };

  const setOrderLineQty = (orderId, lineId, value) => {
    const q = Math.max(1, parseInt(value) || 1);
    const o = orders.find((x) => x.id === orderId);
    const l = o?.lines.find((x) => x.id === lineId);
    if (!l) return;
    if (Array.isArray(l.allocs)) return ping("Remove this item and add it again to change a stocked quantity");
    setOrders(orders.map((x) => (x.id === orderId ? { ...x, lines: x.lines.map((y) => (y.id === lineId ? { ...y, qty: q } : y)) } : x)));
  };

  const setLineSellPrice = (orderId, lineId, value) => {
    const v = parseFloat(value);
    if (!(v > 0)) return;
    setOrders(orders.map((o) => (o.id === orderId ? { ...o, lines: o.lines.map((l) => (l.id === lineId ? { ...l, sell: v } : l)) } : o)));
  };

  const addLineToOrder = (orderId) => {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    const q = Math.max(1, parseInt(eQty) || 1);
    const sell = parseFloat(eSell) || 0;
    const prod = products.find((p) => p.id === Number(eProdId));
    let line;
    if (prod) {
      const { allocs, short } = allocateFIFO(prod, q, {});
      if (short > 0) return ping(`Only ${q - short} pc(s) of ${prod.name} in stock`);
      const cost = allocs.reduce((a, x) => a + x.unitCost * x.qty, 0) / q;
      const uj = allocs.reduce((a, x) => a + x.unitJpy * x.qty, 0) / q;
      line = { id: Date.now(), productId: prod.id, name: prod.name, qty: q, unitJpy: uj, unitCost: cost, sell: sell || prod.list, allocs, bought: true };
      setProducts((prods) => applyAllocs(prods, [line], -1));
    } else {
      if (!eName.trim()) return ping("Type what the customer is asking for");
      line = { id: Date.now(), productId: null, name: eName.trim(), qty: 1, unitJpy: 0, unitCost: 0, sell: 0, allocs: null, bought: false, estimated: true, request: true };
    }
    if (!line.request && line.sell <= 0) return ping("Set a selling price first");
    remember("products", line.name);
    setOrders(orders.map((x) => (x.id === orderId ? { ...x, lines: [...x.lines, line] } : x)));
    setEQty("1"); setESell(""); setEName(""); setEJpy(""); setEProdId("custom");
    ping("Item added to the order");
  };

  const toggleLineBought = (orderId, lineId) =>
    setOrders(orders.map((o) => (o.id === orderId ? { ...o, lines: o.lines.map((l) => (l.id === lineId ? { ...l, bought: !l.bought } : l)) } : o)));
  const dispatchOrder = (id) => {
    const o = orders.find((x) => x.id === id);
    if (o && !o.lines.every((l) => l.bought) && !window.confirm("Some items aren't marked as bought yet. Dispatch anyway?")) return;
    if (o && o.reviewed === false && !window.confirm("Prices haven't been checked since stock arrived. Dispatch anyway?")) return;
    setOrders(orders.map((x) => (x.id === id ? { ...x, status: "dispatched" } : x)));
    ping("Order dispatched 🚚");
  };
  const undoDispatch = (id) => setOrders(orders.map((x) => (x.id === id ? { ...x, status: "open" } : x)));
  const completeOrder = (id) => {
    setOrders(orders.map((x) => (x.id === id ? { ...x, status: "completed" } : x)));
    ping("Received & paid — order completed ✓");
  };
  const reopenOrder = (id) => setOrders(orders.map((x) => (x.id === id ? { ...x, status: "dispatched" } : x)));

  /* period + search + phase filtering */
  const nowYM = today().slice(0, 7);
  const nowY = today().slice(0, 4);
  const inPeriod = (o) => {
    const d = o.orderDate || "";
    if (period === "month") return d.slice(0, 7) === nowYM;
    if (period === "year") return d.slice(0, 4) === nowY;
    return true;
  };
  const matchesSearch = (o) => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      o.customer.toLowerCase().includes(q) ||
      (o.location || "").toLowerCase().includes(q) ||
      o.lines.some((l) => l.name.toLowerCase().includes(q))
    );
  };
  const matchesPhase = (o) => phaseFilter === "all" || orderPhase(o) === phaseFilter;
  const matchesLoc = (o) => locFilter === "all" || (o.location || "— no location —") === locFilter;

  const periodOrders = orders.filter(inPeriod);
  const visibleOrders = periodOrders.filter((o) => matchesSearch(o) && matchesPhase(o) && matchesLoc(o));

  /* every customer location on record, for the dropdown */
  const allLocations = [...new Set(orders.map((o) => (o.location || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const hasUnlocated = orders.some((o) => !(o.location || "").trim());

  const sumOrders = (list) => {
    const all = list.map(orderMath);
    const spent = all.reduce((a, m) => a + m.spent, 0);
    const revenue = all.reduce((a, m) => a + m.revenue, 0);
    const uncollected = list.filter((o) => orderPhase(o) !== "completed").reduce((a, o) => a + orderMath(o).revenue, 0);
    const units = all.reduce((a, m) => a + m.units, 0);
    return { spent, revenue, profit: revenue - spent, uncollected, count: list.length, units, margin: spent > 0 ? ((revenue - spent) / spent) * 100 : 0 };
  };
  const periodStats = useMemo(() => sumOrders(periodOrders), [orders, period]); // eslint-disable-line
  const allStats = useMemo(() => sumOrders(orders), [orders]); // eslint-disable-line

  /* items across all open orders that still need to be bought */
  const pendingItems = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (o.status === "completed") return;
      o.lines.forEach((l) => {
        if (l.bought) return;
        const k = l.name.trim();
        if (!map[k]) map[k] = { qty: 0, customers: new Set() };
        map[k].qty += l.qty;
        map[k].customers.add(o.customer);
      });
    });
    return Object.entries(map).map(([name, v]) => ({ name, qty: v.qty, customers: [...v.customers] })).sort((a, b) => b.qty - a.qty);
  }, [orders]);

  const phaseCounts = useMemo(() => {
    const c = { all: periodOrders.length, sourcing: 0, review: 0, ready: 0, dispatched: 0, completed: 0 };
    periodOrders.forEach((o) => { c[orderPhase(o)]++; });
    return c;
  }, [orders, period]); // eslint-disable-line

  const monthly = useMemo(() => {
    const map = {};
    periodOrders.forEach((o) => {
      const ym = (o.orderDate || "").slice(0, 7) || "—";
      const m = orderMath(o);
      if (!map[ym]) map[ym] = { revenue: 0, profit: 0, count: 0, units: 0 };
      map[ym].revenue += m.revenue; map[ym].profit += m.profit; map[ym].count += 1; map[ym].units += m.units;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [orders, period]); // eslint-disable-line

  /* nudge to export a backup — browser storage can be cleared without warning */
  const daysSinceBackup = settings.lastBackup ? Math.floor((Date.now() - new Date(settings.lastBackup).getTime()) / 86400000) : null;
  const hasData = products.length > 0 || orders.length > 0;
  const backupDue = hasData && (daysSinceBackup === null || daysSinceBackup >= 7);
  const lastBackupLabel = settings.lastBackup
    ? new Date(settings.lastBackup).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "never";

  const invStats = useMemo(() => {
    let stockValue = 0, potential = 0, pieces = 0, sold = 0;
    products.forEach((p) => {
      (p.lots || []).forEach((l) => { stockValue += l.remaining * l.unitCost; pieces += l.remaining; sold += l.qty - l.remaining; });
      potential += productStock(p) * p.list;
    });
    return { stockValue, potential, profit: potential - stockValue, pieces, sold, count: products.length };
  }, [products]);

  /* every shop on record, for the inventory filter */
  const allShops = [...new Set(products.flatMap((p) => (p.lots || []).map((l) => (l.store || "").trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const hasUnshopped = products.some((p) => (p.lots || []).some((l) => !(l.store || "").trim()));

  const visibleProducts = products.filter((p) => {
    const q = invSearch.trim().toLowerCase();
    const searchOk = !q || p.name.toLowerCase().includes(q) || (p.lots || []).some((l) => (l.store || "").toLowerCase().includes(q));
    const shopOk =
      shopFilter === "all" ||
      (shopFilter === "— no shop —"
        ? (p.lots || []).some((l) => !(l.store || "").trim())
        : (p.lots || []).some((l) => (l.store || "").trim() === shopFilter));
    return searchOk && shopOk;
  });

  /* product page data */
  const pageProduct = products.find((p) => p.id === pageId);
  const pageSales = useMemo(() => {
    if (!pageProduct) return [];
    const out = [];
    orders.forEach((o) => o.lines.forEach((l) => {
      if (l.productId === pageProduct.id) out.push({ date: o.orderDate, customer: o.customer, qty: l.qty, revenue: l.sell * l.qty, profit: (l.sell - l.unitCost) * l.qty });
    }));
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [orders, pageProduct]);
  const pageHistory = useMemo(() => {
    if (!pageProduct) return [];
    const buys = (pageProduct.lots || []).map((l) => ({ type: "buy", date: l.date, label: l.store || "—", qty: l.qty, php: l.unitCost * l.qty }));
    const sells = pageSales.map((s) => ({ type: "sell", date: s.date, label: s.customer, qty: s.qty, php: s.revenue }));
    return [...buys, ...sells].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [pageProduct, pageSales]);

  /* export / import */
  /* ── spreadsheet exports (.xlsx, themed, with green gains and red losses) ── */
  const PESO_FMT = '"₱"#,##0';
  const YEN_FMT = '"¥"#,##0';
  /* spreadsheets use whichever currency leads in the app */
  const MAIN_FMT = () => (showYen ? YEN_FMT : PESO_FMT);
  const MAIN_SYM = () => (showYen ? "¥" : "₱");
  const mv = (php) => Math.round(showYen ? toYen(php) : php);

  /* the workbook borrows the theme's hue but always stays light and readable,
     because a dark theme's surfaces would make black spreadsheet text invisible */
  const contrastWithWhite = (hex) => 1.05 / (lum(hex) + 0.05);
  /* darken the header until white text is comfortably readable on it */
  const sheetHeaderBg = (() => {
    let c = T.primary || "#801d5c";
    let guard = 0;
    while (contrastWithWhite(c) < 4.5 && guard++ < 12) c = shade(c, 0.12);
    return c;
  })();
  const sheetStripeBg = tint(T.primary, 0.92);
  const sheetTotalBg = tint(T.primary, 0.82);

  const styleSheet = (ws, headerCount) => {
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.getRow(1).height = 30;
    ws.getRow(1).eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(sheetHeaderBg, "FF801D5C") } };
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headerCount } };
  };

  const paintMoney = (cell, value, fmt) => {
    cell.numFmt = fmt;
    cell.font = { bold: true, color: { argb: argb(value < 0 ? LOSS_HEX : GAIN_HEX) } };
    if (value < 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7E7" } };
  };

  /* every body cell gets dark text and a pale fill, whatever theme is active */
  const stripe = (row, i) => {
    row.eachCell({ includeEmpty: true }, (c) => {
      if (!c.font || !c.font.color) c.font = { ...(c.font || {}), color: { argb: argb(SHEET_INK) } };
      if (!c.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(i % 2 ? sheetStripeBg : "#ffffff", "FFFFFFFF") } };
    });
  };

  const totalsRow = (ws, row) => {
    row.eachCell({ includeEmpty: true }, (c) => {
      if (!c.font || !c.font.color) c.font = { color: { argb: argb(SHEET_INK) } };
      c.font = { ...c.font, bold: true };
      c.fill = c.fill && c.fill.fgColor && c.fill.fgColor.argb === "FFFDE7E7"
        ? c.fill
        : { type: "pattern", pattern: "solid", fgColor: { argb: argb(sheetTotalBg, "FFF3E3EE") } };
      c.border = { top: { style: "double", color: { argb: argb(sheetHeaderBg, "FF801D5C") } } };
    });
  };

  const exportInventoryXLSX = async () => {
    if (!products.length) return ping("Nothing to export yet");
    let ExcelJS;
    try { ExcelJS = await ensureExcel(); }
    catch (e) { return ping("Need to be online once to prepare spreadsheets"); }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Zen Pasabuy";
    const ws = wb.addWorksheet("Inventory");
    ws.columns = [
      { header: "Product", key: "a", width: 26 },
      { header: "Tier", key: "b", width: 10 },
      { header: "Date bought", key: "c", width: 13 },
      { header: "Shop", key: "d", width: 22 },
      { header: "Bought", key: "e", width: 9 },
      { header: "Left", key: "f", width: 8 },
      { header: "Sold", key: "g", width: 8 },
      { header: "Unit ¥", key: "h", width: 11 },
      { header: `Cost/pc ${MAIN_SYM()}`, key: "i", width: 12 },
      { header: `Sell/pc ${MAIN_SYM()}`, key: "j", width: 12 },
      { header: `Profit/pc ${MAIN_SYM()}`, key: "k", width: 13 },
      { header: "Margin", key: "l", width: 10 },
      { header: "Result", key: "m", width: 11 },
      { header: `Stock value ${MAIN_SYM()}`, key: "n", width: 14 },
    ];
    styleSheet(ws, ws.columns.length);
    let i = 0, totStock = 0, totValue = 0, totProfit = 0;
    products.forEach((p) => {
      (p.lots || []).forEach((l) => {
        const profit = p.list - l.unitCost;
        const margin = l.unitCost > 0 ? profit / l.unitCost : 0;
        const value = l.remaining * l.unitCost;
        totStock += l.remaining; totValue += value; totProfit += profit * l.remaining;
        const row = ws.addRow({
          a: p.name, b: p.tierName, c: l.date, d: l.store || "—",
          e: l.qty, f: l.remaining, g: l.qty - l.remaining,
          h: Math.round(l.unitJpy), i: mv(l.unitCost), j: mv(p.list),
          k: mv(profit), l: margin, m: profit < 0 ? "LOSS" : "Profit",
          n: mv(value),
        });
        row.getCell("h").numFmt = YEN_FMT;
        row.getCell("i").numFmt = MAIN_FMT();
        row.getCell("j").numFmt = MAIN_FMT();
        row.getCell("n").numFmt = MAIN_FMT();
        row.getCell("l").numFmt = "0%";
        paintMoney(row.getCell("k"), profit, MAIN_FMT());
        const res = row.getCell("m");
        res.font = { bold: true, color: { argb: argb(profit < 0 ? LOSS_HEX : GAIN_HEX) } };
        res.alignment = { horizontal: "center" };
        row.getCell("l").font = { color: { argb: argb(profit < 0 ? LOSS_HEX : GAIN_HEX) } };
        stripe(row, i++);
      });
    });
    const tr = ws.addRow({ a: `TOTALS · ${products.length} product(s)`, f: totStock, k: mv(totProfit), n: mv(totValue) });
    tr.getCell("n").numFmt = MAIN_FMT();
    paintMoney(tr.getCell("k"), totProfit, MAIN_FMT());
    totalsRow(ws, tr);

    downloadBlob(`zen-pasabuy-inventory-${today()}.xlsx`, new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    ping("Inventory spreadsheet exported 🌸");
  };

  const exportOrdersXLSX = async () => {
    if (!orders.length) return ping("Nothing to export yet");
    let ExcelJS;
    try { ExcelJS = await ensureExcel(); }
    catch (e) { return ping("Need to be online once to prepare spreadsheets"); }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Zen Pasabuy";
    const ws = wb.addWorksheet("Orders");
    ws.columns = [
      { header: "Order date", key: "a", width: 12 },
      { header: "Customer", key: "b", width: 18 },
      { header: "Location", key: "c", width: 16 },
      { header: "Status", key: "d", width: 15 },
      { header: "Arriving", key: "e", width: 12 },
      { header: "Product", key: "f", width: 26 },
      { header: "Qty", key: "g", width: 7 },
      { header: "Bought", key: "h", width: 9 },
      { header: `Cost/pc ${MAIN_SYM()}`, key: "i", width: 12 },
      { header: `Sell/pc ${MAIN_SYM()}`, key: "j", width: 12 },
      { header: `Spent ${MAIN_SYM()}`, key: "k", width: 12 },
      { header: `Revenue ${MAIN_SYM()}`, key: "l", width: 12 },
      { header: `Profit ${MAIN_SYM()}`, key: "m", width: 12 },
      { header: "Margin", key: "n", width: 10 },
      { header: "Result", key: "o", width: 11 },
    ];
    styleSheet(ws, ws.columns.length);
    let i = 0, tSpent = 0, tRev = 0;
    orders.forEach((o) => {
      o.lines.forEach((l) => {
        const lm = lineMath(l);
        tSpent += lm.spent; tRev += lm.revenue;
        const row = ws.addRow({
          a: o.orderDate, b: o.customer, c: o.location || "—", d: PHASE[orderPhase(o)].label,
          e: o.eta || "—", f: l.name, g: l.qty, h: l.bought ? "Yes" : "No",
          i: mv(l.unitCost), j: mv(l.sell), k: mv(lm.spent),
          l: mv(lm.revenue), m: mv(lm.profit),
          n: lm.spent > 0 ? lm.profit / lm.spent : 0,
          o: lm.profit < 0 ? "LOSS" : "Profit",
        });
        ["i", "j", "k", "l"].forEach((k) => (row.getCell(k).numFmt = MAIN_FMT()));
        row.getCell("n").numFmt = "0%";
        paintMoney(row.getCell("m"), lm.profit, MAIN_FMT());
        const res = row.getCell("o");
        res.font = { bold: true, color: { argb: argb(lm.profit < 0 ? LOSS_HEX : GAIN_HEX) } };
        res.alignment = { horizontal: "center" };
        row.getCell("n").font = { color: { argb: argb(lm.profit < 0 ? LOSS_HEX : GAIN_HEX) } };
        if (!l.bought) row.getCell("h").font = { bold: true, color: { argb: argb(LOSS_HEX) } };
        stripe(row, i++);
      });
    });
    const tProfit = tRev - tSpent;
    const tr = ws.addRow({
      a: "TOTALS", b: `${orders.length} order(s)`,
      k: mv(tSpent), l: mv(tRev), m: mv(tProfit),
      n: tSpent > 0 ? tProfit / tSpent : 0, o: tProfit < 0 ? "LOSS" : "Profit",
    });
    ["k", "l"].forEach((k) => (tr.getCell(k).numFmt = MAIN_FMT()));
    tr.getCell("n").numFmt = "0%";
    paintMoney(tr.getCell("m"), tProfit, MAIN_FMT());
    tr.getCell("o").font = { bold: true, color: { argb: argb(tProfit < 0 ? LOSS_HEX : GAIN_HEX) } };
    totalsRow(ws, tr);

    downloadBlob(`zen-pasabuy-orders-${today()}.xlsx`, new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    ping("Orders spreadsheet exported 🌸");
  };

  const exportJSON = () => {
    download(`zen-pasabuy-backup-${today()}.json`, JSON.stringify({ app: "zen-pasabuy", version: APP_VERSION, exportedAt: new Date().toISOString(), settings, products, orders }, null, 2), "application/json");
    setSettings((s) => ({ ...s, lastBackup: new Date().toISOString() }));
    ping("Backup exported — photos included");
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        let added = 0;
        if (Array.isArray(d.products)) {
          const have = new Set(products.map((p) => p.id));
          const fresh = d.products.filter((p) => p && p.id && !have.has(p.id));
          added += fresh.length;
          setProducts([...fresh, ...products]);
        }
        if (Array.isArray(d.orders)) {
          const have = new Set(orders.map((o) => o.id));
          const fresh = d.orders
            .filter((o) => o && o.id && !have.has(o.id))
            .map((o) => ({ ...o, status: o.status || (o.paid ? "completed" : "open"), lines: (o.lines || []).map((l) => ({ ...l, bought: l.bought != null ? l.bought : true })) }));
          added += fresh.length;
          setOrders([...fresh, ...orders]);
        }
        if (d.settings) setSettings((s) => {
          const merged = { ...s, ...d.settings, theme: { ...SWEETIES_THEME, ...(d.settings.theme || s.theme) } };
          merged.sourcing = (merged.sourcing || []).map((x) => (x.feeJpy != null ? x : { ...x, feeJpy: Math.round((x.fee || 0) / 0.385) }));
          return merged;
        });
        ping(added ? `Imported ${added} record(s) — photos restored` : "File read — nothing new to add");
      } catch (e) { ping("That file couldn't be read — use a backup exported from this app."); }
    };
    reader.readAsText(file);
  };

  /* ── remembered entries: shops, locations, customers, product names ── */
  const uniqSorted = (arr) => [...new Set(arr.map((x) => (x || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const remember = (key, ...vals) => {
    const clean = vals.map((v) => (v || "").trim()).filter(Boolean);
    if (!clean.length) return;
    setSettings((s) => {
      const mem = { shops: [], locations: [], customers: [], products: [], ...(s.memory || {}) };
      const next = [...(mem[key] || [])];
      clean.forEach((v) => { if (!next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v); });
      return { ...s, memory: { ...mem, [key]: next.slice(-300) } };
    });
  };
  const memShops = uniqSorted([...(settings.memory?.shops || []), ...products.flatMap((p) => (p.lots || []).map((l) => l.store))]);
  const memLocations = uniqSorted([...(settings.memory?.locations || []), ...orders.map((o) => o.location)]);
  const memCustomers = uniqSorted([...(settings.memory?.customers || []), ...orders.map((o) => o.customer)]);
  const memProducts = uniqSorted([...(settings.memory?.products || []), ...products.map((p) => p.name), ...orders.flatMap((o) => o.lines.map((l) => l.name))]);

  /* hard-refresh the app itself (data lives in storage, so it is kept) */
  const refreshApp = async () => {
    ping("Refreshing to the latest version…");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* no cache API — plain reload still works */ }
    const u = new URL(window.location.href);
    u.searchParams.set("v", String(Date.now()));
    window.location.replace(u.toString());
  };

  /* ── tiers & sourcing are edited as drafts, then saved ── */
  const tiersDirty = !!dTiers && JSON.stringify(dTiers) !== JSON.stringify(settings.tiers);
  const sourcingDirty = !!dSourcing && JSON.stringify(dSourcing) !== JSON.stringify(settings.sourcing);
  const shippingDirty = !!dShipping && JSON.stringify(dShipping) !== JSON.stringify(settings.shipping || []);
  const boxDirty = !!dBox && JSON.stringify(dBox) !== JSON.stringify({ ...DEFAULT_SETTINGS.box, ...(settings.box || {}) });

  const updTier = (i, patch) => setDTiers((d) => d.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addTier = () => setDTiers((d) => [...d, { id: "t" + Date.now(), name: "New tier", desc: "Describe it", margin: 25 }]);
  const removeTier = (i) => {
    if (dTiers.length <= 1) return ping("Keep at least one tier 🌸");
    setDTiers((d) => d.filter((_, j) => j !== i));
  };

  const updSourcing = (i, patch) => setDSourcing((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addSourcing = () => setDSourcing((d) => [...d, { id: "s" + Date.now(), name: "New sourcing type", note: "When you use it", feeJpy: 100 }]);
  const removeSourcing = (i) => {
    if (dSourcing.length <= 1) return ping("Keep at least one sourcing type 🌸");
    setDSourcing((d) => d.filter((_, j) => j !== i));
  };

  const updShipping = (i, patch) => setDShipping((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addShipping = () => setDShipping((d) => [...d, { id: "sh" + Date.now(), name: "New size", note: "What fits in it", liters: 1, feeJpy: Math.round(yenPerLitre(dBox) || 60) }]);
  const removeShipping = (i) => {
    if (dShipping.length <= 1) return ping("Keep at least one shipping size 🌸");
    setDShipping((d) => d.filter((_, j) => j !== i));
  };
  /* recompute every size's ¥ from litres × the box's ¥ per litre */
  const recalcShipping = () => {
    const perL = yenPerLitre(dBox);
    if (!(perL > 0)) return ping("Fill in the box cost and capacity first");
    setDShipping((d) => d.map((x) => (Number(x.liters) > 0 ? { ...x, feeJpy: Math.round(Number(x.liters) * perL) } : { ...x, feeJpy: 0 })));
    ping(`Sizes recomputed at ${yen(Math.round(perL))} per litre`);
  };

  /* keep a rolling history of the settings that were in use before each save */
  const snapshotOf = (st) => ({ tiers: st.tiers, sourcing: st.sourcing, shipping: st.shipping, box: st.box, buffer: st.buffer, negotiation: st.negotiation });
  const withHistory = (st, label) => {
    const prev = { id: Date.now(), at: new Date().toISOString(), label, ...snapshotOf(st) };
    const hist = [prev, ...(st.history || [])]
      .filter((h, i, arr) => i === 0 || JSON.stringify(snapshotOf(h)) !== JSON.stringify(snapshotOf(arr[i - 1])))
      .slice(0, 12);
    return hist;
  };

  const saveTiers = () => {
    const history = withHistory(settings, "before tier change");
    setSettings({ ...settings, tiers: dTiers, history });
    if (!dTiers.some((t) => t.id === tierId)) setTierId(dTiers[0]?.id);
    ping("Tiers saved 🌸");
  };
  const saveSourcing = () => {
    const history = withHistory(settings, "before fee change");
    setSettings({ ...settings, sourcing: dSourcing, history });
    if (!dSourcing.some((x) => x.id === sourceId)) setSourceId(dSourcing[0]?.id);
    ping("Sourcing fees saved 🌸");
  };
  const saveShipping = () => {
    const history = withHistory(settings, "before shipping change");
    setSettings({ ...settings, shipping: dShipping, box: dBox, history });
    if (!dShipping.some((x) => x.id === shipId)) setShipId(dShipping[0]?.id);
    ping("Shipping sizes saved 🌸");
  };
  const discardTiers = () => { setDTiers(settings.tiers.map((t) => ({ ...t }))); ping("Tier changes discarded"); };
  const discardSourcing = () => { setDSourcing(settings.sourcing.map((x) => ({ ...x }))); ping("Fee changes discarded"); };
  const discardShipping = () => {
    setDShipping((settings.shipping || []).map((x) => ({ ...x })));
    setDBox({ ...DEFAULT_SETTINGS.box, ...(settings.box || {}) });
    ping("Shipping changes discarded");
  };

  const saveAsDefault = () => {
    if (tiersDirty || sourcingDirty || shippingDirty || boxDirty) return ping("Save your changes first, then set them as default");
    setSettings({ ...settings, defaults: snapshotOf(settings) });
    ping("Saved as your default setup 🌸");
  };
  const applySnapshot = (snap, msg) => {
    const history = withHistory(settings, "before restore");
    const shipSnap = snap.shipping && snap.shipping.length ? snap.shipping : settings.shipping;
    setSettings({ ...settings, tiers: snap.tiers, sourcing: snap.sourcing, shipping: shipSnap, box: snap.box || settings.box, buffer: snap.buffer ?? settings.buffer, negotiation: snap.negotiation ?? settings.negotiation, history });
    if (!snap.tiers.some((t) => t.id === tierId)) setTierId(snap.tiers[0]?.id);
    if (!snap.sourcing.some((x) => x.id === sourceId)) setSourceId(snap.sourcing[0]?.id);
    if (!shipSnap.some((x) => x.id === shipId)) setShipId(shipSnap[0]?.id);
    ping(msg);
  };

  /* ── styles ── */
  const label = { fontFamily: "'Quicksand', system-ui, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, display: "block", marginBottom: 6 };
  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.bg, color: T.ink, fontFamily: "'Quicksand', system-ui, sans-serif", fontSize: 16, fontWeight: 600, outline: "none" };
  const card = { background: T.paper, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" };
  const primaryBtn = { padding: "13px", borderRadius: 14, border: "none", background: `linear-gradient(120deg, ${T.primary}, ${T.accent})`, color: "#fff", fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer" };
  const ghostBtn = { padding: "9px 13px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.paper, color: T.ink, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
  const dashedBtn = { padding: 11, borderRadius: 14, border: `1.5px dashed ${T.pink}`, background: "transparent", color: T.accent, fontWeight: 700, fontFamily: "'Quicksand', sans-serif", cursor: "pointer" };

  const Chip = ({ active, onClick, title, sub }) => (
    <button onClick={onClick} style={{ flex: "1 1 0", minWidth: 0, cursor: "pointer", padding: "10px 8px", borderRadius: 14, border: `1.5px solid ${active ? T.primary : T.border}`, background: active ? T.primary : T.paper, color: active ? "#fff" : T.ink, textAlign: "center", transition: "all .15s ease" }}>
      <div style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 13 }}>{title}</div>
      {sub && <div style={{ fontSize: 10.5, marginTop: 2, color: active ? "rgba(255,255,255,.8)" : T.muted }}>{sub}</div>}
    </button>
  );
  const StatBox = ({ title, php, sub, raw }) => (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ ...label, marginBottom: 2 }}>{title}</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 23, fontWeight: 700, color: php < 0 ? DANGER : T.primary, lineHeight: 1.15 }}>
        {raw !== undefined ? raw : M(php)}
      </div>
      {raw === undefined && <div style={{ fontSize: 10.5, color: T.muted }}>{M2(php)}</div>}
      <div style={{ fontSize: 10.5, color: T.muted }}>{sub}</div>
    </div>
  );
  const Thumb = ({ p, size = 54 }) => (
    <div style={{ width: size, height: size, borderRadius: 12, background: T.soft, border: `1px solid ${T.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size / 2.6 }}>
      {p.photo ? <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ZenLogo size={size * 0.62} />}
    </div>
  );
  const TagRow = ({ name, php, strong }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontFamily: "'Quicksand', sans-serif", fontSize: 13, fontWeight: strong || php < 0 ? 700 : 500, color: php < 0 ? DANGER : strong ? T.primary : T.ink, gap: 10 }}>
      <span style={{ color: php < 0 ? DANGER : strong ? T.primary : T.muted }}>{name}</span>
      <span style={{ textAlign: "right" }}>
        {M(php)} <span style={{ color: php < 0 ? DANGER : T.muted, fontWeight: 500, fontSize: 12 }}>· {M2(php)}</span>
      </span>
    </div>
  );

  /* ── page tutorial, shown at the bottom of every page ── */
  const Guide = ({ id, title, steps, tips }) => {
    const open = guideOpen[id] !== undefined ? guideOpen[id] : settings.guidesExpanded !== false;
    return (
      <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 18, overflow: "hidden", marginTop: 4 }}>
        <button
          onClick={() => setGuideOpen({ ...guideOpen, [id]: !open })}
          style={{ width: "100%", padding: "13px 16px", border: "none", background: "transparent", color: T.ink, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left" }}>
          <span>📖 How to use {title}</span>
          <span style={{ color: T.muted, fontSize: 12, flexShrink: 0 }}>{open ? "▲ hide" : "▼ show"}</span>
        </button>
        {open && (
          <div style={{ padding: "0 16px 14px" }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${T.border}` }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background: T.primary, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{s[0]}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.45 }}>{s[1]}</div>
                </div>
              </div>
            ))}
            {(tips || []).map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0 0", fontSize: 11.5, color: T.muted, lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0 }}>💡</span><div>{t}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: "price", label: "Price it" },
    { id: "products", label: `Inventory${products.length ? ` · ${products.length}` : ""}` },
    { id: "orders", label: `Orders${orders.length ? ` · ${orders.length}` : ""}` },
    { id: "settings", label: "Set-up" },
  ];
  const rateStamp = settings.liveRateAt ? new Date(settings.liveRateAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.bg} 0%, ${T.bg2} 100%)`, color: T.ink, fontFamily: "'Quicksand', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html, body { overflow-x: hidden; }
        input::placeholder { color: ${T.pink}; font-weight: 500; }
        input:focus, select:focus { border-color: ${T.accent} !important; }
        button:active { transform: scale(.98); }
        select { appearance: none; }
        /* iOS gives inputs an intrinsic width that blows out flex and grid rows */
        input, select, textarea { min-width: 0; max-width: 100%; }
        input[type="date"] { -webkit-appearance: none; appearance: none; }
        input[type="color"] { flex-shrink: 0; }
        button { max-width: 100%; }
        @media (prefers-reduced-motion: reduce){ *{transition:none!important} }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 60px", overflowX: "hidden" }}>
        <datalist id="zp-shops">{memShops.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="zp-locations">{memLocations.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="zp-customers">{memCustomers.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="zp-products">{memProducts.map((v) => <option key={v} value={v} />)}</datalist>

        <header style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <ZenLogo size={46} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 600, color: T.primary, lineHeight: 1.05 }}>Zen Pasabuy</div>
              <div style={{ fontSize: 12, color: T.muted, letterSpacing: "0.06em" }}>calm decisions, clear profits</div>
            </div>
          </div>
        </header>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 700 }}>
            ¥1 = ₱{Number(rate).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}
            <span style={{ color: T.muted, fontWeight: 500 }}> · {settings.rateMode === "live" && settings.liveRate ? `live${rateStamp ? " · " + rateStamp : ""}` : "your rate"}</span>
          </div>
          <button onClick={() => refreshRate(false)} disabled={rateBusy} style={{ ...ghostBtn, padding: "6px 12px", fontSize: 12, color: T.accent, borderColor: T.pink }}>
            {rateBusy ? "fetching…" : "↻ refresh"}
          </button>
          <div style={{ display: "flex", background: T.paper, border: `1.5px solid ${T.border}`, borderRadius: 999, overflow: "hidden" }}>
            {[["jpy", "¥ Yen"], ["php", "₱ Peso"]].map(([v, name]) => (
              <button key={v} onClick={() => setSettings({ ...settings, displayCcy: v })}
                style={{ padding: "6px 12px", border: "none", background: (settings.displayCcy || "jpy") === v ? T.primary : "transparent", color: (settings.displayCcy || "jpy") === v ? "#fff" : T.muted, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {!online && (
          <div style={{ ...card, background: T.soft, borderColor: T.pink, fontSize: 12.5, marginBottom: 14, padding: "10px 14px", textAlign: "center" }}>
            📴 Offline — everything still works and saves on this device. The exchange rate will refresh when you're back online.
          </div>
        )}

        {backupDue && (
          <div style={{ ...card, borderLeft: `5px solid ${T.accent}`, fontSize: 12.5, marginBottom: 14, padding: "12px 14px" }}>
            <b style={{ color: T.accent }}>Time for a backup 🌸</b>
            <div style={{ color: T.muted, marginTop: 3 }}>
              Last backup: {lastBackupLabel}{daysSinceBackup !== null ? ` · ${daysSinceBackup} day(s) ago` : ""}. Your data lives only on this device — clearing your browser would erase it.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={exportJSON} style={{ ...primaryBtn, flex: 1, padding: 10, fontSize: 13 }}>⬇ Back up now</button>
              <button onClick={() => setSettings({ ...settings, lastBackup: new Date().toISOString() })} style={{ ...ghostBtn, color: T.muted }}>Remind me later</button>
            </div>
          </div>
        )}

        {storageWarn && (
          <div style={{ ...card, background: "#fff8e6", borderColor: "#eedaa0", fontSize: 12.5, marginBottom: 14 }}>
            ⚠️ Saving is struggling — likely too many photos. Export a JSON backup now, then remove a few photos to free space.
          </div>
        )}

        <nav style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "products") setPageId(null); }} style={{ flex: 1, padding: "10px 2px", borderRadius: 999, border: `1.5px solid ${tab === t.id ? T.primary : T.border}`, background: tab === t.id ? T.primary : T.paper, color: tab === t.id ? "#fff" : T.ink, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 11.5, cursor: "pointer", transition: "all .15s" }}>
              {t.label}
            </button>
          ))}
        </nav>

        {/* ══════════ PRICE IT ══════════ */}
        {tab === "price" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <span style={label}>What are you logging?</span>
              <select value={pTarget} onChange={(e) => {
                const v = e.target.value;
                if (v === "new") { setPTarget("new"); setPName(""); setPStore(""); setPTotalJpy(""); setPQty("1"); setPDate(today()); setPPhoto(null); }
                else startRestock(v);
              }} style={{ ...inputStyle, fontSize: 14 }}>
                <option value="new">✨ A new product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>↻ Restock: {p.name} ({productStock(p)} left)</option>
                ))}
              </select>
              {restockProduct && (() => {
                const lot = latestLot(restockProduct);
                const changed = [];
                if (lot) {
                  if ((pStore || "") !== (lot.store || "")) changed.push("shop");
                  if (Math.round(parseFloat(pTotalJpy) || 0) !== Math.round(lot.totalJpy || 0)) changed.push("price");
                  if ((parseInt(pQty) || 0) !== (lot.qty || 0)) changed.push("quantity");
                }
                return (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: T.soft, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Thumb p={restockProduct} size={42} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{restockProduct.name}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>
                          {productStock(restockProduct)} in stock · sells at {M(restockProduct.list)}
                        </div>
                      </div>
                    </div>
                    {lot && (
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>
                        Filled in from your last purchase on <b>{lot.date}</b>: {lot.store || "no shop"} · {yen(lot.totalJpy)} for {lot.qty} pc(s) ({yen(lot.unitJpy)}/pc).
                        Check the fields below and change anything that's different this time.
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, marginTop: 6, fontWeight: 700, color: changed.length ? T.accent : T.muted }}>
                      {changed.length ? `Changed this time: ${changed.join(", ")}` : "Same as last time — edit below if that's not right."}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {!restockProduct && (
                  <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Product name (e.g., Tokyo Banana 8pc)" list="zp-products" style={inputStyle} />
                )}
                <input value={pStore} onChange={(e) => setPStore(e.target.value)} placeholder="Shop (e.g., Don Quijote Shibuya)" list="zp-shops" style={inputStyle} />
                <div>
                  <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Date bought</span>
                  <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} style={{ ...inputStyle, fontSize: 13.5, width: "100%", display: "block" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ width: 54, height: 54, borderRadius: 12, background: T.soft, border: `1px dashed ${T.pink}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {pPhoto ? <img src={pPhoto} alt="product" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : restockProduct?.photo ? <img src={restockProduct.photo} alt="product" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📷"}
                  </div>
                  <button onClick={() => newPhotoRef.current?.click()} style={{ ...ghostBtn, color: T.accent, flex: "1 1 140px", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pPhoto ? "Change photo" : restockProduct?.photo ? "Replace product photo" : "+ Add a product photo"}
                  </button>
                  {pPhoto && <button onClick={() => setPPhoto(null)} style={{ ...ghostBtn, color: T.pink }}>✕</button>}
                  <input ref={newPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) attachNewPhoto(f); e.target.value = ""; }} />
                </div>
              </div>
            </div>

            <div style={card}>
              <span style={label}>What you're paying</span>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr minmax(0, 0.6fr)", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: T.accent, fontWeight: 700 }}>¥</span>
                  <input type="number" inputMode="decimal" value={pTotalJpy} onChange={(e) => setPTotalJpy(e.target.value)} placeholder="Total price" style={{ ...inputStyle, paddingLeft: 34, fontSize: 18 }} />
                </div>
                <input type="number" inputMode="numeric" min="1" value={pQty} onChange={(e) => setPQty(e.target.value)} placeholder="Qty" style={{ ...inputStyle, textAlign: "center", fontSize: 18 }} />
              </div>
              {totalJpyNum > 0 && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.muted }}>
                  {qtyNum > 1 ? (<>Wholesale: <b style={{ color: T.primary }}>{yen(unitJpy)}</b> per piece · {M(unitJpy * rate)} landed each</>) : (<>= <b style={{ color: T.primary }}>{M(totalJpyNum * rate)}</b> landed</>)}
                  {" "}· buffer {settings.buffer}% · haggle {settings.negotiation}%
                </div>
              )}
            </div>

            <div style={card}>
              <span style={label}>Tier — how special is it?</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {settings.tiers.map((t) => (
                  <Chip key={t.id} active={tierId === t.id} onClick={() => setTierId(t.id)} title={t.name} sub={`+${t.margin}%`} />
                ))}
              </div>
              {tier && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>{tier.desc}</div>}
            </div>

            <div style={card}>
              <span style={label}>Sourcing — how will you get it?</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {settings.sourcing.map((s) => (
                  <Chip key={s.id} active={sourceId === s.id} onClick={() => setSourceId(s.id)} title={s.name} sub={`+${yen(s.feeJpy)}`} />
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>
                {source.note} · adds {yen(source.feeJpy)} ({M(feePhp(source))}) per piece
              </div>
            </div>

            <div style={card}>
              <span style={label}>Shipping — how much box space?</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {shipClasses.map((s) => (
                  <Chip key={s.id} active={shipId === s.id} onClick={() => setShipId(s.id)} title={s.name} sub={s.feeJpy > 0 ? `+${yen(s.feeJpy)}` : "free"} />
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>
                {shipClass?.note}
                {shipClass?.feeJpy > 0
                  ? <> · adds {yen(shipClass.feeJpy)} ({M(shipPhp(shipClass))}) per piece</>
                  : <> · nothing added for the box</>}
              </div>
            </div>

            {result ? (
              <>
                <div style={{ background: T.paper, border: `1.5px solid ${T.pink}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
                  <div style={{ background: `linear-gradient(120deg, ${T.primary}, ${T.accent})`, padding: "16px 18px 18px", color: "#fff", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.85 }}>Quote per piece</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 48, fontWeight: 600, lineHeight: 1.05 }}>{M(result.list)}</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, opacity: 0.9, marginTop: -2 }}>{M2(result.list)}</div>
                    <div style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 12.5, opacity: 0.92, marginTop: 6 }}>
                      Never go below <b style={{ fontSize: 15 }}>{M(result.floor)}</b> <span style={{ opacity: 0.85 }}>({M2(result.floor)})</span> · {tier.name} · {source.name}
                    </div>
                  </div>
                  <div style={{ borderTop: `2px dashed ${T.border}`, margin: "0 14px" }} />
                  <div style={{ padding: "12px 18px 16px" }}>
                    <TagRow name={qtyNum > 1 ? `Unit cost (${qtyNum} pcs bought)` : "Landed cost"} php={result.landed} />
                    <TagRow name="Buffer" php={result.bufferAmt} />
                    <TagRow name={`Logistics & effort (${yen(source.feeJpy)})`} php={result.fee} />
                    {result.ship > 0 && <TagRow name={`Box share — ${shipClass.name} (${yen(shipClass.feeJpy)})`} php={result.ship} />}
                    <TagRow name="True cost per piece" php={result.trueCost} strong />
                    <div style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0" }} />
                    <TagRow name="Profit per piece at quote" php={result.profitAtList} strong />
                    {qtyNum > 1 && <TagRow name={`Whole batch profit (×${qtyNum})`} php={result.profitAtList * qtyNum} />}
                  </div>
                </div>
                {/* collapsible: show your work */}
                <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <button onClick={() => setShowMath(!showMath)} style={{ width: "100%", padding: "13px 16px", border: "none", background: "transparent", color: T.ink, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🧮 {showMath ? "Hide" : "Show"} the computation</span>
                    <span style={{ color: T.muted, fontSize: 12 }}>{showMath ? "▲" : "▼"}</span>
                  </button>
                  {showMath && (() => {
                    const Step = ({ n, title, formula, value, note }) => (
                      <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                          <span style={{ width: 20, height: 20, borderRadius: 999, background: T.primary, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5 }}>{title}</div>
                            <code style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 3, wordBreak: "break-word", fontFamily: "ui-monospace, Menlo, monospace" }}>{formula}</code>
                            {note && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{note}</div>}
                          </div>
                          <b style={{ color: T.primary, fontSize: 13, whiteSpace: "nowrap" }}>{value}</b>
                        </div>
                      </div>
                    );
                    const r4 = Number(rate).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
                    return (
                      <div style={{ paddingBottom: 8 }}>
                        {qtyNum > 1 && (
                          <Step n="0" title="Wholesale → per piece"
                            formula={`${yen(totalJpyNum)} ÷ ${qtyNum} pcs = ${yen(unitJpy)}`}
                            value={yen(unitJpy)} />
                        )}
                        <Step n={qtyNum > 1 ? "1" : "1"} title="Convert to pesos"
                          formula={`${yen(unitJpy)} × ₱${r4} = ${M(result.landed)}`}
                          value={M(result.landed)}
                          note={settings.rateMode === "live" && settings.liveRate ? "live market rate" : "your saved rate"} />
                        <Step n="2" title={`Buffer (${settings.buffer}%)`}
                          formula={`${M(result.landed)} × ${settings.buffer}% = ${M(result.bufferAmt)}`}
                          value={M(result.bufferAmt)}
                          note="covers rate swings, packaging, small extras" />
                        <Step n="3" title={`Logistics & effort — ${source.name}`}
                          formula={`${yen(source.feeJpy)} × ₱${r4} = ${M(result.fee)}`}
                          value={M(result.fee)}
                          note="train fare + time, per piece" />
                        <Step n="4" title={`Box share — ${shipClass?.name || "shipping"}`}
                          formula={result.ship > 0 ? `${yen(shipClass.feeJpy)} × ₱${r4} = ${M(result.ship)}` : "no box cost for this size"}
                          value={M(result.ship)}
                          note={`this size takes about ${shipClass?.liters || 0} L of the balikbayan box`} />
                        <Step n="5" title="Your true cost per piece"
                          formula={`${M(result.landed)} + ${M(result.bufferAmt)} + ${M(result.fee)} + ${M(result.ship)} = ${M(result.trueCost)}`}
                          value={M(result.trueCost)}
                          note="break-even — selling below this loses money" />
                        <Step n="6" title={`Floor price — ${tier.name} tier (+${tier.margin}%)`}
                          formula={`${M(result.trueCost)} × ${(1 + tier.margin / 100).toFixed(2)} = ${M(result.trueCost * (1 + tier.margin / 100))} → rounded up to ${M(result.floor)}`}
                          value={M(result.floor)}
                          note="rounded up to the nearest ₱5 — the lowest you should ever agree to" />
                        <Step n="7" title={`Quote price (+${settings.negotiation}% haggle room)`}
                          formula={`${M(result.floor)} × ${(1 + settings.negotiation / 100).toFixed(2)} = ${M(result.floor * (1 + settings.negotiation / 100))} → rounded up to ${M(result.list)}`}
                          value={M(result.list)}
                          note="rounded up to the nearest ₱10 — what you tell the customer" />
                        <Step n="8" title="Profit check"
                          formula={`${M(result.list)} − ${M(result.trueCost)} = ${M(result.profitAtList)} (${pct((result.profitAtList / result.trueCost) * 100)} of cost)`}
                          value={`+${M(result.profitAtList)}`}
                          note={`if haggled down to the floor: +${M(result.profitAtFloor)}${qtyNum > 1 ? ` · whole batch: +${M(result.profitAtList * qtyNum)}` : ""}`} />
                        <div style={{ padding: "10px 16px", fontSize: 11, color: T.muted, borderTop: `1px solid ${T.border}` }}>
                          Every percentage above is editable in <b>Set-up</b> — buffer, haggle room, tier margins, sourcing fees, and shipping sizes.
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {restockProduct && (
                  <div style={{ ...card, borderLeft: `4px solid ${T.accent}` }}>
                    <span style={{ ...label, fontSize: 9.5 }}>Check before restocking</span>
                    {[
                      ["Product", restockProduct.name],
                      ["Shop", pStore.trim() || "—"],
                      ["Date bought", pDate || today()],
                      ["Buying", `${qtyNum} pc(s) for ${yen(totalJpyNum)}${qtyNum > 1 ? ` · ${yen(unitJpy)}/pc` : ""}`],
                      ["Cost per piece", `${M(result.trueCost)} · ${tier.name} · ${source.name}`],
                      ["Selling price", `${M(result.list)}${Math.round(result.list) !== Math.round(restockProduct.list) ? ` (was ${M(restockProduct.list)})` : ""}`],
                      ["Stock after", `${productStock(restockProduct) + qtyNum} pc(s)`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", fontSize: 12.5, borderBottom: `1px solid ${T.border}` }}>
                        <span style={{ color: T.muted }}>{k}</span>
                        <b style={{ textAlign: "right" }}>{v}</b>
                      </div>
                    ))}
                    {Math.round(result.list) !== Math.round(restockProduct.list) && (
                      <div style={{ fontSize: 11.5, color: T.accent, fontWeight: 700, marginTop: 8 }}>
                        Saving updates this product's selling price to {M(result.list)}. Older batches keep the cost they were bought at.
                      </div>
                    )}
                  </div>
                )}

                <button onClick={saveProduct} style={primaryBtn}>
                  {restockProduct ? `Confirm restock · +${qtyNum} pc(s) of ${restockProduct.name}` : `Save product · ${qtyNum} pc(s) in stock`}
                </button>
              </>
            ) : (
              <div style={{ ...card, textAlign: "center", color: T.muted, fontSize: 13.5, background: T.soft }}>
                Type the total ¥ price and quantity — wholesale per-piece cost, quote, and stock are all recorded together.
              </div>
            )}

            <Guide id="price" title="Price it"
              steps={[
                ["Say what you're logging", "Leave it on “A new product” for a first-time find, or pick “Restock” to buy more of something you already sell — restocking fills in the shop, price and quantity from your last purchase so you only change what's different."],
                ["Fill in the shop and the date", "Both are remembered for the batch, so later you can see exactly where and when each piece came from."],
                ["Type the total ¥ you're paying and how many pieces", "Type what the till says, not the per-piece price. If you buy 6 for ¥1,200, type 1200 and 6 — the per-piece cost is worked out for you."],
                ["Pick the tier", "How hard was this to get hold of? Everyday items earn a small margin, hunted-down and limited items earn more."],
                ["Pick how you sourced it", "This adds a ¥ fee per piece for train fare and your time — an online order costs you far less effort than a full day of store-hopping."],
                ["Pick the shipping size", "How much balikbayan box space one piece takes. This adds that piece's share of the box cost, so freight is already inside the price you quote."],
                ["Read the quote", "The big number is what you tell the customer. The smaller “never go below” number is your floor — the lowest you should agree to after haggling."],
                ["Open the computation if you want to check it", "Tap “Show the computation” to see every step, from yen to the final peso price."],
                ["Save it", "The product lands in Inventory with its stock count. If a customer already pre-ordered it, that order is filled automatically."],
              ]}
              tips={[
                "Every percentage and fee here — buffer, haggle room, tiers, sourcing, shipping sizes — is yours to change in Set-up.",
                "Quoting a price you already know is fine: type it into the order line instead. This page is for working out what the price should be.",
              ]} />
          </div>
        )}

        {/* ══════════ PRODUCT PAGE ══════════ */}
        {tab === "products" && pageProduct && (() => {
          const stock = productStock(pageProduct);
          const bought = productBought(pageProduct);
          const sold = bought - stock;
          const avgCost = productAvgCost(pageProduct);
          const unitProfit = pageProduct.list - avgCost;
          const soldRevenue = pageSales.reduce((a, s) => a + s.revenue, 0);
          const soldProfit = pageSales.reduce((a, s) => a + s.profit, 0);
          const lots = [...(pageProduct.lots || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
          const shops = [...new Set(lots.map((l) => l.store).filter(Boolean))];
          return (
            <div style={{ display: "grid", gap: 14 }}>
              <button onClick={() => setPageId(null)} style={{ ...ghostBtn, alignSelf: "start", width: "fit-content", color: T.accent }}>← Back to inventory</button>

              <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                <div style={{ height: 200, background: T.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative" }}>
                  {pageProduct.photo ? <img src={pageProduct.photo} alt={pageProduct.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ZenLogo size={92} />}
                  <button onClick={() => pagePhotoRef.current?.click()} style={{ ...ghostBtn, position: "absolute", bottom: 10, right: 10, fontSize: 11.5, background: "rgba(255,255,255,0.92)" }}>
                    📷 {pageProduct.photo ? "Change" : "Add photo"}
                  </button>
                  <input ref={pagePhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setProductPhoto(pageProduct.id, f); e.target.value = ""; }} />
                </div>
                <div style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: T.primary, lineHeight: 1.1 }}>{pageProduct.name}</div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{pageProduct.tierName} · {shops.length ? shops.join(", ") : "shop not recorded"}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>bought {lots.map((l) => l.date).join(", ")}</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: stock === 0 ? T.pink : T.good, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: 999, background: T.soft, border: `1px solid ${T.border}` }}>
                      {stock === 0 ? "SOLD OUT" : `${stock} in stock`}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <StatBox title="Selling price" php={pageProduct.list} sub={`floor ${M(pageProduct.floor)}`} />
                <StatBox title="Avg cost / pc" php={avgCost} sub="landed + buffer + effort" />
                <StatBox title="Profit margin" php={unitProfit} raw={<span style={{ color: unitProfit < 0 ? DANGER : T.primary }}>{signedM(unitProfit)}</span>} sub={`${pct(avgCost > 0 ? (unitProfit / avgCost) * 100 : NaN)} per piece at quote`} />
                <StatBox title="Inventory" raw={`${stock} / ${bought}`} sub={`${sold} sold so far`} />
              </div>

              <div style={card}>
                <span style={label}>Total sold</span>
                {sold === 0 ? (
                  <div style={{ fontSize: 13, color: T.muted }}>No pieces sold yet — it's waiting for its person.</div>
                ) : (
                  <div style={{ fontSize: 13.5 }}>
                    <b style={{ color: T.primary }}>{sold} pc(s)</b>
                    <span style={{ color: T.muted }}> · revenue </span>
                    <b style={{ color: T.primary }}>{M(soldRevenue)}</b>
                    <span style={{ color: T.muted }}> ({M2(soldRevenue)}) · profit </span>
                    <b style={{ color: soldProfit < 0 ? DANGER : T.good }}>{signedM(soldProfit)}</b>
                  </div>
                )}
              </div>

              <div style={card}>
                <span style={label}>Purchase batches — oldest sells first</span>
                {lots.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
                    <div>
                      <b>{l.date}</b>{l.store ? <span style={{ color: T.muted }}> · {l.store}</span> : ""}
                      <div style={{ color: T.muted, fontSize: 11 }}>{yen(l.unitJpy)}/pc · cost {M(l.unitCost)}/pc · {yen(l.totalJpy)} total</div>
                    </div>
                    <b style={{ color: l.remaining ? T.good : T.pink, flexShrink: 0 }}>{l.remaining}/{l.qty} left</b>
                  </div>
                ))}
                <button onClick={() => { startRestock(pageProduct.id); setTab("price"); }} style={{ ...dashedBtn, width: "100%", marginTop: 10 }}>↻ Restock this product</button>
              </div>

              <div style={card}>
                <span style={label}>Inventory history</span>
                {pageHistory.length === 0 && <div style={{ fontSize: 13, color: T.muted }}>Nothing yet.</div>}
                {pageHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
                    <div>
                      <b style={{ color: h.type === "buy" ? T.accent : T.good }}>{h.type === "buy" ? `+${h.qty} bought` : `−${h.qty} sold`}</b>
                      <span style={{ color: T.muted }}> · {h.type === "buy" ? h.label : `to ${h.label}`}</span>
                      <div style={{ color: T.muted, fontSize: 11 }}>{h.date}</div>
                    </div>
                    <span style={{ color: T.muted, flexShrink: 0, fontWeight: 700 }}>{h.type === "buy" ? `−${M(h.php)}` : `+${M(h.php)}`}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => removeProduct(pageProduct.id)} style={{ ...ghostBtn, color: T.pink }}>Delete this product</button>

              <Guide id="product" title="this product page"
                steps={[
                  ["Check the numbers at the top", "Stock on hand, what's been sold, your average cost per piece, and the profit each remaining piece carries."],
                  ["Look through the purchase batches", "Every time you bought this item is kept separately with its own date, shop, quantity and cost — that's how the app keeps old and new prices apart."],
                  ["Add or change the photo", "A photo makes the product much faster to spot in a long list and travels with your backup."],
                  ["Restock this product", "The button jumps to Price it with the last purchase already filled in, so you only correct what changed."],
                  ["Read the inventory history", "Purchases and sales in order, so you can trace where every piece went."],
                ]}
                tips={[
                  "Deleting a product doesn't rewrite past orders — those keep the numbers they were saved with.",
                ]} />
            </div>
          );
        })()}

        {/* ══════════ INVENTORY LIST ══════════ */}
        {tab === "products" && !pageProduct && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <StatBox title="Stock value" php={invStats.stockValue} sub={`${invStats.pieces} pc(s) on hand`} />
              <StatBox title="Potential" php={invStats.potential} sub="if stock sells at quote" />
              <StatBox title="Sold" raw={invStats.sold} sub="pieces moved" />
            </div>

            {/* search */}
            <input value={invSearch} onChange={(e) => setInvSearch(e.target.value)} placeholder="🔍 Search products or shops…" style={inputStyle} />

            {(allShops.length > 0 || hasUnshopped) && (
              <div>
                <span style={{ ...label, fontSize: 9.5 }}>Filter by shop</span>
                <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                  <option value="all">🏬 All shops ({products.length})</option>
                  {allShops.map((sh) => {
                    const n = products.filter((p) => (p.lots || []).some((l) => (l.store || "").trim() === sh)).length;
                    return <option key={sh} value={sh}>{sh} ({n})</option>;
                  })}
                  {hasUnshopped && <option value="— no shop —">— no shop recorded —</option>}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", background: T.paper, border: `1.5px solid ${T.border}`, borderRadius: 999, overflow: "hidden" }}>
                {[["cards", "Cards"], ["sheet", "Sheet"]].map(([v, name]) => (
                  <button key={v} onClick={() => setInvView(v)}
                    style={{ padding: "8px 16px", border: "none", background: invView === v ? T.primary : "transparent", color: invView === v ? "#fff" : T.muted, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                    {name}
                  </button>
                ))}
              </div>
              <button onClick={exportInventoryXLSX} style={{ ...ghostBtn, color: T.accent }} disabled={!products.length}>⬇ Excel</button>
              <button onClick={exportJSON} style={{ ...ghostBtn, color: T.accent }}>⬇ Backup (with photos)</button>
              <button onClick={() => backupRef.current?.click()} style={{ ...ghostBtn, color: T.accent }}>⬆ Import</button>
              <input ref={backupRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
            </div>

            {products.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: T.muted, fontSize: 13.5 }}>
                No inventory yet. Log a purchase in <b>Price it</b> — photo, shop, date bought, and quantity all get recorded, and stock counts down as customers order.
              </div>
            )}
            {products.length > 0 && visibleProducts.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: T.muted, fontSize: 13.5 }}>
                No products match {invSearch ? `"${invSearch}"` : "this filter"}{shopFilter !== "all" ? ` in ${shopFilter}` : ""}.
              </div>
            )}

            {invView === "sheet" && visibleProducts.length > 0 && (() => {
              const rows = visibleProducts.map((p) => {
                const stock = productStock(p);
                const bought = productBought(p);
                const cost = productAvgCost(p);
                const profit = p.list - cost;
                return { p, stock, bought, sold: bought - stock, cost, profit, margin: cost > 0 ? (profit / cost) * 100 : NaN, value: stock * cost };
              });
              const tv = rows.reduce((a, r) => a + r.value, 0);
              const tp = rows.reduce((a, r) => a + r.profit * r.stock, 0);
              const cellH = { padding: "9px 10px", fontFamily: "'Quicksand', sans-serif", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" };
              const cell = { padding: "8px 10px", whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}` };
              return (
                <div style={{ ...card, padding: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: T.primary, color: "#fff" }}>
                        <th style={{ ...cellH, textAlign: "left", position: "sticky", left: 0, background: T.primary, zIndex: 2 }}>Product</th>
                        {["Shop", "Stock", "Bought", "Sold", "Cost/pc", "Sell/pc", "Profit/pc", "Margin", "Result", "Stock value"].map((h, k) => (
                          <th key={h} style={{ ...cellH, textAlign: k < 1 ? "left" : "right" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const shops = [...new Set((r.p.lots || []).map((l) => l.store).filter(Boolean))];
                        const bg = idx % 2 ? T.soft : T.paper;
                        const pc = r.profit < 0 ? DANGER : T.good;
                        return (
                          <tr key={r.p.id} onClick={() => setPageId(r.p.id)} style={{ background: bg, cursor: "pointer" }}>
                            <td style={{ ...cell, fontWeight: 700, position: "sticky", left: 0, background: bg, zIndex: 1 }}>{r.p.name}</td>
                            <td style={{ ...cell, color: T.muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{shops.join(", ") || "—"}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: r.stock === 0 ? T.pink : T.ink }}>{r.stock}</td>
                            <td style={{ ...cell, textAlign: "right", color: T.muted }}>{r.bought}</td>
                            <td style={{ ...cell, textAlign: "right", color: T.muted }}>{r.sold}</td>
                            <td style={{ ...cell, textAlign: "right" }}>{M(r.cost)}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: T.primary }}>{M(r.p.list)}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: pc }}>{signedM(r.profit)}</td>
                            <td style={{ ...cell, textAlign: "right", color: pc }}>{pct(r.margin)}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: pc }}>{r.profit < 0 ? "LOSS" : "Profit"}</td>
                            <td style={{ ...cell, textAlign: "right" }}>{M(r.value)}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: T.bg, borderTop: `2px solid ${T.primary}` }}>
                        <td style={{ ...cell, fontWeight: 700, position: "sticky", left: 0, background: T.bg }}>Totals · {rows.length}</td>
                        <td style={cell} colSpan={6} />
                        <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: tp < 0 ? DANGER : T.good }}>{signedM(tp)}</td>
                        <td style={cell} colSpan={2} />
                        <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{M(tv)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {invView === "cards" && visibleProducts.map((p) => {
              const stock = productStock(p);
              const bought = productBought(p);
              const lots = [...(p.lots || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
              return (
                <div key={p.id} onClick={() => setPageId(p.id)} style={{ ...card, borderLeft: `4px solid ${stock === 0 ? T.pink : T.good}`, cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Thumb p={p} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {p.name}
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: stock === 0 ? T.pink : T.good }}>
                          {stock === 0 ? "SOLD OUT" : `${stock} of ${bought} left`}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
                        sell {M(p.list)} ({M2(p.list)})/pc · {p.tierName}{bought - stock > 0 ? ` · ${bought - stock} sold` : ""}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
                        {lots.length} batch{lots.length > 1 ? "es" : ""} · first bought {lots[0]?.date} · tap for product page →
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Guide id="inventory" title="Inventory"
              steps={[
                ["Read the three boxes on top", "Stock value is what your unsold pieces cost you. Potential is what they'd bring in if they all sold at your quote. Sold counts pieces that have left."],
                ["Search or filter", "Type a product or shop name in the search box, or narrow the list down to a single shop."],
                ["Switch between Cards and Sheet", "Cards are easy to skim on a phone. Sheet lays everything out in columns — cost, sell price, profit, margin — and scrolls sideways with the product name pinned."],
                ["Tap any product to open its page", "Its page shows every purchase batch, every sale, the photo, and a running history."],
                ["Restock from Price it", "To add more pieces, go to Price it and choose Restock — or use the button on the product's own page."],
                ["Keep a backup", "Excel gives you a readable sheet. Backup (with photos) gives you the full JSON file that can be imported into another phone."],
              ]}
              tips={[
                "Stock counts fall by themselves as orders are dispatched — the oldest batch always sells first, so your costs stay honest.",
                "A product showing SOLD OUT still keeps its whole history; it just has nothing left on the shelf.",
              ]} />
          </div>
        )}

        {/* ══════════ ORDERS ══════════ */}
        {tab === "orders" && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* period */}
            <div style={{ display: "flex", gap: 8 }}>
              <Chip active={period === "month"} onClick={() => setPeriod("month")} title="This month" sub={monthName(nowYM)} />
              <Chip active={period === "year"} onClick={() => setPeriod("year")} title="This year" sub={nowY} />
              <Chip active={period === "all"} onClick={() => setPeriod("all")} title="All time" sub={`${allStats.count} orders`} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatBox title="Revenue" php={periodStats.revenue} sub={period === "month" ? "this month" : period === "year" ? "this year" : "all time"} />
              <StatBox title="Profit" php={periodStats.profit} sub={`${pct(periodStats.margin)} margin · ${periodStats.units} pc(s)`} />
              <StatBox title="To collect" php={periodStats.uncollected} sub="orders not yet closed" />
              <StatBox title="Orders" raw={periodStats.count} sub={`${phaseCounts.completed} completed`} />
            </div>

            {period !== "month" && monthly.length > 0 && (
              <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: T.primary, color: "#fff" }}>
                      {["Month", "Orders", "Revenue", "Profit"].map((h, i) => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: i === 0 ? "left" : "right", fontFamily: "'Quicksand', sans-serif", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map(([ym, m], idx) => (
                      <tr key={ym} style={{ background: idx % 2 ? T.soft : T.paper }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>{ym === "—" ? "No date" : monthName(ym)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{m.count}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: T.primary }}>{M(m.revenue)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: m.profit < 0 ? DANGER : T.good }}>{signedM(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowDraft(!showDraft)} style={{ ...primaryBtn, flex: 1, padding: 11 }}>
                {showDraft ? "Close form" : "+ Take a customer order"}
              </button>
              <button onClick={exportOrdersXLSX} style={{ ...ghostBtn, color: T.accent }} disabled={!orders.length}>⬇ Excel</button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", background: T.paper, border: `1.5px solid ${T.border}`, borderRadius: 999, overflow: "hidden" }}>
                {[["cards", "Cards"], ["sheet", "Sheet"]].map(([v, name]) => (
                  <button key={v} onClick={() => setOrdView(v)}
                    style={{ padding: "8px 16px", border: "none", background: ordView === v ? T.primary : "transparent", color: ordView === v ? "#fff" : T.muted, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                    {name}
                  </button>
                ))}
              </div>
              {ordView === "sheet" && (
                <span style={{ fontSize: 11, color: T.muted }}>one row per item · tap a row to open the order</span>
              )}
            </div>

            {/* search + phase filter */}
            <input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="🔍 Search customer, location or product…" style={inputStyle} />

            {(allLocations.length > 0 || hasUnlocated) && (
              <div>
                <span style={{ ...label, fontSize: 9.5 }}>Filter by customer location</span>
                <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                  <option value="all">📍 All locations ({periodOrders.length})</option>
                  {allLocations.map((loc) => {
                    const n = periodOrders.filter((o) => (o.location || "").trim() === loc).length;
                    return <option key={loc} value={loc}>{loc} ({n})</option>;
                  })}
                  {hasUnlocated && <option value="— no location —">— no location set —</option>}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "All", T.primary],
                ["sourcing", "Sourcing", PHASE.sourcing.color],
                ["review", "Check prices", PHASE.review.color],
                ["ready", "Ready", PHASE.ready.color],
                ["dispatched", "Dispatched", PHASE.dispatched.color],
                ["completed", "Completed", PHASE.completed.color],
              ].map(([id, name, c]) => (
                <button key={id} onClick={() => setPhaseFilter(id)} style={{ padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${phaseFilter === id ? c : T.border}`, background: phaseFilter === id ? c : T.paper, color: phaseFilter === id ? "#fff" : T.muted, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Quicksand', sans-serif" }}>
                  {name} · {phaseCounts[id]}
                </button>
              ))}
            </div>

            {pendingItems.length > 0 && (
              <div style={{ ...card, borderLeft: `5px solid ${PHASE.sourcing.color}` }}>
                <span style={{ ...label, color: PHASE.sourcing.color }}>Still to buy — {pendingItems.reduce((a, x) => a + x.qty, 0)} pc(s)</span>
                {pendingItems.map((x) => (
                  <div key={x.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", fontSize: 12.5, borderBottom: `1px solid ${T.border}` }}>
                    <span><b>{x.qty}×</b> {x.name}</span>
                    <span style={{ color: T.muted, fontSize: 11.5, textAlign: "right" }}>for {x.customers.join(", ")}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                  Log these in <b>Price it</b> using the same name and the matching orders fill themselves — stock is deducted, prices are set, and the order turns amber so you can check it before dispatch.
                </div>
              </div>
            )}

            {/* new order builder */}
            {showDraft && (
              <div style={{ ...card, border: `1.5px solid ${T.pink}` }}>
                <span style={label}>New order — take it now, buy later</span>
                <div style={{ display: "grid", gap: 8 }}>
                  <input value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} placeholder="Customer name" list="zp-customers" style={inputStyle} />
                  <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Location (e.g., Quezon City)" list="zp-locations" style={inputStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Order date</span>
                      <input type="date" value={draft.orderDate} onChange={(e) => setDraft({ ...draft, orderDate: e.target.value })} style={{ ...inputStyle, fontSize: 13.5, width: "100%", display: "block" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Expected arrival</span>
                      <input type="date" value={draft.eta} onChange={(e) => setDraft({ ...draft, eta: e.target.value })} style={{ ...inputStyle, fontSize: 13.5, width: "100%", display: "block" }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: T.soft, border: `1px solid ${T.border}` }}>
                  <span style={{ ...label, fontSize: 9.5 }}>Add an item</span>
                  <select value={lineProdId} onChange={(e) => setLineProdId(e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                    <option value="custom">✏️ To buy — not in inventory yet</option>
                    {products.map((p) => {
                      const avail = draftAvail(p);
                      return (
                        <option key={p.id} value={p.id} disabled={avail <= 0}>
                          📦 {p.name} — {avail <= 0 ? "sold out" : `${avail} in stock`} · {M(p.floor)}–{M(p.list)}
                        </option>
                      );
                    })}
                  </select>
                  {lineProduct && (() => {
                    const q = Math.max(1, parseInt(lineQty) || 1);
                    const { allocs, short } = allocateFIFO(lineProduct, q, draftUsedFor(lineProduct.id));
                    const cpp = allocs.length ? allocs.reduce((a, x) => a + x.unitCost * x.qty, 0) / allocs.reduce((a, x) => a + x.qty, 0) : productAvgCost(lineProduct);
                    return (
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
                        <b style={{ color: T.primary }}>Cost/pc {M(cpp)} · {M2(cpp)}</b>
                        {" "}— {short > 0 ? `only ${q - short} pc(s) on hand` : `${draftAvail(lineProduct)} pc(s) on hand`} · oldest batch first · counts as bought
                      </div>
                    );
                  })()}
                  {lineProdId === "custom" && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1.3fr minmax(0, 0.7fr)", gap: 8, marginTop: 8 }}>
                        <input value={lineName} onChange={(e) => setLineName(e.target.value)} placeholder="What are they asking for?" list="zp-products" style={{ ...inputStyle, fontSize: 14 }} />
                        <input disabled value="" placeholder="¥ cost/pc" style={{ ...inputStyle, fontSize: 14, opacity: 0.5, cursor: "not-allowed" }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
                        Just the name is enough. Quantity, cost and price fill in automatically once you buy it and log it in <b>Price it</b>.
                      </div>
                    </>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.6fr) minmax(0, 1fr) minmax(0, 0.9fr)", gap: 8, marginTop: 8, alignItems: "end" }}>
                    <div>
                      <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Qty</span>
                      <input type="number" inputMode="numeric" min="1" disabled={!lineProduct} value={lineProduct ? lineQty : ""} onChange={(e) => setLineQty(e.target.value)} style={{ ...inputStyle, textAlign: "center", fontSize: 14, opacity: lineProduct ? 1 : 0.5, cursor: lineProduct ? "text" : "not-allowed" }} />
                    </div>
                    <div>
                      <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Sell each (₱)</span>
                      <input type="number" inputMode="decimal" disabled={!lineProduct} value={lineProduct ? lineSell : ""} onChange={(e) => setLineSell(e.target.value)} placeholder={lineProduct ? String(lineProduct.list) : "set later"} style={{ ...inputStyle, fontSize: 14, opacity: lineProduct ? 1 : 0.5, cursor: lineProduct ? "text" : "not-allowed" }} />
                    </div>
                    <button onClick={addLine} style={{ ...primaryBtn, padding: 11, fontSize: 13.5 }}>{lineProduct ? "Add item" : "Add request"}</button>
                  </div>
                  {(() => {
                    const sug = lineProduct ? priceSuggestions(lineProduct.floor, lineProduct.list) : null;
                    if (!sug) return null;
                    return (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ ...label, fontSize: 9.5, marginBottom: 4 }}>Suggested price</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {sug.map((x) => {
                            const on = Math.round(parseFloat(lineSell) || 0) === Math.round(x.value);
                            return (
                              <button key={x.key} onClick={() => setLineSell(String(x.value))}
                                style={{ padding: "6px 11px", borderRadius: 999, border: `1.5px solid ${on ? T.primary : T.border}`, background: on ? T.primary : T.paper, color: on ? "#fff" : T.ink, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Quicksand', sans-serif" }}>
                                {x.label} {M(x.value)}
                                <span style={{ opacity: .75, fontWeight: 500 }}> · {x.note}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {lineSell && parseFloat(lineSell) > 0 && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                      Sell each ≈ {M(parseFloat(lineSell))} · {M2(parseFloat(lineSell))}
                    </div>
                  )}
                </div>

                {draft.lines.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {draft.lines.map((l) => {
                      const m = lineMath(l);
                      return (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                              {l.name} × {l.qty}
                              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: l.bought ? PHASE.ready.color : PHASE.sourcing.color }}>
                                {l.bought ? "IN HAND" : "TO BUY"}
                              </span>
                            </div>
                            {l.request ? (
                              <div style={{ fontSize: 11, color: T.muted }}>price and quantity set when you buy it</div>
                            ) : (
                              <div style={{ fontSize: 11, color: T.muted }}>
                                sell {M(l.sell)} ({M2(l.sell)}) each · profit <span style={{ color: m.profit < 0 ? DANGER : T.good, fontWeight: 700 }}>{signedM(m.profit)} ({pct(m.margin)})</span>
                              </div>
                            )}
                          </div>
                          <button onClick={() => setDraft({ ...draft, lines: draft.lines.filter((x) => x.id !== l.id) })} style={{ border: "none", background: "transparent", color: T.pink, fontSize: 15, cursor: "pointer" }}>✕</button>
                        </div>
                      );
                    })}
                    {(() => {
                      const m = orderMath(draft);
                      return (
                        <div style={{ marginTop: 10, fontSize: 13 }}>
                          <b style={{ color: T.primary }}>{m.units} pc(s)</b>
                          <span style={{ color: T.muted }}> · spend {M(m.spent)} · charge </span>
                          <b style={{ color: T.primary }}>{M(m.revenue)}</b>
                          <span style={{ color: T.muted }}> · profit </span>
                          <b style={{ color: m.profit < 0 ? DANGER : T.good }}>{signedM(m.profit)} ({pct(m.margin)})</b>
                        </div>
                      );
                    })()}
                    <button onClick={saveOrder} style={{ ...primaryBtn, width: "100%", marginTop: 12 }}>Save order</button>
                  </div>
                )}
              </div>
            )}

            {visibleOrders.length === 0 && !showDraft && (
              <div style={{ ...card, textAlign: "center", color: T.muted, fontSize: 13.5 }}>
                {orders.length === 0
                  ? <>No customer orders yet. Tap <b>+ Take a customer order</b> — you can take orders before buying anything, then mark items Bought as you source them.</>
                  : <>No orders match this search or filter — try <b>All</b> or clear the search.</>}
              </div>
            )}

            {/* order cards, color-coded by phase */}
            {ordView === "sheet" && visibleOrders.length > 0 && (() => {
              const rows = [];
              visibleOrders.forEach((o) => {
                const ph = PHASE[orderPhase(o)];
                o.lines.forEach((l) => rows.push({ o, l, ph, m: lineMath(l) }));
              });
              const tSpent = rows.reduce((a, r) => a + r.m.spent, 0);
              const tRev = rows.reduce((a, r) => a + r.m.revenue, 0);
              const tProfit = tRev - tSpent;
              const cellH = { padding: "9px 10px", fontFamily: "'Quicksand', sans-serif", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" };
              const cell = { padding: "8px 10px", whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}` };
              return (
                <div style={{ ...card, padding: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 880 }}>
                    <thead>
                      <tr style={{ background: T.primary, color: "#fff" }}>
                        <th style={{ ...cellH, textAlign: "left", position: "sticky", left: 0, background: T.primary, zIndex: 2 }}>Customer</th>
                        {["Location", "Status", "Ordered", "Arriving", "Product", "Qty", "Cost/pc", "Sell/pc", "Revenue", "Profit", "Margin", "Result"].map((h, k) => (
                          <th key={h} style={{ ...cellH, textAlign: k >= 5 && k !== 5 ? "right" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const bg = idx % 2 ? T.soft : T.paper;
                        const pc = r.m.profit < 0 ? DANGER : T.good;
                        const pending = !r.l.bought;
                        return (
                          <tr key={`${r.o.id}-${r.l.id}`} onClick={() => { setOrdView("cards"); setOpenOrder(r.o.id); }} style={{ background: bg, cursor: "pointer" }}>
                            <td style={{ ...cell, fontWeight: 700, position: "sticky", left: 0, background: bg, zIndex: 1 }}>{r.o.customer}</td>
                            <td style={{ ...cell, color: T.muted }}>{r.o.location || "—"}</td>
                            <td style={{ ...cell }}>
                              <span style={{ background: r.ph.color, color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>{r.ph.label}</span>
                            </td>
                            <td style={{ ...cell, color: T.muted }}>{r.o.orderDate}</td>
                            <td style={{ ...cell, color: T.muted }}>{r.o.eta || "—"}</td>
                            <td style={{ ...cell }}>
                              {r.l.name}
                              {pending && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: PHASE.sourcing.color }}>{r.l.request ? "REQUESTED" : "NEEDS STOCK"}</span>}
                            </td>
                            <td style={{ ...cell, textAlign: "right" }}>{r.l.qty}</td>
                            <td style={{ ...cell, textAlign: "right" }}>{pending && r.l.request ? "—" : M(r.l.unitCost)}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: T.primary }}>{pending && r.l.request ? "—" : M(r.l.sell)}</td>
                            <td style={{ ...cell, textAlign: "right" }}>{pending && r.l.request ? "—" : M(r.m.revenue)}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: pc }}>{pending && r.l.request ? "—" : signedM(r.m.profit)}</td>
                            <td style={{ ...cell, textAlign: "right", color: pc }}>{pending && r.l.request ? "—" : pct(r.m.margin)}</td>
                            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: pc }}>{pending && r.l.request ? "pending" : r.m.profit < 0 ? "LOSS" : "Profit"}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: T.bg, borderTop: `2px solid ${T.primary}` }}>
                        <td style={{ ...cell, fontWeight: 700, position: "sticky", left: 0, background: T.bg }}>Totals · {visibleOrders.length} order(s)</td>
                        <td style={cell} colSpan={8} />
                        <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: T.primary }}>{M(tRev)}</td>
                        <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: tProfit < 0 ? DANGER : T.good }}>{signedM(tProfit)}</td>
                        <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: tProfit < 0 ? DANGER : T.good }}>{pct(tSpent > 0 ? (tProfit / tSpent) * 100 : NaN)}</td>
                        <td style={cell} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {ordView === "cards" && visibleOrders.map((o) => {
              const m = orderMath(o);
              const phase = orderPhase(o);
              const ph = PHASE[phase];
              const open = openOrder === o.id;
              const boughtCount = o.lines.filter((l) => l.bought).length;
              return (
                <div key={o.id} style={{ ...card, borderLeft: `5px solid ${ph.color}`, opacity: phase === "completed" ? 0.8 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={() => setOpenOrder(open ? null : o.id)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {o.customer}
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: ph.color, marginLeft: 8, padding: "2px 8px", borderRadius: 999 }}>{ph.label}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>
                        {o.location ? `📍 ${o.location} · ` : ""}
                        {phase === "sourcing" ? `${boughtCount}/${o.lines.length} items bought · ` : ""}
                        {m.units} pc(s) · ordered {o.orderDate}{o.eta ? ` · arriving ${o.eta}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: T.primary, fontSize: 14 }}>{M(m.revenue)}</div>
                      <div style={{ fontSize: 11, color: m.profit < 0 ? DANGER : T.good, fontWeight: 700 }}>{signedM(m.profit)} ({pct(m.margin)})</div>
                    </div>
                  </div>

                  {phase === "review" && (
                    <div style={{ marginTop: 8, padding: "9px 11px", borderRadius: 10, background: "rgba(217,154,43,0.12)", border: `1px solid ${PHASE.review.color}`, fontSize: 11.5 }}>
                      <b style={{ color: PHASE.review.color }}>Everything's bought 🌸</b>
                      <div style={{ color: T.muted, marginTop: 2 }}>
                        Prices were filled in from your inventory. Open the order, check the quantities and prices, then confirm it's ready to dispatch.
                      </div>
                      <button onClick={() => markReviewed(o.id)} style={{ ...primaryBtn, width: "100%", marginTop: 8, padding: 9, fontSize: 12.5, background: PHASE.review.color }}>
                        ✓ Prices checked — ready to dispatch
                      </button>
                    </div>
                  )}

                  {m.profit < 0 && (
                    <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(214,69,69,0.10)", border: `1px solid ${DANGER}`, color: DANGER, fontSize: 11.5, fontWeight: 700 }}>
                      ⚠️ This order loses {M(Math.abs(m.profit))} — open it and raise the selling prices.
                    </div>
                  )}

                  {open && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ borderTop: `2px dashed ${T.border}`, marginBottom: 8 }} />
                      {o.lines.map((l) => {
                        const lm = lineMath(l);
                        return (
                          <div key={l.id} style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <b>
                                {l.name}{l.bought || !l.request ? ` × ${l.qty}` : ""}
                                {!l.bought && (
                                  <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: PHASE.sourcing.color, border: `1px solid ${PHASE.sourcing.color}`, borderRadius: 999, padding: "1px 6px" }}>
                                    {l.request ? "REQUESTED" : "NEEDS STOCK"}
                                  </span>
                                )}
                              </b>
                              {editOrderId === o.id ? (
                                <button onClick={() => removeLineFromOrder(o.id, l.id)} style={{ border: "none", background: "transparent", color: T.pink, fontSize: 15, cursor: "pointer" }}>✕</button>
                              ) : phase !== "completed" ? (
                                <button onClick={() => toggleLineBought(o.id, l.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "none", background: l.bought ? PHASE.ready.color : PHASE.sourcing.color, color: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Quicksand', sans-serif" }}>
                                  {l.bought ? "✓ Bought" : "Mark bought"}
                                </button>
                              ) : (
                                <span style={{ color: T.good, fontWeight: 700, fontSize: 11 }}>✓</span>
                              )}
                            </div>
                            {!l.bought && l.request ? (
                              <div style={{ color: T.muted, fontSize: 11.5, marginTop: 2 }}>
                                Waiting to be bought — price and quantity fill in from inventory.
                              </div>
                            ) : (
                              <div style={{ color: T.muted, fontSize: 11.5, marginTop: 2 }}>
                                cost {M(l.unitCost)} ({M2(l.unitCost)})/pc → sell {M(l.sell)} ({M2(l.sell)})/pc · profit <span style={{ color: lm.profit < 0 ? DANGER : T.good, fontWeight: 700 }}>{signedM(lm.profit)} ({pct(lm.margin)})</span>
                              </div>
                            )}
                            {Array.isArray(l.allocs) && l.allocs.length > 0 && (
                              <div style={{ color: T.muted, fontSize: 11 }}>
                                from batch: {l.allocs.map((a) => `${a.qty} pc (${a.date}${a.store ? " · " + a.store : ""})`).join(", ")}
                              </div>
                            )}
                            {lm.profit < 0 && (
                              <div style={{ color: DANGER, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                                ⚠️ Selling below cost — raise the price by at least {M(Math.abs(lm.profit) / l.qty)} per piece.
                              </div>
                            )}
                            {editOrderId === o.id && !Array.isArray(l.allocs) && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                                <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>Qty</span>
                                <input type="number" inputMode="numeric" min="1" defaultValue={l.qty} onBlur={(e) => setOrderLineQty(o.id, l.id, e.target.value)}
                                  style={{ ...inputStyle, width: 72, padding: "6px 10px", fontSize: 13, textAlign: "center" }} />
                              </div>
                            )}
                            {editOrderId === o.id && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>Sell each ₱</span>
                                <input type="number" inputMode="decimal" defaultValue={Math.round(l.sell)} onBlur={(e) => setLineSellPrice(o.id, l.id, e.target.value)}
                                  style={{ ...inputStyle, width: 96, padding: "6px 10px", fontSize: 13 }} />
                                {(() => {
                                  const p = products.find((x) => x.id === l.productId);
                                  const base = p ? { floor: p.floor, list: p.list } : { floor: roundUp5(l.unitCost * 1.2), list: roundUp10(l.unitCost * 1.35) };
                                  return priceSuggestions(base.floor, base.list).map((x) => (
                                    <button key={x.key} onClick={() => setLineSellPrice(o.id, l.id, x.value)}
                                      style={{ padding: "5px 9px", borderRadius: 999, border: `1.5px solid ${Math.round(l.sell) === Math.round(x.value) ? T.primary : T.border}`, background: Math.round(l.sell) === Math.round(x.value) ? T.primary : T.paper, color: Math.round(l.sell) === Math.round(x.value) ? "#fff" : T.ink, fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Quicksand', sans-serif" }}>
                                      {x.label} {M(x.value)}
                                    </button>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {editOrderId === o.id && (
                        <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: T.soft, border: `1px solid ${T.border}` }}>
                          <span style={{ ...label, fontSize: 9.5 }}>Add another item</span>
                          <select value={eProdId} onChange={(e) => {
                            setEProdId(e.target.value);
                            const p = products.find((x) => x.id === Number(e.target.value));
                            setESell(p ? String(p.list) : "");
                          }} style={{ ...inputStyle, fontSize: 14 }}>
                            <option value="custom">✏️ To buy — not in inventory yet</option>
                            {products.map((p) => {
                              const av = productStock(p);
                              return (
                                <option key={p.id} value={p.id} disabled={av <= 0}>
                                  📦 {p.name} — {av <= 0 ? "sold out" : `${av} in stock`} · {M(p.floor)}–{M(p.list)}
                                </option>
                              );
                            })}
                          </select>
                          {eProdId === "custom" && (
                            <>
                              <div style={{ display: "grid", gridTemplateColumns: "1.3fr minmax(0, 0.7fr)", gap: 8, marginTop: 8 }}>
                                <input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="What are they asking for?" list="zp-products" style={{ ...inputStyle, fontSize: 14 }} />
                                <input disabled value="" placeholder="¥ cost/pc" style={{ ...inputStyle, fontSize: 14, opacity: 0.5, cursor: "not-allowed" }} />
                              </div>
                              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
                                Just the name is enough — the rest fills in when you log it in Price it.
                              </div>
                            </>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.6fr) minmax(0, 1fr) minmax(0, 0.9fr)", gap: 8, marginTop: 8, alignItems: "end" }}>
                            {(() => { const ep = products.find((x) => x.id === Number(eProdId)); return (
                              <>
                                <div>
                                  <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Qty</span>
                                  <input type="number" inputMode="numeric" min="1" disabled={!ep} value={ep ? eQty : ""} onChange={(e) => setEQty(e.target.value)} style={{ ...inputStyle, textAlign: "center", fontSize: 14, opacity: ep ? 1 : 0.5, cursor: ep ? "text" : "not-allowed" }} />
                                </div>
                                <div>
                                  <span style={{ ...label, fontSize: 9.5, marginBottom: 3 }}>Sell each (₱)</span>
                                  <input type="number" inputMode="decimal" disabled={!ep} value={ep ? eSell : ""} onChange={(e) => setESell(e.target.value)} placeholder={ep ? "₱" : "set later"} style={{ ...inputStyle, fontSize: 14, opacity: ep ? 1 : 0.5, cursor: ep ? "text" : "not-allowed" }} />
                                </div>
                                <button onClick={() => addLineToOrder(o.id)} style={{ ...primaryBtn, padding: 11, fontSize: 13.5 }}>{ep ? "Add" : "Add request"}</button>
                              </>
                            ); })()}
                          </div>
                          {(() => {
                            const p = products.find((x) => x.id === Number(eProdId));
                            const sug = p ? priceSuggestions(p.floor, p.list) : null;
                            if (!sug) return null;
                            return (
                              <div style={{ marginTop: 8 }}>
                                <span style={{ ...label, fontSize: 9.5, marginBottom: 4 }}>Suggested price</span>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {sug.map((x) => {
                                    const on = Math.round(parseFloat(eSell) || 0) === Math.round(x.value);
                                    return (
                                      <button key={x.key} onClick={() => setESell(String(x.value))}
                                        style={{ padding: "6px 11px", borderRadius: 999, border: `1.5px solid ${on ? T.primary : T.border}`, background: on ? T.primary : T.paper, color: on ? "#fff" : T.ink, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Quicksand', sans-serif" }}>
                                        {x.label} {M(x.value)}
                                        <span style={{ opacity: .75, fontWeight: 500 }}> · {x.note}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div style={{ marginTop: 8, fontSize: 12.5 }}>
                        <span style={{ color: T.muted }}>Total spent {M(m.spent)} · charge </span>
                        <b style={{ color: T.primary }}>{M(m.revenue)}</b>
                        <span style={{ color: T.muted }}> ({M2(m.revenue)})</span>
                      </div>

                      {/* lifecycle actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {phase === "review" && (
                          <button onClick={() => markReviewed(o.id)} style={{ ...primaryBtn, flex: 1, padding: 10, fontSize: 13, background: PHASE.review.color }}>
                            ✓ Prices checked
                          </button>
                        )}
                        {(phase === "sourcing" || phase === "ready") && (
                          <button onClick={() => dispatchOrder(o.id)} style={{ ...primaryBtn, flex: 1, padding: 10, fontSize: 13, background: PHASE.dispatched.color }}>
                            Mark dispatched 🚚
                          </button>
                        )}
                        {phase === "dispatched" && (
                          <>
                            <button onClick={() => completeOrder(o.id)} style={{ ...primaryBtn, flex: 1, padding: 10, fontSize: 13 }}>
                              Received & paid ✓
                            </button>
                            <button onClick={() => undoDispatch(o.id)} style={{ ...ghostBtn }}>↩ Undo dispatch</button>
                          </>
                        )}
                        {phase === "completed" && (
                          <button onClick={() => reopenOrder(o.id)} style={{ ...ghostBtn, flex: 1 }}>↩ Reopen order</button>
                        )}
                        <button onClick={() => { setEditOrderId(editOrderId === o.id ? null : o.id); setEProdId("custom"); setESell(""); setEName(""); setEJpy(""); setEQty("1"); }}
                          style={{ ...ghostBtn, color: editOrderId === o.id ? T.primary : T.accent, borderColor: editOrderId === o.id ? T.primary : T.border }}>
                          {editOrderId === o.id ? "Done editing" : "✎ Edit items"}
                        </button>
                        <button onClick={() => removeOrder(o.id)} style={{ ...ghostBtn, color: T.pink }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <Guide id="orders" title="Orders"
              steps={[
                ["Choose the period", "This month, this year, or all time — the totals above follow whichever you pick."],
                ["Start a new order", "Type the customer's name and their location, then add what they want, line by line."],
                ["Add items from stock or as pre-orders", "Picking a product from stock reserves the pieces straight away. If you don't have it yet, add it by name only — it waits as a pre-order and fills itself in the moment you log that purchase in Price it."],
                ["Follow the colours", "Red is still sourcing. Amber means everything's bought and prices need a look. Blue is ready to send. Green is dispatched. Grey is received and paid — the order is closed."],
                ["Check prices before dispatching", "At the amber stage you can still edit any line. The Floor / Best / Premium chips show safe prices so you never send something out at a loss."],
                ["Mark it dispatched, then received and paid", "Stock comes off your inventory on dispatch, and profit is counted once the order is closed."],
                ["Search and filter", "Find any order by customer, product or location, and narrow by status when you're chasing what's still open."],
              ]}
              tips={[
                "Any order can still be edited after dispatch or completion if something needs correcting.",
                "A line shown in red is losing money — reprice it before the order goes out.",
              ]} />
          </div>
        )}

        {/* ══════════ SET-UP ══════════ */}
        {tab === "settings" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <span style={label}>Exchange rate — ₱ per ¥1</span>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Chip active={settings.rateMode === "live"} onClick={() => setSettings({ ...settings, rateMode: "live" })} title="Live rate" sub={settings.liveRate ? `₱${settings.liveRate}` : "auto-fetch"} />
                <Chip active={settings.rateMode === "manual"} onClick={() => setSettings({ ...settings, rateMode: "manual" })} title="My own rate" sub={`₱${settings.manualRate}`} />
              </div>
              {settings.rateMode === "live" ? (
                <div>
                  <div style={{ fontSize: 13 }}>
                    {settings.liveRate ? (<>Currently <b style={{ color: T.primary }}>¥1 = ₱{settings.liveRate}</b>{rateStamp && <span style={{ color: T.muted }}> · fetched {rateStamp}</span>}</>) : (<span style={{ color: T.muted }}>No live rate yet — tap refresh below.</span>)}
                  </div>
                  <button onClick={() => refreshRate(false)} disabled={rateBusy} style={{ ...primaryBtn, marginTop: 10, width: "100%", padding: 11 }}>
                    {rateBusy ? "Fetching current rate…" : "↻ Fetch current rate"}
                  </button>
                </div>
              ) : (
                <input type="number" step="0.001" inputMode="decimal" value={settings.manualRate} onChange={(e) => setSettings({ ...settings, manualRate: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              )}
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>
                Live mode fetches the current market rate; My own rate is for when you locked in cash at a money changer.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={card}>
                <span style={label}>Buffer %</span>
                <input type="number" inputMode="decimal" value={settings.buffer} onChange={(e) => setSettings({ ...settings, buffer: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>Rate swings & packaging</div>
              </div>
              <div style={card}>
                <span style={label}>Haggle room %</span>
                <input type="number" inputMode="decimal" value={settings.negotiation} onChange={(e) => setSettings({ ...settings, negotiation: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>Padding above your floor</div>
              </div>
            </div>

            <div style={card}>
              <span style={label}>Your tiers{tiersDirty ? " · unsaved" : ""}</span>
              {(dTiers || []).map((t, i) => (
                <div key={t.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, marginTop: i ? 10 : 4, background: T.soft }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={t.name} onChange={(e) => updTier(i, { name: e.target.value })} placeholder="Tier name" style={{ ...inputStyle, flex: 1, padding: "9px 12px", fontSize: 14 }} />
                    <div style={{ position: "relative" }}>
                      <input type="number" inputMode="decimal" value={t.margin} onChange={(e) => updTier(i, { margin: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 76, padding: "9px 24px 9px 12px", textAlign: "right", fontSize: 14 }} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 12, fontWeight: 700 }}>%</span>
                    </div>
                    <button onClick={() => removeTier(i)} title="Remove tier" style={{ border: "none", background: "transparent", color: T.pink, fontSize: 16, cursor: "pointer" }}>✕</button>
                  </div>
                  <input value={t.desc} onChange={(e) => updTier(i, { desc: e.target.value })} placeholder="When to use this tier" style={{ ...inputStyle, marginTop: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 500 }} />
                </div>
              ))}
              <button onClick={addTier} style={{ ...dashedBtn, width: "100%", marginTop: 10 }}>+ Add a tier</button>
              {tiersDirty && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={saveTiers} style={{ ...primaryBtn, flex: 1, padding: 11, fontSize: 14 }}>Save changes</button>
                  <button onClick={discardTiers} style={{ ...ghostBtn, color: T.muted }}>Discard</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                {tiersDirty ? "Your calculator keeps using the saved tiers until you press Save changes." : "Changes take effect once you save them."}
              </div>
            </div>

            <div style={card}>
              <span style={label}>Logistics & effort fees (¥ per item){sourcingDirty ? " · unsaved" : ""}</span>
              {(dSourcing || []).map((sc, i) => (
                <div key={sc.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, marginTop: i ? 10 : 4, background: T.soft }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={sc.name} onChange={(e) => updSourcing(i, { name: e.target.value })} placeholder="Sourcing type" style={{ ...inputStyle, flex: 1, padding: "9px 12px", fontSize: 14 }} />
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13, fontWeight: 700 }}>¥</span>
                      <input type="number" inputMode="decimal" value={sc.feeJpy} onChange={(e) => updSourcing(i, { feeJpy: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 92, padding: "9px 12px 9px 24px", textAlign: "right", fontSize: 14 }} />
                    </div>
                    <button onClick={() => removeSourcing(i)} title="Remove sourcing type" style={{ border: "none", background: "transparent", color: T.pink, fontSize: 16, cursor: "pointer" }}>✕</button>
                  </div>
                  <input value={sc.note} onChange={(e) => updSourcing(i, { note: e.target.value })} placeholder="When you use it" style={{ ...inputStyle, marginTop: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 500 }} />
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>≈{M(feePhp(sc))} per item at today's rate</div>
                </div>
              ))}
              <button onClick={addSourcing} style={{ ...dashedBtn, width: "100%", marginTop: 10 }}>+ Add a sourcing type</button>
              {sourcingDirty && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={saveSourcing} style={{ ...primaryBtn, flex: 1, padding: 11, fontSize: 14 }}>Save changes</button>
                  <button onClick={discardSourcing} style={{ ...ghostBtn, color: T.muted }}>Discard</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
                Tip: total your train fare for the day in ¥, divide by the items you expect to source, and set that as your bigger-trip fee.
              </div>
            </div>

            {/* ── shipping sizes ── */}
            <div style={card}>
              <span style={label}>Balikbayan box cost{boxDirty ? " · unsaved" : ""}</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ ...label, fontSize: 9, marginBottom: 3 }}>Box cost ¥</span>
                  <input type="number" inputMode="decimal" value={dBox?.costJpy ?? ""} onChange={(e) => setDBox({ ...dBox, costJpy: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, padding: "10px 10px", fontSize: 14 }} />
                </div>
                <div>
                  <span style={{ ...label, fontSize: 9, marginBottom: 3 }}>Capacity L</span>
                  <input type="number" inputMode="decimal" value={dBox?.liters ?? ""} onChange={(e) => setDBox({ ...dBox, liters: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, padding: "10px 10px", fontSize: 14 }} />
                </div>
                <div>
                  <span style={{ ...label, fontSize: 9, marginBottom: 3 }}>Fill %</span>
                  <input type="number" inputMode="decimal" value={dBox?.fillPct ?? ""} onChange={(e) => setDBox({ ...dBox, fillPct: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, padding: "10px 10px", fontSize: 14 }} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
                Everything you pay to get one box to your customer's city — freight, provincial charge, pickup fee, the box itself.
                A jumbo box is about 75 × 55 × 63 cm ≈ 260 L. Fill % is how much of it you realistically pack; the rest is air you still pay for.
              </div>
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`, fontSize: 12.5 }}>
                That works out to <b style={{ color: T.primary }}>{yen(Math.round(yenPerLitre(dBox)))}</b> per litre of box space
                <span style={{ color: T.muted }}> ({M(yenPerLitre(dBox) * rate)} per litre)</span>.
              </div>
            </div>

            <div style={card}>
              <span style={label}>Shipping sizes (¥ per item){shippingDirty ? " · unsaved" : ""}</span>
              {(dShipping || []).map((sh, i) => (
                <div key={sh.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, marginTop: i ? 10 : 4, background: T.soft }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={sh.name} onChange={(e) => updShipping(i, { name: e.target.value })} placeholder="Size name" style={{ ...inputStyle, flex: 1, padding: "9px 12px", fontSize: 14 }} />
                    <div style={{ position: "relative" }}>
                      <input type="number" inputMode="decimal" step="0.5" value={sh.liters ?? 0} onChange={(e) => updShipping(i, { liters: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 74, padding: "9px 22px 9px 10px", textAlign: "right", fontSize: 14 }} />
                      <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 12, fontWeight: 700 }}>L</span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13, fontWeight: 700 }}>¥</span>
                      <input type="number" inputMode="decimal" value={sh.feeJpy} onChange={(e) => updShipping(i, { feeJpy: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 90, padding: "9px 10px 9px 24px", textAlign: "right", fontSize: 14 }} />
                    </div>
                    <button onClick={() => removeShipping(i)} title="Remove size" style={{ border: "none", background: "transparent", color: T.pink, fontSize: 16, cursor: "pointer" }}>✕</button>
                  </div>
                  <input value={sh.note || ""} onChange={(e) => updShipping(i, { note: e.target.value })} placeholder="What fits in this size" style={{ ...inputStyle, marginTop: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 500 }} />
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>≈{M(shipPhp(sh))} per item at today's rate</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={addShipping} style={{ ...dashedBtn, flex: "1 1 150px" }}>+ Add a size</button>
                <button onClick={recalcShipping} style={{ ...ghostBtn, color: T.accent, flex: "1 1 150px" }}>↻ Recompute ¥ from litres</button>
              </div>
              {(shippingDirty || boxDirty) && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={saveShipping} style={{ ...primaryBtn, flex: 1, padding: 11, fontSize: 14 }}>Save changes</button>
                  <button onClick={discardShipping} style={{ ...ghostBtn, color: T.muted }}>Discard</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
                Each size carries its share of the box. Set the litres a size takes and tap Recompute, or type the ¥ yourself and ignore litres.
                Keep a free size (like Hand-carry) for anything that never goes in a box.
              </div>
            </div>

            {/* defaults + history */}
            <div style={card}>
              <span style={label}>Default setup & history</span>
              <div style={{ fontSize: 12.5, color: T.muted }}>
                Keep a setup you trust as your default, and roll back to any setup you used before.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={saveAsDefault} style={{ ...ghostBtn, flex: 1, color: T.accent }}>★ Save current as default</button>
                {settings.defaults && (
                  <button onClick={() => applySnapshot(settings.defaults, "Your default setup restored 🌸")} style={{ ...ghostBtn, flex: 1, color: T.accent }}>
                    ↺ Restore my default
                  </button>
                )}
              </div>
              {settings.defaults && (
                <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                  Default: {settings.defaults.tiers.length} tier(s) · {settings.defaults.sourcing.length} sourcing type(s) · {(settings.defaults.shipping || []).length} shipping size(s) · buffer {settings.defaults.buffer}% · haggle {settings.defaults.negotiation}%
                </div>
              )}

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <span style={{ ...label, fontSize: 9.5 }}>Previous setups</span>
                {(settings.history || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: T.muted }}>Nothing yet — every time you save a change, the setup you were using is kept here.</div>
                ) : (
                  (settings.history || []).map((h) => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <b>{new Date(h.at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                        <div style={{ color: T.muted, fontSize: 11 }}>
                          {h.tiers.map((t) => `${t.name} ${t.margin}%`).join(" · ")}
                        </div>
                        <div style={{ color: T.muted, fontSize: 11 }}>
                          {h.sourcing.map((x) => `${x.name} ¥${x.feeJpy}`).join(" · ")}
                        </div>
                        {(h.shipping || []).length > 0 && (
                          <div style={{ color: T.muted, fontSize: 11 }}>
                            {h.shipping.map((x) => `${x.name} ¥${x.feeJpy}`).join(" · ")}
                          </div>
                        )}
                      </div>
                      <button onClick={() => applySnapshot(h, "Previous setup restored 🌸")} style={{ ...ghostBtn, flexShrink: 0, color: T.accent, padding: "7px 11px", fontSize: 11.5 }}>Restore</button>
                    </div>
                  ))
                )}
                {(settings.history || []).length > 0 && (
                  <button
                    onClick={() => { if (window.confirm("Clear the setup history? Your current settings and default stay.")) { setSettings({ ...settings, history: [] }); ping("History cleared"); } }}
                    style={{ ...ghostBtn, width: "100%", marginTop: 10, color: T.muted }}>
                    Clear history
                  </button>
                )}
              </div>
            </div>

            <div style={card}>
              <span style={label}>Page guides</span>
              <div style={{ fontSize: 12.5, color: T.muted }}>
                Every page has a “How to use” panel at the bottom. Choose whether those open by themselves or stay tucked away.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Chip active={settings.guidesExpanded !== false} onClick={() => { setSettings({ ...settings, guidesExpanded: true }); setGuideOpen({}); }} title="Open by default" sub="best while learning" />
                <Chip active={settings.guidesExpanded === false} onClick={() => { setSettings({ ...settings, guidesExpanded: false }); setGuideOpen({}); }} title="Keep collapsed" sub="tap to read" />
              </div>
            </div>

            <Guide id="setup" title="Set-up"
              steps={[
                ["Set the exchange rate", "Live rate follows the market. My own rate is for when you already changed cash at a fixed rate — use that number so your costs match reality."],
                ["Set your buffer and haggle room", "Buffer quietly covers rate swings, packaging and small extras. Haggle room is the padding above your floor, so there's something to give away when a customer bargains."],
                ["Shape your tiers", "Rename them, rewrite the description, change the margin, add or remove as many as you like. Changes only take effect when you press Save."],
                ["Set your sourcing fees", "Put a ¥ figure on the effort of each way you get items. Add up a day's train fare, divide by the items you expect to find, and use that for your bigger trips."],
                ["Enter your balikbayan box cost", "Total what one box costs door to door, its capacity in litres, and how full you realistically pack it. The app turns that into a ¥ per litre figure."],
                ["Build your shipping sizes", "Give each size the litres it takes, tap Recompute, and every size gets its fair share of the box. Or type the ¥ yourself and ignore litres entirely."],
                ["Save a default you trust", "Once your setup feels right, save it as your default. Every later change is kept in history, so you can always roll back."],
                ["Back up regularly", "Export everything writes one JSON file with your inventory, photos, orders and settings. That file is the only way to move data to another phone."],
              ]}
              tips={[
                "Nothing in this app talks to a server — everything lives on this device, which is why the backup file matters so much.",
                "Recompute rewrites every size that has litres set. Anything on 0 L stays free.",
              ]} />

            <div style={card}>
              <span style={label}>Website colors</span>
              {[false, true].map((isDark) => (
                <div key={String(isDark)} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", marginBottom: 6 }}>
                    {isDark ? "DARK" : "LIGHT"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {THEME_PRESETS.filter((p) => !!p.dark === isDark).map((p) => (
                      <button key={p.name} onClick={() => { setSettings({ ...settings, theme: { ...p.theme } }); ping(`Theme: ${p.name}`); }} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ display: "flex", gap: 2 }}>
                          {[p.theme.primary, p.theme.accent, p.theme.bg].map((c) => (
                            <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c, display: "inline-block", border: `1px solid ${T.border}` }} />
                          ))}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={card}>
              <span style={label}>Account</span>
              <div style={{ fontSize: 13 }}>
                Signed in as <b style={{ color: T.primary }}>{user?.name || user?.u}</b>
                {user?.owner && <span style={{ color: T.muted }}> · owner</span>}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                Each account keeps its own data on this device. Signing out doesn't delete anything.
              </div>
              <button onClick={onLogout} style={{ ...ghostBtn, width: "100%", marginTop: 10, color: T.accent }}>Sign out</button>

              {user?.owner && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ ...label, fontSize: 9.5 }}>Add a tester (owner only)</span>
                  <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>
                    Type a password, copy the generated line, and paste it into the <code>USERS</code> list in the app files, then push to GitHub.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={hashPw} onChange={(e) => setHashPw(e.target.value)} placeholder="new password" style={{ ...inputStyle, fontSize: 14 }} />
                    <button
                      onClick={async () => {
                        if (!hashPw.trim()) return ping("Type a password first");
                        const h = await sha256Hex(`${PW_SALT}:${hashPw.trim()}`);
                        setHashOut(`{ u: "username", name: "Name", h: "${h}" },`);
                        ping("Line generated — copy it below");
                      }}
                      style={{ ...primaryBtn, padding: "11px 16px", fontSize: 13 }}>
                      Generate
                    </button>
                  </div>
                  {hashOut && (
                    <textarea readOnly value={hashOut} onFocus={(e) => e.target.select()}
                      style={{ ...inputStyle, marginTop: 8, fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace", height: 62, resize: "vertical" }} />
                  )}
                </div>
              )}
            </div>

            <div style={card}>
              <span style={label}>Saved suggestions</span>
              <div style={{ fontSize: 12.5, color: T.muted }}>
                Zen Pasabuy remembers what you type so you can pick it next time instead of retyping.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 12.5 }}>
                {[["Shops", memShops.length], ["Locations", memLocations.length], ["Customers", memCustomers.length], ["Products", memProducts.length]].map(([n, c]) => (
                  <div key={n} style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 12px" }}>
                    <b style={{ color: T.primary }}>{c}</b> <span style={{ color: T.muted }}>{n.toLowerCase()}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  if (!window.confirm("Clear remembered suggestions? Your products and orders stay — only the typed-history list is cleared.")) return;
                  setSettings({ ...settings, memory: { shops: [], locations: [], customers: [], products: [] } });
                  ping("Suggestion history cleared");
                }}
                style={{ ...ghostBtn, width: "100%", marginTop: 10, color: T.muted }}>
                Clear suggestion history
              </button>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                Names already used by saved products and orders will still appear.
              </div>
            </div>

            <div style={card}>
              <span style={label}>Backup</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={exportJSON} style={{ ...ghostBtn, flex: 1, color: T.accent }}>⬇ Export everything</button>
                <button onClick={() => backupRef.current?.click()} style={{ ...ghostBtn, flex: 1, color: T.accent }}>⬆ Import backup</button>
              </div>
              <div style={{ fontSize: 12, color: backupDue ? T.accent : T.muted, marginTop: 10, fontWeight: backupDue ? 700 : 500 }}>
                Last backup: {lastBackupLabel}{daysSinceBackup !== null ? ` · ${daysSinceBackup} day(s) ago` : ""}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                Inventory (with photos and purchase batches), orders, and settings in one JSON file — move it between phones or keep it as a record.
                A reminder appears every 7 days, and when you move to a new web address you'll need this file to bring your data along.
              </div>
            </div>

          </div>
        )}

        {/* footer — refresh available from every page */}
        <footer style={{ textAlign: "center", marginTop: 28, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
          <button onClick={refreshApp} style={{ ...ghostBtn, borderColor: T.pink, color: T.accent, padding: "10px 18px" }}>
            ↻ Refresh to latest version
          </button>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
            Zen Pasabuy v{APP_VERSION} · updated {APP_UPDATED} 🌸
          </div>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
            Your inventory, orders and settings are kept — this only refetches the app.
          </div>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>
            {user?.name || user?.u} · <button onClick={onLogout} style={{ border: "none", background: "transparent", color: T.accent, fontWeight: 700, fontSize: 10.5, cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "'Quicksand', sans-serif" }}>sign out</button>
          </div>
        </footer>

        {toast && (
          <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.primary, color: "#fff", padding: "10px 20px", borderRadius: 999, fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 13.5, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 50, maxWidth: "88vw", textAlign: "center" }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}


/* ───────────────────────────  LOGIN + ROOT  ───────────────────────────
   Note: this is a client-side gate for private testing, not real security.
   Anyone who can read the page source can see the password hashes.
   Keep it for keeping casual visitors out; real accounts need a backend.
──────────────────────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }) {
  const T = SWEETIES_THEME;
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    const name = u.trim().toLowerCase();
    if (!name || !p) return setErr("Enter your username and password.");
    setBusy(true);
    try {
      const found = USERS.find((x) => x.u.toLowerCase() === name);
      const h = await sha256Hex(`${PW_SALT}:${p}`);
      if (found && found.h === h) onLogin({ u: found.u, name: found.name || found.u, owner: !!found.owner });
      else setErr("That username and password don't match.");
    } catch (e) {
      setErr("Couldn't sign in on this browser.");
    }
    setBusy(false);
  };

  const input = {
    width: "100%", boxSizing: "border-box", padding: "13px 15px", borderRadius: 12,
    border: `1.5px solid ${T.border}`, background: T.bg, color: T.ink,
    fontFamily: "'Quicksand', system-ui, sans-serif", fontSize: 16, fontWeight: 600, outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.bg} 0%, ${T.bg2} 100%)`, color: T.ink, fontFamily: "'Quicksand', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap');
        input::placeholder { color: ${T.pink}; font-weight: 500; }
        input:focus { border-color: ${T.accent} !important; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><ZenLogo size={72} /></div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 600, color: T.primary, lineHeight: 1.05 }}>Zen Pasabuy</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, letterSpacing: "0.06em" }}>calm decisions, clear profits</div>
        </div>

        <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20, boxShadow: "0 8px 24px rgba(128,29,92,0.10)" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <input value={u} onChange={(e) => setU(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Username" autoCapitalize="none" autoCorrect="off" style={input} />
            <input value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Password" type="password" style={input} />
            {err && <div style={{ color: DANGER, fontSize: 12.5, fontWeight: 700 }}>{err}</div>}
            <button onClick={submit} disabled={busy}
              style={{ padding: 13, borderRadius: 14, border: "none", background: `linear-gradient(120deg, ${T.primary}, ${T.accent})`, color: "#fff", fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              {busy ? "Checking…" : "Sign in"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 12, textAlign: "center" }}>
            Private testing. Ask Niz for an account.
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 10.5, color: T.muted, marginTop: 14 }}>
          v{APP_VERSION} · updated {APP_UPDATED} 🌸
        </div>
      </div>
    </div>
  );
}

function ZenPasabuyRoot() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const still = USERS.find((x) => x.u === saved.u);
        if (still) setUser({ u: still.u, name: still.name || still.u, owner: !!still.owner });
      }
    } catch (e) { /* no session */ }
    setReady(true);
  }, []);

  const handleLogin = (u) => {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ u: u.u })); } catch (e) { /* private mode */ }
    setUser(u);
  };
  const handleLogout = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    setUser(null);
  };

  if (!ready) return <div style={{ minHeight: "100vh", background: SWEETIES_THEME.bg }} />;
  return user ? <ZenPasabuy user={user} onLogout={handleLogout} /> : <LoginScreen onLogin={handleLogin} />;
}
