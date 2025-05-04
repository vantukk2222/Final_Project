// src/screens/UserProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator, Modal, ScrollView, SafeAreaView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleImageUpload } from '../utils/imageUpload';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Loading from '../components/Loading';

const UserProfileScreen = () => {
  const { user } = useAuth();
  const userId = user?.uid;

  const [name, setName] = useState('');
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
          console.log("User data:", data);
          setName(data?.name || '');
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
          Alert.alert('Error', 'Failed to upload image');
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
            <Icon name="camera" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
          <Loading isLoading={uploading} />
        {/* <Modal visible={uploading} transparent={true} animationType="fade">
          <View style={styles.modalBackground}>
            <ActivityIndicator size="large" color="#4AC6D0" />
          </View>
        </Modal> */}

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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: '#E6F7FF',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ccc',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4AC6D0',
    borderRadius: 20,
    padding: 8,
  },
  inputGroup: {
    width: '100%',
    marginTop: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    color: '#333',
    elevation: 2,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 30,
    backgroundColor: '#4AC6D0',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default UserProfileScreen;
