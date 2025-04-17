// src/screens/UserProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleImageUpload } from '../utils/imageUpload';

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
          setName(data.name || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatar.url || '');
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
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    }
    setLoading(false);
  };

  const handlePickImage = async () => {
    setUploading(true);
    const url = await handleImageUpload();
    if (url) setAvatarUrl(url);
    Alert.alert('Success', 'Image uploaded successfully');
    setUploading(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
        <Image
          source={
            typeof avatarUrl === 'string' && avatarUrl.trim() !== ''
              ? { uri: avatarUrl }
              : require('../assets/default-avatar.png')
          }
          style={styles.avatar}
        />
        {uploading ? (
          <ActivityIndicator style={{ marginTop: 8 }} />
        ) : (
          <Text style={styles.changePhotoText}>Change Photo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Enter your name"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell us about yourself"
        placeholderTextColor="#888"
        multiline
      />

      <Button title={loading ? 'Saving...' : 'Save'} onPress={handleSave} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ccc',
  },
  changePhotoText: {
    marginTop: 8,
    color: '#007bff',
    fontSize: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    color: '#000',
    marginTop: 8,
  },
});

export default UserProfileScreen;