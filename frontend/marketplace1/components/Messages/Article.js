import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const Article = ({ conversation, userId }) => {
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      {conversation.map((msg, index) => {
        const isMe = msg.sender === userId;
        return (
          <View
            key={index}
            style={[styles.messageWrapper, isMe ? styles.me : styles.notMe]}
          >
            <Text style={[styles.messageText, isMe ? styles.messageMe : styles.messageOther]}>
              {msg.text}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  messageWrapper: {
    marginVertical: 10,
    width: '100%'
  },
  me: {
    alignItems: 'flex-end'
  },
  notMe: {
    alignItems: 'flex-start'
  },
  messageText: {
    fontSize: 12,
    padding: 10,
    maxWidth: '80%',
    borderRadius: 20
  },
  messageMe: {
    backgroundColor: '#5d5d5d',
    color: 'white'
  },
  messageOther: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#8080804a',
    color: '#000'
  }
});

export default Article;
