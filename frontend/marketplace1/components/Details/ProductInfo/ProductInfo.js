import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { BsHeart, BsHeartFill } from 'react-icons/bs';
import { wishProduct } from '../../../services/productData';

const ProductInfo = ({ params }) => {
  const [wish, setWish] = useState(false);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    setWish(params.isWished === true);
  }, [params.isWished]);

  const onHeartClick = () => {
    wishProduct(params._id)
      .then(() => {
        setWish(!wish);
      })
      .catch(err => console.error(err));
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: params.image }} style={styles.image} />

      <View style={styles.headerRow}>
        <Text style={styles.title}>{params.title}</Text>
        {params.isAuth && (
          <TouchableOpacity onPress={onHeartClick} style={styles.heartIcon}>
            {!wish ? (
              <BsHeart style={styles.heartSvg} />
            ) : (
              <BsHeartFill style={styles.heartSvg} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'details' && styles.tabActive]}
          onPress={() => setTab('details')}
        >
          <Text style={styles.tabText}>Details</Text>
        </TouchableOpacity>
        {/* Future Tab:
        <TouchableOpacity
          style={[styles.tabButton, tab === 'about' && styles.tabActive]}
          onPress={() => setTab('about')}
        >
          <Text style={styles.tabText}>About Seller</Text>
        </TouchableOpacity>
        */}
      </View>

      <View style={styles.tabContent}>
        {tab === 'details' && (
          <>
            <Text style={styles.description}>{params.description}</Text>
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Product listed at {params.addedAt}
              </Text>
            </View>
          </>
        )}
        {/* Future tab content can go here */}
      </View>
    </ScrollView>
  );
};

export default ProductInfo;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 10,
  },
  image: {
    width: '100%',
    height: 500,
    resizeMode: 'cover',
    borderRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
    paddingRight: 10,
  },
  heartIcon: {
    padding: 6,
  },
  heartSvg: {
    fontSize: 34,
    color: '#81002c',
    marginTop: 10,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontWeight: 'bold',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderColor: '#2e7d32',
  },
  tabContent: {
    paddingVertical: 20,
  },
  description: {
    textAlign: 'justify',
    letterSpacing: 1,
    paddingHorizontal: 5,
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});
