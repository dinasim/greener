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
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// REST (upload + server STT)
import { speechToText, speechToTextRaw, getSpeechToken } from '../services/marketplaceApi';

// Azure Speech SDK (native only)
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

const USE_AZURE_SDK = true;                 // prefer SDK on native
const AUTO_STOP_ON_FIRST_UTTERANCE = true;  // auto stop SDK after 1 utterance

export default function SpeechToTextComponent({
  onTranscriptionResult,
  onRecordingStateChange,
  style,
}) {
  // UI
  const [isTranscribing, setIsTranscribing] = useState(false); // only for REST upload/transcribe
  const [statusText, setStatusText] = useState('');
  const [duration, setDuration] = useState(0);

  // Animation
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  // Mode: 'idle' | 'sdk' | 'rest'
  const modeRef = useRef('idle');
  const [isListeningSdk, setIsListeningSdk] = useState(false);
  const lastSdkErrorAtRef = useRef(0); // backoff when token fails

  // Guards
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);

  // REST/native recording
  const isRecordingRef = useRef(false);
  const recordingRef = useRef(null);
  const recordUriRef = useRef(null);
  const timerRef = useRef(null);
  const autoStopRef = useRef(null);

  // Web recording
  const audioContext = useRef(null);
  const audioStream = useRef(null);
  const audioRecorder = useRef(null);
  const audioData = useRef(null);

  // SDK recognizer
  const recognizerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopSdkListening(true);
      cleanupRecording();
    };
  }, []);

  /* --------------------------- tiny ui helpers --------------------------- */
  const startPulse = () => {
    if (pulseLoop.current) return;
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1.0, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    try { pulseLoop.current?.stop(); } catch {}
    pulseLoop.current = null;
    pulse.setValue(1);
  };

  const beginListeningUI = () => {
    onRecordingStateChange?.(true);
    setStatusText('Listening...');
    startPulse();
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((s) => s + 1), 1000);
  };

  const endListeningUI = () => {
    onRecordingStateChange?.(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopPulse();
    setStatusText('');
    setDuration(0);
  };

  /* ============================= SDK (native) ============================= */

  async function startSdkListening() {
    // token backoff
    const since = Date.now() - lastSdkErrorAtRef.current;
    if (since < 60_000) {
      // use REST for now
      return startRestRecording();
    }

    try {
      modeRef.current = 'sdk';
      setIsListeningSdk(true);
      beginListeningUI();

      // get token from backend
      const { token, region } = await getSpeechToken(); // must return { token, region }

      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      const autoLang = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(['en-US', 'he-IL']);
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      const recognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoLang, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognized = (_s, e) => {
        if (e?.result?.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const txt = (e.result.text || '').trim();
          if (txt && !/^מירכ\.?$/.test(txt)) {
            onTranscriptionResult?.(txt);
          }
          if (AUTO_STOP_ON_FIRST_UTTERANCE) stopSdkListening();
        }
      };

      recognizer.canceled = () => stopSdkListening(true);
      recognizer.sessionStopped = () => stopSdkListening(true);

      await new Promise((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(resolve, reject);
      });
    } catch (err) {
      // remember failure time (avoid loop)
      lastSdkErrorAtRef.current = Date.now();
      // stop any partial SDK state
      await stopSdkListening(true);

      // Inspect error for HTTP status forwarded by apiRequest
      const status = err?.status || (err?.message && (err.message.match(/status (\d+)/) || [])[1]);
      const code = status ? Number(status) : null;

      // If credentials are invalid or service returned 5xx, don't fallback to REST — user asked for SDK-only
      if (code === 401 || code === 403) {
        Alert.alert('Speech SDK error', 'Invalid or missing speech service credentials (check AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).');
        return;
      }
      if (code && code >= 500) {
        Alert.alert('Speech service unavailable', 'Speech token service returned an error. Please try again later.');
        return;
      }

      // For other errors (network, client), optionally fallback to REST
      try {
        await startRestRecording();
      } catch (e) {
        console.warn('[Speech] SDK token failed, and REST fallback also failed:', e);
      }
    }
  }

  async function stopSdkListening(silent = false) {
    if (modeRef.current !== 'sdk' && !isListeningSdk) return;

    setIsListeningSdk(false);
    modeRef.current = 'idle';
    endListeningUI();

    const r = recognizerRef.current;
    recognizerRef.current = null;
    if (!r) return;

    await new Promise((resolve) => {
      try {
        r.stopContinuousRecognitionAsync(
          () => { try { r.close(); } catch {} resolve(); },
          () => { try { r.close(); } catch {} resolve(); },
        );
      } catch {
        try { r.close(); } catch {}
        resolve();
      }
    });

    if (!silent) {
      // nothing extra; SDK delivered text via the event already
    }
  }

  /* ============================ REST / recorder ============================ */

  async function startRestRecording() {
    if (startingRef.current || isRecordingRef.current) return;
    startingRef.current = true;

    try {
      modeRef.current = 'rest';
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000 },
        });
        audioStream.current = stream;

        const types = ['audio/webm;codecs=opus', 'audio/webm'];
        const mimeType = types.find(t => window.MediaRecorder.isTypeSupported(t)) || 'audio/webm';
        const chunks = [];
        audioRecorder.current = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
        audioRecorder.current.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
        audioRecorder.current.onstop = () => { audioData.current = new Blob(chunks, { type: mimeType }); };
        audioRecorder.current.start(250);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission denied', 'Microphone access is required.');
          modeRef.current = 'idle';
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true });

        const rec = new Audio.Recording();
        const opts = {
          android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, numberOfChannels: 1, bitRate: 128000 },
          ios:     { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        };
        await rec.prepareToRecordAsync(opts);
        await rec.startAsync();
        recordingRef.current = rec;
      }

      isRecordingRef.current = true;
      beginListeningUI();

      // safety auto-stop
      autoStopRef.current = setTimeout(() => { stopRestRecording(); }, 8000);
    } catch (e) {
      modeRef.current = 'idle';
      Alert.alert('Recording error', e?.message || 'Could not start recording.');
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRestRecording() {
    if (stoppingRef.current || !isRecordingRef.current) return;
    stoppingRef.current = true;

    // stop UI listening
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;
    endListeningUI();

    let uploadResult = null;

    try {
      if (Platform.OS === 'web') {
        try {
          if (audioRecorder.current && audioRecorder.current.state !== 'inactive') {
            await new Promise((res) => { audioRecorder.current.onstop = res; audioRecorder.current.stop(); });
          }
        } catch {}
        try { audioStream.current?.getTracks().forEach(t => t.stop()); } catch {}
        isRecordingRef.current = false;

        if (!(audioData.current instanceof Blob)) throw new Error('No audio captured.');
        // upload
        setIsTranscribing(true);
        setStatusText('Transcribing...');
        const form = new FormData();
        const isWav = (audioData.current.type || '').includes('wav');
        const name = `speech_${Date.now()}.${isWav ? 'wav' : 'webm'}`;
        form.append('file', new File([audioData.current], name, { type: isWav ? 'audio/wav' : (audioData.current.type || 'audio/webm') }));
        form.append('type', 'speech');
        form.append('contentType', isWav ? 'audio/wav' : (audioData.current.type || 'audio/webm'));
        const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
        const resp = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
        uploadResult = await resp.json();
      } else {
        // native: stop & get file
        try {
          await recordingRef.current?.stopAndUnloadAsync();
        } catch {}
        const uri = recordingRef.current?.getURI();
        recordingRef.current = null;
        isRecordingRef.current = false;
        recordUriRef.current = uri;

        if (!uri) throw new Error('No audio captured.');

        // upload
        setIsTranscribing(true);
        setStatusText('Transcribing...');
        const ext = (uri.split('.').pop() || 'm4a').toLowerCase();
        const contentType = (ext === 'm4a' || ext === 'mp4') ? 'audio/mp4' : 'audio/wav';
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const payload = { file: base64, type: 'speech', filename: `speech_${Date.now()}.${ext}`, contentType };
        const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
        const resp = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`Upload failed (${resp.status}): ${await resp.text()}`);
        uploadResult = await resp.json();
      }

      if (!uploadResult?.url) throw new Error('Upload failed (no URL).');

      // STT
      let text = '';
      try {
        // en first
        text = await speechToText(uploadResult.url, 'en-US');
        if (text && !/[\u0590-\u05FF]/.test(text)) {
          onTranscriptionResult?.(text);
        } else {
          // he next
          const he = await speechToText(uploadResult.url, 'he-IL');
          if (he && he.trim() && !/^מירכ\.?$/.test(he.trim())) {
            onTranscriptionResult?.(he.trim());
          } else {
            // debug
            const dbg = await speechToTextRaw(uploadResult.url, 'en-US');
            if (dbg?.status === 'UnsupportedAudioFormat') {
              Alert.alert('Recording format not supported', 'Please try again.');
            } else {
              Alert.alert('No speech detected', 'Try speaking closer to the mic.');
            }
          }
        }
      } catch (e) {
        Alert.alert('Transcription error', e?.message || 'Could not transcribe audio.');
      }
    } catch (e) {
      Alert.alert('Recording error', e?.message || 'Could not finish recording.');
    } finally {
      setIsTranscribing(false);
      setStatusText('');
      modeRef.current = 'idle'; // back to idle after REST flow finishes
      stoppingRef.current = false;
      // clean web/native buffers
      audioData.current = null;
      audioRecorder.current = null;
      audioStream.current = null;
    }
  }

  async function cleanupRecording() {
    try {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      try { if (audioRecorder.current && audioRecorder.current.state !== 'inactive') audioRecorder.current.stop(); } catch {}
      try { audioStream.current?.getTracks().forEach(t => t.stop()); } catch {}
      audioRecorder.current = null;
      audioStream.current = null;
      audioData.current = null;

      try {
        if (recordingRef.current) {
          const st = await recordingRef.current.getStatusAsync();
          if (st.isRecording) await recordingRef.current.stopAndUnloadAsync();
        }
      } catch {}
      recordingRef.current = null;

      endListeningUI();
      isRecordingRef.current = false;
      modeRef.current = 'idle';
    } catch {}
  }

  /* ------------------------------ mic action ------------------------------ */
  const onMicPress = () => {
    // If SDK is preferred on native, behave as a toggle per current mode
    if (USE_AZURE_SDK && Platform.OS !== 'web') {
      if (startingRef.current || stoppingRef.current) return;

      if (modeRef.current === 'sdk') {
        // stop SDK
        stopSdkListening();
        return;
      }
      if (modeRef.current === 'rest') {
        // toggle REST
        if (isRecordingRef.current) stopRestRecording();
        else startRestRecording();
        return;
      }
      // idle → try SDK first; if token fails we fall back (with backoff)
      startSdkListening();
      return;
    }

    // Web / REST-only toggle
    if (isTranscribing || startingRef.current || stoppingRef.current) return;
    if (isRecordingRef.current) stopRestRecording();
    else startRestRecording();
  };

  /* -------------------------------- render -------------------------------- */
  const isListening = isListeningSdk || isRecordingRef.current;
  const disableBtn =
    startingRef.current ||
    stoppingRef.current ||
    (isTranscribing && !isListening); // while we upload/transcribe (REST), disable

  return (
    <TouchableOpacity
      onPress={onMicPress}
      disabled={disableBtn}
      style={[styles.micButton, style]}
      accessibilityLabel="Voice search"
      accessibilityHint="Tap to start or stop voice search"
    >
      {isListening ? (
        <View style={styles.recordingContainer}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <MaterialIcons name="mic" size={22} color="#f44336" />
          </Animated.View>
          <Text style={styles.recordingText}>
            {statusText || 'Listening...'} {duration ? `${duration}s` : ''}
          </Text>
        </View>
      ) : isTranscribing ? (
        <View className="transcribingContainer" style={styles.transcribingContainer}>
          <ActivityIndicator size="small" />
          <Text style={styles.transcribingText} numberOfLines={1}>
            {statusText || 'Transcribing...'}
          </Text>
        </View>
      ) : (
        <MaterialIcons name="mic" size={22} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  micButton: { padding: 6 },
  recordingContainer: { flexDirection: 'row', alignItems: 'center' },
  recordingText: { marginLeft: 6, fontSize: 12, color: '#f44336' },
  transcribingContainer: { flexDirection: 'row', alignItems: 'center' },
  transcribingText: { marginLeft: 6, fontSize: 10, color: '#4CAF50', maxWidth: 160 },
});
