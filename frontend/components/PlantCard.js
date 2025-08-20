// components/PlantCard.js
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// On web, TouchableOpacity renders <button>. To avoid nested <button>, use Pressable.
// We'll use Pressable everywhere (outer + inner). If you prefer opacity feedback on native,
// you can swap InnerAction back to TouchableOpacity for non-web.
const CardWrapper = Pressable;
const InnerAction = Pressable;

export default function PlantCard({
  plant,
  layout = 'grid',            // 'grid' | 'list'
  showActions = true,
  onContactPress,              // () => void
  onOrderPress,                // () => void
  onCardPress,                 // optional: navigate to details
}) {
  const handleCardPress = () => {
    if (onCardPress) onCardPress(plant);
  };

  const handleContact = (e) => {
    e?.stopPropagation?.();
    onContactPress && onContactPress(plant);
  };

  const handleOrder = (e) => {
    e?.stopPropagation?.();
    onOrderPress && onOrderPress(plant);
  };

  const priceText =
    plant?.price != null ? `${Number(plant.price).toFixed(0)} ₪` : '';

  return (
    <CardWrapper
      onPress={handleCardPress}
      accessibilityRole="button"
      style={[
        styles.card,
        layout === 'grid' ? styles.cardGrid : styles.cardList,
      ]}
    >
      {!!plant?.mainImage || !!plant?.image ? (
        <Image
          source={{ uri: plant.mainImage || plant.image }}
          style={[styles.image, layout === 'list' && styles.imageList]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <MaterialIcons name="local-florist" size={36} color="#9e9e9e" />
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          <InnerAction
            onPress={handleContact}
            accessibilityRole="button"
            style={styles.actionBtn}
          >
            <MaterialIcons name="chat" size={18} color="#fff" />
          </InnerAction>

          <InnerAction
            onPress={handleOrder}
            accessibilityRole="button"
            style={[styles.actionBtn, styles.actionPrimary]}
          >
            <MaterialIcons name="shopping-cart" size={18} color="#fff" />
          </InnerAction>
        </View>
      )}

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {plant?.title || plant?.name || 'Plant'}
        </Text>
        {!!plant?.seller?.name && (
          <Text numberOfLines={1} style={styles.seller}>
            {plant.seller.name}
          </Text>
        )}
        {!!priceText && <Text style={styles.price}>{priceText}</Text>}
      </View>
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardGrid: {
    // grid cell sizing handled by parent wrapper
  },
  cardList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    height: 140,
    width: '100%',
    backgroundColor: '#eee',
  },
  imageList: {
    width: 120,
    height: 120,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
  },
  seller: {
    marginTop: 2,
    fontSize: 12,
    color: '#757575',
  },
  price: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
  },
  actions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(33,33,33,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: '#4CAF50',
  },
});
