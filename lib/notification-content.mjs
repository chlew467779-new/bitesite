/**
 * Notification emails for outbox rows (public.merchant_notifications): subject and plain text per
 * kind, and the delivery provider chosen from the environment. Pure, so it is tested directly.
 */

const KINDS = Object.freeze({
  review_submitted: (n) => ({
    subject: `Restaurant waiting for review: ${n.merchantName}`,
    text: `${n.merchantName} was submitted for review.\n\nReview it on the Admin "Restaurant Reviews" page.`,
  }),
  review_withdrawn: (n) => ({
    subject: `Review withdrawn: ${n.merchantName}`,
    text: `${n.merchantName} withdrew its review request. Nothing to do.`,
  }),
  review_approved: (n) => ({
    subject: `${n.merchantName} is approved on BiteSite`,
    text: `Good news: BiteSite approved ${n.merchantName}.\n\nYour page is not public yet. Open your dashboard and choose Publish when you are ready.${n.message ? `\n\nNote from BiteSite: ${n.message}` : ''}`,
  }),
  review_rejected: (n) => ({
    subject: `Changes needed for ${n.merchantName}`,
    text: `BiteSite reviewed ${n.merchantName} and asks for some changes:\n\n${n.message ?? ''}\n\nOpen your dashboard, update your restaurant and submit it again.`,
  }),
  basics_approved: (n) => ({
    subject: `Restaurant details updated: ${n.merchantName}`,
    text: `BiteSite approved your request to update the name, address or cuisine for ${n.merchantName}. Open your dashboard to see the current details.${n.message ? `\n\nNote from BiteSite: ${n.message}` : ''}`,
  }),
  basics_rejected: (n) => ({
    subject: `Changes needed for your details request: ${n.merchantName}`,
    text: `BiteSite could not approve your request to change the name, address or cuisine for ${n.merchantName}.\n\nReason: ${n.message ?? ''}\n\nOpen your dashboard to review the request.`,
  }),
});

/** `{ subject, text }` for a claimed row, with the dashboard or Admin link appended; null for unknown kinds. */
export function notificationEmail(n, siteUrl) {
  const build = KINDS[n?.kind];
  if (!build) return null;
  const { subject, text } = build({ ...n, merchantName: n.merchantName || "your restaurant" });
  const base = String(siteUrl || "").replace(/\/+$/, "");
  const link = n.audience === "admin" ? `${base}/admin` : `${base}/merchant?merchant=${encodeURIComponent(n.merchantId)}`;
  return { subject, text: `${text}\n\n${link}\n\n— BiteSite` };
}

/**
 * Email to the site owner (ADMIN_NOTIFY_EMAIL) when a new kind of error appears, or a fixed one
 * comes back. The message is already redacted by the recorder (no emails, phone numbers, keys).
 */
export function siteErrorEmail({ source, message, page, reopened }, siteUrl) {
  const short = String(message ?? "").replace(/\s+/g, " ").trim().slice(0, 70);
  const base = String(siteUrl || "").replace(/\/+$/, "");
  return {
    subject: `BiteSite error${reopened ? " (back again)" : ""}: ${short}`,
    text: [
      reopened ? "An error that was marked fixed happened again on BiteSite." : "A new kind of error happened on BiteSite.",
      "",
      `Where: ${source === "browser" ? "a visitor's browser" : "the server"}${page ? `, page ${page}` : ""}`,
      `What: ${message}`,
      "",
      "Repeats of the same error are counted in Admin › Site › Site Errors, not emailed again. Copy it from there for the developer, then mark it resolved.",
      "",
      `${base}/admin`,
      "",
      "— BiteSite",
    ].join("\n"),
  };
}

/**
 * Provider from the environment: Resend when RESEND_API_KEY and NOTIFY_FROM are set; else SMTP when
 * SMTP_USER and SMTP_PASS are set (Gmail by default: smtp.gmail.com:465, sent from SMTP_USER unless
 * NOTIFY_FROM is set); 'log' when NOTIFY_PROVIDER=log outside production (local testing: printed,
 * marked delivered); otherwise null (nothing is claimed or sent).
 */
export function notificationProvider(env) {
  if (env.RESEND_API_KEY && env.NOTIFY_FROM) return { kind: "resend", from: env.NOTIFY_FROM };
  const smtpUser = env.SMTP_USER?.trim();
  if (smtpUser && env.SMTP_PASS) {
    const port = Number(env.SMTP_PORT || 465);
    return {
      kind: "smtp", from: env.NOTIFY_FROM?.trim() || `BiteSite <${smtpUser}>`,
      host: env.SMTP_HOST?.trim() || "smtp.gmail.com", port: Number.isInteger(port) && port > 0 ? port : 465,
      user: smtpUser, pass: String(env.SMTP_PASS).replace(/\s+/g, ""),
    };
  }
  if (env.NOTIFY_PROVIDER === "log" && env.NODE_ENV !== "production") return { kind: "log", from: env.NOTIFY_FROM || "BiteSite <local@localhost>" };
  return null;
}
