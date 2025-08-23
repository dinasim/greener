// Backend push notifications module
const crypto = require('crypto');
const { CosmosClient } = require('@azure/cosmos');

const cosmosConn = process.env.COSMOSDB_MARKETPLACE_CONNECTION_STRING || process.env.COSMOS_CONN;
const dbName = process.env.COSMOSDB_MARKETPLACE_DATABASE_NAME;
const tokensContainerName = 'notifications';

if (!cosmosConn || !dbName) {
  throw new Error('Cosmos settings missing: COSMOSDB_MARKETPLACE_CONNECTION_STRING and COSMOSDB_MARKETPLACE_DATABASE_NAME required');
}

const cosmos = new CosmosClient(cosmosConn);
const tokensContainer = cosmos.database(dbName).container(tokensContainerName);

let containerChecked = false;

async function ensureContainer() {
  if (containerChecked) return;
  try {
    await tokensContainer.read(); // throws if not exists
  } catch (e) {
    console.error('[notificationSender] notifications container missing. Create container "notifications" with partition key /userId');
  }
  containerChecked = true;
}

function shortHash(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
}

// Store token with proper provider handling
async function storeToken(userId, token, platform, provider = 'expo') {
  await ensureContainer();
  
  const id = `${userId}:${shortHash(token)}`;
  const now = new Date().toISOString();
  
  const tokenDoc = {
    id,
    userId,
    token,
    platform,
    provider, // Use the actual provider parameter
    valid: true,
    createdAt: now,
    lastSeenAt: now
  };

  try {
    await tokensContainer.items.upsert(tokenDoc);
    console.log(`Token stored for user ${userId} with provider ${provider}`);
    return { id, success: true };
  } catch (error) {
    console.error('Error storing token:', error);
    throw error;
  }
}

// Fetch valid tokens for multiple users
async function fetchValidTokens(userIds) {
  if (!userIds || !userIds.length) return [];
  
  const tokens = [];
  
  try {
    for (const userId of userIds) {
      const { resources } = await tokensContainer.items.query({
        query: 'SELECT c.token, c.id, c.provider, c.platform FROM c WHERE c.userId = @uid AND c.valid = true',
        parameters: [{ name: '@uid', value: userId }]
      }).fetchAll();
      
      resources.forEach(r => tokens.push({
        userId,
        token: r.token,
        docId: r.id,
        provider: r.provider || 'expo',
        platform: r.platform
      }));
    }
    
    console.log(`Fetched ${tokens.length} valid tokens for ${userIds.length} users`);
    return tokens;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }
}

// Mark tokens as invalid
async function markInvalid(docIds) {
  if (!docIds || !docIds.length) return;
  
  const promises = docIds.map(async (id) => {
    try {
      const userId = id.split(':')[0];
      const { resource } = await tokensContainer.item(id, userId).read();
      
      if (resource) {
        resource.valid = false;
        resource.lastError = 'DeviceNotRegistered';
        resource.updatedAt = new Date().toISOString();
        await tokensContainer.items.upsert(resource);
        console.log(`Marked token ${id} as invalid`);
      }
    } catch (error) {
      console.error(`Error marking token ${id} as invalid:`, error);
    }
  });
  
  await Promise.allSettled(promises);
}

// Send Expo push notifications
async function sendExpoPushNotifications({ recipients, title, body, data = {}, log = console.log }) {
  if (!recipients || !recipients.length) {
    return { sent: 0, invalid: 0 };
  }

  // Filter for Expo tokens only
  const expoRecipients = recipients.filter(r => 
    r.provider === 'expo' && 
    r.token && 
    r.token.startsWith('ExponentPushToken[')
  );

  if (!expoRecipients.length) {
    log('No valid Expo tokens found');
    return { sent: 0, invalid: 0 };
  }

  // Split into chunks of 100 (Expo's limit)
  const chunks = [];
  for (let i = 0; i < expoRecipients.length; i += 100) {
    chunks.push(expoRecipients.slice(i, i + 100));
  }

  let totalSent = 0;
  const invalidIds = [];

  for (const chunk of chunks) {
    const messages = chunk.map(recipient => ({
      to: recipient.token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      channelId: 'chat-messages' // Android channel
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        },
        body: JSON.stringify(messages)
      });

      if (!response.ok) {
        throw new Error(`Expo API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const results = Array.isArray(result) ? result : result.data;

      if (results) {
        results.forEach((res, index) => {
          if (res.status === 'ok') {
            totalSent++;
          } else if (res.status === 'error') {
            log(`Expo push error for token ${chunk[index].token.slice(0, 20)}...: ${res.message}`);
            
            // Mark invalid tokens
            if (res.details?.error === 'DeviceNotRegistered' || 
                res.message?.includes('not registered')) {
              invalidIds.push(chunk[index].docId);
            }
          }
        });
      }

      log(`Sent ${totalSent} Expo notifications in chunk of ${chunk.length}`);
    } catch (error) {
      log(`Expo push error for chunk: ${error.message}`);
    }
  }

  // Mark invalid tokens
  if (invalidIds.length > 0) {
    await markInvalid(invalidIds);
  }

  return { sent: totalSent, invalid: invalidIds.length };
}

// Main function to send chat notifications
async function sendChatMessageNotificationsCombined({ tokens, title, body, data = {}, log = console.log }) {
  if (!tokens || !tokens.length) {
    return {
      expoSent: 0,
      expoInvalid: 0,
      fcmSent: 0,
      fcmInvalid: 0,
      total: 0
    };
  }

  // Separate tokens by provider
  const expoTokens = tokens.filter(t => t.provider === 'expo');
  const fcmTokens = tokens.filter(t => t.provider === 'fcm');

  log(`Sending to ${expoTokens.length} Expo tokens and ${fcmTokens.length} FCM tokens`);

  // Send Expo notifications
  const expoResult = await sendExpoPushNotifications({
    recipients: expoTokens,
    title,
    body,
    data,
    log
  });

  // FCM sending would go here if implemented
  // For now, just log FCM tokens
  if (fcmTokens.length > 0) {
    log(`FCM sending not implemented yet, skipping ${fcmTokens.length} FCM tokens`);
  }

  const totalSent = expoResult.sent;
  const totalInvalid = expoResult.invalid;

  log(`Notification results: ${totalSent} sent, ${totalInvalid} invalid tokens marked`);

  return {
    expoSent: expoResult.sent,
    expoInvalid: expoResult.invalid,
    fcmSent: 0, // Not implemented yet
    fcmInvalid: 0, // Not implemented yet
    total: totalSent
  };
}

// Helper function to update device token (for the API endpoint)
async function updateDeviceToken(req, res) {
  try {
    const { userId, email, token, platform, provider = 'expo' } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const userIdentifier = userId || email;
    if (!userIdentifier) {
      return res.status(400).json({ error: 'userId or email is required' });
    }

    const result = await storeToken(userIdentifier, token, platform, provider);
    
    res.json({ 
      success: true, 
      message: 'Device token updated successfully',
      id: result.id
    });
  } catch (error) {
    console.error('Error updating device token:', error);
    res.status(500).json({ error: 'Failed to update device token' });
  }
}

module.exports = {
  storeToken,
  fetchValidTokens,
  sendChatMessageNotificationsCombined,
  sendExpoPushNotifications,
  markInvalid,
  updateDeviceToken
};