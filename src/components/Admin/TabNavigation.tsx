import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';

type TabType = 'overview' | 'guides' | 'tourists';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    {key: 'overview', label: 'Overview', icon: 'chart-bar'},
    {key: 'guides', label: 'Tour Guides', icon: 'user-tie'},
    {key: 'tourists', label: 'Tourists', icon: 'user-friends'},
  ] as const;

  return (
    <View style={styles.container}>
      <View style={styles.tabsWrapper}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButtonContainer}
            onPress={() => onTabChange(tab.key as TabType)}
            activeOpacity={0.8}>
            {activeTab === tab.key ? (
              <LinearGradient
                colors={['#4AC6D0', '#3BB8C3']}
                style={[styles.tabButton, styles.tabButtonActive]}>
                <View style={styles.tabContent}>
                  <View style={styles.activeIconContainer}>
                    <Icon name={tab.icon} size={14} color="#fff" />
                  </View>
                  <Text style={styles.tabButtonTextActive}>{tab.label}</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.tabButton}>
                <View style={styles.tabContent}>
                  <Icon name={tab.icon} size={14} color="#64748B" />
                  <Text style={styles.tabButtonText}>{tab.label}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonContainer: {
    flex: 1,
    marginHorizontal: 2,
  },
  tabButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabButtonActive: {
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  activeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
    textAlign: 'center',
  },
  tabButtonTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});

export default TabNavigation;
