import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  TouchableOpacity,
  Button,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getUserConversations, sendMessage } from '../services/messagesData';

const Messages = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const chatId = route.params?.messageId;

  const [conversations, setConversations] = useState([]);
  const [isSelected, setIsSelected] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [alertText, setAlertText] = useState(null);

  useEffect(() => {
    getUserConversations()
      .then(res => {
        setConversations(res);
        if (chatId) {
          const match = res.find(x => x.chats._id === chatId);
          if (match) {
            setIsSelected(true);
            setSelected(match);
          }
        }
      })
      .catch(err => console.error(err));
  }, [chatId]);

  const handleMsgSubmit = () => {
    if (!message.trim()) return;

    sendMessage(chatId, message)
      .then(res => {
        setMessage('');
        setAlertText('Message sent!');
        setSelected(prev => ({
          ...prev,
          chats: {
            ...prev.chats,
            conversation: [...prev.chats.conversation, { message, senderId: res.sender }],
          },
        }));
        setTimeout(() => setAlertText(null), 1500);
      })
      .catch(err => console.error(err));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.sidebar}>
        <Text style={styles.title}>Conversations</Text>
        {conversations.length >= 1 ? (
          conversations.map(x => (
            <TouchableOpacity
              key={x.chats._id}
              style={styles.connection}
              onPress={() => {
                navigation.navigate('Messages', { messageId: x.chats._id });
                setIsSelected(true);
              }}
            >
              <Image
                source={{
                  uri: x.isBuyer ? x.chats.seller.avatar : x.chats.buyer.avatar,
                }}
                style={styles.avatar}
              />
              <Text>
                {x.isBuyer ? x.chats.seller.name : x.chats.buyer.name}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text>No messages yet</Text>
        )}
      </View>

      <View style={styles.chatArea}>
        {isSelected && selected && (
          <>
            <TouchableOpacity
              style={styles.chatHeader}
              onPress={() =>
                navigation.navigate('Profile', {
                  id: selected.isBuyer
                    ? selected.chats.seller._id
                    : selected.chats.buyer._id,
                })
              }
            >
              <Image
                source={{
                  uri: selected.isBuyer
                    ? selected.chats.seller.avatar
                    : selected.chats.buyer.avatar,
                }}
                style={styles.avatar}
              />
              <Text>
                {selected.isBuyer
                  ? selected.chats.seller.name
                  : selected.chats.buyer.name}
              </Text>
            </TouchableOpacity>

            {alertText && <Text style={styles.alert}>{alertText}</Text>}

            <ScrollView style={styles.chatBody}>
              {selected.chats.conversation.map((x, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.messageBubble,
                    selected.myId === x.senderId
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
              <Button title="Send" onPress={handleMsgSubmit} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default Messages;

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
});
