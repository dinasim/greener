// services/mockData.js

// Note: You'll need to create placeholder images in your assets folder
// For now, we'll use placeholder URLs with fallbacks

// Mock user
export const MOCK_USER = {
  id: 'user123',
  name: 'Plant Enthusiast',
  email: 'plant.lover@example.com',
  phoneNumber: '+1 (555) 123-4567',
  avatar: 'https://via.placeholder.com/150?text=User',
  bio: 'Passionate plant enthusiast with a love for tropical houseplants. I enjoy propagating plants and helping others grow their own indoor jungles.',
  location: 'Seattle, WA',
  joinDate: new Date('2023-01-01').toISOString(),
  stats: {
    plantsCount: 8,
    salesCount: 5,
    rating: 4.9,
  },
  listings: [
    {
      id: '1',
      name: 'Monstera Deliciosa',
      description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves',
      price: 29.99,
      imageUrl: 'https://via.placeholder.com/150?text=Monstera',
      category: 'Indoor Plants',
      listedDate: new Date().toISOString(),
      status: 'active',
    },
    {
      id: '2',
      name: 'Snake Plant',
      description: 'Low maintenance indoor plant, perfect for beginners',
      price: 19.99,
      imageUrl: 'https://via.placeholder.com/150?text=Snake+Plant',
      category: 'Indoor Plants',
      listedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    }
  ],
  favorites: [
    {
      id: '3',
      name: 'Fiddle Leaf Fig',
      description: 'Trendy houseplant with violin-shaped leaves',
      price: 34.99,
      imageUrl: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
      category: 'Indoor Plants',
      listedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'sold',
    }
  ]
};

