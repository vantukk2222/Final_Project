import React, {useCallback, useEffect, useMemo, useState, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Loading from '../components/Loading';
import {TourItinerary} from '../types/tour';

// Components
import OverviewTab from '../components/Admin/OverviewTab';
import TourGuideCard from '../components/Admin/TourGuideCard';
import TouristCard from '../components/Admin/TouristCard';
import TourCard from '../components/Admin/TourCard';
import SearchAndFilter from '../components/Admin/SearchAndFilter';
import TabNavigation from '../components/Admin/TabNavigation';
import {useTranslation} from '../contexts/TranslationContext';

interface TourGuide {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: any;
  bio?: string;
  avatar?: string;
}

interface Tourist {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive?: boolean;
  createdAt: any;
  bio?: string;
  avatar?: string;
  lastActive?: any;
}

interface Statistics {
  totalUsers: number;
  totalTourGuides: number;
  totalTourists: number;
  approvedGuides: number;
  pendingGuides: number;
  suspendedGuides: number;
  activeChats: number;
  newUsersThisMonth: number;
  totalTours: number;
  activeTours: number;
  completedTours: number;
  draftTours: number;
}

type TabType = 'overview' | 'guides' | 'tourists' | 'tours';

const AdminDashboardScreen = () => {
  const {user, signOut} = useAuth();
  const navigation = useNavigation();
  const {t} = useTranslation();

  // Tab state
  const [activeTab, setTitleActiveTab] = useState<TabType>('overview');

  // Tour guides state
  const [tourGuides, setTourGuides] = useState<TourGuide[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guidesSearchQuery, setGuidesSearchQuery] = useState('');
  const [guidesFilter, setGuidesFilter] = useState<
    'all' | 'pending' | 'approved' | 'suspended'
  >('all');

  // Tourists state
  const [tourists, setTourists] = useState<Tourist[]>([]);
  const [touristsLoading, setTouristsLoading] = useState(false);
  const [touristsSearchQuery, setTouristsSearchQuery] = useState('');

  // Tours state
  const [tours, setTours] = useState<TourItinerary[]>([]);
  const [toursLoading, setToursLoading] = useState(false);
  const [toursSearchQuery, setToursSearchQuery] = useState('');
  const [toursFilter, setToursFilter] = useState<
    'all' | 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
  >('all');

  // Memoize filter options để tránh re-create array
  const guidesFilterOptions = useMemo(
    () => ['all', 'pending', 'approved', 'suspended'],
    [],
  );

  const toursFilterOptions = useMemo(
    () => ['all', 'draft', 'published', 'active', 'completed', 'cancelled'],
    [],
  );

  // Statistics state
  const [statistics, setStatistics] = useState<Statistics>({
    totalUsers: 0,
    totalTourGuides: 0,
    totalTourists: 0,
    approvedGuides: 0,
    pendingGuides: 0,
    suspendedGuides: 0,
    activeChats: 0,
    newUsersThisMonth: 0,
    totalTours: 0,
    activeTours: 0,
    completedTours: 0,
    draftTours: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStatisticsRef = useRef<() => Promise<void>>();
  const loadTourGuidesRef = useRef<() => Promise<void>>();
  const loadTouristsRef = useRef<() => Promise<void>>();
  const loadToursRef = useRef<() => Promise<void>>();
  const guidesSearchRef = useRef((query: string) => {
    setGuidesSearchQuery(query);
  });

  const touristsSearchRef = useRef((query: string) => {
    setTouristsSearchQuery(query);
  });

  const toursSearchRef = useRef((query: string) => {
    setToursSearchQuery(query);
  });

  const guidesFilterRef = useRef(
    (filter: 'all' | 'pending' | 'approved' | 'suspended') => {
      setGuidesFilter(filter);
    },
  );

  const toursFilterRef = useRef(
    (
      filter:
        | 'all'
        | 'draft'
        | 'published'
        | 'active'
        | 'completed'
        | 'cancelled',
    ) => {
      setToursFilter(filter);
    },
  );

  // Update refs to current functions
  guidesSearchRef.current = (query: string) => {
    setGuidesSearchQuery(query);
  };

  touristsSearchRef.current = (query: string) => {
    setTouristsSearchQuery(query);
  };

  toursSearchRef.current = (query: string) => {
    setToursSearchQuery(query);
  };

  guidesFilterRef.current = (
    filter: 'all' | 'pending' | 'approved' | 'suspended',
  ) => {
    setGuidesFilter(filter);
  };

  toursFilterRef.current = (
    filter:
      | 'all'
      | 'draft'
      | 'published'
      | 'active'
      | 'completed'
      | 'cancelled',
  ) => {
    setToursFilter(filter);
  };

  // Stable callback wrappers
  const handleGuidesSearchChange = useCallback((query: string) => {
    guidesSearchRef.current(query);
  }, []);

  const handleTouristsSearchChange = useCallback((query: string) => {
    touristsSearchRef.current(query);
  }, []);

  const handleToursSearchChange = useCallback((query: string) => {
    toursSearchRef.current(query);
  }, []);

  const handleGuidesFilterChange = useCallback(
    (filter: 'all' | 'pending' | 'approved' | 'suspended') => {
      guidesFilterRef.current(filter);
    },
    [],
  );

  const handleToursFilterChange = useCallback(
    (
      filter:
        | 'all'
        | 'draft'
        | 'published'
        | 'active'
        | 'completed'
        | 'cancelled',
    ) => {
      toursFilterRef.current(filter);
    },
    [],
  );

  useEffect(() => {
    if (loadStatisticsRef.current) {
      loadStatisticsRef.current();
    }
    if (activeTab === 'guides' && loadTourGuidesRef.current) {
      loadTourGuidesRef.current();
    } else if (activeTab === 'tourists' && loadTouristsRef.current) {
      loadTouristsRef.current();
    } else if (activeTab === 'tours' && loadToursRef.current) {
      loadToursRef.current();
    }
  }, [activeTab]); // ONLY depend on activeTab

  const handleSignOut = useCallback(async () => {
    try {
      setStatsLoading(true);
      await signOut();
      setStatsLoading(false);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert(t('common.error'), t('admin.dashboard.failedToSignOut'));
    }
  }, [signOut, t]);

  const setActiveTab = useCallback((tab: TabType) => {
    setTitleActiveTab(tab);
    setGuidesSearchQuery('');
    setTouristsSearchQuery('');
    setToursSearchQuery('');
    setGuidesFilter('all');
    setToursFilter('all');
  }, []);
  const loadStatistics = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Create unsubscribe functions array for cleanup
      const unsubscribeFunctions: (() => void)[] = [];

      // Users listener
      const usersUnsubscribe = firestore()
        .collection('users')
        .onSnapshot(
          usersSnapshot => {
            const allUsers = usersSnapshot.docs
              .filter(doc => doc.data().role !== 'admin')
              .map(doc => ({
                id: doc.id,
                ...doc.data(),
              }));

            const guidesData = allUsers.filter(
              (userDoc: any) => userDoc.role === 'tour_guide',
            );
            const touristsData = allUsers.filter(
              (userDoc: any) => userDoc.role === 'tourist',
            );

            // Get active users count
            const activeUsers = allUsers.filter(
              (user: any) => user.userStatus?.isOnline === true,
            );

            // Calculate new users this month
            const currentDate = new Date();
            const firstDayOfMonth = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              1,
            );

            const newUsersThisMonth = allUsers.filter((user: any) => {
              if (!user.createdAt) {
                return false;
              }
              const userCreatedAt = user.createdAt.toDate
                ? user.createdAt.toDate()
                : new Date(user.createdAt);
              return userCreatedAt >= firstDayOfMonth;
            });

            // Update statistics with users data
            setStatistics(prev => ({
              ...prev,
              totalUsers: allUsers.length,
              totalTourGuides: guidesData.length,
              totalTourists: touristsData.length,
              approvedGuides: guidesData.filter(
                (g: any) => g.status === 'approved',
              ).length,
              pendingGuides: guidesData.filter(
                (g: any) => !g.status || g.status === 'pending',
              ).length,
              suspendedGuides: guidesData.filter(
                (g: any) => g.status === 'suspended',
              ).length,
              activeChats: activeUsers.length,
              newUsersThisMonth: newUsersThisMonth.length,
            }));

            setStatsLoading(false);
          },
          error => {
            console.error('Users snapshot error:', error);
            Alert.alert(
              t('common.error'),
              t('admin.dashboard.failedToLoadStatistics'),
            );
            setStatsLoading(false);
          },
        );

      unsubscribeFunctions.push(usersUnsubscribe);

      // Tours listener
      const toursUnsubscribe = firestore()
        .collection('tours')
        .onSnapshot(
          toursSnapshot => {
            const allTours = toursSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));

            // Update statistics with tours data
            setStatistics(prev => ({
              ...prev,
              totalTours: allTours.length,
              activeTours: allTours.filter(
                (tour: any) => tour.status === 'active',
              ).length,
              completedTours: allTours.filter(
                (tour: any) => tour.status === 'completed',
              ).length,
              draftTours: allTours.filter(
                (tour: any) => tour.status === 'draft',
              ).length,
            }));
          },
          error => {
            console.error('Tours snapshot error:', error);
            Alert.alert(
              t('common.error'),
              t('admin.dashboard.failedToLoadStatistics'),
            );
          },
        );

      unsubscribeFunctions.push(toursUnsubscribe);

      // Store unsubscribe functions for cleanup
      loadStatisticsRef.current.unsubscribe = () => {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      };

      return () => {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      };
    } catch (error) {
      console.error('Error setting up statistics listeners:', error);
      Alert.alert(
        t('common.error'),
        t('admin.dashboard.failedToLoadStatistics'),
      );
      setStatsLoading(false);
    }
  }, [t]);

  const loadTourGuides = useCallback(async () => {
    setGuidesLoading(true);
    try {
      const unsubscribe = await firestore()
        .collection('users')
        .where('role', '==', 'tour_guide')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          snapshot => {
            const guides: TourGuide[] = snapshot.docs.map(doc => ({
              id: doc.id,
              status: doc.data().status || 'pending',
              ...doc.data(),
            })) as TourGuide[];

            setTourGuides(guides);
            setGuidesLoading(false);
          },
          error => {
            console.error('Tour guide snapshot error:', error);
            Alert.alert(
              t('common.error'),
              t('admin.dashboard.failedToLoadTourGuides'),
            );
            setGuidesLoading(false);
          },
        );
      // Return unsubscribe function for cleanup
      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading tour guides:', error);
      Alert.alert(
        t('common.error'),
        t('admin.dashboard.failedToLoadTourGuides'),
      );
      setGuidesLoading(false);
    }
    setGuidesLoading(false);
  }, []);

  const loadTourists = useCallback(async () => {
    setTouristsLoading(true);
    try {
      const unsubscribe = firestore()
        .collection('users')
        .where('role', '==', 'tourist')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          snapshot => {
            const touristList: Tourist[] = snapshot.docs.map(doc => ({
              id: doc.id,
              isActive: doc.data().isActive !== false,
              ...doc.data(),
            })) as Tourist[];

            setTourists(touristList);
            setTouristsLoading(false);
          },
          error => {
            console.error('Tourist snapshot error:', error);
            Alert.alert(
              t('common.error'),
              t('admin.dashboard.failedToLoadTourists'),
            );
            setTouristsLoading(false);
          },
        );

      // Return unsubscribe function for cleanup
      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading tourists:', error);
      setTouristsLoading(false);
      Alert.alert(t('common.error'), t('admin.dashboard.failedToLoadTourists'));
    }
    setTouristsLoading(false);
  }, [t]);

  const loadTours = useCallback(async () => {
    setToursLoading(true);
    try {
      const unsubscribe = firestore()
        .collection('tours')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          snapshot => {
            const tourList: TourItinerary[] = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as TourItinerary[];

            setTours(tourList);
            setToursLoading(false);
          },
          error => {
            console.error('Tours snapshot error:', error);
            Alert.alert(
              t('common.error'),
              t('admin.dashboard.failedToLoadTours'),
            );
            setToursLoading(false);
          },
        );

      // Return unsubscribe function for cleanup
      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading tours:', error);
      setToursLoading(false);
      Alert.alert(t('common.error'), t('admin.dashboard.failedToLoadTours'));
    }
    setToursLoading(false);
  }, [t]);

  loadStatisticsRef.current = loadStatistics;
  loadTourGuidesRef.current = loadTourGuides;
  loadTouristsRef.current = loadTourists;
  loadToursRef.current = loadTours;

  const updateTourGuideStatus = useCallback(
    async (guideId: string, newStatus: string) => {
      try {
        await firestore().collection('users').doc(guideId).update({
          status: newStatus,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        setTourGuides(prev =>
          prev.map(guide =>
            guide.id === guideId ? {...guide, status: newStatus as any} : guide,
          ),
        );

        t('admin.dashboard.tourGuideStatusUpdated', {
          status: t(`admin.dashboard.status.${newStatus}`),
        });
        if (loadStatisticsRef.current) {
          loadStatisticsRef.current();
        }
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert(
          t('common.error'),
          t('admin.dashboard.failedToUpdateStatus'),
        );
      }
    },
    [],
  );

  const updateTouristStatus = useCallback(
    async (touristId: string, isActive: boolean) => {
      try {
        await firestore().collection('users').doc(touristId).update({
          isActive: isActive,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        setTourists(prev =>
          prev.map(tourist =>
            tourist.id === touristId ? {...tourist, isActive} : tourist,
          ),
        );

        Alert.alert(
          t('common.success'),
          isActive
            ? t('admin.dashboard.touristAccountActivated')
            : t('admin.dashboard.touristAccountDeactivated'),
        );
      } catch (error) {
        console.error('Error updating tourist status:', error);
        Alert.alert(
          t('common.error'),
          t('admin.dashboard.failedToUpdateTouristStatus'),
        );
      }
    },
    [],
  );

  const confirmStatusChange = useCallback(
    (
      userId: string,
      newStatus: string,
      userName: string,
      isGuide: boolean = true,
    ) => {
      let actionText: string;

      if (isGuide) {
        const statusActions = {
          approved: t('admin.dashboard.actions.approve'),
          rejected: t('admin.dashboard.actions.reject'),
          suspended: t('admin.dashboard.actions.suspend'),
          pending: t('admin.dashboard.actions.setPending'),
        };
        actionText = statusActions[newStatus as keyof typeof statusActions];
      } else {
        actionText =
          newStatus === 'true'
            ? t('admin.dashboard.actions.activate')
            : t('admin.dashboard.actions.deactivate');
      }
      actionText = actionText.toLowerCase();
      console.log('Action Text:', actionText);
      Alert.alert(
        t('admin.dashboard.confirmAction'),
        actionText === 'approve'
          ? t('admin.dashboard.approveActionMessage')
          : actionText === 'reject'
          ? t('admin.dashboard.rejectActionMessage')
          : actionText === 'suspend'
          ? t('admin.dashboard.suspendActionMessage')
          : actionText === 'reactivate'
          ? t('admin.dashboard.reactivateActionMessage')
          : t('admin.dashboard.deactivateActionMessage'),
        [
          {text: t('common.cancel'), style: 'cancel'},
          {
            text: t('common.confirm'),
            onPress: () => {
              if (isGuide) {
                updateTourGuideStatus(userId, newStatus);
              } else {
                updateTouristStatus(userId, newStatus === 'true');
              }
            },
            style:
              newStatus === 'suspended' || newStatus === 'false'
                ? 'destructive'
                : 'default',
          },
        ],
      );
    },
    [updateTourGuideStatus, updateTouristStatus, t],
  );

  const updateTourStatus = useCallback(
    async (tourId: string, newStatus: string) => {
      try {
        await firestore().collection('tours').doc(tourId).update({
          status: newStatus,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        setTours(prev =>
          prev.map(tour =>
            tour.id === tourId ? {...tour, status: newStatus as any} : tour,
          ),
        );

        Alert.alert(
          t('common.success'),
          t('admin.dashboard.tourStatusUpdated'),
        );
        if (loadStatisticsRef.current) {
          loadStatisticsRef.current();
        }
      } catch (error) {
        console.error('Error updating tour status:', error);
        Alert.alert(
          t('common.error'),
          t('admin.dashboard.failedToUpdateTourStatus'),
        );
      }
    },
    [t],
  );

  const confirmTourStatusChange = useCallback(
    (tourId: string, newStatus: string, tourTitle: string) => {
      const statusActions = {
        published: t('admin.tours.publish'),
        active: t('admin.tours.activate'),
        cancelled: t('admin.tours.cancel'),
        completed: t('admin.tours.complete'),
      };

      const actionText = statusActions[newStatus as keyof typeof statusActions];

      Alert.alert(
        t('admin.dashboard.confirmAction'),
        t(`admin.tours.tours.${actionText}`),
        [
          {text: t('common.cancel'), style: 'cancel'},
          {
            text: t('common.confirm'),
            onPress: () => updateTourStatus(tourId, newStatus),
            style: newStatus === 'cancelled' ? 'destructive' : 'default',
          },
        ],
      );
    },
    [updateTourStatus, t],
  );

  const handleViewTourDetails = useCallback((tourId: string) => {
    // Navigate to tour details screen
    navigation.navigate('TourDetail', {tourId});
    console.log('View tour details:', tourId);
  }, []);

  // Filter functions
  const filteredTourGuides = useMemo(() => {
    return tourGuides.filter(guide => {
      const matchesSearch =
        guide.email.toLowerCase().includes(guidesSearchQuery.toLowerCase()) ||
        (guide.name &&
          guide.name.toLowerCase().includes(guidesSearchQuery.toLowerCase()));
      const matchesFilter =
        guidesFilter === 'all' || guide.status === guidesFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tourGuides, guidesSearchQuery, guidesFilter]);

  const filteredTourists = useMemo(() => {
    return tourists.filter(tourist => {
      const matchesSearch =
        tourist.email
          .toLowerCase()
          .includes(touristsSearchQuery.toLowerCase()) ||
        (tourist.name &&
          tourist.name
            .toLowerCase()
            .includes(touristsSearchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [tourists, touristsSearchQuery]);

  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      const matchesSearch =
        tour.title.toLowerCase().includes(toursSearchQuery.toLowerCase()) ||
        (tour.guideName &&
          tour.guideName.some(name =>
            name.toLowerCase().includes(toursSearchQuery.toLowerCase()),
          ));
      const matchesFilter =
        toursFilter === 'all' || tour.status === toursFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tours, toursSearchQuery, toursFilter]);

  // Render header component
  // const renderHeader = useCallback(
  //   () => (
  //     <SearchAndFilter
  //       key={`search-${activeTab}`} // Force re-mount when tab changes
  //       searchQuery={
  //         activeTab === 'guides' ? guidesSearchQuery : touristsSearchQuery
  //       }
  //       onSearchChange={
  //         activeTab === 'guides'
  //           ? handleGuidesSearchChange
  //           : handleTouristsSearchChange
  //       }
  //       searchPlaceholder={
  //         activeTab === 'guides'
  //           ? 'Search tour guides...'
  //           : 'Search tourists...'
  //       }
  //       filterOptions={activeTab === 'guides' ? guidesFilterOptions : undefined}
  //       activeFilter={activeTab === 'guides' ? guidesFilter : undefined}
  //       onFilterChange={
  //         activeTab === 'guides' ? handleGuidesFilterChange : undefined
  //       }
  //     />
  //   ),
  //   [
  //     activeTab,
  //     guidesSearchQuery,
  //     touristsSearchQuery,
  //     guidesFilter,
  //     guidesFilterOptions,
  //     handleGuidesSearchChange,
  //     handleTouristsSearchChange,
  //     handleGuidesFilterChange,
  //   ],
  // );
  const renderTourGuide = useCallback(
    ({item}: {item: TourGuide}) => (
      <TourGuideCard item={item} onStatusChange={confirmStatusChange} />
    ),
    [confirmStatusChange],
  );

  const renderTourist = useCallback(
    ({item}: {item: Tourist}) => (
      <TouristCard item={item} onStatusChange={confirmStatusChange} />
    ),
    [confirmStatusChange],
  );

  const renderTour = useCallback(
    ({item}: {item: TourItinerary}) => (
      <TourCard
        item={item}
        onStatusChange={confirmTourStatusChange}
        onViewDetails={handleViewTourDetails}
      />
    ),
    [confirmTourStatusChange, handleViewTourDetails],
  );

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Icon
          name={
            activeTab === 'guides'
              ? 'user-tie'
              : activeTab === 'tourists'
              ? 'user-friends'
              : 'route'
          }
          size={48}
          color="#ccc"
        />
        <Text style={styles.emptyText}>
          {activeTab === 'guides'
            ? t('admin.dashboard.noTourGuidesFound')
            : activeTab === 'tourists'
            ? t('admin.dashboard.noTouristsFound')
            : t('admin.dashboard.noToursFound')}
        </Text>
      </View>
    ),
    [activeTab, t],
  );

  const renderLoadingComponent = useCallback(
    () => (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5B72EF" />
        <Text style={styles.loadingText}>
          {activeTab === 'guides'
            ? t('admin.dashboard.loadingTourGuides')
            : activeTab === 'tourists'
            ? t('admin.dashboard.loadingTourists')
            : t('admin.dashboard.loadingTours')}
        </Text>
      </View>
    ),
    [activeTab, t],
  );

  const searchAndFilterComponent = useMemo(
    () => (
      <SearchAndFilter
        key={activeTab}
        searchQuery={
          activeTab === 'guides'
            ? guidesSearchQuery
            : activeTab === 'tourists'
            ? touristsSearchQuery
            : toursSearchQuery
        }
        onSearchChange={
          activeTab === 'guides'
            ? handleGuidesSearchChange
            : activeTab === 'tourists'
            ? handleTouristsSearchChange
            : handleToursSearchChange
        }
        searchPlaceholder={
          activeTab === 'guides'
            ? t('admin.dashboard.searchTourGuides')
            : activeTab === 'tourists'
            ? t('admin.dashboard.searchTourists')
            : t('admin.dashboard.searchTours')
        }
        filterOptions={
          activeTab === 'guides'
            ? guidesFilterOptions
            : activeTab === 'tours'
            ? toursFilterOptions
            : undefined
        }
        activeFilter={
          activeTab === 'guides'
            ? guidesFilter
            : activeTab === 'tours'
            ? toursFilter
            : undefined
        }
        onFilterChange={
          activeTab === 'guides'
            ? (filter: string) => handleGuidesFilterChange(filter as any)
            : activeTab === 'tours'
            ? (filter: string) => handleToursFilterChange(filter as any)
            : undefined
        }
      />
    ),
    [
      activeTab,
      guidesSearchQuery,
      touristsSearchQuery,
      toursSearchQuery,
      guidesFilter,
      toursFilter,
      guidesFilterOptions,
      toursFilterOptions,
      handleGuidesSearchChange,
      handleTouristsSearchChange,
      handleToursSearchChange,
      handleGuidesFilterChange,
      handleToursFilterChange,
      t,
    ],
  );

  const renderHeader = useCallback(
    () => searchAndFilterComponent,
    [searchAndFilterComponent],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('admin.dashboard.title')}</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
          <Icon name="sign-out-alt" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <OverviewTab statistics={statistics} onNavigateToTab={setActiveTab} />
      ) : activeTab === 'guides' ? (
        <FlatList<TourGuide>
          data={filteredTourGuides}
          renderItem={renderTourGuide}
          keyExtractor={(item: TourGuide) =>
            item?.id || Math.random().toString()
          }
          contentContainerStyle={styles.listContainer}
          refreshing={guidesLoading}
          onRefresh={loadTourGuides}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            guidesLoading ? renderLoadingComponent : renderEmptyComponent
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={21}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        />
      ) : activeTab === 'tourists' ? (
        <FlatList<Tourist>
          data={filteredTourists}
          renderItem={renderTourist}
          keyExtractor={(item: Tourist) => item?.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={touristsLoading}
          onRefresh={loadTourists}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            touristsLoading ? renderLoadingComponent : renderEmptyComponent
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={21}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList<TourItinerary>
          data={filteredTours}
          renderItem={renderTour}
          keyExtractor={(item: TourItinerary) =>
            item?.id || Math.random().toString()
          }
          contentContainerStyle={styles.listContainer}
          refreshing={toursLoading}
          onRefresh={loadTours}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            toursLoading ? renderLoadingComponent : renderEmptyComponent
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={21}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4AC6D0',
    marginLeft: 16,
    letterSpacing: 0.5,
  },
  logoutButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  listContainer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default AdminDashboardScreen;
