import { randomUUID } from 'crypto';
import type { User } from '@supabase/supabase-js';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';

export const PAYMENT_ADMIN_EMAIL = 'admin@5gnu.com';
export const PAYMENT_RECEIPT_BUCKET = 'payment-receipts';
export const MAX_PAYMENT_AMOUNT_MINOR = 100_000_000;
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
export const ORDER_VALIDITY_HOURS = 24;

const RECEIPT_TYPES = {
  'image/jpeg': {
    extension: 'jpg',
    matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  },
  'image/png': {
    extension: 'png',
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
  },
  'image/webp': {
    extension: 'webp',
    matches: (bytes: Uint8Array) =>
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  },
  'application/pdf': {
    extension: 'pdf',
    matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
  }
} as const;

export type ReceiptContentType = keyof typeof RECEIPT_TYPES;

export function bearerToken(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

export async function authenticatePaymentRequest(request: Request) {
  const supabase = getServerSupabase();
  const token = bearerToken(request);
  if (!token) return { supabase, user: null as User | null };
  const { data, error } = await supabase.auth.getUser(token);
  return { supabase, user: error ? null : data.user };
}

export function isPaymentAdmin(email?: string | null) {
  return email?.trim().toLowerCase() === PAYMENT_ADMIN_EMAIL;
}

export function parseAmountToMinor(value: unknown): number | null {
  const amount = String(value ?? '').trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ''] = amount.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor < 1 || minor > MAX_PAYMENT_AMOUNT_MINOR) return null;
  return minor;
}

export function createPaymentReference() {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `FPS-${day}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export function createAirwallexReference() {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `AWX-${day}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export async function verifyReceiptFile(file: File) {
  if (!file.size || file.size > MAX_RECEIPT_SIZE) {
    throw new Error('Receipt must be no larger than 5MB.');
  }

  const expected = RECEIPT_TYPES[file.type as ReceiptContentType];
  if (!expected) throw new Error('Receipt must be a JPG, PNG, WebP, or PDF file.');

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!expected.matches(bytes)) throw new Error('Receipt content does not match its file type.');

  return { extension: expected.extension, contentType: file.type as ReceiptContentType };
}

export async function ensurePaymentReceiptBucket(supabase: ReturnType<typeof getServerSupabase>) {
  const { data } = await supabase.storage.getBucket(PAYMENT_RECEIPT_BUCKET);
  if (data) return;

  const { error } = await supabase.storage.createBucket(PAYMENT_RECEIPT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_RECEIPT_SIZE,
    allowedMimeTypes: Object.keys(RECEIPT_TYPES)
  });
  if (error && !error.message.toLowerCase().includes('already exists')) throw error;
}

export async function verifyPaymentOrgMembership(
  supabase: ReturnType<typeof getServerSupabase>,
  userId: string,
  organizationId: string
) {
  if (!organizationId) return true;
  const { data } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('profile_id', userId)
    .eq('verified', true)
    .maybeSingle();
  return !!data;
}

export function safeReceiptOriginalName(fileName: string) {
  return (
    fileName
      .normalize('NFC')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 160) || 'receipt'
  );
}
