// components/CrossPlatformAzureMapView.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapSearchBox from './MapSearchBox';
import RadiusControl from './RadiusControl';

// WebView is mobile-only (Expo / RN)
let WebView;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

/**
 * Cross-platform Azure Map component
 * Works on both web and mobile platforms
 */
const CrossPlatformAzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = { latitude: 32.0853, longitude: 34.7818, zoom: 10 },
  showControls = true,
  mapStyle = 'road',
  onMapReady,
  azureMapsKey, // Azure Maps subscription key directly passed as prop
}) => {
  const webViewRef = useRef(null);
  const mapDivRef = useRef(null);
  const iframeRef = useRef(null);
  
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [showRadiusControl, setShowRadiusControl] = useState(false);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('nearest'); // 'nearest' or 'farthest'

  // Use the Azure Maps key directly from props
  const AZURE_MAPS_KEY = azureMapsKey;

  /* ------------------------------------------------------------------ */
  /* HTML/JS template injected into WebView or <iframe> (web)           */
  /* ------------------------------------------------------------------ */
  const generateMapHtml = () => {
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
    .popup-content{padding:8px;max-width:220px;font-family:Arial,Helvetica,sans-serif}
    button{background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer}
    button:hover{opacity:.9}
  </style>
  <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
  <script src="https://atlas.microsoft.com/sdk/javascript/service/2/atlas-service.min.js"></script>
</head>
<body>
  <div id="mapContainer"></div>
  <script>
    // Initialize the map
    const map = new atlas.Map('mapContainer',{
      center:[${initialRegion.longitude},${initialRegion.latitude}],
      zoom:${initialRegion.zoom},
      view:'Auto',
      style:'${mapStyle}',
      showLogo:false,
      authOptions:{authType:'subscriptionKey',subscriptionKey:'${AZURE_MAPS_KEY}'}
    });

    // Variables to store map objects
    let src = null;
    let clusterSrc = null;
    let popup = null;
    let radiusCircle = null;
    let searchCircle = null;

    // Map ready event
    map.events.add('ready', () => {
      // Create data sources
      src = new atlas.source.DataSource();
      clusterSrc = new atlas.source.DataSource(null, {
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 15
      });
      map.sources.add([src, clusterSrc]);

      // Add a layer for individual markers
      map.layers.add(new atlas.layer.SymbolLayer(src, null, {
        iconOptions: {
          image: 'marker-green',
          anchor: 'bottom',
          allowOverlap: true,
          size: 1.0
        }
      }));

      // Add a bubble layer for clusters
      map.layers.add(new atlas.layer.BubbleLayer(clusterSrc, null, {
        radius: 12,
        color: '#4CAF50',
        strokeColor: 'white',
        strokeWidth: 2,
        filter: ['has', 'point_count']
      }));

      // Add a symbol layer for cluster labels
      map.layers.add(new atlas.layer.SymbolLayer(clusterSrc, null, {
        iconOptions: { image: 'none' },
        textOptions: {
          textField: ['get', 'point_count_abbreviated'],
          color: 'white',
          size: 12,
          font: ['SegoeUi-Bold']
        },
        filter: ['has', 'point_count']
      }));

      // Create a popup
      popup = new atlas.Popup({
        pixelOffset: [0, -30],
        closeButton: false
      });

      // Create a search radius data source and layer
      radiusCircle = new atlas.source.DataSource();
      map.sources.add(radiusCircle);
      
      // Add a circle layer for search radius
      map.layers.add(new atlas.layer.PolygonLayer(radiusCircle, null, {
        fillColor: 'rgba(255, 0, 0, 0.2)',
        fillOpacity: 0.5
      }));
      
      // Add a line layer for search radius border
      map.layers.add(new atlas.layer.LineLayer(radiusCircle, null, {
        strokeColor: 'red',
        strokeWidth: 2,
        strokeOpacity: 0.8
      }));

      // Function to create popup content
      function makePopupContent(props, pos) {
        const div = document.createElement('div');
        div.className = 'popup-content';
        div.innerHTML = \`
          <strong>\${props.title}</strong><br>
          <span style="color:#4caf50;font-weight:bold;">$\${(+props.price).toFixed(2)}</span><br>
          <small>\${props.location || ''}</small>
          \${props.distance ? '<br><small>Distance: ' + props.distance.toFixed(2) + ' km</small>' : ''}<br>
        \`;
        const btn = document.createElement('button');
        btn.textContent = 'View';
        btn.onclick = () => selectProduct(props.id);
        div.appendChild(btn);
        popup.setOptions({ content: div, position: pos });
        popup.open(map);
      }

      // Function to handle product selection
      function selectProduct(id) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PIN_CLICKED',
            productId: id
          }));
        } else {
          window.parent?.postMessage(JSON.stringify({
            type: 'PIN_CLICKED',
            productId: id
          }), '*');
          document.dispatchEvent(new CustomEvent('pinclicked', {
            detail: { productId: id }
          }));
        }
      }

      // Click event for markers
      map.events.add('click', src, (e) => {
        const s = e.shapes?.[0];
        if (!s) return;
        makePopupContent(s.getProperties(), s.getCoordinates());
      });

      // Click event for clusters
      map.events.add('click', clusterSrc, (e) => {
        const shape = e.shapes?.[0];
        if (!shape) return;
        const props = shape.getProperties();
        if (!props.cluster) return;
        const ptCount = props.point_count;
        if (ptCount < 100) {
          map.setCamera({
            center: e.position,
            zoom: map.getCamera().zoom + 1
          });
        } else {
          popup.setOptions({
            content: \`<div style="text-align:center"><strong>\${ptCount} plants</strong><br><button onclick="map.setCamera({center:[\${e.position[0]},\${e.position[1]}],zoom:map.getCamera().zoom+2})">Zoom In</button></div>\`,
            position: e.position
          });
          popup.open(map);
        }
      });

      // Signal that map is ready
      sendMsg({ type: 'MAP_READY' });
    });

    // Function to update markers
    function updateMarkers(list) {
      if (!src || !clusterSrc) return;
      
      src.clear();
      clusterSrc.clear();
      
      if (!Array.isArray(list) || !list.length) return;

      const points = list.reduce((arr, p) => {
        const lat = p.location?.latitude;
        const lon = p.location?.longitude;
        
        if (lat == null || lon == null) return arr;
        
        const common = {
          id: p.id || p._id || Math.random().toString(36).slice(2),
          title: p.title || p.name || 'Plant',
          price: p.price || 0,
          location: p.city || p.location?.city || '',
          distance: p.distance || 0
        };
        
        arr.push(new atlas.data.Feature(
          new atlas.data.Point([lon, lat]),
          common
        ));
        
        return arr;
      }, []);

      src.add(points);
      clusterSrc.add(points);

      if (points.length === 1) {
        map.setCamera({
          center: points[0].geometry.coordinates,
          zoom: 13
        });
      } else if (points.length > 1) {
        const bounds = atlas.data.BoundingBox.fromData(points);
        map.setCamera({
          bounds,
          padding: 50
        });
      }
    }

    // Function to draw a radius circle
    function drawRadiusCircle(center, radiusKm) {
      if (!radiusCircle) return;
      
      radiusCircle.clear();
      
      if (!center || !radiusKm) return;
      
      // Create a circle polygon
      const circle = atlas.math.getRegularPolygonPath(
        center,
        radiusKm * 1000, // Convert km to meters
        64, // Number of vertices (smooth circle)
        0, // Start angle
        'meters' // Units
      );
      
      radiusCircle.add(new atlas.data.Feature(
        new atlas.data.Polygon([circle]),
        { radius: radiusKm }
      ));
      
      // Fit map to circle
      const buffer = radiusKm * 0.2; // 20% buffer
      const bounds = new atlas.data.BoundingBox(
        center[0] - buffer,
        center[1] - buffer,
        center[0] + buffer,
        center[1] + buffer
      );
      
      map.setCamera({
        bounds,
        padding: 50
      });
    }

    // Messaging bridge
    function sendMsg(obj) {
      const str = JSON.stringify(obj);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(str);
      } else {
        window.parent?.postMessage(str, '*');
      }
    }

    // Handle incoming messages
    window.handleMessage = (raw) => {
      try {
        const msg = JSON.parse(raw);
        
        if (msg.type === 'UPDATE_PRODUCTS') {
          updateMarkers(msg.products);
        }
        
        if (msg.type === 'SET_REGION') {
          map.setCamera({
            center: [msg.longitude, msg.latitude],
            zoom: msg.zoom || map.getCamera().zoom
          });
        }
        
        if (msg.type === 'SELECT_PRODUCT') {
          const feats = src.getShapes();
          for (const f of feats) {
            if (f.getProperties().id === msg.productId) {
              const pos = f.getCoordinates();
              makePopupContent(f.getProperties(), pos);
              map.setCamera({
                center: pos,
                zoom: 15
              });
              break;
            }
          }
        }
        
        if (msg.type === 'DRAW_RADIUS') {
          drawRadiusCircle(
            [msg.longitude, msg.latitude],
            msg.radius
          );
        }
        
        if (msg.type === 'CLEAR_RADIUS') {
          radiusCircle.clear();
        }
        
      } catch (e) {
        console.error('Error handling message:', e);
      }
    };
    
    // Handle clicks outside of markers to close popup
    map.events.add('click', () => {
      popup.close();
    });
  </script>
</body>
</html>
`;
  };

  /* ------------------------------------------------------------------ */
  /* WEB: initialise Azure Maps inside <iframe> once container ready    */
  /* ------------------------------------------------------------------ */
  const initWebMap = useCallback(() => {
    if (Platform.OS !== 'web' || !mapDivRef.current) return;

    const handleMsg = (event) => {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'MAP_READY':
            setIsLoading(false);
            setMapReady(true);
            onMapReady?.();
            if (products?.length) {
              const iframe = document.getElementById('azureMapsIframe');
              iframe?.contentWindow?.handleMessage?.(
                JSON.stringify({ type: 'UPDATE_PRODUCTS', products })
              );
            }
            break;
          case 'PIN_CLICKED':
            onSelectProduct?.(data.productId);
            break;
          case 'ERROR':
            setIsError(true);
            setErrorMessage(data.message || 'Unknown error');
            break;
          default:
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleMsg);

    return () => window.removeEventListener('message', handleMsg);
  }, [products, onMapReady, onSelectProduct]);

  useEffect(initWebMap, [initWebMap]);

  /* ------------------------------------------------------------------ */
  /* Mobile: WebView message handler                                     */
  /* ------------------------------------------------------------------ */
  const handleWebViewMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      switch (data.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          onMapReady?.();
          break;
        case 'PIN_CLICKED':
          onSelectProduct?.(data.productId);
          break;
        case 'ERROR':
          setIsError(true);
          setErrorMessage(data.message || 'Unknown error');
          break;
        default:
      }
    } catch (_) {}
  };

  /* ------------------------------------------------------------------ */
  /* Send marker updates after first MAP_READY                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mapReady || !products?.length) return;

    const msg = { type: 'UPDATE_PRODUCTS', products };
    if (Platform.OS === 'web') {
      const iframe = document.getElementById('azureMapsIframe');
      iframe?.contentWindow?.handleMessage?.(JSON.stringify(msg));
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
      );
    }
  }, [products, mapReady]);

  /* ------------------------------------------------------------------ */
  /* Handle location selection and radius drawing                       */
  /* ------------------------------------------------------------------ */
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setShowRadiusControl(true);
    
    const msg = { 
      type: 'SET_REGION',
      latitude: location.latitude,
      longitude: location.longitude,
      zoom: 12
    };
    
    if (Platform.OS === 'web') {
      const iframe = document.getElementById('azureMapsIframe');
      iframe?.contentWindow?.handleMessage?.(JSON.stringify(msg));
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
      );
    }
    
    // Draw initial radius circle
    drawRadiusCircle(location, searchRadius);
  };

  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
    
    // Draw updated radius circle
    if (selectedLocation) {
      drawRadiusCircle(selectedLocation, radius);
    }
  };

  const drawRadiusCircle = (location, radius) => {
    const msg = { 
      type: 'DRAW_RADIUS',
      latitude: location.latitude,
      longitude: location.longitude,
      radius: radius
    };
    
    if (Platform.OS === 'web') {
      const iframe = document.getElementById('azureMapsIframe');
      iframe?.contentWindow?.handleMessage?.(JSON.stringify(msg));
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
      );
    }
    
    // Filter products by radius
    if (products && products.length > 0) {
      const filtered = filterProductsByRadius(products, location, radius);
      
      // Sort by distance
      const sorted = sortProductsByDistance(filtered, sortOrder === 'nearest');
      
      setNearbyProducts(sorted);
    }
  };
  
  // Function to calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Filter products by radius
  const filterProductsByRadius = (productList, center, radiusKm) => {
    return productList.filter(product => {
      // Skip products without location
      if (!product.location || !product.location.latitude || !product.location.longitude) {
        return false;
      }
      
      // Calculate distance
      const distance = calculateDistance(
        center.latitude,
        center.longitude,
        product.location.latitude,
        product.location.longitude
      );
      
      // Add distance to product
      product.distance = distance;
      
      // Include if within radius
      return distance <= radiusKm;
    });
  };
  
  // Sort products by distance
  const sortProductsByDistance = (productList, ascending = true) => {
    return [...productList].sort((a, b) => {
      const distA = a.distance || 0;
      const distB = b.distance || 0;
      return ascending ? distA - distB : distB - distA;
    });
  };
  
  // Toggle sort order
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'nearest' ? 'farthest' : 'nearest';
    setSortOrder(newOrder);
    
    // Re-sort products
    const sorted = sortProductsByDistance(nearbyProducts, newOrder === 'nearest');
    setNearbyProducts(sorted);
  };

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

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="location-off" size={48} color="#aaa" />
      <Text style={styles.emptyText}>No plants with location data</Text>
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
      />
      
      {/* Location Search */}
      <MapSearchBox onLocationSelect={handleLocationSelect} />
      
      {/* Radius Control */}
      {showRadiusControl && selectedLocation && (
        <View style={styles.radiusControlContainer}>
          <RadiusControl 
            radius={searchRadius}
            onRadiusChange={handleRadiusChange}
          />
          
          {/* Sorting Toggle */}
          {nearbyProducts.length > 0 && (
            <View style={styles.sortingContainer}>
              <Text style={styles.resultsText}>
                {nearbyProducts.length} plants found
              </Text>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={toggleSortOrder}
              >
                <MaterialIcons 
                  name={sortOrder === 'nearest' ? 'arrow-upward' : 'arrow-downward'} 
                  size={16} 
                  color="#fff" 
                />
                <Text style={styles.sortButtonText}>
                  {sortOrder === 'nearest' ? 'Nearest First' : 'Farthest First'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Nearby Products List */}
          {nearbyProducts.length > 0 && (
            <View style={styles.resultsContainer}>
              {nearbyProducts.map(product => (
                <TouchableOpacity 
                  key={product.id || product._id}
                  style={styles.resultItem}
                  onPress={() => onSelectProduct?.(product.id || product._id)}
                >
                  <View style={styles.resultContent}>
                    <Text style={styles.resultTitle}>{product.title || product.name}</Text>
                    <Text style={styles.resultPrice}>${parseFloat(product.price).toFixed(2)}</Text>
                    <Text style={styles.resultDistance}>
                      {product.distance ? `${product.distance.toFixed(2)} km away` : 'Distance unknown'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#4CAF50" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
      
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
        onLoadEnd={() => setIsLoading(false)}
        onError={(e) => {
          setIsLoading(false);
          setIsError(true);
          setErrorMessage(e.nativeEvent.description);
        }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        style={styles.map}
      />
      
      {/* Location Search */}
      <MapSearchBox onLocationSelect={handleLocationSelect} />
      
      {/* Radius Control */}
      {showRadiusControl && selectedLocation && (
        <View style={styles.radiusControlContainer}>
          <RadiusControl 
            radius={searchRadius}
            onRadiusChange={handleRadiusChange}
          />
          
          {/* Sorting Toggle */}
          {nearbyProducts.length > 0 && (
            <View style={styles.sortingContainer}>
              <Text style={styles.resultsText}>
                {nearbyProducts.length} plants found
              </Text>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={toggleSortOrder}
              >
                <MaterialIcons 
                  name={sortOrder === 'nearest' ? 'arrow-upward' : 'arrow-downward'} 
                  size={16} 
                  color="#fff" 
                />
                <Text style={styles.sortButtonText}>
                  {sortOrder === 'nearest' ? 'Nearest First' : 'Farthest First'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Nearby Products List */}
          {nearbyProducts.length > 0 && (
            <View style={styles.resultsContainer}>
              {nearbyProducts.map(product => (
                <TouchableOpacity 
                  key={product.id || product._id}
                  style={styles.resultItem}
                  onPress={() => onSelectProduct?.(product.id || product._id)}
                >
                  <View style={styles.resultContent}>
                    <Text style={styles.resultTitle}>{product.title || product.name}</Text>
                    <Text style={styles.resultPrice}>${parseFloat(product.price).toFixed(2)}</Text>
                    <Text style={styles.resultDistance}>
                      {product.distance ? `${product.distance.toFixed(2)} km away` : 'Distance unknown'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#4CAF50" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
      
      {isLoading && renderLoading()}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Main return                                                         */
  /* ------------------------------------------------------------------ */
  if (!AZURE_MAPS_KEY) {
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

  // Empty state for no products
  if (!products?.length) {
    return (
      <View style={styles.container}>
        {Platform.OS === 'web' ? <WebMap /> : <NativeMap />}
        {renderEmpty()}
      </View>
    );
  }

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
  },
  emptyContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  emptyText: { 
    fontSize: 16, 
    color: '#666', 
    marginTop: 12 
  },
  
  /* Radius control */
  radiusControlContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: '60%', // Maximum height
  },
  
  /* Results */
  sortingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16, 
    maxHeight: 400,
    overflow: 'scroll',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 2,
  },
  resultDistance: {
    fontSize: 12,
    color: '#666',
  },
});

export default CrossPlatformAzureMapView;