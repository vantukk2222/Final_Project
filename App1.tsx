// /**
//  * Sample React Native App
//  * https://github.com/facebook/react-native
//  *
//  * @format
//  */
// import React, { Component } from 'react';
// import Sound from 'react-native-sound';

// import {
//   Button,
//   PermissionsAndroid,
//   SafeAreaView,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TextInput,
//   useColorScheme,
//   View,
// } from 'react-native';
// import { Picker } from '@react-native-picker/picker';
// import 'react-native-get-random-values';
// import 'node-libs-react-native/globals';
// import { AudioConfig, AudioInputStream, CancellationDetails, CancellationReason, NoMatchDetails, NoMatchReason, ResultReason, SpeechConfig, SpeechRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
// import DocumentPicker from 'react-native-document-picker';
// import RNFS from 'react-native-fs';

// const Buffer = require('buffer').Buffer;
// const regionOptions = [
//   {val:"westus", name:"West US"},
//   {val:"westus2", name:"West US2"},
//   {val:"eastus", name:"East US"},
//   {val:"eastus2", name:"East US2"},
//   {val:"eastasia", name:"East Asia"},
//   {val:"southeastasia", name:"South East Asia"},
//   {val:"northeurope", name:"North Europe"},
//   {val:"westeurope", name:"West Europe"}
// ];

// const optList = (options: {val: string, name: string}[]) => {
//     return( options.map( (opt) => {
//           return( <Picker.Item label={opt.name} key={opt.val} value={opt.val}  />)} ));
// }

// const languageOptions = [
//   {val:"en-US", name:"English - US"},
//   {val:"ar-EG", name:"Arabic - EG"},
//   {val:"ca-ES", name:"Catalan - ES"},
//   {val:"da-DK", name:"Danish - DK"},
//   {val:"de-DE", name:"German - DE"},
//   {val:"en-AU", name:"English - AU"},
//   {val:"en-CA", name:"English - CA"},
//   {val:"en-GB", name:"English - GB"},
//   {val:"en-IN", name:"English - IN"},
//   {val:"en-NZ", name:"English - NZ"},
//   {val:"es-ES", name:"Spanish - ES"},
//   {val:"es-MX", name:"Spanish - MX"},
//   {val:"fi-FI", name:"Finnish - FI"},
//   {val:"fr-CA", name:"French - CA"},
//   {val:"fr-FR", name:"French - FR"},
//   {val:"hi-IN", name:"Hindi - IN"},
//   {val:"it-IT", name:"Italian - IT"},
//   {val:"ja-JP", name:"Japanese - JP"},
//   {val:"ko-KR", name:"Korean - KR"},
//   {val:"nb-NO", name:"Norwegian - NO"},
//   {val:"nl-NL", name:"Dutch - NL"},
//   {val:"pl-PL", name:"Polish - PL"},
//   {val:"pt-BR", name:"Portuguese - BR"},
//   {val:"pt-PT", name:"Portuguese - PT"},
//   {val:"ru-RU", name:"Russian - RU"},
//   {val:"sv-SE", name:"Swedish - SE"},
//   {val:"vi-VN", name:"Vietnamese - VN"},
//   {val:"zh-CN", name:"Chinese - CN"},
//   {val:"zh-HK", name:"Chinese - HK"},
//   {val:"zh-TW", name:"Chinese - TW"}
// ];

// const ResultForm = (props: any) => {
//     return (
//         <View style={styles.tableRowStyle}>
//             <View style={styles.tdStyle}>
//               <Text style={props.style}>{props.title}</Text>
//             </View>
//             <View style={styles.tdStyle}>
//               <Text style={props.style}>{props.text}</Text>
//             </View>
//         </View>
//       );
// }

// const Title = () => {
//     return (
//       <View style={styles.sectionContainer}>
//       </View>
//     );
// }

// const FilePicker = (props: any) => {
//     return (
//       <View style={styles.sectionDescription}>
//           <Text style={styles.sectionTitle}>
//           File:
//           </Text>
//         <View>
//             <Button title="Select File" onPress={ props.onFileButtonPress } />
//         </View>
//       </View>
//     );
// }

// const KeyForm = (props: any) => {
//     return (
//       <View style={styles.sectionContainer}>
//         <View>
//           <Text>
//           Subscription:
//           </Text>
//         </View>
//         <View style={styles.sectionContainer}>
//             <TextInput
//               key="random1"
//               value={props.value}
//               onChangeText={(itemValue: any) => props.onChange(itemValue)}
//             />
//         </View>
//       </View>
//     );
// }

