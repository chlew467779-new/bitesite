/**
 * Minimal SMTP pieces for notification emails (C8): build one plain-text UTF-8 message and read
 * server replies. Pure, so scripts/test-email-notify.mjs drives a whole conversation against a fake
 * server. The socket side is app/api/_lib/smtp-send.ts (implicit TLS, e.g. Gmail smtp.gmail.com:465
 * with an app password). No attachments, no HTML.
 */

const CRLF = "\r\n";

/** Header-safe text: no line breaks (blocks header injection), trimmed. */
export function headerText(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

/** A bare address from "Name <a@b.c>" or "a@b.c"; null when it does not look like one address. */
export function addressOf(value) {
  const text = headerText(value);
  const m = /<([^<>\s]+@[^<>\s]+)>$/.exec(text) ?? /^([^<>\s,;]+@[^<>\s,;]+)$/.exec(text);
  return m && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m[1]) ? m[1] : null;
}

/** RFC 2047 encoded-word for non-ASCII header text (subject, display name). */
export function encodeHeader(value) {
  const text = headerText(value);
  // eslint-disable-next-line no-control-regex -- ASCII check
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function encodeFrom(from) {
  const text = headerText(from);
  const address = addressOf(text);
  const name = text.replace(/<[^<>]*>$/, "").trim().replace(/^"|"$/g, "");
  return name && name !== address ? `${encodeHeader(name)} <${address}>` : `<${address}>`;
}

/**
 * The DATA payload (headers + base64 body), lines joined with CRLF, without the final ".".
 * Base64 lines never start with ".", so no dot-stuffing is needed.
 */
export function buildMessage({ from, to, subject, text, date = new Date(), messageId }) {
  const fromAddress = addressOf(from);
  const toAddress = addressOf(to);
  if (!fromAddress || !toAddress) throw new Error("invalid address");
  const domain = fromAddress.split("@")[1];
  const body = Buffer.from(String(text ?? "").replace(/\r?\n/g, CRLF), "utf8").toString("base64").replace(/.{1,76}/g, (line) => line + CRLF);
  return [
    `From: ${encodeFrom(from)}`,
    `To: <${toAddress}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${messageId ?? `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body.replace(/\r\n$/, ""),
  ].join(CRLF);
}

/**
 * Complete replies in `buffer` (a multi-line reply ends with "NNN text"), and what is left over.
 * @returns {{ replies: { code: number, text: string }[], rest: string }}
 */
export function readReplies(buffer) {
  const replies = [];
  let rest = buffer;
  let lines = [];
  for (;;) {
    const at = rest.indexOf("\n");
    if (at < 0) break;
    const line = rest.slice(0, at).replace(/\r$/, "");
    rest = rest.slice(at + 1);
    lines.push(line);
    const m = /^(\d{3})([ -])(.*)$/.exec(line);
    if (m && m[2] === " ") {
      replies.push({ code: Number(m[1]), text: lines.map((l) => l.slice(4)).join("\n") });
      lines = [];
    } else if (!m) {
      replies.push({ code: 0, text: line });
      lines = [];
    }
  }
  if (lines.length) rest = lines.map((l) => l + "\n").join("") + rest;
  return { replies, rest };
}

/**
 * The commands of one send, each with the reply code that must come back before the next step.
 * The first entry (null command) waits for the server greeting.
 */
export function conversation({ user, pass, from, to, message, heloName = "bitesite" }) {
  const fromAddress = addressOf(from);
  const toAddress = addressOf(to);
  if (!fromAddress || !toAddress) throw new Error("invalid address");
  return [
    { command: null, expect: 220 },
    { command: `EHLO ${heloName}`, expect: 250 },
    { command: `AUTH PLAIN ${Buffer.from(`\u0000${user}\u0000${pass}`, "utf8").toString("base64")}`, expect: 235, secret: true },
    { command: `MAIL FROM:<${fromAddress}>`, expect: 250 },
    { command: `RCPT TO:<${toAddress}>`, expect: 250 },
    { command: "DATA", expect: 354 },
    { command: `${message}${CRLF}.`, expect: 250 },
    { command: "QUIT", expect: 221, optional: true },
  ];
}

/**
 * Run `steps` on a connected socket (anything with write(), on('data'|'error'|'close'), end()).
 * Resolves null on success or a short problem text (never containing the password).
 */
export function runConversation(socket, steps, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let buffer = "";
    let index = 0;
    let done = false;
    const finish = (problem) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { socket.end(); } catch { /* already closed */ }
      resolve(problem);
    };
    const timer = setTimeout(() => finish("mail server timed out"), timeoutMs);
    const sendNext = () => {
      index += 1;
      if (index >= steps.length) return finish(null);
      socket.write(`${steps[index].command}\r\n`);
    };
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const { replies, rest } = readReplies(buffer);
      buffer = rest;
      for (const reply of replies) {
        if (done) return;
        const step = steps[index];
        if (reply.code !== step.expect) {
          if (step.optional) return finish(null);
          const label = step.secret ? "AUTH" : (step.command ?? "greeting").split(" ")[0].replace(/:.*/, "");
          return finish(`mail server refused ${label} (${reply.code})`);
        }
        sendNext();
      }
    });
    socket.on("error", () => finish(steps[index]?.optional ? null : "mail server connection failed"));
    socket.on("close", () => finish(index >= steps.length - 1 ? null : "mail server closed the connection"));
  });
}
