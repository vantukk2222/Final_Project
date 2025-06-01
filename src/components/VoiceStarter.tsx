import React, {useState} from 'react';
import {View, TouchableOpacity, StyleSheet, Text} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loading from './Loading';
import LanguageModal from './LanSelect';
import LinearGradient from 'react-native-linear-gradient';

const CallStarter = ({chatId, isLanModalVisible = false, user}) => {
  const [langModalVisible, setLangModalVisible] = useState(isLanModalVisible);
  const [loading, setLoading] = useState(false);

  const openLanguageModal = () => setLangModalVisible(true);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={openLanguageModal}
        style={styles.callButton}
        activeOpacity={0.8}>
        <LinearGradient
          colors={['#4AC6D0', '#3BB8C3']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.callButtonGradient}>
          <Icon name="call" size={20} color="#fff" />
        </LinearGradient>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  callButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styles cũng cải thiện theo theme
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    maxHeight: '85%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '500',
  },
  languageList: {
    marginBottom: 20,
    maxHeight: 320,
  },
  languageItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedLanguage: {
    backgroundColor: '#E0F7FA', // Light cyan
    borderColor: '#4AC6D0',
    borderWidth: 2,
  },
  languageText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  selectedLanguageText: {
    color: '#4AC6D0',
    fontWeight: '700',
  },
  languageFlag: {
    fontSize: 18,
    marginRight: 12,
  },
  checkIcon: {
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 16,
  },

  // Additional styles for enhanced UI
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default CallStarter;
