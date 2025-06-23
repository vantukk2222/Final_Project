import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTranslation} from '../contexts/TranslationContext';

// Call Modal Notification Component - Travel Themed Redesign
const CallModalNotification = ({
  visible,
  notificationData,
  onAccept,
  onDecline,
  fadeAnim,
  scaleAnim,
  pulseAnim,
}) => {
  const isCallNotification =
    notificationData?.type === 'call' ||
    notificationData?.type === 'video_call';

  // Additional animations for travel feel
  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const {t} = useTranslation();

  useEffect(() => {
    if (visible && isCallNotification) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // Travel-themed pulsing waves
      const createWaveAnimation = (animValue, delay = 0) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1.4,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        );
      };

      // Gentle floating animation
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      );

      Animated.parallel([
        createWaveAnimation(pulseAnim),
        createWaveAnimation(pulseRing1, 500),
        createWaveAnimation(pulseRing2, 1000),
        floatAnimation,
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isCallNotification]);

  if (!visible || !isCallNotification || !notificationData) {
    return null;
  }

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDecline}
      statusBarTranslucent>
      <Animated.View
        style={[
          styles.modalBackground,
          {
            opacity: fadeAnim,
          },
        ]}>
        <Animated.View
          style={[
            styles.modalContainer,
            styles.callModalContainer,
            {
              transform: [{scale: scaleAnim}, {translateY}],
            },
          ]}>
          {/* Travel-themed background with gradient */}
          <LinearGradient
            colors={['#E0F7FA', '#F0FFFE', '#FFFFFF']}
            style={styles.modalHeaderBackground}
          />

          {/* Floating wave animations */}
          <View style={styles.waveContainer}>
            <Animated.View
              style={[
                styles.waveRing,
                styles.wave1,
                {
                  transform: [{scale: pulseRing2}],
                  opacity: pulseRing2.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.3, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.waveRing,
                styles.wave2,
                {
                  transform: [{scale: pulseRing1}],
                  opacity: pulseRing1.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.4, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.waveRing,
                styles.wave3,
                {
                  transform: [{scale: pulseAnim}],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.5, 0],
                  }),
                },
              ]}
            />
          </View>

          {/* Header with travel icon */}
          <View style={styles.modalHeader}>
            <View style={styles.headerIconContainer}>
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [{scale: pulseAnim}],
                  },
                ]}>
                <LinearGradient
                  colors={['#4AC6D0', '#36B7C1', '#2AA8B3']}
                  style={styles.iconGradient}>
                  <Icon name={'phone'} size={36} color="#FFFFFF" />
                </LinearGradient>

                {/* Travel-themed status indicator */}
                <View style={styles.statusIndicator}>
                  <Icon name="flight" size={12} color="#FFFFFF" />
                </View>
              </Animated.View>
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.modalTitle}>{t('call.audioConnection')}</Text>
              <Text style={styles.modalSubtitle}>{t('call.ringing')}</Text>
              {notificationData?.callerName && (
                <View style={styles.callerContainer}>
                  <Icon name="person" size={16} color="#4AC6D0" />
                  <Text style={styles.callerName}>
                    {notificationData.callerName}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Content with travel-friendly message */}
          <View style={styles.modalContent}>
            <View style={styles.messageContainer}>
              <Icon name="explore" size={24} color="#4AC6D0" />
              <Text style={styles.modalBody}>
                {t('call.someoneWantsToConnect')}
              </Text>
            </View>

            {/* Travel-themed action buttons */}
            <View style={styles.buttonContainer}>
              {/* Accept call button */}
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.9}>
                <LinearGradient
                  colors={['#4AC6D0', '#36B7C1']}
                  style={styles.acceptButtonGradient}>
                  <Icon name="check-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>{t('call.join')}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Decline call button */}
              <TouchableOpacity
                style={styles.declineButton}
                onPress={onDecline}
                activeOpacity={0.9}>
                <View style={styles.declineButtonContainer}>
                  <Icon name="cancel" size={24} color="#9CA3AF" />
                  <Text style={styles.declineButtonText}>
                    {t('call.maybeLater')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Decorative travel elements */}
          <View style={styles.decorativeElements}>
            <Icon
              name="language"
              size={16}
              color="#4AC6D0"
              style={styles.decorIcon1}
            />
            <Icon
              name="public"
              size={14}
              color="#7DD3FC"
              style={styles.decorIcon2}
            />
            <Icon
              name="connect-without-contact"
              size={12}
              color="#A5F3FC"
              style={styles.decorIcon3}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // In-App Notification Styles - Improved

  // Call Modal Styles - Completely redesigned
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  callModalContainer: {
    borderWidth: 0,
  },
  modalHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  waveContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveRing: {
    position: 'absolute',
    borderRadius: 60,
    borderWidth: 2,
  },
  wave1: {
    width: 120,
    height: 120,
    borderColor: 'rgba(74, 198, 208, 0.2)',
  },
  wave2: {
    width: 100,
    height: 100,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  wave3: {
    width: 80,
    height: 80,
    borderColor: 'rgba(74, 198, 208, 0.4)',
  },
  modalHeader: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
    backgroundColor: 'transparent',
    position: 'relative',
    zIndex: 1,
  },
  headerIconContainer: {
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
  },
  statusIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#4AC6D0',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  callerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  callerName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  modalContent: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFFE',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 32,
    gap: 12,
  },
  modalBody: {
    flex: 1,
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 16,
  },
  acceptButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  declineButton: {
    borderRadius: 16,
  },
  declineButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  declineButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  decorativeElements: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  decorIcon1: {
    position: 'absolute',
    top: 30,
    right: 30,
    opacity: 0.6,
  },
  decorIcon2: {
    position: 'absolute',
    top: 50,
    left: 30,
    opacity: 0.4,
  },
  decorIcon3: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    opacity: 0.3,
  },
});

export default CallModalNotification;
