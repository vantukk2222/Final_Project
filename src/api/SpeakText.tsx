import axios from 'axios';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import {Buffer} from 'buffer';

global.Buffer = global.Buffer || Buffer;

// Danh sách voice tương ứng với mã ngôn ngữ
const voiceMap = {
  vi: 'vi-VN-HoaiMyNeural', // Vietnamese
  en: 'en-US-JennyNeural', // English (US)
  ja: 'ja-JP-NanamiNeural', // Japanese
  ko: 'ko-KR-SunHiNeural', // Korean
  zh: 'zh-CN-XiaoxiaoNeural', // Chinese
  fr: 'fr-FR-DeniseNeural', // French
  de: 'de-DE-KatjaNeural', // German
  es: 'es-ES-ElviraNeural', // Spanish
  // ... thêm nếu cần
};

export const speakTranslation = async (
  text: string,
  key: any,
  region: string,
  targetLanguageCode: string = 'vi',
) => {
  const voice = voiceMap[targetLanguageCode] || voiceMap.vi;

  const headers = {
    'Ocp-Apim-Subscription-Key': key,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
  };

  const body = `
    <speak version='1.0' xml:lang='${targetLanguageCode}'>
      <voice name='${voice}'>${text}</voice>
    </speak>`;

  try {
    const response = await axios.post(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      body,
      {
        headers,
        responseType: 'arraybuffer',
      },
    );

    const path = `${RNFS.DocumentDirectoryPath}/translated_${Date.now()}.mp3`;
    await RNFS.writeFile(
      path,
      Buffer.from(response.data).toString('base64'),
      'base64',
    );
    console.log('Audio file saved to:', path);
    return path;

    // await new Promise((resolve, reject) => {
    //   const sound = new Sound(path, '', error => {
    //     if (error) {
    //       console.log('Sound loading error:', error);
    //       return reject(error);
    //     }

    //     sound.play(success => {
    //       sound.release();
    //       if (success) {
    //         resolve();
    //       } else {
    //         reject(new Error('Playback failed'));
    //       }
    //     });
    //   });
    // });
  } catch (error) {
    console.error('TTS prepare error:', error);
    return null;
  }
};
