// components/ReviewsList.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ReviewItem from './ReviewItem';
import { fetchReviews } from '../services/marketplaceApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Component to display a list of reviews
 * 
 * @param {Object} props - Component props
 * @param {string} props.targetType - Type of the review target ('seller' or 'product')
 * @param {string} props.targetId - ID of the review target
 * @param {Function} props.onAddReview - Callback when the add review button is pressed
 * @param {Function} props.onReviewsLoaded - Callback when reviews are loaded, passing the average rating
 * @param {boolean} props.autoLoad - Whether to load reviews automatically (default: true)
 */
const ReviewsList = ({
  targetType,
  targetId,
  onAddReview,
  onReviewsLoaded,
  autoLoad = true,
}) => {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // Load current user on mount
  useEffect(() => {
    const getUser = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        setCurrentUser(email);
      } catch (err) {
        console.error('Error getting user email:', err);
      }
    };
    
    getUser();
  }, []);

  // Load reviews when component mounts or when the target changes
  useEffect(() => {
    if (autoLoad && targetId && targetType) {
      console.log(`Auto-loading reviews for ${targetType} ${targetId}`);
      loadReviews();
    }
  }, [targetId, targetType, autoLoad]);

  /**
   * Load reviews from the API with improved debugging
   */
  const loadReviews = async () => {
    if (!targetId || !targetType) {
      setError('Missing target information');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`[REVIEWSLIST] Fetching reviews for ${targetType} ${targetId}...`);
      const data = await fetchReviews(targetType, targetId);
      console.log(`[REVIEWSLIST] Reviews fetch response:`, data);

      if (data) {
        // Get current user to determine which reviews can be deleted
        const userEmail = await AsyncStorage.getItem('userEmail');
        
        // Mark reviews owned by the current user
        const processedReviews = (data.reviews || []).map(review => ({
          ...review,
          isOwnReview: review.userId === userEmail
        }));
        
        setReviews(processedReviews);
        setAverageRating(data.averageRating || 0);
        setReviewCount(data.count || 0);
        
        console.log(`[REVIEWSLIST] Loaded ${processedReviews.length} reviews with average rating ${data.averageRating || 0}`);
        console.log(`[REVIEWSLIST] Current user: ${userEmail}`);

        // Notify parent component that reviews are loaded
        if (onReviewsLoaded) {
          onReviewsLoaded({
            averageRating: data.averageRating || 0,
            count: data.count || 0
          });
        }
      } else {
        console.warn('[REVIEWSLIST] Review data is undefined or null');
      }

      setIsLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('[REVIEWSLIST] Error loading reviews:', err);
      setError(`Failed to load reviews: ${err.message}`);
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  /**
   * Handle review deletion
   */
  const handleDeleteReview = (reviewId) => {
    console.log(`[REVIEWSLIST] Handling delete for review ${reviewId}`);
    
    // Remove the review from the local state
    const updatedReviews = reviews.filter(r => r.id !== reviewId);
    setReviews(updatedReviews);
    
    // Update count
    setReviewCount(prevCount => Math.max(0, prevCount - 1));
    
    // Recalculate average rating
    if (updatedReviews.length > 0) {
      const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
      setAverageRating(totalRating / updatedReviews.length);
    } else {
      setAverageRating(0);
    }
    
    // Notify parent component of updated ratings
    if (onReviewsLoaded) {
      onReviewsLoaded({
        averageRating: updatedReviews.length > 0 
          ? updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length 
          : 0,
        count: updatedReviews.length
      });
    }
  };

  /**
   * Render the review count and average rating section
   */
  const renderReviewStats = () => {
    return (
      <View style={styles.statsContainer}>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(star => (
              <MaterialIcons
                key={star}
                name={star <= Math.round(averageRating) ? 'star' : 'star-border'}
                size={18}
                color="#FFD700"
              />
            ))}
          </View>
        </View>
        <Text style={styles.reviewCount}>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</Text>
      </View>
    );
  };

  /**
   * Render empty state when there are no reviews
   */
  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="rate-review" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No reviews yet</Text>
        <Text style={styles.emptySubtext}>Be the first to leave a review!</Text>
      </View>
    );
  };

  /**
   * Render loading state
   */
  const renderLoading = () => {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  };

  /**
   * Render error state with more details
   */
  const renderError = () => {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>
          targetType: {targetType}, targetId: {targetId}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReviews}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Main render logic
  if (isLoading && !refreshing && reviews.length === 0) {
    return renderLoading();
  }

  if (error && !refreshing && reviews.length === 0) {
    return renderError();
  }

  console.log(`[REVIEWSLIST] Rendering with targetType=${targetType}, targetId=${targetId}`);

  return (
    <View style={styles.container}>
      {/* Header section with stats and add button */}
      <View style={styles.header}>
        {renderReviewStats()}
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddReview}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Review</Text>
        </TouchableOpacity>
      </View>

      {/* Reviews list */}
      <FlatList
        data={reviews}
        renderItem={({ item }) => {
          console.log(`[REVIEWSLIST] Rendering review item: ${item.id}, isOwnReview=${item.isOwnReview}`);
          return (
            <ReviewItem 
              review={item} 
              targetType={targetType}
              targetId={targetId}
              onDelete={handleDeleteReview}
              onReviewDeleted={loadReviews}
            />
          );
        }}
        keyExtractor={item => item.id || `review-${item.userId}-${Date.now()}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statsContainer: {
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 8,
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#666',
    fontSize: 12,
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
    fontWeight: 'bold',
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ReviewsList;