import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Enhanced AzureMapView component for displaying plants on a map
 * 
 * @param {Object} props Component props
 * @param {Array} props.products Array of plant products with location data
 * @param {Function} props.onSelectProduct Callback when a plant marker is selected
 * @param {Object} props.initialRegion Initial map region (optional)
 * @param {Boolean} props.showControls Whether to show map controls (optional)
 * @param {String} props.mapStyle Map style - 'road', 'satellite', etc. (optional)
 * @param {Function} props.onMapReady Callback when map is ready (optional)
 */
const AzureMapView = ({ 
  products, 
  onSelectProduct,
  initialRegion = { 
    latitude: 32.0853, 
    longitude: 34.7818, 
    zoom: 10 
  },
  showControls = true,
  mapStyle = 'road',
  onMapReady
}) => {
  const webViewRef = useRef(null);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [activeMarker, setActiveMarker] = useState(null);

  // Screen dimensions for responsive sizing
  const { width, height } = Dimensions.get('window');

  // Generate the HTML content for the map
  const generateMapHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Azure Maps in Greener</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
              html, body {
                  margin: 0;
                  padding: 0;
                  width: 100%;
                  height: 100%;
                  overflow: hidden;
              }
              #mapContainer {
                  width: 100%;
                  height: 100%;
              }
              .popup-content {
                  padding: 8px;
                  max-width: 200px;
              }
              .popup-title {
                  font-weight: bold;
                  font-size: 14px;
                  margin-bottom: 4px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
              }
              .popup-price {
                  color: #4CAF50;
                  font-weight: bold;
                  margin-bottom: 4px;
              }
              .popup-location {
                  font-size: 12px;
                  color: #666;
                  margin-bottom: 8px;
              }
              .popup-button {
                  background-color: #4CAF50;
                  color: white;
                  border: none;
                  padding: 6px 12px;
                  text-align: center;
                  text-decoration: none;
                  display: inline-block;
                  font-size: 12px;
                  margin: 4px 0;
                  cursor: pointer;
                  border-radius: 4px;
              }
              .cluster-popup {
                  text-align: center;
                  padding: 8px;
              }
              .cluster-title {
                  font-weight: bold;
                  margin-bottom: 5px;
              }
              .marker-cluster {
                  color: white;
                  background: #4CAF50;
                  border-radius: 50%;
                  text-align: center;
                  font-weight: bold;
                  border: 2px solid white;
                  font-family: Arial, sans-serif;
              }
          </style>
          <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css" type="text/css" />
          <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
          <script src="https://atlas.microsoft.com/sdk/javascript/service/2/atlas-service.min.js"></script>
      </head>
      <body>
          <div id="mapContainer"></div>
          <script>
              let map;
              let dataSource;
              let clusteredDataSource;
              let popup;
              let markers = {};
              
              function initializeMap() {
                  // Initialize the map instance
                  map = new atlas.Map('mapContainer', {
                      center: [${initialRegion.longitude}, ${initialRegion.latitude}],
                      zoom: ${initialRegion.zoom},
                      view: 'Auto',
                      style: '${mapStyle}',
                      showFeedbackLink: false,
                      showLogo: false,
                      authOptions: {
                          authType: 'subscriptionKey',
                          subscriptionKey: 'YOUR_AZURE_MAPS_KEY' // This should be securely provided by your backend
                      }
                  });

                  // Add map controls if enabled
                  if (${showControls}) {
                      map.controls.add([
                          new atlas.control.ZoomControl(),
                          new atlas.control.CompassControl(),
                          new atlas.control.StyleControl()
                      ], {
                          position: 'top-right'
                      });
                  }

                  // Wait until the map resources are ready
                  map.events.add('ready', function() {
                      // Initialize the data source
                      dataSource = new atlas.source.DataSource();
                      clusteredDataSource = new atlas.source.DataSource(null, {
                          cluster: true,
                          clusterRadius: 45,
                          clusterMaxZoom: 15
                      });
                      
                      map.sources.add(dataSource);
                      map.sources.add(clusteredDataSource);
                      
                      // Add a symbol layer for individual markers
                      map.layers.add(new atlas.layer.SymbolLayer(dataSource, null, {
                          iconOptions: {
                              image: 'marker-green',
                              anchor: 'bottom',
                              allowOverlap: true,
                              size: 1.0
                          }
                      }));
                      
                      // Add a bubble layer for the clusters
                      map.layers.add(new atlas.layer.BubbleLayer(clusteredDataSource, null, {
                          radius: 12,
                          color: '#4CAF50',
                          strokeColor: 'white',
                          strokeWidth: 2,
                          filter: ['has', 'point_count']
                      }));
                      
                      // Add a symbol layer for cluster labels
                      map.layers.add(new atlas.layer.SymbolLayer(clusteredDataSource, null, {
                          iconOptions: {
                              image: 'none'
                          },
                          textOptions: {
                              textField: ['get', 'point_count_abbreviated'],
                              offset: [0, 0.4],
                              color: 'white',
                              size: 12,
                              font: ['SegoeUi-Bold']
                          },
                          filter: ['has', 'point_count']
                      }));
                      
                      // Create a popup instance
                      popup = new atlas.Popup({
                          pixelOffset: [0, -30],
                          closeButton: false
                      });
                      
                      // Add an event for when a marker is clicked
                      map.events.add('click', dataSource, markerClicked);
                      
                      // Add an event for when a cluster is clicked
                      map.events.add('click', clusteredDataSource, clusterClicked);
                      
                      // Notify the React Native app that the map is ready
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'MAP_READY'
                      }));
                      
                      // Check if we already have products data on initialization
                      if (${products && products.length > 0}) {
                          updateProductMarkers(${JSON.stringify(products)});
                      }
                  });
                  
                  // Add mouse events for hover effects on markers
                  map.events.add('mouseover', dataSource, function(e) {
                      if (e.shapes && e.shapes.length > 0) {
                          map.getCanvasContainer().style.cursor = 'pointer';
                      }
                  });
                  
                  map.events.add('mouseout', dataSource, function() {
                      map.getCanvasContainer().style.cursor = 'grab';
                  });
              }
              
              // Handle marker click event
              function markerClicked(e) {
                  if (e.shapes && e.shapes.length > 0) {
                      const properties = e.shapes[0].getProperties();
                      const position = e.shapes[0].getCoordinates();
                      
                      // Create popup content
                      const content = document.createElement('div');
                      content.className = 'popup-content';
                      
                      // Add title
                      const title = document.createElement('div');
                      title.className = 'popup-title';
                      title.textContent = properties.title;
                      content.appendChild(title);
                      
                      // Add price
                      const price = document.createElement('div');
                      price.className = 'popup-price';
                      price.textContent = '$' + parseFloat(properties.price).toFixed(2);
                      content.appendChild(price);
                      
                      // Add location
                      const location = document.createElement('div');
                      location.className = 'popup-location';
                      location.textContent = properties.location || 'Local pickup';
                      content.appendChild(location);
                      
                      // Add view details button
                      const button = document.createElement('button');
                      button.className = 'popup-button';
                      button.textContent = 'View Details';
                      button.onclick = function() {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'PIN_CLICKED',
                              productId: properties.id
                          }));
                      };
                      content.appendChild(button);
                      
                      // Set the popup options
                      popup.setOptions({
                          content: content,
                          position: position
                      });
                      
                      // Open the popup
                      popup.open(map);
                  }
              }
              
              // Handle cluster click event
              function clusterClicked(e) {
                  if (e.shapes && e.shapes.length > 0) {
                      const properties = e.shapes[0].getProperties();
                      
                      if (properties.cluster) {
                          // Get the clustered point count
                          const pointCount = properties.point_count;
                          
                          // If cluster is small enough, zoom in to expand it
                          if (pointCount < 100) {
                              map.setCamera({
                              center: e.position,
                              zoom: map.getCamera().zoom + 1
                              });
                          } else {
                              // For large clusters, show a popup with count
                              const content = document.createElement('div');
                              content.className = 'cluster-popup';
                              
                              const title = document.createElement('div');
                              title.className = 'cluster-title';
                              title.textContent = pointCount + ' plants in this area';
                              content.appendChild(title);
                              
                              const button = document.createElement('button');
                              button.className = 'popup-button';
                              button.textContent = 'Zoom In';
                              button.onclick = function() {
                                  map.setCamera({
                                      center: e.position,
                                      zoom: map.getCamera().zoom + 2
                                  });
                                  popup.close();
                              };
                              content.appendChild(button);
                              
                              popup.setOptions({
                                  content: content,
                                  position: e.position
                              });
                              
                              popup.open(map);
                          }
                      }
                  }
              }
              
              // Update markers when products data changes
              function updateProductMarkers(products) {
                  try {
                      // Clear existing data
                      dataSource.clear();
                      clusteredDataSource.clear();
                      
                      if (!products || products.length === 0) {
                          return;
                      }

                      // Add points to data sources
                      const points = [];
                      const clusterPoints = [];
                      
                      for (const product of products) {
                          // Check if the product has valid location data
                          let lat = null;
                          let lon = null;
                          
                          if (product.location) {
                              if (typeof product.location === 'object') {
                                  lat = product.location.latitude;
                                  lon = product.location.longitude;
                              }
                          }
                          
                          // Skip if no valid coordinates
                          if (!lat || !lon) {
                              continue;
                          }
                          
                          // Create a point for the individual marker
                          const point = new atlas.data.Feature(
                              new atlas.data.Point([lon, lat]),
                              {
                                  id: product.id || product._id,
                                  title: product.title || product.name || 'Plant for sale',
                                  price: product.price || 0,
                                  category: product.category || 'Plant',
                                  location: product.city || 
                                      (product.location && product.location.city) || 
                                      'Local pickup',
                                  image: product.image || product.imageUrl
                              }
                          );
                          
                          points.push(point);
                          
                          // Create a point for the clustered view
                          const clusterPoint = new atlas.data.Feature(
                              new atlas.data.Point([lon, lat]),
                              {
                                  id: product.id || product._id,
                                  title: product.title || product.name || 'Plant for sale'
                              }
                          );
                          
                          clusterPoints.push(clusterPoint);
                      }
                      
                      // Add all points to the data sources
                      if (points.length > 0) {
                          dataSource.add(points);
                          clusteredDataSource.add(clusterPoints);
                          
                          // Fit the map to the data points if there are any
                          if (points.length > 1) {
                              const bounds = atlas.data.BoundingBox.fromData(points);
                              map.setCamera({
                                  bounds: bounds,
                                  padding: 50
                              });
                          } else if (points.length === 1) {
                              // For a single point, center the map on it
                              const point = points[0].geometry.coordinates;
                              map.setCamera({
                                  center: point,
                                  zoom: 13
                              });
                          }
                      }
                  } catch (error) {
                      // Report any errors to the React Native app
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'ERROR',
                          message: 'Error updating markers: ' + error.message
                      }));
                  }
              }
              
              // Initialize map on load
              document.addEventListener('DOMContentLoaded', initializeMap);
              
              // Set up message handler from React Native
              window.handleMessage = function(message) {
                  try {
                      const data = JSON.parse(message);
                      
                      if (data.type === 'UPDATE_PRODUCTS') {
                          updateProductMarkers(data.products);
                      } else if (data.type === 'SET_REGION') {
                          map.setCamera({
                              center: [data.longitude, data.latitude],
                              zoom: data.zoom || map.getCamera().zoom
                          });
                      } else if (data.type === 'SELECT_PRODUCT') {
                          // Find the marker for this product and trigger its click event
                          const features = dataSource.getShapes();
                          for (const feature of features) {
                              const props = feature.getProperties();
                              if (props.id === data.productId) {
                                  markerClicked({
                                      shapes: [feature],
                                      position: feature.getCoordinates()
                                  });
                                  map.setCamera({
                                      center: feature.getCoordinates(),
                                      zoom: 15
                                  });
                                  break;
                              }
                          }
                      }
                  } catch (error) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'ERROR',
                          message: 'Error handling message: ' + error.message
                      }));
                  }
              };
          </script>
      </body>
      </html>
    `;
  };

  // Handle messages from the WebView
  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          if (onMapReady) onMapReady();
          break;
        
        case 'PIN_CLICKED':
          // Call the callback with the selected product ID
          if (onSelectProduct) {
            onSelectProduct(message.productId);
          }
          
          // Update active marker state
          setActiveMarker(message.productId);
          break;
        
        case 'ERROR':
          console.error('Map error:', message.message);
          
          // If it's a critical error, show the error state
          if (message.critical) {
            setIsError(true);
            setErrorMessage(message.message);
          }
          break;
          
        default:
          console.log('Unknown message from map:', message);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  // Send a message to the WebView
  const sendMessageToMap = (message) => {
    if (webViewRef.current && mapReady) {
      webViewRef.current.injectJavaScript(
        `window.handleMessage('${JSON.stringify(message)}'); true;`
      );
    }
  };

  // Update markers when products change
  useEffect(() => {
    if (webViewRef.current && mapReady && products && products.length > 0) {
      sendMessageToMap({
        type: 'UPDATE_PRODUCTS',
        products
      });
    }
  }, [products, mapReady]);

  // Handle WebView errors
  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    setIsError(true);
    setErrorMessage(nativeEvent.description || 'Failed to load map');
    setIsLoading(false);
  };

  // Error state
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Map failed to load</Text>
        {errorMessage ? (
          <Text style={styles.errorDescription}>{errorMessage}</Text>
        ) : null}
      </View>
    );
  }

  // Empty state - no products with location data
  if (!products || products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="location-off" size={48} color="#aaa" />
        <Text style={styles.emptyText}>
          No plants with location data available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHtml() }}
        style={styles.map}
        onMessage={handleWebViewMessage}
        onError={handleWebViewError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        mixedContentMode="always"
        originWhitelist={['*']}
        bounces={false}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#4CAF50',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  errorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default AzureMapView;