// screens/ProfileScreen-parts/ProfileHeader.js
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

const ProfileHeader = ({ 
  user, 
  onEditProfile,
  showEditButton = true
}) => {
  // Get avatar URL with fallback
  const getAvatarUrl = () => {
    if (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http')) {
      return user.avatar;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name?.charAt(0) || 'U')}&background=4CAF50&color=fff&size=200`;
  };

  return (
    <View style={styles.profileCard}>
      <Image source={{ uri: getAvatarUrl() }} style={styles.avatar} />
      <Text style={styles.userName}>{user.name}</Text>
      <Text style={styles.userEmail}>{user.email}</Text>
      <Text style={styles.joinDate}>
        Joined {user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
      </Text>
      {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
      
      {showEditButton && (
        <TouchableOpacity 
          style={styles.editProfileButton} 
          onPress={onEditProfile}
        >
          <Feather name="edit" size={16} color="#4CAF50" />
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: '#f0f9f3', 
    margin: 16, 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 6, 
    elevation: 4,
  },
  avatar: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    marginBottom: 12,
    backgroundColor: '#e0e0e0',
  },
  userName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  userEmail: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 2 
  },
  joinDate: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 2 
  },
  bio: { 
    marginTop: 10, 
    fontSize: 14, 
    color: '#555', 
    textAlign: 'center' 
  },
  editProfileButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12,
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    borderColor: '#4CAF50', 
    borderWidth: 1,
  },
  editProfileText: { 
    color: '#4CAF50', 
    marginLeft: 6, 
    fontWeight: '500' 
  },
});

export default ProfileHeader;