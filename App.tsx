import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {View, ActivityIndicator, Text} from 'react-native';

import {
  TranslationProvider,
  useTranslation,
} from './src/contexts/TranslationContext';
import LanguageSelectionScreen from './src/screens/LanguageSelectionScreen';
import {AuthProvider} from './src/contexts/AuthContext';
import SocketClient from './src/services/socketClient';
import {SocketProvider} from './src/contexts/SocketContext';
import RootNavigator from './src/navigation/RootNavigator';
import {setupPlayer} from './src/services/trackPlayerService';

// Azure Translator credentials
const AZURE_KEY =
  'CM9T6m7rgYNegLOVQyQllWwGbl6yrLmftrYyQDYJoKD0DlWMzVF7JQQJ99BEACYeBjFXJ3w3AAAbACOGF9m3';
const AZURE_REGION = 'eastus';

// const key =
//   '1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW';
// const keySTT =
//   'CM9T6m7rgYNegLOVQyQllWwGbl6yrLmftrYyQDYJoKD0DlWMzVF7JQQJ99BEACYeBjFXJ3w3AAAbACOGF9m3';
// const region = 'eastus';

const LoadingScreen = () => (
  <View
    style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#4AC6D0',
    }}>
    <ActivityIndicator size="large" color="#FFFFFF" />
    <Text
      style={{
        color: '#FFFFFF',
        fontSize: 16,
        marginTop: 16,
        fontWeight: '600',
      }}>
      Loading...
    </Text>
  </View>
);

const AppContent = () => {
  const {isFirstLaunch, isLoading, isTranslating} = useTranslation();
  const [languageSelected, setLanguageSelected] = useState(false);

  useEffect(() => {
    if (!isLoading && !isFirstLaunch) {
      setLanguageSelected(true);
    }
  }, [isLoading, isFirstLaunch]);

  // Show loading during initialization
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show loading during translation (after language selection)
  if (isTranslating) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#4AC6D0',
        }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 16,
            marginTop: 16,
            fontWeight: '600',
          }}>
          Preparing your language...
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            marginTop: 8,
            textAlign: 'center',
            paddingHorizontal: 32,
          }}>
          This may take a moment for the first time
        </Text>
      </View>
    );
  }

  // Show language selection for first launch
  if (isFirstLaunch && !languageSelected) {
    return (
      <LanguageSelectionScreen
        onLanguageSelected={() => setLanguageSelected(true)}
      />
    );
  }

  // Show main app
  return (
    <AuthProvider>
      <SocketProvider>
        <NavigationContainer>
          <SocketClient />
          {/* <NotificationModal /> */}
          {/* <AppContent /> */}
          <RootNavigator />
          {/* <MainTabNavigator /> */}
        </NavigationContainer>
      </SocketProvider>
    </AuthProvider>
  );
};

export default function App() {
  useEffect(() => {
    const initializeTrackPlayer = async () => {
      try {
        await setupPlayer();
        console.log('✅ TrackPlayer initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize TrackPlayer:', error);
      }
    };

    initializeTrackPlayer();
  }, []);

  return (
    <TranslationProvider azureKey={AZURE_KEY} azureRegion={AZURE_REGION}>
      <AppContent />
    </TranslationProvider>
  );
}
