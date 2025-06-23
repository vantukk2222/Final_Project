import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Destination, Activity} from '../../types/tour';
import {useTranslation} from '../../contexts/TranslationContext';
import ImagePickerComponent from '../common/ImagePickerComponent';

interface AddDestinationModalProps {
  visible: boolean;
  onClose: () => void;
  onAddDestination: (destination: Destination, activities: Activity[]) => void;
}

const AddDestinationModal: React.FC<AddDestinationModalProps> = ({
  visible,
  onClose,
  onAddDestination,
}) => {
  const {t} = useTranslation();

  // Form states
  const [step, setStep] = useState<'destination' | 'activities'>('destination');
  const [destination, setDestination] = useState<Partial<Destination>>({
    name: '',
    address: '',
    description: '',
    estimatedVisitTime: 60,
    coordinates: '',
    ticketPrice: {adult: 0, currency: 'USD'},
    openingHours: {open: '09:00', close: '17:00'},
    images: [],
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Partial<Activity>>({
    name: '',
    description: '',
    duration: 30,
    type: 'sightseeing',
    isOptional: false,
    images: [],
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

  const resetForm = useCallback(() => {
    setStep('destination');
    setDestination({
      name: '',
      address: '',
      description: '',
      estimatedVisitTime: 60,
      coordinates: undefined,
      ticketPrice: {adult: 0, currency: 'USD'},
      openingHours: {open: '09:00', close: '17:00'},
      images: [],
    });
    setActivities([]);
    setCurrentActivity({
      name: '',
      description: '',
      duration: 30,
      type: 'sightseeing',
      isOptional: false,
      images: [],
    });
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const validateDestination = useCallback(() => {
    if (!destination.name?.trim()) {
      Alert.alert(
        t('common.error'),
        t('tour.destinations.destinationNameRequired'),
      );
      return false;
    }
    if (!destination.address?.trim()) {
      Alert.alert(
        t('common.error'),
        t('tour.destinations.destinationAddressRequired'),
      );
      return false;
    }
    if (!destination.description?.trim()) {
      Alert.alert(
        t('common.error'),
        t('tour.destinations.destinationDescriptionRequired'),
      );
      return false;
    }
    return true;
  }, [destination, t]);

  const nextStep = useCallback(() => {
    if (validateDestination()) {
      setStep('activities');
    }
  }, [validateDestination]);

  const addActivity = useCallback(() => {
    if (!currentActivity.name?.trim()) {
      Alert.alert(t('common.error'), t('tour.activities.activityNameRequired'));
      return;
    }

    const newActivity: Activity = {
      id: Date.now().toString(),
      name: currentActivity.name.trim(),
      description: currentActivity.description?.trim() || '',
      duration: currentActivity.duration || 30,
      type: currentActivity.type || 'sightseeing',
      isOptional: currentActivity.isOptional || false,
      images: currentActivity.images || [],
    };

    setActivities(prev => [...prev, newActivity]);
    setCurrentActivity({
      name: '',
      description: '',
      duration: 30,
      type: 'sightseeing',
      isOptional: false,
      images: [],
    });
  }, [currentActivity, t]);

  const removeActivity = useCallback((activityId: string) => {
    setActivities(prev => prev.filter(activity => activity.id !== activityId));
  }, []);

  const handleFinish = useCallback(() => {
    if (!validateDestination()) {
      return;
    }

    const finalDestination: Destination = {
      id: Date.now().toString(),
      name: destination.name!.trim(),
      address: destination.address!.trim(),
      description: destination.description!.trim(),
      estimatedVisitTime: destination.estimatedVisitTime || 60,
      coordinates: destination.coordinates,
      ticketPrice: destination.ticketPrice,
      openingHours: destination.openingHours,
      images: destination.images || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Final Destination:', finalDestination);
    console.log('Activities:', activities);
    onAddDestination(finalDestination, activities);
    handleClose();
  }, [
    validateDestination,
    destination,
    activities,
    onAddDestination,
    handleClose,
  ]);

  const getTotalActivityDuration = useCallback(() => {
    return activities.reduce((total, activity) => total + activity.duration, 0);
  }, [activities]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {step === 'destination'
              ? t('tour.form.addDestination')
              : t('tour.destinations.addActivities')}
          </Text>
          {step === 'destination' ? (
            <TouchableOpacity onPress={nextStep}>
              <Text style={styles.nextButton}>{t('common.next')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleFinish}>
              <Text style={styles.finishButton}>
                {t('tour.destinations.finish')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {width: step === 'destination' ? '50%' : '100%'},
              ]}
            />
          </View>
          <Text style={styles.stepText}>
            {step === 'destination'
              ? t('tour.destinations.step1DestinationInfo')
              : t('tour.destinations.step2Activities')}
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === 'destination' ? (
            // Destination Form
            <View style={styles.form}>
              {/* Basic Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t('tour.form.basicInformation')}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t('tour.destinations.destinationName')} *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={destination.name}
                    onChangeText={text =>
                      setDestination({...destination, name: text})
                    }
                    placeholder={t('tour.destinations.enterDestinationName')}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t('tour.destinations.address')} *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={destination.address}
                    onChangeText={text =>
                      setDestination({...destination, address: text})
                    }
                    placeholder={t('tour.destinations.enterDestinationAddress')}
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t('tour.form.description')} *
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={destination.description}
                    onChangeText={text =>
                      setDestination({...destination, description: text})
                    }
                    placeholder={t(
                      'tour.destinations.enterDestinationDescription',
                    )}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* Destination Images */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('tour.form.images')}</Text>
                  <ImagePickerComponent
                    images={destination.images || []}
                    onImagesChange={images =>
                      setDestination({...destination, images})
                    }
                    maxImages={5}
                    folder="destinations"
                    title={t('tour.destinations.selectImages')}
                  />
                </View>
              </View>

              {/* Visit Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t('tour.destinations.visitInformation')}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t('tour.destinations.estimatedVisitTime')} (minutes)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={destination.estimatedVisitTime?.toString()}
                    onChangeText={text =>
                      setDestination({
                        ...destination,
                        estimatedVisitTime: parseInt(text, 10) || 0,
                      })
                    }
                    placeholder="60"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.timeContainer}>
                  <View style={[styles.inputGroup, {flex: 1, marginRight: 8}]}>
                    <Text style={styles.label}>
                      {t('tour.destinations.openingTime')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={destination.openingHours?.open}
                      onChangeText={text =>
                        setDestination({
                          ...destination,
                          openingHours: {
                            ...destination.openingHours!,
                            open: text,
                          },
                        })
                      }
                      placeholder="09:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={[styles.inputGroup, {flex: 1, marginLeft: 8}]}>
                    <Text style={styles.label}>
                      {t('tour.destinations.closingTime')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={destination.openingHours?.close}
                      onChangeText={text =>
                        setDestination({
                          ...destination,
                          openingHours: {
                            ...destination.openingHours!,
                            close: text,
                          },
                        })
                      }
                      placeholder="17:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>

              {/* Pricing */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t('tour.destinations.ticketPricing')}
                </Text>

                <View style={styles.priceContainer}>
                  <View style={[styles.inputGroup, {flex: 2, marginRight: 8}]}>
                    <Text style={styles.label}>
                      {t('tour.form.adultPrice')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={destination.ticketPrice?.adult?.toString()}
                      onChangeText={text =>
                        setDestination({
                          ...destination,
                          ticketPrice: {
                            ...destination.ticketPrice!,
                            adult: parseFloat(text) || 0,
                          },
                        })
                      }
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, {flex: 1, marginLeft: 8}]}>
                    <Text style={styles.label}>{t('tour.form.currency')}</Text>
                    <TextInput
                      style={styles.input}
                      value={destination.ticketPrice?.currency}
                      onChangeText={text =>
                        setDestination({
                          ...destination,
                          ticketPrice: {
                            ...destination.ticketPrice!,
                            currency: text,
                          },
                        })
                      }
                      placeholder="USD"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            // Activities Form
            <View style={styles.form}>
              {/* Add Activity Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t('tour.activities.addActivity')}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t('tour.activities.activityName')} *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={currentActivity.name}
                    onChangeText={text =>
                      setCurrentActivity({...currentActivity, name: text})
                    }
                    placeholder={t('tour.activities.enterActivityName')}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('tour.form.description')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={currentActivity.description}
                    onChangeText={text =>
                      setCurrentActivity({
                        ...currentActivity,
                        description: text,
                      })
                    }
                    placeholder={t('tour.activities.enterActivityDescription')}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Activity Images */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('tour.form.images')}</Text>
                  <ImagePickerComponent
                    images={currentActivity.images || []}
                    onImagesChange={images =>
                      setCurrentActivity({...currentActivity, images})
                    }
                    maxImages={3}
                    folder="activities"
                    title={t('tour.activities.selectImages')}
                  />
                </View>

                <View style={styles.durationContainer}>
                  <View style={[styles.inputGroup, {flex: 1, marginRight: 8}]}>
                    <Text style={styles.label}>
                      {t('tour.form.duration')}(m)
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={currentActivity.duration?.toString()}
                      onChangeText={text =>
                        setCurrentActivity({
                          ...currentActivity,
                          duration: parseInt(text, 10) || 0,
                        })
                      }
                      placeholder="30"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.optionalToggle}
                    onPress={() =>
                      setCurrentActivity({
                        ...currentActivity,
                        isOptional: !currentActivity.isOptional,
                      })
                    }>
                    <Icon
                      name={
                        currentActivity.isOptional
                          ? 'check-box'
                          : 'check-box-outline-blank'
                      }
                      size={24}
                      color={currentActivity.isOptional ? '#10B981' : '#6B7280'}
                    />
                    <Text style={styles.optionalText}>
                      {t('tour.activities.optional')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Activity Types */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t('tour.activities.activityType')}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.typeButtons}>
                      {activityTypes.map(type => (
                        <TouchableOpacity
                          key={type.key}
                          style={[
                            styles.typeButton,
                            currentActivity.type === type.key &&
                              styles.selectedTypeButton,
                          ]}
                          onPress={() =>
                            setCurrentActivity({
                              ...currentActivity,
                              type: type.key as any,
                            })
                          }>
                          <Icon
                            name={type.icon}
                            size={20}
                            color={
                              currentActivity.type === type.key
                                ? '#FFFFFF'
                                : '#6B7280'
                            }
                          />
                          <Text
                            style={[
                              styles.typeButtonText,
                              currentActivity.type === type.key &&
                                styles.selectedTypeButtonText,
                            ]}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <TouchableOpacity
                  style={styles.addActivityButton}
                  onPress={addActivity}>
                  <Icon name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addActivityButtonText}>
                    {t('tour.activities.addActivity')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Activities List */}
              {activities.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.activitiesHeader}>
                    <Text style={styles.sectionTitle}>
                      {t('tour.activities.activities')} ({activities.length})
                    </Text>
                    <Text style={styles.totalDuration}>
                      {t('tour.activities.totalDuration')}:{' '}
                      {getTotalActivityDuration()}m
                    </Text>
                  </View>

                  {activities.map(activity => (
                    <View key={activity.id} style={styles.activityItem}>
                      <View style={styles.activityIcon}>
                        <Icon
                          name={
                            activityTypes.find(
                              type => type.key === activity.type,
                            )?.icon || 'more-horiz'
                          }
                          size={20}
                          color="#6B7280"
                        />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityName}>{activity.name}</Text>
                        <View style={styles.activityMeta}>
                          <Text style={styles.activityDuration}>
                            {activity.duration}m
                          </Text>
                          <Text style={styles.activityType}>
                            {
                              activityTypes.find(
                                type => type.key === activity.type,
                              )?.label
                            }
                          </Text>
                          {activity.isOptional && (
                            <Text style={styles.optionalBadge}>
                              {t('tour.activities.optional')}
                            </Text>
                          )}
                        </View>
                        {activity.description && (
                          <Text
                            style={styles.activityDescription}
                            numberOfLines={2}>
                            {activity.description}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeActivity(activity.id)}>
                        <Icon name="delete" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  nextButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  finishButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
  },
  timeContainer: {
    flexDirection: 'row',
  },
  priceContainer: {
    flexDirection: 'row',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    paddingVertical: 12,
  },
  optionalText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
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
  addActivityButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  addActivityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalDuration: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  activityDuration: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  activityType: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  optionalBadge: {
    fontSize: 10,
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  activityDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 4,
  },
  removeButton: {
    padding: 8,
  },
});

export default AddDestinationModal;
