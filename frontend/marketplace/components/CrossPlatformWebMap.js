import React, { forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlFor = ({ center, zoom, markers, radiusKm, maptilerKey, mapMode }) => {
  const payload = {
    center, zoom,
    markers,                       // we’ll provide both lat/lon & latitude/longitude from RN
    radiusMeters: Math.max(0, Number(radiusKm) || 0) * 1000,
    maptilerKey, mapMode
  };
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link href="https://cdn.maptiler.com/maptiler-sdk-js/v1.7.1/maptiler-sdk.css" rel="stylesheet"/>
<style>
  html,body,#map {height:100%; width:100%; margin:0}
  body { background:#fff; direction:ltr }
  #map { position:fixed; inset:0 }
  .pin { width:28px; height:28px; border-radius:14px; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,.3); }
  .pin.plant { background:#41a460 }
  .pin.business { background:#1976D2 }
</style>
</head>
<body>
<div id="map"></div>
<script>
  // pipe console to RN
  (['log','warn','error']).forEach(l => {
    const o = console[l]; console[l] = (...a)=>{ try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'console',level:l,args:a}))}catch(e){}; o.apply(console,a) }
  });

  const cfg = ${JSON.stringify(payload)};
</script>
<script src="https://cdn.maptiler.com/maptiler-sdk-js/v1.7.1/maptiler-sdk.umd.min.js"></script>
<script>
  try { maptilersdk.config.apiKey = cfg.maptilerKey || ''; } catch(e){ console.error('apikey', e?.message||e); }

  const map = new maptilersdk.Map({
    container: 'map',
    style: maptilersdk.MapStyle.STREETS,
    center: [cfg.center.longitude, cfg.center.latitude],
    zoom: cfg.zoom || 12,
    antialias: true
  });

  map.on('load', () => {
    // radius
    if (cfg.radiusMeters > 0) {
      const pts=[], steps=128, R=6378137, d=cfg.radiusMeters/R, lat1=cfg.center.latitude*Math.PI/180, lon1=cfg.center.longitude*Math.PI/180;
      for (let i=0;i<=steps;i++){ const b=i*(2*Math.PI/steps);
        const lat2=Math.asin(Math.sin(lat1)*Math.cos(d)+Math.cos(lat1)*Math.sin(d)*Math.cos(b));
        const lon2=lon1+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat1),Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
        pts.push([lon2*180/Math.PI, lat2*180/Math.PI]); }
      map.addSource('radius-src',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}}});
      map.addLayer({id:'radius-fill',type:'fill',source:'radius-src',paint:{'fill-color':'#41a460','fill-opacity':0.08}});
      map.addLayer({id:'radius-line',type:'line',source:'radius-src',paint:{'line-color':'#41a460','line-width':1}});
    }

    // markers
    (cfg.markers||[]).forEach(m=>{
      const lat = typeof m.latitude==='number' ? m.latitude : m.lat;
      const lon = typeof m.longitude==='number' ? m.longitude : m.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number') return;
      const el = document.createElement('div');
      el.className = 'pin ' + (m.type==='business' ? 'business' : 'plant');
      el.title = m.title || '';
      el.addEventListener('click', ()=> {
        try{ window.ReactNativeWebView.postMessage(JSON.stringify({
          type: m.type==='business' ? 'select-business' : 'select-product', id: m.id
        })) }catch(_){}
      });
      new maptilersdk.Marker({ element: el, anchor:'center' }).setLngLat([lon, lat]).addTo(map);
    });

    try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'})); }catch(_){}
  });

  map.on('error', (e)=> {
    const msg = e?.error?.message || e?.message || 'Failed to fetch';
    // just surface; map usually continues to work
    try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'map_error', error: msg})) }catch(_){}
  });

  window.addEventListener('message', (ev)=>{
    try{
      const msg = JSON.parse(ev.data||'{}');
      if (msg.type==='flyTo' && msg.coords){
        const z = msg.zoom || 12;
        map.flyTo({ center: [msg.coords.longitude, msg.coords.latitude], zoom: z, essential:true });
      }
      if (msg.type==='refreshMarkers' && Array.isArray(msg.markers)){
        document.querySelectorAll('.pin').forEach(x=>x.remove());
        (msg.markers||[]).forEach(m=>{
          const lat = typeof m.latitude==='number' ? m.latitude : m.lat;
          const lon = typeof m.longitude==='number' ? m.longitude : m.lon;
          if (typeof lat !== 'number' || typeof lon !== 'number') return;
          const el = document.createElement('div');
          el.className = 'pin ' + (m.type==='business' ? 'business' : 'plant');
          new maptilersdk.Marker({ element: el, anchor:'center' }).setLngLat([lon, lat]).addTo(map);
        });
      }
    }catch(_){}
  });
