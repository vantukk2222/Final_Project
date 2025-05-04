// src/components/AvatarButton.tsx
import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';

interface AvatarButtonProps {
  onPress: () => void;
  imageUrl?: string;
}

const AvatarButton = ({ onPress, imageUrl, style }: AvatarButtonProps) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Image
        source={
          imageUrl
            ? { uri: imageUrl }
            : require('../assets/default-avatar.png') // cần thêm ảnh mặc định
        }
        style={style}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 30,
  },
});

export default AvatarButton;
