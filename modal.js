import { certificates } from "./certificates.js";
import { about, experience, education } from "./data.js";

const modal = document.getElementById("card-modal");
const body = document.getElementById("modal-body");
const closeBtn = document.getElementById("modal-close");
let lastFocus = null;
let certIndex = 0;
let certMode = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const timeline = (items) => `<ol class="tl">${items.map((i) => `<li><h3>${esc(i.t)}</h3><div class="meta">${esc(i.m)}</div><p>${esc(i.d)}</p></li>`).join("")}</ol>`;
const chips = (arr) => `<ul class="chips">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
const title = (t) => `<h2 class="m-title" id="modal-title">${esc(t)}</h2>`;

const views = {
  about: () => title("About me") + `<p class="m-text">${esc(about.text)}</p><h3 class="m-sub">Skills</h3>${chips(about.skills)}<h3 class="m-sub">Languages</h3>${chips(about.languages)}<h3 class="m-sub">Highlights</h3>${timeline(about.highlights)}`,
  experience: () => title("Experience") + timeline(experience),
  education: () => title("Education") + timeline(education),
};

function certView() {
  const c = certificates[certIndex];
  const n = certificates.length;
  body.innerHTML = `<div class="cert-view">${title(c.title)}
    <div class="cert-mat" id="cert-mat"><img src="${esc(c.image)}" alt="Certificate: ${esc(c.title)}, issued ${esc(c.date)}"></div>
    <p class="cert-meta">${esc(c.issuer)} | ${esc(c.date)}</p>
    <div class="cert-id"><span>Credential ID</span><code>${esc(c.credentialId)}</code><button class="btn" id="copy-id" type="button">Copy</button></div>
    ${n > 1 ? `<div class="cert-nav"><button class="btn" id="cert-prev" type="button">Previous</button><button class="btn" id="cert-next" type="button">Next</button></div>` : ""}</div>`;
  const mat = body.querySelector("#cert-mat");
  mat.querySelector("img").addEventListener("click", () => mat.classList.toggle("zoom"));
  body.querySelector("#copy-id").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(c.credentialId); e.target.textContent = "Copied"; } catch { e.target.textContent = "Select and copy"; }
    setTimeout(() => (e.target.textContent = "Copy"), 1800);
  });
  body.querySelector("#cert-prev")?.addEventListener("click", () => stepCert(-1));
  body.querySelector("#cert-next")?.addEventListener("click", () => stepCert(1));
}
const stepCert = (d) => { certIndex = (certIndex + d + certificates.length) % certificates.length; certView(); };

function open(html, isCert = false) {
  lastFocus = document.activeElement;
  certMode = isCert;
  if (!isCert) body.innerHTML = html;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  window.dispatchEvent(new Event("modal:open"));
  setTimeout(() => closeBtn.focus(), 80);
}

function close() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  window.dispatchEvent(new Event("modal:close"));
  lastFocus?.focus?.();
  setTimeout(() => { if (!modal.classList.contains("active")) body.innerHTML = ""; }, 350);
}

// Cards open their data-driven view
document.querySelectorAll("[data-modal]").forEach((card) => {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  const go = () => open(views[card.dataset.modal]());
  card.addEventListener("click", go);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
});

// Certificate grid rendered from certificates.js
const grid = document.getElementById("cert-grid");
if (grid) {
  grid.innerHTML = certificates.map((c, i) => `<button class="cert-card" type="button" data-i="${i}"><img loading="lazy" src="${esc(c.image)}" alt=""><strong>${esc(c.title)}</strong><span>${esc(c.date)}</span></button>`).join("");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".cert-card");
    if (!b) return;
    certIndex = +b.dataset.i;
    certView();
    open("", true);
  });
}

closeBtn.addEventListener("click", close);
document.querySelector(".card-modal-backdrop").addEventListener("click", close);
document.addEventListener("keydown", (e) => {
  if (!modal.classList.contains("active")) return;
  if (e.key === "Escape") return close();
  if (certMode && certificates.length > 1) {
    if (e.key === "ArrowRight") return stepCert(1);
    if (e.key === "ArrowLeft") return stepCert(-1);
  }
  if (e.key === "Tab") { // focus trap
    const f = [...modal.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
