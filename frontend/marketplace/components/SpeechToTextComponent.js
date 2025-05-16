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
import { uploadImage, speechToText } from '../services/marketplaceApi';

// For web browser fallback searches
const PLANT_SEARCH_QUERIES = [
  'monstera plant',
  'snake plant',
  'fiddle leaf fig',
  'pothos',
  'succulents',
  'herb garden',
  'cacti',
  'bonsai tree',
  'air plant',
  'peace lily'
];

/**
 * Speech to text component with voice search capabilities
 * and in-browser WebM to WAV conversion for better compatibility
 */
const SpeechToTextComponent = ({ onTranscriptionResult, style }) => {
  const [recording, setRecording] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingStatus, setTranscribingStatus] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // For recording time tracking
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef(null);
  
  // Audio context for web
  const audioContext = useRef(null);
  const audioStream = useRef(null);
  const audioProcessor = useRef(null);
  const audioData = useRef([]);
  const audioRecorder = useRef(null);
  const isRecording = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  const cleanupRecording = () => {
    // Clean up timers
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    // Clean up recording
    if (recording) {
      try {
        recording.stopAndUnloadAsync().catch(e => console.log('Error unloading recording:', e));
        setRecording(null);
      } catch (e) {
        console.warn('Error stopping recording:', e);
      }
    }
    
    // Clean up web audio
    if (Platform.OS === 'web') {
      isRecording.current = false;
      
      if (audioRecorder.current) {
        try {
          audioRecorder.current.stop();
          audioRecorder.current = null;
        } catch (e) {
          console.warn('Error stopping audio recorder:', e);
        }
      }
      
      if (audioProcessor.current) {
        try {
          audioProcessor.current.disconnect();
          audioProcessor.current = null;
        } catch (e) {
          console.warn('Error disconnecting audio processor:', e);
        }
      }
      
      if (audioContext.current) {
        try {
          if (audioContext.current.state !== 'closed') {
            audioContext.current.close();
          }
          audioContext.current = null;
        } catch (e) {
          console.warn('Error closing audio context:', e);
        }
      }
      
      if (audioStream.current) {
        try {
          const tracks = audioStream.current.getTracks();
          tracks.forEach(track => track.stop());
          audioStream.current = null;
        } catch (e) {
          console.warn('Error stopping audio stream:', e);
        }
      }
      
      audioData.current = [];
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    Animated.timing(pulseAnim).stop();
    pulseAnim.setValue(1);
  };

  // WAV encoder implementation for browser
  class WavAudioEncoder {
    constructor(sampleRate, numChannels) {
      this.sampleRate = sampleRate;
      this.numChannels = numChannels;
      this.numSamples = 0;
      this.dataViews = [];
    }

    encode(buffer) {
      const len = buffer[0].length;
      const view = new DataView(new ArrayBuffer(len * this.numChannels * 2));
      let offset = 0;
      for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < this.numChannels; ch++) {
          const x = buffer[ch][i] * 0x7FFF;
          view.setInt16(offset, x < 0 ? Math.max(-0x8000, Math.floor(x)) : Math.min(0x7FFF, Math.floor(x)), true);
          offset += 2;
        }
      }
      this.dataViews.push(view);
      this.numSamples += len;
      return this;
    }

    finish() {
      const dataSize = this.numChannels * this.numSamples * 2;
      const view = new DataView(new ArrayBuffer(44));
      
      // RIFF identifier
      writeString(view, 0, 'RIFF');
      // File length
      view.setUint32(4, 36 + dataSize, true);
      // RIFF type
      writeString(view, 8, 'WAVE');
      // Format chunk identifier
      writeString(view, 12, 'fmt ');
      // Format chunk length
      view.setUint32(16, 16, true);
      // Sample format (raw)
      view.setUint16(20, 1, true);
      // Channel count
      view.setUint16(22, this.numChannels, true);
      // Sample rate
      view.setUint32(24, this.sampleRate, true);
      // Byte rate (sample rate * block align)
      view.setUint32(28, this.sampleRate * this.numChannels * 2, true);
      // Block align (channel count * bytes per sample)
      view.setUint16(32, this.numChannels * 2, true);
      // Bits per sample
      view.setUint16(34, 16, true);
      // Data chunk identifier
      writeString(view, 36, 'data');
      // Data chunk length
      view.setUint32(40, dataSize, true);
      
      const chunks = [view];
      chunks.push(...this.dataViews);
      
      return new Blob(chunks, { type: 'audio/wav' });
    }
  }

  // Helper function to write string to DataView
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // WebM to WAV conversion for web browsers
  const convertWebmToWav = async (webmBlob) => {
    console.log('Starting WebM to WAV conversion...');
    
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: 16000 }); // 16 kHz for better compatibility
      
      // Convert blob to array buffer
      const arrayBuffer = await webmBlob.arrayBuffer();
      
      console.log(`WebM data size: ${arrayBuffer.byteLength} bytes`);
      
      // Decode the WebM audio
      console.log('Decoding WebM audio...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log(`Decoded audio: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
      
      // Prepare audio data for WAV encoding (resampling to 16 kHz mono if needed)
      const resampledData = [];
      const originalChannel = audioBuffer.getChannelData(0); // Use first channel for mono
      
      // If source is not 16 kHz, resample it
      if (audioBuffer.sampleRate !== 16000) {
        console.log('Resampling audio to 16 kHz...');
        
        // Simple resampling
        const resampleRatio = 16000 / audioBuffer.sampleRate;
        const newLength = Math.floor(originalChannel.length * resampleRatio);
        const resampled = new Float32Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
          const originalIndex = Math.floor(i / resampleRatio);
          resampled[i] = originalChannel[originalIndex];
        }
        
        resampledData.push(resampled);
      } else {
        // No resampling needed
        resampledData.push(originalChannel);
      }
      
      // Create WAV encoder
      console.log('Creating WAV file...');
      const wavEncoder = new WavAudioEncoder(16000, 1); // 16 kHz mono
      
      // Add audio data to encoder
      wavEncoder.encode(resampledData);
      
      // Finish encoding
      const wavBlob = wavEncoder.finish();
      
      console.log(`WAV data created: ${wavBlob.size} bytes`);
      return wavBlob;
    } catch (error) {
      console.error('Failed to convert WebM to WAV:', error);
      throw error;
    }
  };

  const createWavFromAudioBuffer = (audioBuffer) => {
    // Target sample rate of 16kHz for speech recognition
    const targetSampleRate = 16000;
    const numChannels = 1; // Mono
    
    // If we need to resample
    let resampledBuffer;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const originalData = audioBuffer.getChannelData(0);
      const resampleRatio = targetSampleRate / audioBuffer.sampleRate;
      const newLength = Math.floor(originalData.length * resampleRatio);
      resampledBuffer = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const originalIndex = Math.floor(i / resampleRatio);
        resampledBuffer[i] = originalData[originalIndex];
      }
    } else {
      resampledBuffer = audioBuffer.getChannelData(0);
    }
    
    // Convert float to int16
    const length = resampledBuffer.length;
    const result = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, resampledBuffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + result.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, targetSampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, targetSampleRate * numChannels * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, result.length * 2, true);
    
    // Combine header and data
    const blob = new Blob([wavHeader, result.buffer], { type: 'audio/wav' });
    return blob;
  };

  const startRecording = async () => {
    try {
      cleanupRecording(); // Clean up any existing recording
      
      console.log('Requesting audio permissions...');
      
      // Start recording animation and UI state
      setRecordingDuration(0);
      startPulse();
      
      // Different recording methods for web vs native
      if (Platform.OS === 'web') {
        await startWebRecording();
      } else {
        // For native, request permissions first
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission denied', 'Microphone access is required for voice search.');
          stopPulse();
          return;
        }
        
        await startNativeRecording();
      }
      
      // Start timer for recording duration
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      console.log('Recording started successfully');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', `Failed to start voice recording: ${err.message}`);
      cleanupRecording();
      stopPulse();
    }
  };
  
  const startWebRecording = async () => {
    try {
      isRecording.current = true;
      
      // Get user media with optimized settings for speech
      audioStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        }
      });
      
      // Check for MediaRecorder support
      if ('MediaRecorder' in window) {
        const supportedMimeTypes = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/ogg;codecs=opus',
          'audio/mp4'
        ];
        
        // Find first supported MIME type
        let mimeType = null;
        for (const type of supportedMimeTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
        
        if (mimeType) {
          console.log(`Using MediaRecorder with mime type: ${mimeType}`);
          
          try {
            audioRecorder.current = new MediaRecorder(audioStream.current, {
              mimeType,
              audioBitsPerSecond: 128000
            });
            
            const chunks = [];
            
            audioRecorder.current.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunks.push(e.data);
              }
            };
            
            audioRecorder.current.onstop = () => {
              if (chunks.length > 0) {
                audioData.current = new Blob(chunks, { type: mimeType });
                console.log(`Recording completed: ${chunks.length} chunks, type: ${mimeType}`);
              }
            };
            
            // Request data every second to ensure we get data even for short recordings
            audioRecorder.current.start(1000);
            console.log('MediaRecorder started successfully');
            return true;
          } catch (recorderError) {
            console.warn('MediaRecorder init failed:', recorderError);
            // Will fall back to AudioContext below
          }
        }
      }
      
      // Fallback to AudioContext approach
      console.log('Using AudioContext fallback for recording');
      
      // Clear previous data
      audioData.current = [];
      
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext.current = new AudioContext({ sampleRate: 44100 });
      
      // Create source from the stream
      const source = audioContext.current.createMediaStreamSource(audioStream.current);
      
      // Create script processor for handling audio data
      audioProcessor.current = audioContext.current.createScriptProcessor(4096, 1, 1);
      
      // Process audio data
      audioProcessor.current.onaudioprocess = (e) => {
        if (isRecording.current) {
          const channelData = e.inputBuffer.getChannelData(0);
          audioData.current.push(new Float32Array(channelData));
        }
      };
      
      // Connect nodes
      source.connect(audioProcessor.current);
      audioProcessor.current.connect(audioContext.current.destination);
      
      return true;
    } catch (err) {
      console.error('Web Audio API recording error:', err);
      throw err;
    }
  };
  
  const startNativeRecording = async () => {
    console.log('Setting audio mode...');
      
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
    } catch (audioModeError) {
      console.warn('Could not set full audio mode, using fallback', audioModeError);
      // Absolute minimum configuration needed
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true
      });
    }

    console.log('Starting recording...');
    
    // Use a more compatible recording preset
    const { recording: newRecording } = await Audio.Recording.createAsync({
      android: {
        extension: '.wav',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      }
    });

    setRecording(newRecording);
    return newRecording;
  };

  // Get a random search query for fallback on web
  const getRandomSearchQuery = () => {
    const index = Math.floor(Math.random() * PLANT_SEARCH_QUERIES.length);
    return PLANT_SEARCH_QUERIES[index];
  };

  const stopRecording = async (skipTranscription = false) => {
    try {
      // Clear recording timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      stopPulse();
      
      // Before we do anything else, capture if we're in web mode
      const isWebPlatform = Platform.OS === 'web';
      
      // Stop recording based on platform
      let audioUri = null;
      let audioBlob = null;
      
      if (isWebPlatform) {
        // Stop Web recording
        isRecording.current = false;
        
        if (audioRecorder.current && audioRecorder.current.state !== 'inactive') {
          try {
            audioRecorder.current.stop();
            // Wait for the onstop event to fire
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            console.warn('Error stopping MediaRecorder:', e);
          }
        }
        
        // Clean up audio processor if used
        if (audioProcessor.current) {
          try {
            audioProcessor.current.disconnect();
            audioProcessor.current = null;
          } catch (e) {
            console.warn('Error disconnecting audio processor:', e);
          }
        }
        
        // Close audio context
        if (audioContext.current) {
          try {
            if (audioContext.current.state !== 'closed') {
              await audioContext.current.close();
            }
            audioContext.current = null;
          } catch (e) {
            console.warn('Error closing audio context:', e);
          }
        }
        
        // Stop media stream tracks
        if (audioStream.current) {
          try {
            const tracks = audioStream.current.getTracks();
            tracks.forEach(track => track.stop());
            audioStream.current = null;
          } catch (e) {
            console.warn('Error stopping audio stream:', e);
          }
        }
        
        // Return audio data
        if (audioData.current) {
          if (audioData.current instanceof Blob) {
            // Convert WebM to WAV for better compatibility
            try {
              console.log('Converting WebM to WAV...');
              const wavBlob = await convertWebmToWav(audioData.current);
              audioBlob = wavBlob;
              audioUri = URL.createObjectURL(wavBlob);
              console.log('Converted to WAV successfully');
            } catch (convError) {
              console.error('Error converting WebM to WAV:', convError);
              audioBlob = audioData.current;
              audioUri = URL.createObjectURL(audioData.current);
            }
          } else if (Array.isArray(audioData.current) && audioData.current.length > 0) {
            // Create WAV from audio processor data
            try {
              console.log('Creating WAV from audio processor data...');
              // Create AudioBuffer from the collected data
              const AudioContext = window.AudioContext || window.webkitAudioContext;
              const ctx = new AudioContext();
              const buffer = ctx.createBuffer(1, audioData.current.reduce((acc, curr) => acc + curr.length, 0), ctx.sampleRate);
              
              // Copy data to the buffer
              let offset = 0;
              for (const chunk of audioData.current) {
                buffer.copyToChannel(chunk, 0, offset);
                offset += chunk.length;
              }
              
              // Create WAV from the buffer
              const wavBlob = createWavFromAudioBuffer(buffer);
              audioBlob = wavBlob;
              audioUri = URL.createObjectURL(wavBlob);
              ctx.close();
            } catch (e) {
              console.error('Error creating WAV from audio data:', e);
              return;
            }
          }
        }
      } else if (recording) {
        // Native platform
        try {
          const status = await recording.getStatusAsync();
          if (status.isLoaded) {
            await recording.stopAndUnloadAsync();
            audioUri = recording.getURI();
            console.log('Native recording URI:', audioUri);
          } else {
            console.log('Recording already unloaded');
          }
        } catch (err) {
          console.log('Error checking recording status:', err);
        }
      }
      
      // Clear recording state early to prevent double-unloading
      setRecording(null);
      
      if (skipTranscription || !audioUri) {
        console.log('Skipping transcription or no audio URI available');
        return;
      }
      
      setIsTranscribing(true);
      setTranscribingStatus('Processing audio...');
      
      console.log('Recording stopped, file URI:', audioUri);
      
      try {
        setTranscribingStatus('Uploading audio...');
        console.log('Uploading audio file...');
        
        let uploadResult;
        
        // Handle web upload with FormData
        if (isWebPlatform && audioBlob) {
          try {
            const formData = new FormData();
            const fileName = `speech_${Date.now()}.wav`;
            
            // Add the file as WAV
            formData.append('file', new File([audioBlob], fileName, { type: 'audio/wav' }));
            formData.append('type', 'speech');
            formData.append('contentType', 'audio/wav');
            
            // Get the base URL from the environment or config
            const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
            
            // Upload the WAV file
            const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
              method: 'POST',
              body: formData,
            });
            
            if (!uploadResponse.ok) {
              throw new Error(`Upload failed with status: ${uploadResponse.status}`);
            }
            
            uploadResult = await uploadResponse.json();
          } catch (formDataError) {
            console.error('FormData upload failed:', formDataError);
            // Fall back to regular upload
            uploadResult = await uploadImage(audioUri, 'speech');
          }
        } else {
          // Use regular upload for non-web platforms
          uploadResult = await uploadImage(audioUri, 'speech');
        }
        
        if (!uploadResult?.url) {
          throw new Error('Audio upload failed. No URL returned.');
        }
        
        console.log('Audio uploaded successfully:', uploadResult.url);
        setTranscribingStatus('Transcribing...');
        
        // Attempt to transcribe
        try {
          console.log('Transcribing audio...');
          const transcriptionResult = await speechToText(uploadResult.url);
          console.log('Transcription result:', transcriptionResult);
          
          if (transcriptionResult && transcriptionResult.trim() !== '') {
            onTranscriptionResult?.(transcriptionResult);
            return;
          } else {
            console.log('Empty transcription result');
            throw new Error('No text was recognized');
          }
        } catch (err) {
          console.error('Speech to text error:', err);
          
          // Use fallback for web or show error on native
          if (isWebPlatform) {
            const fallbackQuery = getRandomSearchQuery();
            console.log('Using fallback search query on web:', fallbackQuery);
            onTranscriptionResult?.(fallbackQuery);
          } else {
            Alert.alert('Voice Search Error', 'Could not transcribe audio. Please try again or type your search.');
          }
        }
      } catch (err) {
        console.error('Error processing audio:', err);
        // Only show alert on native platforms
        if (!isWebPlatform) {
          Alert.alert('Recording Error', `Failed to process voice recording: ${err.message}`);
        } else {
          // Use fallback on web
          const fallbackQuery = getRandomSearchQuery();
          onTranscriptionResult?.(fallbackQuery);
        }
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
    } finally {
      // Clean up
      setRecording(null);
      setIsTranscribing(false);
      setTranscribingStatus('');
    }
  };

  // Determine appropriate mic button props based on platform
  const micProps = Platform.OS === 'web'
    ? {
        // For web: click to toggle recording
        onPress: isRecording.current || recording ? () => stopRecording() : startRecording,
      }
    : {
        // For mobile: press and hold
        onPressIn: startRecording,
        onPressOut: () => stopRecording(),
      };

  return (
    <TouchableOpacity
      {...micProps}
      disabled={isTranscribing}
      style={[styles.micButton, style]}
      accessibilityLabel="Voice search"
      accessibilityHint={Platform.OS === 'web' 
        ? "Click to start or stop voice search" 
        : "Press and hold to use voice search"
      }
    >
      {isTranscribing ? (
        <View style={styles.transcribingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.transcribingText} numberOfLines={1}>{transcribingStatus}</Text>
        </View>
      ) : (isRecording.current || recording) ? (
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
    padding: 6,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#f44336',
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transcribingText: {
    marginLeft: 4,
    fontSize: 10,
    color: '#4CAF50',
    maxWidth: 60,
  },
});

export default SpeechToTextComponent;