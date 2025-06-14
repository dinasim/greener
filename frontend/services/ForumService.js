// services/ForumService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

class ForumService {
  // Get forum topics with filtering and pagination
  async getTopics({ category = 'all', search = '', limit = 20, offset = 0, sort = 'lastActivity' } = {}) {
    try {
      const params = new URLSearchParams({
        category,
        search,
        limit: limit.toString(),
        offset: offset.toString(),
        sort
      });

      const response = await fetch(`${API_BASE_URL}/plant-care-forum?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        topics: data.topics || [],
        categoryStats: data.categoryStats || {},
        pagination: data.pagination || {},
        total: data.total || 0
      };

    } catch (error) {
      console.error('Error fetching topics:', error);
      return {
        success: false,
        error: error.message,
        topics: [],
        categoryStats: {},
        pagination: {},
        total: 0
      };
    }
  }

  // Create a new forum topic
  async createTopic({ title, content, category, tags = [], authorType = 'customer' }) {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        throw new Error('User not logged in');
      }

      const topicData = {
        title: title.trim(),
        content: content.trim(),
        category,
        author: userEmail,
        tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        authorType
      };

      const response = await fetch(`${API_BASE_URL}/plant-care-forum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(topicData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        topicId: result.topicId,
        message: result.message
      };

    } catch (error) {
      console.error('Error creating topic:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get replies for a specific topic
  async getReplies(topicId, category) {
    try {
      if (!topicId || !category) {
        throw new Error('Topic ID and category are required');
      }

      const params = new URLSearchParams({
        topicId,
        category
      });

      const response = await fetch(`${API_BASE_URL}/forum-replies?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        replies: data.replies || []
      };

    } catch (error) {
      console.error('Error fetching replies:', error);
      return {
        success: false,
        error: error.message,
        replies: []
      };
    }
  }

  // Create a new reply to a topic
  async createReply({ topicId, category, content, parentReplyId = null, authorType = 'customer' }) {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        throw new Error('User not logged in');
      }

      const replyData = {
        topicId,
        category,
        content: content.trim(),
        author: userEmail,
        authorType,
        parentReplyId
      };

      const response = await fetch(`${API_BASE_URL}/forum-replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(replyData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        replyId: result.replyId,
        message: result.message
      };

    } catch (error) {
      console.error('Error creating reply:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Vote on a reply
  async voteReply(replyId, category, voteType = 'up') {
    try {
      const voteData = {
        replyId,
        category,
        action: 'vote',
        voteType // 'up' or 'down'
      };

      const response = await fetch(`${API_BASE_URL}/forum-replies`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(voteData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message
      };

    } catch (error) {
      console.error('Error voting on reply:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Mark reply as answer
  async markAsAnswer(replyId, category) {
    try {
      const updateData = {
        replyId,
        category,
        action: 'mark_answer'
      };

      const response = await fetch(`${API_BASE_URL}/forum-replies`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message
      };

    } catch (error) {
      console.error('Error marking reply as answer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Unmark reply as answer
  async unmarkAsAnswer(replyId, category) {
    try {
      const updateData = {
        replyId,
        category,
        action: 'unmark_answer'
      };

      const response = await fetch(`${API_BASE_URL}/forum-replies`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message
      };

    } catch (error) {
      console.error('Error unmarking reply as answer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user info for forum posts
  async getUserInfo() {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userType = await AsyncStorage.getItem('userType') || 'customer';
      
      return {
        email: userEmail,
        type: userType,
        isLoggedIn: !!userEmail
      };
    } catch (error) {
      console.error('Error getting user info:', error);
      return {
        email: null,
        type: 'customer',
        isLoggedIn: false
      };
    }
  }

  // Format time ago helper
  formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now - time) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return `${Math.floor(diffInHours / 168)}w ago`;
  }

  // Validate topic data
  validateTopic({ title, content, category }) {
    const errors = [];
    
    if (!title?.trim()) {
      errors.push('Title is required');
    } else if (title.trim().length < 5) {
      errors.push('Title must be at least 5 characters long');
    } else if (title.trim().length > 100) {
      errors.push('Title must be less than 100 characters');
    }
    
    if (!content?.trim()) {
      errors.push('Content is required');
    } else if (content.trim().length < 10) {
      errors.push('Content must be at least 10 characters long');
    }
    
    const validCategories = ['general', 'disease', 'pests', 'watering', 'lighting', 'fertilizer', 'repotting', 'indoor', 'outdoor'];
    if (!validCategories.includes(category)) {
      errors.push('Invalid category selected');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate reply data
  validateReply({ content }) {
    const errors = [];
    
    if (!content?.trim()) {
      errors.push('Reply content is required');
    } else if (content.trim().length < 5) {
      errors.push('Reply must be at least 5 characters long');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default new ForumService();