// type SelectFormProps = {
//   title: string,
//   value: string,
//   onSelect: (value: string) => void,
//   optionList: JSX.Element[],
// }
// const SelectForm: React.FC<SelectFormProps> = ({ title, value, onSelect, optionList }) => {
//     return (
//       <View style={styles.dropdown}>
//         <Text>{title}:</Text>
//           <Picker
//             style={styles.picker}
//             selectedValue={value}
//             onValueChange={(itemValue) => onSelect(itemValue)} >
//               {optionList}
//           </Picker>
//       </View>
//     );
// }

// type RecognitionBtnProps = {
//   onStart: () => void,
//   onStop: any,
//   recognizing: boolean
// }

// const RecognitionButtons: React.FC<RecognitionBtnProps> = ({onStart, onStop, recognizing}) => {
//     return (
//       <View style={styles.sectionContainer}>
//         <View>
//           <Text style={styles.sectionTitle}>
//           Call Speech SDK method:
//           </Text></View>
//         <View>
//           <Button title="recognize Once" disabled={recognizing} onPress={onStart} />
//         </View>
//       </View>
//     );
// };
// const getBufferFromUri = async (uri: string): Promise<Buffer> => {
//   try {
//     // Directly use the URI provided by DocumentPicker (no need for decodeURIComponent)
//     console.log("File URI:", uri);

//     // Generate a local path to copy the file to
//     const destPath = `${RNFS.TemporaryDirectoryPath}/tempfile.wav`;
//     console.log("Destination Path:", destPath);

//     // Use RNFS to copy the file from the content URI to the temporary local path
//     await RNFS.copyFile(uri, destPath);

//     // Check the file size before reading it
//     const fileStats = await RNFS.stat(destPath);
//     console.log('File size:', fileStats.size);

//     // Limit the file size to avoid memory overload (adjust the size threshold as needed)
//     if (fileStats.size > 1024 * 1024 * 10) {  // Example: 10 MB file size limit
//       throw new Error('File too large to process');
//     }

//     // Now read the file as base64 encoded string
//     const utf8string = await RNFS.readFile(destPath, 'base64');
//     // console.log("Read file as base64:", utf8string);

//     // Return the buffer containing the audio data
//     return Buffer.from(utf8string, 'base64');
//   } catch (error) {
//     console.error('Error reading the file from URI:', error);
//     throw new Error('Failed to process the file URI.');
//   }
// };

// const playAudio = (audioPath: string) => {
//   if (audioPath) {
//     const sound = new Sound(audioPath, '', (error) => {
//       if (error) {
//         console.log('Failed to load the sound', error);
//         return;
//       }
//       // Play the audio file
//       sound.play((success) => {
//         if (success) {
//           console.log('Audio played successfully');
//         } else {
//           console.log('Audio playback failed');
//         }
//       });
//     });
//   }
// };
// const getRecognizer = async (key: string, region: string, language: string, uri: string, filename: string) => {
//   console.log("hehehe1_",uri);
//   const fileBuf = await getBufferFromUri(uri);
//   console.log("uri_", decodeURIComponent(uri))
//   playAudio(uri);
//   const audioConfig = AudioConfig.fromWavFileInput(fileBuf, filename);
//   console.log("hehehe2_",audioConfig);
//   //const p = AudioInputStream.createPushStream();
//   //const fileBuffer = new Uint8Array(1024 * 1024);
//   //const audioConfig = AudioConfig.fromStreamInput(p);
//   //p.write(fileBuffer.buffer);
//   //p.close();

//   const speechConfig = SpeechConfig.fromSubscription('1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW', 'eastus');
//   console.log("SpeechConfig: ", speechConfig);
//   speechConfig.speechRecognitionLanguage = 'en-US';
//   return new SpeechRecognizer(speechConfig, audioConfig);
// };

// const setRecognizerCallbacks = (reco: SpeechRecognizer, componentRef: Component) => {
//   reco.recognizing = (s, e) => {
//     // window.console.log(e);
//     componentRef.setState((state: any) => ({ events: `${state.events} (recognizing) Reason: ${ResultReason[e.result.reason]} Text: ${e.result.text}\n`, results: e.result.text}));
//   };
//   // The event signals that the service has stopped processing speech.
//   // https://docs.microsoft.com/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognitioncanceledeventargs?view=azure-node-latest
//   // This can happen for two broad classes or reasons.
//   // 1. An error is encountered.
//   //    In this case the .errorDetails property will contain a textual representation of the error.
//   // 2. No additional audio is available.
//   //    Caused by the input stream being closed or reaching the end of an audio file.
//   reco.canceled = (s, e) => {

