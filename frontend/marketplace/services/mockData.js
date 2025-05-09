// services/mockData.js
// Sample mock data for development

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
  ];
  
  // Function to get mock user
  export function getMockUser() {
    return { user: MOCK_USER };
  }
  
  // Function to get mock plants
  export function getMockProducts(category, query) {
    let filtered = [...MOCK_PLANTS];
  
    if (category && category !== 'all' && category !== 'All') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
  
    if (query) {
      const lowercaseQuery = query.toLowerCase();
      filtered = filtered.filter((p) => 
        p.title.toLowerCase().includes(lowercaseQuery) || 
        p.description.toLowerCase().includes(lowercaseQuery) ||
        p.city.toLowerCase().includes(lowercaseQuery)
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
    const product = MOCK_PLANTS.find((p) => p.id === id);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }