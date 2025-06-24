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
                    return {
                      ...activity,
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

        {/* Tour Stops */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('tour.details.itinerary')} ({tour?.stops?.length || 0}{' '}
            {t('tour.management.stops')})
          </Text>
          {tour?.stops?.map((stop, index) => (
            <View key={stop.id || index} style={styles.stopCard}>
              <View style={styles.stopHeader}>
                <View style={styles.stopNumber}>
                  <Text style={styles.stopNumberText}>{index + 1}</Text>
                </View>
                {/* Image destination */}
                {stop?.destination?.images &&
                stop.destination.images.length > 0 ? (
                  <Image
                    source={{uri: stop.destination.images[0]}}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      marginRight: 12,
                    }}
                  />
                ) : (
                  <Icon
                    name="place"
                    size={40}
                    color="#6B7280"
                    style={{marginRight: 12}}
                  />
                )}
                <View style={styles.stopInfo}>
                  <Text style={styles.stopName}>
                    {stop.destination?.name || 'Unknown Destination'}
                  </Text>
                  <Text style={styles.stopTime}>
                    {stop.arrivalTime ? formatTime(stop.arrivalTime) : '00:00'}{' '}
                    -{' '}
                    {stop.departureTime
                      ? formatTime(stop.departureTime)
                      : '00:00'}
                  </Text>
                  {stop.destination?.address && (
                    <TouchableOpacity
                      style={styles.addressContainer}
                      onPress={() => openMaps(stop.destination)}>
                      <Icon name="place" size={16} color="#6B7280" />
                      <Text style={styles.addressText} numberOfLines={2}>
                        {stop.destination.address}
                      </Text>
                      <Icon name="open-in-new" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {stop.activities && stop.activities.length > 0 && (
                <View style={styles.activitiesContainer}>
                  <Text style={styles.activitiesTitle}>
                    {t('tour.activities.activities')} ({stop.activities.length})
                  </Text>
                  {stop.activities.map((activity, activityIndex) => (
                    <View
                      key={activity.id || activityIndex}
                      style={styles.activityItem}>
                      <Icon name="check-circle" size={16} color="#10B981" />
                      <Text style={styles.activityText}>
                        {activity.name || 'Unknown Activity'} (
                        {activity.duration || 0}m)
                        {activity.isOptional &&
                          ` - ${t('tour.activities.optional')}`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {stop.specialInstructions && (
                <View style={styles.instructionsContainer}>
                  <Icon name="info" size={16} color="#F59E0B" />
                  <Text style={styles.instructionsText}>
                    {stop.specialInstructions}
                  </Text>
                </View>
              )}
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stopHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  stopTime: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  activitiesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  activitiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activityDuration: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionalText: {
    fontSize: 12,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  infoBlock: {
    marginBottom: 16,
  },
  infoBlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  notesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    marginBottom: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  publishButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TourDetailScreen;
