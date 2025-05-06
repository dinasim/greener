import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  Button,
  StyleSheet,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getUserConversations, sendMessage } from '../services/messagesData';

export default function MessagesScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const route = useRoute();
  const navigation = useNavigation();
  const chatId = route.params?.id;

  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getUserConversations()
      .then((res) => {
        setConversations(res);
        if (chatId) {
          const convo = res.find((x) => x.chats._id === chatId);
          if (convo) {
            setSelected(convo);
          }
        }
      })
      .catch((err) => console.error(err));
  }, [chatId]);

  const handleSend = () => {
    if (!message.trim()) return;

    sendMessage(chatId, message)
      .then((res) => {
        Alert.alert('Message sent');
        const updated = { ...selected };
        updated.chats.conversation.push({ message, senderId: res.sender });
        setSelected(updated);
        setMessage('');
      })
      .catch((err) => console.error(err));
  };

  const handleSelectConversation = (id) => {
    navigation.navigate('Messages', { id });
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <Text style={styles.heading}>Conversations</Text>
      {conversations.length ? (
        conversations.map((x) => {
          const user = x.isBuyer ? x.chats.seller : x.chats.buyer;
          return (
            <TouchableOpacity
              key={x.chats._id}
              onPress={() => handleSelectConversation(x.chats._id)}
              style={styles.chatItem}
            >
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
              <Text>{user.name}</Text>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text>No messages yet</Text>
      )}
    </View>
  );

  const renderChatArea = () => {
    if (!selected) return null;

    const targetUser = selected.isBuyer
      ? selected.chats.seller
      : selected.chats.buyer;

    return (
      <View style={styles.chatArea}>
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.headerUser}
            onPress={() =>
              navigation.navigate('UserProfile', { id: targetUser._id })
            }
          >
            <Image source={{ uri: targetUser.avatar }} style={styles.avatar} />
            <Text>{targetUser.name}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.chatBody}>
          {selected.chats.conversation.map((x, i) => (
            <View
              key={i}
              style={[
                styles.messageBubble,
                selected.myId === x.senderId
                  ? styles.myMessage
                  : styles.otherMessage,
              ]}
            >
              <Text>{x.message}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message"
            multiline
            style={styles.input}
          />
          <Button title="Send" onPress={handleSend} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={isWide ? styles.rowLayout : styles.columnLayout}>
      {renderSidebar()}
      {renderChatArea()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowLayout: {
    flexDirection: 'row',
    padding: 10,
  },
  columnLayout: {
    flexDirection: 'column',
    padding: 10,
  },
  sidebar: {
    width: 300,
    paddingRight: 10,
    marginBottom: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chatArea: {
    flex: 1,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#ccc',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  chatBody: {
    maxHeight: 300,
    marginBottom: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#eee',
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginRight: 5,
    minHeight: 40,
  },
});
