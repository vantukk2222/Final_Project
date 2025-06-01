import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  filterOptions?: string[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  filterOptions,
  activeFilter,
  onFilterChange,
}) => {
  return (
    <View style={{flex: 1, backgroundColor: '#FCFCFC'}}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={16} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      {/* Filter */}
      {filterOptions && activeFilter && onFilterChange && (
        <View style={styles.filterContainer}>
          {filterOptions.map(filterOption => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                activeFilter === filterOption && styles.filterButtonActive,
              ]}
              onPress={() => onFilterChange(filterOption)}>
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilter === filterOption &&
                    styles.filterButtonTextActive,
                ]}>
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default SearchAndFilter;
