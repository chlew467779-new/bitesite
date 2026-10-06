import assert from "node:assert/strict";
import QRCode from "qrcode";
import { escapeHtml, initials, displayUrl, tableCardHtml } from "../lib/table-qr-card.mjs";

assert.equal(escapeHtml(`<b onclick="x">'&'</b>`), "&lt;b onclick=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;");
assert.equal(initials("Kopi Pagi"), "KP");
assert.equal(initials("示意 · Kopi Pagi (Nanyang Kopitiam)"), "示K");
assert.equal(initials("Nasi"), "NA");
assert.equal(initials(""), "");
assert.equal(displayUrl("https://bitesite-pied.vercel.app/store/kopipagi"), "bitesite-pied.vercel.app/store/kopipagi");

const url = "https://bitesite-pied.vercel.app/store/kopipagi";
const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
const html = tableCardHtml({ name: `Kopi <script>alert(1)</script> "Pagi"`, url, accent: "#8A4B0F", qrSvg });
assert.doesNotMatch(html, /<script>alert/, "an Owner-entered name cannot add a script");
assert.match(html, /Kopi &lt;script&gt;alert\(1\)&lt;\/script&gt; &quot;Pagi&quot;/);
assert.match(html, /<svg[\s>]/, "the QR SVG is included");
assert.match(html, /Scan for menu · 扫码看菜单 · Imbas untuk menu/, "three-language heading (G29)");
assert.match(html, /bitesite-pied\.vercel\.app\/store\/kopipagi/);
assert.match(html, /background: #8A4B0F/, "the restaurant colour is used");
assert.doesNotMatch(html, /<link|<img|\bsrc=|@import|url\(/, "the card loads nothing from other sites (privacy)");

const badColour = tableCardHtml({ name: "X", url, accent: "red;}</style><script>x()</script>", qrSvg });
assert.doesNotMatch(badColour, /<script>x\(\)/, "a bad colour value cannot break out of the style");
assert.match(badColour, /background: #1F4D3A/, "…and falls back to Forest");

const badSvg = tableCardHtml({ name: "X", url, accent: "#1F4D3A", qrSvg: `<svg onload="x()"></svg>` });
assert.doesNotMatch(badSvg, /onload/, "an SVG with event handlers is dropped");

console.log("table QR checks passed");
