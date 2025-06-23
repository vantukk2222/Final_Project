import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {TourStop, Activity} from '../../types/tour';
import {useTranslation} from '../../contexts/TranslationContext';

interface TourStopCardProps {
  stop: TourStop;
  index: number;
  totalStops: number;
  onUpdate: (updatedStop: Partial<TourStop>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

const TourStopCard: React.FC<TourStopCardProps> = ({
  stop,
  index,
  totalStops,
  onUpdate,
  onRemove,
  onMove,
}) => {
  const {t} = useTranslation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [editedStop, setEditedStop] = useState<TourStop>(stop);
  const [newActivity, setNewActivity] = useState<Activity>({
    id: '',
    name: '',
    description: '',
    duration: 60,
    type: 'sightseeing',
    isOptional: false,
  });

  const activityTypes = [
    {
      key: 'sightseeing',
      label: t('tour.activityTypes.sightseeing'),
      icon: 'visibility',
    },
    {key: 'dining', label: t('tour.activityTypes.dining'), icon: 'restaurant'},
    {
      key: 'shopping',
      label: t('tour.activityTypes.shopping'),
      icon: 'shopping-bag',
    },
    {
      key: 'entertainment',
      label: t('tour.activityTypes.entertainment'),
      icon: 'theaters',
    },
    {
      key: 'cultural',
      label: t('tour.activityTypes.cultural'),
      icon: 'account-balance',
    },
    {key: 'outdoor', label: t('tour.activityTypes.outdoor'), icon: 'nature'},
    {
      key: 'transport',
      label: t('tour.activityTypes.transport'),
      icon: 'directions-bus',
    },
    {key: 'other', label: t('tour.activityTypes.other'), icon: 'more-horiz'},
  ];

  const formatTime = (time: string) => {
    console.log('stopmkkmk', stop);
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const calculateDuration = () => {
    const arrival = new Date(`2000-01-01T${stop.arrivalTime}:00`);
    const departure = new Date(`2000-01-01T${stop.departureTime}:00`);
    const duration = Math.floor(
      (departure.getTime() - arrival.getTime()) / (1000 * 60),
    );
    return duration > 0 ? duration : 0;
  };

  const getTotalActivityDuration = () => {
    return stop.activities.reduce(
      (total, activity) => total + activity.duration,
      0,
    );
  };

  const saveChanges = () => {
    console.log('Saving edited stop:', editedStop);
    if (!editedStop.arrivalTime || !editedStop.departureTime) {
      Alert.alert(t('common.error'), t('tour.form.timesRequired'));
      return;
    }

    const arrival = new Date(`2000-01-01T${editedStop.arrivalTime}:00`);
    const departure = new Date(`2000-01-01T${editedStop.departureTime}:00`);

    if (arrival >= departure) {
      Alert.alert(t('common.error'), t('tour.form.invalidTimeRange'));
      return;
    }

    onUpdate(editedStop);
    setShowEditModal(false);
  };

  const addActivity = () => {
    console.log('Adding new activity:', newActivity);
    if (!newActivity.name.trim()) {
      Alert.alert(t('common.error'), t('tour.activities.activityNameRequired'));
      return;
    }

    const activityToAdd: Activity = {
      ...newActivity,
      id: Date.now().toString(),
      name: newActivity.name.trim(),
      description: newActivity.description.trim(),
    };

    const updatedActivities = [...editedStop.activities, activityToAdd];
    setEditedStop({...editedStop, activities: updatedActivities});

    setNewActivity({
      id: '',
      name: '',
      description: '',
      duration: 60,
      type: 'sightseeing',
      isOptional: false,
    });
    setShowAddActivityModal(false);
  };

  const removeActivity = (activityId: string) => {
    console.log('Removing activity with ID:', activityId);
    const updatedActivities = editedStop.activities.filter(
      a => a.id !== activityId,
    );
    setEditedStop({...editedStop, activities: updatedActivities});
  };

  const confirmRemove = () => {
    Alert.alert(
      t('tour.stops.confirmRemoval'),
      t('tour.stops.removeStopConfirmation'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {text: t('common.remove'), style: 'destructive', onPress: onRemove},
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{index + 1}</Text>
        </View>
        {stop?.destination?.images && stop.destination.images.length > 0 ? (
          <Image
            source={{uri: stop.destination.images[0]}}
            style={{width: 40, height: 40, borderRadius: 20, marginRight: 12}}
          />
        ) : (
          <Icon
            name="place"
            size={40}
            color="#6B7280"
            style={{marginRight: 12}}
          />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.destinationName} numberOfLines={2}>
            {stop.destination?.name || 'Unknown Destination'}
          </Text>
          <Text style={styles.timeText}>
            {formatTime(stop.arrivalTime)} - {formatTime(stop.departureTime)}
            <Text style={styles.durationText}> ({calculateDuration()}m)</Text>
          </Text>
        </View>
        <View style={styles.actions}>
          {index > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onMove('up')}>
              <Icon name="keyboard-arrow-up" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
          {index < totalStops - 1 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onMove('down')}>
              <Icon name="keyboard-arrow-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setEditedStop(stop);
              setShowEditModal(true);
            }}>
            <Icon name="edit" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={confirmRemove}>
            <Icon name="delete" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Destination Info */}
      {stop.destination && (
        <View style={styles.destinationInfo}>
          {stop.destination.address && (
            <View style={styles.infoRow}>
              <Icon name="place" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{stop.destination.address}</Text>
            </View>
          )}
          {stop.destination.estimatedVisitTime && (
            <View style={styles.infoRow}>
              <Icon name="schedule" size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {t('tour.destinations.estimatedVisitTime')}:{' '}
                {stop.destination.estimatedVisitTime}m
              </Text>
            </View>
          )}
          {stop.destination.ticketPrice && (
            <View style={styles.infoRow}>
              <Icon name="local-atm" size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {stop.destination.ticketPrice.adult}{' '}
                {stop.destination.ticketPrice.currency}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Activities */}
      <View style={styles.activitiesSection}>
        <Text style={styles.sectionTitle}>
          {t('tour.activities.activities')} ({stop.activities.length})
          <Text style={styles.activityDuration}>
            {' '}
            · {getTotalActivityDuration()}m
          </Text>
        </Text>
        {stop.activities.map(activity => (
          <View key={activity.id} style={styles.activityItem}>
            <Icon
              name={
                activityTypes.find(type => type.key === activity.type)?.icon ||
                'more-horiz'
              }
              size={16}
              color="#6B7280"
            />
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>{activity.name}</Text>
              <View style={styles.activityMeta}>
                <Text style={styles.activityDurationText}>
                  {activity.duration}m
                </Text>
                {activity.isOptional && (
                  <Text style={styles.optionalBadge}>
                    {t('tour.activities.optional')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Special Instructions */}
      {stop.specialInstructions && (
        <View style={styles.instructionsSection}>
          <Icon name="info" size={16} color="#F59E0B" />
          <Text style={styles.instructionsText}>
            {stop.specialInstructions}
          </Text>
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.cancelButton}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('tour.stops.editStop')}</Text>
            <TouchableOpacity onPress={saveChanges}>
              <Text style={styles.saveButton}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}>
            {/* Time Settings */}
            <View style={styles.timeSection}>
              <Text style={styles.modalSectionTitle}>
                {t('tour.stops.timeSettings')}
              </Text>
              <View style={styles.timeInputs}>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>
                    {t('tour.stops.arrivalTime')}
                  </Text>
                  <TextInput
                    style={styles.timeField}
                    value={editedStop.arrivalTime}
                    onChangeText={time =>
                      setEditedStop({...editedStop, arrivalTime: time})
                    }
                    placeholder="HH:MM"
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>
                    {t('tour.stops.departureTime')}
                  </Text>
                  <TextInput
                    style={styles.timeField}
                    value={editedStop.departureTime}
                    onChangeText={time =>
                      setEditedStop({...editedStop, departureTime: time})
                    }
                    placeholder="HH:MM"
                  />
                </View>
              </View>
            </View>

            {/* Meeting Point */}
            <View style={styles.inputSection}>
              <Text style={styles.modalSectionTitle}>
                {t('tour.stops.meetingPoint')}
              </Text>
              <TextInput
                style={styles.textInput}
                value={editedStop.meetingPoint || ''}
                onChangeText={text =>
                  setEditedStop({...editedStop, meetingPoint: text})
                }
                placeholder={t('tour.stops.enterMeetingPoint')}
                multiline
              />
            </View>

            {/* Special Instructions */}
            <View style={styles.inputSection}>
              <Text style={styles.modalSectionTitle}>
                {t('tour.stops.specialInstructions')}
              </Text>
              <TextInput
                style={styles.textInput}
                value={editedStop.specialInstructions || ''}
                onChangeText={text =>
                  setEditedStop({...editedStop, specialInstructions: text})
                }
                placeholder={t('tour.stops.enterSpecialInstructions')}
                multiline
              />
            </View>

            {/* Activities */}
            <View style={styles.activitiesEditSection}>
              <View style={styles.activitiesHeader}>
                <Text style={styles.modalSectionTitle}>
                  {t('tour.activities.activities')}
                </Text>
                <TouchableOpacity
                  style={styles.addActivityButton}
                  onPress={() => setShowAddActivityModal(true)}>
                  <Icon name="add" size={20} color="#10B981" />
                  <Text style={styles.addActivityText}>
                    {t('tour.activities.addActivity')}
                  </Text>
                </TouchableOpacity>
              </View>

              {editedStop.activities.map(activity => (
                <View key={activity.id} style={styles.editActivityItem}>
                  <View style={styles.editActivityInfo}>
                    <Text style={styles.editActivityName}>{activity.name}</Text>
                    <Text style={styles.editActivityDetails}>
                      {activity.duration}m ·{' '}
                      {activityTypes.find(type => type.key === activity.type)
                        ?.label || t('tour.activityTypes.other')}
                      {activity.isOptional &&
                        ` · ${t('tour.activities.optional')}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeActivityButton}
                    onPress={() => removeActivity(activity.id)}>
                    <Icon name="delete" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Add Activity Modal */}
        <Modal visible={showAddActivityModal} transparent animationType="slide">
          <View style={styles.addActivityModalOverlay}>
            <View style={styles.addActivityModalContent}>
              <View style={styles.addActivityModalHeader}>
                <Text style={styles.addActivityModalTitle}>
                  {t('tour.activities.addActivity')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddActivityModal(false)}>
                  <Icon name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.addActivityForm}>
                  {/* Activity Name */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      {t('tour.activities.activityName')} *
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      value={newActivity.name}
                      onChangeText={text =>
                        setNewActivity({...newActivity, name: text})
                      }
                      placeholder={t('tour.activities.enterActivityName')}
                    />
                  </View>

                  {/* Description */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      {t('tour.form.description')}
                    </Text>
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      value={newActivity.description}
                      onChangeText={text =>
                        setNewActivity({...newActivity, description: text})
                      }
                      placeholder={t(
                        'tour.activities.enterActivityDescription',
                      )}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Duration */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      {t('tour.form.duration')} (m)
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      value={newActivity.duration.toString()}
                      onChangeText={text =>
                        setNewActivity({
                          ...newActivity,
                          duration: parseInt(text, 10) || 0,
                        })
                      }
                      placeholder="60"
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Activity Type */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      {t('tour.activities.activityType')}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}>
                      <View style={styles.typeButtons}>
                        {activityTypes.map(type => (
                          <TouchableOpacity
                            key={type.key}
                            style={[
                              styles.typeButton,
                              newActivity.type === type.key &&
                                styles.selectedTypeButton,
                            ]}
                            onPress={() =>
                              setNewActivity({
                                ...newActivity,
                                type: type.key as any,
                              })
                            }>
                            <Icon
                              name={type.icon}
                              size={20}
                              color={
                                newActivity.type === type.key
                                  ? '#FFFFFF'
                                  : '#6B7280'
                              }
                            />
                            <Text
                              style={[
                                styles.typeButtonText,
                                newActivity.type === type.key &&
                                  styles.selectedTypeButtonText,
                              ]}>
                              {type.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Optional */}
                  <TouchableOpacity
                    style={styles.optionalToggle}
                    onPress={() =>
                      setNewActivity({
                        ...newActivity,
                        isOptional: !newActivity.isOptional,
                      })
                    }>
                    <Icon
                      name={
                        newActivity.isOptional
                          ? 'check-box'
                          : 'check-box-outline-blank'
                      }
                      size={24}
                      color={newActivity.isOptional ? '#10B981' : '#6B7280'}
                    />
                    <Text style={styles.optionalToggleText}>
                      {t('tour.activities.optionalActivity')}
                    </Text>
                  </TouchableOpacity>

                  {/* Add Button */}
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addActivity}>
                    <Text style={styles.addButtonText}>
                      {t('tour.activities.addActivity')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  durationText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  destinationInfo: {
    padding: 16,
    paddingTop: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  activitiesSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  activityDuration: {
    fontWeight: '400',
    color: '#6B7280',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  activityInfo: {
    flex: 1,
    marginLeft: 8,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  activityDurationText: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionalBadge: {
    fontSize: 10,
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    fontWeight: '500',
  },
  instructionsSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  instructionsText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  timeSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  timeInputs: {
    flexDirection: 'row',
    gap: 16,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  timeField: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  inputSection: {
    marginBottom: 24,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  activitiesEditSection: {
    marginBottom: 24,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
  },
  addActivityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
    marginLeft: 4,
  },
  editActivityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  editActivityInfo: {
    flex: 1,
  },
  editActivityName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  editActivityDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  removeActivityButton: {
    padding: 4,
  },
  addActivityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  addActivityModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  addActivityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  addActivityModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addActivityForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedTypeButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  selectedTypeButtonText: {
    color: '#FFFFFF',
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  optionalToggleText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TourStopCard;
