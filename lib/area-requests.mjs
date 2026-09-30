/** Page-lifetime feedback requests, shared by the two merchant area editors. */
export function createAreaRequests() {
  const attempts = new Map();
  const sent = new Set();
  const sending = new Set();
  const keyOf = (merchantId, area) => `${merchantId}:${area.trim().toLowerCase()}`;
  return {
    isSent: (merchantId, area) => sent.has(keyOf(merchantId, area)),
    async submit({ merchantId, area, address, getHeaders, fetcher = fetch, requestId = () => crypto.randomUUID() }) {
      const key = keyOf(merchantId, area);
      if (sent.has(key) || sending.has(key)) return;
      sending.add(key);
      try {
        const attempt = attempts.get(key) ?? {
          requestId: requestId(), topic: 'listing',
          message: `Please add this area: ${area.trim()}${address?.trim() ? `\nAddress: ${address.trim()}` : ''}`,
        };
        attempts.set(key, attempt);
        const headers = await getHeaders();
        if (!headers) throw new Error('Your session has ended. Sign in again, then retry.');
        const response = await fetcher(`/api/merchant/restaurants/${encodeURIComponent(merchantId)}/feedback`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(attempt),
        });
        const body = await response.json().catch(() => null);
        if (response.status >= 500 || !body) throw new Error('Not confirmed. Retry to send the same request safely.');
        attempts.delete(key);
        if (!response.ok) throw new Error(body.error?.message || 'The request was not sent. Please retry.');
        sent.add(key);
      } finally {
        sending.delete(key);
      }
    },
  };
}
