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

/**
 * Component to display a list of reviews
 * 
 * @param {Object} props - Component props
 * @param {string} props.targetType - Type of the review target ('user' or 'plant')
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

  // Load reviews when component mounts or when the target changes
  useEffect(() => {
    if (autoLoad && targetId && targetType) {
      loadReviews();
    }
  }, [targetId, targetType, autoLoad]);

  /**
   * Load reviews from the API
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

      const data = await fetchReviews(targetType, targetId);

      if (data) {
        setReviews(data.reviews || []);
        setAverageRating(data.averageRating || 0);
        setReviewCount(data.count || 0);

        // Notify parent component that reviews are loaded
        if (onReviewsLoaded) {
          onReviewsLoaded({
            averageRating: data.averageRating || 0,
            count: data.count || 0
          });
        }
      }

      setIsLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('Error loading reviews:', err);
      setError('Failed to load reviews. Please try again later.');
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
   * Render error state
   */
  const renderError = () => {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
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
        renderItem={({ item }) => <ReviewItem review={item} />}
        keyExtractor={item => item.id}
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