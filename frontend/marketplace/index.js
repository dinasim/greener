/**
 * Marketplace Module Main Index
 * 
 * This file exports all marketplace components, screens, and services.
 * It serves as the entry point to the marketplace feature of the Greener app.
 */

// Navigation
export { default as MarketplaceNavigation } from './MarketplaceNavigation';

// Screens
export { default as MarketplaceScreen } from './screens/MarketplaceScreen';
export { default as PlantDetailScreen } from './screens/PlantDetailScreen';
export { default as AddPlantScreen } from './screens/AddPlantScreen';
export { default as ProfileScreen } from './screens/ProfileScreen';
export { default as EditProfileScreen } from './screens/EditProfileScreen';
export { default as MessagesScreen } from './screens/MessagesScreen';
export { default as SellerProfileScreen } from './screens/SellerProfileScreen';

// Components
export { default as PlantCard } from './components/PlantCard';
export { default as SearchBar } from './components/SearchBar';
export { default as CategoryFilter } from './components/CategoryFilter';
export { default as PriceRange } from './components/PriceRange';
export { default as CategoriesNav } from './components/CategoriesNav';
export { default as FilterSection } from './components/FilterSection';
export { default as MapToggle } from './components/MapToggle';
export { default as MarketplaceHeader } from './components/MarketplaceHeader';
export { default as AzureMapView } from './components/AzureMapView';

// Services
export { default as marketplaceApi } from './services/marketplaceApi';
export { default as azureMapsService } from './services/azureMapsService';
export { default as config } from './services/config';

/**
 * Integration Guide for Greener App
 * 
 * To integrate the Marketplace feature into the main Greener app:
 * 
 * 1. Import the MarketplaceNavigation into the main app navigation:
 *    import { MarketplaceNavigation } from './marketplace';
 * 
 * 2. Add the MarketplaceNavigation to your main navigation structure:
 *    <Stack.Screen name="Marketplace" component={MarketplaceNavigation} />
 * 
 * 3. IMPORTANT: For proper navigation between screens, use the complete MarketplaceNavigation 
 *    component rather than individual screens. This component already contains all the navigation 
 *    structure including bottom tabs for Marketplace, Messages, and Profile.
 * 
 * 4. Add a button on your Home screen to navigate to the Marketplace:
 *    <TouchableOpacity onPress={() => navigation.navigate('Marketplace')}>
 *      <Text>Go to Marketplace</Text>
 *    </TouchableOpacity>
 * 
 * 5. Ensure proper setup for Google Sign-In authentication:
 *    - Make sure global.googleAuthToken is set after successful login
 *    - Store the token in AsyncStorage for persistence
 *    - Use expo-auth-session/providers/google for authentication
 * 
 * 6. Required assets:
 *    - Create a placeholder images directory: assets/images/
 *    - Add the following placeholder images:
 *      - plant-placeholder.png
 *      - user-placeholder.png
 *      - plant-banner.jpg
 *    - These are used as fallbacks to prevent loading errors
 * 
 * 7. Install required dependencies:
 *    - @react-navigation/native-stack
 *    - @react-navigation/bottom-tabs
 *    - react-native-maps (for map view)
 *    - @react-native-community/slider
 *    - expo-image-picker
 *    - expo-file-system
 *    - react-native-webview (for map integration)
 *    - @react-native-async-storage/async-storage
 * 
 * 8. Troubleshooting:
 *    - If you encounter ERR_NAME_NOT_RESOLVED errors, make sure all assets are in place
 *    - For navigation issues, verify that MarketplaceNavigation is used correctly
 *    - Reset Metro bundler cache with: expo start -c
 */