import { MERCHANT_TERMS_VERSION } from './merchant-terms.mjs';

export function validateCredentials(value, newPassword = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { email, password } = value;
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return null;
  if (typeof password !== 'string' || password.length > 1024 || password.length < (newPassword ? 8 : 1)) return null;
  return { email: email.trim().toLowerCase(), password };
}
export function validateRestaurantDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some(key => !['name', 'requestId', 'termsVersion', 'rightsDeclared'].includes(key))) return null;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 120) return null;
  if (typeof value.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)) return null;
  if (value.termsVersion !== MERCHANT_TERMS_VERSION || value.rightsDeclared !== true) return null;
  return { name: value.name.trim(), requestId: value.requestId, termsVersion: MERCHANT_TERMS_VERSION, rightsDeclared: true };
}
