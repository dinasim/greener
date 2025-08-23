import { initializeChatPush } from './notifications/expoPushSetup';

// Register after login (Expo push). navigationHandler receives notification data when tapped.
export async function registerAfterLogin(userId, navigationHandler) {
  try {
    const token = await initializeChatPush(userId, navigationHandler);
    console.log('Expo push token registered', token);
  } catch (e) {
    console.log('registerAfterLogin error', e);
  }
}

// Usage example:
// await registerAfterLogin(currentUser.id, data => { if (data?.conversationId) navigate('Chat', { conversationId: data.conversationId }); });
//   if (data?.conversationId) navigate('Chat', { conversationId: data.conversationId });
// });
