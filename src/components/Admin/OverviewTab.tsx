import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

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

interface OverviewTabProps {
  statistics: Statistics;
  onNavigateToTab: (tab: 'guides' | 'tourists') => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  statistics,
  onNavigateToTab,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
            onPress={() => onNavigateToTab('guides')}>
            <Icon name="user-tie" size={24} color="#10B981" />
            <Text style={styles.quickActionText}>Manage Tour Guides</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => onNavigateToTab('tourists')}>
            <Icon name="user-friends" size={24} color="#3B82F6" />
            <Text style={styles.quickActionText}>Manage Tourists</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FBFD',
    flex: 1,
  },
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
});

export default OverviewTab;
