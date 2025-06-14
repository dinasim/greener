// Business/components/NotificationList.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const NotificationItem = ({ notification, onPress, onDismiss }) => {
  const getIconForType = (type) => {
    switch (type) {
      case 'WATERING_REMINDER':
        return { name: 'water', color: '#2196F3', library: 'MaterialCommunityIcons' };
      case 'LOW_STOCK_ALERT':
        return { name: 'package-variant', color: '#FF9800', library: 'MaterialCommunityIcons' };
      case 'WATERING_SUCCESS':
        return { name: 'check-circle', color: '#4CAF50', library: 'MaterialIcons' };
      default:
        return { name: 'notifications', color: '#216a94', library: 'MaterialIcons' };
    }
  };
  
  const icon = getIconForType(notification.type);
  const IconComponent = icon.library === 'MaterialIcons' ? MaterialIcons : MaterialCommunityIcons;
  
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <TouchableOpacity 
      style={[
        styles.notificationItem,
        notification.urgent && styles.urgentNotification
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIcon}>
        <IconComponent name={icon.name} size={24} color={icon.color} />
      </View>
      
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimestamp(notification.timestamp)}
          </Text>
        </View>
        
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        
        {notification.plantCount && (
          <View style={styles.notificationMeta}>
            <MaterialCommunityIcons name="leaf" size={14} color="#4CAF50" />
            <Text style={styles.metaText}>
              {notification.plantCount} plant{notification.plantCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        
        {notification.itemCount && (
          <View style={styles.notificationMeta}>
            <MaterialIcons name="inventory" size={14} color="#FF9800" />
            <Text style={styles.metaText}>
              {notification.itemCount} item{notification.itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.dismissButton}
        onPress={() => onDismiss(notification)}
      >
        <MaterialIcons name="close" size={20} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const NotificationList = ({ 
  notifications = [], 
  onNotificationPress, 
  onNotificationDismiss,
  emptyMessage = "No notifications",
  style 
}) => {
  const handleNotificationPress = (notification) => {
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };
  
  const handleNotificationDismiss = (notification) => {
    Alert.alert(
      'Dismiss Notification',
      'Are you sure you want to dismiss this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Dismiss', 
          style: 'default',
          onPress: () => {
            if (onNotificationDismiss) {
              onNotificationDismiss(notification);
            }
          }
        }
      ]
    );
  };
  
  const renderNotification = ({ item }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
      onDismiss={handleNotificationDismiss}
    />
  );
  
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="notifications-none" size={48} color="#e0e0e0" />
      <Text style={styles.emptyStateText}>{emptyMessage}</Text>
    </View>
  );
  
  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={notifications.length === 0 && styles.emptyContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notificationItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  urgentNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    backgroundColor: '#fff5f5',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
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
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});

export default NotificationList;