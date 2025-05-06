import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function Error404Screen() {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'http://store.picbg.net/pubpic/32/E3/c2b456c4b2d532e3.jpg' }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  image: {
    width: '90%',
    height: 300,
  },
});
