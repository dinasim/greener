import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Dialog, Portal, Paragraph } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { activateSell } from '../../services/productData';

const DisabledCard = ({ params }) => {
  const navigation = useNavigation();
  const [show, setShow] = useState(false);

  const handleSubmit = async () => {
    try {
      await activateSell(params._id);
      setShow(false);
      navigation.navigate('ProductDetailsScreen', {
        category: params.category,
        id: params._id
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to activate item.');
    }
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        <Image
          source={{ uri: params.image }}
          style={[styles.image, { opacity: 0.4 }]}
          resizeMode="cover"
        />
        <View style={styles.cardBody}>
          <Text style={styles.title}>{params.title}</Text>
          <Text style={styles.price}>{params.price}€</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {params.addedAt} - {params.city}
          </Text>
          <TouchableOpacity onPress={() => setShow(true)}>
            <MaterialCommunityIcons
              name="refresh"
              size={28}
              color="black"
              style={styles.enableIcon}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Portal>
        <Dialog visible={show} onDismiss={() => setShow(false)}>
          <Dialog.Title>Make Active</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              By clicking <Text style={{ fontWeight: 'bold' }}>Make Active</Text>, this sell will
              become visible to everyone on Greener.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShow(false)}>Cancel</Button>
            <Button onPress={handleSubmit}>Make Active</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 20,
    backgroundColor: '#00000024',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 10
  },
  card: {
    backgroundColor: '#ffffff10',
    paddingBottom: 10
  },
  image: {
    width: '100%',
    height: 200
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '600'
  },
  price: {
    fontSize: 16,
    marginTop: 4
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10
  },
  footerText: {
    fontSize: 12,
    color: '#333'
  },
  enableIcon: {
    marginLeft: 10
  }
});

export default DisabledCard;
