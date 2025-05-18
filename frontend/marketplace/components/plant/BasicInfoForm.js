import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Component for basic plant information form
 * @param {Object} formData The form data object
 * @param {Object} formErrors Validation errors
 * @param {Function} onChange Handler for form changes
 * @param {string} listingType Type of listing ('plant', 'accessory', 'tool')
 * @param {Array} categories Available categories
 * @param {Function} onScientificNamePress Handler for scientific name selection
 */
const BasicInfoForm = ({ 
  formData, 
  formErrors, 
  onChange, 
  listingType, 
  categories,
  onScientificNamePress
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Basic Information</Text>
      
      <Text style={styles.label}>
        {listingType === 'plant' ? 'Plant Name' : 
         listingType === 'accessory' ? 'Accessory Name' : 'Tool Name'} 
        <Text style={styles.requiredField}>*</Text>
      </Text>
      <TextInput
        style={[styles.input, formErrors.title && styles.inputError]}
        value={formData.title}
        onChangeText={(text) => onChange('title', text)}
        placeholder={
          listingType === 'plant' ? "What kind of plant is it?" : 
          listingType === 'accessory' ? "What is the accessory?" : 
          "What kind of tool is it?"
        }
      />
      {formErrors.title ? <Text style={styles.errorText}>{formErrors.title}</Text> : null}
      
      {listingType === 'plant' && (
        <>
          <Text style={styles.label}>Scientific Name (Optional)</Text>
          <TouchableOpacity 
            style={[
              styles.input, 
              styles.pickerButton, 
              formData.scientificName ? styles.filledInput : null
            ]}
            onPress={onScientificNamePress}
          >
            <Text 
              style={[
                styles.pickerButtonText, 
                formData.scientificName ? styles.filledInputText : null
              ]}
            >
              {formData.scientificName || "Select plant type to auto-fill care info"}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
          </TouchableOpacity>
        </>
      )}
      
      <Text style={styles.label}>Price <Text style={styles.requiredField}>*</Text></Text>
      <TextInput
        style={[styles.input, formErrors.price && styles.inputError]}
        value={formData.price}
        onChangeText={(text) => onChange('price', text)}
        placeholder="How much are you selling it for?"
        keyboardType="numeric"
      />
      {formErrors.price ? <Text style={styles.errorText}>{formErrors.price}</Text> : null}
      
      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal style={styles.categoryScroller}>
        {categories
          .filter(category => {
            if (listingType === 'plant') {
              return category !== 'Accessories' && category !== 'Tools';
            } else if (listingType === 'accessory') {
              return category === 'Accessories';
            } else if (listingType === 'tool') {
              return category === 'Tools';
            }
            return true;
          })
          .map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton, 
                formData.category === category && styles.selectedCategoryButton
              ]}
              onPress={() => onChange('category', category)}
            >
              <Text 
                style={[
                  styles.categoryText, 
                  formData.category === category && styles.selectedCategoryText
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))
        }
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { 
    marginBottom: 28, 
    padding: 16, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 6, 
    elevation: 2 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 14, 
    color: '#2E7D32' 
  },
  label: { 
    fontSize: 16, 
    marginBottom: 6, 
    color: '#333' 
  },
  requiredField: { 
    color: '#D32F2F', 
    fontWeight: 'bold' 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 10, 
    padding: 12, 
    fontSize: 16,
    backgroundColor: '#F1FDF4', 
    marginBottom: 14 
  },
  inputError: { 
    borderColor: '#f44336' 
  },
  pickerButton: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12 
  },
  pickerButtonText: { 
    color: '#999', 
    fontSize: 16 
  },
  filledInput: { 
    borderColor: '#AED581', 
    backgroundColor: '#F1FDF4' 
  },
  filledInputText: { 
    color: '#2E7D32' 
  },
  errorText: { 
    color: '#D32F2F', 
    fontSize: 13, 
    marginTop: -8, 
    marginBottom: 8 
  },
  categoryScroller: { 
    marginVertical: 10 
  },
  categoryButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    borderRadius: 20,
    backgroundColor: '#E8F5E9', 
    marginRight: 8, 
    marginBottom: 6 
  },
  selectedCategoryButton: { 
    backgroundColor: '#81C784' 
  },
  categoryText: { 
    color: '#2E7D32' 
  },
  selectedCategoryText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
});

export default BasicInfoForm;