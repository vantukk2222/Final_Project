import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../../contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Loading from '../../components/Loading';

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

const AdminDashboardScreen = () => {
  const {user, signOut} = useAuth();
  const navigation = useNavigation();

  // Tab state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'guides' | 'tourists'
  >('overview');

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
        isActive: doc.data().isActive !== false, // Default to true if not set
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
      loadStatistics(); // Refresh statistics
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

  // Render functions
  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Main Statistics Cards */}
      <View style={styles.mainStatsContainer}>
        <View style={[styles.mainStatCard, {backgroundColor: '#3B82F6'}]}>
          <Icon name="users" size={32} color="#fff" />
          <Text style={styles.mainStatNumber}>{statistics.totalUsers}</Text>
          <Text style={styles.mainStatLabel}>Total Users</Text>
        </View>
        <View style={[styles.mainStatCard, {backgroundColor: '#10B981'}]}>
          <Icon name="user-tie" size={32} color="#fff" />
          <Text style={styles.mainStatNumber}>
            {statistics.totalTourGuides}
          </Text>
          <Text style={styles.mainStatLabel}>Tour Guides</Text>
        </View>
        <View style={[styles.mainStatCard, {backgroundColor: '#F59E0B'}]}>
          <Icon name="user-friends" size={32} color="#fff" />
          <Text style={styles.mainStatNumber}>{statistics.totalTourists}</Text>
          <Text style={styles.mainStatLabel}>Tourists</Text>
        </View>
      </View>

      {/* Tour Guide Statistics */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Tour Guide Status</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, {color: '#10B981'}]}>
              {statistics.approvedGuides}
            </Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, {color: '#F59E0B'}]}>
              {statistics.pendingGuides}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, {color: '#EF4444'}]}>
              {statistics.suspendedGuides}
            </Text>
            <Text style={styles.statLabel}>Suspended</Text>
          </View>
        </View>
      </View>

      {/* Activity Statistics */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Platform Activity</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, {color: '#8B5CF6'}]}>
              {statistics.activeChats}
            </Text>
            <Text style={styles.statLabel}>Active Chats</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, {color: '#06B6D4'}]}>
              {statistics.newUsersThisMonth}
            </Text>
            <Text style={styles.statLabel}>New This Month</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => setActiveTab('guides')}>
            <Icon name="user-tie" size={24} color="#10B981" />
            <Text style={styles.quickActionText}>Manage Tour Guides</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => setActiveTab('tourists')}>
            <Icon name="user-friends" size={24} color="#3B82F6" />
            <Text style={styles.quickActionText}>Manage Tourists</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderTourGuide = ({item}: {item: TourGuide}) => (
    <View style={styles.guideCard}>
      <View style={styles.guideHeader}>
        <View style={styles.avatarContainer}>
          {item?.avatar ? (
            <Image
              source={{uri: item?.avatar?.url || item?.avatar}}
              style={{width: 48, height: 48, borderRadius: 24}}
            />
          ) : (
            <Icon name="user-circle" size={48} color="#ccc" />
          )}
        </View>
        <View style={styles.guideInfo}>
          <Text style={styles.guideName}>{item?.name || 'No Name'}</Text>
          <Text style={styles.guideEmail}>{item?.email}</Text>
          {item?.bio && (
            <Text style={styles.guideBio} numberOfLines={2}>
              {item?.bio}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: getStatusColor(item?.status)},
          ]}>
          <Icon name={getStatusIcon(item?.status)} size={12} color="#fff" />
          <Text style={styles.statusText}>{item?.status?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        {item?.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() =>
                confirmStatusChange(
                  item?.id,
                  'approved',
                  item?.name || item?.email,
                  true,
                )
              }>
              <Icon name="check" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() =>
                confirmStatusChange(
                  item?.id,
                  'rejected',
                  item?.name || item?.email,
                  true,
                )
              }>
              <Icon name="times" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}

        {item?.status === 'approved' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.suspendButton]}
            onPress={() =>
              confirmStatusChange(
                item?.id,
                'suspended',
                item?.name || item?.email,
                true,
              )
            }>
            <Icon name="ban" size={14} color="#fff" />
            <Text style={styles.actionButtonText}>Suspend</Text>
          </TouchableOpacity>
        )}

        {item?.status === 'suspended' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() =>
              confirmStatusChange(
                item?.id,
                'approved',
                item?.name || item?.email,
                true,
              )
            }>
            <Icon name="unlock" size={14} color="#fff" />
            <Text style={styles.actionButtonText}>Reactivate</Text>
          </TouchableOpacity>
        )}

        {item?.status === 'rejected' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pendingButton]}
            onPress={() =>
              confirmStatusChange(
                item?.id,
                'pending',
                item?.name || item?.email,
                true,
              )
            }>
            <Icon name="undo" size={14} color="#fff" />
            <Text style={styles.actionButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderTourist = ({item}: {item: Tourist}) => (
    <View style={styles.guideCard}>
      <View style={styles.guideHeader}>
        <View style={styles.avatarContainer}>
          {item?.avatar ? (
            <Image
              source={{uri: item?.avatar?.url || item?.avatar}}
              style={{width: 48, height: 48, borderRadius: 24}}
            />
          ) : (
            <Icon name="user-circle" size={48} color="#ccc" />
          )}
        </View>
        <View style={styles.guideInfo}>
          <Text style={styles.guideName}>{item?.name || 'No Name'}</Text>
          <Text style={styles.guideEmail}>{item?.email}</Text>
          {item?.bio && (
            <Text style={styles.guideBio} numberOfLines={2}>
              {item?.bio}
            </Text>
          )}
          {item?.lastActive && (
            <Text style={styles.lastActiveText}>
              Last active:{' '}
              {new Date(item.lastActive.toDate()).toLocaleDateString()}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: item?.isActive ? '#10B981' : '#EF4444'},
          ]}>
          <Icon
            name={item?.isActive ? 'check-circle' : 'times-circle'}
            size={12}
            color="#fff"
          />
          <Text style={styles.statusText}>
            {item?.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            item?.isActive ? styles.suspendButton : styles.approveButton,
          ]}
          onPress={() =>
            confirmStatusChange(
              item?.id,
              item?.isActive ? 'false' : 'true',
              item?.name || item?.email,
              false,
            )
          }>
          <Icon
            name={item?.isActive ? 'ban' : 'check'}
            size={14}
            color="#fff"
          />
          <Text style={styles.actionButtonText}>
            {item?.isActive ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'rejected':
        return '#EF4444';
      case 'suspended':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'check-circle';
      case 'pending':
        return 'clock';
      case 'rejected':
        return 'times-circle';
      case 'suspended':
        return 'ban';
      default:
        return 'question-circle';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Loading loading={statsLoading} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={24} color="#5B72EF" />
          </TouchableOpacity> */}
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Icon name="sign-out-alt" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'overview' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('overview')}>
          <Icon
            name="chart-bar"
            size={16}
            color={activeTab === 'overview' ? '#fff' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'overview' && styles.tabButtonTextActive,
            ]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'guides' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('guides')}>
          <Icon
            name="user-tie"
            size={16}
            color={activeTab === 'guides' ? '#fff' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'guides' && styles.tabButtonTextActive,
            ]}>
            Tour Guides
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'tourists' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('tourists')}>
          <Icon
            name="user-friends"
            size={16}
            color={activeTab === 'tourists' ? '#fff' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'tourists' && styles.tabButtonTextActive,
            ]}>
            Tourists
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}

      {activeTab === 'guides' && (
        <View style={styles.tabContent}>
          {/* Search and Filter for Tour Guides */}
          <View style={styles.searchContainer}>
            <Icon
              name="search"
              size={16}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tour guides..."
              placeholderTextColor="#999"
              value={guidesSearchQuery}
              onChangeText={setGuidesSearchQuery}
            />
          </View>

          <View style={styles.filterContainer}>
            {['all', 'pending', 'approved', 'suspended'].map(filterOption => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  guidesFilter === filterOption && styles.filterButtonActive,
                ]}
                onPress={() => setGuidesFilter(filterOption as any)}>
                <Text
                  style={[
                    styles.filterButtonText,
                    guidesFilter === filterOption &&
                      styles.filterButtonTextActive,
                  ]}>
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {guidesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5B72EF" />
              <Text style={styles.loadingText}>Loading tour guides...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTourGuides}
              renderItem={renderTourGuide}
              keyExtractor={item => item?.id}
              contentContainerStyle={styles.listContainer}
              refreshing={guidesLoading}
              onRefresh={loadTourGuides}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="user-tie" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No tour guides found</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {activeTab === 'tourists' && (
        <View style={styles.tabContent}>
          {/* Search for Tourists */}
          <View style={styles.searchContainer}>
            <Icon
              name="search"
              size={16}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tourists..."
              placeholderTextColor="#999"
              value={touristsSearchQuery}
              onChangeText={setTouristsSearchQuery}
            />
          </View>

          {touristsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5B72EF" />
              <Text style={styles.loadingText}>Loading tourists...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTourists}
              renderItem={renderTourist}
              keyExtractor={item => item?.id}
              contentContainerStyle={styles.listContainer}
              refreshing={touristsLoading}
              onRefresh={loadTourists}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="user-friends" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No tourists found</Text>
                </View>
              }
            />
          )}
        </View>
      )}
    </ScrollView>
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
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: '#5B72EF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
  },
  // Overview styles
  mainStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    marginBottom: 24,
  },
  mainStatCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mainStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  mainStatLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1E293B',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#5B72EF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },
  guideInfo: {
    flex: 1,
    marginRight: 12,
  },
  guideName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  guideEmail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  guideBio: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  lastActiveText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  suspendButton: {
    backgroundColor: '#6B7280',
  },
  pendingButton: {
    backgroundColor: '#F59E0B',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
