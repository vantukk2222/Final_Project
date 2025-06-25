import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAuth} from '../contexts/AuthContext';
import {useTranslation} from '../contexts/TranslationContext';
import {TourItinerary, TourStop, Activity, Destination} from '../types/tour';
import TourStopCard from '../components/TourManagement/TourStopCard';
import AddDestinationModal from '../components/TourManagement/AddDestinationModal';
import TourBasicInfoForm from '../components/TourManagement/TourBasicInfoForm';
import firestore from '@react-native-firebase/firestore';

interface CreateTourScreenProps {
  navigation: any;
}

const CreateTourScreen: React.FC<CreateTourScreenProps> = ({navigation}) => {
  const {user} = useAuth();
  const {t} = useTranslation();

  // Basic tour info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<
    | 'cultural'
    | 'historical'
    | 'nature'
    | 'adventure'
    | 'food'
    | 'shopping'
    | 'mixed'
  >('cultural');
  const [difficulty, setDifficulty] = useState<
    'easy' | 'moderate' | 'challenging'
  >('easy');
  const [language, setLanguage] = useState<string[]>(['en']);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [price, setPrice] = useState({adult: '', child: '', currency: 'USD'});
  const [requirements, setRequirements] = useState<string[]>([]);
  const [included, setIncluded] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [guideId, setGuideId] = useState<string[]>([user.uid]);
  const [guideName, setGuideName] = useState<string[]>([
    user.name || user.email || 'Unknown Guide',
  ]);

  // Tour schedule
  const [tourDate, setTourDate] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  // Tour stops
  const [stops, setStops] = useState<TourStop[]>([]);
  const [showAddDestinationModal, setShowAddDestinationModal] = useState(false);

  // Loading states
  const [saving, setSaving] = useState(false);

  const calculateTotalDuration = useCallback(() => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60)); // in minutes
  }, [startTime, endTime]);

  const addTourStop = useCallback(
    (destination: Destination, activities: Activity[]) => {
      const newStop: TourStop = {
        id: Date.now().toString(),
        destinationId: destination.id,
        destination,
        arrivalTime: '10:00',
        departureTime: '12:00',
        activities,
        order: stops.length + 1,
      };
      setStops(prev => [...prev, newStop]);
      setShowAddDestinationModal(false);
    },
    [stops.length],
  );

  const updateTourStop = useCallback(
    (stopId: string, updatedStop: Partial<TourStop>) => {
      setStops(prev =>
        prev.map(stop =>
          stop.id === stopId ? {...stop, ...updatedStop} : stop,
        ),
      );
    },
    [],
  );

  const removeTourStop = useCallback((stopId: string) => {
    setStops(prev => {
      const filtered = prev.filter(stop => stop.id !== stopId);
      return filtered.map((stop, index) => ({...stop, order: index + 1}));
    });
  }, []);

  const moveTourStop = useCallback(
    (stopId: string, direction: 'up' | 'down') => {
      setStops(prev => {
        const index = prev.findIndex(stop => stop.id === stopId);
        if (index === -1) {
          return prev;
        }

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= prev.length) {
          return prev;
        }

        const newStops = [...prev];
        [newStops[index], newStops[newIndex]] = [
          newStops[newIndex],
          newStops[index],
        ];

        return newStops.map((stop, i) => ({...stop, order: i + 1}));
      });
    },
    [],
  );

  const validateTour = useCallback(() => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('tour.form.tourTitleRequired'));
      return false;
    }
    if (!description.trim()) {
      Alert.alert(t('common.error'), t('tour.form.tourDescriptionRequired'));
      return false;
    }
    if (stops.length === 0) {
      Alert.alert(t('common.error'), t('tour.form.tourStopsRequired'));
      return false;
    }
    if (startTime >= endTime) {
      Alert.alert(t('common.error'), t('tour.form.invalidTimeRange'));
      return false;
    }
    return true;
  }, [title, description, stops, startTime, endTime, t]);

  const saveTour = useCallback(
    async (status: 'draft' | 'published') => {
      if (!validateTour()) {
        return;
      }
      if (!user?.uid) {
        return;
      }

      setSaving(true);
      try {
        const tourData: Omit<TourItinerary, 'id'> = {
          title: title.trim(),
          description: description.trim(),
          guideId: guideId,
          guideName: guideName,
          startTime,
          endTime,
          tourDate: tourDate,
          stops: stops.map(stop => ({
            ...stop,
            id: stop.id, // Ensure each stop has a unique ID
            order: stop.order, // Maintain the order of stops
          })),
          maxParticipants: maxParticipants
            ? parseInt(maxParticipants, 10)
            : undefined,
          currentParticipants: 0,
          difficulty,
          category,
          price: price.adult
            ? {
                adult: parseFloat(price.adult),
                child: price.child ? parseFloat(price.child) : undefined,
                currency: price.currency,
              }
            : undefined,
          //   stops,
          totalDuration: calculateTotalDuration(),
          language,
          requirements: requirements.filter(r => r.trim()),
          included: included.filter(i => i.trim()),
          excluded: excluded.filter(e => e.trim()),
          notes: notes.trim() || undefined,
          images: images.length > 0 ? images : undefined,
          status,
          participantIds: [],
          createdAt: firestore.Timestamp.now() as any,
          updatedAt: firestore.Timestamp.now() as any,
        };

        // save stops as collection in tours
        // Filter out undefined values to avoid Firestore errors
        const cleanTourData = Object.entries(tourData).reduce(
          (acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = value;
            }
            return acc;
          },
          {} as any,
        );

        await firestore().collection('tours').add(cleanTourData);

        Alert.alert(
          t('common.success'),
          status === 'draft'
            ? t('tour.management.tourSavedAsDraft')
            : t('tour.management.tourPublished'),
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } catch (error) {
        console.error('Error saving tour:', error);
        Alert.alert(t('common.error'), t('tour.management.failedToSaveTour'));
      }
      setSaving(false);
    },
    [
      validateTour,
      user,
      title,
      description,
      tourDate,
      startTime,
      endTime,
      maxParticipants,
      difficulty,
      category,
      price,
      stops,
      calculateTotalDuration,
      language,
      requirements,
      included,
      excluded,
      notes,
      images,
      t,
    ],
  );

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
          {t('tour.management.createTour')}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <TourBasicInfoForm
          title={title}
          description={description}
          category={category}
          difficulty={difficulty}
          language={language}
          maxParticipants={maxParticipants}
          price={price}
          requirements={requirements}
          included={included}
          excluded={excluded}
          notes={notes}
          tourDate={tourDate}
          startTime={startTime}
          endTime={endTime}
          images={images}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onCategoryChange={setCategory}
          onDifficultyChange={setDifficulty}
          onLanguageChange={setLanguage}
          onMaxParticipantsChange={setMaxParticipants}
          onPriceChange={setPrice}
          onRequirementsChange={setRequirements}
          onIncludedChange={setIncluded}
          onExcludedChange={setExcluded}
          onNotesChange={setNotes}
          onTourDateChange={setTourDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          onImagesChange={setImages}
        />

        {/* Tour Stops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('tour.form.tourStops')}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddDestinationModal(true)}>
              <Icon name="add" size={20} color="#10B981" />
              <Text style={styles.addButtonText}>
                {t('tour.form.addDestination')}
              </Text>
            </TouchableOpacity>
          </View>

          {stops.map((stop, index) => (
            <TourStopCard
              key={stop.id}
              stop={stop}
              index={index}
              totalStops={stops.length}
              onUpdate={updatedStop => updateTourStop(stop.id, updatedStop)}
              onRemove={() => removeTourStop(stop.id)}
              onMove={direction => moveTourStop(stop.id, direction)}
            />
          ))}

          {stops.length === 0 && (
            <View style={styles.emptyStops}>
              <Icon name="place" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStopsText}>
                {t('tour.form.noStopsAdded')}
              </Text>
              <Text style={styles.emptyStopsSubtext}>
                {t('tour.form.addDestinationsToCreateItinerary')}
              </Text>
            </View>
          )}
        </View>

        {/* Tour Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('tour.form.tourSummary')}</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Icon name="access-time" size={16} color="#6B7280" />
              <Text style={styles.summaryText}>
                {t('tour.form.duration')}:{' '}
                {Math.floor(calculateTotalDuration() / 60)}h{' '}
                {calculateTotalDuration() % 60}m
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Icon name="place" size={16} color="#6B7280" />
              <Text style={styles.summaryText}>
                {t('tour.management.stops')}: {stops.length}
              </Text>
            </View>
            {maxParticipants && (
              <View style={styles.summaryRow}>
                <Icon name="group" size={16} color="#6B7280" />
                <Text style={styles.summaryText}>
                  {t('tour.form.maxParticipants')}: {maxParticipants}
                </Text>
              </View>
            )}
            {price.adult && (
              <View style={styles.summaryRow}>
                <Icon name="attach-money" size={16} color="#6B7280" />
                <Text style={styles.summaryText}>
                  {t('tour.form.price')}: {price.adult} {price.currency}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Destination Modal */}
      <AddDestinationModal
        visible={showAddDestinationModal}
        onClose={() => setShowAddDestinationModal(false)}
        onAddDestination={addTourStop}
      />
      {/* Save Buttons */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[styles.headerButton, styles.draftButton]}
          onPress={() => saveTour('draft')}
          disabled={saving}>
          <Text style={styles.draftButtonText}>
            {t('tour.management.saveDraft')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerButton, styles.publishButton]}
          onPress={() => saveTour('published')}
          disabled={saving}>
          <Text style={styles.publishButtonText}>
            {t('tour.management.publish')}
          </Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  headerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  draftButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  publishButton: {
    backgroundColor: '#10B981',
  },
  draftButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  publishButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  emptyStops: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyStopsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyStopsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
});

export default CreateTourScreen;
