// components/MinimalSpeechComponent.js
import React, { useRef, useState, useCallback } from 'react';
import { TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const DEFAULT_LANG = 'en-US';

export default function SpeechToTextComponent({
  onTranscriptionResult,
  onRecordingStateChange,
  style,
  language = DEFAULT_LANG,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const recordingRef = useRef(null);

  const startRecording = useCallback(async () => {
    if (isBusy || isRecording) return;
    
    setIsBusy(true);
    
    try {
      console.log('Requesting microphone permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission denied');
      }

      console.log('Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Use Expo's high quality preset - AssemblyAI accepts any format
      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      onRecordingStateChange?.(true);
      
      console.log('Recording started successfully');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', error.message);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, isRecording, onRecordingStateChange]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    setIsBusy(true);
    
    try {
      console.log('Stopping recording...');
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      setIsRecording(false);
      onRecordingStateChange?.(false);

      if (uri) {
        console.log('Recording saved to:', uri);
        await transcribeWithAssemblyAI(uri);
      } else {
        Alert.alert('Recording Error', 'No audio was recorded.');
      }
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', error.message);
    } finally {
      recordingRef.current = null;
      setIsBusy(false);
    }
  }, [onRecordingStateChange]);

  const transcribeWithAssemblyAI = async (audioUri) => {
    try {
      // Get your free API key from: https://www.assemblyai.com/
      // Sign up for free (no credit card) and get 3 hours/month transcription
      const API_KEY = '9a49f20dbcf54e4b83d3ed4151bd59b2'; // REPLACE THIS WITH YOUR KEY
      
      if (API_KEY === 'YOUR_ASSEMBLYAI_API_KEY') {
        Alert.alert(
          'API Key Required',
          'Please sign up at assemblyai.com (free) and add your API key to the code.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check file info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('Audio file size:', fileInfo.size, 'bytes');
      
      if (fileInfo.size < 1000) {
        Alert.alert('Recording Too Short', 'Please record a longer message.');
        return;
      }

      // Read audio file as base64
      console.log('Reading audio file...');
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to binary
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Step 1: Upload audio to AssemblyAI
      console.log('Uploading audio to AssemblyAI...');
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'authorization': API_KEY,
          'content-type': 'application/octet-stream',
        },
        body: bytes,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('Upload failed:', error);
        throw new Error('Failed to upload audio');
      }

      const { upload_url } = await uploadResponse.json();
      console.log('Audio uploaded successfully');

      // Step 2: Request transcription
      console.log('Requesting transcription...');
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: upload_url,
          language_code: language.split('-')[0], // 'en' from 'en-US'
          // Optional settings for better accuracy:
          punctuate: true,
          format_text: true,
          disfluencies: false, // Remove "um", "uh", etc.
        }),
      });

      if (!transcriptResponse.ok) {
        const error = await transcriptResponse.text();
        console.error('Transcription request failed:', error);
        throw new Error('Failed to start transcription');
      }

      const { id } = await transcriptResponse.json();
      console.log('Transcription started, ID:', id);

      // Step 3: Poll for result (usually takes 3-10 seconds)
      console.log('Waiting for transcription...');
      let result;
      let attempts = 0;
      const maxAttempts = 60; // Max 60 seconds wait

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
          method: 'GET',
          headers: {
            'authorization': API_KEY,
          },
        });

        if (!statusResponse.ok) {
          console.error('Status check failed');
          throw new Error('Failed to check transcription status');
        }
        
        result = await statusResponse.json();
        console.log('Transcription status:', result.status);

        if (result.status === 'completed') {
          break;
        } else if (result.status === 'error') {
          console.error('Transcription error:', result.error);
          throw new Error(result.error || 'Transcription failed');
        }

        attempts++;
      }

      // Step 4: Handle the result
      if (result && result.status === 'completed' && result.text) {
        console.log('Transcription successful:', result.text);
        
        // Remove any trailing punctuation if it's just a period from formatting
        let finalText = result.text;
        if (finalText.endsWith('.') && !finalText.includes(' ')) {
          finalText = finalText.slice(0, -1);
        }
        
        onTranscriptionResult?.(finalText, { isFinal: true });
      } else {
        console.log('No text in transcription result');
        Alert.alert(
          'No Speech Detected',
          'Could not detect clear speech. Please speak clearly and try again.',
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      
      // Provide helpful error messages
      if (error.message.includes('upload')) {
        Alert.alert(
          'Upload Error',
          'Failed to upload audio. Please check your internet connection.',
          [{ text: 'OK' }]
        );
      } else if (error.message.includes('authorization')) {
        Alert.alert(
          'API Key Error',
          'Invalid API key. Please check your AssemblyAI API key.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Transcription Error',
          error.message || 'Failed to transcribe audio. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <TouchableOpacity 
      onPress={isRecording ? stopRecording : startRecording} 
      style={[style, { opacity: isBusy ? 0.6 : 1.0 }]} 
      disabled={isBusy}
    >
      {isBusy ? (
        <ActivityIndicator size="small" color="#333" />
      ) : (
        <MaterialIcons 
          name={isRecording ? 'stop' : 'mic'} 
          size={22} 
          color={isRecording ? '#ff4444' : '#333'} 
        />
      )}
    </TouchableOpacity>
  );
}