// Mock plants
export const MOCK_PLANTS = [
  {
    id: '1',
    title: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves',
    price: 29.99,
    image: 'https://via.placeholder.com/150?text=Monstera',
    seller: {
      _id: 'user123',
      name: 'Plant Enthusiast',
    },
    city: 'Seattle',
    category: 'indoor',
    rating: 4.7,
    isFavorite: false,
    addedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Snake Plant',
    description: 'Low maintenance indoor plant, perfect for beginners',
    price: 19.99,
    image: 'https://via.placeholder.com/150?text=Snake+Plant',
    seller: {
      _id: 'user123',
      name: 'Plant Enthusiast',
    },
    city: 'Seattle',
    category: 'indoor',
    rating: 4.5,
    isFavorite: false,
    addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    title: 'Fiddle Leaf Fig',
    description: 'Trendy houseplant with violin-shaped leaves',
    price: 34.99,
    image: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
    seller: {
      _id: 'user456',
      name: 'Green Thumb',
    },
    city: 'Portland',
    category: 'indoor',
    rating: 4.2,
    isFavorite: true,
    addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    title: 'Pothos',
    description: 'Easy care trailing plant with beautiful variegated leaves',
    price: 15.99,
    image: 'https://via.placeholder.com/150?text=Pothos',
    seller: {
      _id: 'user789',
      name: 'Plant Parent',
    },
    city: 'San Francisco',
    category: 'indoor',
    rating: 4.8,
    isFavorite: false,
    addedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    title: 'Succulent Collection',
    description: 'Set of 5 different easy-care succulents in 2" pots',
    price: 24.99,
    image: 'https://via.placeholder.com/150?text=Succulents',
    seller: {
      _id: 'user456',
      name: 'Green Thumb',
    },
    city: 'Portland',
    category: 'succulent',
    rating: 4.9,
    isFavorite: false,
    addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    title: 'Basil Plant',
    description: 'Fresh organic basil plant, perfect for your kitchen',
    price: 8.99,
    image: 'https://via.placeholder.com/150?text=Basil',
    seller: {
      _id: 'user789',
      name: 'Plant Parent',
    },
    city: 'San Francisco',
    category: 'herbs',
    rating: 4.6,
    isFavorite: false,
    addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock conversations
export const MOCK_CONVERSATIONS = [
  {
    id: 'conv1',
    otherUserName: 'PlantLover123',
    otherUserAvatar: 'https://via.placeholder.com/50?text=User1',
    lastMessage: "Hi, is the Monstera still available?",
    lastMessageTimestamp: new Date().toISOString(),
    plantName: "Monstera Deliciosa",
    plantId: "1",
    sellerId: "seller1",
    unreadCount: 2
  },
  {
    id: 'conv2',
    otherUserName: 'GreenThumb',
    otherUserAvatar: 'https://via.placeholder.com/50?text=User2',
    lastMessage: "Thanks for the quick response!",
    lastMessageTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    plantName: "Snake Plant",
    plantId: "2",
    sellerId: "seller2",
    unreadCount: 0
  }
];

// Mock messages
export const MOCK_MESSAGES = {
  'conv1': {
    messages: [
      {
        id: 'msg1',
        text: "Hi, is the Monstera still available?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        id: 'msg2',
        text: "Yes, it's still available!",
        senderId: 'currentUser',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      },
      {
        id: 'msg3',
        text: "Great! What's the best time to come see it?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString()
      },
      {
        id: 'msg4',
        text: "I'm available this weekend, would that work for you?",
        senderId: 'currentUser',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      }
    ],
    otherUser: {
      id: 'seller1',
      name: 'PlantLover123',
      avatar: 'https://via.placeholder.com/50?text=User1'
    }
  },
  'conv2': {
    messages: [
      {
        id: 'msg1',
        text: "Hello, I'm interested in your Snake Plant. Is it still for sale?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'msg2',
        text: "Yes it is! It's about 2 feet tall and very healthy.",
        senderId: 'currentUser',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
      },
      {
        id: 'msg3',
        text: "Perfect. Would you be willing to deliver it?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'msg4',
        text: "I could deliver it if you're within 5 miles of downtown.",
        senderId: 'currentUser',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString()
      },
      {
        id: 'msg5',
        text: "Thanks for the quick response!",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    otherUser: {
      id: 'seller2',
      name: 'GreenThumb',
      avatar: 'https://via.placeholder.com/50?text=User2'
    }
  }
};

// Function to get mock user
export function getMockUser() {
  return { user: MOCK_USER };
}

// Function to get mock products
export function getMockProducts(category, query) {
  let filtered = [...MOCK_PLANTS];

  if (category && category !== 'all' && category !== 'All') {
    filtered = filtered.filter((p) => 
      p.category?.toLowerCase() === category.toLowerCase()
    );
  }

  if (query) {
    const lowercaseQuery = query.toLowerCase();
    filtered = filtered.filter((p) => 
      (p.title?.toLowerCase().includes(lowercaseQuery) || 
       p.description?.toLowerCase().includes(lowercaseQuery) ||
       p.city?.toLowerCase().includes(lowercaseQuery))
    );
  }

  return {
    products: filtered,
    pages: 1,
    currentPage: 1,
    count: filtered.length,
  };
}

// Function to get a single mock plant
export function getMockProductById(id) {
  const product = MOCK_PLANTS.find((p) => p.id === id || p._id === id);
  
  if (!product) {
    // Create a default product if ID not found
    return {
      id: id,
      title: 'Sample Plant',
      description: 'This is a placeholder for development when the requested plant was not found',
      price: 24.99,
      image: 'https://via.placeholder.com/150?text=Plant',
      category: 'indoor',
      city: 'Default City',
      addedAt: new Date().toISOString(),
      sellerId: 'seller1',
      seller: {
        _id: 'seller1',
        name: 'Default Seller'
      }
    };
  }
  
  return product;
}

// Function to get mock conversations
export function getMockConversations() {
  return MOCK_CONVERSATIONS;
}

// Function to get mock messages for a conversation
export function getMockMessagesForConversation(conversationId) {
  return MOCK_MESSAGES[conversationId] || { messages: [] };
}

// Generic mock data function - improves reliability
export function getMockProductData(endpoint) {
  // Handle different endpoint patterns
  if (endpoint.includes('specific')) {
    const id = endpoint.split('/').pop();
    return getMockProductById(id);
  } else if (endpoint.includes('wish')) {
    // Wishlist toggle endpoint
    return { 
      success: true, 
      message: 'Wishlist updated (mock)', 
      status: 'success' 
    };
  } else {
    // Default products endpoint
    return getMockProducts();
  }
}

// Function to get mock messages
export function getMockMessageData(endpoint) {
  if (endpoint.includes('createChatRoom')) {
    return { messageId: 'mock-conversation-id' };
  } else if (endpoint.includes('sendMessage')) {
    return { sender: 'currentUser' };
  } else if (endpoint.includes('getUserConversations')) {
    return MOCK_CONVERSATIONS;
  } else if (endpoint.includes('messages/')) {
    const id = endpoint.split('/').pop();
    return MOCK_MESSAGES[id] || { messages: [] };
  }
  
  return { success: true, mockData: true };
}