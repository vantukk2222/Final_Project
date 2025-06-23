import axios from 'axios';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import {Buffer} from 'buffer';
import {Platform} from 'react-native';
import TrackPlayer, {State} from 'react-native-track-player';

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
};

/**
 * Temp file method (Backup)
 */
export const speakTranslationTempFile = async (
  text: string,
  key: any,
  region: string,
  targetLanguageCode: string = 'vi',
) => {
  const voice = voiceMap[targetLanguageCode] || voiceMap.vi;
  console.log('🔊 Speaking with temp file');

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

    // Tạo temp file với timestamp để tránh conflict
    const timestamp = Date.now();
    const tempPath = `${RNFS.CachesDirectoryPath}/temp_tts_${timestamp}.mp3`;

    // Write file
    await RNFS.writeFile(
      tempPath,
      Buffer.from(response.data).toString('base64'),
      'base64',
    );

    console.log('🎵 Temp audio file created, playing...');

    return new Promise((resolve, reject) => {
      const sound = new Sound(tempPath, '', error => {
        if (error) {
          console.log('❌ Sound loading error:', error);
          // Cleanup temp file
          RNFS.unlink(tempPath).catch(() => {});
          return reject(error);
        }

        console.log('✅ Sound loaded, duration:', sound.getDuration(), 's');
        sound.play(success => {
          sound.release();
          // Cleanup temp file after playing
          RNFS.unlink(tempPath).catch(() => {});

          if (success) {
            console.log('✅ Audio playback completed');
            resolve('temp_played');
          } else {
            console.log('❌ Audio playback failed');
            reject(new Error('Playback failed'));
          }
        });
      });
    });
  } catch (error) {
    console.error('❌ TTS temp file error:', error);
    throw error;
  }
};

/**
 * TrackPlayer method (Primary)
 */
// ✅ Enhanced TrackPlayer method with better state management
export const speakTranslationTrackPlayer = async (
  text: string,
  key: any,
  region: string,
  targetLanguageCode: string = 'vi',
) => {
  const voice = voiceMap[targetLanguageCode] || voiceMap.vi;
  console.log('🔊 Speaking with TrackPlayer (Direct):', text);

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

    console.log('🎵 Playing directly with TrackPlayer...');

    try {
      const currentState = await TrackPlayer.getState();
      console.log('Current TrackPlayer state:', currentState);

      if (currentState === State.Playing || currentState === State.Paused) {
        console.log('🛑 Stopping current playback...');
        await TrackPlayer.stop();
      }

      await TrackPlayer.reset();
      console.log('🧹 TrackPlayer queue cleared');
    } catch (e) {
      console.log('TrackPlayer was not playing:', e.message);
    }

    // ✅ Convert ArrayBuffer to base64 data URL
    const base64Audio = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:audio/mp3;base64,${base64Audio}`;

    // Add track với data URL
    const trackId = `tts_${Date.now()}`;
    await TrackPlayer.add({
      id: trackId,
      url: dataUrl, // ✅ Sử dụng data URL thay vì file path
      title: 'Translation Audio',
      artist: 'TTS',
      duration: 0,
      repeated: false,
    });

    await TrackPlayer.play();
    console.log('🎵 TrackPlayer started playing directly:', trackId);

    return new Promise((resolve, reject) => {
      let checkInterval: NodeJS.Timeout;
      let timeoutId: NodeJS.Timeout;
      let resolved = false;

      const cleanup = () => {
        if (resolved) {
          return;
        }
        resolved = true;

        if (checkInterval) {
          clearInterval(checkInterval);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // ✅ No temp file to cleanup
      };

      const checkPlaybackStatus = async () => {
        if (resolved) {
          return;
        }

        try {
          const state = await TrackPlayer.getState();
          const position = await TrackPlayer.getPosition();
          const duration = await TrackPlayer.getDuration();

          console.log(
            `🎵 TrackPlayer state: ${state}, position: ${position.toFixed(
              3,
            )}/${duration.toFixed(3)}`,
          );

          // ✅ Better completion detection
          if (
            state === State.Stopped ||
            state === State.None ||
            (duration > 0 && position >= duration - 0.05)
          ) {
            cleanup();
            console.log('✅ TrackPlayer direct playback completed');
            resolve('trackplayer_played');
          }
        } catch (error) {
          cleanup();
          console.error('❌ TrackPlayer check error:', error);
          reject(error);
        }
      };

      // ✅ Check every 200ms for better accuracy
      checkInterval = setInterval(checkPlaybackStatus, 200);

      // ✅ Timeout after 10 seconds
      timeoutId = setTimeout(() => {
        cleanup();
        console.log('⏰ TrackPlayer direct timeout');
        resolve('trackplayer_timeout');
      }, 10000);
    });
  } catch (error) {
    console.error('❌ TrackPlayer direct TTS error:', error);
    throw error;
  }
};

/**
 * Cache method (Legacy)
 */
export const speakTranslationWithCache = async (
  text: string,
  key: any,
  region: string,
  targetLanguageCode: string = 'vi',
) => {
  const voice = voiceMap[targetLanguageCode] || voiceMap.vi;
  console.log('Speak with cache');

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
    // Tạo hash để cache
    const textHash = Buffer.from(text + targetLanguageCode)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 20);
    const cachedPath = `${RNFS.DocumentDirectoryPath}/tts_cache_${textHash}.mp3`;

    // Kiểm tra cache trước
    const cacheExists = await RNFS.exists(cachedPath);
    if (cacheExists) {
      console.log('🚀 Using cached audio:', cachedPath);
      return cachedPath;
    }

    const response = await axios.post(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      body,
      {
        headers,
        responseType: 'arraybuffer',
      },
    );

    await RNFS.writeFile(
      cachedPath,
      Buffer.from(response.data).toString('base64'),
      'base64',
    );

    console.log('💾 Audio cached to:', cachedPath);
    return cachedPath;
  } catch (error) {
    console.error('❌ TTS cache error:', error);
    return null;
  }
};

/**
 * Main function với TrackPlayer priority
 */
export const speakTranslation = async (
  text: string,
  key: any,
  region: string,
  targetLanguageCode: string = 'vi',
) => {
  try {
    // Strategy 1: TrackPlayer (primary)
    console.log('🎯 Trying TrackPlayer method...');
    const result = await speakTranslationTrackPlayer(
      text,
      key,
      region,
      targetLanguageCode,
    );
    return result;
  } catch (error) {
    console.log('⚠️ TrackPlayer failed, trying temp file method...');

    try {
      // Strategy 2: Temp file (backup)
      return await speakTranslationTempFile(
        text,
        key,
        region,
        targetLanguageCode,
      );
    } catch (tempError) {
      console.log('⚠️ Temp file method failed, trying cache method...');

      try {
        // Strategy 3: Cache method (last resort)
        return await speakTranslationWithCache(
          text,
          key,
          region,
          targetLanguageCode,
        );
      } catch (cacheError) {
        console.error('❌ All TTS methods failed');
        throw cacheError;
      }
    }
  }
};
