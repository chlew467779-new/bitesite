/**
 * Email notifications (C8): Gmail SMTP provider from the environment, message building (no header
 * injection, UTF-8), a whole SMTP conversation against a fake local server, the site error email,
 * and the wiring that sends right after review events and on new site errors.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, connect } from "node:net";
import { notificationProvider, siteErrorEmail } from "../lib/notification-content.mjs";
import { addressOf, buildMessage, conversation, encodeHeader, readReplies, runConversation } from "../lib/smtp-core.mjs";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

/* Provider: SMTP only with both user and password; Gmail defaults; Resend still wins. */
assert.equal(notificationProvider({ SMTP_USER: "bitesite.my@gmail.com" }), null, "password required");
const smtp = notificationProvider({ SMTP_USER: " bitesite.my@gmail.com ", SMTP_PASS: "abcd efgh ijkl mnop" });
assert.deepEqual(smtp, { kind: "smtp", from: "BiteSite <bitesite.my@gmail.com>", host: "smtp.gmail.com", port: 465, user: "bitesite.my@gmail.com", pass: "abcdefghijklmnop" }, "Gmail app password spaces removed");
assert.equal(notificationProvider({ SMTP_USER: "u@x.my", SMTP_PASS: "p", SMTP_HOST: "mail.x.my", SMTP_PORT: "2465", NOTIFY_FROM: "X <u@x.my>" }).port, 2465);
assert.equal(notificationProvider({ RESEND_API_KEY: "k", NOTIFY_FROM: "B <b@x.my>", SMTP_USER: "u@x.my", SMTP_PASS: "p" }).kind, "resend");

/* Addresses and headers */
assert.equal(addressOf("BiteSite <bitesite.my@gmail.com>"), "bitesite.my@gmail.com");
assert.equal(addressOf("a@b.my, c@d.my"), null, "one recipient only");
assert.equal(addressOf("x\r\nBcc: evil@x.my"), null);
assert.equal(encodeHeader("Kedai Kopi"), "Kedai Kopi");
assert.equal(encodeHeader("鸡饭 Story"), `=?UTF-8?B?${Buffer.from("鸡饭 Story").toString("base64")}?=`);
const message = buildMessage({ from: "BiteSite <bitesite.my@gmail.com>", to: "owner@example.test", subject: "Approved: Kopi\r\nBcc: evil@x.my", text: "Line 1\n.\nLine 3 – ok", date: new Date(Date.UTC(2026, 9, 4)), messageId: "m1" });
const [headers, body] = message.split("\r\n\r\n");
assert.ok(!/\r\nBcc:/i.test(headers), "no header injection through the subject");
assert.match(headers, /^From: BiteSite <bitesite\.my@gmail\.com>\r\nTo: <owner@example\.test>\r\nSubject: Approved: Kopi Bcc: evil@x\.my\r\n/);
assert.match(headers, /Content-Transfer-Encoding: base64/);
assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), "Line 1\r\n.\r\nLine 3 – ok");
assert.ok(body.split("\r\n").every((l) => l.length <= 76 && !l.startsWith(".")), "short base64 lines, never a leading dot");
assert.throws(() => buildMessage({ from: "nobody", to: "a@b.my", subject: "s", text: "t" }));

/* Reply parsing */
const parsed = readReplies("250-smtp.gmail.com\r\n250-AUTH PLAIN\r\n250 SMTPUTF8\r\n235 2.7.0 Accepted\r\n354 Go");
assert.deepEqual(parsed.replies.map((r) => r.code), [250, 235]);
assert.equal(parsed.rest, "354 Go");

