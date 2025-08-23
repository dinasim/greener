// DEPRECATED: replaced by notifications/expoPushSetup.js
export {
  initializeChatPush as ensureChatFCM,
  initializeChatPush,
  shouldSuppressChatNotification,
  setChatNotificationSuppressor,
  registerBackgroundHandler,
  registerbackgroundhander // legacy typo alias
} from './expoPushSetup';
// NOTE: Remove this file after all imports switched to expoPushSetup.js