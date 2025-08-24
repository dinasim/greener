// notifications/chatFCMSetup.js
import { Platform } from 'react-native';

const SAVE_TOKEN_API = 'https://usersfunctions.azurewebsites.net/api/saveDeviceToken';
// If your function uses authLevel:function, include the key (TEMP for testing):
const FUNCTIONS_KEY = ''; // e.g. 'abc123...' or leave '' if anonymous

const sessionDone = new Set();

async function postToken(userIdOrEmail, token) {
  const url = FUNCTIONS_KEY ? `${SAVE_TOKEN_API}?code=${encodeURIComponent(FUNCTIONS_KEY)}` : SAVE_TOKEN_API;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userIdOrEmail, token, platform: Platform.OS, app: 'greener' }),
  });
  const body = await res.text();
  console.log('[FCM] saveDeviceToken ->', res.status, body.slice(0, 200));
  return res.ok; // don’t throw; just report
}

export async function ensureChatFCM(email) {
  if (Platform.OS !== 'android') return null;
  const { getMessaging, requestPermission, getToken, onTokenRefresh } = await import('@react-native-firebase/messaging');
  const messaging = getMessaging();

  try { await requestPermission(messaging); } catch {}

  const token = await getToken(messaging);
  if (!token) return null;

  await postToken(email, token);

  onTokenRefresh(messaging, async (newToken) => { try { await postToken(email, newToken); } catch {} });
  return token;
}

export async function ensureChatFCMOnce(email) {
  if (!email || sessionDone.has(email)) return null;
  sessionDone.add(email);
  try { return await ensureChatFCM(email); }
  catch (e) { console.warn('[FCM] ensureChatFCMOnce error:', e?.message); return null; }
}
