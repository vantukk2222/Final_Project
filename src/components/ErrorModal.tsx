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

const {width} = Dimensions.get('window');

interface ErrorModalProps {
  visible: boolean;
  title: string;
  message: string;
  onTryAgain?: () => void;
  onClose: () => void;
  tryAgainText?: string;
  closeText?: string;
  showTryAgain?: boolean;
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  title,
  message,
  onTryAgain,
  onClose,
  tryAgainText,
  closeText,
  showTryAgain = true,
}) => {
  const {t} = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Entrance animation with shake
      Animated.sequence([
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
        ]),
        // Shake animation for error emphasis
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          onClose();
          return true;
        },
      );

      return () => backHandler.remove();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      shakeAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
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
  };

  const handleTryAgain = () => {
    if (onTryAgain) {
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
        onTryAgain();
      });
    }
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
          onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{scale: scaleAnim}, {translateX: shakeAnim}],
            },
          ]}>
          {/* Error Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon name="exclamation-triangle" size={32} color="#fff" solid />
            </View>

            {/* Pulsing effect */}
            <Animated.View
              style={[
                styles.iconRing,
                {
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
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {showTryAgain && onTryAgain && (
              <TouchableOpacity
                style={styles.tryAgainButton}
                onPress={handleTryAgain}
                activeOpacity={0.9}>
                <LinearGradient
                  colors={['#EF4444', '#DC2626', '#B91C1C']}
                  style={styles.tryAgainButtonGradient}>
                  <Icon name="redo" size={14} color="#fff" />
                  <Text style={styles.tryAgainButtonText}>
                    {tryAgainText || t('common.tryAgain')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>
                {closeText || t('common.close')}
              </Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#EF4444',
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
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  tryAgainButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tryAgainButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  tryAgainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorModal;
