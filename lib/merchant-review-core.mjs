import { mapFieldRpcError } from './merchant-field-patch-core.mjs';

export const LISTING_BASICS_PATHS = Object.freeze(['profile.name', 'location', 'tags.cuisine']);
export const MAX_REVIEW_BODY_BYTES = 8 * 1024;
export const CHECK_LABELS = Object.freeze({ name: 'Restaurant name', address: 'Address', contact: 'Phone, WhatsApp or email', category: 'Cuisine (at least one)', dish: 'At least one dish in the menu' });
const uuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const invalid = (message = 'Invalid request.') => ({ ok: false, status: 400, code: 'VALIDATION_FAILED', message });
const keys = (v, allowed) => object(v) && Object.keys(v).every((k) => allowed.includes(k));

export function isListingBasicsPatch(body) {
  return object(body) && Array.isArray(body.patches) && body.patches.length > 0 && body.patches.every((p) => object(p) && LISTING_BASICS_PATHS.includes(p.path));
}
export function parseListingAction(body) {
  if (!keys(body, ['requestId', 'action']) || !uuid(body.requestId)) return invalid();
  if (!['submit', 'withdraw', 'publish', 'hide', 'discard'].includes(body.action)) return invalid('Unknown action.');
  return { ok: true, requestId: body.requestId, action: body.action };
}
export function parseReviewDecision(body) {
  if (!keys(body, ['requestId', 'submissionId', 'decision', 'note']) || !uuid(body.requestId) || !uuid(body.submissionId)) return invalid();
  if (!['approve', 'reject'].includes(body.decision)) return invalid('Unknown decision.');
  if (body.note != null && typeof body.note !== 'string') return invalid('The note must be text.');
  const note = body.note?.trim() || null;
  if (body.decision === 'reject' && !note) return invalid('Please explain what the restaurant needs to change.');
  if (note && [...note].length > 1000) return invalid('The note can be at most 1000 characters.');
  return { ok: true, requestId: body.requestId, submissionId: body.submissionId, decision: body.decision, note };
}
export function parseCapacity(body) {
  if (!keys(body, ['capacity', 'pilotCapacity']) || !Number.isInteger(body.capacity) || body.capacity < 0 || body.capacity > 1000) return invalid('Enter a whole number from 0 to 1000.');
  if (body.pilotCapacity !== undefined && (!Number.isInteger(body.pilotCapacity) || body.pilotCapacity < 0 || body.pilotCapacity > 100000)) return invalid('Enter a pilot limit from 0 to 100000.');
  return { ok: true, capacity: body.capacity, ...(body.pilotCapacity !== undefined ? { pilotCapacity: body.pilotCapacity } : {}) };
}
export function mapReviewRpcError(error) {
  const code = error?.message?.trim();
  const detail = typeof error?.details === 'string' ? error.details : '';
  if (error?.code === 'P0001') {
    const messages = {
      REVIEW_ONE_PENDING: 'You already have a restaurant waiting for review. Wait for a decision or withdraw it first.',
      REVIEW_CAPACITY_FULL: 'BiteSite is reviewing many restaurants right now. Please try again in a few days.',
      PILOT_CAPACITY_FULL: 'The pilot is currently full. Your draft is saved; please try again when more places open.',
      LISTING_ACTION_NOT_ALLOWED: 'This action is not available for the current restaurant status. Refresh the listing status and try again.',
      SUBMISSION_CHANGED: 'The content changed after submission. Reject this request with a note and ask the restaurant to submit again.',
    };
    if (messages[code]) return { status: 409, code, message: messages[code] };
    if (code === 'LISTING_INCOMPLETE') return { status: 422, code, message: `Complete these before continuing: ${detail.split(',').map((k) => CHECK_LABELS[k]).filter(Boolean).join(', ') || 'restaurant details'}.` };
    if (code === 'VALIDATION_FAILED' && detail === 'not_pending') return { status: 409, code, message: 'This submission has already been decided or withdrawn.' };
    if (code === 'VALIDATION_FAILED' && detail === 'note_required') return { status: 400, code, message: 'Please write a reason for the restaurant.' };
    if (code === 'RESOURCE_NOT_FOUND' && detail === 'submission') return { status: 404, code, message: 'Submission not found.' };
    if (code === 'FIELD_NOT_WRITABLE' && detail === 'listing_basics_locked') return { status: 403, code, message: 'Restaurant basics can only be edited in a draft or after changes are requested.' };
  }
  return mapFieldRpcError(error);
}