//       let eventText = `(cancel) Reason: ${CancellationReason[e.reason]}`;
//       if (e.reason === CancellationReason.Error) {
//         eventText += `: ${e.errorDetails}`;
//       }
//       componentRef.setState((state: any) => ({ events: `${state.events}${eventText}\n` }));
//   };

//   // The event recognized signals that a final recognition result is received.
//   // This is the final event that a phrase has been recognized.
//   // For continuous recognition, you will get one recognized event for each phrase recognized.
//   reco.recognized = (s, e) => {
//       // Indicates that recognizable speech was not detected, and that recognition is done.
//       let eventText = `(recognized)  Reason: ${ResultReason[e.result.reason]}`;
//       if (e.result.reason === ResultReason.NoMatch) {
//         var noMatchDetail = NoMatchDetails.fromResult(e.result);
//         eventText += ` NoMatchReason: ${NoMatchReason[noMatchDetail.reason]}\n`;
//       } else {
//         eventText += ` Text: ${e.result.text}\n`;
//       }
//       componentRef.setState((state: any) => ({ events: `${state.events}${eventText}\n` }));
//   };

//   // Signals that a new session has started with the speech service
//   reco.sessionStarted = (s, e) => {
//     //window.console.log(e);
//     componentRef.setState((state: any) => ({ events: `${state.events}(sessionStarted) SessionId: ${e.sessionId}\n`}));
//   };

//   // Signals the end of a session with the speech service.
//   reco.sessionStopped = (s, e) => {
//     //window.console.log(e);
//     componentRef.setState((state: any) => ({ events: `${state.events}(sessionStopped) SessionId: ${e.sessionId}\n`}));
//   };

//   // Signals that the speech service has started to detect speech.
//   reco.speechStartDetected = (s, e) => {
//     //window.console.log(e);
//     componentRef.setState((state: any) => ({ events: `${state.events}(speechStartDetected) SessionId: ${e.sessionId}\n`}));
//   };

//   // Signals that the speech service has detected that speech has stopped.
//   reco.speechEndDetected = (s, e) => {
//     //window.console.log(e);
//     componentRef.setState((state: any) => ({ events: `${state.events}(speechEndDetected) SessionId: ${e.sessionId}\n`}));
//   };
// };

// const recognizeWith = (reco: SpeechRecognizer, componentRef: Component) => {
//   // Note: this is how to process the result directly rather than subscribing to the recognized event
//   // The continuation below shows how to get the same data from the final result as you'd get from the
//   // events above.
//   reco.recognizeOnceAsync(
//     (result) => {
//         // window.console.log(result);

//         let eventText = `(continuation) Reason: ${ResultReason[result.reason]}`;
//         switch (result.reason) {
//           case ResultReason.RecognizedSpeech:
//             eventText += ` Text: ${result.text}`;
//             break;
//           case ResultReason.NoMatch:
//             var noMatchDetail = NoMatchDetails.fromResult(result);
//             eventText += ` NoMatchReason: ${NoMatchReason[noMatchDetail.reason]}`;
//             break;
//           case ResultReason.Canceled:
//             var cancelDetails = CancellationDetails.fromResult(result);
//             eventText += ` CancellationReason: ${CancellationReason[cancelDetails.reason]}`;
//             if (cancelDetails.reason === CancellationReason.Error) {
//               eventText += `: ${cancelDetails.errorDetails}`;
//             }
//             break;
//           default:
//             break;
//         }
//         componentRef.setState((state: any) => ({ events: `${state.events}${eventText}\n`, results: `${result.text}\n`, recognizing: false }));
//     },
//     (err) => {
//       componentRef.setState({ results: `ERROR: ${err}`, recognizing: false });
//     });
// };

// type SpeechState = {
//   subscriptionKey: string,
//   language: string,
//   region: string,
//   results: string,
//   events: string,
//   filename: string,
//   uri: string,
//   recognizing: boolean,
// };

// class SpeechTable extends Component<{}, SpeechState> {

//   private reco: SpeechRecognizer | null;
//   constructor(props: any) {
//     super(props);
//     this.state = {uri: "", filename: "", results: "(from File)", events: "", subscriptionKey: "YOUR_SPEECH_API_KEY", recognizing: false, language: "en-US", region:"westus"};
//     this.reco = null;
//   }

