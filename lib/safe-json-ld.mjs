/**
 * Serializes JSON-LD for an inline script element without allowing HTML to
 * terminate that element. Keep this as a small ESM module so its regression
 * coverage can exercise the exact serializer used by the application.
 */
export function safeJsonLd(value) {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError("JSON-LD value must be JSON-serializable");
  }

  return serialized
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
