import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';

const ChatOptionsModal = ({visible, onClose, onDelete, onViewInfo}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Options</Text>

              <TouchableOpacity style={styles.modalButton} onPress={onDelete}>
                <Text style={[styles.modalButtonText, {color: 'red'}]}>
                  Delete Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalButton} onPress={onViewInfo}>
                <Text style={styles.modalButtonText}>View Info</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: '#ccc'}]}
                onPress={onClose}>
                <Text style={[styles.modalButtonText, {color: '#333'}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '75%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ChatOptionsModal;
