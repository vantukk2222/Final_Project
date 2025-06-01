import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

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
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tabButton,
            activeTab === tab.key && styles.tabButtonActive,
          ]}
          onPress={() => onTabChange(tab.key as TabType)}>
          <Icon
            name={tab.icon}
            size={16}
            color={activeTab === tab.key ? '#fff' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === tab.key && styles.tabButtonTextActive,
            ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
});

export default TabNavigation;
