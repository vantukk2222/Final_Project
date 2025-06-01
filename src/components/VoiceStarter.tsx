import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import {combinedLanguages} from '../contains/lan_code';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Loading from './Loading';
import {useAuth} from '../contexts/AuthContext';
import messaging from '@react-native-firebase/messaging';
import {io} from 'socket.io-client';
import {Member} from '../contains/type';
import LanguageModal from './LanSelect';
const SOCKET_SERVER_URL = 'ws://backendfinalpro-ct.onrender.com';

const CallStarter = ({user, chatId, isLanModalVisible = false}) => {
  const navigation = useNavigation();
  const [langModalVisible, setLangModalVisible] = useState(isLanModalVisible);
  // const [selectedLang, setSelectedLang] = useState(null);
  const [loading, setLoading] = useState(false);
  // ...other state...

  // ...other hooks...

  const openLanguageModal = () => setLangModalVisible(true);

  // Nhận selectedLang từ Modal và xử lý tiếp
  // const handleLanguageSelected = async (lang) => {
  //   setLangModalVisible(false);
  //   if (!lang) return;
  //   setSelectedLang(lang);
  //   // setLoading(false);
  // };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openLanguageModal} style={styles.callButton}>
        <Icon
          name="phone"
          size={24}
          color="#fff"
          style={{transform: [{rotate: '90deg'}]}}
        />
      </TouchableOpacity>
      <Loading isLoading={loading} />
      <LanguageModal
        visible={langModalVisible}
        chatId={chatId}
        onDone={setLangModalVisible}
        setLoading={setLoading}
        fromChatScreen={true}
      />
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    // backgroundColor: 'red',
    // paddingHorizontal: 24,
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#4361EE',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#4361EE',
    shadowOffset: {width: 0, height: 4},
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
    shadowOffset: {width: 0, height: 10},
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
    shadowOffset: {width: 0, height: 4},
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
