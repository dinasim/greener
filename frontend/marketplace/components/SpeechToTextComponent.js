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
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { uploadImage, speechToText, speechToTextRaw } from '../services/marketplaceApi';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system';

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
    if (__DEV__) {
      diagnoseRecordingCapabilities();
    }
    return () => { void cleanupRecording(); };
  }, []);

  /** ---------- Diagnostics ---------- */
  const diagnoseRecordingCapabilities = async () => {
    try {
      console.log('=== Audio Recording Diagnostics ===');
      console.log('Platform:', Platform.OS);
      console.log('Platform Version:', Platform.Version);
      
      const permission = await Audio.requestPermissionsAsync();
      console.log('Audio Permission:', permission);
      
      const testConfigs = [
        {
          name: 'M4A/AAC High Quality',
          config: {
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
              outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
              audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
              sampleRate: 44100,
              numberOfChannels: 1,
              bitRate: 128000,
            },
          }
        },
        {
          name: 'M4A/AAC Basic',
          config: {
            android: {
              extension: '.m4a',
              outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
              audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            },
            ios: {
              extension: '.m4a',
              outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
            },
          }
        }
      ];
      
      for (const test of testConfigs) {
        try {
          const testRec = new Audio.Recording();
          await testRec.prepareToRecordAsync(test.config);
          console.log(`✅ ${test.name}: SUPPORTED`);
          await testRec.stopAndUnloadAsync();
        } catch (error) {
          console.log(`❌ ${test.name}: FAILED -`, error.message);
        }
      }
      
      console.log('Audio Constants Available:');
      console.log('- MPEG_4 Format:', Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4);
      console.log('- AAC Encoder:', Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC);
      console.log('- iOS M4A Format:', Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC);
      
    } catch (error) {
      console.error('Diagnostics failed:', error);
    }
  };

  /** ---------- Helpers ---------- */
  const stripFilePrefix = (p) => (p || '').replace('file://', '');

/** Quick header sniff for 3GP/AMR on Android files */
const looksLike3gp = async (uri) => {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
      position: 0,
    });
    const head = Buffer.from(b64, 'base64');
    const isAMR = head.slice(0, 5).toString() === '#!AMR' || head.slice(0, 7).toString() === '#!AMR-W';
    const isISO = head.length >= 12 && head.slice(4, 8).toString() === 'ftyp';
    const brand = isISO ? head.slice(8, 12).toString() : '';
    const is3gpBrand = brand.startsWith('3gp');
    return isAMR || is3gpBrand;
  } catch {
    return false;
  }
};

/** Transcode a local 3GP/AMR file to 16kHz mono WAV using ffmpeg-kit */
const transcode3gpToWav = async (inputUri) => {
  const inPath = stripFilePrefix(inputUri);
  const outName = `speech_${Date.now()}.wav`;
  const outUri  = `${FileSystem.cacheDirectory}${outName}`;
  const outPath = stripFilePrefix(outUri);

  const cmd = `-y -i "${inPath}" -ac 1 -ar 16000 -sample_fmt s16 "${outPath}"`;
  const session = await FFmpegKit.execute(cmd);
  const rc = await session.getReturnCode();
  if (ReturnCode.isSuccess(rc)) {
    return { uri: outUri, filename: outName, contentType: 'audio/wav' };
  }
  const log = await session.getOutput();
  throw new Error(`ffmpeg transcode failed (${rc?.getValue?.()}): ${log || ''}`);
};

