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
import { BsHeart, BsHeartFill } from 'react-icons/bs'; // placeholder, see note below
import { wishProduct } from '../services/productData'; // Make sure this hits your Azure backend

const ProductInfoScreen = ({ route }) => {
  const { params } = route;
  const [wish, setWish] = useState(false);

  useEffect(() => {
    setWish(!!params.isWished);
  }, [params.isWished]);

  const handleWishToggle = async () => {
    try {
      await wishProduct(params._id); // must be Azure-based
      setWish(prev => !prev);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update wishlist status.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: params.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.row}>
        <Text style={styles.title}>{params.title}</Text>
        {params.isAuth && (
          <TouchableOpacity onPress={handleWishToggle}>
            <Text style={styles.heart}>
              {wish ? '❤️' : '🤍'} {/* Unicode fallback */}
            </Text>
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

export default ProductInfoScreen;
