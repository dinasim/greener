import { useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBAKWjXK-zjao231_SDeuOIT8Rr95K7Bk0",
  authDomain: "greenerapp2025.firebaseapp.com",
  projectId: "greenerapp2025",
  storageBucket: "greenerapp2025.appspot.com",
  messagingSenderId: "241318918547",
  appId: "1:241318918547:web:9fc472ce576da839f11066",
  measurementId: "G-8K9XS4GPRM"
};

const vapidKey = "BKF6MrQxSOYR9yI6nZR45zgrz248vA62XXw0232dE8e6CdPxSAoxGTG2e-JC8bN2YwbPZhSX4qBxcSd23sn_nwg";

const app = initializeApp(firebaseConfig);

export default function PushWebSetup() {
  useEffect(() => {
    async function registerWebPush() {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(app);
        const pushToken = await getToken(messaging, { vapidKey });

        // Optionally: save pushToken to your backend!
        // For debugging: console.log("Web push token:", pushToken);

        // Listen for foreground messages (optional)
        onMessage(messaging, (payload) => {
          // Optionally show toast or notification
          // console.log("Web push message:", payload);
        });
      } catch (err) {
        // Optionally: console.error('Web Push registration failed:', err);
      }
    }
    registerWebPush();
  }, []);

  // Nothing is rendered in the UI
  return null;
}
