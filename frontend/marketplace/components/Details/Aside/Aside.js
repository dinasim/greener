import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Portal, Dialog, Paragraph } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { archiveSell } from '../../../services/productData';
import { createChatRoom } from '../../../services/messagesData';

const Aside = ({ params }) => {
  const navigation = useNavigation();
  const [showMsg, setShowMsg] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [message, setMessage] = useState("");

  const handleArchive = async () => {
    try {
      await archiveSell(params._id);
      setShowArchive(false);
      navigation.navigate('Profile', { userId: params.seller });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMsgSend = async () => {
    try {
      const res = await createChatRoom(params.sellerId, message);
      setShowMsg(false);
      navigation.navigate('Messages', { messageId: res.messageId });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.priceLabel}>Product Price</Text>
      {params.isSeller && (
        <View style={styles.iconRow}>
          <TouchableOpacity onPress={() => navigation.navigate('EditProduct', { id: params._id })}>
            <Icon name="pencil" size={20} color="#666" style={styles.icon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowArchive(true)}>
            <Icon name="archive" size={24} color="#a00" style={styles.icon} />
          </TouchableOpacity>
        </View>
      )}
      {params.price && (
        <Text style={styles.priceHeading}>{parseFloat(params.price).toFixed(2)}€</Text>
      )}

      {params.isAuth ? (
        <>
          {!params.isSeller && (
            <Button
              icon="message"
              mode="contained"
              style={styles.contactBtn}
              onPress={() => setShowMsg(true)}
            >
              Contact Seller
            </Button>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { userId: params.sellerId })}>
            <Image source={{ uri: params.avatar }} style={styles.avatar} />
            <Text><Icon name="account" /> {params.name}</Text>
            <Text><Icon name="email" /> {params.email}</Text>
            <Text><Icon name="phone" /> {params.phoneNumber}</Text>
            <Text><Icon name="shopping" /> {params.createdSells} sells in total</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.guestMsg}>
          <Text style={styles.loginLink} onPress={() => navigation.navigate('Login')}>Sign In</Text> now to contact the seller!
        </Text>
      )}

      {/* Message Modal */}
      <Portal>
        <Dialog visible={showMsg} onDismiss={() => setShowMsg(false)}>
          <Dialog.Title>Message</Dialog.Title>
          <Dialog.Content>
            <TextInput
              multiline
              numberOfLines={3}
              style={styles.textInput}
              placeholder="Type your message..."
              onChangeText={setMessage}
              value={message}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleMsgSend}>Send</Button>
            <Button onPress={() => setShowMsg(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Archive Modal */}
      <Portal>
        <Dialog visible={showArchive} onDismiss={() => setShowArchive(false)}>
          <Dialog.Title>Archive Product</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to archive this item? You can unarchive it anytime from your Profile.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowArchive(false)}>Cancel</Button>
            <Button onPress={handleArchive}>Archive</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 16,
    padding: 20
  },
  priceLabel: {
    fontFamily: 'serif',
    fontSize: 18,
    color: '#333',
    marginBottom: 8
  },
  priceHeading: {
    fontWeight: 'bold',
    fontSize: 28,
    fontFamily: 'Times New Roman',
    color: '#111',
    marginTop: 8
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 8
  },
  icon: {
    marginHorizontal: 10
  },
  contactBtn: {
    marginTop: 16,
    marginBottom: 20
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginVertical: 12
  },
  guestMsg: {
    fontFamily: 'serif',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center'
  },
  loginLink: {
    color: '#007bff',
    textDecorationLine: 'underline'
  },
  textInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    textAlignVertical: 'top',
    marginTop: 10
  }
});

export default Aside;
