// DEPRECATED: This file is maintained for backward compatibility
// New code should import directly from expoPushSetup.js instead

export {
  initializeChatPush as ensureChatFCM,
  initializeChatPush,
  shouldSuppressChatNotification,
  setChatNotificationSuppressor,
  registerBackgroundHandler,
  registerbackgroundhander, // legacy typo alias
  enablePushRegistration,
  enablePushAfterLogin,
  flushPendingPushInit,
  getPushInitState,
  getCurrentPushToken,
  sendTestNotification
} from './expoPushSetup';
