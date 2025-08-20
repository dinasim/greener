// components/MapSearchBox.js
import React, { useState, useRef } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getMapTilerKey } from '../services/maptilerService';

export default function MapSearchBox({ onLocationSelect, maptilerKey }) {
  const key = maptilerKey || getMapTilerKey();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const timer = useRef(null);

  const search = (text) => {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    if (!text || text.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(text)}.json?key=${encodeURIComponent(key)}&limit=6&language=en`;
        const res = await fetch(url);
        const data = await res.json();
        const items = (data.features || []).map(f => ({
          id: f.id,
          name: f.place_name || f.text,
          latitude: f.center?.[1],
          longitude: f.center?.[0],
          city: f.context?.place?.name || f.text,
          formattedAddress: f.place_name,
        })).filter(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
        setResults(items);
      } catch (e) {
        setResults([]);
      }
    }, 250);
  };

  const choose = (item) => {
    setQ(item.name);
    setResults([]);
    onLocationSelect && onLocationSelect({
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city || 'Location',
      formattedAddress: item.formattedAddress || item.name
    });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.box}>
        <MaterialIcons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Search a place or address"
          placeholderTextColor="#999"
          value={q}
          onChangeText={search}
          style={styles.input}
          returnKeyType="search"
        />
      </View>
      {results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => choose(item)}>
                <MaterialIcons name="place" size={18} color="#4CAF50" style={{ marginRight: 8 }} />
                <Text style={styles.rowText} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 220,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  rowText: { flex: 1, color: '#333' },
});
