import React, {useEffect, useState} from 'react';
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

  useEffect(() => {
    loadStatistics();
    if (activeTab === 'guides') {
      loadTourGuides();
    } else if (activeTab === 'tourists') {
      loadTourists();
    }
  }, [activeTab]);
  const setActiveTab = (tab: TabType) => {
    setTitleActiveTab(tab);
    setGuidesSearchQuery('');
    setTouristsSearchQuery('');
  };
  const loadStatistics = async () => {
    setStatsLoading(true);
    try {
      // Get all users
      const usersSnapshot = await firestore().collection('users').get();
      const allUsers = usersSnapshot.docs
        .filter(doc => doc.data().role !== 'admin')
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

      // Get active chats
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('isActive', '==', true)
        .get();

      // Calculate statistics
      const tourGuides = allUsers.filter(user => user.role === 'tour_guide');
      const tourists = allUsers.filter(user => user.role === 'tourist');

      // Get users created this month
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
    }
    setStatsLoading(false);
  };

  const loadTourGuides = async () => {
    setGuidesLoading(true);
    try {
      const snapshot = await firestore()
        .collection('users')
        .where('role', '==', 'tour_guide')
        .orderBy('createdAt', 'desc')
        .get();

      const guides: TourGuide[] = snapshot.docs.map(doc => ({
        id: doc.id,
        status: doc.data().status || 'pending',
        ...doc.data(),
      })) as TourGuide[];

      setTourGuides(guides);
    } catch (error) {
      console.error('Error loading tour guides:', error);
      Alert.alert('Error', 'Failed to load tour guides');
    }
    setGuidesLoading(false);
  };

  const loadTourists = async () => {
    setTouristsLoading(true);
    try {
      const snapshot = await firestore()
        .collection('users')
        .where('role', '==', 'tourist')
        .orderBy('createdAt', 'desc')
        .get();

      const touristList: Tourist[] = snapshot.docs.map(doc => ({
        id: doc.id,
        isActive: doc.data().isActive !== false,
        ...doc.data(),
      })) as Tourist[];

      setTourists(touristList);
    } catch (error) {
      console.error('Error loading tourists:', error);
      Alert.alert('Error', 'Failed to load tourists');
    }
    setTouristsLoading(false);
  };

  const updateTourGuideStatus = async (guideId: string, newStatus: string) => {
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

      Alert.alert('Success', `Tour guide status updated to ${newStatus}`);
      loadStatistics();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const updateTouristStatus = async (touristId: string, isActive: boolean) => {
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
        'Success',
        `Tourist account ${isActive ? 'activated' : 'deactivated'}`,
      );
    } catch (error) {
      console.error('Error updating tourist status:', error);
      Alert.alert('Error', 'Failed to update tourist status');
    }
  };

  const confirmStatusChange = (
    userId: string,
    newStatus: string,
    userName: string,
    isGuide: boolean = true,
  ) => {
    const actionText = isGuide
      ? {
          approved: 'approve',
          rejected: 'reject',
          suspended: 'suspend',
          pending: 'set as pending',
        }[newStatus]
      : newStatus === 'true'
      ? 'activate'
      : 'deactivate';

    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${actionText} ${userName || 'this user'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Confirm',
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
  };

  // Filter functions
  const filteredTourGuides = tourGuides.filter(guide => {
    const matchesSearch =
      guide.email.toLowerCase().includes(guidesSearchQuery.toLowerCase()) ||
      (guide.name &&
        guide.name.toLowerCase().includes(guidesSearchQuery.toLowerCase()));
    const matchesFilter =
      guidesFilter === 'all' || guide.status === guidesFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredTourists = tourists.filter(tourist => {
    const matchesSearch =
      tourist.email.toLowerCase().includes(touristsSearchQuery.toLowerCase()) ||
      (tourist.name &&
        tourist.name.toLowerCase().includes(touristsSearchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Render header component
  const renderHeader = () => (
    <SearchAndFilter
      searchQuery={
        activeTab === 'guides' ? guidesSearchQuery : touristsSearchQuery
      }
      onSearchChange={
        activeTab === 'guides' ? setGuidesSearchQuery : setTouristsSearchQuery
      }
      searchPlaceholder={
        activeTab === 'guides' ? 'Search tour guides...' : 'Search tourists...'
      }
      filterOptions={
        activeTab === 'guides'
          ? ['all', 'pending', 'approved', 'suspended']
          : undefined
      }
      activeFilter={activeTab === 'guides' ? guidesFilter : undefined}
      onFilterChange={activeTab === 'guides' ? setGuidesFilter : undefined}
    />
  );

  const renderTourGuide = ({item}: {item: TourGuide}) => (
    <TourGuideCard item={item} onStatusChange={confirmStatusChange} />
  );

  const renderTourist = ({item}: {item: Tourist}) => (
    <TouristCard item={item} onStatusChange={confirmStatusChange} />
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name={activeTab === 'guides' ? 'user-tie' : 'user-friends'}
        size={48}
        color="#ccc"
      />
      <Text style={styles.emptyText}>
        No {activeTab === 'guides' ? 'tour guides' : 'tourists'} found
      </Text>
    </View>
  );

  const renderLoadingComponent = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#5B72EF" />
      <Text style={styles.loadingText}>
        Loading {activeTab === 'guides' ? 'tour guides' : 'tourists'}...
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Loading loading={statsLoading} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={24} color="#5B72EF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
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
          keyExtractor={item => item?.id}
          contentContainerStyle={styles.listContainer}
          refreshing={activeTab === 'guides' ? guidesLoading : touristsLoading}
          onRefresh={activeTab === 'guides' ? loadTourGuides : loadTourists}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            (activeTab === 'guides' ? guidesLoading : touristsLoading)
              ? renderLoadingComponent()
              : renderEmptyComponent()
          }
          stickyHeaderIndices={[0]} // Make search bar sticky
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
