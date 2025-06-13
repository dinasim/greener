// Business/BusinessScreens/WateringChecklistScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import REAL API services
import {
  getWateringChecklist,
  markPlantAsWatered,
  getBusinessWeather
} from '../services/businessWateringApi';

const WateringChecklistScreen = ({ navigation }) => {
  const [checklist, setChecklist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [weather, setWeather] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'needs-watering', 'overdue'
  const [sortBy, setSortBy] = useState('priority'); // 'priority', 'name', 'last-watered'

  // Load business ID on mount
  useEffect(() => {
    const loadBusinessId = async () => {
      const id = await AsyncStorage.getItem('businessId') || await AsyncStorage.getItem('userEmail');
      setBusinessId(id);
    };
    loadBusinessId();
  }, []);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (businessId) {
        loadWateringData();
      }
    }, [businessId])
  );

  const loadWateringData = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      console.log('📋 Loading watering checklist for business:', businessId);

      // Load checklist and weather in parallel
      const [checklistData, weatherData] = await Promise.all([
        getWateringChecklist(businessId),
        getBusinessWeather(businessId).catch(() => null) // Weather is optional
      ]);

      console.log('✅ Loaded checklist:', checklistData.totalCount, 'plants');
      
      setChecklist(checklistData.checklist || []);
      setWeather(weatherData);

    } catch (err) {
      console.error('❌ Error loading watering data:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWateringData(true);
  };

  const handleMarkWatered = async (plantId, plantName) => {
    try {
      console.log('💧 Marking plant as watered:', plantId);

      const result = await markPlantAsWatered(plantId, 'manual');
      
      console.log('✅ Plant marked as watered:', result);

      // Show success message
      Alert.alert(
        '✅ Plant Watered',
        `${plantName} has been marked as watered. Next watering due: ${result.nextWateringDue}`,
        [{ text: 'OK' }]
      );

      // Refresh the checklist
      loadWateringData(true);

    } catch (err) {
      console.error('❌ Error marking plant as watered:', err);
      Alert.alert(
        'Error',
        `Failed to mark plant as watered: ${err.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  const getFilteredAndSortedPlants = () => {
    let filtered = [...checklist];

    // Apply filter
    switch (selectedFilter) {
      case 'needs-watering':
        filtered = filtered.filter(plant => plant.needsWatering);
        break;
      case 'overdue':
        filtered = filtered.filter(plant => plant.overdueDays > 0);
        break;
      default: // 'all'
        break;
    }

    // Apply sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'last-watered':
        filtered.sort((a, b) => {
          if (!a.lastWatered && !b.lastWatered) return 0;
          if (!a.lastWatered) return 1;
          if (!b.lastWatered) return -1;
          return new Date(b.lastWatered).getTime() - new Date(a.lastWatered).getTime();
        });
        break;
      default: // 'priority'
        filtered.sort((a, b) => {
          // Overdue plants first, then needs watering, then others
          if (a.overdueDays > 0 && b.overdueDays <= 0) return -1;
          if (b.overdueDays > 0 && a.overdueDays <= 0) return 1;
          if (a.needsWatering && !b.needsWatering) return -1;
          if (b.needsWatering && !a.needsWatering) return 1;
          return b.overdueDays - a.overdueDays;
        });
        break;
    }

    return filtered;
  };

  const renderPlantItem = ({ item }) => {
    const priorityColor = item.overdueDays > 0 ? '#F44336' : 
                         item.needsWatering ? '#FF9800' : '#4CAF50';
    
    const statusIcon = item.overdueDays > 0 ? 'alert-circle' : 
                      item.needsWatering ? 'water-outline' : 'check-circle';

    return (
      <View style={[styles.plantItem, { borderLeftColor: priorityColor }]}>
        <View style={styles.plantInfo}>
          <View style={styles.plantHeader}>
            <MaterialCommunityIcons 
              name={statusIcon} 
              size={24} 
              color={priorityColor} 
            />
            <View style={styles.plantNames}>
              <Text style={styles.plantName}>{item.name}</Text>
              {item.scientificName ? (
                <Text style={styles.scientificName}>{item.scientificName}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.plantDetails}>
            {item.location && (item.location.section || item.location.aisle) ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="location-on" size={16} color="#666" />
                <Text style={styles.detailText}>
                  {[item.location.section, item.location.aisle, item.location.shelfNumber]
                    .filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="water" size={16} color="#666" />
              <Text style={styles.detailText}>
                Every {item.waterDays} days ({item.activeWaterDays} days left)
              </Text>
            </View>

            {item.lastWatered ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="history" size={16} color="#666" />
                <Text style={styles.detailText}>
                  Last watered: {new Date(item.lastWatered).toLocaleDateString()}
                </Text>
              </View>
            ) : null}

            {item.overdueDays > 0 ? (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="alert" size={16} color="#F44336" />
                <Text style={[styles.detailText, { color: '#F44336' }]}>
                  Overdue by {item.overdueDays} days
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.waterButton, { 
            backgroundColor: item.needsWatering ? priorityColor : '#E0E0E0'
          }]}
          onPress={() => handleMarkWatered(item.id, item.name)}
          disabled={!item.needsWatering}
        >
          <MaterialCommunityIcons 
            name="water" 
            size={20} 
            color={item.needsWatering ? '#FFFFFF' : '#999'} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {weather ? (
        <View style={styles.weatherCard}>
          <MaterialCommunityIcons name="weather-partly-cloudy" size={24} color="#4CAF50" />
          <View style={styles.weatherInfo}>
            <Text style={styles.weatherLocation}>{weather.location}</Text>
            <Text style={styles.weatherCondition}>
              {weather.temperature}°C, {weather.condition}
            </Text>
            {weather.rainToday ? (
              <Text style={styles.weatherNote}>
                🌧️ It rained today - some plants may not need watering
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{checklist.length}</Text>
          <Text style={styles.summaryLabel}>Total Plants</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, { color: '#FF9800' }]}>
            {checklist.filter(p => p.needsWatering).length}
          </Text>
          <Text style={styles.summaryLabel}>Need Watering</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, { color: '#F44336' }]}>
            {checklist.filter(p => p.overdueDays > 0).length}
          </Text>
          <Text style={styles.summaryLabel}>Overdue</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterButtons}>
          {['all', 'needs-watering', 'overdue'].map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive
              ]}>
                {filter === 'all' ? 'All' : 
                 filter === 'needs-watering' ? 'Need Water' : 'Overdue'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => {
            const options = [
              { text: 'Priority', value: 'priority' },
              { text: 'Name', value: 'name' },
              { text: 'Last Watered', value: 'last-watered' }
            ];
            // You could implement a picker here or cycle through options
            const currentIndex = options.findIndex(opt => opt.value === sortBy);
            const nextIndex = (currentIndex + 1) % options.length;
            setSortBy(options[nextIndex].value);
          }}
        >
          <MaterialIcons name="sort" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="sprout" size={64} color="#E0E0E0" />
      <Text style={styles.emptyTitle}>No Plants Found</Text>
      <Text style={styles.emptyText}>
        {selectedFilter === 'all' 
          ? 'Add plants to your inventory to see them here'
          : selectedFilter === 'needs-watering'
          ? 'No plants need watering right now'
          : 'No plants are overdue for watering'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading watering checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorTitle}>Unable to Load Checklist</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadWateringData()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filteredPlants = getFilteredAndSortedPlants();

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredPlants}
        renderItem={renderPlantItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        contentContainerStyle={filteredPlants.length === 0 ? styles.emptyListContainer : null}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    marginBottom: 16,
  },
  weatherInfo: {
    marginLeft: 12,
    flex: 1,
  },
  weatherLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  weatherCondition: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  weatherNote: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '500',
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryCard: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  sortButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
  },
  plantItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  plantInfo: {
    flex: 1,
    padding: 16,
  },
  plantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  plantNames: {
    marginLeft: 12,
    flex: 1,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scientificName: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  plantDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  waterButton: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default WateringChecklistScreen;