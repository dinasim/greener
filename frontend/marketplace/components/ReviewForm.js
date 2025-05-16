// components/ReviewForm.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { submitReview } from '../services/marketplaceApi';
import { colors, spacing, typography, borderRadius } from '../services/theme';

/**
 * Enhanced ReviewForm component with better error handling and user feedback
 * 
 * @param {Object} props - Component props
 * @param {string} props.targetId - ID of the target (seller or product)
 * @param {string} props.targetType - Type of target ('seller' or 'product')
 * @param {boolean} props.isVisible - Whether the form is visible
 * @param {Function} props.onClose - Callback when the form is closed
 * @param {Function} props.onReviewSubmitted - Callback when a review is successfully submitted
 */
const ReviewForm = ({
  targetId,
  targetType = 'seller',
  isVisible,
  onClose,
  onReviewSubmitted
}) => {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  /**
   * Reset the form to initial state
   */
  const resetForm = () => {
    setRating(5);
    setReviewText('');
    setError(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
  };

  /**
   * Handle form submission with comprehensive error handling
   */
  const handleSubmit = async () => {
    try {
      if (!reviewText.trim()) {
        setError('Please enter a review comment');
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setErrorDetails(null);

      // Log submission attempt
      console.log(`Submitting review for ${targetType} ${targetId}, rating: ${rating}`);

      const reviewData = {
        rating,
        text: reviewText.trim()
      };

      // Submit review using the updated API function
      const result = await submitReview(targetId, targetType, reviewData);
      console.log('Review submission result:', result);

      setIsSubmitting(false);

      if (result && result.success) {
        console.log('Review submitted successfully');
        resetForm();
        onClose();
        
        // Show success message
        Alert.alert(
          'Review Submitted',
          'Thank you for your feedback!',
          [{ text: 'OK' }]
        );
        
        // Notify parent component that a review was submitted
        if (onReviewSubmitted) {
          onReviewSubmitted(result.review);
        }
      } else {
        console.error('Review submission returned unsuccessful status', result);
        setError('Failed to submit review. Please try again.');
        setErrorDetails(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err.message || 'An error occurred. Please try again later.');
      setErrorDetails(err.stack || 'No additional details available');
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel button press
   */
  const handleCancel = () => {
    resetForm();
    onClose();
  };

  /**
   * Toggle error details visibility
   */
  const toggleErrorDetails = () => {
    setShowErrorDetails(!showErrorDetails);
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Write a Review
              </Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingLabel}>Rating:</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      style={styles.starButton}
                    >
                      <MaterialIcons
                        name={star <= rating ? 'star' : 'star-border'}
                        size={36}
                        color="#FFD700"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.inputLabel}>Your Review:</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  {errorDetails && (
                    <TouchableOpacity onPress={toggleErrorDetails} style={styles.detailsButton}>
                      <Text style={styles.detailsButtonText}>
                        {showErrorDetails ? 'Hide Details' : 'Show Details'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {showErrorDetails && (
                    <View style={styles.errorDetailsContainer}>
                      <Text style={styles.errorDetails}>{errorDetails}</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.helpText}>
                Your review helps others make better decisions. Be honest and specific.
              </Text>

              <View style={styles.targetInfo}>
                <Text style={styles.targetInfoText}>
                  Reviewing: <Text style={styles.targetInfoHighlight}>
                    {targetType === 'product' ? 'Product' : 'Seller'} {targetId}
                  </Text>
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (isSubmitting || !reviewText.trim()) && styles.disabledButton
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting || !reviewText.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  ratingContainer: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starButton: {
    padding: 5,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    height: 150,
    fontSize: 16,
  },
  errorContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFF2F2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
  },
  detailsButton: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  detailsButtonText: {
    color: '#666',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  errorDetailsContainer: {
    marginTop: 5,
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  errorDetails: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#666',
  },
  helpText: {
    marginTop: 15,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  targetInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
  },
  targetInfoText: {
    fontSize: 12,
    color: '#666',
  },
  targetInfoHighlight: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReviewForm;