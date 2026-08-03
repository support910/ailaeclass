import { env } from '$env/dynamic/private';

export type HostedPaymentProvider = 'stripe' | 'airwallex';

export function getHostedPaymentProvider(): HostedPaymentProvider {
  return env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'airwallex' ? 'airwallex' : 'stripe';
}
