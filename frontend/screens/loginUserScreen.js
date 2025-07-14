import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useForm } from "../context/FormContext";

const LOGIN_API = 'https://usersfunctions.azurewebsites.net/api/loginUser';

export default function LoginScreen({ navigation }) {
  const { updateFormData } = useForm();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canLogin = username.trim() && password.trim();

  const handleLogin = useCallback(async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      // If you can, batch update (depends on your context logic)
      updateFormData({
        email: data.email,
        username: data.username,
        name: data.name,
        intersted: data.intersted || '',
        animals: data.animals || '',
        kids: data.kids || ''
      });
      navigation.navigate('Home');
    } catch (err) {
      setErrorMsg(err.message);
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
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            editable={!loading}
            returnKeyType="next"
            onSubmitEditing={() => { }}
          />
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