//   requestPermissions = async () => {
//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
//         {
//           title: "Storage Permission",
//           message: "This app needs access to your storage to select files.",
//           buttonNegative: "Cancel",
//           buttonPositive: "OK",
//         }
//       );

//       if (granted === PermissionsAndroid.RESULTS.GRANTED) {
//         console.log("Storage permission granted");
//       } else {
//         console.log("Storage permission denied");
//       }
//     } catch (err) {
//       console.warn(err);
//     }
//   };

//   updateKey = (value: string) => this.setState({ subscriptionKey: value });
//   updateLanguage = (value: string) => this.setState({ language: value });
//   updateRegion = (value: string) => {
//     console.log(`updateRegion: ${value}`);
//     this.setState({ region: value });
//   };

//   updateFile = async () => {
//     try {
//       // DocumentPicker will ask the user to select a file
//       const res = await DocumentPicker.pick({
//         type: [DocumentPicker.types.audio], // Specify that you're looking for audio files
//       });
//       await this.requestPermissions();

//       console.log('Picked file:', res);

//       // Update the state with the selected file's URI and filename
//       this.setState({
//         filename: res[0].name,
//         uri: res[0].uri,
//       });

//     } catch (err) {
//       console.log('Error selecting file:', err);
//     }
//   };

//   startRecognition = async () => {
//     console.log("Starting recognition with file:", this.state.uri);
//     this.reco = await getRecognizer(this.state.subscriptionKey, this.state.region, this.state.language, this.state.uri, this.state.filename);
//     if (this.reco) {
//       this.setState({results: "", events: "", recognizing: true});
//       setRecognizerCallbacks(this.reco, this);
//       recognizeWith(this.reco, this);
//     }
//   };
//   disposeReco = () => {
//     (this.reco as SpeechRecognizer).close();
//     this.reco = null;
//   };

//   endRecognition = () => {
//     this.setState({ recognizing: false });
//     if(this.reco !== undefined && this.reco !== null) {
//       this.reco.stopContinuousRecognitionAsync(
//         () => this.disposeReco(),
//         (e) => this.disposeReco()
//       );
//     }
//   };

//   render() {
//     return (
//       //Table, tbody
//       <View style={styles.tableDefaultStyle}>
//         <View style={styles.tableColumnStyle}>
//           <Title />
//           <KeyForm value={this.state.subscriptionKey} onChange={this.updateKey} />
//           <View style={styles.tableRowStyle}>
//             <SelectForm title={"Language"} value={this.state.language} onSelect={this.updateLanguage} optionList={optList(languageOptions)} />
//             <SelectForm title={"Region"} value={this.state.region} onSelect={this.updateRegion} optionList={optList(regionOptions)} />
//           </View>
//           <View style={styles.tableRowStyle}>
//             <FilePicker value={this.state.filename} onFileButtonPress={this.updateFile} />
//             <RecognitionButtons recognizing={this.state.recognizing} onStart={this.startRecognition} onStop={this.endRecognition}/>
//           </View>

//           <ResultForm title="Results:" text={this.state.results} />
//           <ResultForm title="Events:" text={this.state.events} />
//         </View>
//       </View>
//     );
//   }
// }

// const App = () => {
//   return (
//     <SpeechTable />
//   );
// };

// const styles = StyleSheet.create({
//    sectionContainer: {
//      marginTop: 2,
//      paddingHorizontal: 24,
//    },
//    sectionTitle: {
//      fontSize: 24,
//      fontWeight: '500',
//    },
//    dropdown: {
//      marginTop: 8,
//      fontSize: 18,
//      fontWeight: '400',
//      paddingBottom: 5,
//      paddingLeft: 10,
//      width: '45%',
//    },
//    sectionDescription: {
//      marginTop: 2,
//      fontSize: 18,
//      fontWeight: '400',
//      paddingBottom: 5,
//      paddingLeft: 10,
//      width: '25%',
//    },
//    highlight: {
//      fontWeight: '700',
//    },
//    tableDefaultStyle: {
//      flex: 1,
//      justifyContent: "flex-start"
//    },
//    tdStyle: {
//      flex: 1,
//      justifyContent: "flex-start",
//      padding: 2
//    },
//    tableRowStyle: {
//      flex: 3,
//      marginTop: 5,
//      justifyContent: "flex-start",
//      flexDirection: "row",
//    },
//    tableColumnStyle: {
//      flex: 1,
//      justifyContent: "flex-start",
//      flexDirection: "column",
//      alignItems: "stretch"
//    },
//    picker: {
//      color: '#333',
//      width: '65%',
//    },
// });

// export default App;
