import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {TourItinerary} from '../../types/tour';
import {useTranslation} from '../../contexts/TranslationContext';

interface TourCardProps {
  item: TourItinerary;
  onStatusChange: (
    tourId: string,
    newStatus: string,
    tourTitle: string,
  ) => void;
  onViewDetails: (tourId: string) => void;
}

const TourCard: React.FC<TourCardProps> = ({
  item,
  onStatusChange,
  onViewDetails,
}) => {
  const {t} = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return '#10B981';
      case 'active':
        return '#3B82F6';
      case 'completed':
        return '#8B5CF6';
      case 'cancelled':
        return '#EF4444';
      case 'draft':
      default:
        return '#F59E0B';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return 'public';
      case 'active':
        return 'play-circle-filled';
      case 'completed':
        return 'check-circle';
      case 'cancelled':
        return 'cancel';
      case 'draft':
      default:
        return 'draft';
    }
  };

  const formatDate = (date: any) => {
    if (!date) {
      return 'N/A';
    }
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  };

  const formatTime = (time: string) => {
    if (!time) {
      return 'N/A';
    }
    return time;
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.guideInfo}>
            {t('admin.tours.guide')}: {item.guideName}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: getStatusColor(item.status)},
          ]}>
          <Icon
            name={getStatusIcon(item.status)}
            size={14}
            color="#FFFFFF"
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>
            {t(`admin.tours.status.${item.status}`)}
          </Text>
        </View>
      </View>

      {/* Tour Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Icon name="event" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {formatDate(item.tourDate)} • {formatTime(item.startTime)} -{' '}
            {formatTime(item.endTime)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Icon name="place" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {item.stops?.length || 0 + ' ' + t('admin.tours.stops')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Icon name="group" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {item.currentParticipants || 0}/{item.maxParticipants || 'N/A'}{' '}
            {t('admin.tours.participants')}
          </Text>
        </View>

        {item.price && (
          <View style={styles.infoRow}>
            <Icon name="attach-money" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.price.adult} {item.price.currency}
              {item.price.child &&
                ` • ${t('admin.tours.child')}: ${item.price.child} ${
                  item.price.currency
                }`}
            </Text>
          </View>
        )}
      </View>

      {/* Description */}
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => onViewDetails(item.id)}>
          <Icon name="visibility" size={16} color="#3B82F6" />
          <Text style={styles.viewButtonText}>
            {t('admin.tours.viewDetails')}
          </Text>
        </TouchableOpacity>

        <View style={styles.statusActions}>
          {item.status === 'draft' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.publishButton]}
              onPress={() => onStatusChange(item.id, 'published', item.title)}>
              <Text style={styles.publishButtonText}>
                {t('admin.tours.publish')}
              </Text>
            </TouchableOpacity>
          )}

          {item.status === 'published' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.activateButton]}
              onPress={() => onStatusChange(item.id, 'active', item.title)}>
              <Text style={styles.activateButtonText}>
                {t('admin.tours.activate')}
              </Text>
            </TouchableOpacity>
          )}

          {(item.status === 'published' || item.status === 'active') && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => onStatusChange(item.id, 'cancelled', item.title)}>
              <Text style={styles.cancelButtonText}>
                {t('admin.tours.cancel')}
              </Text>
            </TouchableOpacity>
          )}

          {item.status === 'active' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => onStatusChange(item.id, 'completed', item.title)}>
              <Text style={styles.completeButtonText}>
                {t('admin.tours.complete')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  guideInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 4,
  },
  statusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  publishButton: {
    backgroundColor: '#10B981',
  },
  publishButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activateButton: {
    backgroundColor: '#3B82F6',
  },
  activateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  completeButton: {
    backgroundColor: '#8B5CF6',
  },
  completeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TourCard;