</script>
</body>
</html>`;
};

const CrossPlatformWebMap = forwardRef(({
  products = [],
  businesses = [],
  mapMode = 'plants',
  initialRegion,
  searchRadius = 10,
  onSelectProduct,
  onSelectBusiness,
  maptilerKey
}, ref) => {
  const webRef = useRef(null);

  // ✅ Normalize markers: provide BOTH latitude/longitude AND lat/lon
  const markers = useMemo(() => {
    if (mapMode === 'plants') {
      return (products || [])
        .filter(p => p?.location?.latitude != null && p?.location?.longitude != null)
        .map(p => {
          const latitude = Number(p.location.latitude);
          const longitude = Number(p.location.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          return {
            id: p.id || p._id,
            type: 'plant',
            title: p.title || p.name,
            latitude, longitude, lat: latitude, lon: longitude
          };
        })
        .filter(Boolean);
    }
    return (businesses || [])
      .filter(b => (b?.location?.latitude && b?.location?.longitude) || (b?.address?.latitude && b?.address?.longitude))
      .map(b => {
        const latitude = Number(b.location?.latitude ?? b.address.latitude);
        const longitude = Number(b.location?.longitude ?? b.address.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        return {
          id: b.id,
          type: 'business',
          title: b.businessName || b.name,
          latitude, longitude, lat: latitude, lon: longitude
        };
      })
      .filter(Boolean);
  }, [products, businesses, mapMode]);

  const center = useMemo(() => ({
    latitude: Number(initialRegion?.latitude) || 32.0853,
    longitude: Number(initialRegion?.longitude) || 34.7818,
    zoom: Number(initialRegion?.zoom) || 12
  }), [initialRegion]);

  console.log('[CrossPlatformWebMap] Props:', JSON.stringify({
    mapMode, productsCount: products?.length || 0, businessesCount: businesses?.length || 0,
    searchRadius, initialRegion: center,
    hasMapTilerKey: !!maptilerKey, keyPreview: maptilerKey ? maptilerKey.slice(0,8)+'...' : 'no'
  }));
  console.log('[CrossPlatformWebMap] Valid markers:', markers.length);

  const html = useMemo(() => {
    console.log('[CrossPlatformWebMap] Generating HTML with:', JSON.stringify({
      center, searchRadius, markersCount: markers.length
    }));
    return htmlFor({
      center, zoom: center.zoom, markers, radiusKm: searchRadius, maptilerKey, mapMode
    });
  }, [center, markers, searchRadius, maptilerKey, mapMode]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 12) => {
      webRef.current?.postMessage(JSON.stringify({ type: 'flyTo', coords: { latitude: lat, longitude: lng }, zoom }));
    }
  }), []);

  useEffect(() => {
    webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers }));
  }, [markers]);

  const onMessage = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data || '{}');
      if (msg.type === 'console') console[msg.level || 'log']('[WebView]', ...msg.args);
      else if (msg.type === 'ready') console.log('[CrossPlatformWebMap] ready');
      else if (msg.type === 'map_error') console.warn('[WebView] Map error:', msg.error);
      else if (msg.type === 'select-product' && onSelectProduct) onSelectProduct(msg.id);
      else if (msg.type === 'select-business' && onSelectBusiness) onSelectBusiness(msg.id);
    } catch {}
  };

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        javaScriptEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        incognito
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: '#eef3ee' }}
        onLoadStart={() => console.log('[CrossPlatformWebMap] WebView load started')}
        onLoadEnd={() => console.log('[CrossPlatformWebMap] WebView load ended')}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#eef3ee' },
});

export default CrossPlatformWebMap;
