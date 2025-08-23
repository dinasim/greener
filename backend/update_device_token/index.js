// OBSOLETE: Python implementation in __init__.py handles this endpoint.

// Backward-compatible endpoint (same logic as register_device_token)
const { storeToken } = require('../shared/notificationSender');

module.exports = async function (context, req) {
  const body = req.body || {};
  const { userId, email, token, platform = 'android', provider = 'expo' } = body;

  context.log('[update_device_token] incoming', {
    userId,
    email,
    provider,
    platform,
    tokenPreview: token ? token.slice(0, 16) + '...' : null
  });

  try {
    const idValue = userId || email;
    if (!idValue || !token) {
      context.res = { status: 400, body: { error: 'userId/email and token required' } };
      return;
    }
    if (provider === 'expo' && !/^ExponentPushToken\[[A-Za-z0-9\-+/_=]+\]$/.test(token)) {
      context.res = { status: 400, body: { error: 'invalid expo token' } };
      return;
    }

    await storeToken(idValue, token, platform, provider);
    context.res = { status: 200, body: { ok: true } };
  } catch (e) {
    context.log.error('[update_device_token] error', e);
    context.res = { status: 500, body: { error: 'internal' } };
  }
};
