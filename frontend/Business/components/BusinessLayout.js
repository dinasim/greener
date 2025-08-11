import React from 'react';
import { View, StyleSheet } from 'react-native';
import BusinessNavigationBar from './BusinessNavigationBar';

export default function BusinessLayout({ children, navigation, businessId, currentTab, badges }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.body}>{children}</View>
      <BusinessNavigationBar
        currentTab={currentTab}
        navigation={navigation}
        businessId={businessId}
        badges={badges}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { flex: 1, paddingBottom: 110 }, // avoids overlap
});
