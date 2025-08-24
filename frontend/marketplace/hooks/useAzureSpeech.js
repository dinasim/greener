// hooks/useAzureSpeech.js
import { useRef, useState } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { Audio } from 'expo-av';
import { fetchSpeechToken } from '../services/marketplaceApi';

export default function useAzureSpeech({ language = 'en-US' } = {}) {
  const recognizerRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  async function start({ onPartial, onFinal } = {}) {
    // 1) mic permission
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') throw new Error('Microphone permission denied');

    // 2) token
    const { token, region } = await fetchSpeechToken();

    // 3) SDK config
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = language;     // e.g. 'he-IL' or 'en-US'

    // default microphone
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    // 4) recognizer
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    recognizer.recognizing = (_s, e) => {
      if (e.result && e.result.text && onPartial) onPartial(e.result.text);
    };
    recognizer.recognized = (_s, e) => {
      if (e.result && e.result.text && onFinal) onFinal(e.result.text);
    };
    recognizer.canceled = (_s, e) => {
      console.warn('[Speech canceled]', e.errorDetails);
      stop().catch(() => {});
    };
    recognizer.sessionStopped = () => {
      stop().catch(() => {});
    };

    setIsListening(true);
    // start continuous mode
    await new Promise((resolve, reject) =>
      recognizer.startContinuousRecognitionAsync(resolve, reject)
    );
  }

  async function stop() {
    const r = recognizerRef.current;
    if (!r) return;
    await new Promise((resolve, reject) => r.stopContinuousRecognitionAsync(resolve, reject));
    r.close();
    recognizerRef.current = null;
    setIsListening(false);
  }

  return { start, stop, isListening };
}
