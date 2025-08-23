// screens/LoginScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureChatFCM } from '../notifications/chatFCMSetup';

// 🔑 Firebase (react-native-firebase)
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const LOGIN_API = 'https://usersfunctions.azurewebsites.net/api/loginUser';

// --- Helper: make Firebase account/session + ensure profile doc.
// Does NOT throw — it logs and returns null on failure (non-breaking).
async function ensureFirebaseAuthAndProfile(email, password, role /* 'private' | 'business' | null */) {
  try {
    if (!email || !password) {
      console.warn('[Firebase] Skipping ensure: email/password missing');
      return null;
    }

    let userCred = null;
    try {
      // Try normal sign-in first
      userCred = await auth().signInWithEmailAndPassword(email.trim(), password);
    } catch (e) {
      if (e?.code === 'auth/user-not-found') {
        // Create Firebase account if it doesn't exist
        userCred = await auth().createUserWithEmailAndPassword(email.trim(), password);
      } else if (e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password') {
        // Optional best-effort link via anonymous; don't block UX if this fails.
        try {
          const anon = await auth().signInAnonymously();
          const credential = auth.EmailAuthProvider.credential(email.trim(), password);
          const linked = await anon.user.linkWithCredential(credential);
          userCred = linked;
        } catch (linkErr) {
          console.warn('[Firebase] linkWithCredential failed:', linkErr?.code || linkErr?.message);
          return null;
        }
      } else {
        console.warn('[Firebase] signIn failed:', e?.code || e?.message);
        return null;
      }
    }

    const u = userCred?.user || auth().currentUser;
    if (!u) return null;

    // Ensure Firestore users/{uid}
    const userRef = firestore().collection('users').doc(u.uid);
    const snap = await userRef.get();
    const base = {
      uid: u.uid,
      email: u.email,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (!snap.exists) {
      await userRef.set(
        { ...base, createdAt: firestore.FieldValue.serverTimestamp(), role: role ?? null },
        { merge: true }
      );
    } else {
      // Optionally set role once if you want "private" default
      const existing = snap.data() || {};
      const maybeRole = existing.role ?? role ?? null;
      await userRef.set({ ...base, role: maybeRole }, { merge: true });
    }
    return u;
  } catch (err) {
    console.warn('[Firebase] ensureAuth/profile error:', err?.code || err?.message);
    return null;
  }
}

export default function LoginScreen({ navigation }) {
  const { updateFormData } = useForm();
  const [username, setUsername] = useState('');   // backend expects username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canLogin = username.trim() && password.trim();

  const handleLogin = useCallback(async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      // 1) Your existing backend login (unchanged)
      const res = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      // 2) Update your existing form context (unchanged)
      updateFormData({
        email: data.email,
        username: data.username,
        name: data.name,
        intersted: data.intersted || '',
        animals: data.animals || '',
        kids: data.kids || ''
      });

      // 3) Persist your existing keys (unchanged)
      await AsyncStorage.setItem('userEmail', data.email);
      await AsyncStorage.setItem('currentUserId', data.email);

      // 4) NEW: Best-effort Firebase auth + profile (role null/"private")
      // Use the returned email + the password the user typed.
      const fbUser = await ensureFirebaseAuthAndProfile(data.email, password, 'private');
      if (fbUser?.uid) {
        await AsyncStorage.setItem('firebaseUid', fbUser.uid);
      }

      // 5) Notifications (unchanged, still uses email)
      ensureChatFCM(data.email).catch(e => console.warn('[FCM] post-login init failed:', e?.message));

      // 6) Your navigation (unchanged)
      navigation.navigate('Home');
    } catch (err) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [username, password, updateFormData, navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Login</Text>
          {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}

          {/* Keep using username for your backend */}
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            editable={!loading}
            returnKeyType="next"
          />

          {/* Password is shared with Firebase step */}
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={canLogin ? handleLogin : undefined}
          />

          <TouchableOpacity
            style={[styles.button, !canLogin && { opacity: 0.5 }]}
            disabled={!canLogin || loading}
            onPress={handleLogin}
            accessibilityLabel="Login Button"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('SignupPlantsLocation')}
            accessibilityLabel="Go to Signup"
          >
            <Text style={styles.toggleText}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2e7d32', marginBottom: 18, textAlign: "center" },
  input: {
    width: '100%', borderColor: "#ccc", borderWidth: 1, borderRadius: 10, padding: 13,
    fontSize: 16, marginBottom: 12, backgroundColor: "#f8f8fa",
  },
  button: {
    width: '100%', backgroundColor: '#2e7d32', paddingVertical: 15, borderRadius: 10,
    marginTop: 6, marginBottom: 12, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: "bold", fontSize: 17 },
  toggleText: { color: '#2e7d32', marginTop: 8, fontSize: 15, textAlign: "center" },
  errorMsg: { color: "#c62828", marginBottom: 10, textAlign: "center" }
});
