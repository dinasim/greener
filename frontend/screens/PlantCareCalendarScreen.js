import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import PlantCareCalendar from '../components/PlantCareCalendar';

const API_URL = 'https://usersfunctions.azurewebsites.net/api/getalluserplants';
const MARK_TASK_API = 'https://usersfunctions.azurewebsites.net/api/markTaskDone';

export default function PlantCareCalendarScreen({ navigation }) {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(null);

  // Load plants data
  const loadPlants = useCallback(async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem('userEmail');
      setUserEmail(email);
      
      if (!email) {
        setPlants([]);
        return;
      }

      const response = await fetch(`${API_URL}?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Failed to fetch plants');
      
      const data = await response.json();
      
      // Flatten the location-grouped data into a single plants array
      let allPlants = [];
      if (Array.isArray(data)) {
        data.forEach(locationObj => {
          if (locationObj.plants && Array.isArray(locationObj.plants)) {
            locationObj.plants.forEach(plant => {
              allPlants.push({
                ...plant,
                location: plant.location || locationObj.location
              });
            });
          }
        });
      }
      
      setPlants(allPlants);
      console.log('📅 Loaded', allPlants.length, 'plants for calendar');
      
    } catch (error) {
      console.error('Error loading plants:', error);
      Alert.alert('Error', 'Failed to load plants. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadPlants();
    }, [loadPlants])
  );

  // Handle task completion
  const handleTaskComplete = async (task) => {
    try {
      console.log('✅ Completing task:', task);
      
      if (!userEmail) {
        throw new Error('User email not found');
      }

      const response = await fetch(MARK_TASK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          plantId: task.plantId,
          taskType: task.type, // 'water', 'feed', 'repot'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to mark task as complete: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Task completed successfully:', result);
      
      // Reload plants to get updated schedules
      await loadPlants();
      
    } catch (error) {
      console.error('Error completing task:', error);
      throw error; // Re-throw so calendar can handle it
    }
  };

  const getStats = () => {
    const today = new Date();
    const todayStr = today.toDateString();
    
    let todayTasks = 0;
    let overdueTasks = 0;
    let upcomingTasks = 0;

    plants.forEach(plant => {
      // Check water schedule
      if (plant.next_water) {
        const waterDate = new Date(plant.next_water);
        if (waterDate.toDateString() === todayStr) {
          todayTasks++;
        } else if (waterDate < today) {
          overdueTasks++;
        } else if (waterDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          upcomingTasks++;
        }
      }

      // Check feed schedule
      if (plant.next_feed) {
        const feedDate = new Date(plant.next_feed);
        if (feedDate.toDateString() === todayStr) {
          todayTasks++;
        } else if (feedDate < today) {
          overdueTasks++;
        } else if (feedDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          upcomingTasks++;
        }
      }

      // Check repot schedule
      if (plant.next_repot) {
        const repotDate = new Date(plant.next_repot);
        if (repotDate.toDateString() === todayStr) {
          todayTasks++;
        } else if (repotDate < today) {
          overdueTasks++;
        } else if (repotDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          upcomingTasks++;
        }
      }
    });

    return { todayTasks, overdueTasks, upcomingTasks };
  };

  const stats = getStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your plant care schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Plant Care Calendar</Text>
          <Text style={styles.headerSubtitle}>
            Track and manage your plant care schedule
          </Text>
        </View>

        <TouchableOpacity
          onPress={loadPlants}
          style={styles.refreshButton}
        >
          <MaterialIcons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { borderLeftColor: '#4CAF50' }]}>
          <MaterialCommunityIcons name="calendar-today" size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.todayTasks}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#FF9800' }]}>
          <MaterialCommunityIcons name="calendar-clock" size={24} color="#FF9800" />
          <Text style={styles.statNumber}>{stats.upcomingTasks}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#F44336' }]}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#F44336" />
          <Text style={styles.statNumber}>{stats.overdueTasks}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Calendar */}
      {plants.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-blank" size={64} color="#E0E0E0" />
          <Text style={styles.emptyTitle}>No Plants Found</Text>
          <Text style={styles.emptySubtitle}>
            Add some plants to see your care schedule
          </Text>
          <TouchableOpacity
            style={styles.addPlantsButton}
            onPress={() => navigation.navigate('AddPlant')}
          >
            <Text style={styles.addPlantsButtonText}>Add Your First Plant</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <PlantCareCalendar
          plants={plants}
          onTaskComplete={handleTaskComplete}
          onRefresh={loadPlants}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }
    })
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  addPlantsButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  addPlantsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});