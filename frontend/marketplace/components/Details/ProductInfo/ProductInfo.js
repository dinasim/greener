import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import { wishProduct } from '../../../services/productData'; // Adapt to your file structure

const ProductInfo = ({ params }) => {
  const [wish, setWish] = useState(false);

  useEffect(() => {
    setWish(!!params.isWished);
  }, [params.isWished]);

  const handleWishToggle = async () => {
    try {
      await wishProduct(params._id);
      setWish(prev => !prev);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update wishlist status.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: params.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.headerRow}>
        <Text style={styles.title}>{params.title}</Text>
        {params.isAuth && (
          <TouchableOpacity onPress={handleWishToggle}>
            <Text style={styles.heart}>{wish ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.detailsText}>{params.description}</Text>
        <View style={styles.separator} />
        <Text style={styles.footer}>Product listed at {params.addedAt}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 10
  },
  image: {
    height: 500,
    width: '100%',
    borderRadius: 8,
    marginBottom: 20
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
    flexWrap: 'wrap'
  },
  heart: {
    fontSize: 32,
    marginRight: 10,
    marginTop: 10,
    color: '#81002c'
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10
  },
  detailsText: {
    fontSize: 16,
    textAlign: 'justify',
    letterSpacing: 0.5,
    textIndent: 20
  },
  separator: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 10
  },
  footer: {
    textAlign: 'right',
    fontStyle: 'italic',
    fontSize: 12
  }
});

export default ProductInfo;
