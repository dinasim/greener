// Business/BusinessScreens/BarcodeScannerScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = 250;

export default function BarcodeScannerScreen({ navigation, route }) {
  const { onBarcodeScanned, businessId } = route.params || {};
  
  // State management
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [flashMode, setFlashMode] = useState(Camera.Constants.FlashMode.off);
  const [cameraRatio, setCameraRatio] = useState('16:9');
  
  // Animation refs
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const frameOpacity = useRef(new Animated.Value(0.5)).current;
  const cameraRef = useRef(null);
  
  // Request camera permission
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status === 'granted') {
        // Start scanner animations
        startScanAnimation();
      }
    })();
    
    return () => {
      // Cleanup animations
      scanLineAnim.stopAnimation();
      frameOpacity.stopAnimation();
    };
  }, []);
  
  // Start scan animation
  const startScanAnimation = () => {
    // Breathing effect on the frame
    Animated.loop(
      Animated.sequence([
        Animated.timing(frameOpacity, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(frameOpacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Scanning line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: SCAN_AREA_SIZE,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  // Get optimal camera ratio (Android only)
  const setOptimalRatio = async () => {
    if (Platform.OS === 'android' && cameraRef.current) {
      const ratios = await cameraRef.current.getSupportedRatiosAsync();
      
      // Choose ratio closest to screen aspect ratio
      const screenRatio = height / width;
      let optimalRatio = '16:9';
      let minDiff = Infinity;
      
      ratios.forEach(ratio => {
        const [w, h] = ratio.split(':').map(Number);
        const ratioValue = h / w;
        const diff = Math.abs(ratioValue - screenRatio);
        
        if (diff < minDiff) {
          minDiff = diff;
          optimalRatio = ratio;
        }
      });
      
      setCameraRatio(optimalRatio);
    }
  };
  
  // Handle barcode scan
  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    
    // Vibrate to indicate successful scan
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    setScanned(true);
    
    if (onBarcodeScanned) {
      try {
        // Try to parse as JSON to validate
        const parsedData = JSON.parse(data);
        
        // Simple validation for plant barcode format
        if (parsedData.type === 'plant' && parsedData.id) {
          onBarcodeScanned(data);
          navigation.goBack();
        } else {
          Alert.alert(
            'Invalid Plant Code',
            'The scanned code is not a valid plant barcode.',
            [
              {
                text: 'Scan Again',
                onPress: () => setScanned(false),
              }
            ]
          );
        }
      } catch (error) {
        // Not valid JSON
        Alert.alert(
          'Invalid Barcode Format',
          'Please scan a valid plant barcode.',
          [
            {
              text: 'Scan Again',
              onPress: () => setScanned(false),
            }
          ]
        );
      }
    } else {
      Alert.alert(
        'Barcode Scanned',
        `Type: ${type}\nData: ${data}`,
        [
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
          {
            text: 'Close',
            onPress: () => navigation.goBack(),
            style: 'cancel',
          },
        ]
      );
    }
  };
  
  // Toggle flash mode
  const toggleFlash = () => {
    setFlashMode(
      flashMode === Camera.Constants.FlashMode.off
        ? Camera.Constants.FlashMode.torch
        : Camera.Constants.FlashMode.off
    );
  };
  
  // Handle permission states
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <MaterialIcons name="no-photography" size={64} color="#f44336" />
          <Text style={styles.warningText}>Camera permission is required to scan barcodes.</Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.permissionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent={true} />
      
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants.Type.back}
        flashMode={flashMode}
        ratio={cameraRatio}
        onCameraReady={setOptimalRatio}
        barCodeScannerSettings={{
          barCodeTypes: [
            BarCodeScanner.Constants.BarCodeType.qr,
            BarCodeScanner.Constants.BarCodeType.code128,
            BarCodeScanner.Constants.BarCodeType.code39,
            BarCodeScanner.Constants.BarCodeType.ean13,
            BarCodeScanner.Constants.BarCodeType.pdf417
          ],
        }}
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Scan Plant Barcode</Text>
            
            <TouchableOpacity 
              style={styles.flashButton}
              onPress={toggleFlash}
            >
              <MaterialIcons 
                name={flashMode === Camera.Constants.FlashMode.off ? "flash-off" : "flash-on"} 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.scanArea}>
            {/* Scan window */}
            <Animated.View 
              style={[
                styles.scanFrame,
                { opacity: frameOpacity }
              ]}
            />
            
            {/* Scan corners */}
            <View style={[styles.cornerTL, styles.corner]} />
            <View style={[styles.cornerTR, styles.corner]} />
            <View style={[styles.cornerBL, styles.corner]} />
            <View style={[styles.cornerBR, styles.corner]} />
            
            {/* Moving scan line */}
            <Animated.View 
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanLineAnim }],
                }
              ]}
            />
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.instructionText}>
              Position the plant QR code or barcode within the frame
            </Text>
            
            {scanned && (
              <TouchableOpacity 
                style={styles.scanAgainButton}
                onPress={() => setScanned(false)}
              >
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
                <Text style={styles.scanAgainButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  flashButton: {
    padding: 8,
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#4CAF50',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    width: '100%',
    backgroundColor: '#4CAF50',
    top: 0,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  scanAgainButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanAgainButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  warningText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});