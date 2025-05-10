import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';

const AzureMapView = ({ products, onSelectProduct }) => {
  const webViewRef = useRef(null);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (webViewRef.current && products && products.length > 0) {
      const message = JSON.stringify({
        type: 'UPDATE_PRODUCTS',
        products,
      });

      const timer = setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.postMessage(message);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [products]);

  if (Platform.OS === 'web' || !products || products.length === 0) {
    return (
      <View style={styles.fallbackContainer}>
        <MaterialIcons name="map" size={48} color="#aaa" />
        <Text style={styles.fallbackText}>
          {!products || products.length === 0
            ? "No plant locations available to display on map."
            : "Map view is not available on this platform."}
        </Text>
      </View>
    );
  }

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
        source={{
          html: `<!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                #map {
                  width: 100%;
                  height: 100%;
                  background-color: #f0f0f0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-direction: column;
                }
                .map-content {
                  text-align: center;
                  padding: 20px;
                  max-width: 80%;
                }
                .map-title {
                  font-size: 18px;
                  font-weight: bold;
                  color: #4CAF50;
                  margin-bottom: 10px;
                }
                .map-subtitle {
                  font-size: 14px;
                  color: #666;
                  margin-bottom: 20px;
                }
                .plant-list {
                  text-align: left;
                  background: white;
                  border-radius: 8px;
                  padding: 15px;
                  max-height: 300px;
                  overflow-y: auto;
                  width: 100%;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .plant-item {
                  padding: 8px 0;
                  border-bottom: 1px solid #eee;
                  cursor: pointer;
                }
                .plant-item:hover {
                  background-color: #f9f9f9;
                }
                .plant-title {
                  font-weight: bold;
                  color: #333;
                }
                .plant-price {
                  color: #4CAF50;
                  font-weight: bold;
                }
                .plant-location {
                  font-size: 12px;
                  color: #666;
                }
              </style>
            </head>
            <body>
              <div id="map">
                <div class="map-content">
                  <div class="map-title">Plants Map View</div>
                  <div class="map-subtitle">Simplified view for development</div>
                  <div class="plant-list" id="plantList">
                    Loading plants...
                  </div>
                </div>
              </div>
              <script>
                // Create popup content for future use
                function createPopupContent(product) {
                  const container = document.createElement('div');
                  container.style.padding = '10px';
                  container.style.maxWidth = '200px';

                  const flexContainer = document.createElement('div');
                  flexContainer.style.display = 'flex';
                  flexContainer.style.flexDirection = 'column';

                  const details = document.createElement('div');
                  details.innerHTML = \`
                    <div><strong>\${product.title || product.name}</strong></div>
                    <div>Price: $\${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</div>
                    <div>Location: \${product.location?.city || product.city || 'Unknown'}</div>
                  \`;

                  flexContainer.appendChild(details);
                  container.appendChild(flexContainer);

                  return container;
                }

                document.addEventListener('message', function(event) {
                  try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'UPDATE_PRODUCTS') {
                      const products = message.products;
                      const plantListEl = document.getElementById('plantList');

                      if (products && products.length > 0) {
                        let html = '';
                        products.forEach(product => {
                          const title = product.title || product.name || 'Unnamed Plant';
                          const price = typeof product.price === 'number' ? product.price.toFixed(2) : product.price || '0.00';
                          const location = (product.location && product.location.city) || product.city || 'Unknown location';
                          const id = product.id || product._id || '';

                          html += \`<div class="plant-item" onclick="selectPlant('\${id}')">\`;
                          html += \`<div class="plant-title">\${title}</div>\`;
                          html += \`<div class="plant-price">$\${price}</div>\`;
                          html += \`<div class="plant-location">\${location}</div>\`;
                          html += \`</div>\`;
                        });

                        plantListEl.innerHTML = html;
                      } else {
                        plantListEl.innerHTML = '<div>No plants with location data found</div>';
                      }

                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'PRODUCTS_RECEIVED',
                        count: products ? products.length : 0
                      }));
                    }
                  } catch (e) {
                    console.error('Error handling message:', e);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'ERROR',
                      message: e.message
                    }));
                  }
                });

                function selectPlant(id) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'PIN_CLICKED',
                    productId: id
                  }));
                }

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'MAP_READY'
                }));
              </script>
            </body>
            </html>`
        }}
        style={styles.map}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);

            if (message.type === 'MAP_READY') {
              setIsLoading(false);
            } else if (message.type === 'PIN_CLICKED' && onSelectProduct) {
              onSelectProduct(message.productId);
            } else if (message.type === 'ERROR') {
              console.error('Error in WebView:', message.message);
            }
          } catch (e) {
            console.error('Error parsing WebView message:', e);
          }
        }}
        onError={(error) => {
          console.error('WebView error:', error);
          setIsError(true);
          setErrorMessage(error.nativeEvent?.description || 'Failed to load map');
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        startInLoadingState={true}
        scalesPageToFit={true}
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
    maxWidth: 250,
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
