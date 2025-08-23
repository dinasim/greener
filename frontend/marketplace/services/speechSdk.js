import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from './marketplaceApi';

// One-shot recognition with EN -> HE fallback (customize order as you like)
export async function recognizeOnceViaSdk(preferredLangs = ['en-US', 'he-IL']) {
  const { token, region } = await getSpeechToken();
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

  for (const lang of preferredLangs) {
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = lang;

    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    try {
      const text = await new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (res) => {
            const t = (res?.text || '').trim();
            recognizer.close();
            resolve(t);
          },
          (err) => {
            recognizer.close();
            reject(err);
          }
        );
      });
      if (text) return { text, languageTried: lang };
    } catch (e) {
      // keep trying next language
      if (__DEV__) console.warn('[SpeechSDK] recognizeOnce error:', e?.message || e);
    }
  }
  return { text: '', languageTried: preferredLangs[preferredLangs.length - 1] };
}