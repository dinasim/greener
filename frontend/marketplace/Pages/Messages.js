import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getUserConversations, sendMessage } from '../services/messagesData';

const Messages = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const chatId = route.params?.messageId;

  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [alertText, setAlertText] = useState(null);

  // Fetch user conversations
  useEffect(() => {
    getUserConversations()
      .then((res) => {
        setConversations(res);
        if (chatId) {
          const match = res.find((x) => x.chats._id === chatId);
          if (match) {
            setSelectedChat(match);
          }
        }
      })
      .catch((err) => console.error(err));
  }, [chatId]);

  const handleMsgSubmit = () => {
    if (!message.trim()) return;

    sendMessage(chatId, message)
      .then((res) => {
        setMessage('');
        setAlertText('Message sent!');
        setSelectedChat((prev) => ({
          ...prev,
          chats: {
            ...prev.chats,
            conversation: [
              ...prev.chats.conversation,
              { message, senderId: res.sender },
            ],
          },
        }));
        setTimeout(() => setAlertText(null), 1500);
      })
      .catch((err) => console.error(err));
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.connection}
      onPress={() => {
        navigation.navigate('Messages', { messageId: item.chats._id });
        setSelectedChat(item);
      }}
    >
      <Image
        source={{
          uri: item.isBuyer ? item.chats.seller.avatar : item.chats.buyer.avatar,
        }}
        style={styles.avatar}
      />
      <Text>{item.isBuyer ? item.chats.seller.name : item.chats.buyer.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.sidebar}>
        <Text style={styles.title}>Conversations</Text>
        {conversations.length > 0 ? (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.chats._id}
            style={styles.connectionList}
          />
        ) : (
          <Text>No conversations yet.</Text>
        )}
      </View>

      <View style={styles.chatArea}>
        {selectedChat ? (
          <>
            <View style={styles.chatHeader}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Profile', {
                    id: selectedChat.isBuyer
                      ? selectedChat.chats.seller._id
                      : selectedChat.chats.buyer._id,
                  })
                }
              >
                <Image
                  source={{
                    uri: selectedChat.isBuyer
                      ? selectedChat.chats.seller.avatar
                      : selectedChat.chats.buyer.avatar,
                  }}
                  style={styles.avatar}
                />
                <Text>
                  {selectedChat.isBuyer
                    ? selectedChat.chats.seller.name
                    : selectedChat.chats.buyer.name}
                </Text>
              </TouchableOpacity>
            </View>

            {alertText && <Text style={styles.alert}>{alertText}</Text>}

            <ScrollView style={styles.chatBody}>
              {selectedChat.chats.conversation.map((x, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.messageBubble,
                    selectedChat.myId === x.senderId
                      ? styles.messageMe
                      : styles.messageOther,
                  ]}
                >
                  <Text>{x.message}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.chatFooter}>
              <TextInput
                style={styles.input}
                multiline
                value={message}
                onChangeText={setMessage}
                placeholder="Type your message..."
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleMsgSubmit}
                disabled={!message.trim()}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text>Select a conversation to start chatting.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  sidebar: {
    width: '35%',
    paddingRight: 10,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  chatArea: {
    flex: 1,
    paddingLeft: 10,
  },
  title: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alert: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  chatBody: {
    maxHeight: 300,
    marginBottom: 15,
  },
  messageBubble: {
    padding: 10,
    marginVertical: 4,
    borderRadius: 8,
    maxWidth: '80%',
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f0f0',
  },
  chatFooter: {
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    borderColor: '#999',
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  sendButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Messages;
