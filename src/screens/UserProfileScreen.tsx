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
          <Text style={styles.headerTitle}>Your Profile</Text>
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
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
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
    padding: 20,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
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
  saveButton: {
    marginTop: 10,
    backgroundColor: '#4AC6D0',
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#80c4cb',
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default UserProfileScreen;
