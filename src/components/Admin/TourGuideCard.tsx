import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

interface TourGuide {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: any;
  bio?: string;
  avatar?: string;
  lastActive?: any;
}

interface TourGuideCardProps {
  item: TourGuide;
  onStatusChange: (
    userId: string,
    newStatus: string,
    userName: string,
    isGuide: boolean,
  ) => void;
}

const TourGuideCard: React.FC<TourGuideCardProps> = ({
  item,
  onStatusChange,
}) => {
  const navigation = useNavigation();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'rejected':
        return '#EF4444';
      case 'suspended':
        return '#6B7280';
      default:
        return '#F59E0B'; // Default to pending color
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'check-circle';
      case 'pending':
        return 'clock';
      case 'rejected':
        return 'times-circle';
      case 'suspended':
        return 'ban';
      default:
        return 'clock'; // Default to pending icon
    }
  };

  const getStatusText = (status: string) => {
    if (!status) {
      return 'PENDING';
    }
    return status.toUpperCase();
  };

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

  const currentStatus = item?.status || 'pending';

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
            {backgroundColor: getStatusColor(currentStatus)},
          ]}>
          <Icon name={getStatusIcon(currentStatus)} size={12} color="#fff" />
          <Text style={styles.statusText}>{getStatusText(currentStatus)}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        {currentStatus === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() =>
                onStatusChange(
                  item?.id,
                  'approved',
                  item?.name || item?.email,
                  true,
                )
              }>
              <Icon name="check" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() =>
                onStatusChange(
                  item?.id,
                  'rejected',
                  item?.name || item?.email,
                  true,
                )
              }>
              <Icon name="times" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}

        {currentStatus === 'approved' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.suspendButton]}
            onPress={() =>
              onStatusChange(
                item?.id,
                'suspended',
                item?.name || item?.email,
                true,
              )
            }>
            <Icon name="ban" size={14} color="#fff" />
            <Text style={styles.actionButtonText}>Suspend</Text>
          </TouchableOpacity>
        )}

        {currentStatus === 'suspended' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() =>
              onStatusChange(
                item?.id,
                'approved',
                item?.name || item?.email,
                true,
              )
            }>
            <Icon name="unlock" size={14} color="#fff" />
            <Text style={styles.actionButtonText}>Reactivate</Text>
          </TouchableOpacity>
        )}

        {currentStatus === 'rejected' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pendingButton]}
            onPress={() =>
              onStatusChange(
                item?.id,
                'pending',
                item?.name || item?.email,
                true,
              )
            }>
            <Icon name="undo" size={14} color="#fff" />
            <Text style={styles.actionButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
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
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  suspendButton: {
    backgroundColor: '#6B7280',
  },
  pendingButton: {
    backgroundColor: '#F59E0B',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default TourGuideCard;
