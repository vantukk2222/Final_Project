import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import {useTranslation} from '../contexts/TranslationContext';
import {TourItinerary} from '../types/tour';
import TourBasicInfoForm from '../components/TourManagement/TourBasicInfoForm';
import TourStopCard from '../components/TourManagement/TourStopCard';
import AddDestinationModal from '../components/TourManagement/AddDestinationModal';

interface EditTourScreenProps {
  navigation: any;
  route: {
    params: {
      tourId: string;
    };
  };
}

const EditTourScreen: React.FC<EditTourScreenProps> = ({navigation, route}) => {
  const {t} = useTranslation();
  const {tourId} = route.params;

  const [tour, setTour] = useState<TourItinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDestination, setShowAddDestination] = useState(false);

  const loadTour = useCallback(async () => {
    try {
      const tourDoc = await firestore().collection('tours').doc(tourId).get();

      if (tourDoc.exists) {
        const tourData = tourDoc.data() as TourItinerary;
        console.log('Loaded tour from editTourScreen:', tourData);

        // Convert Firestore Timestamp to Date
        if (
          tourData.tourDate &&
          typeof tourData.tourDate === 'object' &&
          'seconds' in tourData.tourDate
        ) {
          tourData.tourDate = new Date(
            (tourData.tourDate as any).seconds * 1000,
          );
        }

        console.log('Converted tourDate:', tourData.tourDate);
        setTour(tourData);
      } else {
        Alert.alert(t('common.error'), t('tour.management.tourNotFound'));
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading tour:', error);
      Alert.alert(t('common.error'), t('tour.management.errorLoadingTours'));
    } finally {
      setLoading(false);
    }
  }, [tourId, t, navigation]);

  useEffect(() => {
    loadTour();
  }, [loadTour]);

  const handleSaveTour = async () => {
    if (!tour) {
      return;
    }

    setSaving(true);
    try {
      // Filter out undefined values to avoid Firestore errors
      const updateData = Object.entries(tour).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await firestore()
        .collection('tours')
        .doc(tourId)
        .update({
          ...updateData,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      Alert.alert(t('common.success'), t('tour.management.saveSuccess'), [
        {
          text: t('common.ok'),
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error saving tour:', error);
      Alert.alert(t('common.error'), t('tour.management.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tour) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('tour.management.notFound')}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{t('tour.management.editTour')}</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveTour}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Info Form */}
        <TourBasicInfoForm
          title={tour.title}
          description={tour.description}
          category={tour.category}
          difficulty={tour.difficulty}
          language={tour.language}
          maxParticipants={tour.maxParticipants?.toString() || ''}
          price={{
            adult: tour.price?.adult?.toString() || '',
            child: tour.price?.child?.toString() || '',
            currency: tour.price?.currency || 'USD',
          }}
          requirements={tour.requirements || []}
          included={tour.included || []}
          excluded={tour.excluded || []}
          notes={tour.notes || ''}
          images={tour.images || []}
          tourDate={
            tour.tourDate instanceof Date
              ? tour.tourDate
              : new Date(tour.tourDate)
          }
          startTime={tour.startTime}
          endTime={tour.endTime}
          onTitleChange={title => setTour({...tour, title})}
          onDescriptionChange={description => setTour({...tour, description})}
          onCategoryChange={category => setTour({...tour, category})}
          onDifficultyChange={difficulty => setTour({...tour, difficulty})}
          onLanguageChange={language => setTour({...tour, language})}
          onMaxParticipantsChange={maxParticipants =>
            setTour({
              ...tour,
              maxParticipants: maxParticipants
                ? parseInt(maxParticipants, 10)
                : undefined,
            })
          }
          onPriceChange={price =>
            setTour({
              ...tour,
              price:
                price.adult || price.child
                  ? {
                      adult: price.adult ? parseFloat(price.adult) : 0,
                      child: price.child ? parseFloat(price.child) : undefined,
                      currency: price.currency,
                    }
                  : undefined,
            })
          }
          onRequirementsChange={requirements =>
            setTour({...tour, requirements})
          }
          onIncludedChange={included => setTour({...tour, included})}
          onExcludedChange={excluded => setTour({...tour, excluded})}
          onNotesChange={notes => setTour({...tour, notes})}
          onTourDateChange={tourDate => setTour({...tour, tourDate})}
          onStartTimeChange={startTime => setTour({...tour, startTime})}
          onEndTimeChange={endTime => setTour({...tour, endTime})}
          onImagesChange={images => setTour({...tour, images})}
        />

        {/* Tour Stops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('tour.form.tourStops')}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddDestination(true)}>
              <Icon name="add" size={20} color="#3B82F6" />
              <Text style={styles.addButtonText}>
                {t('tour.form.addDestination')}
              </Text>
            </TouchableOpacity>
          </View>

          {tour.stops?.map((stop, index) => (
            <TourStopCard
              key={stop.id || index}
              stop={stop}
              index={index}
              totalStops={tour.stops?.length || 0}
              onUpdate={updatedStop => {
                const updatedStops = [...tour.stops];
                updatedStops[index] = {...updatedStops[index], ...updatedStop};
                setTour({...tour, stops: updatedStops});
              }}
              onRemove={() => {
                const updatedStops = tour.stops.filter((_, i) => i !== index);
                setTour({...tour, stops: updatedStops});
              }}
              onMove={direction => {
                const stops = [...tour.stops];
                const currentIndex = index;
                const newIndex =
                  direction === 'up' ? currentIndex - 1 : currentIndex + 1;

                if (newIndex >= 0 && newIndex < stops.length) {
                  [stops[currentIndex], stops[newIndex]] = [
                    stops[newIndex],
                    stops[currentIndex],
                  ];
                  // Update order
                  const updatedStops = stops.map((stop, i) => ({
                    ...stop,
                    order: i + 1,
                  }));

                  setTour({...tour, stops: updatedStops});
                }
              }}
            />
          )) || []}
        </View>
      </ScrollView>

      {/* Add Destination Modal */}
      <AddDestinationModal
        visible={showAddDestination}
        onClose={() => setShowAddDestination(false)}
        onAddDestination={(destination, activities) => {
          const newStop = {
            id: Date.now().toString(),
            destinationId: destination.id,
            destination: destination,
            arrivalTime: '10:00',
            departureTime: '12:00',
            activities: activities || [],
            order: (tour.stops?.length || 0) + 1,
          };
          setTour({
            ...tour,
            stops: [...(tour.stops || []), newStop],
          });
          setShowAddDestination(false);
        }}
      />
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
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
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
});

export default EditTourScreen;
