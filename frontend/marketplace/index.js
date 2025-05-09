/**
 * Marketplace Module Main Index
 * 
 * This file exports all marketplace components, screens, and services.
 * It serves as the entry point to the marketplace feature of the Greener app.
 */

// Navigation
export { default as MarketplaceNavigation } from './marketplaceNavigation';

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


// Services
export * from './services/productData';
export * from './services/userData';
export * from './services/messagesData';

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
 * 3. Add a button on your Home screen to navigate to the Marketplace:
 *    <TouchableOpacity onPress={() => navigation.navigate('Marketplace')}>
 *      <Text>Go to Marketplace</Text>
 *    </TouchableOpacity>
 * 
 * 4. Ensure proper setup for Google Sign-In authentication:
 *    - Make sure global.googleAuthToken is set after successful login
 *    - Use expo-google-app-auth or similar for authentication
 * 
 * 5. Install required dependencies:
 *    - @react-navigation/native-stack
 *    - react-native-maps (for map view)
 *    - @react-native-community/slider
 *    - expo-image-picker
 *    - expo-file-system
 */