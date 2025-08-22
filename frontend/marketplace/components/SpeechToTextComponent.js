// components/SpeechToTextComponent.js - Using Expo Audio API
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
  PermissionsAndroid,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { speechToText, speechToTextRaw } from '../services/marketplaceApi';
import * as FileSystem from 'expo-file-system';

/* ---------------- Fallback searches for web errors ---------------- */
const PLANT_SEARCH_QUERIES = [
  'monstera plant','snake plant','fiddle leaf fig','pothos','succulents',
  'herb garden','cacti','bonsai tree','air plant','peace lily'
];

/* ================================================================== */
/*                         MAIN COMPONENT                              */
/* ================================================================== */
const SpeechToTextComponent = ({ onTranscriptionResult, onRecordingStateChange, style }) => {
  // UI state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingStatus, setTranscribingStatus] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Re-entrancy guards
  const startingRef  = useRef(false);
  const stoppingRef  = useRef(false);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  // Recording refs (avoid state race conditions)
  const isRecordingRef = useRef(false);       // true while recording
  const recordingRef = useRef(null);          // Expo Audio.Recording instance
  const recordUriRef = useRef(null);          // latest recording path

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
      console.log('=== Audio Recording Diagnostics ===', {
        platform: Platform.OS,
        version: Platform.Version,
      });
    }

    return () => {
      void cleanupRecording();
    };
  }, []);

  /* ---------------- Helpers ---------------- */

  const startPulse = () => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { 
          toValue: 1.4, 
          duration: 400, 
          useNativeDriver: true, 
          easing: Easing.inOut(Easing.ease) 
        }),
        Animated.timing(pulseAnim, { 
          toValue: 1, 
          duration: 400, 
          useNativeDriver: true, 
          easing: Easing.inOut(Easing.ease) 
        }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;
    pulseAnim.setValue(1);
  };

  const getRandomSearchQuery = () => {
    const i = Math.floor(Math.random() * PLANT_SEARCH_QUERIES.length);
    return PLANT_SEARCH_QUERIES[i];
  };

  const cleanupRecording = async () => {
    try {
      if (recordingTimer.current) { 
        clearInterval(recordingTimer.current); 
        recordingTimer.current = null; 
      }
      if (autoStopTimer.current) { 
        clearTimeout(autoStopTimer.current); 
        autoStopTimer.current = null; 
      }

      // Web cleanup
      try {
        if (audioRecorder.current && audioRecorder.current.state !== 'inactive') {
          audioRecorder.current.stop();
        }
      } catch {}
      audioRecorder.current = null;

      try { 
        if (audioProcessor.current) audioProcessor.current.disconnect(); 
      } catch {}
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

      // Native cleanup - using Expo Audio
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch (e) {
          console.log('Recording already stopped');
        }
        recordingRef.current = null;
      }

      audioData.current = [];
      stopPulse();
      setRecordingDuration(0);
      isRecordingRef.current = false;
      recordUriRef.current = null;
      
      // Notify parent of recording state change
      onRecordingStateChange?.(false);
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  };

  /* ---------------- Web: minimal WAV creation from AudioBuffer ---------------- */
  const writeString = (view, offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  const createWavFromAudioBuffer = (audioBuffer) => {
    const targetSampleRate = 16000;
    const numChannels = 1;

    let mono = audioBuffer.getChannelData(0);
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const ratio  = targetSampleRate / audioBuffer.sampleRate;
      const newLen = Math.floor(mono.length * ratio);
      const resampled = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) {
        resampled[i] = mono[Math.floor(i / ratio)];
      }
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

  /* ---------------- Upload helper (forces contentType) ---------------- */
  const uploadSpeechFile = async (fileUri, contentType, filename) => {
    // Detect actual file extension from URI
    const actualExtension = fileUri.split('.').pop().toLowerCase();
    let actualContentType = contentType;
    let actualFilename = filename;
    
    // Map extensions to correct content types
    const extensionMap = {
      'wav': 'audio/wav',
      'mp4': 'audio/mp4',
      'm4a': 'audio/mp4',
      'webm': 'audio/webm',
      '3gp': 'audio/3gpp',
      'amr': 'audio/amr'
    };
    
    if (extensionMap[actualExtension]) {
      actualContentType = extensionMap[actualExtension];
      actualFilename = `speech_${Date.now()}.${actualExtension}`;
    }
    
    console.log(`Uploading audio: ${actualFilename} (${actualContentType})`);
    
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const payload = {
      file: base64,
      type: 'speech',
      filename: actualFilename,
      contentType: actualContentType,
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

  /* ================================================================== */
  /*                        Start / Stop Recording                       */
  /* ================================================================== */

  const startNativeRecording = async () => {
    // Request permissions
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission denied', 'Microphone access is required for voice search.');
      return null;
    }

    // Configure audio mode
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (e) {
      console.warn('Error setting audio mode:', e);
      // Try minimal configuration
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
        });
      } catch (e2) {
        console.warn('Error with minimal audio mode:', e2);
      }
    }

    try {
      // Create new recording instance
      const recording = new Audio.Recording();
      
      // Use the HIGH_QUALITY preset which should work reliably
      // This produces PCM WAV files that Azure Speech handles well
      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;

      console.log('Using HIGH_QUALITY preset for recording');

      // Prepare and start recording
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();
      
      recordingRef.current = recording;
      isRecordingRef.current = true;
      
      console.log('Native recording started with options:', recordingOptions);
      return recording;
    } catch (e) {
      console.error('Failed to start native recording:', e);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      return null;
    }
  };

  const stopNativeRecording = async () => {
    if (!recordingRef.current) {
      console.log('No recording to stop');
      return null;
    }

    try {
      const status = await recordingRef.current.getStatusAsync();
      console.log('Recording status before stop:', status);
      
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      // Log file info for debugging
      if (uri) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          console.log('Recorded file info:', {
            uri,
            exists: info.exists,
            size: info.size,
            isDirectory: info.isDirectory
          });
        } catch (e) {
          console.log('Could not get file info:', e);
        }
      }
      
      recordingRef.current = null;
      recordUriRef.current = uri;
      console.log('Recording stopped, URI:', uri);
      return uri;
    } catch (e) {
      console.warn('Error stopping native recording:', e);
      recordingRef.current = null;
      return recordUriRef.current;
    }
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
      audioRecorder.current.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      audioRecorder.current.onstop = () => { 
        audioData.current = new Blob(chunks, { type: mimeType }); 
      };
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

  const startRecording = async () => {
    if (startingRef.current || isRecordingRef.current) return;
    startingRef.current = true;

    try {
      let started = false;
      
      if (Platform.OS === 'web') {
        await startWebRecording();
        started = true;
      } else {
        const recording = await startNativeRecording();
        started = !!recording;
      }

      if (!started) { 
        startingRef.current = false; 
        return; 
      }

      isRecordingRef.current = true;
      
      // Notify parent of recording state change
      onRecordingStateChange?.(true);

      // UI timers/animations
      startPulse();
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(p => p + 1);
      }, 1000);
      
      // Auto-stop as a safety (adjust if you want longer)
      autoStopTimer.current = setTimeout(() => { 
        void stopRecording(); 
      }, 8000);

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', err?.message || 'Failed to start voice recording.');
      // Clean up on error
      await cleanupRecording();
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = async () => {
    if (stoppingRef.current || !isRecordingRef.current) return;
    stoppingRef.current = true;

    // clear UI timers
    if (recordingTimer.current) { 
      clearInterval(recordingTimer.current); 
      recordingTimer.current = null; 
    }
    if (autoStopTimer.current) { 
      clearTimeout(autoStopTimer.current); 
      autoStopTimer.current = null; 
    }
    stopPulse();

    let audioUri = null;
    let audioBlob = null;
    const isWeb = Platform.OS === 'web';

    try {
      if (isWeb) {
        // Stop MediaRecorder, close context/stream
        try {
          if (audioRecorder.current && audioRecorder.current.state !== 'inactive') {
            const stopped = new Promise(resolve => { 
              audioRecorder.current.onstop = resolve; 
            });
            audioRecorder.current.stop();
            await stopped;
          }
        } catch (e) { 
          console.warn('MediaRecorder stop error:', e); 
        }

        try { 
          if (audioProcessor.current) audioProcessor.current.disconnect(); 
        } catch {}
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
            // fallback: send original blob (often webm/opus)
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
      } else {
        // Native path (Android/iOS) - using Expo Audio
        audioUri = await stopNativeRecording();
      }
    } catch (e) {
      console.error('Error while stopping recording:', e);
    } finally {
      isRecordingRef.current = false;
      stoppingRef.current = false;
      
      // Notify parent of recording state change
      onRecordingStateChange?.(false);
    }

    if (!audioUri && !audioBlob) {
      console.log('No audio captured; skipping transcription');
      return;
    }

    // Upload + transcribe
    await uploadAndTranscribe(audioUri, audioBlob, isWeb);
  };

  /* ---------------- Upload and Transcribe ---------------- */
  const uploadAndTranscribe = async (audioUri, audioBlob, isWeb) => {
    setIsTranscribing(true);
    setTranscribingStatus('Preparing audio...');

    try {
      let uploadResult;

      if (isWeb && audioBlob) {
        // Web: already producing WAV/WEBM – keep as-is
        setTranscribingStatus('Uploading audio...');
        const form = new FormData();
        // Prefer WAV when we synthesized it; otherwise send as-is
        const isWav = (audioBlob.type || '').includes('wav');
        const name = `speech_${Date.now()}.${isWav ? 'wav' : 'webm'}`;
        form.append('file', new File([audioBlob], name, { 
          type: isWav ? 'audio/wav' : (audioBlob.type || 'audio/webm') 
        }));
        form.append('type', 'speech');
        form.append('contentType', isWav ? 'audio/wav' : (audioBlob.type || 'audio/webm'));
        
        const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
        const resp = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, { 
          method: 'POST', 
          body: form 
        });
        if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
        uploadResult = await resp.json();
      } else {
        // Native (Android/iOS) – using Expo Audio
        const uri = audioUri;
        const actualExtension = uri.split('.').pop().toLowerCase();
        
        // Determine content type based on actual file extension
        let contentType = 'audio/wav'; // default
        if (actualExtension === 'wav') {
          contentType = 'audio/wav';
        } else if (actualExtension === 'm4a' || actualExtension === 'mp4') {
          contentType = 'audio/mp4';
        } else if (actualExtension === '3gp') {
          // If we got 3GP, alert user that format isn't supported
          Alert.alert(
            'Unsupported Format',
            'The recording format is not supported. Please try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        const name = `speech_${Date.now()}.${actualExtension}`;
        setTranscribingStatus('Uploading audio...');
        uploadResult = await uploadSpeechFile(uri, contentType, name);
      }

      if (!uploadResult?.url) {
        throw new Error('Audio upload failed (no URL).');
      }

      setTranscribingStatus('Transcribing...');
      let transcription = '';
      
      // Try English first with longer timeout
      try {
        console.log('Attempting English (en-US) transcription...');
        transcription = await speechToText(uploadResult.url, 'en-US');
        console.log('English transcription result:', transcription);
        
        // If we get gibberish or very short text, it might be wrong language
        if (transcription && transcription.trim() && transcription.trim().length > 2) {
          // Check if result looks like Hebrew characters mistaken for something else
          const hasHebrewChars = /[\u0590-\u05FF]/.test(transcription);
          if (!hasHebrewChars) {
            // Good English result
            onTranscriptionResult?.(transcription);
            return;
          }
        }
      } catch (err) {
        console.warn('English speechToText error:', err?.message);
      }

      // If English didn't work or returned nothing, try Hebrew
      if (!transcription?.trim() || transcription.trim().length <= 2) {
        try {
          console.log('English failed or empty, trying Hebrew (he-IL)...');
          const hebrewTranscription = await speechToText(uploadResult.url, 'he-IL');
          console.log('Hebrew transcription result:', hebrewTranscription);
          
          if (hebrewTranscription && hebrewTranscription.trim()) {
            // Check if it's the recurring "מירכ" issue
            if (hebrewTranscription.trim() === 'מירכ' || hebrewTranscription.trim() === 'מירכ.') {
              console.warn('Got problematic Hebrew transcription "מירכ", likely audio encoding issue');
              // Fall back to debug
            } else {
              transcription = hebrewTranscription;
            }
          }
        } catch (err) {
          console.warn('Hebrew speechToText error:', err?.message);
        }
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
          'Audio was uploaded in a format the speech service cannot process. Please try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No speech detected', 
          'Please try recording again closer to the mic.', 
          [{ text: 'OK' }]
        );
      }

    } catch (err) {
      console.error('Transcription error:', err);
      Alert.alert(
        'Voice Search Error', 
        'Could not transcribe audio. Please try again.', 
        [{ text: 'OK' }]
      );
    } finally {
      setIsTranscribing(false);
      setTranscribingStatus('');
    }
  };

  /* ---------------- UI: single-tap toggle ---------------- */
  const onMicPress = () => {
    if (isTranscribing || startingRef.current || stoppingRef.current) return;
    if (isRecordingRef.current) { 
      void stopRecording(); 
    } else { 
      void startRecording(); 
    }
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
          <ActivityIndicator size="small" />
          <Text style={styles.transcribingText} numberOfLines={1}>
            {transcribingStatus}
          </Text>
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
  micButton: { 
    padding: 6 
  },
  recordingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  recordingText: { 
    marginLeft: 4, 
    fontSize: 12, 
    color: '#f44336' 
  },
  transcribingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  transcribingText: { 
    marginLeft: 4, 
    fontSize: 10, 
    color: '#4CAF50', 
    maxWidth: 120 
  },
});

export default SpeechToTextComponent;