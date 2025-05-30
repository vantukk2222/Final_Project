// src/screens/UserProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator, Modal, ScrollView, SafeAreaView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleImageUpload } from '../utils/imageUpload';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Loading from '../components/Loading';
import { useNavigation } from '@react-navigation/native';

const UserProfileScreen = () => {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const userId = user?.uid;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const doc = await firestore().collection('users').doc(userId).get();
        const data = doc.data();
        if (data) {
          setName(data?.name || '');
          setEmail(data?.email || '');
          setBio(data?.bio || '');
          setAvatarUrl(data?.avatar || '');
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadProfile();
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await firestore().collection('users').doc(userId).update({
        name,
        bio,
        avatar: avatarUrl,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert('Success', 'Your profile has been updated!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    }
    setLoading(false);
  };

  const handlePickImage = async () => {
    setUploading(true);
    handleImageUpload()
      .then(async (url) => {
        if (!url) {
          setUploading(false);
          return;
        }
        setAvatarUrl(url);
        await firestore().collection('users').doc(userId).update({
          avatar: url,
        });
        Alert.alert('Success', 'Image uploaded successfully');


      })
      .catch((error) => {
        console.error("Image upload error:", error);
        Alert.alert('Error', 'Failed to upload image');
      })
      .finally(() => {
        setUploading(false);
      });
    // if (url)
    //   {
    //     console.log("Image URL:", url.url);
    //     setAvatarUrl(url);
    //     Alert.alert('Success', 'Image uploaded successfully');
    //   } 
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            navigation.goBack();
          }} style={styles.headerIcon}>
            <Icon name="chevron-left" size={24} color="#5B72EF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Profile</Text>
          <View></View>
        </View>
        
        <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
          <Image
            source={
              avatarUrl
                ? { uri: avatarUrl.url }
                : require('../assets/default-avatar.png')
            }
            style={styles.avatar}
          />
          <View style={styles.editIcon}>
            <Icon name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <Loading isLoading={uploading} />
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <Text
              style={styles.input}
            >{email}</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#aaa"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about your adventures..."
              placeholderTextColor="#aaa"
              multiline
            />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
              onPress={handleSave} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={16} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
              <Icon name="sign-out-alt" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#f0f6ff',
  },
  content: {
    alignItems: 'center',
  },
  header: {
    padding: 8,

    display: 'flex',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF5',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  headerIcon: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 15,
  },
  avatarContainer: {
    marginVertical: 15,
    alignItems: 'center',
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#e1e1e1',
    borderWidth: 4,
    borderColor: '#fff',
  },
  editIcon: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#4AC6D0',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  buttonRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  marginTop: 20,
},

  saveButton: {
    flex: 1,
    backgroundColor: '#4AC6D0',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  saveButtonDisabled: {
    backgroundColor: '#80c4cb',
  },

  logoutButton: {
    flex: 1,
    backgroundColor: '#ff6b6b',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  buttonIcon: {
    marginRight: 8,
  },

  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

});

export default UserProfileScreen;
