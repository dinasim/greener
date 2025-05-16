import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';

const ReviewItem = ({
  review,
  onDelete,
  targetType = 'seller',
  targetId,
  onReviewDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const handleDelete = () => {
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);

      if (!review.id || !targetType || !targetId) {
        throw new Error('Missing required parameters');
      }

      const userEmail = await AsyncStorage.getItem('userEmail');
      const token = await AsyncStorage.getItem('googleAuthToken');
      if (!userEmail) throw new Error('User email not found');

      const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
      const endpoint = `marketplace/reviews/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/${encodeURIComponent(review.id)}`;
      const fullUrl = `${API_BASE_URL}/${endpoint}`;

      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers,
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        const text = await response.text();
        responseData = { success: response.ok, message: text };
      }

      setIsDeleting(false);

      if (response.ok) {
        if (onDelete) onDelete(review.id);
        if (onReviewDeleted) onReviewDeleted();
      } else {
        throw new Error(`Delete failed: ${responseData.message}`);
      }
    } catch (error) {
      console.error('[REVIEW_ITEM] Error deleting review:', error);
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.userName}>{review.userName || 'Anonymous'}</Text>
          <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
        </View>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <MaterialIcons
              key={star}
              name={star <= review.rating ? 'star' : 'star-border'}
              size={16}
              color="#FFD700"
            />
          ))}
        </View>
      </View>

      <Text style={styles.reviewText}>{review.text}</Text>

      {review.isOwnReview && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#f44336" />
            ) : (
              <>
                <MaterialIcons name="delete" size={16} color="#f44336" />
                <Text style={styles.deleteText}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal isVisible={showConfirmModal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Delete Review</Text>
          <Text style={styles.modalText}>
            Are you sure you want to delete this review? This action cannot be undone.
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              onPress={() => setShowConfirmModal(false)}
              style={styles.modalCancel}
            >
              <Text style={{ color: '#555' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowConfirmModal(false);
                confirmDelete();
              }}
              style={styles.modalDelete}
            >
              <Text style={{ color: '#f44336' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 12,
    padding: 4,
  },
  deleteText: {
    color: '#f44336',
    marginLeft: 4,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancel: {
    marginRight: 10,
    padding: 8,
  },
  modalDelete: {
    padding: 8,
  },
});

export default ReviewItem;
