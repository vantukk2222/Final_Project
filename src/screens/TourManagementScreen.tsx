import React, {useCallback, useEffect, useMemo, useState, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from '../contexts/TranslationContext';
import {TourItinerary} from '../types/tour';
import translationTextService from '../services/translationText';

// Types
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

interface FilterOptions {
  status: string[];
  sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'title';
  dateRange: 'all' | 'week' | 'month' | 'year';
}

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
}

// Constants
const {width} = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_WIDTH = (width - CARD_MARGIN * 3) / 2;

const STATUS_COLORS = {
  draft: {color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)'},
  published: {color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)'},
  active: {color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)'},
  completed: {color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)'},
  cancelled: {color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)'},
};

// Components
const StatisticsCard = React.memo(({stat}: {stat: StatCard}) => (
  <View style={[styles.statCard, {backgroundColor: stat.bgColor}]}>
    <View style={[styles.statIconContainer, {backgroundColor: stat.color}]}>
      <Icon name={stat.icon} size={24} color="#fff" />
    </View>
    <View style={styles.statContent}>
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statTitle}>{stat.title}</Text>
    </View>
  </View>
));

const TourCard = React.memo(
  ({
    tour,
    onPress,
    onEdit,
    onDelete,
  }: {
    tour: TourItinerary;
    onPress: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
    const {t, currentLanguage} = useTranslation();
    const statusInfo = STATUS_COLORS[tour.status] || STATUS_COLORS.draft;
    const title = useRef(tour.title);
    useEffect(() => {
      console.log(`TourCard rendered for tour: ${tour.title}`);
      const unsubscribe = async () => {
        const title_translated = await translationTextService.translateText(
          tour.title,
          currentLanguage,
        );
        title.current = title_translated.translatedText || tour.title;
      };
      return unsubscribe;
    }, []);

    return (
      <TouchableOpacity
        style={styles.tourCard}
        onPress={onPress}
        activeOpacity={0.8}>
        {/* Tour Image */}
        <View style={styles.tourImageContainer}>
          {tour?.images && tour?.images?.length > 0 ? (
            <Image source={{uri: tour?.images[0]}} style={styles.tourImage} />
          ) : (
            <View style={styles.tourImagePlaceholder}>
              <Icon name="landscape" size={40} color="#CBD5E1" />
            </View>
          )}
          <View style={styles.tourImageOverlay}>
            <View
              style={[styles.statusBadge, {backgroundColor: statusInfo.color}]}>
              <Text style={styles.statusText}>
                {t(`tour.management.${tour.status}`)}
              </Text>
            </View>
          </View>
        </View>

        {/* Tour Content */}
        <View style={styles.tourContent}>
          <Text style={styles.tourTitle} numberOfLines={2}>
            {title.current}
          </Text>

          <View style={styles.tourMeta}>
            <View style={styles.tourLocation}>
              <Icon name="location-on" size={14} color="#64748B" />
              <Text style={styles.tourLocationText} numberOfLines={1}>
                {tour?.stops[0]?.destination?.address}
              </Text>
            </View>

            <View style={styles.tourDuration}>
              <Icon name="schedule" size={14} color="#64748B" />
              <Text style={styles.tourDurationText}>
                {tour.totalDuration / 60} {t('tour.management.hours')}
              </Text>
            </View>
          </View>

          <View style={styles.tourStats}>
            <Icon name="group" size={16} color="#6B7280" />
            <Text style={styles.tourStatText}>
              {tour?.currentParticipants || 0}/{tour?.maxParticipants || 'N/A'}{' '}
            </Text>
          </View>

          {tour?.price && (
            <View style={styles.tourStats}>
              <Icon name="attach-money" size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {tour.price.adult} {tour.price.currency}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.tourActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onEdit}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="edit" size={18} color="#4AC6D0" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onDelete}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="delete" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  },
);

const FilterModal = React.memo(
  ({visible, onClose, onApply, currentFilters}: FilterModalProps) => {
    const {t} = useTranslation();
    const [filters, setFilters] = useState<FilterOptions>(currentFilters);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const SORT_OPTIONS = [
      {key: 'newest', label: t('tour.management.sortNewest')},
      {key: 'oldest', label: t('tour.management.sortOldest')},
      {key: 'price_low', label: t('tour.management.sortPriceLow')},
      {key: 'price_high', label: t('tour.management.sortPriceHigh')},
      {key: 'title', label: t('tour.management.sortTitle')},
    ];

    useEffect(() => {
      if (visible) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        fadeAnim.setValue(0);
      }
    }, [visible, fadeAnim]);

    const handleStatusToggle = useCallback((status: string) => {
      setFilters(prev => ({
        ...prev,
        status: prev.status.includes(status)
          ? prev.status.filter(s => s !== status)
          : [...prev.status, status],
      }));
    }, []);

    const handleApply = useCallback(() => {
      onApply(filters);
      onClose();
    }, [filters, onApply, onClose]);

    const handleReset = useCallback(() => {
      const resetFilters: FilterOptions = {
        status: [],
        sortBy: 'newest',
        dateRange: 'all',
      };
      setFilters(resetFilters);
    }, []);

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <LinearGradient
                colors={['#4AC6D0', '#3BB8C3']}
                style={styles.modalIcon}>
                <Icon name="filter-list" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.modalTitle}>
                {t('tour.management.filterAndSort')}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.modalCloseButton}>
                <Icon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Filter Content */}
            <View style={styles.filterContent}>
              {/* Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>
                  {t('tour.management.status')}
                </Text>
                <View style={styles.statusGrid}>
                  {Object.keys(STATUS_COLORS).map(status => (
                    <TouchableOpacity
                      key={status.toLowerCase()}
                      style={[
                        styles.statusFilterChip,
                        {backgroundColor: STATUS_COLORS[status].bg},
                        filters.status.includes(status) &&
                          styles.statusFilterChipSelected,
                      ]}
                      onPress={() => handleStatusToggle(status)}>
                      <Text
                        style={[
                          styles.statusFilterText,
                          {color: STATUS_COLORS[status].color},
                          filters.status.includes(status) &&
                            styles.statusFilterTextSelected,
                        ]}>
                        {t(`tour.management.${status.toLowerCase()}`)}
                      </Text>
                      {filters.status.includes(status) && (
                        <Icon name="check" size={16} color="#4AC6D0" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort By */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>
                  {t('tour.management.sortBy')}
                </Text>
                <View style={styles.sortOptions}>
                  {SORT_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.sortOption,
                        filters.sortBy === option.key &&
                          styles.sortOptionSelected,
                      ]}
                      onPress={() =>
                        setFilters(prev => ({
                          ...prev,
                          sortBy: option.key as any,
                        }))
                      }>
                      <Text
                        style={[
                          styles.sortOptionText,
                          filters.sortBy === option.key &&
                            styles.sortOptionTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                      {filters.sortBy === option.key && (
                        <Icon
                          name="radio-button-checked"
                          size={20}
                          color="#4AC6D0"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}>
                <Text style={styles.resetButtonText}>{t('common.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApply}>
                <LinearGradient
                  colors={['#4AC6D0', '#3BB8C3']}
                  style={styles.applyButtonGradient}>
                  <Text style={styles.applyButtonText}>
                    {t('common.apply')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  },
);

const EmptyState = React.memo(({onCreateTour}: {onCreateTour: () => void}) => {
  const {t} = useTranslation();

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Icon name="explore-off" size={64} color="#CBD5E1" />
      </View>
      <Text style={styles.emptyTitle}>{t('tour.management.noToursYet')}</Text>
      <Text style={styles.emptySubtitle}>
        {t('tour.management.createFirstTour')}
      </Text>
      <TouchableOpacity
        style={styles.createFirstTourButton}
        onPress={onCreateTour}>
        <LinearGradient
          colors={['#4AC6D0', '#3BB8C3']}
          style={styles.createFirstTourGradient}>
          <Icon name="add" size={20} color="#fff" />
          <Text style={styles.createFirstTourText}>
            {t('tour.management.createTour')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

// Main Component
const TourManagementScreen: React.FC = () => {
  const {user} = useAuth();
  const navigation = useNavigation<any>();
  const {t} = useTranslation();

  // State
  const [tours, setTours] = useState<TourItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    sortBy: 'newest',
    dateRange: 'all',
  });

  // Statistics
  const statistics = useMemo(() => {
    const totalTours = tours.length;
    const activeTours = tours.filter(t => t.status === 'active').length;
    // const draftTours = tours.filter(t => t.status === 'draft').length;
    // const completedTours = tours.filter(t => t.status === 'completed').length;
    // const totalRevenue = tours.reduce((sum, tour) => {
    //   const total = tour?.currentParticipants || 0;
    //   return sum + total * tour?.price?.adult;
    // }, 0);

    return [
      {
        title: t('tour.management.totalTours'),
        value: totalTours,
        icon: 'explore',
        color: '#4AC6D0',
        bgColor: 'rgba(74, 198, 208, 0.1)',
      },
      {
        title: t('tour.management.activeTours'),
        value: activeTours,
        icon: 'trending-up',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
      },
      // {
      //   title: t('tour.management.revenue'),
      //   value: `$${totalRevenue.toLocaleString()}`,
      //   icon: 'attach-money',
      //   color: '#F59E0B',
      //   bgColor: 'rgba(245, 158, 11, 0.1)',
      // },
    ];
  }, [tours, t]);

  // Filtered and sorted tours
  const filteredTours = useMemo(() => {
    let result = tours.filter(tour => {
      // Search filter
      const matchesSearch =
        tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tour?.stops[0]?.destination?.address
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        filters.status.length === 0 || filters.status.includes(tour.status);

      return matchesSearch && matchesStatus;
    });

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case 'price_low':
          return a?.price?.adult - b?.price?.adult;
        case 'price_high':
          return b?.price?.adult - a?.price?.adult;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return result;
  }, [tours, searchQuery, filters]);

  // Load tours
  const loadTours = useCallback(async () => {
    try {
      const toursQuery =
        user?.role === 'admin'
          ? firestore().collection('tours')
          : firestore()
              .collection('tours')
              .where('guideId', 'array-contains', user.uid);

      const unsubscribe = toursQuery.orderBy('createdAt', 'desc').onSnapshot(
        snapshot => {
          if (snapshot.empty) {
            console.log('No tours found');
            setTours([]);
            setLoading(false);
            setRefreshing(false);
            return;
          }
          const toursList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as TourItinerary[];
          // console.log('Tours loaded:', toursList);

          setTours(toursList);
          setLoading(false);
          setRefreshing(false);
        },
        error => {
          console.error('Error loading tours:', error);
          Alert.alert(
            t('common.error'),
            t('admin.dashboard.failedToLoadTours'),
          );
          setLoading(false);
          setRefreshing(false);
        },
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up tours listener:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid, user?.role, t]);

  // Effects
  useEffect(() => {
    const unsubscribe = loadTours();
    return () => {
      if (unsubscribe) {
        unsubscribe;
      }
    };
  }, [loadTours]);

  // Handlers
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTours();
  }, [loadTours]);

  const handleCreateTour = useCallback(() => {
    navigation.navigate('CreateTour');
  }, [navigation]);

  const handleTourPress = useCallback(
    (tourId: string) => {
      navigation.navigate('TourDetail', {tourId});
    },
    [navigation],
  );

  const handleEditTour = useCallback(
    (tourId: string) => {
      navigation.navigate('EditTour', {tourId});
    },
    [navigation],
  );

  const handleDeleteTour = useCallback(
    (tour: TourItinerary) => {
      Alert.alert(
        t('common.delete'),
        t('tour.management.deleteTourConfirmation'),
        [
          {text: t('common.cancel'), style: 'cancel'},
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await firestore().collection('tours').doc(tour.id).delete();
                Alert.alert(
                  t('common.success'),
                  t('tour.management.tourDeleted'),
                );
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
    },
    [t],
  );

  const handleApplyFilters = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, []);

  const renderStatCard = useCallback(
    ({item}: {item: StatCard}) => <StatisticsCard stat={item} />,
    [],
  );

  const renderTourCard = useCallback(
    ({item}: {item: TourItinerary}) => (
      <TourCard
        tour={item}
        onPress={() => handleTourPress(item.id)}
        onEdit={() => handleEditTour(item.id)}
        onDelete={() => handleDeleteTour(item)}
      />
    ),
    [handleTourPress, handleEditTour, handleDeleteTour],
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.header}>
        {/* Statistics */}
        <View style={styles.statisticsSection}>
          <Text style={styles.sectionTitle}>
            {t('tour.management.statistics')}
          </Text>
          <FlatList
            data={statistics}
            renderItem={renderStatCard}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statisticsList}
          />
        </View>

        {/* Search and Filter */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('tour.management.searchTours')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}>
            <Icon name="filter-list" size={20} color="#4AC6D0" />
            {(filters.status.length > 0 || filters.sortBy !== 'newest') && (
              <View style={styles.filterBadge} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          {t('tour.management.totalTours')} ({filteredTours.length})
        </Text>
      </View>
    ),
    [statistics, searchQuery, filters, filteredTours.length, renderStatCard, t],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4AC6D0" />
          <Text style={styles.loadingText}>
            {t('tour.management.loadingTours')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      {/* Header Bar */}
      <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.headerBar}>
        <View style={styles.headerBarContent}>
          <View />
          {/* <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity> */}
          <Text style={styles.headerTitle}>{t('tour.management.title')}</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateTour}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {tours.length === 0 ? (
        <EmptyState onCreateTour={handleCreateTour} />
      ) : (
        <FlatList
          data={filteredTours}
          renderItem={renderTourCard}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4AC6D0']}
              tintColor="#4AC6D0"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
      <View style={styles.navigationBottom}>
        <TouchableOpacity
          style={[styles.bottomButton, styles.toursButton]}
          onPress={() => {
            navigation.navigate('ChatList');
          }}>
          <View style={styles.inactiveButtonContainer}>
            <Icon name="map" size={18} color="#64748B" />
            <Text style={styles.inactiveButtonText}>
              {t('chatScreen.channel')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomButton, styles.channelButton]}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.activeButtonGradient}>
            <Icon name="forum" size={18} color="#FFF" />
            <Text style={styles.activeButtonText}>{t('chatScreen.tours')}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomButton, styles.toursButton]}
          onPress={() => {
            navigation.navigate('UserProfile');
          }}>
          <View style={styles.inactiveButtonContainer}>
            <Icon name="settings" size={18} color="#64748B" />
            <Text style={styles.inactiveButtonText}>
              {t('common.settings')}
            </Text>
          </View>
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

  navigationBottom: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
    gap: 12,
  },
  bottomButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  channelButton: {
    // Active state styles handled by gradient
  },
  toursButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  inactiveButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  activeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  inactiveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  headerBar: {
    paddingVertical: 16,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statisticsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statisticsList: {
    gap: 12,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 140,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    height: 48,
    marginLeft: 12,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  tourCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  tourImageContainer: {
    height: 120,
    position: 'relative',
  },
  tourImage: {
    width: '100%',
    height: '100%',
  },
  tourImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourImageOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  featuredBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourContent: {
    padding: 16,
    flex: 1,
  },
  tourTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    lineHeight: 22,
  },
  tourMeta: {
    gap: 6,
    marginBottom: 12,
  },
  tourLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tourLocationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  tourDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tourDurationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  tourDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tourPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4AC6D0',
  },
  tourRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tourRatingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tourStats: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    justifyContent: 'flex-start',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 3,
    flex: 1,
  },
  tourStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tourStatText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  tourActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  createFirstTourButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createFirstTourGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  createFirstTourText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    elevation: 20,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  filterContent: {
    maxHeight: 400,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  statusFilterChipSelected: {
    borderColor: '#4AC6D0',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
  },
  statusFilterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusFilterTextSelected: {
    color: '#4AC6D0',
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortOptionSelected: {
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    borderColor: '#4AC6D0',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  sortOptionTextSelected: {
    color: '#4AC6D0',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 48,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  applyButton: {
    flex: 1,
    borderRadius: 16,
  },
  applyButtonGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});

export default TourManagementScreen;
