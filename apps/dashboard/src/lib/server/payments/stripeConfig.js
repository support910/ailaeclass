const STRIPE_SECRET_KEY = /^sk_(test|live)_[A-Za-z0-9_]+$/;
const STRIPE_WEBHOOK_SECRET = /^whsec_[A-Za-z0-9_]+$/;
const STRIPE_ACCOUNT_ID = /^acct_[A-Za-z0-9]+$/;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validReturnUrl(value, mode) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return mode === 'test' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function parseStripeConfig(source = {}) {
  const mode = clean(source.STRIPE_MODE).toLowerCase() === 'live' ? 'live' : 'test';
  const currency = clean(source.STRIPE_CURRENCY).toUpperCase() || 'HKD';
  const secretKey = clean(source.STRIPE_SECRET_KEY);
  const webhookSecret = clean(source.STRIPE_WEBHOOK_SECRET);
  const expectedAccountId = clean(source.STRIPE_EXPECTED_ACCOUNT_ID);
  const returnUrl = clean(source.STRIPE_RETURN_URL);
  const keyMatch = secretKey.match(STRIPE_SECRET_KEY);
  const issues = [];

  if (!keyMatch) issues.push('STRIPE_SECRET_KEY');
  else if (keyMatch[1] !== mode) issues.push('STRIPE_MODE');
  if (!STRIPE_WEBHOOK_SECRET.test(webhookSecret)) issues.push('STRIPE_WEBHOOK_SECRET');
  if (!STRIPE_ACCOUNT_ID.test(expectedAccountId)) issues.push('STRIPE_EXPECTED_ACCOUNT_ID');
  if (!validReturnUrl(returnUrl, mode)) issues.push('STRIPE_RETURN_URL');
  if (currency !== 'HKD') issues.push('STRIPE_CURRENCY');

  return {
    configured: issues.length === 0,
    mode,
    currency,
    secretKey,
    webhookSecret,
    expectedAccountId,
    returnUrl,
    issues
  };
}
