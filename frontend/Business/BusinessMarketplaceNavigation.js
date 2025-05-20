// frontend/navigation/BusinessMarketplaceNavigation.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import business marketplace screens
import BusinessHomeScreen from '../Business/BusinessScreens/BusinessHomeScreen';

const Stack = createNativeStackNavigator();

const BusinessMarketplaceNavigation = () => {
  return (
    <Stack.Navigator 
      initialRouteName="BusinessMarketplaceHome" 
      screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: '#fff' },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="BusinessMarketplaceHome" component={BusinessHomeScreen} />
{/* 
      <Stack.Screen name="BusinessProductDetail" component={BusinessProductDetailScreen} />
      <Stack.Screen name="BusinessSellerProfile" component={BusinessSellerProfileScreen} />
      <Stack.Screen name="BusinessAddProduct" component={BusinessAddProductScreen} />
      <Stack.Screen name="BusinessEditProduct" component={BusinessEditProductScreen} />
      <Stack.Screen name="BusinessMapView" component={BusinessMapScreen} />
      <Stack.Screen name="BusinessCustomerDetail" component={BusinessCustomerDetailScreen} />
      <Stack.Screen name="BusinessChat" component={BusinessChatScreen} />
*/}
    </Stack.Navigator>
  );
};

export default BusinessMarketplaceNavigation;