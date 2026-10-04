/* bitesite/app/api/_lib/smtp-send.ts */

/**
 * Send one plain-text email over SMTP with implicit TLS (Gmail: smtp.gmail.com:465, the account
 * bitesite.my@gmail.com with a Google app password in SMTP_PASS). Returns null when the server
 * accepted it, else a short problem (never the password). Message building and the conversation
 * are in lib/smtp-core.mjs.
 */

import 'server-only';
import { connect } from 'node:tls';
import { buildMessage, conversation, runConversation } from '@/lib/smtp-core.mjs';

export type SmtpSettings = { host: string; port: number; user: string; pass: string; from: string };

export async function smtpSend(settings: SmtpSettings, to: string, subject: string, text: string): Promise<string | null> {
  let message: string;
  try {
    message = buildMessage({ from: settings.from, to, subject, text });
  } catch {
    return 'invalid address';
  }
  const steps = conversation({ user: settings.user, pass: settings.pass, from: settings.from, to, message });
  const socket = connect({ host: settings.host, port: settings.port, servername: settings.host });
  return runConversation(socket, steps);
}
