/*
 * One-tap merchant notices (CH 2026-09-30): after an Admin decision, open WhatsApp (or email) with
 * the message already written; CH checks it and presses send. No WhatsApp API, no cost.
 * Pure; shared by app/admin/components/notify-merchant.tsx and scripts/test-whatsapp-notify.mjs.
 */

import { summaryMessage } from './monthly-summary-core.mjs';

/**
 * wa.me link for a Malaysian or Singaporean number as BiteSite stores it (+60…, +65…) or as
 * typed locally (012-345 6789 → 6012…). Null when the number cannot be a phone.
 */
export function waLink(number, text) {
  if (typeof number !== 'string') return null;
  let digits = number.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('0')) digits = `60${digits.slice(1)}`;
  digits = digits.replace(/\D/g, '');
  if (!/^(60\d{8,10}|65\d{8})$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailLink(email, subject, text) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** Decisions that get a notice. */
export const NOTICE_KINDS = Object.freeze([
  'review_approved', 'review_rejected', 'basics_approved', 'basics_rejected',
  'link_approved', 'link_rejected', 'story_approved', 'story_rejected', 'story_changes', 'story_published', 'monthly_summary', 'menu_added',
]);

/**
 * The message for one decision. `note` is Admin's reason (rejections); `storySlug` the published
 * Story's address; `site` the site origin. Returns { subject, text }.
 */
export function noticeMessage(kind, { name, note, slug, storySlug, summary, site }) {
  if (kind === 'monthly_summary' && summary) return summaryMessage({ name, summary, slug, site });
  const hi = `Hi ${name || 'there'},`;
  const dashboard = `${site}/merchant`;
  const page = slug ? `${site}/store/${slug}` : dashboard;
  const reason = note ? `\n\n${note}` : '';
  switch (kind) {
    case 'review_approved':
      return { subject: 'Your restaurant is approved on BiteSite', text: `${hi} good news: BiteSite has approved your restaurant.\n\nLog in and press "Publish" when you are ready to go live:\n${dashboard}` };
    case 'review_rejected':
      return { subject: 'Your BiteSite restaurant needs a few changes', text: `${hi} thank you for submitting your restaurant to BiteSite. Before we can approve it, please update:${reason}\n\nMake the changes and submit again here:\n${dashboard}` };
    case 'basics_approved':
      return { subject: 'Your change is live on BiteSite', text: `${hi} your change to the restaurant name, address or cuisine is approved and now shows on your page:\n${page}` };
    case 'basics_rejected':
      return { subject: 'About your change request on BiteSite', text: `${hi} we could not approve your change to the restaurant name, address or cuisine:${reason}\n\nYou can send a new request here:\n${dashboard}` };
    case 'link_approved':
      return { subject: 'Your link is live on BiteSite', text: `${hi} your new link is approved and now shows on your page:\n${page}` };
    case 'link_rejected':
      return { subject: 'About your link request on BiteSite', text: `${hi} we could not approve your link change:${reason}\n\nYou can send a new request here:\n${dashboard}` };
    case 'story_approved':
      return { subject: 'Your Story is approved on BiteSite', text: `${hi} thank you for your Story. It is approved and we are preparing it for BiteSite. We will let you know when it is live.` };
    case 'story_rejected':
      return { subject: 'About your Story on BiteSite', text: `${hi} thank you for your Story. We are not able to publish this one.${reason}\n\nYou are welcome to send another Story here:\n${site}/merchant/stories` };
    case 'story_changes':
      return { subject: 'Your Story needs a few changes', text: `${hi} thank you for your Story. Please make a few changes and send it again:${reason}\n\n${site}/merchant/stories` };
    case 'menu_added':
      return { subject: 'Your menu is on BiteSite', text: `${hi} thank you for the menu photos. Your menu is now on BiteSite:
${page}

Please check the dishes and prices, and fix anything we got wrong in your dashboard (Menu section):
${dashboard}` };
    case 'story_published': {
      const story = storySlug ? `${site}/stories/${encodeURIComponent(storySlug)}` : `${site}/merchant/stories`;
      return { subject: 'Your Story is live on BiteSite', text: `${hi} your Story is now live on BiteSite. Have a look and feel free to share it:\n${story}` };
    }
    default:
      return { subject: 'BiteSite', text: `${hi}` };
  }
}
