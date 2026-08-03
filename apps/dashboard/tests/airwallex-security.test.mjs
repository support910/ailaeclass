import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  airwallexAmountToMinor,
  verifyAirwallexWebhookSignature
} from '../src/lib/server/payments/airwallexSecurity.js';

test('valid Airwallex webhook signature is accepted', () => {
  const timestamp = '1720000000000';
  const rawBody = '{"id":"evt_123","name":"payment_intent.succeeded"}';
  const secret = 'test_webhook_secret';
  const signature = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('hex');

  assert.equal(
    verifyAirwallexWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      now: Number(timestamp) + 30_000
    }),
    true
  );
});
test('tampered, stale, and malformed webhook signatures are rejected', () => {
  const timestamp = '1720000000000';
  const rawBody = '{"id":"evt_123"}';
  const secret = 'test_webhook_secret';
  const signature = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('hex');

  assert.equal(
    verifyAirwallexWebhookSignature({
      rawBody: `${rawBody} `,
      timestamp,
      signature,
      secret,
      now: Number(timestamp)
    }),
    false
  );
  assert.equal(
    verifyAirwallexWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      now: Number(timestamp) + 10 * 60 * 1000
    }),
    false
  );
  assert.equal(
    verifyAirwallexWebhookSignature({
      rawBody,
      timestamp,
      signature: 'bad',
      secret,
      now: Number(timestamp)
    }),
    false
  );
});

test('Airwallex decimal amounts convert without floating-point rounding', () => {
  assert.equal(airwallexAmountToMinor('12.34'), 1234);
  assert.equal(airwallexAmountToMinor(100), 10000);
  assert.equal(airwallexAmountToMinor('0.01'), 1);
  assert.equal(airwallexAmountToMinor('12.345'), null);
  assert.equal(airwallexAmountToMinor('-1'), null);
});
