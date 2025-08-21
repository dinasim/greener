// components/SpeechToTextComponent.js
import React, { useState, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Alert,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
// NOTE: expo-av is deprecated in SDK 54+; migrate to expo-audio when you upgrade SDK.
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { uploadImage, speechToText } from '../services/marketplaceApi';

// Fallback searches for web errors
const PLANT_SEARCH_QUERIES = [
  'monstera plant','snake plant','fiddle leaf fig','pothos','succulents',
  'herb garden','cacti','bonsai tree','air plant','peace lily'
];

const SpeechToTextComponent = ({ onTranscriptionResult, style }) => {
  // UI state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingStatus, setTranscribingStatus] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Re-entrancy guards
  const startingRef  = useRef(false);
  const stoppingRef  = useRef(false);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Recording refs (avoid state race conditions)
  const recordingRef = useRef(null);       // holds Audio.Recording (native)
  const isRecordingRef = useRef(false);    // true while recording

  // Timers/handles
  const recordingTimer = useRef(null);     // duration counter
  const autoStopTimer  = useRef(null);     // safety auto-stop

  // Web audio refs
  const audioContext   = useRef(null);
  const audioStream    = useRef(null);
  const audioProcessor = useRef(null);
  const audioData      = useRef([]);       // Float32[] chunks OR Blob
  const audioRecorder  = useRef(null);

  useEffect(() => {
    return () => { void cleanupRecording(); }; // on unmount
  }, []);

  /** ---------- Helpers ---------- */
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  };
  const stopPulse = () => {
    Animated.timing(pulseAnim).stop();
    pulseAnim.setValue(1);
  };

  const getRandomSearchQuery = () => {
    const i = Math.floor(Math.random() * PLANT_SEARCH_QUERIES.length);
    return PLANT_SEARCH_QUERIES[i];
  };

  const safeStopAndUnload = async (rec) => {
    if (!rec) return;
    try {
      const status = await rec.getStatusAsync();
      if (status?.isRecording || status?.canRecord || !status?.isDoneRecording) {
        try { await rec.stopAndUnloadAsync(); } catch {}
      }
    } catch {}
  };

  const cleanupRecording = async () => {
    try {
      if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
      if (autoStopTimer.current)  { clearTimeout(autoStopTimer.current);    autoStopTimer.current  = null; }

      // Native cleanup
      if (recordingRef.current) {
        try { await safeStopAndUnload(recordingRef.current); } catch {}
      }
      recordingRef.current = null;
      isRecordingRef.current = false;

      // Web cleanup
      try {
        if (audioRecorder.current && audioRecorder.current.state !== 'inactive') {
          audioRecorder.current.stop();
        }
      } catch {}
      audioRecorder.current = null;

      try { if (audioProcessor.current) audioProcessor.current.disconnect(); } catch {}
      audioProcessor.current = null;

      try {
        if (audioContext.current && audioContext.current.state !== 'closed') {
          await audioContext.current.close();
        }
      } catch {}
      audioContext.current = null;

      try {
        if (audioStream.current) {
          audioStream.current.getTracks().forEach(t => t.stop());
        }
      } catch {}
      audioStream.current = null;

      audioData.current = [];
      stopPulse();
      setRecordingDuration(0);
    } catch {}
  };

  /** ---------- Web: minimal WAV creation from AudioBuffer ---------- */
  const writeString = (view, offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  const createWavFromAudioBuffer = (audioBuffer) => {
    const targetSampleRate = 16000;
    const numChannels = 1;

    let mono = audioBuffer.getChannelData(0);
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const ratio  = targetSampleRate / audioBuffer.sampleRate;
      const newLen = Math.floor(mono.length * ratio);
      const resampled = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) resampled[i] = mono[Math.floor(i / ratio)];
      mono = resampled;
    }

    const int16 = new Int16Array(mono.length);
    for (let i = 0; i < mono.length; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + int16.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, int16.length * 2, true);

    return new Blob([header, int16.buffer], { type: 'audio/wav' });
  };

  /** ---------- Start/Stop (toggle) ---------- */
  const startRecording = async () => {
    if (startingRef.current || isRecordingRef.current) return;
    startingRef.current = true;

    try {
      // Clean any zombie recorder first
      await safeStopAndUnload(recordingRef.current);

      if (Platform.OS !== 'web') {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission denied', 'Microphone access is required for voice search.');
          startingRef.current = false;
          return;
        }
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
          });
        } catch {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: true });
        }
      }

      // Web vs native
      if (Platform.OS === 'web') {
        await startWebRecording();
      } else {
        await startNativeRecording();
      }

      isRecordingRef.current = true;

      // UI timers/animations
      startPulse();
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
      // Auto-stop as a safety (adjust if you want longer)
      autoStopTimer.current = setTimeout(() => { void stopRecording(); }, 8000);

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      await safeStopAndUnload(recordingRef.current);
      Alert.alert('Recording Error', err?.message || 'Failed to start voice recording.');
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = async () => {
    if (stoppingRef.current || !isRecordingRef.current) return;
    stoppingRef.current = true;

    // clear UI timers
    if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    if (autoStopTimer.current)  { clearTimeout(autoStopTimer.current);    autoStopTimer.current  = null; }
    stopPulse();

    let audioUri = null;
    let audioBlob = null;
    const isWeb = Platform.OS === 'web';

    try {
      if (isWeb) {
        // Stop MediaRecorder, close context/stream
        try {
          if (audioRecorder.current && audioRecorder.current.state !== 'inactive') {
            const stopped = new Promise(resolve => { audioRecorder.current.onstop = resolve; });
            audioRecorder.current.stop();
            await stopped;
          }
        } catch (e) { console.warn('MediaRecorder stop error:', e); }

        try { if (audioProcessor.current) audioProcessor.current.disconnect(); } catch {}
        audioProcessor.current = null;

        try {
          if (audioContext.current && audioContext.current.state !== 'closed') {
            await audioContext.current.close();
          }
        } catch {}
        audioContext.current = null;

        try {
          if (audioStream.current) {
            audioStream.current.getTracks().forEach(t => t.stop());
          }
        } catch {}
        audioStream.current = null;

        // Use data we captured
        if (audioData.current instanceof Blob) {
          // Best effort: decode/resample to wav
          try {
            const arr = await audioData.current.arrayBuffer();
            const Ctx = window.AudioContext || window.webkitAudioContext;
            const ctx = new Ctx();
            const decoded = await ctx.decodeAudioData(arr);
            const wav = createWavFromAudioBuffer(decoded);
            audioBlob = wav;
            audioUri = URL.createObjectURL(wav);
            ctx.close();
          } catch (e) {
            // fallback: send original blob
            audioBlob = audioData.current;
            audioUri = URL.createObjectURL(audioBlob);
          }
        } else if (Array.isArray(audioData.current) && audioData.current.length > 0) {
          // ScriptProcessor path
          const Ctx = window.AudioContext || window.webkitAudioContext;
          const ctx = new Ctx();
          const total = audioData.current.reduce((n, cur) => n + cur.length, 0);
          const buf = ctx.createBuffer(1, total, ctx.sampleRate);
          let offset = 0;
          for (const chunk of audioData.current) {
            buf.copyToChannel(chunk, 0, offset);
            offset += chunk.length;
          }
          const wav = createWavFromAudioBuffer(buf);
          audioBlob = wav;
          audioUri = URL.createObjectURL(wav);
          ctx.close();
        }
      } else if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status?.isRecording || status?.canRecord) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch {}
        // Give the OS a moment to finalize file
        await new Promise(r => setTimeout(r, 80));
        audioUri = recordingRef.current.getURI?.() || null;

        // IMPORTANT: drop the old instance so the next start creates a new one
        try { await safeStopAndUnload(recordingRef.current); } catch {}
        recordingRef.current = null;
      }
    } catch (e) {
      console.error('Error while stopping recording:', e);
    } finally {
      isRecordingRef.current = false;
      stoppingRef.current = false;
    }

    if (!audioUri && !audioBlob) {
      console.log('No audio captured; skipping transcription');
      return;
    }

    // Upload + transcribe
    setIsTranscribing(true);
    setTranscribingStatus('Uploading audio...');

    try {
      let uploadResult;

      if (isWeb && audioBlob) {
        // Upload blob as WAV
        const form = new FormData();
        form.append('file', new File([audioBlob], `speech_${Date.now()}.wav`, { type: 'audio/wav' }));
        form.append('type', 'speech');
        form.append('contentType', 'audio/wav');

        const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
        const resp = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
        uploadResult = await resp.json();
      } else {
        uploadResult = await uploadImage(audioUri, 'speech', 'audio/m4a');
      }

      if (!uploadResult?.url) throw new Error('Audio upload failed (no URL).');

      setTranscribingStatus('Transcribing...');
      const transcription = await speechToText(uploadResult.url);

      if (transcription && transcription.trim()) {
        onTranscriptionResult?.(transcription);
      } else {
        throw new Error('No text recognized');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      if (isWeb) {
        onTranscriptionResult?.(getRandomSearchQuery());
      } else {
        Alert.alert('Voice Search Error', 'Could not transcribe audio. Please try again.');
      }
    } finally {
      setIsTranscribing(false);
      setTranscribingStatus('');
    }
  };

  /** ---------- Platform-specific recorders ---------- */
  const startNativeRecording = async () => {
    // Drop any old instance (even if previously unloaded)
    if (recordingRef.current) {
      await safeStopAndUnload(recordingRef.current);
      recordingRef.current = null;
    }

    // Fresh instance – avoids "already prepared" edge cases
    const rec = new Audio.Recording();
    recordingRef.current = rec;

    const options = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
    };

    // Tiny debounce for some OEMs that get cranky
    await new Promise(r => setTimeout(r, 50));

    await rec.prepareToRecordAsync(options);
    await rec.startAsync();

    return rec;
  };

  const startWebRecording = async () => {
    // Prefer MediaRecorder
    audioStream.current = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 44100 }
    });

    audioData.current = [];
    if ('MediaRecorder' in window) {
      const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
      const mimeType = types.find(t => window.MediaRecorder.isTypeSupported(t)) || 'audio/webm';
      const chunks = [];
      audioRecorder.current = new MediaRecorder(audioStream.current, { mimeType, audioBitsPerSecond: 128000 });
      audioRecorder.current.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
      audioRecorder.current.onstop = () => { audioData.current = new Blob(chunks, { type: mimeType }); };
      audioRecorder.current.start(100); // request small chunks
      return;
    }

    // Fallback: ScriptProcessor
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioContext.current = new Ctx({ sampleRate: 44100 });
    const source = audioContext.current.createMediaStreamSource(audioStream.current);
    audioProcessor.current = audioContext.current.createScriptProcessor(4096, 1, 1);
    audioProcessor.current.onaudioprocess = (e) => {
      if (!isRecordingRef.current) return;
      audioData.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(audioProcessor.current);
    audioProcessor.current.connect(audioContext.current.destination);
  };

  /** ---------- UI: single-tap toggle ---------- */
  const onMicPress = () => {
    if (isTranscribing || startingRef.current || stoppingRef.current) return;
    if (isRecordingRef.current) { void stopRecording(); }
    else { void startRecording(); }
  };

  return (
    <TouchableOpacity
      onPress={onMicPress}
      disabled={isTranscribing || startingRef.current || stoppingRef.current}
      style={[styles.micButton, style]}
      accessibilityLabel="Voice search"
      accessibilityHint="Tap to start or stop voice search"
    >
      {isTranscribing ? (
        <View style={styles.transcribingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.transcribingText} numberOfLines={1}>{transcribingStatus}</Text>
        </View>
      ) : isRecordingRef.current ? (
        <View style={styles.recordingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <MaterialIcons name="mic" size={22} color="#f44336" />
          </Animated.View>
          <Text style={styles.recordingText}>{recordingDuration}s</Text>
        </View>
      ) : (
        <MaterialIcons name="mic" size={22} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  micButton: { padding: 6 },
  recordingContainer: { flexDirection: 'row', alignItems: 'center' },
  recordingText: { marginLeft: 4, fontSize: 12, color: '#f44336' },
  transcribingContainer: { flexDirection: 'row', alignItems: 'center' },
  transcribingText: { marginLeft: 4, fontSize: 10, color: '#4CAF50', maxWidth: 120 },
});

export default SpeechToTextComponent;
