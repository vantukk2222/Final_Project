import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

const {width, height} = Dimensions.get('window');

interface ChatOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
  onViewInfo: () => void;
  onPin: () => void;
  onMute: () => void;
  isPinned?: boolean;
  isMuted?: boolean;
  chatName?: string;
  isGroup?: boolean;
  canDelete?: boolean;
}

const ChatOptionsModal: React.FC<ChatOptionsModalProps> = ({
  visible,
  onClose,
  onDelete,
  onViewInfo,
  onPin,
  onMute,
  isPinned = false,
  isMuted = false,
  chatName = 'Chat',
  isGroup = false,
  canDelete = true,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(height)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (visible) {
          onClose();
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, [visible, onClose]);

  const options = [
    {
      id: 'info',
      title: isGroup ? 'Group Info' : 'Chat Info',
      subtitle: isGroup
        ? 'Members, settings and more'
        : 'Contact details and settings',
      icon: 'info-outline',
      color: '#4AC6D0',
      backgroundColor: 'rgba(74, 198, 208, 0.1)',
      onPress: onViewInfo,
      visible: true,
    },
    {
      id: 'pin',
      // title: 'Pin Chat',
      title: isPinned ? 'Unpin Chat' : 'Pin Chat',

      // subtitle: 'Keep this conversation at the top',
      subtitle: isPinned
        ? 'Unpin this chat from the top'
        : 'Pin this chat to the top',
      icon: 'push-pin',
      color: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      onPress: onPin,
      visible: true,
    },
    {
      id: 'mute',
      title: !isMuted ? 'Mute Notifications' : 'Turn on Notifications',
      subtitle: !isMuted
        ? 'Turn off notifications for this chat'
        : 'Enable notifications for this chat',
      // icon: 'notifications-off',
      icon: !isMuted ? 'notifications-off' : 'notifications',
      color: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      onPress: onMute,
      visible: true,
    },
    // {
    //   id: 'archive',
    //   title: 'Archive Chat',
    //   subtitle: 'Move to archived conversations',
    //   icon: 'archive',
    //   color: '#6B7280',
    //   backgroundColor: 'rgba(107, 114, 128, 0.1)',
    //   onPress: () => {
    //     onClose();
    //     // TODO: Implement archive functionality
    //   },
    // },
    {
      id: 'delete',
      title: 'Delete Chat',
      subtitle: 'Remove this conversation permanently',
      icon: 'delete',
      color: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      onPress: onDelete,
      visible: isGroup ? canDelete : true,
    },
  ];

  const renderOption = (option: any) => (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.optionButton,
        option.destructive && styles.destructiveOption,
      ]}
      onPress={option.onPress}
      activeOpacity={0.7}>
      <View style={styles.optionContent}>
        <View
          style={[
            styles.optionIconContainer,
            {backgroundColor: option.backgroundColor},
          ]}>
          <Icon name={option.icon} size={24} color={option.color} />
        </View>
        <View style={styles.optionTextContainer}>
          <Text
            style={[
              styles.optionTitle,
              option.destructive && styles.destructiveText,
            ]}>
            {option.title}
          </Text>
          <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
        </View>
        <Icon
          name="chevron-right"
          size={20}
          color={option.destructive ? '#EF4444' : '#C1C7CD'}
        />
      </View>
    </TouchableOpacity>
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            },
          ]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{translateY: slideAnim}],
            },
          ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.headerGradient}>
              <View style={styles.headerContent}>
                <View style={styles.headerIconContainer}>
                  <Icon
                    name={isGroup ? 'group' : 'chat'}
                    size={24}
                    color="#fff"
                  />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {chatName}
                  </Text>
                  <Text style={styles.chatSubtitle}>
                    {isGroup ? 'Group conversation' : 'Private conversation'}
                  </Text>
                </View>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.8}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Options List */}
          <View style={styles.optionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <View style={styles.optionsList}>
              {options.map(option => option.visible && renderOption(option))}
            </View>
          </View>

          {/* Bottom Safe Area */}
          <View style={styles.bottomSafeArea} />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },

  // Header Styles
  modalHeader: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  chatSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // Options Styles
  optionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    marginLeft: 4,
  },
  optionsList: {
    gap: 2,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  destructiveOption: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  destructiveText: {
    color: '#EF4444',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bottomSafeArea: {
    height: 20,
    backgroundColor: '#F8FAFC',
  },
});

export default ChatOptionsModal;
