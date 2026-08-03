import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

type AirwallexMode = 'demo' | 'prod';

type AccessTokenCache = {
  token: string;
  expiresAt: number;
  cacheKey: string;
};

let accessTokenCache: AccessTokenCache | null = null;

function mode(): AirwallexMode {
  return env.AIRWALLEX_ENV?.trim().toLowerCase() === 'prod' ? 'prod' : 'demo';
}

function apiBase() {
  return mode() === 'prod' ? 'https://api.airwallex.com/api/v1' : 'https://api-demo.airwallex.com/api/v1';
}

export function getAirwallexPublicConfig() {
  const clientId = env.AIRWALLEX_CLIENT_ID?.trim() || '';
  const apiKey = env.AIRWALLEX_API_KEY?.trim() || '';
  const returnUrl = env.AIRWALLEX_RETURN_URL?.trim() || '';
  return {
    configured: !!clientId && !!apiKey && /^https:\/\//i.test(returnUrl),
    mode: mode(),
    returnUrlConfigured: /^https:\/\//i.test(returnUrl)
  } as const;
}

export function getAirwallexWebhookSecret() {
  return env.AIRWALLEX_WEBHOOK_SECRET?.trim() || '';
}

function credentials() {
  const clientId = env.AIRWALLEX_CLIENT_ID?.trim() || '';
  const apiKey = env.AIRWALLEX_API_KEY?.trim() || '';
  if (!clientId || !apiKey) throw new Error('AIRWALLEX_NOT_CONFIGURED');
  return { clientId, apiKey };
}

async function parseAirwallexResponse(response: Response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id') || result?.request_id || '';
    console.error('Airwallex API request failed', {
      status: response.status,
      requestId,
      code: result?.code || result?.name || 'unknown'
    });
    throw new Error('AIRWALLEX_REQUEST_FAILED');
  }
  return result;
}

async function accessToken() {
  const { clientId, apiKey } = credentials();
  const cacheKey = `${mode()}:${clientId}`;
  if (accessTokenCache?.cacheKey === cacheKey && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const response = await fetch(`${apiBase()}/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey
    },
    signal: AbortSignal.timeout(12_000)
  });
  const result = await parseAirwallexResponse(response);
  if (!result?.token) throw new Error('AIRWALLEX_AUTH_FAILED');

  const parsedExpiry = Date.parse(result.expires_at || '');
  accessTokenCache = {
    token: result.token,
    expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 25 * 60 * 1000,
    cacheKey
  };
  return result.token as string;
}

function configuredReturnUrl(reference: string, returnPath: string) {
  const configured = env.AIRWALLEX_RETURN_URL?.trim() || '';
  if (!/^https:\/\//i.test(configured)) throw new Error('AIRWALLEX_RETURN_URL_REQUIRED');
  const returnUrl = new URL(configured);
  if (/^\/lms\/payment$/.test(returnPath) || /^\/org\/[^/]+\/payment$/.test(returnPath)) {
    returnUrl.pathname = returnPath;
  }
  returnUrl.searchParams.set('payment', 'airwallex-return');
  returnUrl.searchParams.set('reference', reference);
  return returnUrl.toString();
}

export async function createAirwallexPaymentIntent(input: {
  providerRequestId: string;
  reference: string;
  amountMinor: number;
  payerEmail: string;
  returnPath: string;
}) {
  const token = await accessToken();
  const returnUrl = configuredReturnUrl(input.reference, input.returnPath);
  const response = await fetch(`${apiBase()}/pa/payment_intents/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      request_id: input.providerRequestId || randomUUID(),
      amount: input.amountMinor / 100,
      currency: 'HKD',
      merchant_order_id: input.reference,
      return_url: returnUrl,
      customer: { email: input.payerEmail }
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = await parseAirwallexResponse(response);
  if (!result?.id || !result?.client_secret) throw new Error('AIRWALLEX_INVALID_RESPONSE');
  return {
    intentId: String(result.id),
    clientSecret: String(result.client_secret),
    providerStatus: String(result.status || 'REQUIRES_PAYMENT_METHOD'),
    returnUrl,
    mode: mode()
  };
}
