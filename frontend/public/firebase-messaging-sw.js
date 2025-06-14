// Firebase Messaging Service Worker for background notifications
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBAKWjXK-zjao231_SDeuOIT8Rr95K7Bk0",
  authDomain: "greenerapp2025.firebaseapp.com",
  projectId: "greenerapp2025",
  storageBucket: "greenerapp2025.appspot.com",
  messagingSenderId: "241318918547",
  appId: "1:241318918547:web:9fc472ce576da839f11066",
  measurementId: "G-8K9XS4GPRM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages
onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const { notification, data } = payload;
  
  // Customize notification
  const notificationTitle = notification?.title || 'Greener App';
  const notificationOptions = {
    body: notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: data?.type || 'general',
    data: data || {},
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: data?.priority === 'high'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      const data = event.notification.data;
      
      // If app is already open, focus and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          
          // Send message to client to handle navigation
          if (data?.screen) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              screen: data.screen,
              params: data.params
            });
          }
          return;
        }
      }
      
      // If app is not open, open it
      let url = self.location.origin;
      if (data?.screen) {
        url += `/#/${data.screen}`;
      }
      
      return clients.openWindow(url);
    })
  );
});
