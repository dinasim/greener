import { initializeChatPush, enablePushAfterLogin, flushPendingPushInit, getPushInitState } from './notifications/expoPushSetup';

// Register after login (Expo push). navigationHandler receives notification data when tapped.
export async function registerAfterLogin(userId, navigationHandler) {
  if (!userId) {
    console.log('[push] abort registerAfterLogin (empty userId)');
    return null;
  }
  
  try {
    console.log('[push] Starting push registration for user:', userId);
    
    // Enable push notifications
    await enablePushAfterLogin();
    
    // Try to initialize push with the user ID
    const token = await initializeChatPush(userId, (notificationData) => {
      console.log('[push] Notification tapped:', notificationData);
      
      // Navigate to appropriate screen based on notification type
      if (navigationHandler) {
        navigationHandler(notificationData);
      }
    });
    
    if (token) {
      console.log('[push] Successfully registered for push notifications');
    } else {
      console.log('[push] Failed to get push token');
    }
    
    return token;
  } catch (e) {
    console.error('[push] Registration error:', e);
    return null;
  }
}

// Usage example:
// await registerAfterLogin(currentUser.id, data => { if (data?.conversationId) navigate('Chat', { conversationId: data.conversationId }); });
//   if (data?.conversationId) navigate('Chat', { conversationId: data.conversationId });
// });
// });
