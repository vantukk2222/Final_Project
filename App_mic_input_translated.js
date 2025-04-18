/**

This sample app allows continuous voice recognition using microsoft-cognitiveservices-speech-sdk and react-native-live-audio-stream.

How to run this?
1. Change values needed at line 26 "//CHANGE THESE VALUES"
2. Check the header in index.js for futher instructions

 */
import React, { Component } from 'react';
import {
  Button,
  PermissionsAndroid,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import 'react-native-get-random-values';
import 'node-libs-react-native/globals';
import { AudioConfig, AudioInputStream, AudioStreamFormat, CancellationDetails, CancellationReason, NoMatchDetails, NoMatchReason, ResultReason, SpeechConfig, SpeechRecognizer, SpeechTranslationConfig, TranslationRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
import { LogBox } from 'react-native';
import AudioRecord from 'react-native-live-audio-stream';
import { default_language, target_language } from './language_code';
import { Picker } from '@react-native-picker/picker';
LogBox.ignoreLogs(['new NativeEventEmitter']); // Ignore log notification by message

export const TranslateScreen = () => {
  //CHANGE THESE VALUES
  const key = "1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW";
  const region = "eastus";
  
  const language = "en-US"; //default language
  const targetLanguage = "vi";
  const [text, setText] = React.useState("");
  const [languageCode, setLanguageCode] = React.useState(language);
  const [targetLanguageCode, setTargetLanguageCode] = React.useState(targetLanguage);
  const [isListening, setIsListening] = React.useState(false);

  //Settings for the audio stream
  //tuned to documentation at https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/how-to-use-audio-input-streams
  //Do not change these values unless you're an expert
  const channels = 1;
  const bitsPerChannel = 16;
  const sampleRate = 16000;

  let initializedCorrectly = false;
  let recognizer;

  //prompt for permissions if not granted
  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        console.log('write external storage', grants);

        if (
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.RECORD_AUDIO'] ===
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('Permissions granted');
        } else {
          console.log('All required permissions not granted');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }
  };

  //sets up speechrecognizer and audio stream
  const initializeAudio = async () => {
    await checkPermissions();
    if(!initializedCorrectly) {
      setIsListening(true);

      //creates a push stream system which allows new data to be pushed to the recognizer
      const pushStream = AudioInputStream.createPushStream();
      const options = {
        sampleRate,
        channels,
        bitsPerChannel,
        audioSource: 6,
      };

      AudioRecord.init(options);
      //everytime data is recieved from the mic, push it to the pushStream
      AudioRecord.on('data', (data) => {
        const pcmData = Buffer.from(data, 'base64');
        pushStream.write(pcmData);
      });

      AudioRecord.start();

      const speechTranslationConfig = SpeechTranslationConfig.fromSubscription(key, region);
      speechTranslationConfig.speechRecognitionLanguage = languageCode;
      speechTranslationConfig.addTargetLanguage(targetLanguageCode);
      const audioConfig = AudioConfig.fromStreamInput(pushStream); //the recognizer uses the stream to get audio data
      recognizer = new TranslationRecognizer(speechTranslationConfig, audioConfig);

      recognizer.sessionStarted = (s, e) => {
        console.log("sessionStarted");
        console.log(e.sessionId);
      };
      
      recognizer.sessionStopped = (s, e) => {
        console.log("sessionStopped");
      };

      recognizer.recognizing = (s, e) => {
        // console.log("speechRecognitionLanguage");
        // console.log(e.result.language);
        // console.log("targetLanguage");
        // console.log(e.result.translations.get(targetLanguage));

        // //The recognizer will return partial results. This is not called when recognition is stopped and sentences are formed but when recognizer picks up scraps of words on-the-fly.
        // console.log(`RECOGNIZING: Text=${e.result.text}`);
        // console.log(`RECOGNIZING: Text=${e.result.translations.get(targetLanguage)}`);
        // console.log(e.result.text);
        setText(e.result.translations.get(targetLanguageCode));
        console.log(e.sessionId);
      };
      recognizer.recognized = (s, e) => {
        //The final result of the recognition with punctuation
        console.log(`RECOGNIZED: Text=${e.result.text}`);
        console.log(`RECOGNIZING sequence: Text=${e.result.translations.get(targetLanguageCode)}`);
        console.log(e.result);
      };
      recognizer.startContinuousRecognitionAsync(() => {
          console.log("startContinuousRecognitionAsync");
      },
      (err) => {
        console.log(err);
      });

      initializedCorrectly = true;
    }
  };

  //stops the audio stream and recognizer
  const stopAudio = async () => {
    setIsListening(false);
    AudioRecord.stop(); 
    if(!!recognizer) {
      recognizer.stopContinuousRecognitionAsync();
      initializedCorrectly = false;
    }
  };

  // const updateLanguageSettings = (newLanguage, newTargetLanguage) => {
  //   recognizer.stopContinuousRecognitionAsync();
  //   recognizer.close();
  //   recognizer = null;
  //   initializedCorrectly = false;
  //   setText("");
  //   setLanguageCode(newLanguage);
  //   setTargetLanguageCode(newTargetLanguage);
  //   const speechTranslationConfig = SpeechTranslationConfig.fromSubscription(key, region);
  //   speechTranslationConfig.speechRecognitionLanguage = newLanguage;
  //   speechTranslationConfig.addTargetLanguage(newTargetLanguage);
  //   const audioConfig = AudioConfig.fromStreamInput(pushStream); //the recognizer uses the stream to get audio data
  //   recognizer = new TranslationRecognizer(speechTranslationConfig, audioConfig);
  //   recognizer.sessionStarted = (s, e) => {
  
  //   console.log(`Updated recognition language to: ${newLanguage}`);
  //   console.log(`Updated target language to: ${newTargetLanguage}`);
  // };
  
  return (

    <SafeAreaView style={{ 
      flex: 1, 
      justifyContent: "center", 
      alignItems: "center", 
      backgroundColor: "#f0f2f5",
      padding: 20
    }}>
      <Text style={{
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 30,
        color: "#333"
      }}>
        Voice Translator
      </Text>
      <View style={{
        width: "100%",
        marginBottom: 20,
        borderRadius: 15,
        backgroundColor: "white",
        padding: 20,
        borderWidth: 1,
        borderColor: "#ddd",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
        }}>
      <Picker
        selectedValue={languageCode}
        onValueChange={(itemValue) => setLanguageCode(itemValue)}
        style={{ color: 'black', width: "100%", height: 50, marginBottom: 20, borderRadius: 50, backgroundColor: "#f8f8f8", borderWidth: 1, borderColor: "#ddd" }}
      >
        {default_language.map((lang) => (
          <Picker.Item label={lang.name} value={lang.code} key={lang.code} />
        ))}
      </Picker>

      <Text style={{
        fontSize: 14,
        color: "#666",
        marginBottom: 20,
        textAlign: "center"
      }}>
        ↓ Select Target Language ↓
      </Text>
      <Picker
        selectedValue={targetLanguageCode}
        onValueChange={(itemValue) => setTargetLanguageCode(itemValue)}
        style={{ color: 'black', width: "100%", height: 50, marginBottom: 20, borderRadius: 50, backgroundColor: "#f8f8f8", borderWidth: 1, borderColor: "#ddd" }}
      >
        {target_language.map((lang) => (
          <Picker.Item label={lang.name} value={lang.code} key={lang.code} />
        ))}
      </Picker>
      </View>
      
      <Text style={{
        width: "100%",
        minHeight: 150,
        backgroundColor: "white",
        borderRadius: 15,
        padding: 20,
        textAlign: "center",
        color: "#333",
        fontSize: 18,
        borderWidth: 1,
        borderColor: "#ddd",
        marginBottom: 40,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      }}>
        {text || "Translation will appear here..."}
      </Text>
      
      {!isListening ? (
        <Pressable
          style={({ pressed }) => ({
            padding: 18,
            backgroundColor: pressed ? "#0056b3" : "#007bff",
            borderRadius: 30,
            width: 200,
            alignItems: "center",
            elevation: 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3
          })}
          onPress={() => {
            console.log("Listening");
            console.log(languageCode);
            console.log(targetLanguageCode);
            initializeAudio();
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Start Listening</Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => ({
            padding: 18,
            backgroundColor: pressed ? "#c82333" : "#dc3545",
            borderRadius: 30,
            width: 200,
            alignItems: "center",
            elevation: 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3
          })}
          onPress={() => {
            console.log("Stopping");
            stopAudio();
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Stop Listening</Text>
        </Pressable>
      )}
      
    </SafeAreaView>
  );
};