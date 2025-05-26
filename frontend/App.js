import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';


export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
      <PushWebSetup />
    </NavigationContainer>
  );
}


// import React, { useEffect, useState } from 'react';
// import { StyleSheet, Text, View, Button } from 'react-native';
// import * as SignalR from '@microsoft/signalr'

// export default function App() {
//   const [counter, setCounter] = useState(null);
//   // Lets add a connection state for SignalR
//   const [connection, setConnection] = useState(null);

//   useEffect( () => {
//     const signalrConnection = new SignalR.HubConnectionBuilder()
//     .withUrl("https://excerice2.azurewebsites.net/api", {
//       withCredentials: false, // We disable the credential for simplicity.
//       headers: {
//         'Origin': 'http://localhost:8081'
//       }
//       // TODO: check what happens when you disable this flag!
//     })// Note we don't call the Negotiate directly, it will be called by the Client SDK
//     .withAutomaticReconnect()
//     .configureLogging(SignalR.LogLevel.Information)
//     .build();

//     signalrConnection.on('newCountUpdate', (message) => {
//       setCounter(parseInt(message));
//     });


//     signalrConnection.onclose(() => {
//       console.log('Connection closed.');
//     });
    
//     setConnection(signalrConnection); 
// /*
//     // Start the connection
//     const startConnection = async () => {
//         try {
//             await signalrConnection.start();
//             console.log('SignalR connected.');
//             setConnection(signalrConnection);
//         } catch (err) {
//             console.log('SignalR connection error:', err);
//             setTimeout(startConnection, 5000); // Retry connection after 5 seconds
//         }
//     };
//     */
//     const startConnection = async () => {
//       try {
//           console.log('Attempting to connect to SignalR...');
//           await signalrConnection.start();
//           console.log('SignalR connected.');
//           setConnection(signalrConnection);
//       } catch (err) {
//           console.log('SignalR connection error details:', err.message);
//           console.log('Error source:', err.source);
//           console.log('Full error:', err);
//           setTimeout(startConnection, 5000);
//       }
//   };
//     startConnection();
//   }, []);
  


//   const increaseCounter = () => {
//     fetch("https://excerice2.azurewebsites.net/api/IncreaseCounter", {
//       method: 'GET',
//       headers: {
//         'Accept': 'text/plain',
//         'Content-Type': 'text/plain',
//         'Origin': 'http://localhost:8081'  // ← ADD THIS HEADER
//       },
//       mode: 'cors'  // ← EXPLICITLY ENABLE CORS
//     }).then((response) => {
//       return response.text();
//     }).then((text) => {
//       setCounter(parseInt(text));
//     }).catch(
//       (error) => { console.error(error); }
//     );
//   };

//   const decreaseCounter = () => {
//     fetch("https://excerice2.azurewebsites.net/api/DecreaseCounter", {
//       method: 'GET',
//       headers: {
//         'Accept': 'text/plain',
//         'Content-Type': 'text/plain',
//         'Origin': 'http://localhost:8081'  // ← ADD THIS HEADER
//       },
//       mode: 'cors'  // ← EXPLICITLY ENABLE CORS
//     }).then((response) => {
//       return response.text();
//     }).then((text) => {
//       setCounter(parseInt(text));
//     }).catch(
//       (error) => { console.error(error); }
//     );
//   };

//   // Note: We also support reading the counter value
//   // This will be used to initialize the counter value upon
//   // Startup.
//   const readCounter = () => {
//     fetch("https://excerice2.azurewebsites.net/api/ReadCounter", {
//       method: 'GET',
//       headers: {
//         'Accept': 'text/plain',
//         'Content-Type': 'text/plain',
//         'Origin': 'http://localhost:8081'  // ← ADD THIS HEADER
//       },
//       mode: 'cors'  // ← EXPLICITLY ENABLE CORS
//     }).then((response) => {
//       return response.text();
//     }).then((text) => {
//       setCounter(parseInt(text));
//     }).catch(
//       (error) => { console.error(error); }
//     );
//   };


//   useEffect(() => {
//     readCounter();
//   }, []);
//   //   readCounter();
//   //changed ^

//   return (
//     <View style={styles.container}>
//       <Text style={styles.counterText}>Counter: {counter}</Text>
//       <View style={styles.buttonContainer}>
//         <Button title="Increase" onPress={increaseCounter} />
//         <Button title="Decrease" onPress={decreaseCounter} />
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//   },
//   counterText: {
//     fontSize: 32,
//     marginBottom: 20,
//   },
//   buttonContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     width: '60%',
//   },
// });