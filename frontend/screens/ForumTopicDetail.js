import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Image, Animated } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ToastMessage from '../marketplace/components/ToastMessage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Avatar({ name, size = 36, uri }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e0e0e0' }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: size * 0.5 }}>{getInitials(name)}</Text>
    </View>
  );
}

// Add these helpers (copy from PlantCareForumScreen)
const categories = [
  { id: 'general', name: 'General Care', icon: 'leaf' },
  { id: 'disease', name: 'Plant Diseases', icon: 'medical-bag' },
  { id: 'pests', name: 'Pest Control', icon: 'bug' },
  { id: 'watering', name: 'Watering', icon: 'water' },
  { id: 'lighting', name: 'Lighting', icon: 'white-balance-sunny' },
  { id: 'fertilizer', name: 'Fertilizing', icon: 'nutrition' },
  { id: 'repotting', name: 'Repotting', icon: 'pot-mix' },
  { id: 'indoor', name: 'Indoor Plants', icon: 'home' },
  { id: 'outdoor', name: 'Outdoor Plants', icon: 'tree' },
];
function getCategoryDisplayName(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  return category ? category.name : 'General';
}
function getCategoryIcon(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  return category ? category.icon : 'leaf';
}

export default function ForumTopicDetail({ route, navigation }) {
  const { topicId, topic: initialTopic, category } = route.params || {};
  const [topic, setTopic] = useState(initialTopic || null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [deleteReplyConfirm, setDeleteReplyConfirm] = useState({ visible: false, replyId: null, category: null });
  const [deletingReply, setDeletingReply] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const likeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchTopicAndReplies();
    AsyncStorage.getItem('userEmail').then(email => setUserEmail(email || ''));
  }, [topicId]);

  const fetchTopicAndReplies = async () => {
    setLoading(true);
    try {
      // Fetch topic
      let topicData = topic;
      if (!topicData) {
        const topicRes = await fetch(`${API_BASE_URL}/plant-care-forum?topicId=${encodeURIComponent(topicId)}`);
        if (topicRes.ok) {
          const data = await topicRes.json();
          topicData = data.topic || data;
        }
      }
      setTopic(topicData);
      // Fetch replies (ensure both topicId and category are sent)
      const replyCategory = topicData?.category || category;
      const repliesRes = await fetch(`${API_BASE_URL}/forum-replies?topicId=${encodeURIComponent(topicId)}&category=${encodeURIComponent(replyCategory)}`);
      if (repliesRes.ok) {
        const data = await repliesRes.json();
        setReplies(data.replies || data);
      } else {
        setReplies([]);
      }
    } catch (err) {
      showToast('Failed to load topic or replies.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePostReply = async () => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const author = await AsyncStorage.getItem('userEmail') || 'Anonymous User';
      const replyCategory = topic?.category || category;
      // Get userType for authorType
      const authorType = (await AsyncStorage.getItem('userType')) === 'business' ? 'business owner' : 'customer';
      const res = await fetch(`${API_BASE_URL}/forum-replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          content: replyText,
          author,
          category: replyCategory,
          authorType
        })
      });
      if (res.ok) {
        setReplyText('');
        fetchTopicAndReplies();
      } else {
        showToast('Failed to post reply.', 'error');
      }
    } catch (err) {
      showToast('Failed to post reply.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = () => {
    setLikeAnimating(true);
    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(likeAnim, { toValue: 1, duration: 120, useNativeDriver: true })
    ]).start(() => setLikeAnimating(false));
    // TODO: Implement like API call if available
  };

  // Delete reply handler
  const deleteReply = (replyId, category) => {
    setDeleteReplyConfirm({ visible: true, replyId, category });
  };
  const confirmDeleteReply = async () => {
    const { replyId, category } = deleteReplyConfirm;
    setDeleteReplyConfirm({ visible: false, replyId: null, category: null });
    try {
      const response = await fetch(`${API_BASE_URL}/forum-replies?replyId=${encodeURIComponent(replyId)}&category=${encodeURIComponent(category)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete reply');
      }
      setReplies(prev => prev.filter(r => r.id !== replyId));
      showToast('Reply deleted successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete reply.', 'error');
    }
  };
  const cancelDeleteReply = () => setDeleteReplyConfirm({ visible: false, replyId: null, category: null });

  const showToast = (message, type = 'info') => setToast({ visible: true, message, type });
  const hideToast = () => setToast(prev => ({ ...prev, visible: false }));

  if (loading) {
    return (
      <View style={styles.centered}><ActivityIndicator size="large" color="#4CAF50" /></View>
    );
  }
  if (!topic) {
    return (
      <View style={styles.centered}><Text>Topic not found.</Text></View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Go Back Arrow */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={28} color="#205d29" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 90 }}>
          {/* Topic Card */}
          <View style={styles.topicCard}>
            <View style={styles.topicHeader}>
              <Avatar name={topic.author} size={44} uri={topic.authorAvatar} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>{topic.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={styles.author}>{topic.author || 'Anonymous'}</Text>
                  <MaterialCommunityIcons name="circle-small" size={18} color="#bbb" />
                  <Text style={styles.metaText}>{new Date(topic.timestamp).toLocaleString()}</Text>
                </View>
              </View>
              {/* Removed like/upvote for main topic */}
            </View>
            <Text style={styles.content}>{topic.content}</Text>
            <View style={styles.topicMetaRow}>
              <View style={styles.topicMetaItem}>
                <MaterialCommunityIcons name="comment-multiple-outline" size={16} color="#888" />
                <Text style={styles.metaText}>{replies.length} Replies</Text>
              </View>
              {topic.category && (
                <View style={styles.categoryBadgeSmall}>
                  <MaterialCommunityIcons 
                    name={getCategoryIcon(topic.category)} 
                    size={12} 
                    color="#4CAF50" 
                  />
                  <Text style={styles.categoryText}>{getCategoryDisplayName(topic.category)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Replies Section */}
          <Text style={styles.repliesHeader}>Replies</Text>
          {replies.length === 0 ? (
            <Text style={styles.noReplies}>No replies yet. Be the first to reply!</Text>
          ) : (
            replies.map((reply, idx) => (
              <View key={reply.id || idx} style={styles.replyCard}>
                <View style={styles.replyHeader}>
                  <Avatar name={reply.author} size={32} uri={reply.authorAvatar} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.replyAuthor}>{reply.author || 'Anonymous'}</Text>
                    <Text style={styles.replyTime}>{reply.timestamp ? new Date(reply.timestamp).toLocaleString() : ''}</Text>
                  </View>
                  {/* Delete button for reply author or topic author */}
                  {(reply.author === userEmail || topic?.author === userEmail) && (
                    <TouchableOpacity onPress={() => deleteReply(reply.id, reply.category)} style={{ marginLeft: 8 }}>
                      <MaterialIcons name="delete" size={20} color="#f44336" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.replyContent}>{reply.content}</Text>
              </View>
            ))
          )}
        </ScrollView>
        {/* Sticky Reply Bar */}
        <View style={styles.replyBoxSticky}>
          <TextInput
            style={styles.replyInput}
            placeholder="Write a reply..."
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={1000}
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity style={styles.replyButton} onPress={handlePostReply} disabled={posting || !replyText.trim()}>
            {posting ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={24} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* Toast Message always visible at root */}
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />
      {/* Delete Reply Confirmation Modal */}
      {deleteReplyConfirm.visible && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 260, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Delete Reply</Text>
            <Text style={{ fontSize: 14, color: '#444', marginBottom: 20, textAlign: 'center' }}>
              Are you sure you want to delete this reply? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <TouchableOpacity onPress={cancelDeleteReply} style={{ padding: 10, marginHorizontal: 8, borderRadius: 8, backgroundColor: '#eee' }}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDeleteReply} style={{ padding: 10, marginHorizontal: 8, borderRadius: 8, backgroundColor: '#f44336' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topicCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, margin: 16, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  topicHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 2, flexShrink: 1 },
  author: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  content: { fontSize: 16, color: '#333', marginVertical: 10, lineHeight: 22 },
  metaText: { fontSize: 12, color: '#888' },
  topicMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 18 },
  topicMetaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 4 },
  repliesHeader: { fontSize: 16, fontWeight: '700', color: '#333', marginLeft: 20, marginTop: 8, marginBottom: 2 },
  noReplies: { fontSize: 14, color: '#888', marginLeft: 20, marginTop: 8 },
  replyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  replyAuthor: { fontSize: 13, color: '#205d29', fontWeight: '600' },
  replyContent: { fontSize: 15, color: '#222', marginVertical: 6, lineHeight: 20 },
  replyTime: { fontSize: 11, color: '#888', marginTop: 2 },
  replyBoxSticky: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e0e0e0', position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 },
  replyInput: { flex: 1, backgroundColor: '#f5f7fa', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8, minHeight: 40, maxHeight: 90 },
  replyButton: { backgroundColor: '#4CAF50', borderRadius: 18, padding: 10, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 2,
    backgroundColor: 'transparent',
    zIndex: 1
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  categoryText: {
    fontSize: 12,
    color: '#2e7d32',
    marginLeft: 4,
    fontWeight: '500',
  },
});
