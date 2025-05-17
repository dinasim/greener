// components/RatingStars.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * RatingStars component - Displays a star rating
 * 
 * @param {Object} props Component props
 * @param {number} props.rating Rating value (0-5)
 * @param {number} props.size Size of stars (default: 16)
 * @param {string} props.color Color of filled stars (default: '#FFD700')
 * @param {string} props.emptyColor Color of empty stars (default: '#E0E0E0')
 * @param {boolean} props.showHalfStars Whether to show half stars (default: true)
 * @param {Object} props.style Additional styles for the container
 */
const RatingStars = ({
  rating = 0,
  size = 16,
  color = '#FFD700',
  emptyColor = '#E0E0E0',
  showHalfStars = true,
  style
}) => {
  // Round rating to nearest 0.5 if showing half stars, otherwise to nearest integer
  const roundedRating = showHalfStars
    ? Math.round(rating * 2) / 2
    : Math.round(rating);
  
  // Limit rating to 0-5 range
  const clampedRating = Math.min(Math.max(roundedRating, 0), 5);
  
  // Generate stars
  const renderStars = () => {
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
      // Determine icon name based on rating value
      let iconName = 'star-outline';
      
      if (i <= clampedRating) {
        iconName = 'star';
      } else if (showHalfStars && i - 0.5 <= clampedRating) {
        iconName = 'star-half';
      }
      
      stars.push(
        <MaterialIcons
          key={i}
          name={iconName}
          size={size}
          color={iconName === 'star-outline' ? emptyColor : color}
          style={styles.star}
        />
      );
    }
    
    return stars;
  };
  
  return (
    <View style={[styles.container, style]}>
      {renderStars()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: 2,
  },
});

export default RatingStars;