// Business/components/PlantBarcodeGenerator.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Linking,
  Share,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';

// Import API services
import { getPlantBarcodeUrl } from '../services/businessWateringApi';

export default function PlantBarcodeGenerator({ 
  visible, 
  onClose, 
  plant,
  businessId 
}) {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [qrCodeValue, setQrCodeValue] = useState(null);
  const [mode, setMode] = useState('download'); // 'download' or 'generate'
  
  // Effect to generate QR code when modal opens
  useEffect(() => {
    if (visible && plant) {
      setIsLoading(true);
      setError(null);
      
      // Create QR code data
      const qrData = {
        type: 'plant',
        id: plant.id,
        name: plant.name || plant.common_name,
        scientific_name: plant.scientificName || plant.scientific_name,
        businessId: businessId,
        barcode: plant.barcode || `PLT-${plant.id}`
      };
      
      setQrCodeValue(JSON.stringify(qrData));
      
      // Get PDF URL from server
      getBarcodePdfUrl();
    }
  }, [visible, plant, businessId]);
  
  // Get barcode PDF URL from server
  const getBarcodePdfUrl = async () => {
    try {
      if (!plant || !plant.id || !businessId) {
        throw new Error('Missing plant information');
      }
      
      const url = await getPlantBarcodeUrl(plant.id, businessId);
      setPdfUrl(url);
      setIsLoading(false);
    } catch (error) {
      console.error('Error getting barcode PDF URL:', error);
      setError('Could not get barcode PDF URL from server');
      
      // Fall back to local generation
      setMode('generate');
      setIsLoading(false);
    }
  };
  
  // Download and share PDF
  const downloadAndSharePdf = async () => {
    if (!pdfUrl) return;
    
    setIsDownloading(true);
    
    try {
      // Generate a filename
      const plantName = (plant.name || plant.common_name || 'plant')
        .toLowerCase()
        .replace(/\s+/g, '-');
      const filename = `${plantName}-barcode.pdf`;
      
      // Get the file URI
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
      
      if (downloadResult.status === 200) {
        // Share the file
        if (Platform.OS === 'ios') {
          // On iOS, use Share API
          await Share.share({
            url: fileUri,
            title: `${plant.name || plant.common_name} Barcode`,
          });
        } else {
          // On Android, use Sharing
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
          } else {
            Alert.alert(
              'Sharing not available',
              'Sharing is not available on this device'
            );
          }
        }
      } else {
        throw new Error('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading and sharing PDF:', error);
      Alert.alert('Error', 'Failed to download and share PDF');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Generate and print barcode PDF locally
  const generateAndPrintPdf = async () => {
    setIsDownloading(true);
    
    try {
      // Generate HTML for printing
      const htmlContent = generateHtml();
      
      // Print the document
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(
          'Sharing not available',
          'Sharing is not available on this device'
        );
      }
    } catch (error) {
      console.error('Error generating and printing PDF:', error);
      Alert.alert('Error', 'Failed to generate and print barcode');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Generate HTML content for PDF
  const generateHtml = () => {
    const plantName = plant.name || plant.common_name || 'Plant';
    const scientificName = plant.scientificName || plant.scientific_name || '';
    const barcode = plant.barcode || `PLT-${plant.id}`;
    
    // Create HTML with inline styles
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${plantName} Barcode</title>
          <style>
            body {
              font-family: 'Helvetica', Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .container {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 20px;
              max-width: 600px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .title {
              font-size: 24px;
              color: #333;
              margin: 0 0 5px 0;
            }
            .subtitle {
              font-size: 16px;
              font-style: italic;
              color: #666;
              margin: 0;
            }
            .qr-placeholder {
              text-align: center;
              margin: 20px 0;
              padding: 40px;
              border: 2px dashed #ccc;
              border-radius: 8px;
            }
            .qr-text {
              margin: 10px 0 0 0;
              color: #666;
            }
            .care-info {
              margin: 20px 0;
            }
            .care-info h2 {
              font-size: 18px;
              color: #4CAF50;
              margin: 0 0 10px 0;
            }
            .care-info table {
              width: 100%;
              border-collapse: collapse;
            }
            .care-info td {
              padding: 8px;
              border-bottom: 1px solid #eee;
            }
            .care-info td:first-child {
              font-weight: bold;
              width: 40%;
            }
            .barcode {
              text-align: center;
              margin-top: 20px;
              font-family: monospace;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 12px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">${plantName}</h1>
              ${scientificName ? `<p class="subtitle">${scientificName}</p>` : ''}
            </div>
            
            <div class="qr-placeholder">
              <p>Scan QR code for plant information</p>
              <p class="qr-text">QR code will appear here when printed</p>
            </div>
            
            <div class="care-info">
              <h2>Care Information</h2>
              <table>
                ${plant.waterDays ? `<tr><td>Water every:</td><td>${plant.waterDays} days</td></tr>` : ''}
                ${plant.light ? `<tr><td>Light:</td><td>${plant.light}</td></tr>` : ''}
                ${plant.temperature ? `<tr><td>Temperature:</td><td>${plant.temperature}</td></tr>` : ''}
                ${plant.humidity ? `<tr><td>Humidity:</td><td>${plant.humidity}</td></tr>` : ''}
              </table>
            </div>
            
            <div class="barcode">
              <p>${barcode}</p>
            </div>
            
            <div class="footer">
              <p>Generated by Greener Business App</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <MaterialIcons name="close" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Plant Barcode</Text>
          
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Generating barcode...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={64} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={getBarcodePdfUrl}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.barcodeCard}>
                <View style={styles.plantInfo}>
                  <Text style={styles.plantName}>
                    {plant?.name || plant?.common_name || 'Plant'}
                  </Text>
                  
                  {(plant?.scientificName || plant?.scientific_name) && (
                    <Text style={styles.scientificName}>
                      {plant.scientificName || plant.scientific_name}
                    </Text>
                  )}
                </View>
                
                <View style={styles.qrCodeContainer}>
                  {qrCodeValue ? (
                    <QRCode
                      value={qrCodeValue}
                      size={200}
                      color="#333"
                      backgroundColor="#fff"
                      logo={require('../../assets/leaf-icon.png')}
                      logoSize={50}
                      logoBackgroundColor="#fff"
                      logoMargin={5}
                    />
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <MaterialCommunityIcons name="qrcode" size={150} color="#ccc" />
                    </View>
                  )}
                </View>
                
                <View style={styles.barcodeInfo}>
                  <Text style={styles.barcodeId}>
                    ID: {plant?.barcode || `PLT-${plant?.id}`}
                  </Text>
                  
                  <Text style={styles.barcodeText}>
                    Print this QR code and place it next to your plant.
                    Customers can scan it to see detailed plant information.
                  </Text>
                </View>
              </View>
              
              <View style={styles.buttonContainer}>
                {mode === 'download' ? (
                  <TouchableOpacity 
                    style={styles.exportButton}
                    onPress={downloadAndSharePdf}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="cloud-download" size={20} color="#fff" />
                        <Text style={styles.exportButtonText}>
                          Download PDF
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.exportButton}
                    onPress={generateAndPrintPdf}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="print" size={20} color="#fff" />
                        <Text style={styles.exportButtonText}>
                          Print Barcode
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.switchModeButton}
                  onPress={() => setMode(mode === 'download' ? 'generate' : 'download')}
                >
                  <MaterialIcons 
                    name={mode === 'download' ? "print" : "cloud-download"} 
                    size={20} 
                    color="#4CAF50" 
                  />
                  <Text style={styles.switchModeText}>
                    {mode === 'download' ? 'Switch to Print Mode' : 'Switch to Download Mode'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  barcodeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  plantInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  plantName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  scientificName: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  barcodeInfo: {
    alignItems: 'center',
  },
  barcodeId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  barcodeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 'auto',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
  },
  switchModeText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
});