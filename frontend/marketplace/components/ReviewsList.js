import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ReviewItem from './ReviewItem';
import { fetchReviews } from '../services/marketplaceApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RatingStars from './RatingStars';

/**
 * List of reviews with an inline header (stats + add button).
 * If ListHeaderComponent is provided, it will be rendered ABOVE the stats header,
 * so the whole screen scrolls as a single VirtualizedList.
 */
const ReviewsList = ({
  targetType,
  targetId,
  onAddReview,
  onReviewsLoaded,
  autoLoad = true,
  hideAddButton = false,
  ListHeaderComponent, // <-- parent can pass page header here
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

  // Auto-load reviews when target changes
  useEffect(() => {
    if (autoLoad && targetId && targetType) {
      loadReviews();
    }
  }, [targetId, targetType, autoLoad]);

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
        const userEmail = await AsyncStorage.getItem('userEmail');
        const processedReviews = (data.reviews || []).map((review) => ({
          ...review,
          isOwnReview: review.userId === userEmail,
        }));

        setReviews(processedReviews);
        const avg = Number(data.averageRating || 0);
        const cnt = Number(data.count || processedReviews.length || 0);
        setAverageRating(processedReviews.length ? avg : 0);
        setReviewCount(cnt);

        onReviewsLoaded?.({ averageRating: processedReviews.length ? avg : 0, count: cnt });
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const handleDeleteReview = (reviewId) => {
    const deletedReview = reviews.find((r) => r.id === reviewId);
    const updated = reviews.filter((r) => r.id !== reviewId);
    setReviews(updated);

    const newCount = Math.max(0, reviewCount - 1);
    setReviewCount(newCount);

    let newAverage = 0;
    if (updated.length > 0) {
      const totalRating = updated.reduce((sum, r) => sum + r.rating, 0);
      newAverage = totalRating / updated.length;
    }
    setAverageRating(newAverage);
    onReviewsLoaded?.({ averageRating: newAverage, count: newCount });
  };

  // --- Small render helpers --------------------------------------------------

  const renderStatsHeader = () => (
    <View style={styles.inlineHeader}>
      <View style={styles.statsContainer}>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
          <RatingStars rating={averageRating} size={18} />
        </View>
        <Text style={styles.reviewCount}>
          {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
        </Text>
      </View>

      {!hideAddButton &&
        !(
          currentUser &&
          (
            (targetType === 'seller' && currentUser === targetId) ||
            (targetType === 'product' && reviews.some((r) => r.userId === currentUser))
          )
        ) && (
          <TouchableOpacity style={styles.addButton} onPress={onAddReview}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Review</Text>
          </TouchableOpacity>
        )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="rate-review" size={48} color="#ccc" />
      <Text style={styles.emptyText}>No reviews yet</Text>
      <Text style={styles.emptySubtext}>Be the first to leave a review!</Text>
    </View>
  );

  if (isLoading && !refreshing && reviews.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  if (error && !refreshing && reviews.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReviews}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={reviews}
      keyExtractor={(item) => item.id || `review-${item.userId}-${item.createdAt || Math.random()}`}
      renderItem={({ item }) => (
        <ReviewItem
          review={item}
          targetType={targetType}
          targetId={targetId}
          onDelete={handleDeleteReview}
          onReviewDeleted={loadReviews}
        />
      )}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={styles.listContent}
      // SINGLE scroll container: parent header + stats+button are part of the list
      ListHeaderComponent={() => (
        <View>
          {ListHeaderComponent ? <ListHeaderComponent /> : null}
          {renderStatsHeader()}
        </View>
      )}
      ListFooterComponent={<View style={{ height: 16 }} />}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingBottom: 8,
  },

  // Inline (scrollable) header
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  statsContainer: { flex: 1 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  ratingValue: { fontSize: 24, fontWeight: 'bold', marginRight: 8, color: '#333' },
  reviewCount: { fontSize: 14, color: '#666', marginTop: 4 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  addButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },

  // States
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  loadingText: { marginTop: 8, color: '#666', fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  errorText: { marginTop: 8, color: '#f44336', fontSize: 16, textAlign: 'center', marginBottom: 8 },
  retryButton: { backgroundColor: '#4CAF50', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
  retryText: { color: '#fff', fontWeight: 'bold' },

  emptyContainer: { justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#fff' },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#666', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
});

export default ReviewsList;
