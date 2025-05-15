import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import PlantCard from '../components/PlantCard';
import { fetchUserProfile } from '../services/marketplaceApi';

const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const sellerId = route.params?.sellerId || 'user123';

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants');

  useEffect(() => { loadSellerProfile(); }, [sellerId]);

  const loadSellerProfile = async () => {
    try {
      setIsLoading(true);
      const data = await fetchUserProfile(sellerId);
      setUser(data.user);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  const renderTabContent = () => {
    const listings = user?.listings || [];
    const filtered = listings.filter(p => (activeTab === 'myPlants' ? p.status === 'active' : p.status === 'sold'));
    if (filtered.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialIcons name={activeTab === 'myPlants' ? 'eco' : 'local-offer'} size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>
            {activeTab === 'myPlants' ? 'This seller has no active listings' : 'No sold plants yet'}
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={filtered}
        renderItem={({ item }) => <PlantCard plant={item} showActions={false} />}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.plantGrid}
      />
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSellerProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerWrapper}>
        <Image source={require('../../assets/images/plant-banner.jpg')} style={styles.banner} />
        <View style={styles.avatarSection}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.join}>Joined {new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</Text>
          </View>
        </View>
      </View>

      {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

      <View style={styles.statsRow}>
        <View style={styles.statBox}><Text style={styles.statNum}>{user.stats.plantsCount}</Text><Text style={styles.statLabel}>Listings</Text></View>
        <View style={styles.statBox}><Text style={styles.statNum}>{user.stats.salesCount}</Text><Text style={styles.statLabel}>Sold</Text></View>
        <View style={styles.statBox}><Text style={styles.statNum}>{user.stats.rating}</Text><Text style={styles.statLabel}>Rating</Text></View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'myPlants' && styles.activeTab]} onPress={() => setActiveTab('myPlants')}>
          <MaterialIcons name="eco" size={22} color={activeTab === 'myPlants' ? '#4CAF50' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'myPlants' && styles.activeTabText]}>My Plants</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'sold' && styles.activeTab]} onPress={() => setActiveTab('sold')}>
          <MaterialIcons name="local-offer" size={22} color={activeTab === 'sold' ? '#4CAF50' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'sold' && styles.activeTabText]}>Sold</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrapper}>{renderTabContent()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#f44336', textAlign: 'center', marginVertical: 10 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#4CAF50', borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: '600' },
  headerWrapper: { backgroundColor: '#f0f0f0' },
  banner: { width: '100%', height: 120 },
  avatarSection: { flexDirection: 'row', marginTop: -40, padding: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff', backgroundColor: '#ddd' },
  nameBlock: { marginLeft: 16, justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '700', color: '#222' },
  email: { color: '#555' },
  join: { color: '#888', fontSize: 12 },
  bio: { paddingHorizontal: 16, marginVertical: 8, fontSize: 14, color: '#444', fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  statBox: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#4CAF50' },
  statLabel: { fontSize: 12, color: '#666' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTab: { borderBottomWidth: 2, borderColor: '#4CAF50' },
  tabText: { fontSize: 14, color: '#666' },
  activeTabText: { color: '#4CAF50', fontWeight: '600' },
  contentWrapper: { flex: 1, padding: 8 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },
  plantGrid: { paddingBottom: 80 },
});

export default SellerProfileScreen;