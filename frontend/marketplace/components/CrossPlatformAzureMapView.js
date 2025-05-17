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

// WebView is mobile-only (Expo / RN)
let WebView;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

/**
 * Cross-platform Azure Map component
 *
 * @param {Array}   products         – plant products; each must include {location:{latitude,longitude}}
 * @param {func}    onSelectProduct  – callback when marker clicked (productId)
 * @param {object}  initialRegion    – {latitude, longitude, zoom}
 * @param {bool}    showControls     – show zoom / compass / style controls
 * @param {string}  mapStyle         – 'road' | 'satellite' | …
 * @param {func}    onMapReady       – callback when underlying map is ready
 * @param {string}  azureMapsKey     – **REQUIRED** Azure Maps subscription key
 */
const CrossPlatformAzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = { latitude: 32.0853, longitude: 34.7818, zoom: 10 },
  showControls = true,
  mapStyle = 'road',
  onMapReady,
  azureMapsKey, // pass securely from env / config
}) => {
  const webViewRef = useRef(null);
  const mapDivRef = useRef(null);         // web-only container
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  /* ------------------------------------------------------------------ */
  /* HTML/JS template injected into WebView or <iframe> (web)           */
  /* ------------------------------------------------------------------ */
  const generateMapHtml = () => {
    // products are injected later via postMessage so initial array may be empty
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
    const map = new atlas.Map('mapContainer',{
      center:[${initialRegion.longitude},${initialRegion.latitude}],
      zoom:${initialRegion.zoom},
      view:'Auto',
      style:'${mapStyle}',
      showLogo:false,
      authOptions:{authType:'subscriptionKey',subscriptionKey:'${azureMapsKey}'}
    });

    let src=null,clusterSrc=null,popup=null;
    map.events.add('ready',()=>{

      src=new atlas.source.DataSource();
      clusterSrc=new atlas.source.DataSource(null,{cluster:true,clusterRadius:45,clusterMaxZoom:15});
      map.sources.add([src,clusterSrc]);

      // individual markers
      map.layers.add(new atlas.layer.SymbolLayer(src,null,{
        iconOptions:{image:'marker-green',anchor:'bottom',allowOverlap:true,size:1.0}
      }));
      // cluster bubbles
      map.layers.add(new atlas.layer.BubbleLayer(clusterSrc,null,{
        radius:12,color:'#4CAF50',strokeColor:'white',strokeWidth:2,filter:['has','point_count']
      }));
      // cluster labels
      map.layers.add(new atlas.layer.SymbolLayer(clusterSrc,null,{
        iconOptions:{image:'none'},
        textOptions:{textField:['get','point_count_abbreviated'],color:'white',size:12,font:['SegoeUi-Bold']},
        filter:['has','point_count']
      }));

      popup=new atlas.Popup({pixelOffset:[0,-30],closeButton:false});

      function makePopupContent(props,pos){
        const div=document.createElement('div');
        div.className='popup-content';
        div.innerHTML=\`
          <strong>\${props.title}</strong><br>
          <span style="color:#4caf50;font-weight:bold;">$\${(+props.price).toFixed(2)}</span><br>
          <small>\${props.location||''}</small><br>
        \`;
        const btn=document.createElement('button');
        btn.textContent='View';
        btn.onclick=()=>selectProduct(props.id);
        div.appendChild(btn);
        popup.setOptions({content:div,position:pos});
        popup.open(map);
      }

      function selectProduct(id){
        if(window.ReactNativeWebView){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'PIN_CLICKED',productId:id}));
        }else{
          window.parent?.postMessage(JSON.stringify({type:'PIN_CLICKED',productId:id}),'*');
          document.dispatchEvent(new CustomEvent('pinclicked',{detail:{productId:id}}));
        }
      }

      map.events.add('click',src,(e)=>{
        const s=e.shapes?.[0];
        if(!s)return;
        makePopupContent(s.getProperties(),s.getCoordinates());
      });

      map.events.add('click',clusterSrc,(e)=>{
        const shape=e.shapes?.[0];
        if(!shape)return;
        const props=shape.getProperties();
        if(!props.cluster)return;
        const ptCount=props.point_count;
        if(ptCount<100){
          map.setCamera({center:e.position,zoom:map.getCamera().zoom+1});
        }else{
          popup.setOptions({
            content:\`<div style="text-align:center"><strong>\${ptCount} plants</strong><br><button onclick="map.setCamera({center:[\${e.position[0]},\${e.position[1]}],zoom:map.getCamera().zoom+2})">Zoom In</button></div>\`,
            position:e.position
          });
          popup.open(map);
        }
      });

      // signal ready
      sendMsg({type:'MAP_READY'});
    });

    function updateMarkers(list){
      if(!src||!clusterSrc)return;
      src.clear();clusterSrc.clear();
      if(!Array.isArray(list)||!list.length)return;

      const points=list.reduce((arr,p)=>{
        const lat=p.location?.latitude,lon=p.location?.longitude;
        if(lat==null||lon==null)return arr;
        const common={
          id:p.id||p._id||Math.random().toString(36).slice(2),
          title:p.title||p.name||'Plant',
          price:p.price||0,
          location:p.city||p.location?.city||'',
        };
        arr.push(new atlas.data.Feature(new atlas.data.Point([lon,lat]),common));
        return arr;
      },[]);

      src.add(points);
      clusterSrc.add(points);

      if(points.length===1){
        map.setCamera({center:points[0].geometry.coordinates,zoom:13});
      }else if(points.length>1){
        const bounds=atlas.data.BoundingBox.fromData(points);
        map.setCamera({bounds,padding:50});
      }
    }

    /* ---------- messaging bridge ---------- */
    function sendMsg(obj){
      const str=JSON.stringify(obj);
      if(window.ReactNativeWebView){
        window.ReactNativeWebView.postMessage(str);
      }else{
        window.parent?.postMessage(str,'*');
      }
    }

    window.handleMessage=(raw)=>{
      try{
        const msg=JSON.parse(raw);
        if(msg.type==='UPDATE_PRODUCTS') updateMarkers(msg.products);
        if(msg.type==='SET_REGION'){
          map.setCamera({center:[msg.longitude,msg.latitude],zoom:msg.zoom||map.getCamera().zoom});
        }
        if(msg.type==='SELECT_PRODUCT'){
          const feats=src.getShapes();
          for(const f of feats){
            if(f.getProperties().id===msg.productId){
              const pos=f.getCoordinates();
              makePopupContent(f.getProperties(),pos);
              map.setCamera({center:pos,zoom:15});
              break;
            }
          }
        }
      }catch(e){console.error(e);}
    };
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
              event.source?.handleMessage?.(
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
        title="AzureMap"
        srcDoc={generateMapHtml()}
        style={{ width: '100%', height: '100%', border: 'none' }}
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
      {isLoading && renderLoading()}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Main return                                                         */
  /* ------------------------------------------------------------------ */
  if (!azureMapsKey) return renderError();
  if (!products?.length) return renderEmpty();
  if (isError) return renderError();

  return Platform.OS === 'web' ? <WebMap /> : <NativeMap />;
};

/* -------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  /* overlays */
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, color: '#4CAF50', fontSize: 16 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fafafa',
  },
  errorText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 12 },
  errorDescription: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  emptyText: { fontSize: 16, color: '#666', marginTop: 12 },
});

export default CrossPlatformAzureMapView;
