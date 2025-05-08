import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Components
import PlantCard from '../components/PlantCard';

// API Services
import { fetchFavorites, toggleFavoritePlant } from '../services/marketplaceApi';

const FavoritesScreen = () => {
  const navigation = useNavigation();
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadFavorites();
  }, []);
  
  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchFavorites();
      setFavorites(data);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load favorites. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching favorites:', err);
    }
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadFavorites();
    setIsRefreshing(false);
  };
  
  const handleRemoveFavorite = async (plantId) => {
    try {
      // Update UI optimistically
      setFavorites(favorites.filter(plant => plant.id !== plantId));
      
      // Call API to remove from favorites
      await toggleFavoritePlant(plantId);
    } catch (err) {
      // Revert if API call fails
      console.error('Error removing favorite:', err);
      loadFavorites(); // Reload to get accurate state
    }
  };
  
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your saved plants...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadFavorites}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (favorites.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="favorite-border" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No saved plants yet</Text>
        <Text style={styles.emptySubtext}>
          Plants you save will appear here
        </Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.navigate('Marketplace')}
        >
          <Text style={styles.browseButtonText}>Browse Plants</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const renderFavoriteItem = ({ item }) => (
    <View style={styles.favoriteItemContainer}>
      <PlantCard plant={item} showActions={false} />
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Messages', { 
            sellerId: item.sellerId,
            plantId: item.id,
            plantName: item.name
          })}
        >
          <MaterialIcons name="chat" size={20} color="#4CAF50" />
          <Text style={styles.actionButtonText}>Message</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => handleRemoveFavorite(item.id)}
        >
          <MaterialIcons name="delete" size={20} color="#f44336" />
          <Text style={[styles.actionButtonText, styles.removeButtonText]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        renderItem={renderFavoriteItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        numColumns={1}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  listContainer: {
    padding: 12,
  },
  favoriteItemContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: '500',
    color: '#4CAF50',
  },
  removeButton: {
    backgroundColor: '#ffebee',
  },
  removeButtonText: {
    color: '#f44336',
  },
});

export default FavoritesScreen;