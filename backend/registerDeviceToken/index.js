const { storeToken } = require('../shared/notificationSender');

module.exports = async function (context, req) {
  const body = req.body || {};
  context.log('[registerDeviceToken] incoming', {
    keys: Object.keys(body),
    userId: body.userId,
    provider: body.provider,
    platform: body.platform
  });

  const { userId, token, platform = 'android', provider = 'expo' } = body;

  if (!process.env.COSMOSDB_MARKETPLACE_CONNECTION_STRING || !process.env.COSMOSDB_MARKETPLACE_DATABASE_NAME) {
    context.log.error('[registerDeviceToken] Missing Cosmos env vars');
    context.res = { status: 500, body: { error: 'config' } };
    return;
  }

  try {
    if (!userId || !token) {
      context.res = { status: 400, body: { error: 'userId and token required' } };
      return;
    }
    if (provider === 'expo' && !/^ExponentPushToken\[[A-Za-z0-9\-+/_=]+\]$/.test(token)) {
      context.res = { status: 400, body: { error: 'invalid expo token' } };
      return;
    }

    const result = await storeToken(userId, token, platform, provider);
    context.log('[registerDeviceToken] stored', result);
    context.res = { status: 200, body: { ok: true } };
  } catch (e) {
    context.log.error('[registerDeviceToken] error', e);
    context.res = { status: 500, body: { error: 'internal' } };
  }
};

