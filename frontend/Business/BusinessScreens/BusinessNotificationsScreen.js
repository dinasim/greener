// Business/BusinessScreens/BusinessNotificationsScreen.js - Business notification center
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessNotifications, markNotificationAsRead } from '../services/businessApi';

export default function BusinessNotificationsScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadNotifications();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the real API now
      const response = await getBusinessNotifications();
      
      if (response.success) {
        setNotifications(response.notifications || []);
        setUnreadCount(response.unreadCount || 0);
      } else {
        // If the API call fails, show the error message but don't crash
        console.error('Failed to load notifications:', response.error);
        setError('Failed to load notifications. Please try again.');
        
        // Use fallback data if available
        const cachedNotifs = await AsyncStorage.getItem('cached_notifications');
        if (cachedNotifs) {
          const parsed = JSON.parse(cachedNotifs);
          setNotifications(parsed.notifications || []);
          setUnreadCount(parsed.unreadCount || 0);
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setError('Failed to connect to notification service');
      
      // Fallback to cached data if available
      try {
        const cachedNotifs = await AsyncStorage.getItem('cached_notifications');
        if (cachedNotifs) {
          const parsed = JSON.parse(cachedNotifs);
          setNotifications(parsed.notifications || []);
          setUnreadCount(parsed.unreadCount || 0);
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      // Optimistic UI update
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Call API to mark as read
      await markNotificationAsRead(notificationId);
      
      // Cache the updated notifications
      const updatedNotifs = {
        notifications: notifications.map(n => n.id === notificationId ? {...n, read: true} : n),
        unreadCount: unreadCount - 1,
        timestamp: new Date().toISOString()
      };
      await AsyncStorage.setItem('cached_notifications', JSON.stringify(updatedNotifs));
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // The UI is already updated, so no need to revert unless we want to be very strict
    }
  };

  const markAllAsRead = async () => {
    try {
      // Optimistic UI update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      // Mark each notification as read
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(async (notification) => {
        try {
          await markNotificationAsRead(notification.id);
        } catch (error) {
          console.warn(`Failed to mark notification ${notification.id} as read:`, error);
        }
      }));
      
      // Cache the updated notifications
      const updatedNotifs = {
        notifications: notifications.map(n => ({...n, read: true})),
        unreadCount: 0,
        timestamp: new Date().toISOString()
      };
      await AsyncStorage.setItem('cached_notifications', JSON.stringify(updatedNotifs));
      
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionable) {
      switch (notification.action) {
        case 'view_inventory':
          navigation.navigate('BusinessInventoryScreen');
          break;
        case 'view_order':
          navigation.navigate('BusinessOrdersScreen');
          break;
        case 'view_watering':
          navigation.navigate('WateringChecklistScreen', { businessId });
          break;
        case 'view_reviews':
          navigation.navigate('BusinessReviewsScreen');
          break;
        case 'view_disease':
          navigation.navigate('DiseaseCheckerScreen');
          break;
        default:
          break;
      }
    }
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      inventory: 'inventory',
      order: 'shopping-cart',
      watering: 'water-drop',
      review: 'star',
      disease: 'bug-report',
      system: 'settings'
    };
    return iconMap[type] || 'notifications';
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'high') return '#F44336';
    if (priority === 'medium') return '#FF9800';
    
    const colorMap = {
      inventory: '#9C27B0',
      order: '#4CAF50',
      watering: '#2196F3',
      review: '#FF9800',
      disease: '#F44336',
      system: '#607D8B'
    };
    return colorMap[type] || '#666';
  };

  const getFilteredNotifications = () => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  };

  const renderNotificationItem = ({ item }) => {
    const iconColor = getNotificationColor(item.type, item.priority);
    const timeAgo = getTimeAgo(item.timestamp);

    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem,
          !item.read && styles.unreadItem
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <MaterialIcons name={getNotificationIcon(item.type)} size={24} color={iconColor} />
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>
              {item.title}
            </Text>
            <Text style={styles.timestamp}>{timeAgo}</Text>
          </View>
          
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          
          <View style={styles.notificationFooter}>
            <View style={[styles.priorityBadge, { backgroundColor: iconColor }]}>
              <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
            </View>
            {item.actionable && (
              <Text style={styles.actionHint}>Tap to view</Text>
            )}
          </View>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const filterOptions = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'inventory', label: 'Inventory', count: notifications.filter(n => n.type === 'inventory').length },
    { key: 'order', label: 'Orders', count: notifications.filter(n => n.type === 'order').length },
    { key: 'watering', label: 'Watering', count: notifications.filter(n => n.type === 'watering').length }
  ];

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} unread</Text>
          )}
        </View>
        <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
          <MaterialIcons name="done-all" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={filterOptions}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filter === item.key && styles.activeFilterTab
                ]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[
                  styles.filterTabText,
                  filter === item.key && styles.activeFilterTabText
                ]}>
                  {item.label}
                </Text>
                {item.count > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{item.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Notifications List */}
        <FlatList
          data={getFilteredNotifications()}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-outline" size={64} color="#e0e0e0" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyText}>
                {filter === 'unread' 
                  ? 'All caught up! No unread notifications.'
                  : 'You\'ll see business notifications here.'}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </Animated.View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  unreadCount: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
    marginTop: 2,
  },
  markAllButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  content: {
    flex: 1,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeFilterTab: {
    backgroundColor: '#4CAF50',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterTabText: {
    color: '#fff',
  },
  countBadge: {
    backgroundColor: '#FF5722',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  countText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  },
  unreadItem: {
    backgroundColor: '#f8fcff',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    color: '#1976D2',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  actionHint: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fff3f3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    margin: 16,
  },
  errorText: {
    color: '#f44336',
    fontWeight: '500',
    textAlign: 'center',
  },
});