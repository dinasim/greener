import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';
import { io } from 'socket.io-client';

const SubmitForm = ({ chatId }) => {
  const [text, setText] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io();
    setSocket(s);
    return () => s.disconnect();
  }, []);

  const handleMsgSubmit = () => {
    if (!text.trim()) return;
    socket.emit('chat message', { chatId, text });
    setText('');
  };

  return (
    <View style={styles.footer}>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Type your message..."
        value={text}
        onChangeText={setText}
      />
      <Button title="Send" onPress={handleMsgSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc'
  },
  input: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 10,
    marginRight: 10,
    textAlignVertical: 'top'
  }
});

export default SubmitForm;
