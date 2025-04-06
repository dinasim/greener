import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import * as SignalR from '@microsoft/signalr'

export default function App() {
  const [counter, setCounter] = useState(null);
  // Lets add a connection state for SignalR
  const [connection, setConnection] = useState(null);

  useEffect( () => {
    const signalrConnection = new SignalR.HubConnectionBuilder()
    .withUrl("<REPLACE_WITH_YOURS>", {
      withCredentials: false, // We disable the credential for simplicity.
      // TODO: check what happens when you disable this flag!
    })// Note we don't call the Negotiate directly, it will be called by the Client SDK
    .withAutomaticReconnect()
    .configureLogging(SignalR.LogLevel.Information)
    .build();

    signalrConnection.on('newCountUpdate', (message) => {
      setCounter(parseInt(message));
    });


    signalrConnection.onclose(() => {
      console.log('Connection closed.');
    });
    
    setConnection(signalrConnection); 

    // Start the connection
    const startConnection = async () => {
        try {
            await signalrConnection.start();
            console.log('SignalR connected.');
            setConnection(signalrConnection);
        } catch (err) {
            console.log('SignalR connection error:', err);
            setTimeout(startConnection, 5000); // Retry connection after 5 seconds
        }
    };

    startConnection();
  }, []);
  


  const increaseCounter = () => {
    fetch("<Replace With yours>", {
      method: 'GET',
    }).then((response) => {
      return response.text();
    }).then((text) => {
      setCounter(parseInt(text));
    }).catch(
      (error) => { console.error(error); }
    );
  };

  const decreaseCounter = () => {
    fetch("<Replace with yours>", {
      method: 'GET',
    }).then((response) => {
      return response.text();
    }).then((text) => {
      setCounter(parseInt(text));
    }).catch(
      (error) => { console.error(error); }
    );
  };

  // Note: We also support reading the counter value
  // This will be used to initialize the counter value upon
  // Startup.
  const readCounter = () => {
    fetch("<Replace with yours>", {
      method: 'GET',
    }).then((response) => {
      return response.text();
    }).then((text) => {
      setCounter(parseInt(text));
    }).catch(
      (error) => { console.error(error); }
    );
  };


  readCounter();
  
  return (
    <View style={styles.container}>
      <Text style={styles.counterText}>Counter: {counter}</Text>
      <View style={styles.buttonContainer}>
        <Button title="Increase" onPress={increaseCounter} />
        <Button title="Decrease" onPress={decreaseCounter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  counterText: {
    fontSize: 32,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
  },
});