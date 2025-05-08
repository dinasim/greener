import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';

// Only inject the styles once when the module is loaded
if (Platform.OS === 'web') {
  // Check if the styles have already been injected
  const existingStyle = document.getElementById('custom-slider-style');
  if (!existingStyle) {
    // Create style element and inject CSS
    const style = document.createElement('style');
    style.id = 'custom-slider-style';
    style.textContent = `
      input[type=range] {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #e0e0e0;
        outline: none;
      }

      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #2e7d32;
        cursor: pointer;
      }

      input[type=range]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #2e7d32;
        cursor: pointer;
      }
    `;
    // Append the style to the document head
    document.head.appendChild(style);
  }
}

/**
 * CustomSlider - A cross-platform slider component
 * Uses HTML input on web and @react-native-community/slider on native
 */
const CustomSlider = (props) => {
  // For web platform, use the HTML input element
  if (Platform.OS === 'web') {
    // Create styles for the HTML range input
    const webStyles = {
      width: props.style?.width || '100%',
      height: props.style?.height || 40,
      // Styling to match your green theme
      accentColor: props.thumbTintColor || '#2e7d32',
      outline: 'none',
      // Additional styling to make it look better
      padding: '8px 0',
    };

    return (
      <input
        type="range"
        min={props.minimumValue || 0}
        max={props.maximumValue || 100}
        value={props.value}
        step={props.step || 1}
        onChange={(e) => {
          if (props.onValueChange) {
            props.onValueChange(parseFloat(e.target.value));
          }
        }}
        style={webStyles}
        disabled={props.disabled}
      />
    );
  } 
  // For native platforms (iOS, Android)
  else {
    try {
      // Use the native slider component
      const Slider = require('@react-native-community/slider').default;
      return <Slider {...props} />;
    } catch (error) {
      console.warn('Failed to load slider component:', error);
      // Return a placeholder view if the slider fails to load
      return (
        <View style={[styles.placeholder, props.style]}>
          {/* This is just a placeholder that will be shown if the slider can't be loaded */}
        </View>
      );
    }
  }
};

const styles = StyleSheet.create({
  placeholder: {
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
});

export default CustomSlider;