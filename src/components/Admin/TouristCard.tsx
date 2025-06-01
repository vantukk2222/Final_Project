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
    <View style={styles.card}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  lastActiveText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  suspendButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default TouristCard;
