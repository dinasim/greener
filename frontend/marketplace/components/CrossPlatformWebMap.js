// components/CrossPlatformWebMap.js
import React, {
  forwardRef,
  useMemo,
  useRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { geocodeAddress } from '../services/marketplaceApi';

const sameTriplet = (a, b) =>
  a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
  const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
};

const buildHtml = ({
  maptilerKey,
  center,
  zoom,
  markers,
  radiusKm,
  myLocation,
  showMyLocation,
  version = 0,
}) => {
  const safeMarkers = JSON.stringify(markers || []);
  const rMeters = Math.max(0, Number(radiusKm) || 0) * 1000;

  const styleUrl = `https://api.maptiler.com/maps/basic-v2/style.json?key=${encodeURIComponent(maptilerKey)}`;

  const circleJs = `
    function circlePolygon(lon, lat, meters, steps){
      const pts = [];
      const R = 6378137, d = meters / R;
      const lat1 = lat * Math.PI/180, lon1 = lon * Math.PI/180;
      for (let i=0;i<=steps;i++){
        const b = 2*Math.PI*i/steps;
        const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d)+Math.cos(lat1)*Math.sin(d)*Math.cos(b));
        const lon2 = lon1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
        pts.push([lon2*180/Math.PI, lat2*180/Math.PI]);
      }
      return { type:"Feature", geometry:{ type:"Polygon", coordinates:[pts] } };
    }
  `;

  const rtlPluginUrl = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js';

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<build  version="${version}" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link href="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  * { direction: ltr !important; }
  html, body { margin:0; padding:0; height:100vh; width:100vw; background:#f5f5f5; overflow:hidden; direction:ltr !important; }
  #map { position:fixed; inset:0; direction: ltr !important; }
  #map * { direction: ltr !important; text-align: left !important; }
  .maplibregl-ctrl, 
  .maplibregl-popup,
  .mapboxgl-ctrl,
  .mapboxgl-popup { 
    direction: ltr !important; 
    text-align: left !important; 
  }
  #status { position:fixed; top:8px; left:8px; z-index:9999; background:rgba(0,0,0,.75); color:#fff; padding:6px 10px; border-radius:8px; font-family:sans-serif; font-size:12px; display:block; max-width:280px; direction: ltr !important; }

  /* ---------- Stable marker structure ---------- */
  /* OUTER: fixed size, MapLibre anchors to this box (bottom center). */
  .pin {
    position: relative;
    width: 40px;              /* fixed — stable anchor */
    height: 40px;             /* fixed — stable anchor */
    pointer-events: auto;
  }
  /* INNER: we do NOT scale with CSS transforms. We resize with width/height in JS. */
  .pin .inner {
    position: absolute;
    left: 50%;
    bottom: 0;                /* sit on the bottom of the outer container */
    transform: translateX(-50%);    /* center horizontally; no scale here */
    transform-origin: bottom center;
    box-shadow:0 6px 16px rgba(0,0,0,.25);
    border-radius:12px;
    overflow:hidden;
    border:2px solid #fff;
    background:#e9efe9;
  }
  .pin:hover .inner { transform: translateX(-50%) translateY(-2px); } /* tiny lift only */

  /* Base sizes (JS will override via width/height to avoid transform jitter) */
  .pin .inner.thumb    { width:36px; height:36px; }
  .pin .inner.fallback { width:28px; height:28px; display:grid; place-items:center; color:#fff; font-size:14px; }
  .pin .inner.thumb img { width:100%; height:100%; object-fit:cover; display:block; }

  .pin .inner .badge {
    position:absolute; bottom:-8px; left:50%; transform:translateX(-50%);
    background:#111; color:#fff; font-weight:700; font-size:9px; padding:2px 6px; border-radius:999px; white-space:nowrap; box-shadow:0 4px 10px rgba(0,0,0,.25);
  }

  /* Color-code by type */
  .pin .inner.bizProduct .badge { background:#2E7D32; }  /* green */
  .pin .inner.indProduct .badge { background:#1976D2; }  /* blue */
  .pin .inner.business       { background:#FF9800; }     /* orange if no image for a business node */
</style>
</head>
<body>
  <div id="map"></div>
  <div id="status">Loading map…</div>

  <script src="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js"></script>
  <script src="${rtlPluginUrl}"></script>
  <script>
    if (window.mapboxgl && window.mapboxgl.setRTLTextPlugin) {
      window.mapboxgl.setRTLTextPlugin('${rtlPluginUrl}', null, true);
    }
    if (window.maplibregl && window.maplibregl.setRTLTextPlugin) {
      window.maplibregl.setRTLTextPlugin('${rtlPluginUrl}', null, true);
    }

    function send(type, payload){
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type, timestamp: Date.now(), ...payload })
        );
      } catch(_) {}
    }
    function setStatus(msg){
      const el = document.getElementById('status'); if (el) el.textContent = msg;
    }

    ${circleJs}

    const cfg = {
      styleUrl: ${JSON.stringify(styleUrl)},
      center: [${Number(center.longitude)}, ${Number(center.latitude)}],
      zoom: ${Number(zoom) || 12},
      markers: ${safeMarkers},
      radiusMeters: ${rMeters},
      myLocation: ${JSON.stringify(showMyLocation ? myLocation : null)}
    };

    let map, radiusAdded = false, meMarker = null;
    let lastRadiusMeters = cfg.radiusMeters || 0;

    let myLoc = (cfg.myLocation && Number.isFinite(cfg.myLocation.latitude) && Number.isFinite(cfg.myLocation.longitude))
      ? { lon: Number(cfg.myLocation.longitude), lat: Number(cfg.myLocation.latitude) }
      : null;

    function currentRadiusCenter(){
      if (myLoc) return [myLoc.lon, myLoc.lat];
      if (map) { const c = map.getCenter(); return [c.lng, c.lat]; }
      return cfg.center;
    }

    // Track INNER nodes (we'll resize width/height instead of scaling)
    window.__pins = [];
    window.__pinInnerEls = [];

    function applyZoomScale(){
      if (!map) return;

      // You can tweak the size curve here (locked sizes also OK):
      const z = 1;
      const scale = Math.max(0.9, Math.min(1.2, 0.98 + 0.05 * (z - 12))); // gentle

      (window.__pinInnerEls || []).forEach(el => {
        if (!el) return;
        const baseW = Number(el.dataset.basew) || 32; // fallback
        const baseH = Number(el.dataset.baseh) || 32;
        const w = Math.round(baseW * scale);
        const h = Math.round(baseH * scale);
        el.style.width  = w + 'px';
        el.style.height = h + 'px';
      });
    }

    function spreadOverlaps(list, step = 0.0008) {
      const buckets = new Map();
      (list || []).forEach(m => {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) return;
        const key = m.lat.toFixed(5) + ',' + m.lon.toFixed(5);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(m);
      });
      const out = [];
      for (const arr of buckets.values()) {
        if (arr.length === 1) { out.push(arr[0]); continue; }
        const angleStep = (2 * Math.PI) / arr.length;
        arr.forEach((m, i) => {
          out.push({
            ...m,
            lat: m.lat + step * Math.sin(i * angleStep),
            lon: m.lon + step * Math.cos(i * angleStep),
          });
        });
      }
      return out;
    }

    function addMarkers(list){
      (window.__pins || []).forEach(m => m.remove && m.remove());
      window.__pins = [];
      window.__pinInnerEls = [];

      const rendered = spreadOverlaps(list || []);
      rendered.forEach(m => {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) return;

        // OUTER (fixed size)
        const el = document.createElement('div');
        el.className = 'pin';

        // INNER (resized via width/height by JS; no transforms)
        const inner = document.createElement('div');
        const isBizProduct = m.type === 'bizProduct';
        const isIndProduct = m.type === 'indProduct';
        const isBusiness   = m.type === 'business';

        const baseW = m.imageUrl ? 36 : 28;
        const baseH = m.imageUrl ? 36 : 28;

        inner.className = 'inner ' + (m.imageUrl ? 'thumb ' : 'fallback ') + (isBizProduct ? 'bizProduct' : isIndProduct ? 'indProduct' : isBusiness ? 'business' : '');
        inner.dataset.basew = String(baseW);
        inner.dataset.baseh = String(baseH);
        inner.style.width  = baseW + 'px';
        inner.style.height = baseH + 'px';

        if (m.imageUrl) {
          inner.innerHTML = \`<img src="\${m.imageUrl}" alt="">\`;
        } else {
          inner.textContent = isBusiness ? '🏪' : '🌱';
        }

        if (m.priceText && !isBusiness) {
          const badge = document.createElement('div');
          badge.className = 'badge';
          badge.textContent = m.priceText;
          inner.appendChild(badge);
        }

        el.appendChild(inner);
        window.__pinInnerEls.push(inner);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          send(isBusiness ? 'select-business' : 'select-product', { id: m.id });
        });

        const mk = new maplibregl.Marker({ element: el, anchor:'bottom' })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        window.__pins.push(mk);
      });

      applyZoomScale(); // set initial pixel sizes for current zoom
    }

    function ensureRadius(meters){
      lastRadiusMeters = Number(meters) || 0;
      if (!lastRadiusMeters || lastRadiusMeters <= 0){
        try { map.removeLayer('radius-fill'); map.removeLayer('radius-line'); map.removeSource('radius-src'); } catch(_){}
        radiusAdded = false; return;
      }
      const [lon, lat] = currentRadiusCenter();
      const c = circlePolygon(lon, lat, lastRadiusMeters, 96);
      if (!radiusAdded) {
        map.addSource('radius-src', { type:'geojson', data:c });
        map.addLayer({ id:'radius-fill', type:'fill', source:'radius-src', paint:{ 'fill-color':'#4CAF50', 'fill-opacity':0.1 }});
        map.addLayer({ id:'radius-line', type:'line', source:'radius-src', paint:{ 'line-color':'#4CAF50', 'line-width':2, 'line-opacity':0.5 }});
        radiusAdded = true;
      } else {
        const src = map.getSource('radius-src'); src && src.setData(c);
      }
    }

    function setMyLocationPoint(point){
      if (meMarker) { meMarker.remove(); meMarker = null; }
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
        myLoc = null;
        if (lastRadiusMeters > 0) ensureRadius(lastRadiusMeters);
        return;
      }
      myLoc = { lon: Number(point.longitude), lat: Number(point.latitude) };

      const el = document.createElement('div'); 
      el.style.width='16px'; el.style.height='16px';
      el.style.borderRadius='50%'; el.style.background='#2E7D32';
      el.style.border='3px solid #fff';
      el.style.boxShadow='0 0 0 2px rgba(46,125,50,0.35), 0 6px 16px rgba(0,0,0,.25)';

      meMarker = new maplibregl.Marker({ element: el, anchor:'center' })
        .setLngLat([myLoc.lon, myLoc.lat])
        .addTo(map);

      if (lastRadiusMeters > 0) ensureRadius(lastRadiusMeters);
    }

    window.onerror = function(m){ send('console', { level:'error', args:[String(m)] }); };

    (async function init(){
      try{
        map = new maplibregl.Map({
          container: 'map',
          style: cfg.styleUrl,
          center: cfg.center,
          zoom: cfg.zoom,
          attributionControl: false,
          cooperativeGestures: false,
          failIfMajorPerformanceCaveat: false,
          transformRequest: (url) => {
            if (url.includes('maptiler.com')) {
              const urlObj = new URL(url);
              urlObj.searchParams.set('language', 'en');
              urlObj.searchParams.set('lang', 'en');
              return { url: urlObj.toString() };
            }
            return { url };
          }
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass:false, visualizePitch:false }), 'bottom-right');

        let zoomRaf = 0;
        map.on('zoom', () => {
          if (!zoomRaf) {
            zoomRaf = requestAnimationFrame(() => {
              applyZoomScale();   // resize via width/height (no transform)
              zoomRaf = 0;
            });
          }
        });

        map.on('load', () => {
          setStatus('Rendering…');
          addMarkers(cfg.markers);
          setMyLocationPoint(cfg.myLocation);
          ensureRadius(cfg.radiusMeters);
          setTimeout(()=>{ 
            const el=document.getElementById('status'); 
            if(el) el.style.display='none';
          }, 600);
          send('ready', { markersCount: (cfg.markers||[]).length, hasRadius: cfg.radiusMeters>0 });
        });

        map.on('click', (e) => {
          if (!e?.lngLat) return;
          send('mapClick', { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
        });

        map.on('error', (e) => {
          const msg = e?.error?.message || e?.message || 'Map error';
          send('mapError', { error: msg });
        });

        window.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data || '{}');
            if (msg.type === 'refreshMarkers') { addMarkers(msg.markers || []); }
            if (msg.type === 'setRadius') ensureRadius(Number(msg.meters || 0));
            if (msg.type === 'setMyLocation') setMyLocationPoint(msg.point || null);
            if (msg.type === 'flyTo' && msg.coords) {
              map && map.flyTo({ center: [msg.coords.longitude, msg.coords.latitude], zoom: msg.zoom || 12, essential: true });
            }
          } catch(_) {}
        });
      }catch(err){
        send('mapInitError', { error: err?.message || String(err) });
      }
    })();
  </script>
</body>
</html>`;
};

const CrossPlatformWebMap = forwardRef((props, ref) => {
  const {
    products = [],
    businesses = [],
    mapMode = 'plants',
    onSelectProduct,
    onSelectBusiness,
    onMapPress,
    initialRegion,
    maptilerKey,
    searchRadius = 10,
    myLocation,
    showMyLocation,
     refreshToken, 
  } = props;

  const webRef = useRef(null);
  const readyRef = useRef(false);
  const lastSentRef = useRef({});
  const geoCacheRef = useRef(new Map());
  const [resolvedMarkers, setResolvedMarkers] = useState([]);

  // Robust coordinate extraction
  const extractLatLon = (obj = {}) => {
    const num = (v) => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const pick = (o, k) =>
      o && typeof o === 'object' ? o[k] ?? o[k?.toLowerCase?.()] ?? o[k?.toUpperCase?.()] : undefined;

    const fromCoords = (coords) =>
      Array.isArray(coords) && coords.length >= 2
        ? { lon: num(coords[0]), lat: num(coords[1]) }
        : {};

    const L = obj.location || obj.address || obj.geo || {};
    const candidates = [
      { lat: pick(L, 'latitude'), lon: pick(L, 'longitude') },
      { lat: pick(L, 'lat'), lon: pick(L, 'lng') ?? pick(L, 'lon') },
      { lat: pick(obj, 'latitude'), lon: pick(obj, 'longitude') },
      { lat: pick(obj, 'lat'), lon: pick(obj, 'lng') ?? pick(obj, 'lon') },
      fromCoords(L.coordinates),
      fromCoords(obj.coordinates),
      fromCoords(obj.geo?.coordinates),
    ];

    for (const c of candidates) {
      const lat = num(c.lat), lon = num(c.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return {};
  };

  const toAddressString = (x = {}) => {
    const L = x.location || x.address || {};
    const parts = [
      L.formattedAddress || L.address || '',
      L.city || x.city || '',
      L.state || '',
      L.country || '',
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  };

  const items = mapMode === 'plants' ? products : businesses;

  if (Array.isArray(items) && items.length) {
    const preview = items.slice(0, 3).map((x) => ({
      id: x.id || x._id,
      loc: x.location || x.address,
    }));
    console.log('[Map] incoming items preview:', JSON.stringify(preview));
  }

  // Resolve markers: existing coords OR geocode address/city
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = [];
      for (const x of (items || [])) {
        const parsed = extractLatLon(x);
        let lat = parsed.lat, lon = parsed.lon;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          const addr = toAddressString(x);
          if (addr) {
            const key = addr.trim().toLowerCase();
            let cached = geoCacheRef.current.get(key);
            if (cached === undefined) {
              const g = await geocodeAddress(addr);
              const glat = Number(g?.latitude ?? g?.lat);
              const glon = Number(g?.longitude ?? g?.lng ?? g?.lon);
              if (Number.isFinite(glat) && Number.isFinite(glon)) {
                cached = { lat: glat, lon: glon };
              } else {
                cached = 'x';
                console.log('[Map] geocode had no numeric coords for:', addr, g);
              }
              geoCacheRef.current.set(key, cached);
            }
            if (cached && cached !== 'x') {
              lat = cached.lat; lon = cached.lon;
            }
          }
        }

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const img =
            x.imageUrl || x.image || x.thumbnail || x.photoUrl ||
            (Array.isArray(x.images) && x.images[0]) ||
            (Array.isArray(x.photos) && (x.photos[0]?.url || x.photos[0])) ||
            (x.media && x.media[0]?.url);

          const price = x.price ?? x.priceNIS ?? x.priceILS ?? x.cost;

          const bizHeuristic =
            x.isBusinessListing ||
            x.isBusiness ||
            x.seller?.isBusiness ||
            x.businessId ||
            x.ownerEmail ||
            x.source === 'business_inventory' ||
            (typeof x.type === 'string' && x.type.toLowerCase().includes('business'));

          const pinType =
            mapMode === 'businesses'
              ? 'business'
              : (x.pinType || (bizHeuristic ? 'bizProduct' : 'indProduct'));

          const marker = {
            id: String(x.id || x._id || ''),
            title: x.title || x.name || x.businessName || 'Item',
            lat, lon,
            type: pinType,
            imageUrl: img ? String(img) : null,
            priceText: (price != null && price !== '' && pinType !== 'business') ? `${price}₪` : null,
          };

          if (showMyLocation && Number.isFinite(myLocation?.latitude) && Number.isFinite(myLocation?.longitude)) {
            marker.distanceKm = haversineKm(myLocation.latitude, myLocation.longitude, lat, lon);
          }

          out.push(marker);
        }
      }
      if (!cancelled) {
        setResolvedMarkers(out);
        if (readyRef.current) {
          webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: out }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode, products, businesses, showMyLocation, myLocation?.latitude, myLocation?.longitude]);

  const center = {
    latitude: Number(initialRegion?.latitude) || 32.0853,
    longitude: Number(initialRegion?.longitude) || 34.7818,
    zoom: Number(initialRegion?.zoom) || 12,
  };


  const html = useMemo(
    () =>
      buildHtml({
        maptilerKey: String(maptilerKey || ''),
        center,
        zoom: center.zoom,
        markers: resolvedMarkers,
        radiusKm: Number(searchRadius) || 0,
        myLocation,
        showMyLocation,
        version: refreshToken,  
      }),
    // Keep stable to avoid remount; updates go via postMessage
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maptilerKey, center.latitude, center.longitude, center.zoom]
  );
const webKey = useMemo(
  () => `map-${center.latitude}-${center.longitude}-${center.zoom}-${refreshToken}`,
  [center.latitude, center.longitude, center.zoom, refreshToken]
);

  // Live updates after map is ready
  useEffect(() => {
    if (!readyRef.current) return;
    webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: resolvedMarkers }));
  }, [resolvedMarkers]);

  useEffect(() => {
    if (!readyRef.current) return;
    const meters = Math.max(0, Number(searchRadius) || 0) * 1000;
    const key = ['r', meters, 0];
    if (!sameTriplet(lastSentRef.current.r, key)) {
      lastSentRef.current.r = key;
      webRef.current?.postMessage(JSON.stringify({ type: 'setRadius', meters }));
    }
  }, [searchRadius]);

  useEffect(() => {
    if (!readyRef.current) return;
    const point = showMyLocation ? myLocation : null;
    const key = point ? ['me', point.latitude, point.longitude] : ['me', null, null];
    if (!sameTriplet(lastSentRef.current.me, key)) {
      lastSentRef.current.me = key;
      webRef.current?.postMessage(JSON.stringify({ type: 'setMyLocation', point }));
    }
  }, [showMyLocation, myLocation?.latitude, myLocation?.longitude]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, z = 12) => {
      webRef.current?.postMessage(
        JSON.stringify({ type: 'flyTo', coords: { latitude: lat, longitude: lng }, zoom: z })
      );
    },
    forceRefresh: () => {
      if (!readyRef.current) return;
      webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: resolvedMarkers }));
      webRef.current?.postMessage(JSON.stringify({ type: 'setRadius', meters: Math.max(0, Number(searchRadius) || 0) * 1000 }));
      webRef.current?.postMessage(JSON.stringify({ type: 'setMyLocation', point: showMyLocation ? myLocation : null }));
    },
  }));

  const onMessage = (evt) => {
    try {
      const msg = JSON.parse(evt?.nativeEvent?.data || '{}');

      if (msg.type === 'ready') {
        readyRef.current = true;
        webRef.current?.postMessage(JSON.stringify({ type: 'setMyLocation', point: showMyLocation ? myLocation : null }));
        webRef.current?.postMessage(JSON.stringify({ type: 'setRadius', meters: Math.max(0, Number(searchRadius) || 0) * 1000 }));
        webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: resolvedMarkers }));
        return;
      }

      if (msg.type === 'mapClick' && props.onMapPress) {
        props.onMapPress({ latitude: msg.latitude, longitude: msg.longitude });
        return;
      }
      if (msg.type === 'select-product' && props.onSelectProduct) {
        props.onSelectProduct(msg.id);
        return;
      }
      if (msg.type === 'select-business' && props.onSelectBusiness) {
        props.onSelectBusiness(msg.id);
        return;
      }
      if (msg.type === 'console') {
        const lvl = msg.level || 'log';
        console[lvl]('[WebView]', ...(msg.args || []));
      }
      if (msg.type === 'mapError' || msg.type === 'mapInitError') {
        console.warn('[WebView]', msg.error);
      }
    } catch (e) {
      console.error('[CrossPlatformWebMap] Failed to parse WebView message:', e);
    }
  };

  return (
    <View style={styles.fill}>
      <WebView
       key={webKey}     
        ref={webRef}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled={false}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : 'none'}
        onMessage={onMessage}
        onLoadStart={() => { readyRef.current = false; }}
        style={styles.fill}
        containerStyle={styles.fill}
      />
    </View>
  );
});

CrossPlatformWebMap.displayName = 'CrossPlatformWebMap';

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#eef3ee' },
});

export default CrossPlatformWebMap;