/** Upload a local file as base64 JSON to your upload endpoint with explicit contentType */
const uploadSpeechFile = async (fileUri, contentType, filename) => {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const payload = {
    file: base64,
    type: 'speech',
    filename,
    contentType, // <- forces server to store with correct MIME/ext
  };

  const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
  const resp = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Upload failed (${resp.status}): ${t}`);
  }
  return resp.json();
};

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

  /** ---------- Optimal Recording Config ---------- */
  const getOptimalRecordingConfig = () => {
    const isAndroid = Platform.OS === 'android';
    const problematicAndroidVersions = Platform.Version < 24; // Android 7.0+
    
    if (isAndroid && problematicAndroidVersions) {
      console.log('Using simplified config for older Android');
      return {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        }
      };
    }
    
    // Standard high-quality config
    return {
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        maxFileSize: 10000000, // 10MB limit
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };
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
    await uploadAndTranscribe(audioUri, audioBlob, isWeb);
  };

  /** ---------- Upload and Transcribe ---------- */
  // Update your uploadAndTranscribe function in SpeechToTextComponent.js

const uploadAndTranscribe = async (audioUri, audioBlob, isWeb) => {
  setIsTranscribing(true);
  setTranscribingStatus('Preparing audio...');

  try {
    let uploadResult;

    if (isWeb && audioBlob) {
      // Web: already producing WAV/WEBM – keep as-is
      setTranscribingStatus('Uploading audio...');
      const form = new FormData();
      form.append('file', new File([audioBlob], `speech_${Date.now()}.wav`, { type: 'audio/wav' }));
      form.append('type', 'speech');
      form.append('contentType', 'audio/wav');
      const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
      const resp = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, { method: 'POST', body: form });
      if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
      uploadResult = await resp.json();
    } else {
      // Native (Android/iOS)
      let final = { uri: audioUri, filename: `speech_${Date.now()}.m4a`, contentType: 'audio/mp4' };

      // If Android produced 3GP/AMR, transcode locally to WAV
      if (Platform.OS === 'android' && await looksLike3gp(audioUri)) {
        setTranscribingStatus('Converting audio...');
        try {
          final = await transcode3gpToWav(audioUri); // -> WAV 16k mono
        } catch (e) {
          console.warn('[Voice] Local transcode failed:', e?.message);
          Alert.alert('Audio format error', 'Could not convert recording. Please try again.', [{ text: 'OK' }]);
          setIsTranscribing(false);
          setTranscribingStatus('');
          return;
        }
      }

      // Upload with explicit contentType (WAV for transcoded, otherwise AAC/M4A)
      setTranscribingStatus('Uploading audio...');
      uploadResult = await uploadSpeechFile(final.uri, final.contentType, final.filename);
    }

    if (!uploadResult?.url) throw new Error('Audio upload failed (no URL).');

    setTranscribingStatus('Transcribing...');
    let transcription = '';
    try {
      transcription = await speechToText(uploadResult.url, 'en-US');
      if (!transcription?.trim()) {
        transcription = await speechToText(uploadResult.url, 'he-IL');
      }
    } catch (err) {
      console.warn('speechToText error:', err?.message);
    }

    if (transcription && transcription.trim()) {
      onTranscriptionResult?.(transcription);
      return;
    }

    // Debug: show raw result to decide next UX
    const debugResult = await speechToTextRaw(uploadResult.url, 'en-US');
    console.log('STT Debug Result:', debugResult);

    if (debugResult?.status === 'UnsupportedAudioFormat') {
      Alert.alert(
        'Recording format not supported',
        'Your device saved audio in a format that could not be converted. Try again.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('No speech detected', 'Please try recording again closer to the mic.', [{ text: 'OK' }]);
    }

  } catch (err) {
    console.error('Transcription error:', err);
    Alert.alert('Voice Search Error', 'Could not transcribe audio. Please try again.', [{ text: 'OK' }]);
  } finally {
    setIsTranscribing(false);
    setTranscribingStatus('');
  }
};


  /** ---------- Platform-specific recorders ---------- */
  // Add this to your SpeechToTextComponent.js - replace the startNativeRecording function

const startNativeRecording = async () => {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const rec = new Audio.Recording();
  
  // Strategy 1: Force high-quality M4A with explicit settings
  const strategies = [
    {
      name: "High Quality M4A",
      config: {
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
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
      }
    },
    {
      name: "Medium Quality M4A",
      config: {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          sampleRate: 22050,
          numberOfChannels: 1,
        },
      }
    },
    {
      name: "Basic M4A",
      config: {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        },
      }
    },
    {
      name: "WAV Fallback",
      config: {
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      }
    }
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      console.log(`Trying recording strategy: ${strategy.name}`);
      await rec.prepareToRecordAsync(strategy.config);
      await rec.startAsync();
      recordingRef.current = rec;
      
      // Verify the recording actually started
      const status = await rec.getStatusAsync();
      console.log(`Recording status for ${strategy.name}:`, {
        isRecording: status.isRecording,
        uri: status.uri,
        platform: Platform.OS,
        version: Platform.Version,
      });

      if (status.isRecording) {
        console.log(`✅ Successfully started recording with ${strategy.name}`);
        return rec;
      } else {
        console.warn(`⚠️ ${strategy.name} prepared but not recording`);
        await safeStopAndUnload(rec);
      }
    } catch (error) {
      console.warn(`❌ ${strategy.name} failed:`, error.message);
      lastError = error;
      try {
        await safeStopAndUnload(rec);
      } catch {}
    }
  }

  // If all strategies failed, throw the last error
  throw lastError || new Error('All recording strategies failed');
};
  const startWebRecording = async () => {
    // Use consistent 16kHz sample rate for web
    audioStream.current = await navigator.mediaDevices.getUserMedia({
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true, 
        channelCount: 1, 
        sampleRate: 16000
      }
    });

    audioData.current = [];
    if ('MediaRecorder' in window) {
      // Prefer opus codec which works well with speech recognition
      const types = ['audio/webm;codecs=opus', 'audio/webm'];
      const mimeType = types.find(t => window.MediaRecorder.isTypeSupported(t)) || 'audio/webm';
      const chunks = [];
      audioRecorder.current = new MediaRecorder(audioStream.current, { 
        mimeType, 
        audioBitsPerSecond: 64000
      });
      audioRecorder.current.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
      audioRecorder.current.onstop = () => { audioData.current = new Blob(chunks, { type: mimeType }); };
      audioRecorder.current.start(250);
      return;
    }

    // Fallback: ScriptProcessor with 16kHz
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioContext.current = new Ctx({ sampleRate: 16000 });
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