import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from '../../contexts/TranslationContext';

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
  const {t} = useTranslation();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Main Statistics Cards */}
      <View style={styles.mainStatsContainer}>
        <LinearGradient
          colors={['#4AC6D0', '#3BB8C3']}
          style={styles.mainStatCard}>
          <Icon name="users" size={32} color="#fff" />
          <Text style={styles.mainStatNumber}>{statistics.totalUsers}</Text>
          <Text style={styles.mainStatLabel}>
            {t('admin.overview.totalUsers')}
          </Text>
        </LinearGradient>

        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.mainStatCard}>
          <Icon name="user-tie" size={32} color="#fff" />
          <Text style={styles.mainStatNumber}>
            {statistics.totalTourGuides}
          </Text>
          <Text style={styles.mainStatLabel}>
            {t('admin.overview.tourGuides')}
          </Text>
        </LinearGradient>

        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          style={styles.mainStatCard}>
          <Icon name="user-friends" size={32} color="#fff" />
          <Text style={styles.mainStatNumber}>{statistics.totalTourists}</Text>
          <Text style={styles.mainStatLabel}>
            {t('admin.overview.tourists')}
          </Text>
        </LinearGradient>
      </View>

      {/* Tour Guide Statistics */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Icon name="user-shield" size={20} color="#4AC6D0" />
          <Text style={styles.sectionTitle}>
            {t('admin.overview.tourGuideStatus')}
          </Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.approvedCard]}>
            <View
              style={[
                styles.statIconContainer,
                {backgroundColor: 'rgba(16, 185, 129, 0.1)'},
              ]}>
              <Icon name="check-circle" size={20} color="#10B981" />
            </View>
            <Text style={[styles.statNumber, {color: '#10B981'}]}>
              {statistics.approvedGuides}
            </Text>
            <Text style={styles.statLabel}>{t('admin.overview.approved')}</Text>
          </View>

          <View style={[styles.statCard, styles.pendingCard]}>
            <View
              style={[
                styles.statIconContainer,
                {backgroundColor: 'rgba(245, 158, 11, 0.1)'},
              ]}>
              <Icon name="clock" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.statNumber, {color: '#F59E0B'}]}>
              {statistics.pendingGuides}
            </Text>
            <Text style={styles.statLabel}>{t('admin.overview.pending')}</Text>
          </View>

          <View style={[styles.statCard, styles.suspendedCard]}>
            <View
              style={[
                styles.statIconContainer,
                {backgroundColor: 'rgba(239, 68, 68, 0.1)'},
              ]}>
              <Icon name="ban" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.statNumber, {color: '#EF4444'}]}>
              {statistics.suspendedGuides}
            </Text>
            <Text style={styles.statLabel}>
              {t('admin.overview.suspended')}
            </Text>
          </View>
        </View>
      </View>

      {/* Activity Statistics */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Icon name="chart-line" size={20} color="#4AC6D0" />
          <Text style={styles.sectionTitle}>
            {t('admin.overview.platformActivity')}
          </Text>
        </View>
        <View style={styles.activityStatsContainer}>
          <View style={[styles.activityStatCard, styles.onlineCard]}>
            <LinearGradient
              colors={['rgba(74, 198, 208, 0.1)', 'rgba(59, 184, 195, 0.05)']}
              style={styles.activityCardGradient}>
              <View style={styles.activityIconContainer}>
                <Icon name="comments" size={24} color="#4AC6D0" />
              </View>
              <View style={styles.activityTextContainer}>
                <Text style={[styles.activityNumber, {color: '#4AC6D0'}]}>
                  {statistics.activeChats}
                </Text>
                <Text style={styles.activityLabel}>
                  {t('admin.overview.activeChats')}
                </Text>
                <Text style={styles.activitySubtext}>
                  {t('admin.overview.activeChatsDescription')}
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View style={[styles.activityStatCard, styles.newUsersCard]}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.1)', 'rgba(124, 58, 237, 0.05)']}
              style={styles.activityCardGradient}>
              <View style={styles.activityIconContainer}>
                <Icon name="user-plus" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.activityTextContainer}>
                <Text style={[styles.activityNumber, {color: '#8B5CF6'}]}>
                  {statistics.newUsersThisMonth}
                </Text>
                <Text style={styles.activityLabel}>
                  {t('admin.overview.newThisMonth')}
                </Text>
                <Text style={styles.activitySubtext}>
                  {t('admin.overview.newThisMonthDescription')}
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Icon name="bolt" size={20} color="#4AC6D0" />
          <Text style={styles.sectionTitle}>
            {t('admin.overview.quickActions')}
          </Text>
        </View>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => onNavigateToTab('guides')}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.quickActionGradient}>
              <View style={styles.quickActionIconContainer}>
                <Icon name="user-tie" size={24} color="#fff" />
              </View>
              <Text style={styles.quickActionText}>
                {t('admin.overview.manageTourGuides')}
              </Text>
              <Text style={styles.quickActionSubtext}>
                {t('admin.overview.manageTourGuidesDescription')}
              </Text>
              <Icon
                name="arrow-right"
                size={16}
                color="rgba(255,255,255,0.8)"
              />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => onNavigateToTab('tourists')}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.quickActionGradient}>
              <View style={styles.quickActionIconContainer}>
                <Icon name="user-friends" size={24} color="#fff" />
              </View>
              <Text style={styles.quickActionText}>
                {t('admin.overview.manageTourists')}
              </Text>
              <Text style={styles.quickActionSubtext}>
                {t('admin.overview.manageTouristsDescription')}
              </Text>
              <Icon
                name="arrow-right"
                size={16}
                color="rgba(255,255,255,0.8)"
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Spacer */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },

  // Main Stats Cards
  mainStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    marginBottom: 24,
    gap: 12,
  },
  mainStatCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  mainStatNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  mainStatLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.95,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Section Styling
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },

  // Tour Guide Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  approvedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  suspendedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },

  // Activity Stats
  activityStatsContainer: {
    gap: 16,
  },
  activityStatCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  newUsersCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  onlineCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4AC6D0',
  },
  activityCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  activityIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityNumber: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  activitySubtext: {
    fontSize: 12,
    color: '#64748B',
    opacity: 0.8,
  },

  // Quick Actions
  quickActionsContainer: {
    gap: 16,
  },
  quickActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'flex-start',
    position: 'relative',
  },
  quickActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  quickActionSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
    lineHeight: 20,
  },

  bottomSpacer: {
    height: 20,
  },
});

export default OverviewTab;
