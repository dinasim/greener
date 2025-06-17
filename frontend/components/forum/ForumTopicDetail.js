import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './styles'; // Assuming you have some styles defined in a separate file

const TopicDetails = ({ topicId }) => {
  const [topic, setTopic] = useState(null);
  const [comments, setComments] = useState([]);
  const [votes, setVotes] = useState(0);
  const [views, setViews] = useState(0);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [canVote, setCanVote] = useState(true); // Assuming a default state for voting
  const [canComment, setCanComment] = useState(true); // Assuming a default state for commenting
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    async function fetchTopicDetails() {
      try {
        const res = await fetch(`https://usersfunctions.azurewebsites.net/api/plant-care-forum?topicId=${topicId}`);
        if (!res.ok) throw new Error('Failed to load topic');
        const data = await res.json();
        setTopic(data.topic);
        setComments(data.comments || []);
        setVotes(data.votes || 0);
        setViews(data.views || 0);
      } catch (e) {
        setError('Could not load topic details.');
      }
    }
    fetchTopicDetails();
  }, [topicId]);

  async function handleUpvote() {
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/forum-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, vote: 1 })
      });
      if (!res.ok) throw new Error('Vote failed');
      setVotes(votes + 1);
    } catch (e) {
      setError('Could not upvote.');
    }
  }

  async function handleDownvote() {
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/forum-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, vote: -1 })
      });
      if (!res.ok) throw new Error('Vote failed');
      setVotes(votes - 1);
    } catch (e) {
      setError('Could not downvote.');
    }
  }

  async function handleAddComment() {
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/forum-replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, text: newComment })
      });
      if (!res.ok) throw new Error('Comment failed');
      setComments([...comments, { id: Date.now(), author: 'You', text: newComment }]);
      setNewComment('');
    } catch (e) {
      setError('Could not add comment.');
    }
  }

  if (error) return <div>{error}</div>;
  if (!topic) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Topic not found or API unavailable.</Text>
      </View>
    );
  }

  return (
    <div>
      <h1>{topic.title}</h1>
      <p>{topic.content}</p>
      <View style={styles.votesRow}>
        <TouchableOpacity onPress={handleUpvote} disabled={!canVote}>
          <Ionicons name="arrow-up" size={20} color={canVote ? '#4CAF50' : '#ccc'} />
        </TouchableOpacity>
        <Text>{votes}</Text>
        <TouchableOpacity onPress={handleDownvote} disabled={!canVote}>
          <Ionicons name="arrow-down" size={20} color={canVote ? '#4CAF50' : '#ccc'} />
        </TouchableOpacity>
        <Text style={styles.viewsText}>{views} views</Text>
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <div>
        <h2>Comments</h2>
        {comments.length === 0 ? (
          <p>No comments yet.</p>
        ) : (
          <ul>
            {comments.map((comment) => (
              <li key={comment.id}>{comment.text}</li>
            ))}
          </ul>
        )}
        <View style={styles.commentsSection}>
          {comments.map(comment => (
            <View key={comment.id} style={styles.commentItem}>
              <Text style={styles.commentAuthor}>{comment.author}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
            </View>
          ))}
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            style={styles.commentInput}
          />
          <TouchableOpacity onPress={handleAddComment} disabled={!newComment.trim()}>
            <Text style={styles.addCommentBtn}>Post</Text>
          </TouchableOpacity>
        </View>
        {!canVote && (
          <Text style={styles.disabledText}>Voting is not available.</Text>
        )}
        {!canComment && (
          <Text style={styles.disabledText}>Commenting is not available.</Text>
        )}
      </div>
      <Modal
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        transparent
      >
        <View style={modalVisible ? { ...styles.modalBackground, inert: true } : styles.modalBackground}>
          {/* Modal content here */}
        </View>
      </Modal>
    </div>
  );
};

export default TopicDetails;

// Remove any aria-hidden attribute from modal root if a child is focused