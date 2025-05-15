// screens/DiseaseCheckerScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  Image,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function DiseaseCheckerScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [debugText, setDebugText] = useState('');  // debug log

  // Pick image from library / camera
  const pickImage = async () => {
    setDebugText('Requesting photo permission…');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setDebugText(`Permission: ${status}`);
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Need photo permission.');
        return;
      }

      setDebugText('Opening image picker…');
      const res = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.7 });
      setDebugText('ImagePicker result: ' + JSON.stringify(res, null, 2));

      if (res.cancelled || (res.assets && res.assets.length === 0)) {
        Alert.alert('Cancelled', 'No image selected.');
        return;
      }

      const uri = res.uri || res.assets[0].uri;
      setImageUri(uri);
      setResult(null);
      setDebugText('Image selected. Tap "Analyze Disease".');
    } catch (err) {
      console.error(err);
      setDebugText('Error in pickImage: ' + err.message);
      Alert.alert('Error', err.message);
    }
  };

  // Convert picked image to base64 and call your Azure proxy→Gemini
  const analyzeImage = async () => {
    if (!imageUri) {
      Alert.alert('No image', 'Pick a photo first.');
      return;
    }

    setDebugText('Reading image and converting to Base64…');
    setLoading(true);
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      setDebugText('Base64 conversion done; calling proxy…');

      const apiRes = await fetch(
        'https://usersfunctions.azurewebsites.net/api/diseaseCheck',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { contentType: 'image', image: { imageBytes: base64 } },
              {
                contentType: 'text',
                role: 'user',
                text: `
Please analyze this plant image and return ONLY a JSON object in the following format, with no extra text:

{
  "diagnosis": "<short disease name or 'healthy'>",
  "treatment": [
    "<step 1 recommendation>",
    "<step 2 recommendation>",
    "..."]
}

Do not wrap in code fences—output raw JSON.
                `.trim(),
              },
            ],
          }),
        }
      );

      if (!apiRes.ok) {
        const txt = await apiRes.text();
        throw new Error(`Status ${apiRes.status}: ${txt}`);
      }

      const json = await apiRes.json();
      setDebugText('Raw proxy response: ' + JSON.stringify(json, null, 2));

      const raw =
        json.candidates?.[0]?.content ||
        json.choices?.[0]?.message?.content ||
        '';
      const parsed = JSON.parse(raw);
      setDebugText('Parsed JSON: ' + JSON.stringify(parsed, null, 2));
      setResult(parsed);
    } catch (err) {
      console.error(err);
      setDebugText('Error in analyzeImage: ' + err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Debug box */}
      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>Debug:</Text>
        <Text style={styles.debugText}>{debugText}</Text>
      </View>

      <Text style={styles.title}>Plant Disease Checker</Text>

      <Button title="Pick or Take Photo" onPress={pickImage} />

      {imageUri && (
        <>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          {!loading && (
            <View style={{ marginVertical: 10 }}>
              <Button title="Analyze Disease" onPress={analyzeImage} />
            </View>
          )}
        </>
      )}

      {loading && <ActivityIndicator size="large" style={{ margin: 20 }} />}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.heading}>Diagnosis:</Text>
          <Text style={styles.diagnosis}>{result.diagnosis}</Text>

          <Text style={[styles.heading, { marginTop: 12 }]}>
            Treatment Steps:
          </Text>
          {result.treatment.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  debugBox: {
    width: '100%',
    backgroundColor: '#fff4e5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  debugTitle: { fontWeight: 'bold', marginBottom: 4 },
  debugText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontSize: 12,
  },
  title: { fontSize: 22, marginBottom: 16, fontWeight: 'bold' },
  preview: { width: 250, height: 250, marginVertical: 12, borderRadius: 8 },
  resultBox: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  heading: { fontSize: 18, fontWeight: '600' },
  diagnosis: { fontSize: 20, marginTop: 4, fontWeight: 'bold' },
  stepRow: { flexDirection: 'row', marginTop: 6 },
  bullet: { marginRight: 8, fontSize: 18 },
  stepText: { flex: 1, fontSize: 16, lineHeight: 22 },
});
