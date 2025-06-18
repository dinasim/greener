import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const NotificationPermissionGuide = ({ visible, onClose, permissionStatus }) => {
  const [showDetailedSteps, setShowDetailedSteps] = useState(false);

  const getGuideContent = () => {
    if (Platform.OS !== 'web') return null;

    switch (permissionStatus?.status) {
      case 'denied':
        return {
          title: '🔔 Notifications Are Blocked',
          message: 'Your browser has blocked notification permissions. You can reset this in your browser settings.',
          icon: 'bell-off',
          iconColor: '#f44336',
          steps: [
            {
              title: 'Quick Fix (Recommended)',
              steps: [
                '1. Look for the lock icon (🔒) or info icon (ℹ️) in your address bar',
                '2. Click on it to open site permissions',
                '3. Find "Notifications" and change it to "Allow"',
                '4. Refresh this page and try enabling notifications again'
              ]
            },
            {
              title: 'Alternative Method',
              steps: [
                '1. Go to Chrome Settings (⋮ menu → Settings)',
                '2. Navigate to Privacy and Security → Site Settings',
                '3. Click on "Notifications"',
                '4. Find this website in the "Not allowed" list',
                '5. Click on it and change to "Allow"',
                '6. Refresh this page'
              ]
            }
          ]
        };
      
      case 'default':
        return {
          title: '🔔 Enable Notifications',
          message: 'Allow notifications to receive plant care reminders and important updates.',
          icon: 'bell-outline',
          iconColor: '#2196F3',
          steps: [
            {
              title: 'How to Enable',
              steps: [
                '1. Click "Allow Notifications" button below',
                '2. When prompted by your browser, click "Allow"',
                '3. You\'ll start receiving helpful plant care reminders!'
              ]
            }
          ]
        };
      
      case 'unsupported':
        return {
          title: '❌ Notifications Not Supported',
          message: 'Your browser doesn\'t support push notifications.',
          icon: 'bell-remove',
          iconColor: '#9e9e9e',
          steps: [
            {
              title: 'What You Can Do',
              steps: [
                '• Try using a modern browser like Chrome, Firefox, or Safari',
                '• Make sure you\'re using the latest version of your browser',
                '• Check that you\'re accessing the site over HTTPS'
              ]
            }
          ]
        };
      
      default:
        return null;
    }
  };

  const content = getGuideContent();
  if (!content) return null;

  const handleTryAgain = () => {
    onClose();
    // Trigger permission request
    window.dispatchEvent(new CustomEvent('retryNotificationPermission'));
  };

  const handleOpenBrowserSettings = () => {
    Alert.alert(
      'Open Browser Settings',
      'We\'ll open your browser settings. Look for "Notifications" or "Site Settings".',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => {
            // Try to open Chrome settings
            if (window.chrome) {
              window.open('chrome://settings/content/notifications', '_blank');
            } else {
              // Fallback for other browsers
              Alert.alert(
                'Manual Steps',
                'Please manually open your browser settings and navigate to Privacy → Site Settings → Notifications'
              );
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons 
                name={content.icon} 
                size={48} 
                color={content.iconColor} 
              />
              <Text style={styles.title}>{content.title}</Text>
              <Text style={styles.message}>{content.message}</Text>
            </View>

            {/* Steps */}
            {content.steps.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.steps.map((step, stepIndex) => (
                  <View key={stepIndex} style={styles.stepContainer}>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Browser Detection */}
            {Platform.OS === 'web' && (
              <View style={styles.browserInfo}>
                <MaterialIcons name="info-outline" size={20} color="#2196F3" />
                <Text style={styles.browserText}>
                  Detected: {navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                           navigator.userAgent.includes('Firefox') ? 'Firefox' :
                           navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'} Browser
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {permissionStatus?.status === 'denied' && (
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton]} 
                  onPress={handleOpenBrowserSettings}
                >
                  <MaterialIcons name="settings" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Open Browser Settings</Text>
                </TouchableOpacity>
              )}
              
              {permissionStatus?.canRequest && (
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton]} 
                  onPress={handleTryAgain}
                >
                  <MaterialCommunityIcons name="bell-check" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Allow Notifications</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={onClose}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  {permissionStatus?.status === 'denied' ? 'Skip for Now' : 'Maybe Later'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>💡 Why Enable Notifications?</Text>
              <Text style={styles.helpText}>
                • Get reminders when your plants need watering{'\n'}
                • Receive alerts about low inventory{'\n'}
                • Stay updated on important business activities{'\n'}
                • Never miss critical plant care tasks
              </Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
    position: 'relative',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  stepContainer: {
    marginBottom: 8,
  },
  stepText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  browserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  browserText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#666',
    marginLeft: 0,
  },
  helpSection: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
});

export default NotificationPermissionGuide;