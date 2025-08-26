import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as SignalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://usersfunctions.azurewebsites.net/api';

export default function useOrdersSignalR(businessId, { onOrderCreated, onOrderUpdated, enabled = true } = {}) {
  const connRef = useRef(null);

  useEffect(() => {
    if (!enabled || !businessId) return;

    let connection;

    (async () => {
      try {
        const userId = (await AsyncStorage.getItem('userEmail'))?.toLowerCase() || 'unknown@user';
        const res = await fetch(`${API_BASE}/negotiate/orders?businessId=${encodeURIComponent(businessId)}&userId=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error(`Negotiate failed: ${res.status}`);
        const { url, accessToken } = await res.json();

        connection = new SignalR.HubConnectionBuilder()
          .withUrl(url, { accessTokenFactory: () => accessToken })
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(SignalR.LogLevel.Information)
          .build();

        connection.on('orderCreated', (order) => onOrderCreated?.(order));
        connection.on('orderUpdated', (partial) => onOrderUpdated?.(partial));

        await connection.start();
        connRef.current = connection;
      } catch (e) {
        console.warn('[OrdersRealtime] connection error', e);
        if (__DEV__) Alert.alert('Realtime error', String(e?.message || e));
      }
    })();

    return () => {
      if (connection) connection.stop().catch(() => {});
      connRef.current = null;
    };
  }, [businessId, enabled, onOrderCreated, onOrderUpdated]);
}
