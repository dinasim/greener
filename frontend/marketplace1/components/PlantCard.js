import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const PlantCard = ({ plant, showActions = true }) => {
  const navigation = useNavigation();

  const handleViewDetails = () => {
    navigation.navigate('PlantDetail', { plantId: plant.id });
  };

  const handleToggleFavorite = () => {
    // Add to favorites functionality
    // This would call your Azure Function
  };

  const handleStartChat = () => {
    navigation.navigate('Messages', { 
      sellerId: plant.sellerId,
      plantId: plant.id,
      plantName: plant.name
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={handleViewDetails}
    >
      <Image
        source={{ uri: plant.imageUrl || 'https://via.placeholder.com/150' }}
        style={styles.image}
        resizeMode="cover"
      />
      
      {/* Location pill */}
      <View style={styles.locationPill}>
        <MaterialIcons name="location-on" size={12} color="#fff" />
        <Text style={styles.locationText} numberOfLines={1}>
            {typeof plant.location === 'string'
            ? plant.location
            : plant.location && typeof plant.location === 'object'
            ? `Lat: ${plant.location.latitude.toFixed?.(2)}, Lng: ${plant.location.longitude.toFixed?.(2)}`
            : 'Local pickup'}
        </Text>

      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {plant.name}
        </Text>
        <Text style={styles.category} numberOfLines={1}>
          {plant.category}
        </Text>
        <Text style={styles.price}>${plant.price.toFixed(2)}</Text>
        
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {plant.sellerName}
          </Text>
          <Text style={styles.listingDate}>
            {plant.listedDate ? new Date(plant.listedDate).toLocaleDateString() : 'Recently listed'}
          </Text>
        </View>
        
        {showActions && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleToggleFavorite}
            >
              <MaterialIcons 
                name={plant.isFavorite ? "favorite" : "favorite-border"} 
                size={24} 
                color={plant.isFavorite ? "#f44336" : "#4CAF50"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleStartChat}
            >
              <MaterialIcons name="chat" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '45%',
  },
  image: {
    height: 150,
    width: '100%',
  },
  locationPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 3,
    maxWidth: 90,
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  sellerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  listingDate: {
    fontSize: 10,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
  },
});

export default PlantCard;