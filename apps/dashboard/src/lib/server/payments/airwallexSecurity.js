import { createHmac, timingSafeEqual } from 'crypto';

export const AIRWALLEX_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * @param {{rawBody: string, timestamp: string, signature: string, secret: string, now?: number, toleranceMs?: number}} input
 */
export function verifyAirwallexWebhookSignature(input) {
  const { rawBody, timestamp, signature, secret } = input;
  if (!rawBody || !timestamp || !signature || !secret) return false;

  const timestampMs = Number(timestamp);
  const now = input.now ?? Date.now();
  const toleranceMs = input.toleranceMs ?? AIRWALLEX_WEBHOOK_TOLERANCE_MS;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > toleranceMs) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}${rawBody}`, 'utf8').digest('hex');
  const expectedBytes = Buffer.from(expected, 'utf8');
  const receivedBytes = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
/** @param {unknown} value */
export function airwallexAmountToMinor(value) {
  const amount = String(value ?? '').trim();
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ''] = amount.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null;
}
