import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTranslation} from '../contexts/TranslationContext';
import {TourItinerary} from '../types/tour';

import firestore from '@react-native-firebase/firestore';

import ShareTourModal from '../components/TourManagement/ShareTourModal';
import ImagePickerComponent from '../components/common/ImagePickerComponent';
import ImageGallery from '../components/common/ImageGallery';
import {useAuth} from '../contexts/AuthContext';
import translationTextService from '../services/translationText';

interface TourDetailScreenProps {
  navigation: any;
  route: {
    params: {
      tourId: string;
    };
  };
}

const TourDetailScreen: React.FC<TourDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const {t, currentLanguage} = useTranslation();
  const {user} = useAuth();
  const {tourId} = route.params;

  const [tour, setTour] = useState<TourItinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Load tour data
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('tours')
      .doc(tourId)
      .onSnapshot(
        async doc => {
          if (doc.exists) {
            const tourData = doc.data() as TourItinerary;

            const titleS = await translationTextService.translateText(
              tourData.title,
              currentLanguage,
            );
            const desS = await translationTextService.translateText(
              tourData.description,
              currentLanguage,
            );
            const stopsS = await Promise.all(
              tourData.stops?.map(async stop => {
                const destinationName =
                  await translationTextService.translateText(
                    stop.destination?.name || '',
                    currentLanguage,
                  );
                const activitiesS = await Promise.all(
                  stop.activities?.map(async activity => {
                    const activityName =
                      await translationTextService.translateText(
                        activity.name || '',
                        currentLanguage,
                      );
                    const activityDescription =
                      await translationTextService.translateText(
                        activity.description || '',
                        currentLanguage,
                      );
                    return {
                      ...activity,
                      description: activityDescription.translatedText,
                      name: activityName.translatedText,
                    };
                  }) || [],
                );
                return {
                  ...stop,
                  destination: {
                    ...stop.destination,
                    name: destinationName.translatedText,
                  },
                  activities: activitiesS,
                };
              }) || [],
            );
            // Convert Firestore Timestamp to Date
            const processedTour = {
              id: doc.id,

              ...tourData,
              price: {
                adult: tourData.price?.adult || 0,
                child: tourData.price?.child || 0,
                currency: tourData.price?.currency || 'USD',
              },
              tourDate: tourData.tourDate?.toDate
                ? tourData.tourDate.toDate()
                : new Date(tourData.tourDate),
              createdAt: tourData.createdAt?.toDate
                ? tourData.createdAt.toDate()
                : new Date(tourData.createdAt),
              updatedAt: tourData.updatedAt?.toDate
                ? tourData.updatedAt.toDate()
                : new Date(tourData.updatedAt),
              title: titleS.translatedText || tourData.title,
              description: desS.translatedText || tourData.description,
              stops: stopsS,
            } as TourItinerary;
            setTour(processedTour);
          } else {
            Alert.alert(t('common.error'), t('tour.management.tourNotFound'));
            navigation.goBack();
          }
          setLoading(false);
        },
        error => {
          console.error('Error loading tour (onSnapshot):', error);
          Alert.alert(t('common.error'), t('tour.management.failedToLoadTour'));
          navigation.goBack();
          setLoading(false);
        },
      );

    // Clean up listener when component unmounts or tourId changes
    return () => unsubscribe();
  }, [tourId, navigation, t]);
  const formatTime = useCallback((time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }, []);

  const formatDate = useCallback((date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }, []);

  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '#10B981';
      case 'moderate':
        return '#F59E0B';
      case 'challenging':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'published':
        return '#10B981';
      case 'draft':
        return '#6B7280';
      default:
        return '#F59E0B';
    }
  }, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'cultural':
        return 'account-balance';
      case 'historical':
        return 'history-edu';
      case 'nature':
        return 'nature';
      case 'adventure':
        return 'terrain';
      case 'food':
        return 'restaurant';
      case 'shopping':
        return 'shopping-bag';
      case 'mixed':
        return 'apps';
      default:
        return 'place';
    }
  }, []);

  const shareItinerary = useCallback(async () => {
    if (!tour) {
      return;
    }

    try {
      const shareText = `🗺️ ${tour.title}\n\n📅 ${formatDate(
        tour.tourDate,
      )}\n⏰ ${formatTime(tour.startTime)} - ${formatTime(tour.endTime)}\n📍 ${
        tour.stops?.length || 0
      } stops\n\n${tour.description}`;

      await Share.share({
        message: shareText,
        title: tour.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [tour, formatDate, formatTime]);

  const shareToChat = useCallback(() => {
    setShareModalVisible(true);
  }, []);

  const handleShareSuccess = useCallback(() => {
    setShareModalVisible(false);
    Alert.alert(t('common.success'), t('tour.sharing.tourSharedSuccessfully'));
  }, [t]);

  const publishTour = useCallback(async () => {
    if (!tour) {
      return;
    }

    try {
      await firestore().collection('tours').doc(tour.id).update({
        status: 'published',
        updatedAt: firestore.Timestamp.now(),
      });

      setTour({...tour, status: 'published'});
      Alert.alert(t('common.success'), t('tour.management.tourPublished'));
    } catch (error) {
      console.error('Error publishing tour:', error);
      Alert.alert(t('common.error'), t('tour.management.failedToPublishTour'));
    }
  }, [tour, t]);

  const deleteTour = useCallback(async () => {
    if (!tour) {
      return;
    }

    Alert.alert(
      t('tour.management.confirmDeletion'),
      t('tour.management.deleteTourConfirmation'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // await deleteDoc(doc(firestore, 'tours', tour.id));
              await firestore().collection('tours').doc(tour.id).delete();
              Alert.alert(
                t('common.success'),
                t('tour.management.tourDeleted'),
              );
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting tour:', error);
              Alert.alert(
                t('common.error'),
                t('tour.management.failedToDeleteTour'),
              );
            }
          },
        },
      ],
    );
  }, [tour, navigation, t]);

  const openMaps = useCallback((destination: any) => {
    if (destination.coordinates) {
      const {latitude, longitude} = destination.coordinates;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url);
    } else if (destination.address) {
      const encodedAddress = encodeURIComponent(destination.address);
      const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      Linking.openURL(url);
    }
  }, []);

  const calculateStopDuration = useCallback((stop: any) => {
    if (!stop.arrivalTime || !stop.departureTime) {
      return 0;
    }
    const arrival = new Date(`2000-01-01T${stop.arrivalTime}:00`);
    const departure = new Date(`2000-01-01T${stop.departureTime}:00`);
    return Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60));
  }, []);

  const getTotalActivityDuration = useCallback((activities: any[]) => {
    return activities.reduce(
      (total, activity) => total + (activity.duration || 0),
      0,
    );
  }, []);

  const getActivityTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'sightseeing':
        return 'visibility';
      case 'dining':
        return 'restaurant';
      case 'shopping':
        return 'shopping-bag';
      case 'entertainment':
        return 'theaters';
      case 'cultural':
        return 'account-balance';
      case 'outdoor':
        return 'nature';
      case 'transport':
        return 'directions-bus';
      default:
        return 'more-horiz';
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Icon name="hourglass-empty" size={50} color="#6B7280" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tour) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={50} color="#EF4444" />
          <Text style={styles.errorText}>
            {t('tour.management.tourNotFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('tour.management.tourDetails')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.shareButton} onPress={shareItinerary}>
            <Icon name="share" size={24} color="#6B7280" />
          </TouchableOpacity>
          {user.role != 'tourist' && (
            <TouchableOpacity
              style={styles.chatShareButton}
              onPress={shareToChat}>
              <Icon name="chat" size={24} color="#3B82F6" />
            </TouchableOpacity>
          )}
          {user.role != 'tourist' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate('EditTour', {tourId: tour.id})
              }>
              <Icon name="edit" size={24} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tour Header */}
        <View style={styles.tourHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.tourTitle}>
              {tour?.title || 'Untitled Tour'}
            </Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusBadge,
                  {backgroundColor: getStatusColor(tour?.status || 'draft')},
                ]}>
                <Text style={styles.statusText}>
                  {tour?.status === 'published'
                    ? t('tour.management.published')
                    : tour?.status === 'draft'
                    ? t('tour.management.draft')
                    : tour?.status || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.basicInfo}>
            <View style={styles.infoRow}>
              <Icon name="event" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                {tour?.tourDate ? formatDate(tour.tourDate) : 'No date set'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="schedule" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                {tour?.startTime ? formatTime(tour.startTime) : '00:00'} -{' '}
                {tour?.endTime ? formatTime(tour.endTime) : '00:00'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon
                name={getCategoryIcon(tour?.category || 'mixed')}
                size={20}
                color="#6B7280"
              />
              <Text style={styles.infoText}>
                {tour?.category
                  ? t(`tour.categories.${tour.category}`)
                  : 'No category'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.difficultyIndicator,
                  {
                    backgroundColor: getDifficultyColor(
                      tour?.difficulty || 'easy',
                    ),
                  },
                ]}
              />
              <Text style={styles.infoText}>
                {tour?.difficulty
                  ? t(`tour.difficulty.${tour.difficulty}`)
                  : 'No difficulty set'}
              </Text>
            </View>
            <Text style={styles.tourDescription}>
              {tour?.description || 'Description'}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('tour.form.images')}</Text>
              <ImageGallery
                images={tour.images || []}
                title={t('tour.form.images')}
                maxPreviewImages={4}
              />
            </View>
          </View>

          {/* Price */}
          {tour?.price && tour.price.adult !== undefined && (
            <View style={styles.priceContainer}>
              <Icon name="attach-money" size={20} color="#10B981" />
              <Text style={styles.priceText}>
                {tour.price.adult} {tour.price.currency || 'USD'}
                {tour.price.child !== undefined &&
                  ` (${t('tour.form.children')} ${tour.price.child} ${
                    tour.price.currency || 'USD'
                  })`}
              </Text>
            </View>
          )}
        </View>

        {/* Enhanced Tour Stops */}
        <View style={styles.section}>
          <View style={styles.itineraryHeader}>
            <Text style={styles.sectionTitle}>
              {t('tour.details.itinerary')}
            </Text>
            <View style={styles.itineraryStats}>
              <Text style={styles.statsText}>
                {tour?.stops?.length || 0} {t('tour.management.stops')}
              </Text>
              <Text style={styles.statsText}>
                {tour?.stops?.reduce(
                  (total, stop) => total + calculateStopDuration(stop),
                  0,
                ) || 0}
                m total
              </Text>
            </View>
          </View>

          {tour?.stops?.map((stop, index) => (
            <View key={stop.id || index} style={styles.stopCard}>
              {/* Stop Header with Timeline */}
              <View style={styles.stopHeaderWithTimeline}>
                <View style={styles.timelineContainer}>
                  <View style={styles.timelineNode}>
                    <Text style={styles.stopNumberText}>{index + 1}</Text>
                  </View>
                  {index < (tour?.stops?.length || 0) - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>

                <View style={styles.stopMainContent}>
                  {/* Destination Header */}
                  <View style={styles.destinationHeader}>
                    {stop?.destination?.images &&
                    stop.destination.images.length > 0 ? (
                      <Image
                        source={{uri: stop.destination.images[0]}}
                        style={styles.destinationImage}
                      />
                    ) : (
                      <View style={styles.destinationPlaceholder}>
                        <Icon name="place" size={24} color="#6B7280" />
                      </View>
                    )}

                    <View style={styles.destinationInfo}>
                      <Text style={styles.destinationName}>
                        {stop.destination?.name || 'Unknown Destination'}
                      </Text>
                      <View style={styles.timeInfo}>
                        <Icon name="schedule" size={16} color="#6B7280" />
                        <Text style={styles.timeText}>
                          {stop.arrivalTime
                            ? formatTime(stop.arrivalTime)
                            : '00:00'}{' '}
                          -{' '}
                          {stop.departureTime
                            ? formatTime(stop.departureTime)
                            : '00:00'}
                        </Text>
                        <Text style={styles.durationBadge}>
                          {calculateStopDuration(stop)}m
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Destination Details */}
                  {stop.destination && (
                    <View style={styles.destinationDetails}>
                      {stop.destination.address && (
                        <TouchableOpacity
                          style={styles.detailRow}
                          onPress={() => openMaps(stop.destination)}>
                          <Icon name="place" size={16} color="#6B7280" />
                          <Text style={styles.detailText} numberOfLines={2}>
                            {stop.destination.address}
                          </Text>
                          <Icon name="open-in-new" size={16} color="#3B82F6" />
                        </TouchableOpacity>
                      )}

                      {stop.destination.estimatedVisitTime && (
                        <View style={styles.detailRow}>
                          <Icon name="timer" size={16} color="#6B7280" />
                          <Text style={styles.detailText}>
                            {t('tour.destinations.estimatedVisitTime')}:{' '}
                            {stop.destination.estimatedVisitTime}m
                          </Text>
                        </View>
                      )}

                      {stop.destination.ticketPrice &&
                        stop.destination.ticketPrice.adult > 0 && (
                          <View style={styles.detailRow}>
                            <Icon name="local-atm" size={16} color="#6B7280" />
                            <Text style={styles.detailText}>
                              {stop.destination.ticketPrice.adult}{' '}
                              {stop.destination.ticketPrice.currency}
                              {stop.destination.ticketPrice.child &&
                                ` (${t('tour.form.children')}: ${
                                  stop.destination.ticketPrice.child
                                } ${stop.destination.ticketPrice.currency})`}
                            </Text>
                          </View>
                        )}

                      {stop.destination.openingHours && (
                        <View style={styles.detailRow}>
                          <Icon name="access-time" size={16} color="#6B7280" />
                          <Text style={styles.detailText}>
                            {formatTime(stop.destination.openingHours.open)} -{' '}
                            {formatTime(stop.destination.openingHours.close)}
                          </Text>
                        </View>
                      )}

                      {stop.destination.description && (
                        <View style={styles.descriptionContainer}>
                          <Text
                            style={styles.descriptionText}
                            numberOfLines={3}>
                            {stop.destination.description}
                          </Text>
                        </View>
                      )}

                      {/* Destination Images Gallery */}
                      {stop.destination.images &&
                        stop.destination.images.length > 1 && (
                          <View style={styles.destinationGallery}>
                            <ImageGallery
                              images={stop.destination.images}
                              title={stop.destination.name}
                              maxPreviewImages={3}
                            />
                          </View>
                        )}
                    </View>
                  )}

                  {/* Meeting Point */}
                  {stop.meetingPoint && (
                    <View style={styles.meetingPointContainer}>
                      <Icon name="flag" size={16} color="#F59E0B" />
                      <View style={styles.meetingPointInfo}>
                        <Text style={styles.meetingPointLabel}>
                          {t('tour.stops.meetingPoint')}:
                        </Text>
                        <Text style={styles.meetingPointText}>
                          {stop.meetingPoint}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Activities Section */}
                  {stop.activities && stop.activities.length > 0 && (
                    <View style={styles.activitiesSection}>
                      <View style={styles.activitiesHeader}>
                        <Text style={styles.activitiesTitle}>
                          {t('tour.activities.activities')} (
                          {stop.activities.length})
                        </Text>
                        <Text style={styles.activitiesDuration}>
                          {getTotalActivityDuration(stop.activities)}m total
                        </Text>
                      </View>

                      <View style={styles.activitiesList}>
                        {stop.activities.map((activity, activityIndex) => (
                          <View
                            key={activity.id || activityIndex}
                            style={styles.activityCard}>
                            <View style={styles.activityHeader}>
                              <View style={styles.activityIcon}>
                                <Icon
                                  name={getActivityTypeIcon(activity.type)}
                                  size={18}
                                  color="#3B82F6"
                                />
                              </View>
                              <View style={styles.activityMainInfo}>
                                <Text style={styles.activityName}>
                                  {activity.name || 'Unknown Activity'}
                                </Text>
                                <View style={styles.activityMeta}>
                                  <Text style={styles.activityDuration}>
                                    {activity.duration || 0}m
                                  </Text>
                                  <Text style={styles.activityType}>
                                    {t(`tour.activityTypes.${activity.type}`) ||
                                      activity.type}
                                  </Text>
                                  {activity.isOptional && (
                                    <View style={styles.optionalBadge}>
                                      <Text style={styles.optionalText}>
                                        {t('tour.activities.optional')}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              {activity.cost && activity.cost > 0 && (
                                <View style={styles.activityCost}>
                                  <Text style={styles.costText}>
                                    {activity.cost}{' '}
                                    {stop.destination?.ticketPrice?.currency ||
                                      'USD'}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {activity.description && (
                              <Text
                                style={styles.activityDescription}
                                numberOfLines={2}>
                                {activity.description}
                              </Text>
                            )}

                            {activity.requirements &&
                              activity.requirements.length > 0 && (
                                <View style={styles.activityRequirements}>
                                  <Text style={styles.requirementsTitle}>
                                    Requirements:
                                  </Text>
                                  <Text style={styles.requirementsText}>
                                    {activity.requirements.join(', ')}
                                  </Text>
                                </View>
                              )}

                            {activity.notes && (
                              <View style={styles.activityNotes}>
                                <Icon name="note" size={14} color="#6B7280" />
                                <Text style={styles.notesText}>
                                  {activity.notes}
                                </Text>
                              </View>
                            )}

                            {/* Activity Images */}
                            {activity.images && activity.images.length > 0 && (
                              <View style={styles.activityImages}>
                                <ImageGallery
                                  images={activity.images}
                                  title={activity.name}
                                  maxPreviewImages={2}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Special Instructions */}
                  {stop.specialInstructions && (
                    <View style={styles.instructionsContainer}>
                      <Icon name="info" size={16} color="#F59E0B" />
                      <View style={styles.instructionsContent}>
                        <Text style={styles.instructionsTitle}>
                          {t('tour.stops.specialInstructions')}:
                        </Text>
                        <Text style={styles.instructionsText}>
                          {stop.specialInstructions}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )) || <Text style={styles.infoText}>No stops available</Text>}
        </View>

        {/* Additional Information */}
        {((tour?.requirements && tour.requirements.length > 0) ||
          (tour?.included && tour.included.length > 0) ||
          (tour?.excluded && tour.excluded.length > 0)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('tour.form.additionalInformation')}
            </Text>

            {tour?.requirements && tour.requirements.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockTitle}>
                  {t('tour.details.requirements')}
                </Text>
                {tour.requirements.map((requirement, index) => (
                  <View key={index} style={styles.listItem}>
                    <Icon name="warning" size={16} color="#F59E0B" />
                    <Text style={styles.listItemText}>{requirement || ''}</Text>
                  </View>
                ))}
              </View>
            )}

            {tour?.included && tour.included.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockTitle}>
                  {t('tour.details.included')}
                </Text>
                {tour.included.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <Icon name="check" size={16} color="#10B981" />
                    <Text style={styles.listItemText}>{item || ''}</Text>
                  </View>
                ))}
              </View>
            )}

            {tour?.excluded && tour.excluded.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockTitle}>
                  {t('tour.details.excluded')}
                </Text>
                {tour.excluded.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <Icon name="close" size={16} color="#EF4444" />
                    <Text style={styles.listItemText}>{item || ''}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tour?.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tour.form.notes')}</Text>
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{tour.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      {user.role != 'tourist' && (
        <View style={styles.actionContainer}>
          {tour?.status === 'draft' && (
            <TouchableOpacity
              style={styles.publishButton}
              onPress={publishTour}>
              <Icon name="publish" size={20} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>
                {t('tour.management.publish')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.deleteButton} onPress={deleteTour}>
            <Icon name="delete" size={20} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Share Tour Modal */}
      <ShareTourModal
        visible={shareModalVisible}
        tour={tour}
        onClose={() => setShareModalVisible(false)}
        // onSuccess={handleShareSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareButton: {
    padding: 8,
  },
  chatShareButton: {
    padding: 8,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 16,
  },
  tourHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tourTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tourDescription: {
    fontSize: 16,
    color: '#6B7280',
  },
  basicInfo: {
    gap: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
  },
  inputGroup: {
    marginTop: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  difficultyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  activityText: {
    fontSize: 14,
    color: '#374151',
  },
  childPriceText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  stopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  stopHeaderWithTimeline: {
    flexDirection: 'row',
    padding: 20,
  },
  timelineContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineLine: {
    width: 2,
    height: 60,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
  },
  stopMainContent: {
    flex: 1,
  },
  destinationHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  destinationImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  destinationPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  durationBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  destinationDetails: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  descriptionContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  descriptionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  destinationGallery: {
    marginTop: 12,
  },
  meetingPointContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  meetingPointInfo: {
    flex: 1,
  },
  meetingPointLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 2,
  },
  meetingPointText: {
    fontSize: 14,
    color: '#92400E',
  },
  activitiesSection: {
    marginBottom: 16,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activitiesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  activitiesDuration: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activitiesList: {
    gap: 12,
  },
  activityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityMainInfo: {
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
    gap: 12,
    flexWrap: 'wrap',
  },
  activityDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  activityType: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
  },
  optionalBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },
  activityCost: {
    alignItems: 'flex-end',
  },
  costText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  activityDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  activityRequirements: {
    marginBottom: 8,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  requirementsText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  activityNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  activityImages: {
    marginTop: 8,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  instructionsContent: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

  // Missing styles for itinerary section
  itineraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itineraryStats: {
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  stopNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Missing styles for notes section
  notesContainer: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },

  // Missing styles for info blocks
  infoBlock: {
    marginBottom: 16,
  },
  infoBlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  listItemText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },

  // Missing styles for action container
  actionContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  publishButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default TourDetailScreen;
