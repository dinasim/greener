// components/MapSearchBox.js
import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getMapTilerKey } from '../services/maptilerService';
import SpeechToTextComponent from './SpeechToTextComponent';

export default function MapSearchBox({ onLocationSelect, maptilerKey, myLocation }) {
  const key = maptilerKey || getMapTilerKey();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);

  const runSearch = async (term) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return [];
    }
    try {
      setLoading(true);
      const url =
        `https://api.maptiler.com/geocoding/${encodeURIComponent(term)}.json` +
        `?key=${encodeURIComponent(key)}&limit=6&language=en`;

      const res = await fetch(url);
      const data = await res.json();

      const items = (data.features || [])
        .map((f) => ({
          id: f.id,
          name: f.place_name || f.text,
          latitude: f.center?.[1],
          longitude: f.center?.[0],
          city:
            (f.context && (f.context.place?.name || f.context.city?.name)) ||
            f.text,
          formattedAddress: f.place_name,
        }))
        .filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));

      setResults(items);
      return items;
    } catch {
      setResults([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const onChange = (text) => {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    if (!text || text.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => runSearch(text), 250);
  };

  const choose = (item) => {
    setQ(item.name);
    setResults([]);
    Keyboard.dismiss();
    onLocationSelect?.({
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city || 'Location',
      formattedAddress: item.formattedAddress || item.name,
    });
  };

  const clear = () => {
    setQ('');
    setResults([]);
    inputRef.current?.focus();
  };

  const submitFirst = () => {
    if (results.length > 0) choose(results[0]);
    else if (q.trim().length >= 2) runSearch(q);
  };

  // 🎤 Voice search handler — replaces the old "useMyLocation" onPress
  const handleTranscriptionResult = async (spokenText) => {
    if (!spokenText) return;
    setQ(spokenText);
    const items = await runSearch(spokenText);
    if (items.length > 0) {
      choose(items[0]);
    }
  };

  // (Optional) keep this if you still want "my location" from somewhere else
  const useMyLocation = () => {
    if (!myLocation) return;
    Keyboard.dismiss();
    setResults([]);
    onLocationSelect?.({
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
      city: 'Current Location',
      formattedAddress: `${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)}`,
    });
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.box}>
        <MaterialIcons name="search" size={20} color="#6b7280" style={styles.leftIcon} />
        <TextInput
          ref={inputRef}
          placeholder="Search a place or address"
          placeholderTextColor="#9ca3af"
          value={q}
          onChangeText={onChange}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={submitFirst}
        />

        {q?.length > 0 ? (
          <TouchableOpacity
            onPress={clear}
            style={styles.iconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          // 👇 Replaces the old "my-location" icon with the mic
          <SpeechToTextComponent
            onTranscriptionResult={handleTranscriptionResult}
            style={styles.iconBtn}
          />
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => choose(item)}>
                <MaterialIcons name="place" size={18} color="#22c55e" style={{ marginRight: 8 }} />
                <Text style={styles.rowText} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              loading ? (
                <View style={styles.loadingRow}>
                  <Text style={styles.loadingText}>Searching…</Text>
                </View>
              ) : null
            }
            // (Nice-to-have) quick access to "Use my location" as the very first row:
            ListHeaderComponent={
              myLocation ? (
                <TouchableOpacity style={styles.row} onPress={useMyLocation}>
                  <MaterialIcons name="my-location" size={18} color="#64748b" style={{ marginRight: 8 }} />
                  <Text style={[styles.rowText, { color: '#334155' }]}>
                    Use my current location
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      )}
    </View>
  );
}

const TOP = Platform.OS === 'ios' ? 10 : 10;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: TOP,
    left: 10,
    right: 10,
    zIndex: 1000,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  leftIcon: { marginRight: 6 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
  iconBtn: { padding: 6, marginLeft: 2 },
  dropdown: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 260,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowText: { flex: 1, color: '#111827' },
  loadingRow: { padding: 10, alignItems: 'center' },
  loadingText: { fontSize: 12, color: '#6b7280' },
});
