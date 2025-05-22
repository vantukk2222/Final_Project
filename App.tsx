// App.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import SocketClient from './src/services/socketClient';
import NotificationModal from './src/components/NotificationModal';

const AppContent = () => {
  
  const { loading } = useAuth();
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return <RootNavigator />;
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <SocketClient />
        {/* <NotificationModal /> */}
        <AppContent />
      </NavigationContainer>
    </AuthProvider>
  );
}
