import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { parseStripeConfig } from './stripeConfig.js';

type StripeMode = 'test' | 'live';

type StripeConfig = {
  configured: boolean;
  mode: StripeMode;
  currency: 'HKD';
  secretKey: string;
  webhookSecret: string;
  expectedAccountId: string;
  returnUrl: string;
  issues: string[];
};

let clientCache: { key: string; client: Stripe } | null = null;

function config(): StripeConfig {
  return parseStripeConfig(env) as StripeConfig;
}

export function getStripePublicConfig() {
  const current = config();
  return {
    configured: current.configured,
    mode: current.mode,
    currency: current.currency,
    missing: current.issues
  } as const;
}

export function getStripePrivateConfig() {
  const current = config();
  if (!current.configured) throw new Error('STRIPE_NOT_CONFIGURED');
  return current;
}

export function getStripeClient() {
  const current = getStripePrivateConfig();
  if (clientCache?.key === current.secretKey) return clientCache.client;

  const client = new Stripe(current.secretKey, {
    maxNetworkRetries: 2,
    timeout: 15_000
  });
  clientCache = { key: current.secretKey, client };
  return client;
}
