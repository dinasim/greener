import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Button,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { archiveSell } from '../../../services/productData';
import { createChatRoom } from '../../../services/messagesData';
import { RiMessage3Fill } from 'react-icons/ri';
import { GrEdit } from 'react-icons/gr';
import { MdArchive, MdEmail, MdPhoneAndroid } from 'react-icons/md';
import { BsFillPersonFill } from 'react-icons/bs';
import { FaSellsy } from 'react-icons/fa';

const Aside = ({ params }) => {
  const navigation = useNavigation();
  const [showMsg, setShowMsg] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [message, setMessage] = useState('');

  const handleArchive = async () => {
    try {
      await archiveSell(params._id);
      setShowArchive(false);
      navigation.navigate('Profile', { id: params.sellerId });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to archive.');
    }
  };

  const onMsgSent = async () => {
    try {
      const res = await createChatRoom(params.sellerId, message);
      setShowMsg(false);
      navigation.navigate('Messages', { messageId: res.messageId });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.priceLabel}>Product Price</Text>

      {params.isSeller && (
        <View style={styles.iconRow}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Edit', {
                id: params._id,
              })
            }
          >
            <GrEdit style={styles.editIcon} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowArchive(true)}>
            <MdArchive style={styles.archiveIcon} />
          </TouchableOpacity>
        </View>
      )}

      {params.price && (
        <Text style={styles.priceHeading}>
          {parseFloat(params.price).toFixed(2)}€
        </Text>
      )}

      {!params.isSeller && (
        <TouchableOpacity style={styles.contactButton} onPress={() => setShowMsg(true)}>
          <RiMessage3Fill color="#fff" size={20} style={styles.contactIcon} />
          <Text style={styles.contactText}>Contact Seller</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() =>
          navigation.navigate('Profile', {
            id: params.sellerId,
          })
        }
      >
        <Image source={{ uri: params.avatar }} style={styles.avatar} />
        <Text><BsFillPersonFill /> {params.name}</Text>
        <Text><MdEmail /> {params.email}</Text>
        <Text><MdPhoneAndroid /> {params.phoneNumber}</Text>
        <Text><FaSellsy /> {params.createdSells} sells in total</Text>
      </TouchableOpacity>

      {/* Message Modal */}
      <Modal visible={showMsg} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Message</Text>
            <TextInput
              multiline
              style={styles.textArea}
              value={message}
              onChangeText={setMessage}
              placeholder="Write your message"
            />
            <View style={styles.modalButtons}>
              <Button title="Send" onPress={onMsgSent} />
              <Button title="Close" color="gray" onPress={() => setShowMsg(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Archive Modal */}
      <Modal visible={showArchive} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Archive this item?</Text>
            <Text style={styles.modalBody}>
              By clicking <Text style={{ fontWeight: 'bold' }}>Archive</Text>, this listing will
              become invisible to everyone but you. You can unarchive it anytime from your profile.
            </Text>
            <View style={styles.modalButtons}>
              <Button title="Archive" color="green" onPress={handleArchive} />
              <Button title="Cancel" color="gray" onPress={() => setShowArchive(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Aside;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  priceLabel: {
    fontFamily: 'serif',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  priceHeading: {
    fontWeight: 'bold',
    fontSize: 24,
    fontFamily: 'Times New Roman',
    marginBottom: 12,
  },
  iconRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  editIcon: {
    fontSize: 20,
    marginLeft: '7%',
    marginBottom: 7,
  },
  archiveIcon: {
    fontSize: 24,
    marginLeft: 6,
    marginBottom: 8,
  },
  contactButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 6,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    marginRight: 6,
    marginBottom: 3,
  },
  contactText: {
    color: '#fff',
    fontSize: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    marginTop: 15,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000000aa',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    marginBottom: 10,
  },
  textArea: {
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    height: 100,
    marginBottom: 15,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
