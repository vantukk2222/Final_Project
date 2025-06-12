/**
 * @format
 */

// How to run continuous recognition?
// 1. Change the line from "import App from './App';" to "import App from './App_mic_input';"
// * If you want to use continuous recognition with live translation change the line to "import App from './App_mic_input_translated';"
// 2. Run

import 'react-native-get-random-values';
import './polyfills';

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
// import App_mic_input_translated from './App_mic_input_translated';
import App from './App';
import TrackPlayer from 'react-native-track-player';
import {trackPlayerEventHandler} from './src/services/trackPlayerService';
// import { TranslateScreen } from './App_mic_input_translated';
console.log('🔍 AppRegistry.registerComponent đang được gọi đúng cách');

import './src/services/backgroundHandler';

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => trackPlayerEventHandler);
