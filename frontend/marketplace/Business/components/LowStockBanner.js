// Business/components/LowStockBanner.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

export default function LowStockBanner({
  lowStockItems = [],
  onManageStock = () => {},
  onRestock = () => {},
  autoRefresh = true,
  refreshInterval = 30000
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);

  useEffect(() => {
    if (lowStockItems.length > 0 && isVisible) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
      // Pulse animation for urgency
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      
      pulseAnimation.start();
      
      // Auto-refresh if enabled
      if (autoRefresh) {
        refreshTimer.current = setInterval(() => {
          // Trigger parent refresh
          onManageStock();
        }, refreshInterval);
      }
      
      return () => {
        pulseAnimation.stop();
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    } else if (lowStockItems.length === 0) {
      // Exit animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [lowStockItems.length, isVisible, autoRefresh]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsVisible(false);
    });
  };

  const renderLowStockItem = ({ item, index }) => (
    <View style={styles.stockItem}>
      <View style={styles.stockItemHeader}>
        <MaterialCommunityIcons name="package-variant" size={16} color="#FF9800" />
        <Text style={styles.stockItemName} numberOfLines={1}>
          {item.title || item.name || item.common_name}
        </Text>
      </View>
      <View style={styles.stockItemDetails}>
        <Text style={styles.stockQuantity}>
          {item.quantity} left
        </Text>
        <Text style={styles.stockThreshold}>
          (min: {item.minThreshold})
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.restockButton}
        onPress={() => onRestock(item)}
      >
        <MaterialIcons name="add" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (!isVisible || lowStockItems.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: pulseAnim }
          ],
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.banner}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.bannerContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="warning" size={24} color="#FF9800" />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>Low Stock Alert</Text>
            <Text style={styles.subtitle}>
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need restocking
            </Text>
          </View>
          
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={handleDismiss}
            >
              <MaterialIcons name="close" size={18} color="#666" />
            </TouchableOpacity>
            
            <MaterialIcons 
              name={isExpanded ? "expand-less" : "expand-more"} 
              size={24} 
              color="#FF9800" 
            />
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Expanded Content */}
      <Animated.View
        style={[
          styles.expandedContent,
          {
            maxHeight: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 300],
            }),
            opacity: expandAnim,
          }
        ]}
      >
        <FlatList
          data={lowStockItems.slice(0, 5)} // Show max 5 items
          renderItem={renderLowStockItem}
          keyExtractor={(item, index) => item.id || `low-stock-${index}`}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
        
        <View style={styles.expandedActions}>
          <TouchableOpacity 
            style={styles.manageButton}
            onPress={onManageStock}
          >
            <MaterialIcons name="inventory" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Manage All Stock</Text>
          </TouchableOpacity>
          
          {lowStockItems.length > 5 && (
            <Text style={styles.moreItemsText}>
              +{lowStockItems.length - 5} more items
            </Text>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  banner: {
    padding: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F57C00',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  stockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stockItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stockItemName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  stockItemDetails: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  stockQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  stockThreshold: {
    fontSize: 12,
    color: '#666',
  },
  restockButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    marginVertical: 4,
  },
  expandedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 152, 0, 0.2)',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});