export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'RequestBodyTooLargeError';
  }
}

export class InvalidJsonBodyError extends Error {
  constructor() {
    super('Invalid JSON');
    this.name = 'InvalidJsonBodyError';
  }
}

// The caller validates the shape for each endpoint, matching Request.json().
export async function readBoundedJson<T = any>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new RequestBodyTooLargeError();
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new RequestBodyTooLargeError();
  try {
    return (raw ? JSON.parse(raw) : {}) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
