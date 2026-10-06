import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.11/dist/lenis.mjs";
import "./modal.js";

const TOTAL_FRAMES = 240;
const INITIAL_FRAMES = 30;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lowEnd = innerWidth < 768 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const STEP = lowEnd ? 2 : 1; // low-end devices load every 2nd frame

const $ = (id) => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const loader = $("loader"), bar = $("progress-bar"), pct = $("loading-text");
const sections = [...document.querySelectorAll(".page-section")];
const images = new Array(TOTAL_FRAMES).fill(null);
const pending = [];
for (let i = 0; i < TOTAL_FRAMES; i++) if (i % STEP === 0 || i === TOTAL_FRAMES - 1) pending.push(i);
let currentFrame = 0, targetFrame = 0, isLoaded = false;

const framePath = (i) => `${import.meta.env.BASE_URL}ezgif-frame-${String(i + 1).padStart(3, "0")}.jpg`;
const ready = (img) => img && img.complete && img.naturalWidth > 0;

// Load one frame; resolves when done (success or error)
function loadFrame(i) {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { if (ready(img)) images[i] = img; res(); };
    img.src = framePath(i);
  });
}

// Stream the rest in the background, nearest to the current scroll position first
async function streamRest() {
  while (pending.length) {
    const batch = [];
    for (let k = 0; k < 4 && pending.length; k++) {
      let best = 0;
      for (let j = 1; j < pending.length; j++) if (Math.abs(pending[j] - currentFrame) < Math.abs(pending[best] - currentFrame)) best = j;
      batch.push(pending.splice(best, 1)[0]);
    }
    await Promise.all(batch.map(loadFrame));
  }
}

async function boot() {
  const first = pending.splice(0, Math.ceil(INITIAL_FRAMES / STEP));
  let done = 0;
  await Promise.all(first.map((i) => loadFrame(i).then(() => {
    done++;
    const p = Math.floor((done / first.length) * 100);
    bar.style.width = p + "%"; pct.textContent = p + "%";
  })));
  isLoaded = true;
  loader.classList.add("hidden");
  renderFrame(0);
  streamRest();
}

function nearest(idx) {
  if (images[idx]) return images[idx];
  for (let d = 1; d < TOTAL_FRAMES; d++) {
    if (images[idx - d]) return images[idx - d];
    if (images[idx + d]) return images[idx + d];
  }
  return null;
}

function renderFrame(index) {
  const img = nearest(Math.min(Math.max(0, Math.floor(index)), TOTAL_FRAMES - 1));
  if (!img) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth, h = innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ir = img.naturalWidth / img.naturalHeight;
  let dw, dh;
  if (w / h > ir) { dw = w; dh = w / ir; } else { dh = h; dw = h * ir; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Smooth scroll
const lenis = new Lenis({ duration: reduced ? 0.01 : 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: !reduced, touchMultiplier: 1.4 });
window.addEventListener("modal:open", () => lenis.stop());
window.addEventListener("modal:close", () => lenis.start());

const wrapper = $("pages-wrapper");
const fill = $("scroll-fill");

function loop(time) {
  lenis.raf(time);
  if (isLoaded) {
    const max = wrapper.offsetHeight - innerHeight;
    const progress = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
    targetFrame = progress * (TOTAL_FRAMES - 1);
    currentFrame += (targetFrame - currentFrame) * (reduced ? 1 : 0.08);
    renderFrame(currentFrame);
    fill.style.width = progress * 100 + "%";
  }
  requestAnimationFrame(loop);
}

let resizeT;
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => isLoaded && renderFrame(currentFrame), 120); });

// Side dots, jump buttons, active section, reveal
const dots = $("dots");
sections.forEach((s, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", "Go to " + (s.getAttribute("aria-label") || "section " + (i + 1)));
  b.addEventListener("click", () => lenis.scrollTo(s));
  dots.appendChild(b);
});
document.querySelectorAll("[data-goto]").forEach((el) => el.addEventListener("click", (e) => {
  e.preventDefault();
  lenis.scrollTo(el.dataset.goto);
}));

const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const i = sections.indexOf(en.target);
    [...dots.children].forEach((d, k) => d.classList.toggle("active", k === i));
    en.target.querySelector(".reveal")?.classList.add("in");
  });
}, { threshold: 0.55 });
sections.forEach((s) => io.observe(s));

// Card tilt (desktop, fine pointer only)
if (!reduced && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.querySelectorAll(".page-card").forEach((c) => {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 5 + "deg");
      c.style.setProperty("--rx", ((e.clientY - r.top) / r.height - 0.5) * -5 + "deg");
    });
    c.addEventListener("pointerleave", () => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); });
  });
}

// Auto-play: step to the next section every few seconds; any user input stops it
const apBtn = $("autoplay-btn");
let apTimer = null;
function setAutoplay(on) {
  apBtn.setAttribute("aria-pressed", on);
  $("autoplay-text").textContent = on ? "Pause" : "Auto-play";
  clearInterval(apTimer);
  if (!on) return;
  apTimer = setInterval(() => {
    const idx = Math.round(scrollY / innerHeight);
    lenis.scrollTo(idx >= sections.length - 1 ? 0 : sections[idx + 1], { duration: 2 });
  }, 5000);
}
apBtn.addEventListener("click", () => setAutoplay(apBtn.getAttribute("aria-pressed") !== "true"));
["wheel", "touchstart", "keydown"].forEach((ev) => addEventListener(ev, () => apTimer && setAutoplay(false), { passive: true }));
if (reduced) apBtn.hidden = true;

// Calm ambient sound: soft sine pads, off by default, fades in/out
const audioBtn = $("audio-btn");
let ac, master, lp, seqTimer, bar4 = 0;
const chords = [[130.81, 196, 246.94, 329.63], [110, 164.81, 220, 261.63], [87.31, 130.81, 174.61, 220], [98, 146.83, 196, 246.94]]; // Cmaj7, Am7, Fmaj7, G6
function pad(freq, t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.07, t + 1.4);
  g.gain.linearRampToValueAtTime(0.0001, t + 4.6);
  o.connect(g); g.connect(lp);
  o.start(t); o.stop(t + 4.8);
}
function startSeq() {
  const play = () => { chords[bar4++ % chords.length].forEach((f) => pad(f, ac.currentTime)); };
  play();
  seqTimer = setInterval(play, 4000);
}
audioBtn.addEventListener("click", () => {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.0001;
    lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    lp.connect(master); master.connect(ac.destination);
  }
  const on = audioBtn.getAttribute("aria-pressed") !== "true";
  audioBtn.setAttribute("aria-pressed", on);
  ac.resume();
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setValueAtTime(master.gain.value, ac.currentTime);
  if (on) { master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 1.5); startSeq(); }
  else { master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.8); clearInterval(seqTimer); }
});

boot();
requestAnimationFrame(loop);
