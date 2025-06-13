import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useForm } from "../context/FormContext";

const REGISTER_API = 'https://usersfunctions.azurewebsites.net/api/registerUser';

export default function RegistrationScreen({ navigation }) {
  const { formData } = useForm(); // collect extra data from context
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canRegister = username.trim() && password.trim() && email.trim();

  const handleRegister = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      // Combine registration fields and context fields
      const registrationData = {
        username,
        password,
        email,
        // The following are pulled from your FormContext, can be empty string or null if not yet set
        name: formData.name || '',
        intersted: formData.intersted || '',
        animals: formData.animals || '',
        kids: formData.kids || '',
        location: formData.userLocation || null,
        plantLocations: formData.plantLocations || [],
        // ... add any other context fields you want sent to the backend
      };

      const res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSuccessMsg('Registration successful! You can now log in.');
      setLoading(false);
      setTimeout(() => navigation.navigate('LoginUser'), 1200);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1}}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>One Last Stap</Text>
          {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}
          {successMsg ? <Text style={styles.successMsg}>{successMsg}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            editable={!loading}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            autoCapitalize="none"
            onChangeText={setUsername}
            editable={!loading}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.button, !canRegister && { opacity: 0.5 }]}
            disabled={!canRegister || loading}
            onPress={handleRegister}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('LoginUser')}>
            <Text style={styles.toggleText}>Already have an account? Login</Text>
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
  errorMsg: { color: "#c62828", marginBottom: 10, textAlign: "center" },
  successMsg: { color: "#205d29", marginBottom: 10, textAlign: "center" }
});
