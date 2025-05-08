// Create this file in src/marketplace/services/mockData.js

// Mock Plants Data
export const mockPlants = [
    {
      id: '1',
      title: 'Monstera Deliciosa',
      price: 45.99,
      description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves. Easy to care for and purifies the air. Prefers bright, indirect light and moderate watering. Can grow quite large over time, making it a stunning statement piece.',
      category: 'Houseplant',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1622548066689-0a163e23a2d9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0853,
        longitude: 34.8461,
      },
      seller: {
        id: 'user1',
        name: 'Plant Lover',
        avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
        rating: 4.8,
      },
      createdAt: '2023-05-15T10:30:00Z',
      isFavorite: false
    },
    {
      id: '2',
      title: 'Snake Plant (Sansevieria)',
      price: 28.50,
      description: 'Nearly indestructible plant perfect for beginners. Tolerates low light and irregular watering. Known for its air purifying qualities, removing toxins like formaldehyde and benzene.',
      category: 'Succulent',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1572686584478-fee89bef28c6?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0903,
        longitude: 34.8561,
      },
      seller: {
        id: 'user2',
        name: 'Green Thumb',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
        rating: 4.9,
      },
      createdAt: '2023-05-12T14:45:00Z',
      isFavorite: true
    },
    {
      id: '3',
      title: 'Fiddle Leaf Fig',
      price: 75.00,
      description: 'Trendy houseplant with large, violin-shaped leaves. Makes a stunning statement in any room. Prefers consistent conditions and bright, indirect light. Regular dusting of the large leaves helps this plant thrive.',
      category: 'Houseplant',
      condition: 'Young/Seedling',
      images: [
        'https://images.unsplash.com/photo-1600411113118-7f3e13bb3a65?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0880,
        longitude: 34.8510,
      },
      seller: {
        id: 'user3',
        name: 'Plant Nursery',
        avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
        rating: 4.7,
      },
      createdAt: '2023-05-10T09:15:00Z',
      isFavorite: false
    },
    {
      id: '4',
      title: 'Aloe Vera',
      price: 18.99,
      description: 'Medicinal plant with thick, fleshy leaves containing soothing gel. Great for burns and skin care. Easy to propagate by separating the pups that grow from the base.',
      category: 'Succulent',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0830,
        longitude: 34.8430,
      },
      seller: {
        id: 'user4',
        name: 'Herbal Garden',
        avatar: 'https://randomuser.me/api/portraits/men/42.jpg',
        rating: 4.6,
      },
      createdAt: '2023-05-08T16:20:00Z',
      isFavorite: true
    },
    {
      id: '5',
      title: 'Peace Lily',
      price: 32.95,
      description: 'Elegant flowering plant with glossy leaves and white blooms. Excellent air purifier. Drooping leaves are a clear indicator that it needs water, making it easy to care for.',
      category: 'Flowering',
      condition: 'Mature',
      images: [
        'https://images.unsplash.com/photo-1593691568842-0a000c650589?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0870,
        longitude: 34.8490,
      },
      seller: {
        id: 'user5',
        name: 'Flower Power',
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
        rating: 4.9,
      },
      createdAt: '2023-05-06T11:50:00Z',
      isFavorite: false
    },
    {
      id: '6',
      title: 'ZZ Plant',
      price: 29.99,
      description: 'Low-maintenance plant with glossy, dark green leaves. Can survive in low light and with infrequent watering. Perfect for offices and beginners.',
      category: 'Houseplant',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1597055181449-93a256a46c31?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0840,
        longitude: 34.8470,
      },
      seller: {
        id: 'user6',
        name: 'Plant Haven',
        avatar: 'https://randomuser.me/api/portraits/men/55.jpg',
        rating: 4.5,
      },
      createdAt: '2023-05-05T13:10:00Z',
      isFavorite: false
    },
    {
      id: '7',
      title: 'Echeveria Succulent',
      price: 12.50,
      description: 'Beautiful rosette-forming succulent with blue-green leaves. Requires minimal water and bright light. Perfect for small spaces and container gardens.',
      category: 'Succulent',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1509587584298-0f3b3a3a1909?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0835,
        longitude: 34.8445,
      },
      seller: {
        id: 'user7',
        name: 'Succulent Specialist',
        avatar: 'https://randomuser.me/api/portraits/women/36.jpg',
        rating: 4.8,
      },
      createdAt: '2023-05-04T10:25:00Z',
      isFavorite: true
    },
    {
      id: '8',
      title: 'Boston Fern',
      price: 22.99,
      description: 'Classic fern with feathery, arching fronds. Adds a touch of elegance to any space. Prefers humid environments and indirect light.',
      category: 'Houseplant',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1614594604854-562311759c93?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0890,
        longitude: 34.8520,
      },
      seller: {
        id: 'user8',
        name: 'Fern Fanatic',
        avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
        rating: 4.6,
      },
      createdAt: '2023-05-03T15:40:00Z',
      isFavorite: false
    },
    {
      id: '9',
      title: 'Pothos (Devil\'s Ivy)',
      price: 19.99,
      description: 'Easy-growing trailing plant with heart-shaped leaves. Adaptable to various light conditions. Great for hanging baskets or climbing on supports.',
      category: 'Houseplant',
      condition: 'Healthy',
      images: [
        'https://images.unsplash.com/photo-1606756346641-35c455073313?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0860,
        longitude: 34.8480,
      },
      seller: {
        id: 'user9',
        name: 'Trailing Plants',
        avatar: 'https://randomuser.me/api/portraits/women/45.jpg',
        rating: 4.7,
      },
      createdAt: '2023-05-02T12:15:00Z',
      isFavorite: true
    },
    {
      id: '10',
      title: 'Calathea Medallion',
      price: 38.50,
      description: 'Stunning plant with patterned leaves that move throughout the day. Requires higher humidity and careful watering. Beautiful addition to any plant collection.',
      category: 'Houseplant',
      condition: 'Needs Care',
      images: [
        'https://images.unsplash.com/photo-1602923668104-8d8f898f9361?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      ],
      location: {
        latitude: 32.0845,
        longitude: 34.8450,
      },
      seller: {
        id: 'user10',
        name: 'Tropical Plants',
        avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
        rating: 4.4,
      },
      createdAt: '2023-05-01T09:05:00Z',
      isFavorite: false
    }
  ];
  
  // Mock User Data
  export const mockUser = {
    id: 'current-user',
    name: 'Alex Green',
    email: 'alex@example.com',
    avatar: 'https://randomuser.me/api/portraits/lego/1.jpg',
    location: 'Hadera, Israel',
    bio: 'Plant enthusiast and collector. Love sharing my green friends with others!',
    memberSince: '2023-01-15',
    listings: 3,
    rating: 4.7
  };
  
  // Mock Messages Data
  export const mockMessages = [
    {
      id: 'msg1',
      conversationId: 'conv1',
      sender: {
        id: 'user2',
        name: 'Green Thumb',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
      },
      message: 'Hi! I\'m interested in your Monstera plant. Is it still available?',
      timestamp: '2023-05-10T14:30:00Z',
      read: true
    },
    {
      id: 'msg2',
      conversationId: 'conv1',
      sender: {
        id: 'current-user',
        name: 'Alex Green',
        avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
      },
      message: 'Yes, it\'s still available! When would you like to pick it up?',
      timestamp: '2023-05-10T14:45:00Z',
      read: true
    },
    {
      id: 'msg3',
      conversationId: 'conv1',
      sender: {
        id: 'user2',
        name: 'Green Thumb',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
      },
      message: 'Great! Could I come by this weekend? Also, how big is the pot?',
      timestamp: '2023-05-10T15:02:00Z',
      read: false
    },
    {
      id: 'msg4',
      conversationId: 'conv2',
      sender: {
        id: 'user5',
        name: 'Flower Power',
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
      },
      message: 'Hello! Do you still have the ZZ plant for sale?',
      timestamp: '2023-05-08T10:15:00Z',
      read: true
    },
    {
      id: 'msg5',
      conversationId: 'conv2',
      sender: {
        id: 'current-user',
        name: 'Alex Green',
        avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
      },
      message: 'Yes, it\'s available! It\'s about 2 feet tall and very healthy.',
      timestamp: '2023-05-08T10:30:00Z',
      read: true
    },
    {
      id: 'msg6',
      conversationId: 'conv2',
      sender: {
        id: 'user5',
        name: 'Flower Power',
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
      },
      message: 'Perfect! Would you be willing to deliver it if I pay extra?',
      timestamp: '2023-05-08T10:45:00Z',
      read: true
    }
  ];
  
  // Mock Conversations (grouped messages)
  export const mockConversations = [
    {
      id: 'conv1',
      otherUser: {
        id: 'user2',
        name: 'Green Thumb',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
      },
      lastMessage: {
        text: 'Great! Could I come by this weekend? Also, how big is the pot?',
        timestamp: '2023-05-10T15:02:00Z',
        unread: true
      },
      product: {
        id: '1',
        title: 'Monstera Deliciosa',
        image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      }
    },
    {
      id: 'conv2',
      otherUser: {
        id: 'user5',
        name: 'Flower Power',
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
      },
      lastMessage: {
        text: 'Perfect! Would you be willing to deliver it if I pay extra?',
        timestamp: '2023-05-08T10:45:00Z',
        unread: false
      },
      product: {
        id: '6',
        title: 'ZZ Plant',
        image: 'https://images.unsplash.com/photo-1597055181449-93a256a46c31?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80'
      }
    }
  ];
  
  // Mock Favorites
  export const mockFavorites = ['2', '4', '7', '9'];