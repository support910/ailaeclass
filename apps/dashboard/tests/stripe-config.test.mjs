import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStripeConfig } from '../src/lib/server/payments/stripeConfig.js';

const validConfig = {
  STRIPE_MODE: 'test',
  STRIPE_CURRENCY: 'HKD',
  STRIPE_SECRET_KEY: 'sk_test_example_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_example_123',
  STRIPE_EXPECTED_ACCOUNT_ID: 'acct_123456789',
  STRIPE_RETURN_URL: 'https://example.com/lms/payment'
};

test('accepts a complete Stripe test-mode configuration', () => {
  const result = parseStripeConfig(validConfig);
  assert.equal(result.configured, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.mode, 'test');
});

test('rejects a live Stripe key while test mode is selected', () => {
  const result = parseStripeConfig({
    ...validConfig,
    STRIPE_SECRET_KEY: 'sk_live_example_123'
  });
  assert.equal(result.configured, false);
  assert.equal(result.issues.includes('STRIPE_MODE'), true);
});

test('allows localhost Stripe returns only in test mode', () => {
  const testResult = parseStripeConfig({
    ...validConfig,
    STRIPE_RETURN_URL: 'http://localhost:5173/lms/payment'
  });
  const liveResult = parseStripeConfig({
    ...validConfig,
    STRIPE_MODE: 'live',
    STRIPE_SECRET_KEY: 'sk_live_example_123',
    STRIPE_RETURN_URL: 'http://localhost:5173/lms/payment'
  });
  assert.equal(testResult.configured, true);
  assert.equal(liveResult.issues.includes('STRIPE_RETURN_URL'), true);
});

test('does not expose an incomplete Stripe configuration as ready', () => {
  const result = parseStripeConfig({ STRIPE_MODE: 'test' });
  assert.equal(result.configured, false);
  for (const field of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_EXPECTED_ACCOUNT_ID',
    'STRIPE_RETURN_URL'
  ]) {
    assert.equal(result.issues.includes(field), true);
  }
});
