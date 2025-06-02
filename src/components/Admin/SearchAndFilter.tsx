import React, {useRef, useCallback, useState, useEffect} from 'react';
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
  const searchInputRef = useRef<TextInput>(null);

  // Local state for immediate text updates
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Sync local state with prop when it changes externally
  useEffect(() => {
    if (searchQuery !== localSearchQuery) {
      setLocalSearchQuery(searchQuery);
    }
  }, [searchQuery]);

  // Handle immediate text change (no props dependency)
  const handleTextChange = useCallback((text: string) => {
    // Update local state immediately for responsive UI
    setLocalSearchQuery(text);

    // Debounce the callback to parent to avoid excessive calls
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      onSearchChange(text);
    }, 300); // 300ms debounce
  }, []); // NO dependencies - pure function

  // Handle filter change (no props dependency)
  const handleFilterChange = useCallback((filter: string) => {
    if (onFilterChange) {
      onFilterChange(filter);
    }
  }, []); // NO dependencies

  // Clear search
  const handleClear = useCallback(() => {
    setLocalSearchQuery('');
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    onSearchChange('');
  }, []); // NO dependencies

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={16} color="#666" style={styles.searchIcon} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#999"
          value={localSearchQuery} // Use local state
          onChangeText={handleTextChange} // Use local handler
          autoCorrect={false}
          autoCapitalize="none"
          textContentType="none"
          keyboardType="default"
          returnKeyType="search"
          blurOnSubmit={false}
          selectTextOnFocus={false}
          autoFocus={false}
          multiline={false}
          // Critical props for Android
          underlineColorAndroid="transparent"
          textAlignVertical="center"
        />

        {/* Clear button */}
        {localSearchQuery.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="times-circle" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter */}
      {filterOptions && filterOptions.length > 0 && (
        <View style={styles.filterContainer}>
          {filterOptions.map(filterOption => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                activeFilter === filterOption && styles.filterButtonActive,
              ]}
              onPress={() => handleFilterChange(filterOption)}
              activeOpacity={0.7}>
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

// Add display name for debugging
SearchAndFilter.displayName = 'SearchAndFilter';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FCFCFC',
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 12,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 0, // Remove vertical padding
    paddingHorizontal: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
    marginBottom: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#4AC6D0',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default React.memo(SearchAndFilter);
