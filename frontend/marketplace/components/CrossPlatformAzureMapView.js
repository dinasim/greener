// components/CrossPlatformAzureMapView.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getAzureMapsKey } from '../services/azureMapsService';

// WebView is mobile-only (Expo / RN)
let WebView;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

/**
 * Enhanced Cross-platform Azure Map component
 * Works on both web and mobile platforms
 * Improved pin visualization and circle radius display
 */
const CrossPlatformAzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = { latitude: 32.0853, longitude: 34.7818, zoom: 10 },
  showControls = true,
  mapStyle = 'road',
  onMapReady,
  searchRadius,
  onMapPress,
  azureMapsKey: providedKey = null, // Allow direct key prop but fall back to service
  useCustomPin = false,
  showMyLocation = false,
  myLocation = null
}) => {
  const webViewRef = useRef(null);
  const mapDivRef = useRef(null);
  const iframeRef = useRef(null);
  
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [azureMapsKey, setAzureMapsKey] = useState(providedKey);
  const [isKeyLoading, setIsKeyLoading] = useState(!providedKey);

  // Load Azure Maps key if not provided as prop
  useEffect(() => {
    if (providedKey) {
      setAzureMapsKey(providedKey);
      setIsKeyLoading(false);
      return;
    }
    
    const loadKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        console.log(`Azure Maps key loaded successfully`);
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error loading Azure Maps key:', err);
        setIsError(true);
        setErrorMessage('Failed to load map configuration. Please try again later.');
        setIsKeyLoading(false);
      }
    };
    
    loadKey();
  }, [providedKey]);

  // Effect to draw search radius when it changes
  useEffect(() => {
    if (!mapReady || !searchRadius) return;
    
    const drawRadius = () => {
      if (!initialRegion?.latitude || !initialRegion?.longitude) return;
      
      const msg = { 
        type: 'DRAW_RADIUS', 
        latitude: initialRegion.latitude, 
        longitude: initialRegion.longitude,
        radius: searchRadius
      };
      
      try {
        if (Platform.OS === 'web') {
          const iframe = document.getElementById('azureMapsIframe');
          if (iframe?.contentWindow?.handleMessage) {
            iframe.contentWindow.handleMessage(msg);
          }
        } else if (webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `window.handleMessage(${JSON.stringify(msg)}); true;`
          );
        }
      } catch (err) {
        console.error('Error sending radius message:', err);
      }
    };
    
    drawRadius();
  }, [searchRadius, mapReady, initialRegion]);

  // Effect to show user's current location
  useEffect(() => {
    if (!mapReady || !showMyLocation || !myLocation?.latitude || !myLocation?.longitude) return;
    
    const showUserLocation = () => {
      const msg = { 
        type: 'SHOW_MY_LOCATION', 
        latitude: myLocation.latitude, 
        longitude: myLocation.longitude
      };
      
      try {
        if (Platform.OS === 'web') {
          const iframe = document.getElementById('azureMapsIframe');
          if (iframe?.contentWindow?.handleMessage) {
            iframe.contentWindow.handleMessage(msg);
          }
        } else if (webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `window.handleMessage(${JSON.stringify(msg)}); true;`
          );
        }
      } catch (err) {
        console.error('Error sending location message:', err);
      }
    };
    
    showUserLocation();
  }, [myLocation, showMyLocation, mapReady]);

  // Generate the HTML template for the map view
  const generateMapHtml = useCallback(() => {
    if (!azureMapsKey) {
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 20px; text-align: center; color: #f44336;">
          <h2>Error: Azure Maps Key Missing</h2>
          <p>The Azure Maps key was not provided to the component.</p>
        </body>
        </html>
      `;
    }
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
  <title>Greener – Azure Maps</title>
  <link
    rel="stylesheet"
    href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css"
  />
  <style>
    html,body,#mapContainer{margin:0;padding:0;width:100%;height:100%;}
    .popup-content{padding:12px;max-width:250px;font-family:Arial,Helvetica,sans-serif}
    .popup-content strong{font-size:16px;color:#333}
    .popup-price{font-size:15px;color:#4caf50;font-weight:bold;margin:5px 0}
    .popup-location{font-size:13px;color:#666;margin-bottom:5px}
    .popup-distance{font-size:12px;color:#888;margin-bottom:8px}
    .popup-button{background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}
    .popup-button:hover{opacity:.9}
    .search-radius{stroke:rgba(76,175,80,0.8);stroke-width:2;stroke-dasharray:5,5;fill:rgba(76,175,80,0.1)}
    .pin-label{background:white;border:2px solid #4caf50;color:#333;font-weight:bold;padding:3px 8px;border-radius:12px;}
    .plant-pin{width:28px;height:36px;}
    .debug-info{position:absolute;bottom:10px;left:10px;background:rgba(255,255,255,0.8);padding:10px;border-radius:5px;font-family:monospace;z-index:1000;max-width:80%;overflow:auto;display:none;}
    .my-location-pulse {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #4285f4;
      border: 2px solid white;
      box-shadow: 0 0 0 rgba(66, 133, 244, 0.4);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(66, 133, 244, 0);
      }
    }
  </style>
</head>
<body>
  <div id="mapContainer"></div>
  <div id="debug" class="debug-info"></div>
  <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
  <script>
    // Variables to store map objects
    let map = null;
    let datasource = null;
    let userLocationDataSource = null;
    let radiusCircleDataSource = null;
    let popup = null;
    
    // Custom plant pin SVG - much nicer visualization
    const plantPinSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><g fill="none"><path fill="#4CAF50" d="M14 0C6.268 0 0 6.268 0 14c0 5.025 2.65 9.428 6.625 11.9L14 36l7.375-10.1C25.35 23.428 28 19.025 28 14 28 6.268 21.732 0 14 0z"/><circle cx="14" cy="14" r="8" fill="#fff"/><path fill="#4CAF50" d="M17.8 10.3c-.316.3-3.9 3.8-3.9 6.5 0 1.545 1.355 2.8 2.9 2.8.5 0 .8-.4.8-.8 0-.4-.3-.8-.8-.8-.7 0-1.3-.6-1.3-1.3 0-1.8 2.684-4.5 2.9-4.7.3-.3.3-.9 0-1.2-.3-.4-.9-.4-1.2 0-.1.1-.2.2-.4.5m-5.6-1.6c-.3-.3-.8-.3-1.1 0-.3.3-.3.8 0 1.1.1.1 2.7 2.7 2.7 5.3 0 .7-.5 1.2-1.2 1.2-.4 0-.8.3-.8.8 0 .4.3.8.8.8 1.5 0 2.8-1.3 2.8-2.8-.1-3.2-3-5.8-3.2-6.4z"/></g></svg>';
    
    // My location arrow svg
    const myLocationSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#4285f4" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/></svg>';

    // Create canvas elements for custom markers
    const plantPinCanvas = document.createElement('canvas');
    const plantPinCtx = plantPinCanvas.getContext('2d');
    const plantPinImg = new Image();
    plantPinImg.src = 'data:image/svg+xml;base64,' + btoa(plantPinSvg);

    const myLocationCanvas = document.createElement('canvas');
    const myLocationCtx = myLocationCanvas.getContext('2d');
    const myLocationImg = new Image();
    myLocationImg.src = 'data:image/svg+xml;base64,' + btoa(myLocationSvg);

    // Log function for debugging
    function log(message) {
      console.log("AZURE MAPS:", message);
    }

    // Initialize map when the page loads
    window.onload = function() {
      try {
        // Initialize the map
        log("Initializing Azure Maps");
        
        // Create map instance
        map = new atlas.Map('mapContainer', {
          center: [${initialRegion.longitude}, ${initialRegion.latitude}],
          zoom: ${initialRegion.zoom},
          style: '${mapStyle}',
          showLogo: false,
          authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: '${azureMapsKey}'
          }
        });

        // Setup pin images
        plantPinImg.onload = function() {
          plantPinCanvas.width = plantPinImg.width;
          plantPinCanvas.height = plantPinImg.height;
          plantPinCtx.drawImage(plantPinImg, 0, 0);
        };

        myLocationImg.onload = function() {
          myLocationCanvas.width = myLocationImg.width;
          myLocationCanvas.height = myLocationImg.height;
          myLocationCtx.drawImage(myLocationImg, 0, 0);
        };

        // Add event handlers
        map.events.add('ready', function() {
          log("Map is ready");
          
          // Create data sources
          datasource = new atlas.source.DataSource();
          userLocationDataSource = new atlas.source.DataSource();
          radiusCircleDataSource = new atlas.source.DataSource();
          
          // Add data sources to map
          map.sources.add([datasource, userLocationDataSource, radiusCircleDataSource]);

          // Add the plant pins layer
          map.imageSprite.add('plant-pin', plantPinImg);
          map.imageSprite.add('my-location', myLocationImg);
          
          // Add a symbol layer for plants
          map.layers.add(new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
              image: 'plant-pin',
              anchor: 'bottom',
              allowOverlap: true
            }
          }));

          // Add radius circle layers
          map.layers.add(new atlas.layer.PolygonLayer(radiusCircleDataSource, null, {
            fillColor: 'rgba(76, 175, 80, 0.15)',
            fillOpacity: 0.6
          }));
          
          map.layers.add(new atlas.layer.LineLayer(radiusCircleDataSource, null, {
            strokeColor: 'rgba(76, 175, 80, 0.8)',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            strokeOpacity: 0.8
          }));

          // Add user location layer
          map.layers.add(new atlas.layer.SymbolLayer(userLocationDataSource, null, {
            iconOptions: {
              image: 'my-location',
              anchor: 'center',
              allowOverlap: true,
              size: 1
            }
          }));

          // Create a popup
          popup = new atlas.Popup({
            pixelOffset: [0, -35],
            closeButton: true
          });

          // Add click events
          map.events.add('click', function(e) {
            if (e.shapes && e.shapes.length > 0) {
              // Click on a plant pin
              const properties = e.shapes[0].getProperties();
              
              // Create popup content
              const content = document.createElement('div');
              content.className = 'popup-content';
              content.innerHTML = \`
                <strong>\${properties.title || 'Plant'}</strong>
                <div class="popup-price">$\${parseFloat(properties.price || 0).toFixed(2)}</div>
                <div class="popup-location">\${properties.location || ''}</div>
                \${properties.distance ? '<div class="popup-distance">Distance: ' + properties.distance.toFixed(2) + ' km</div>' : ''}
              \`;
              
              // Add button
              const button = document.createElement('button');
              button.className = 'popup-button';
              button.textContent = 'View Details';
              button.onclick = function() {
                // Send message to parent
                sendMessage({
                  type: 'PIN_CLICKED',
                  productId: properties.id
                });
              };
              content.appendChild(button);
              
              // Show popup
              popup.setOptions({
                content: content,
                position: e.shapes[0].getCoordinates()
              });
              popup.open(map);
            } else {
              // Click on map
              popup.close();
              
              // Send coordinates
              sendMessage({
                type: 'MAP_CLICKED',
                coordinates: {
                  latitude: e.position[1],
                  longitude: e.position[0]
                }
              });
            }
          });

          // Tell the React component the map is ready
          sendMessage({ type: 'MAP_READY' });
          
          // Add initial products if available
          if (${JSON.stringify(products).length} > 2) {
            updateMarkers(${JSON.stringify(products)});
          }
        });

        // Handle errors
        map.events.add('error', function(e) {
          log("Map error: " + JSON.stringify(e));
          sendMessage({ 
            type: 'MAP_ERROR', 
            error: e.error ? e.error.toString() : 'Unknown map error'
          });
        });
      } catch (e) {
        log("Map initialization error: " + e.toString());
        sendMessage({ 
          type: 'ERROR', 
          message: e.toString() 
        });
      }
    };

    // Update markers
    function updateMarkers(list) {
      if (!datasource || !map) {
        log("Cannot update markers: datasource not initialized");
        return;
      }
      
      datasource.clear();
      
      if (!Array.isArray(list) || !list.length) {
        log("No products to display on map");
        return;
      }

      log("Adding " + list.length + " products to map");
      
      // Add points to datasource
      list.forEach(function(p) {
        const lat = p.location?.latitude;
        const lon = p.location?.longitude;
        
        if (lat == null || lon == null) {
          log("Product missing coordinates: " + (p.id || p._id || 'unknown'));
          return;
        }
        
        // Add point to datasource
        datasource.add(new atlas.data.Feature(
          new atlas.data.Point([lon, lat]),
          {
            id: p.id || p._id || Math.random().toString(36).slice(2),
            title: p.title || p.name || 'Plant',
            price: p.price || 0,
            location: p.city || p.location?.city || '',
            distance: p.distance || 0,
            rating: p.rating || 0,
            sellerName: p.seller?.name || p.sellerName || 'Unknown Seller',
            sellerRating: p.seller?.rating || 0
          }
        ));
      });

      // Fit map to contain all points
      if (datasource.getShapes().length > 0) {
        map.setCamera({
          bounds: atlas.data.BoundingBox.fromData(datasource.toJson()),
          padding: 50
        });
      }
    }

    // Draw radius circle
    function drawRadiusCircle(center, radiusKm) {
      if (!radiusCircleDataSource || !map) {
        log("Cannot draw radius: datasource not initialized");
        return;
      }
      
      radiusCircleDataSource.clear();
      
      if (!center || !radiusKm) {
        log("Invalid center or radius");
        return;
      }
      
      log("Drawing radius circle: " + radiusKm + "km");
      
      // Create circle
      const radius = radiusKm * 1000; // Convert to meters
      const circle = atlas.math.getRegularPolygonPath(center, radius, 64);
      
      // Add to datasource
      radiusCircleDataSource.add(new atlas.data.Feature(
        new atlas.data.Polygon([circle])
      ));
    }

    // Show user location
    function showUserLocation(latitude, longitude) {
      if (!userLocationDataSource || !map) {
        log("Cannot show user location: datasource not initialized");
        return;
      }
      
      userLocationDataSource.clear();
      
      if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
        log("Invalid user location coordinates");
        return;
      }
      
      log("Showing user location at: " + latitude + ", " + longitude);
      
      // Add user location point
      userLocationDataSource.add(new atlas.data.Feature(
        new atlas.data.Point([longitude, latitude])
      ));
      
      // Center map on location
      map.setCamera({
        center: [longitude, latitude],
        zoom: 15
      });
    }

    // Message handling
    window.handleMessage = function(data) {
      try {
        // Make sure data is an object
        let message = data;
        if (typeof data === 'string') {
          message = JSON.parse(data);
        }
        
        log("Received message: " + message.type);
        
        switch (message.type) {
          case 'UPDATE_PRODUCTS':
            updateMarkers(message.products);
            break;
          case 'DRAW_RADIUS':
            drawRadiusCircle(
              [message.longitude, message.latitude],
              message.radius
            );
            break;
          case 'CLEAR_RADIUS':
            if (radiusCircleDataSource) {
              radiusCircleDataSource.clear();
            }
            break;
          case 'SHOW_MY_LOCATION':
            showUserLocation(message.latitude, message.longitude);
            break;
          case 'SET_REGION':
            if (map) {
              map.setCamera({
                center: [message.longitude, message.latitude],
                zoom: message.zoom || map.getCamera().zoom
              });
            }
            break;
        }
      } catch (e) {
        log("Error handling message: " + e.toString());
      }
    };

    // Send message to parent
    function sendMessage(obj) {
      try {
        const str = JSON.stringify(obj);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(str);
        } else {
          window.parent.postMessage(str, '*');
        }
      } catch (e) {
        log("Error sending message: " + e.toString());
      }
    }
  </script>
  <script src="https://atlas.microsoft.com/sdk/javascript/service/2/atlas-service.min.js"></script>
</body>
</html>
`;
  }, [azureMapsKey, initialRegion, mapStyle, products]);

  /* ------------------------------------------------------------------ */
  /* WEB: initialize Azure Maps inside <iframe> once container ready    */
  /* ------------------------------------------------------------------ */
  const initWebMap = useCallback(() => {
    if (Platform.OS !== 'web' || !mapDivRef.current) return;

    const handleMsg = (event) => {
      if (!event.data) return;
      
      try {
        // Parse message if it's a string
        let data;
        if (typeof event.data === 'string') {
          data = JSON.parse(event.data);
        } else {
          console.log("Received non-string message from map, skipping JSON parsing");
          return;
        }
        
        console.log("Map message received:", data.type);
        
        switch (data.type) {
          case 'MAP_READY':
            setIsLoading(false);
            setMapReady(true);
            onMapReady?.();
            if (products?.length) {
              const iframe = document.getElementById('azureMapsIframe');
              if (iframe?.contentWindow?.handleMessage) {
                iframe.contentWindow.handleMessage({
                  type: 'UPDATE_PRODUCTS',
                  products
                });
              }
            }
            break;
          case 'PIN_CLICKED':
            onSelectProduct?.(data.productId);
            break;
          case 'MAP_CLICKED':
            onMapPress?.(data.coordinates);
            break;
          case 'MAP_ERROR':
          case 'ERROR':
            console.error("Map error:", data.message || data.error);
            setIsError(true);
            setErrorMessage(data.message || data.error || 'Unknown error');
            break;
        }
      } catch (err) {
        console.error("Error handling map message:", err);
      }
    };

    window.addEventListener('message', handleMsg);

    return () => window.removeEventListener('message', handleMsg);
  }, [products, onMapReady, onSelectProduct, onMapPress]);

  useEffect(initWebMap, [initWebMap]);

  /* ------------------------------------------------------------------ */
  /* Mobile: WebView message handler                                     */
  /* ------------------------------------------------------------------ */
  const handleWebViewMessage = (e) => {
    try {
      // Parse message if it's a string
      let data;
      if (typeof e.nativeEvent.data === 'string') {
        data = JSON.parse(e.nativeEvent.data);
      } else {
        console.log("Received non-string WebView message, skipping JSON parsing");
        return;
      }
      
      console.log("WebView message received:", data.type);
      
      switch (data.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          onMapReady?.();
          break;
        case 'PIN_CLICKED':
          onSelectProduct?.(data.productId);
          break;
        case 'MAP_CLICKED':
          onMapPress?.(data.coordinates);
          break;
        case 'MAP_ERROR':
        case 'ERROR':
          console.error("Map error:", data.message || data.error);
          setIsError(true);
          setErrorMessage(data.message || data.error || 'Unknown error');
          break;
      }
    } catch (err) {
      console.error("Error handling WebView message:", err);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Send marker updates after first MAP_READY                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mapReady || !products?.length) return;

    console.log("Updating map products:", products.length);
    
    try {
      const msg = { type: 'UPDATE_PRODUCTS', products };
      
      if (Platform.OS === 'web') {
        const iframe = document.getElementById('azureMapsIframe');
        if (iframe?.contentWindow?.handleMessage) {
          iframe.contentWindow.handleMessage(msg);
        }
      } else if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.handleMessage(${JSON.stringify(msg)}); true;`
        );
      }
    } catch (err) {
      console.error("Error sending product updates:", err);
    }
  }, [products, mapReady]);

  /* ------------------------------------------------------------------ */
  /* Render helpers                                                     */
  /* ------------------------------------------------------------------ */
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.loadingText}>Loading map…</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={48} color="#f44336" />
      <Text style={styles.errorText}>Map failed to load</Text>
      {errorMessage ? (
        <Text style={styles.errorDescription}>{errorMessage}</Text>
      ) : null}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* WEB platform                                                        */
  /* ------------------------------------------------------------------ */
  const WebMap = () => (
    <View style={styles.container} ref={mapDivRef}>
      <iframe
        id="azureMapsIframe"
        ref={iframeRef}
        title="AzureMap"
        srcDoc={generateMapHtml()}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin"
      />
      {isLoading && renderLoading()}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Mobile / native platform                                            */
  /* ------------------------------------------------------------------ */
  const NativeMap = () => (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHtml() }}
        onMessage={handleWebViewMessage}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
        onError={(e) => {
          console.error('WebView error:', e.nativeEvent);
          setIsLoading(false);
          setIsError(true);
          setErrorMessage(e.nativeEvent.description || 'WebView error');
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        style={styles.map}
      />
      {isLoading && renderLoading()}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Main return                                                         */
  /* ------------------------------------------------------------------ */
  if (!azureMapsKey) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Azure Maps API Key Missing</Text>
        <Text style={styles.errorDescription}>
          Could not load map configuration. Please try again later.
        </Text>
      </View>
    );
  }
  
  if (isError) return renderError();

  return Platform.OS === 'web' ? <WebMap /> : <NativeMap />;
};

/* -------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    position: 'relative'
  },
  map: { 
    flex: 1 
  },
  
  /* overlays */
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { 
    marginTop: 10, 
    color: '#4CAF50', 
    fontSize: 16 
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fafafa',
  },
  errorText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginTop: 12 
  },
  errorDescription: { 
    fontSize: 14, 
    color: '#666', 
    textAlign: 'center', 
    marginTop: 8 
  }
});

export default CrossPlatformAzureMapView;