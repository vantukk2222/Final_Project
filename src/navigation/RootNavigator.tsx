// src/navigation/RootNavigator.tsx
import React, {useEffect, useRef, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import {ActivityIndicator, View} from 'react-native';
import UserProfileScreen from '../screens/UserProfileScreen';
// import { TranslateScreen } from '../../App_mic_input_translated';
import ChatMembersList from '../components/ChatMembersList';
import VoiceCallScreen from '../screens/VoiceCallScreen';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';

const Stack = createNativeStackNavigator();
const RootNavigator = () => {
  const {user, loading} = useAuth();
  const tokenRef = useRef(null);

  const [storedToken, setStoredToken] = useState(null);
  useEffect(() => {
    async function requestPermission() {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (enabled) {
        console.log('Authorization status:', authStatus);
      }
    }
    requestPermission();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    async function saveTokenIfChanged() {
      const fcmToken = await messaging().getToken();

      if (fcmToken && fcmToken !== tokenRef.current) {
        tokenRef.current = fcmToken;
        await firestore().collection('users').doc(user.uid).update({
          fcmToken: fcmToken,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    saveTokenIfChanged();

    const unsubscribe = messaging().onTokenRefresh(async newToken => {
      if (newToken !== tokenRef.current && user?.uid) {
        await firestore()
          .collection('users')
          .doc(user.uid)
          .update({fcmToken: newToken});
        tokenRef.current = newToken;
        console.log('FCM Token refreshed:', newToken);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);
  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <>
      {user && user.role !== 'admin' ? (
        <Stack.Navigator initialRouteName="ChatList">
          <Stack.Screen
            name="ChatList"
            component={ChatListScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="ChatMembers"
            component={ChatMembersList}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="VoiceCall"
            component={VoiceCallScreen}
            options={{headerShown: false}}
          />
        </Stack.Navigator>
      ) : user && user.role === 'admin' ? (
        <Stack.Navigator initialRouteName="AdminDashboard">
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{headerShown: false}}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{headerShown: false}}
          />
        </Stack.Navigator>
      )}
    </>
  );
};

export default RootNavigator;
