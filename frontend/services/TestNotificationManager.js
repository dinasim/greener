// services/TestNotificationManager.js
// This file has been intentionally emptied.
// The test notification functionality that sent notifications every 30 seconds has been removed.

class TestNotificationManager {
  constructor(notificationManager) {
    this.notificationManager = notificationManager;
    this.intervalId = null;
  }
  
  // Stub methods to prevent crashes if still referenced somewhere
  async start() {
    // No-op - notification testing functionality removed
    console.log('[TestNotificationManager] Test notifications disabled');
  }
  
  stop() {
    // No-op - notification testing functionality removed
  }
}

export default TestNotificationManager;
