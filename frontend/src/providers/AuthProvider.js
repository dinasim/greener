import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';

const AuthCtx = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        setProfile(snap.exists ? snap.data() : null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
