import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
} from 'react-native';

/**
 * Component for plant description and care instructions
 * @param {Object} formData The form data object 
 * @param {Object} formErrors Validation errors
 * @param {Function} onChange Handler for form changes
 * @param {string} listingType Type of listing
 */
const DescriptionForm = ({ formData, formErrors, onChange, listingType }) => {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description <Text style={styles.requiredField}>*</Text></Text>
        <TextInput
          style={[
            styles.input, 
            styles.textArea, 
            formErrors.description && styles.inputError
          ]}
          value={formData.description}
          onChangeText={(text) => onChange('description', text)}
          placeholder={
            listingType === 'plant' 
              ? "Describe your plant (size, age, condition, etc.)" 
              : listingType === 'accessory' 
                ? "Describe the accessory (size, material, condition, etc.)" 
                : "Describe the tool (brand, condition, age, etc.)"
          }
          multiline
        />
        {formErrors.description ? (
          <Text style={styles.errorText}>{formErrors.description}</Text>
        ) : null}
      </View>
      
      {listingType === 'plant' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Care Instructions (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.careInstructions}
            onChangeText={(text) => onChange('careInstructions', text)}
            placeholder="Share how to care for this plant"
            multiline
          />
          <Text style={styles.helperText}>
            Providing care instructions can help increase interest in your plant.
            {formData.scientificName ? " Care info will be auto-filled from our database." : ""}
          </Text>
        </View>
      )}
    </>
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
  textArea: { 
    height: 100, 
    textAlignVertical: 'top' 
  },
  inputError: { 
    borderColor: '#f44336' 
  },
  errorText: { 
    color: '#D32F2F', 
    fontSize: 13, 
    marginTop: -8, 
    marginBottom: 8 
  },
  helperText: { 
    color: '#757575', 
    fontSize: 12, 
    marginTop: 4 
  },
});

export default DescriptionForm;