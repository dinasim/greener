import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SearchBar = ({ value, onChangeText, onSubmit }) => {
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search plants..."
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {value ? (
          <TouchableOpacity onPress={() => onChangeText('')}>
            <MaterialIcons name="clear" size={24} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 10,
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
});

export default SearchBar;