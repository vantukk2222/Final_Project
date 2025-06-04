import React, {useEffect, useRef} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useTranslation} from '../contexts/TranslationContext';

const {width, height} = Dimensions.get('window');

interface SuccessModalProps {
  visible: boolean;
  title: string;
  message: string;
  onContinue: () => void;
  onClose?: () => void;
  icon?: string;
  iconColor?: string;
  continueText?: string;
  showCloseButton?: boolean;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  title,
  message,
  onContinue,
  onClose,
  icon = 'check-circle',
  iconColor = '#10B981',
  continueText,
  showCloseButton = false,
}) => {
  const {t} = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Handle back button on Android
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (showCloseButton && onClose) {
            onClose();
          }
          return true;
        },
      );

      return () => backHandler.remove();
    } else {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      slideAnim.setValue(50);
    }
  }, [visible]);

  const handleClose = () => {
    if (onClose) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
      });
    }
  };

  const handleContinue = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onContinue();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={showCloseButton ? handleClose : undefined}>
          <View style={styles.backdrop} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{scale: scaleAnim}, {translateY: slideAnim}],
            },
          ]}>
          {/* Close Button */}
          {showCloseButton && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.8}>
              <Icon name="times" size={18} color="#64748B" />
            </TouchableOpacity>
          )}

          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, {backgroundColor: iconColor}]}>
              <Icon name={icon} size={32} color="#fff" solid />
            </View>

            {/* Animated rings */}
            <Animated.View
              style={[
                styles.iconRing1,
                {
                  borderColor: iconColor,
                  opacity: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.3],
                  }),
                  transform: [
                    {
                      scale: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.iconRing2,
                {
                  borderColor: iconColor,
                  opacity: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.2],
                  }),
                  transform: [
                    {
                      scale: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.6],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3', '#2DA5B0']}
              style={styles.continueButtonGradient}>
              <Text style={styles.continueButtonText}>
                {continueText || t('common.continue')}
              </Text>
              <Icon name="arrow-right" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#10B981',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconRing1: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  iconRing2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
  },
  content: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  continueButton: {
    width: '100%',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SuccessModal;
