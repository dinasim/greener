import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');

  const handleSignUp = () => {
    // TODO: Connect to sign-up logic or API
    navigation.navigate('MainTabs'); // ✅ Navigate to your main layout after sign-up
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>הרשמה ל־Greener</Text>
      <TextInput
        style={styles.input}
        placeholder="כתובת מייל"
        value={email}
        onChangeText={setEmail}
      />
      <Button title="הרשם" onPress={handleSignUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 5 },
});
