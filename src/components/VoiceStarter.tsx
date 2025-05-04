import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { combinedLanguages } from '../contains/lan_code';
import Icon  from 'react-native-vector-icons/FontAwesome5';
import Loading from './Loading';

const CallStarter = ({ user, chatId }) => {
  const navigation = useNavigation();

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [selectedLang, setSelectedLang] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLanguages, setFilteredLanguages] = useState(combinedLanguages);
  const [loading, setLoading] = useState(false);
 
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredLanguages(combinedLanguages);
    } else {
      const filtered = combinedLanguages.filter(lang => 
        lang.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLanguages(filtered);
    }
  }, [searchQuery]);

  const openLanguageModal = () => {
    setLangModalVisible(true);
  };

  const confirmLanguageAndNavigate = async () => {
    setLoading(true);
    console.log('Selected Language:', selectedLang);
    if (!selectedLang) return;
    setLangModalVisible(false);
    const updatedUser = {
      uid: user.uid || user._user?.uid,
      email: user.email || user._user?.email,
      displayName: user.displayName || user._user?.displayName,
      photoURL: user.photoURL || user._user?.photoURL,
      language: selectedLang.code,
      translateCode: selectedLang.transCode,
      role: 'member',
    };

    const meetingRef = firestore().collection('meetings').doc(chatId);

    try {
      console.log('Meeting ID:', chatId);
      const doc = await meetingRef.get();
      if (!doc.exists) {
        updatedUser.role = 'admin';
        await meetingRef.set({
          createdAt: firestore.Timestamp.now(),
          createdBy: updatedUser.uid,
          members: [updatedUser],
        });
      } else {
        const currentMembers = doc.data()?.members || [];
        const alreadyExists = currentMembers.find((m) => m.uid === updatedUser.uid);

        let updatedMembers;
        if (alreadyExists) {
          updatedMembers = currentMembers.map((m) =>
            m.uid === updatedUser.uid ? updatedUser : m
          );
        } else {
          updatedMembers = [...currentMembers, updatedUser];
        }
        console.log('Updated Members:', updatedMembers);
        await meetingRef.update({ members: updatedMembers });
        setLoading(false);
      }

      navigation.navigate('VoiceCall', {
        user: updatedUser,
        meetingId: chatId,
      });
    } catch (err) {
      setLoading(false);
      console.error('Lỗi khi cập nhật Firestore:', err);
    }
  };
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openLanguageModal} style={styles.callButton}>
        {/* <Text style={styles.callButtonText}>Call</Text> */}
        {/* <Icon></Icon> */}
        <Icon name="phone" size={24} color="#fff" 
          style={{ transform: [{ rotate: '90deg' }] }}

        />
        
      </TouchableOpacity>
      <Loading isLoading={loading} />
      <Modal visible={langModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Language</Text>
            <View style={styles.separator} />
            
            <TextInput
              style={styles.searchInput}
              placeholderTextColor="#A0A3BD" // 🎯 màu bạn muốn
              placeholder="Search language..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />

            <FlatList
              data={filteredLanguages}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.languageItem,
                    selectedLang?.code === item.code && styles.selectedLanguage,
                  ]}
                  onPress={() => setSelectedLang(item)}
                >
                  <Text
                    style={[
                      styles.languageText,
                      selectedLang?.code === item.code && styles.selectedLanguageText,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={() => setLangModalVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmLanguageAndNavigate}
                style={[styles.confirmButton, !selectedLang && styles.disabledButton]}
                disabled={!selectedLang}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // backgroundColor: 'red',
    // paddingHorizontal: 24,
    alignItems: 'center'
  },
  callButton: {
    backgroundColor: '#4361EE',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    width: '100%',
  },
  callButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  separator: {
    height: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
    borderRadius: 1,
  },
  searchInput: {
    backgroundColor: '#F5F7FF',
    color: 'black',
    borderWidth: 1,
    borderColor: '#E6E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  languageList: {
    marginBottom: 20,
    maxHeight: 300,
  },
  languageItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F5F7FF',
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  selectedLanguage: {
    backgroundColor: '#E7EFFF',
    borderColor: '#4361EE',
    borderWidth: 2,
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedLanguageText: {
    color: '#4361EE',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  confirmButton: {
    backgroundColor: '#4361EE',
    padding: 16,
    borderRadius: 16,
    flex: 1,
    marginLeft: 10,
    elevation: 4,
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'red',
    padding: 16,
    borderRadius: 16,
    flex: 1,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  disabledButton: {
    backgroundColor: '#A8B8FF',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CallStarter;
