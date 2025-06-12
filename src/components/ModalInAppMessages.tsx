import React, {useEffect, useRef} from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
const InAppMessageNotification = ({
  visible,
  notificationData,
  onPress,
  onDismiss,
  fadeAnim,
  slideAnim,
}) => {
  const slideDownAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Animated.parallel([
      //   Animated.timing(fadeAnim, {
      //     toValue: 1,
      //     duration: 300,
      //     useNativeDriver: true,
      //   }),
      //   Animated.spring(slideDownAnim, {
      //     toValue: 0,
      //     tension: 80,
      //     friction: 8,
      //     useNativeDriver: true,
      //   }),
      // ]).start();

      // Auto dismiss after 4 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      // Animated.parallel([
      //   Animated.timing(fadeAnim, {
      //     toValue: 0,
      //     duration: 200,
      //     useNativeDriver: true,
      //   }),
      //   Animated.timing(slideDownAnim, {
      //     toValue: -100,
      //     duration: 200,
      //     useNativeDriver: true,
      //   }),
      // ]).start();
    }
  }, [visible]);

  if (!visible || !notificationData) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.inAppNotificationContainer,
        {
          // opacity: fadeAnim,
          // transform: [{translateY: slideDownAnim}],
        },
      ]}>
      <TouchableOpacity
        style={styles.inAppNotification}
        onPress={onPress}
        activeOpacity={0.9}>
        <LinearGradient
          colors={['#4AC6D0', '#3BB8C3']}
          style={styles.inAppNotificationGradient}>
          {/* Avatar */}
          <View style={styles.inAppAvatar}>
            <Icon name="message" size={24} color="#fff" />
          </View>

          {/* Content */}
          <View style={styles.inAppContent}>
            <Text style={styles.inAppTitle} numberOfLines={1}>
              {notificationData.title}
            </Text>
            <Text style={styles.inAppBody} numberOfLines={2}>
              {notificationData.body}
            </Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.inAppCloseButton}
            onPress={onDismiss}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="close" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  inAppNotificationContainer: {
    position: 'absolute',
    top: StatusBar.currentHeight || 44,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 25,
  },
  inAppNotification: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 12,
    // Glassmorphism effect
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
  },
  inAppNotificationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 80,
    backgroundColor: 'transparent',
  },
  inAppAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  inAppContent: {
    flex: 1,
    marginRight: 12,
  },
  inAppTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  inAppBody: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
    fontWeight: '500',
  },
  inAppCloseButton: {
    padding: 1,
    borderRadius: 20,
    backgroundColor: 'red',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
export default InAppMessageNotification;
