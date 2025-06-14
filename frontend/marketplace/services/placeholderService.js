// services/placeholderService.js - Centralized placeholder image service
export class PlaceholderService {
  
    /**
     * Generate a placeholder image for plants
     * @param {number} width - Image width
     * @param {number} height - Image height  
     * @param {string} text - Text to display
     * @returns {string} Placeholder image URL
     */
    static getPlantPlaceholder(width = 400, height = 300, text = 'Plant Image') {
      const encodedText = encodeURIComponent(text);
      return `https://placeholder.com/${width}x${height}/4CAF50/FFFFFF?text=${encodedText}`;
    }
    
    /**
     * Generate an avatar placeholder using ui-avatars service
     * @param {string} name - Name to generate avatar from
     * @param {number} size - Avatar size
     * @param {string} background - Background color (hex without #)
     * @param {string} color - Text color (hex without #)
     * @returns {string} Avatar URL
     */
    static getAvatarPlaceholder(name = 'User', size = 256, background = '4CAF50', color = 'fff') {
      const initial = name.charAt(0).toUpperCase();
      const encodedName = encodeURIComponent(initial);
      return `https://ui-avatars.com/api/?name=${encodedName}&background=${background}&color=${color}&size=${size}`;
    }
    
    /**
     * Generate a business logo placeholder
     * @param {string} businessName - Business name
     * @param {number} size - Logo size
     * @returns {string} Business logo URL
     */
    static getBusinessLogoPlaceholder(businessName = 'Business', size = 256) {
      const initial = businessName.charAt(0).toUpperCase();
      const encodedName = encodeURIComponent(initial);
      return `https://ui-avatars.com/api/?name=${encodedName}&background=2E7D32&color=fff&size=${size}`;
    }
    
    /**
     * Generate a product placeholder with category-specific styling
     * @param {string} category - Product category
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {string} Category-specific placeholder URL
     */
    static getCategoryPlaceholder(category = 'Plants', width = 400, height = 300) {
      const categoryColors = {
        'Indoor Plants': { bg: '4CAF50', text: 'Indoor+Plant' },
        'Outdoor Plants': { bg: '8BC34A', text: 'Outdoor+Plant' },
        'Succulents': { bg: '795548', text: 'Succulent' },
        'Cacti': { bg: '8BC34A', text: 'Cactus' },
        'Flowering Plants': { bg: 'E91E63', text: 'Flower' },
        'Herbs': { bg: '4CAF50', text: 'Herbs' },
        'Vegetable Plants': { bg: 'FF9800', text: 'Vegetable' },
        'Tropical Plants': { bg: '009688', text: 'Tropical' },
        'Seeds': { bg: '795548', text: 'Seeds' },
        'Accessories': { bg: '607D8B', text: 'Accessory' },
        'Tools': { bg: '9E9E9E', text: 'Tool' },
        'default': { bg: '4CAF50', text: 'Plant' }
      };
      
      const config = categoryColors[category] || categoryColors.default;
      return `https://placeholder.com/${width}x${height}/${config.bg}/FFFFFF?text=${config.text}`;
    }
    
    /**
     * Validate and clean image URL
     * @param {any} imageUrl - Original image URL
     * @param {string} fallbackUrl - Fallback placeholder URL
     * @returns {string} Valid image URL or placeholder
     */
    static validateImageUrl(imageUrl, fallbackUrl = null) {
      // Check if imageUrl is valid
      if (!imageUrl || 
          typeof imageUrl !== 'string' || 
          !imageUrl.startsWith('http') ||
          imageUrl.includes('FFFFFF') ||  // Detect malformed URLs
          imageUrl.includes('500') ||     // Detect malformed URLs
          imageUrl.length < 10) {         // Too short to be valid
        return fallbackUrl || PlaceholderService.getPlantPlaceholder();
      }
      
      return imageUrl;
    }
    
    /**
     * Process image array and ensure all URLs are valid
     * @param {Array} images - Array of image URLs
     * @param {string} category - Product category for fallback
     * @returns {Array} Array of valid image URLs
     */
    static processImageArray(images, category = 'Plants') {
      if (!Array.isArray(images) || images.length === 0) {
        return [PlaceholderService.getCategoryPlaceholder(category)];
      }
      
      const validImages = images
        .filter(img => img && typeof img === 'string' && img.startsWith('http'))
        .filter(img => !img.includes('FFFFFF') && !img.includes('500')); // Filter out malformed URLs
      
      if (validImages.length === 0) {
        return [PlaceholderService.getCategoryPlaceholder(category)];
      }
      
      return validImages;
    }
    
    /**
     * Get safe image URL for plant cards
     * @param {Object} plant - Plant object
     * @returns {string} Safe image URL
     */
    static getPlantCardImage(plant) {
      // Try main image first
      if (plant.image && typeof plant.image === 'string' && plant.image.startsWith('http')) {
        const cleanUrl = PlaceholderService.validateImageUrl(plant.image);
        if (cleanUrl !== plant.image) {
          // Image was invalid, use category placeholder
          return PlaceholderService.getCategoryPlaceholder(plant.category, 300, 200);
        }
        return cleanUrl;
      }
      
      // Try first image from images array
      if (plant.images && Array.isArray(plant.images) && plant.images.length > 0) {
        const validImages = PlaceholderService.processImageArray(plant.images, plant.category);
        if (validImages.length > 0) {
          return validImages[0];
        }
      }
      
      // Try mainImage
      if (plant.mainImage && typeof plant.mainImage === 'string' && plant.mainImage.startsWith('http')) {
        const cleanUrl = PlaceholderService.validateImageUrl(plant.mainImage);
        if (cleanUrl !== plant.mainImage) {
          return PlaceholderService.getCategoryPlaceholder(plant.category, 300, 200);
        }
        return cleanUrl;
      }
      
      // Fallback to category placeholder
      return PlaceholderService.getCategoryPlaceholder(plant.category, 300, 200);
    }
  }
  
  export default PlaceholderService;