// File: components/AzureMapView.js
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';

const AzureMapView = ({ products, onSelectProduct }) => {
  const webViewRef = useRef(null);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Default Azure Maps subscription key - should be replaced with your actual key
  const azureMapsKey = 'your_azure_maps_key';

  // Function to send products data to the WebView
  useEffect(() => {
    if (webViewRef.current && products && products.length > 0) {
      const message = JSON.stringify({
        type: 'UPDATE_PRODUCTS',
        products,
      });
      
      setTimeout(() => {
        webViewRef.current.postMessage(message);
      }, 1000); // Allow time for the WebView to load
    }
  }, [products]);

  // HTML content with Azure Maps and error handling
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css" type="text/css" />
      <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
      <style>
        body { 
          margin: 0; 
          padding: 0; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        #map { 
          width: 100%; 
          height: 100%; 
        }
        #error-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #f5f5f5;
          display: none;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 20px;
          text-align: center;
          z-index: 1000;
        }
        .error-message {
          color: #d32f2f;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .error-details {
          color: #666;
          margin-bottom: 20px;
          font-size: 14px;
        }
        #loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255,255,255,0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 500;
        }
        .loading-text {
          margin-top: 60px;
          color: #4CAF50;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div id="error-container">
        <div class="error-message">Unable to load map</div>
        <div class="error-details">Please check your internet connection or try again later.</div>
      </div>
      <div id="loading">
        <div class="loading-text">Loading map...</div>
      </div>
      
      <script>
        // Error handler function
        function showError(message) {
          document.getElementById('error-container').style.display = 'flex';
          document.getElementById('map').style.display = 'none';
          document.getElementsByClassName('error-details')[0].textContent = message || 'Please check your internet connection or try again later.';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MAP_ERROR',
            message: message
          }));
        }
        
        try {
          // Initialize the map
          var map = new atlas.Map('map', {
            center: [-122.33, 47.6], // Default center (will be updated)
            zoom: 12,
            authOptions: {
              authType: 'subscriptionKey',
              subscriptionKey: '${azureMapsKey}'
            }
          });
          
          // Handle map load errors
          map.events.add('error', function(e) {
            showError('Map error: ' + (e.error ? e.error.message : 'Unknown error'));
          });

          // Handle map ready event
          map.events.add('ready', function() {
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
            
            // Tell React Native that map is ready
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_READY'
            }));
          });

          // Handle messages from React Native
          document.addEventListener('message', function(event) {
            try {
              const message = JSON.parse(event.data);
              
              if (message.type === 'UPDATE_PRODUCTS') {
                // Clear existing pins
                const existingPins = map.sources.getSources().find(s => s.id === 'products-source');
                if (existingPins) {
                  map.sources.remove('products-source');
                }
                
                // Add product pins
                const pins = [];
                const products = message.products;
                
                products.forEach(product => {
                  // Check if product has location data
                  if (product.location && product.location.longitude && product.location.latitude) {
                    pins.push(
                      new atlas.data.Feature(
                        new atlas.data.Point([product.location.longitude, product.location.latitude]),
                        {
                          title: product.title || product.name,
                          price: product.price,
                          id: product.id || product._id
                        }
                      )
                    );
                  } else if (product.city) {
                    // For products with only city, use a mock location
                    // This is just for visualization purposes
                    // In a real app, you would geocode the city name
                    const hash = product.city.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    pins.push(
                      new atlas.data.Feature(
                        new atlas.data.Point([-122.33 + (hash % 20 - 10) / 100, 47.6 + (hash % 20 - 10) / 100]),
                        {
                          title: product.title || product.name,
                          price: product.price,
                          id: product.id || product._id,
                          city: product.city
                        }
                      )
                    );
                  }
                });
                
                if (pins.length > 0) {
                  // Add data source and layer
                  const datasource = new atlas.source.DataSource('products-source');
                  map.sources.add(datasource);
                  datasource.add(pins);
                  
                  // Add a symbol layer using the datasource
                  map.layers.add(new atlas.layer.SymbolLayer(
                    'products-layer', 
                    'products-source', 
                    {
                      iconOptions: {
                        image: 'pin-round-blue'
                      },
                      textOptions: {
                        textField: ['get', 'title'],
                        offset: [0, -1.5]
                      }
                    }
                  ));
                  
                  // Set map bounds to show all pins
                  const bounds = atlas.data.BoundingBox.fromData(pins);
                  map.setCamera({ bounds: bounds, padding: 50 });
                }
              }
            } catch (e) {
              console.error('Error processing message:', e);
              showError('Error processing data: ' + e.message);
            }
          });
          
          // Handle pin clicks
          map.events.add('click', 'products-layer', function(e) {
            if (e && e.shapes && e.shapes[0]) {
              const properties = e.shapes[0].getProperties();
              // Send message back to React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PIN_CLICKED',
                productId: properties.id
              }));
            }
          });
        } catch (e) {
          showError('Failed to initialize map: ' + e.message);
        }
      </script>
    </body>
    </html>
  `;

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'PIN_CLICKED' && onSelectProduct) {
        onSelectProduct(message.productId);
      } else if (message.type === 'MAP_ERROR') {
        setIsError(true);
        setErrorMessage(message.message || 'Failed to load map');
      } else if (message.type === 'MAP_READY') {
        setIsLoading(false);
      }
    } catch (e) {
      console.error('Error handling WebView message:', e);
    }
  };

  // Show error view if WebView has error
  const handleError = (e) => {
    setIsError(true);
    setErrorMessage('Failed to load map: ' + (e?.description || 'Unknown error'));
  };

  // For platforms where WebView might not be available
  if (Platform.OS === 'web' && !WebView) {
    return (
      <View style={styles.fallbackContainer}>
        <MaterialIcons name="map" size={48} color="#aaa" />
        <Text style={styles.fallbackText}>Map view is not available on this platform.</Text>
      </View>
    );
  }

  // Show error state
  if (isError) {
    return (
      <View style={styles.fallbackContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load map</Text>
        <Text style={styles.errorDetailText}>{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.map}
        onMessage={handleMessage}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={false}
        scrollEnabled={false}
      />
      
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loaderText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  fallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#d32f2f',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: 'bold',
  },
  errorDetailText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 32,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4CAF50',
  },
});

export default AzureMapView;