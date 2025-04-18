// src/navigation/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import { ActivityIndicator, View } from 'react-native';
import UserProfileScreen from '../screens/UserProfileScreen';
import { TranslateScreen } from '../../App_mic_input_translated';
import ChatMembersList from '../components/ChatMembersList';
import VoiceCallScreen from '../screens/VoiceCallScreen';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }
  
  return (
    <>
      {user ? (
        <Stack.Navigator initialRouteName="ChatList">
          <Stack.Screen 
            name="ChatList" 
            component={ChatListScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UserProfile" 
            component={UserProfileScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Translate" 
            component={TranslateScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ChatMembers"
            component={ChatMembersList}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="VoiceCall" 
            component={VoiceCallScreen} 
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen} 
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      )}
    </>
  );
};

export default RootNavigator;
