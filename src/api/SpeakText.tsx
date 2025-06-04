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
export const speakTranslationTrackPlayer = async (
  text: string,
  key: any,
  region: string,
  targetLanguageCode: string = 'vi',
) => {
  const voice = voiceMap[targetLanguageCode] || voiceMap.vi;
  console.log('🔊 Speaking with TrackPlayer');

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

    // Tạo temp file
    const timestamp = Date.now();
    const tempPath = `${RNFS.CachesDirectoryPath}/tts_${timestamp}.mp3`;

    await RNFS.writeFile(
      tempPath,
      Buffer.from(response.data).toString('base64'),
      'base64',
    );

    console.log('🎵 Playing with TrackPlayer...');

    // Stop và clear queue trước
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
    } catch (e) {
      console.log('TrackPlayer was not playing');
    }

    // Add track và play
    await TrackPlayer.add({
      id: `tts_${timestamp}`,
      url: `file://${tempPath}`,
      title: 'Translation Audio',
      artist: 'TTS',
      duration: 0, // TrackPlayer sẽ tự detect
    });

    await TrackPlayer.play();
    console.log('🎵 TrackPlayer started playing');

    return new Promise((resolve, reject) => {
      let checkInterval: NodeJS.Timeout;
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Cleanup file
        RNFS.unlink(tempPath).catch(() => {});
      };

      const checkPlaybackStatus = async () => {
        try {
          const state = await TrackPlayer.getState();
          const position = await TrackPlayer.getPosition();
          const duration = await TrackPlayer.getDuration();

          console.log(
            `🎵 TrackPlayer state: ${state}, position: ${position}/${duration}`,
          );

          // Check if playback finished
          if (
            state === State.Stopped ||
            state === State.Paused ||
            (duration > 0 && position >= duration - 0.1)
          ) {
            cleanup();
            console.log('✅ TrackPlayer playback completed');
            resolve('trackplayer_played');
          }
        } catch (error) {
          cleanup();
          console.error('❌ TrackPlayer check error:', error);
          reject(error);
        }
      };

      // Check every 200ms
      checkInterval = setInterval(checkPlaybackStatus, 200);

      // Timeout after 30 seconds
      timeoutId = setTimeout(() => {
        cleanup();
        console.log('⏰ TrackPlayer timeout');
        resolve('trackplayer_timeout');
      }, 30000);
    });
  } catch (error) {
    console.error('❌ TrackPlayer TTS error:', error);
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
