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
import ViewUserProfileScreen from '../screens/ViewUserProfileScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import TourManagementScreen from '../screens/TourManagementScreen';
import CreateTourScreen from '../screens/CreateTourScreen';
import TourDetailScreen from '../screens/TourDetailScreen';
import EditTourScreen from '../screens/EditTourScreen';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const {user, loading, role} = useAuth();

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
      {user && user.isActive !== false ? (
        user.role === 'admin' ? (
          <Stack.Navigator initialRouteName="AdminDashboard">
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ViewUserProfile"
              component={ViewUserProfileScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="TourManagement"
              component={TourManagementScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="CreateTour"
              component={CreateTourScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="TourDetail"
              component={TourDetailScreen}
              options={{headerShown: false}}
            />

            <Stack.Screen
              name="EditTour"
              component={EditTourScreen}
              options={{headerShown: false}}
            />
          </Stack.Navigator>
        ) : user.role === 'tour_guide' && user.status === 'approved' ? (
          <Stack.Navigator initialRouteName="TourManagement">
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
            <Stack.Screen
              name="ViewUserProfile"
              component={ViewUserProfileScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                headerShown: false,
                presentation: 'modal', // Optional: modal presentation
              }}
            />
            <Stack.Screen
              name="TourManagement"
              component={TourManagementScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="CreateTour"
              component={CreateTourScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="TourDetail"
              component={TourDetailScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="EditTour"
              component={EditTourScreen}
              options={{headerShown: false}}
            />
          </Stack.Navigator>
        ) : user.role === 'tourist' ? (
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
            <Stack.Screen
              name="ViewUserProfile"
              component={ViewUserProfileScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                headerShown: false,
                presentation: 'modal', // Optional: modal presentation
              }}
            />
            <Stack.Screen
              name="TourManagement"
              component={TourManagementScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="CreateTour"
              component={CreateTourScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="TourDetail"
              component={TourDetailScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="EditTour"
              component={EditTourScreen}
              options={{headerShown: false}}
            />
          </Stack.Navigator>
        ) : (
          // Fallback for users with issues (pending tour guides, etc.)
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
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
              }}
            />
          </Stack.Navigator>
        )
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
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </Stack.Navigator>
      )}
    </>
  );
};

export default RootNavigator;
