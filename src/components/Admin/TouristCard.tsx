import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

interface Tourist {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive?: boolean;
  createdAt: any;
  bio?: string;
  avatar?: string;
  lastActive?: any;
}

interface TouristCardProps {
  item: Tourist;
  onStatusChange: (
    userId: string,
    newStatus: string,
    userName: string,
    isGuide: boolean,
  ) => void;
}

const TouristCard: React.FC<TouristCardProps> = ({item, onStatusChange}) => {
  const navigation = useNavigation();
  const formatDate = (timestamp: any) => {
    if (!timestamp) {
      return 'Unknown';
    }
    try {
      return new Date(timestamp.toDate()).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const isActive = item?.isActive !== false; // Default to true if undefined

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        navigation.navigate('ViewUserProfile', {userId: item.id});
      }}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {item?.avatar ? (
            <Image
              source={{uri: item?.avatar?.url || item?.avatar}}
              style={styles.avatar}
            />
          ) : (
            <Icon name="user-circle" size={48} color="#ccc" />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item?.name || 'No Name'}</Text>
          <Text style={styles.email}>{item?.email}</Text>
          {item?.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {item?.bio}
            </Text>
          )}
          <Text style={styles.dateText}>
            Created: {formatDate(item?.createdAt)}
          </Text>
          {item?.lastActive && (
            <Text style={styles.lastActiveText}>
              Last active: {formatDate(item?.lastActive)}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: isActive ? '#10B981' : '#EF4444'},
          ]}>
          <Icon
            name={isActive ? 'check-circle' : 'times-circle'}
            size={12}
            color="#fff"
          />
          <Text style={styles.statusText}>
            {isActive ? 'ACTIVE' : 'DEACTIVATED'}
          </Text>
        </View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isActive ? styles.suspendButton : styles.approveButton,
          ]}
          onPress={() =>
            onStatusChange(
              item?.id,
              isActive ? 'false' : 'true',
              item?.name || item?.email,
              false,
            )
          }>
          <Icon name={isActive ? 'ban' : 'check'} size={14} color="#fff" />
          <Text style={styles.actionButtonText}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#4AC6D0',
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  info: {
    flex: 1,
    marginRight: 16,
  },
  name: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  email: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 10,
    fontWeight: '500',
  },
  bio: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 6,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
    fontWeight: '600',
  },
  lastActiveText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  suspendButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
});

export default TouristCard;