/* Whole conversation against a fake server (plain TCP stands in for TLS). */
async function fakeServer(script) {
  const seen = [];
  const server = createServer((socket) => {
    socket.write("220 fake ready\r\n");
    let buf = "";
    let inData = false;
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buf.indexOf("\r\n.\r\n");
          if (end < 0) return;
          seen.push({ data: buf.slice(0, end) });
          buf = buf.slice(end + 5);
          inData = false;
          socket.write(`${script.data ?? 250} queued\r\n`);
          continue;
        }
        const at = buf.indexOf("\r\n");
        if (at < 0) return;
        const line = buf.slice(0, at);
        buf = buf.slice(at + 2);
        seen.push(line);
        const verb = line.split(/[ :]/)[0].toUpperCase();
        if (verb === "EHLO") socket.write("250-fake\r\n250 AUTH PLAIN\r\n");
        else if (verb === "AUTH") socket.write(`${script.auth ?? 235} auth\r\n`);
        else if (verb === "MAIL" || verb === "RCPT") socket.write("250 ok\r\n");
        else if (verb === "DATA") { inData = true; socket.write("354 go\r\n"); }
        else if (verb === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: server.address().port, seen, close: () => new Promise((resolve) => server.close(resolve)) };
}

const send = async (script) => {
  const server = await fakeServer(script);
  const steps = conversation({ user: "bitesite.my@gmail.com", pass: "secret-app-pass", from: "BiteSite <bitesite.my@gmail.com>", to: "owner@example.test", message });
  const problem = await runConversation(connect(server.port, "127.0.0.1"), steps, 5000);
  await server.close();
  return { problem, seen: server.seen };
};
const ok = await send({});
assert.equal(ok.problem, null, "accepted");
assert.deepEqual(ok.seen.filter((x) => typeof x === "string").map((l) => l.split(/[ :]/)[0]), ["EHLO", "AUTH", "MAIL", "RCPT", "DATA", "QUIT"], "commands in order");
assert.ok(ok.seen.some((x) => typeof x === "object" && x.data === message), "the message is sent as built");
assert.ok(ok.seen.includes(`AUTH PLAIN ${Buffer.from("\u0000bitesite.my@gmail.com\u0000secret-app-pass").toString("base64")}`));
const badAuth = await send({ auth: 535 });
assert.equal(badAuth.problem, "mail server refused AUTH (535)", "wrong app password reported without the password");
assert.ok(!badAuth.problem.includes("secret"));
const refused = await send({ data: 552 });
assert.match(refused.problem, /refused/);
assert.equal(await runConversation(connect(1, "127.0.0.1"), conversation({ user: "u", pass: "p", from: "a@b.my", to: "c@d.my", message: "x" }), 3000), "mail server connection failed");

/* Site error email */
const e = siteErrorEmail({ source: "server", message: "menu_import failed: timeout", page: "/admin", reopened: false }, "https://bitesite.example/");
assert.equal(e.subject, "BiteSite error: menu_import failed: timeout");
assert.match(e.text, /the server, page \/admin/);
assert.match(e.text, /https:\/\/bitesite\.example\/admin/);
assert.match(siteErrorEmail({ source: "browser", message: "x", page: null, reopened: true }, "").subject, /back again/);

/* Wiring */
const delivery = await read("app/api/_lib/notification-delivery.ts");
assert.match(delivery, /if \(provider\.kind === 'smtp'\) return smtpSend\(provider, to, subject, text\);/);
assert.match(delivery, /ERROR_EMAILS_PER_HOUR = 10/);
for (const path of ["app/api/admin/restaurant-reviews/route.ts", "app/api/admin/basics-reviews/route.ts", "app/api/merchant/restaurants/[merchantId]/listing/route.ts"]) {
  assert.match(await read(path), /deliverSoon\(\);/, `${path} sends right after the change`);
}
const recorder = await read("app/api/_lib/site-errors.ts");
assert.match(recorder, /siteErrorEmailEnabled\(\)/, "no extra read unless email is set up");
assert.match(recorder, /known\.status === 'resolved'/, "new or returning kinds only");
assert.match(recorder, /process\.env\.NEXT_RUNTIME === 'edge' \? null : await import\('\.\/notification-delivery'\)/, "Node-only mail code is loaded lazily");

console.log("email notification checks passed");
