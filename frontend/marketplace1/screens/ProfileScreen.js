import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Import context
import { useForm } from '../../context/FormContext';

// Import API services
import { fetchUserProfile } from '../services/marketplaceApi';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, signOut } = useContext(AuthContext);
  
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadProfile();
  }, []);
  
  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // User info should already be in context, but you might want
      // to fetch extended profile info from your API
      const profileData = await fetchUserProfile();
      setProfile(profileData);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data');
      setIsLoading(false);
    }
  };
  
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: signOut,
          style: 'destructive',
        },
      ]
    );
  };
  
  // Getting user info from the context, as received from Google Sign-In
  const userInfo = user || {};
  const displayName = userInfo.name || 'User';
  const email = userInfo.email || '';
  const photoUrl = userInfo.picture || null;
  
  // Extended profile info from your API
  const profileInfo = profile || {};
  
  // Get display data, falling back to defaults or Google data
  const userDisplayName = profileInfo.displayName || displayName;
  const userAvatar = profileInfo.avatarUrl || photoUrl;
  const userBio = profileInfo.bio || '';
  const joinDate = profileInfo.joinDate || new Date().toISOString();
  
  const menuItems = [
    {
      icon: 'eco',
      label: 'My Plants',
      onPress: () => navigation.navigate('MyPlants'),
      badge: profileInfo.plantsCount || 0,
    },
    {
      icon: 'favorite',
      label: 'Saved Plants',
      onPress: () => navigation.navigate('Favorites'),
      badge: profileInfo.favoritesCount || 0,
    },
    {
      icon: 'history',
      label: 'History',
      onPress: () => {
        // Navigate to history screen
      },
    },
    {
      icon: 'settings',
      label: 'Settings',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      icon: 'help-outline',
      label: 'Help & Support',
      onPress: () => {
        // Navigate to help screen
      },
    },
  ];
  
  if (isLoading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.coverContainer}>
          <Image
            source={require('../../assets/images/profile-cover.jpg')}
            style={styles.coverImage}
          />
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Feather name="edit-2" size={16} color="#fff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.avatarContainer}>
          <Image
            source={userAvatar ? { uri: userAvatar } : require('../../assets/images/default-avatar.png')}
            style={styles.avatar}
          />
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userDisplayName}</Text>
            <Text style={styles.userEmail}>{email}</Text>
            <Text style={styles.joinDate}>
              Joined {new Date(joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>
        
        {userBio ? (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>{userBio}</Text>
          </View>
        ) : null}
      </View>
      
      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuItemLeft}>
              <MaterialIcons name={item.icon} size={24} color="#4CAF50" />
              <Text style={styles.menuItemLabel}>{item.label}</Text>
            </View>
            
            {item.badge ? (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : (
              <MaterialIcons name="chevron-right" size={24} color="#ccc" />
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <MaterialIcons name="logout" size={20} color="#f44336" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
      
      {/* Version Info */}
      <Text style={styles.versionText}>Greener v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
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
  profileHeader: {
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  coverContainer: {
    height: 150,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  avatarContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
    marginTop: -40,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  joinDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  badgeContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginVertical: 16,
    paddingVertical: 16,
  },
  signOutText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginBottom: 24,
  },
});

export default ProfileScreen;