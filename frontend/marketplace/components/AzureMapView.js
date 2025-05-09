// components/AzureMapView.js
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const AzureMapView = ({ products, azureMapsKey }) => {
  const webViewRef = useRef(null);

  // Function to send products data to the WebView
  useEffect(() => {
    if (webViewRef.current) {
      const message = JSON.stringify({
        type: 'UPDATE_PRODUCTS',
        products,
      });
      
      setTimeout(() => {
        webViewRef.current.postMessage(message);
      }, 1000); // Allow time for the WebView to load
    }
  }, [products]);

  // HTML content with Azure Maps
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css" type="text/css" />
      <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // Initialize the map
        var map = new atlas.Map('map', {
          center: [-122.33, 47.6], // Default center (will be updated)
          zoom: 12,
          authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: '${azureMapsKey}'
          }
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
                if (product.location && product.location.longitude && product.location.latitude) {
                  pins.push(
                    new atlas.data.Feature(
                      new atlas.data.Point([product.location.longitude, product.location.latitude]),
                      {
                        title: product.title || product.name,
                        price: product.price,
                        id: product.id
                      }
                    )
                  );
                }
              });
              
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
              if (pins.length > 0) {
                const bounds = atlas.data.BoundingBox.fromData(pins);
                map.setCamera({ bounds: bounds, padding: 50 });
              }
            }
          } catch (e) {
            console.error('Error processing message:', e);
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
      </script>
    </body>
    </html>
  `;

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'PIN_CLICKED') {
        // Handle pin click - navigate to product details, etc.
        console.log(`Pin clicked for product: ${message.productId}`);
        // Navigate to product details
        // navigation.navigate('PlantDetail', { plantId: message.productId });
      }
    } catch (e) {
      console.error('Error handling WebView message:', e);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={false}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
});

export default AzureMapView;