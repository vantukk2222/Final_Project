import React from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';

interface Props {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

const ImageModal = ({visible, imageUrl, onClose}: Props) => {
  if (!imageUrl) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Image
            source={{uri: imageUrl}}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    position: 'relative',
    width: '90%',
    height: '80%',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 2,
    backgroundColor: '#00000080',
    padding: 6,
    borderRadius: 20,
  },
  closeText: {
    fontSize: 20,
    color: 'white',
  },
});

export default ImageModal;
