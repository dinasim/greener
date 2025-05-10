/**
 * ShareService.js - Centralized service for handling all app sharing functionality
 */
import { Share, Platform, Alert } from 'react-native';
// import analytics from './analytics'; // Uncomment if you have analytics setup

/**
 * Share a plant listing with enhanced options
 * @param {Object} plant - The plant object containing details
 * @param {Object} options - Additional share options
 * @returns {Promise} - The share result
 */
export const sharePlant = async (plant, options = {}) => {
  try {
    // Extract plant details with fallbacks
    const id = plant.id || plant._id;
    const name = plant.title || plant.name || 'Amazing plant';
    const price = typeof plant.price === 'number' 
      ? plant.price.toFixed(2) 
      : parseFloat(plant.price || 0).toFixed(2);
    const description = plant.description 
      ? (plant.description.length > 100 
         ? plant.description.substring(0, 100) + '...' 
         : plant.description)
      : 'Check out this amazing plant!';
    const category = plant.category || 'Plants';
    const location = plant.city || (plant.location?.city || plant.location) || 'Local pickup';
    const seller = plant.sellerName || plant.seller?.name || 'a trusted seller';
    
    // Create links for different platforms
    const appURL = Platform.OS === 'ios' 
      ? `greenerapp://plants/${id}` 
      : `https://greenerapp.com/plants/${id}`;
      
    // Support custom message or use default
    const message = options.message || createDefaultShareMessage({
      name, price, description, category, location, seller
    });
    
    // Support custom title or use default
    const title = options.title || `Greener: ${name}`;
    
    // Define share options
    const shareOptions = {
      title,
      message,
      url: appURL,
    };
    
    // Platform specific options
    const platformOptions = {
      // iOS options
      dialogTitle: options.dialogTitle || 'Share This Plant With Friends',
      // Android options
      subject: options.subject || `Check out this ${name} on Greener!`,
      tintColor: '#4CAF50',
      excludedActivityTypes: options.excludedActivityTypes || [
        'com.apple.UIKit.activity.Print',
        'com.apple.UIKit.activity.AssignToContact',
      ],
    };
    
    // Execute share
    const result = await Share.share(shareOptions, platformOptions);
    
    // Track sharing events if needed
    if (result.action === Share.sharedAction) {
      // Optional: Track in analytics 
      // analytics.trackEvent('plant_shared', { 
      //   plantId: id, 
      //   platform: result.activityType || 'unknown' 
      // });
      
      // If you need to perform an action after sharing
      if (options.onShareComplete) {
        options.onShareComplete(result);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error sharing plant:', error);
    
    if (options.showErrorAlert !== false) {
      Alert.alert(
        'Sharing Failed', 
        'Could not share this plant. Please try again later.',
        [{ text: 'OK' }]
      );
    }
    
    throw error;
  }
};

/**
 * Share user profile
 * @param {Object} user - User profile to share
 * @param {Object} options - Additional options
 */
export const shareUserProfile = async (user, options = {}) => {
  try {
    const name = user.name || 'Greener User';
    const id = user.id || user._id;
    const appURL = Platform.OS === 'ios' 
      ? `greenerapp://users/${id}` 
      : `https://greenerapp.com/users/${id}`;
    
    // Profile specific message
    const message = options.message || 
      `👤 Check out ${name}'s plant collection on Greener!\n\n` +
      `🌱 Browse through their listings and discover amazing plants.\n\n` +
      `Download the Greener app to connect with plant enthusiasts!`;
    
    const result = await Share.share(
      {
        title: `${name}'s Greener Profile`,
        message,
        url: appURL
      },
      {
        dialogTitle: 'Share Profile',
        subject: `Check out ${name}'s plant collection on Greener!`,
      }
    );
    
    return result;
  } catch (error) {
    console.error('Error sharing profile:', error);
    
    if (options.showErrorAlert !== false) {
      Alert.alert('Error', 'Could not share this profile');
    }
    
    throw error;
  }
};

/**
 * Share app invitation
 */
export const shareAppInvitation = async () => {
  try {
    const message = 
      "🌱 I'm using Greener to buy and sell plants!\n\n" +
      "It's a great community for plant enthusiasts. Join me on Greener!\n\n" +
      "Download now: https://greenerapp.com/download";
    
    await Share.share(
      {
        title: 'Join me on Greener!',
        message,
      },
      {
        dialogTitle: 'Invite Friends to Greener',
        subject: 'Join me on Greener - The Plant Marketplace App',
      }
    );
  } catch (error) {
    console.error('Error sharing app invitation:', error);
    Alert.alert('Error', 'Could not share app invitation');
  }
};

/**
 * Create default formatted share message for plants
 * @param {Object} details - Plant details
 * @returns {String} - Formatted message
 */
const createDefaultShareMessage = ({ name, price, description, category, location, seller }) => {
  return (
    `🌿 ${name} - $${price} 🌿\n\n` +
    `${description}\n\n` +
    `📋 Details:\n` +
    `🏷️ Category: ${category}\n` +
    `📍 Location: ${location}\n` +
    `👤 Seller: ${seller}\n\n` +
    `💬 Get the Greener app to browse more amazing plants!`
  );
};

export default {
  sharePlant,
  shareUserProfile,
  shareAppInvitation
};