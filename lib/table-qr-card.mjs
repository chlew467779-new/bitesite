/**
 * Printable table card for a restaurant's QR code (R4, design: Documents\Codex\2026-10-06\design\QR;
 * wording: ChatGPT G29). Returns a complete HTML document the Owner's browser prints. The
 * restaurant name is Owner-entered text, so everything inserted is HTML-escaped; the QR is an
 * SVG string produced by the `qrcode` package from our own URL. Types in table-qr-card.d.mts.
 */

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Up to two letters for the logo tile when there is no logo: "Kopi Pagi" → "KP". */
export function initials(name) {
  const words = String(name ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]];
  return letters.join("").toUpperCase();
}

/** "https://bitesite-pied.vercel.app/store/kopipagi" → "bitesite-pied.vercel.app/store/kopipagi". */
export function displayUrl(url) {
  return String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const SAFE_COLOUR = /^#[0-9a-fA-F]{6}$/;

export function tableCardHtml({ name, url, accent, qrSvg }) {
  const colour = SAFE_COLOUR.test(accent) ? accent : "#1F4D3A";
  // The SVG comes from the qrcode library; refuse anything that is not a plain <svg> document.
  const svg = typeof qrSvg === "string" && /^\s*<svg[\s>]/.test(qrSvg) && !/<script|on\w+=/i.test(qrSvg) ? qrSvg : "";
  const safeName = escapeHtml(name);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeName} · Table QR</title>
<style>
  @page { size: A5 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Plus Jakarta Sans", "Noto Sans SC", system-ui, sans-serif; color: #17201B; background: #FFFFFF; }
  .card { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 32px 24px; text-align: center; }
  .tile { width: 72px; height: 72px; border-radius: 22px; background: ${colour}; color: #FFFFFF; font-size: 28px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  h1 { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; }
  .scan { margin: 6px 0 0; font-size: 19px; font-weight: 600; color: #3D4741; }
  .qr { width: 260px; height: 260px; padding: 14px; border: 2px solid #17201B; border-radius: 24px; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .url { font-size: 16px; font-weight: 700; color: ${colour}; word-break: break-all; }
  .note { margin-top: 4px; font-size: 13px; color: #5B655E; line-height: 1.5; }
  .credit { font-size: 12px; color: #5B655E; }
  @media print { .card { min-height: auto; } }
</style>
</head>
<body>
<main class="card">
  <div class="tile" aria-hidden="true">${escapeHtml(initials(name))}</div>
  <div>
    <h1>${safeName}</h1>
    <p class="scan">Scan for menu · 扫码看菜单 · Imbas untuk menu</p>
  </div>
  <div class="qr">${svg}</div>
  <div>
    <div class="url">${escapeHtml(displayUrl(url))}</div>
    <div class="note">Menu and prices on your phone.<br>用手机看菜单与价钱。<br>Lihat menu dan harga di telefon.</div>
  </div>
  <div class="credit">Menu by BiteSite</div>
</main>
<script>window.addEventListener("load", function () { (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { window.print(); }); });</script>
</body>
</html>`;
}
