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

// Components
import OverviewTab from '../components/Admin/OverviewTab';
import TourGuideCard from '../components/Admin/TourGuideCard';
import TouristCard from '../components/Admin/TouristCard';
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
}

type TabType = 'overview' | 'guides' | 'tourists';

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

  // Memoize filter options để tránh re-create array
  const guidesFilterOptions = useMemo(
    () => ['all', 'pending', 'approved', 'suspended'],
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
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStatisticsRef = useRef<() => Promise<void>>();
  const loadTourGuidesRef = useRef<() => Promise<void>>();
  const loadTouristsRef = useRef<() => Promise<void>>();
  const guidesSearchRef = useRef((query: string) => {
    setGuidesSearchQuery(query);
  });

  const touristsSearchRef = useRef((query: string) => {
    setTouristsSearchQuery(query);
  });

  const guidesFilterRef = useRef(
    (filter: 'all' | 'pending' | 'approved' | 'suspended') => {
      setGuidesFilter(filter);
    },
  );

  // Update refs to current functions
  guidesSearchRef.current = (query: string) => {
    setGuidesSearchQuery(query);
  };

  touristsSearchRef.current = (query: string) => {
    setTouristsSearchQuery(query);
  };

  guidesFilterRef.current = (
    filter: 'all' | 'pending' | 'approved' | 'suspended',
  ) => {
    setGuidesFilter(filter);
  };

  // Stable callback wrappers
  const handleGuidesSearchChange = useCallback((query: string) => {
    guidesSearchRef.current(query);
  }, []);

  const handleTouristsSearchChange = useCallback((query: string) => {
    touristsSearchRef.current(query);
  }, []);

  const handleGuidesFilterChange = useCallback(
    (filter: 'all' | 'pending' | 'approved' | 'suspended') => {
      guidesFilterRef.current(filter);
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
    setGuidesFilter('all');
  }, []);
  const loadStatistics = useCallback(async () => {
    setStatsLoading(true);
    try {
      const usersSnapshot = await firestore().collection('users').get();
      const allUsers = usersSnapshot.docs
        .filter(doc => doc.data().role !== 'admin')
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

      // Get all active users (both tourists and tour guides) to count active chats
      const chatsSnapshot = await firestore()
        .collection('users')
        .where('userStatus.isOnline', '==', true)
        .where('role', 'in', ['tourist', 'tour_guide'])
        .get();

      const tourGuides = allUsers.filter(user => user.role === 'tour_guide');
      const tourists = allUsers.filter(user => user.role === 'tourist');

      const currentDate = new Date();
      const firstDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );

      const newUsersSnapshot = await firestore()
        .collection('users')
        .where('createdAt', '>=', firestore.Timestamp.fromDate(firstDayOfMonth))
        .get();

      setStatistics({
        totalUsers: allUsers.length,
        totalTourGuides: tourGuides.length,
        totalTourists: tourists.length,
        approvedGuides: tourGuides.filter(g => g.status === 'approved').length,
        pendingGuides: tourGuides.filter(
          g => !g.status || g.status === 'pending',
        ).length,
        suspendedGuides: tourGuides.filter(g => g.status === 'suspended')
          .length,
        activeChats: chatsSnapshot.size,
        newUsersThisMonth: newUsersSnapshot.size,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
      Alert.alert(
        t('common.error'),
        t('admin.dashboard.failedToLoadStatistics'),
      );

      setStatsLoading(false);
    }
    setStatsLoading(false);
  }, []);

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
  }, []);

  loadStatisticsRef.current = loadStatistics;
  loadTourGuidesRef.current = loadTourGuides;
  loadTouristsRef.current = loadTourists;

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

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Icon
          name={activeTab === 'guides' ? 'user-tie' : 'user-friends'}
          size={48}
          color="#ccc"
        />
        <Text style={styles.emptyText}>
          {activeTab === 'guides'
            ? t('admin.dashboard.noTourGuidesFound')
            : t('admin.dashboard.noTouristsFound')}
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
            : t('admin.dashboard.loadingTourists')}
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
          activeTab === 'guides' ? guidesSearchQuery : touristsSearchQuery
        }
        onSearchChange={
          activeTab === 'guides'
            ? handleGuidesSearchChange
            : handleTouristsSearchChange
        }
        searchPlaceholder={
          activeTab === 'guides'
            ? t('admin.dashboard.searchTourGuides')
            : t('admin.dashboard.searchTourists')
        }
        filterOptions={activeTab === 'guides' ? guidesFilterOptions : undefined}
        activeFilter={activeTab === 'guides' ? guidesFilter : undefined}
        onFilterChange={
          activeTab === 'guides' ? handleGuidesFilterChange : undefined
        }
      />
    ),
    [activeTab, guidesSearchQuery, touristsSearchQuery, guidesFilter, t],
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
      ) : (
        <FlatList
          data={activeTab === 'guides' ? filteredTourGuides : filteredTourists}
          renderItem={activeTab === 'guides' ? renderTourGuide : renderTourist}
          keyExtractor={item => item?.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={activeTab === 'guides' ? guidesLoading : touristsLoading}
          onRefresh={activeTab === 'guides' ? loadTourGuides : loadTourists}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            (activeTab === 'guides' ? guidesLoading : touristsLoading)
              ? renderLoadingComponent
              : renderEmptyComponent
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginLeft: 16,
  },
  logoutButton: {
    padding: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
});

export default AdminDashboardScreen;
