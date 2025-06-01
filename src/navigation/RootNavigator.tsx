import React, {useEffect} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import {ActivityIndicator, View} from 'react-native';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChatMembersList from '../components/ChatMembersList';
import VoiceCallScreen from '../screens/VoiceCallScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import {fcmService} from '../services/FCMService';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const {user, loading} = useAuth();

  // Initialize FCM service
  useEffect(() => {
    fcmService.initialize();

    return () => {
      fcmService.cleanup();
    };
  }, []);

  // Handle user changes
  useEffect(() => {
    fcmService.setUser(user?.uid || null);
  }, [user?.uid]);

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
