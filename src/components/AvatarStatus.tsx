import React from 'react';
import {View, Image, StyleSheet, ViewStyle} from 'react-native';

interface AvatarStatusProps {
  avatarUrl?: string;
  status: 'online' | 'offline' | 'away';
  size?: number;
  style?: ViewStyle;
}

const AvatarStatus: React.FC<AvatarStatusProps> = ({
  avatarUrl,
  status,
  size = 48,
  style,
}) => {
  const getStatusColor = (): string => {
    switch (status) {
      case 'online':
        return '#44b700'; // Messenger green
      case 'away':
        return '#ff9500'; // Orange for away
      default:
        return '#8e8e93'; // Gray for offline
    }
  };

  const statusSize = size * 0.3; // Status dot is 30% of avatar size
  const statusBorder = size * 0.08; // Border is 8% of avatar size

  return (
    <View style={[styles.container, style, {width: size, height: size}]}>
      <Image
        source={
          avatarUrl ? {uri: avatarUrl} : require('../assets/default-avatar.png')
        }
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
      <View
        style={[
          styles.statusDot,
          {
            width: statusSize,
            height: statusSize,
            borderRadius: statusSize / 2,
            borderWidth: statusBorder,
            backgroundColor: getStatusColor(),
            bottom: -2,
            right: -2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: '#f0f0f0',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    borderColor: '#ffffff',
    // Shadow for better visibility
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 1.41,
    elevation: 2,
  },
});

export default AvatarStatus;
