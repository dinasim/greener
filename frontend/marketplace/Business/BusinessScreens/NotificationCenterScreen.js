// Business/BusinessScreens/NotificationCenterScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationList from '../components/NotificationList';
import { useNotificationManager } from '../components/NotificationManager';
import { getPendingNotifications } from '../services/notificationPollingApi';

export default function NotificationCenterScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // Use notification manager
  const {
    markAsRead,
    clearAllNotifications: clearManagerNotifications
  } = useNotificationManager(businessId, navigation);
  
  // Initialize
  useEffect(() => {
    const initialize = async () => {
      try {
        let id = businessId;
        if (!id) {
          id = await AsyncStorage.getItem('businessId');
          setBusinessId(id);
        }
        
        if (id) {
          await loadNotifications(id);
        }
      } catch (error) {
        console.error('Error initializing notification center:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [businessId]);
  
  // Load notifications
  const loadNotifications = async (id, silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }
    
    try {
      const data = await getPendingNotifications(id);
      setNotifications(data.notifications || []);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      if (!silent) {
        setRefreshing(false);
      }
    }
  };
  
  // Handle refresh
  const onRefresh = () => {
    if (businessId) {
      loadNotifications(businessId);
    }
  };
  
  // Handle notification press
  const handleNotificationPress = (notification) => {
    // Mark as read
    markAsRead(notification.id, notification.type);
    
    // Remove from local list
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    
    // Navigate based on action
    switch (notification.action) {
      case 'open_watering_checklist':
        navigation.navigate('WateringChecklistScreen', { businessId });
        break;
      case 'open_inventory':
        navigation.navigate('AddInventoryScreen', { 
          businessId, 
          showInventory: true,
          filter: 'lowStock' 
        });
        break;
      default:
        // No specific action
        break;
    }
  };
  
  // Handle notification dismiss
  const handleNotificationDismiss = (notification) => {
    // Mark as read
    markAsRead(notification.id, notification.type);
    
    // Remove from local list
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
  };
  
  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    clearManagerNotifications();
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Notifications</Text>
        
        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearAllNotifications}
            >
              <MaterialIcons name="clear-all" size={24} color="#4CAF50" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('NotificationSettingsScreen', { businessId })}
          >
            <MaterialIcons name="settings" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Summary */}
      {summary && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <MaterialIcons name="water-drop" size={16} color="#2196F3" />
            <Text style={styles.summaryText}>
              {summary.plantsNeedingWater} plants need watering
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <MaterialIcons name="inventory" size={16} color="#FF9800" />
            <Text style={styles.summaryText}>
              {summary.lowStockItems} low stock items
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
            <Text style={styles.summaryText}>
              {summary.plantsWateredToday} plants watered today
            </Text>
          </View>
        </View>
      )}
      
      {/* Notifications List */}
      <NotificationList
        notifications={notifications}
        onNotificationPress={handleNotificationPress}
        onNotificationDismiss={handleNotificationDismiss}
        emptyMessage="No notifications at this time"
        style={styles.notificationsList}
      />
      
      {/* Refresh Control */}
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={['#4CAF50']}
        tintColor="#4CAF50"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  summary: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  notificationsList: {
    flex: 1,
    padding: 16,
  },
});