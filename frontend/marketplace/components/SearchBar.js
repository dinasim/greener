import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { uploadImage, speechToText } from '../services/marketplaceApi';

const SearchBar = ({ value, onChangeText, onSubmit, style }) => {
  const [recording, setRecording] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handleClear = () => {
    onChangeText?.('');
  };

  const handleSubmit = () => {
    onSubmit?.();
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission denied', 'Microphone access is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      startPulse();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    try {
      stopPulse();
      setIsTranscribing(true);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      const uploadResult = await uploadImage(uri, 'speech');
      if (!uploadResult?.url) throw new Error('Audio upload failed');

      const text = await speechToText(uploadResult.url);
      onChangeText?.(text);
    } catch (err) {
      console.error('Speech error:', err);
      Alert.alert('Speech Error', err.message || 'Could not transcribe audio.');
    } finally {
      setRecording(null);
      setIsTranscribing(false);
    }
  };

  // Web: toggle on tap. Mobile: long press
  const micProps = Platform.OS === 'web'
    ? {
        onPress: recording ? stopRecording : startRecording,
      }
    : {
        onPressIn: startRecording,
        onPressOut: stopRecording,
      };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />

        <TextInput
          style={styles.input}
          placeholder="Search plants..."
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {value ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          {...micProps}
          disabled={isTranscribing}
          style={styles.micButton}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <MaterialIcons name="mic" size={22} color="#4CAF50" />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    width: '90%',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 6,
    marginRight: 4,
  },
  micButton: {
    padding: 6,
  },
});

export default SearchBar;
