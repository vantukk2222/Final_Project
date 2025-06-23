import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAuth} from '../contexts/AuthContext';
import {useTranslation} from '../contexts/TranslationContext';
import {TourItinerary, TourStatus, TourStatusEnum} from '../types/tour';
import firestore from '@react-native-firebase/firestore';
// import {
//   collection,
//   query,
//   where,
//   onSnapshot,
//   orderBy,
// } from '@react-native-firebase/firestore';

interface TourManagementScreenProps {
  navigation: any;
}

const TourManagementScreen: React.FC<TourManagementScreenProps> = ({
  navigation,
}) => {
  const {user} = useAuth();
  const {t} = useTranslation();
  const [tours, setTours] = useState<TourItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load tours data
  const loadTours = useCallback(() => {
    if (!user?.uid) {
      return;
    }

    // const toursRef = firestore().collection('tours');
    // const q = toursRef
    //   .where('guideId', '==', user.uid)
    //   .orderBy('createdAt', 'desc');

    const unsubscribe = firestore()
      .collection('tours')
      .where('guideId', 'array-contains', user.uid)
      .onSnapshot(async querySnapshot => {
        try {
          const toursData: TourItinerary[] = [];

          const toursz = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          toursData.push(...toursz);
          setTours(toursData);
        } catch (error) {
          console.error('Error loading tours:', error);
          Alert.alert(t('common.error'), t('tour.management.loadError'));
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return unsubscribe;
  }, [user?.uid, t]);

  useEffect(() => {
    const unsubscribe = loadTours();
    return unsubscribe;
  }, [loadTours]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTours();
  }, [loadTours]);

  const getStatusColor = (status: TourStatus) => {
    switch (status) {
      case TourStatusEnum.DRAFT:
        return '#94A3B8';
      case TourStatusEnum.PUBLISHED:
        return '#10B981';
      case TourStatusEnum.ACTIVE:
        return '#10B981';
      case TourStatusEnum.COMPLETED:
        return '#3B82F6';
      case TourStatusEnum.CANCELLED:
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: TourStatus) => {
    switch (status) {
      case TourStatusEnum.DRAFT:
        return t('tour.management.draft');
      case TourStatusEnum.ACTIVE:
        return t('tour.management.active');
      case TourStatusEnum.PUBLISHED:
        return t('tour.management.published');
      case TourStatusEnum.COMPLETED:
        return t('tour.management.completed');
      case TourStatusEnum.CANCELLED:
        return t('tour.management.cancelled');
      default:
        return status;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const navigateToTourDetail = (tour: TourItinerary) => {
    navigation.navigate('TourDetail', {tourId: tour.id});
  };

  const navigateToCreateTour = () => {
    navigation.navigate('CreateTour');
  };

  const renderTourItem = ({item}: {item: TourItinerary}) => (
    <TouchableOpacity
      style={styles.tourCard}
      onPress={() => navigateToTourDetail(item)}
      activeOpacity={0.7}>
      <View style={styles.tourHeader}>
        <View style={styles.tourTitleContainer}>
          <Text style={styles.tourTitle} numberOfLines={2}>
            {item?.title}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: getStatusColor(item.status)},
            ]}>
            <Text style={styles.statusText}>{getStatusText(item?.status)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.tourDescription} numberOfLines={2}>
        {item?.description}
      </Text>

      <View style={styles.tourInfo}>
        <View style={styles.infoRow}>
          <Icon name="event" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {formatDate(new Date(item?.tourDate.seconds * 1000)) ||
              t('tour.management.unknownDate')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="schedule" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {item?.totalDuration / 60} {t('tour.management.hours')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="place" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {item?.stops?.length} {t('tour.management.stops')}
          </Text>
        </View>
      </View>

      {item.participants && item.participants.length > 0 && (
        <View style={styles.participantsInfo}>
          <Icon name="group" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {item?.participants?.length} {t('tour.management.participants')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="map" size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{t('tour.management.noToursYet')}</Text>
      <Text style={styles.emptyDescription}>
        {t('tour.management.createFirstTourDescription')}
      </Text>
      <TouchableOpacity
        style={styles.createFirstTourButton}
        onPress={navigateToCreateTour}>
        <Text style={styles.createFirstTourText}>
          {t('tour.management.createTour')}
        </Text>
      </TouchableOpacity>
    </View>
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('ChatList')}>
          <Icon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tour.management.title')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={navigateToCreateTour}>
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tours}
        keyExtractor={item => item.id}
        renderItem={renderTourItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
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
  addButton: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  tourCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tourHeader: {
    marginBottom: 12,
  },
  tourTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tourTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  tourDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  tourInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  createFirstTourButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstTourText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TourManagementScreen;
