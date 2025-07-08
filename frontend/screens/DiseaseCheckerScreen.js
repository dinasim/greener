import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import MainLayout from '../components/MainLayout';

const { width } = Dimensions.get('window');

export default function DiseaseCheckerScreen({ navigation, route }) {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [history, setHistory] = useState([]);
  const [isBusiness, setIsBusiness] = useState(false);

  const resultCardRef = useRef();

  // Tabs navigation handler - match your PlantCareForumScreen
  const handleTabPress = (tab) => {
    if (isBusiness) {
      switch (tab) {
        case 'home':
          navigation.navigate('BusinessDashboard');
          break;
        case 'locations':
          navigation.navigate('BusinessLocations');
          break;
        case 'marketplace':
          navigation.navigate('BusinessInventory');
          break;
        case 'forum':
          navigation.navigate('BusinessForum');
          break;
        case 'disease':
          navigation.navigate('DiseaseChecker');
          break;
        default:
          navigation.goBack();
      }
    } else {
      switch (tab) {
        case 'home':
          navigation.navigate('Home');
          break;
        case 'plants':
          navigation.navigate('Locations');
          break;
        case 'marketplace':
          navigation.navigate('MainTabs');
          break;
        case 'forum':
          navigation.navigate('PlantCareForumScreen');
          break;
        case 'disease':
          navigation.navigate('DiseaseChecker');
          break;
        default:
          navigation.goBack();
      }
    }
  };

  useEffect(() => {
    const checkUserType = async () => {
      try {
        if (route?.params?.business === true) {
          setIsBusiness(true);
          return;
        }
        const userType = await AsyncStorage.getItem('userType');
        const businessId = await AsyncStorage.getItem('businessId');
        if (userType === 'business' || businessId) {
          setIsBusiness(true);
        }
        const currentRouteName = navigation.getState()?.routeNames?.[0];
        if (currentRouteName?.includes('Business') ||
          navigation.getState()?.routes?.some(route => route.name.includes('Business'))) {
          setIsBusiness(true);
        }
      } catch (error) {
        console.log('Error checking user type:', error);
      }
    };
    checkUserType();
  }, [route?.params, navigation]);

  const renderMultiLine = (text) => {
    return text
      .split(/(?:\.\s+|;)/)
      .map(line => line.trim())
      .filter(line => line.length > 1)
      .map((line, idx) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={{ fontWeight: "bold", marginRight: 4 }}>•</Text>
          <Text style={{ flex: 1, fontSize: 14, color: "#222", marginBottom: 2 }}>
            {line.endsWith('.') ? line : line + '.'}
          </Text>
        </View>
      ));
  };

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem('recentAnalysis');
        if (json) setHistory(JSON.parse(json));
      } catch { }
    })();
  }, []);

  useEffect(() => {
    if (result && Array.isArray(result.results) && result.results.length > 0) {
      const newEntry = {
        plant_name: result.plant_name,
        date: new Date().toLocaleString(),
        imageUri,
        result,
      };
      const newHistory = [newEntry, ...history].slice(0, 5);
      setHistory(newHistory);
      AsyncStorage.setItem('recentAnalysis', JSON.stringify(newHistory));
    }
  }, [result]);

  const pickFromLibrary = async () => {
    setResult(null);
    let perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Photo access needed.');
      return;
    }
    let res = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.7 });
    if (res.cancelled || (res.assets && res.assets.length === 0)) {
      return;
    }
    const uri = res.uri || res.assets[0].uri;
    setImageUri(uri);
    autoAnalyze(uri);
  };

  const takePhoto = async () => {
    setResult(null);
    let perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera access needed.');
      return;
    }
    let res = await ImagePicker.launchCameraAsync({ base64: false, quality: 0.7 });
    if (res.cancelled || (res.assets && res.assets.length === 0)) {
      return;
    }
    const uri = res.uri || res.assets[0].uri;
    setImageUri(uri);
    autoAnalyze(uri);
  };

  const autoAnalyze = async (uri) => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const apiRes = await fetch(
        'https://usersfunctions.azurewebsites.net/api/diseaseCheck',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        }
      );
      if (!apiRes.ok) {
        const txt = await apiRes.text();
        throw new Error(txt);
      }
      const json = await apiRes.json();
      setResult(json);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (confidence) => {
    const c = Number(confidence) || 0;
    if (c > 90) return '#38b000';
    if (c > 75) return '#ffd600';
    return '#ff3e00';
  };

  const shareResultCard = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Sharing only works on mobile devices for now.');
      return;
    }
    try {
      const uri = await captureRef(resultCardRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri, { dialogTitle: 'Share your plant analysis result' });
    } catch (e) {
      Alert.alert('Error sharing', e.message);
    }
  };

  const handleAddPress = () => setShowPopup(true);
  const handleOptionPress = (type) => {
    setShowPopup(false);
    if (type === 'plant') {
      navigation.navigate(isBusiness ? 'BusinessAddPlant' : 'AddPlant');
    } else if (type === 'site') {
      navigation.navigate(isBusiness ? 'BusinessAddSite' : 'AddSite');
    }
  };

  const isPlantDetected = result && Array.isArray(result.results) && result.results.length > 0;

  const hasCritical = result && result.results && result.results.some(
    (r) => (r.severity && r.severity.toLowerCase() === 'high') ||
      (r.spreading && r.spreading.toLowerCase().includes('contagious'))
  );

  // --- SCREEN CONTENT ---
  const screenContent = (
    <View style={{ flex: 1 }}>
      {/* Header Row with Back Button */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isBusiness ? 'Plant Health Scanner' : 'Disease Checker'}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          isBusiness && { paddingBottom: 40 }
        ]}
      >
        {/* Animated Loading Indicator */}
        {loading && (
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={{ fontSize: 16, color: "#333", marginTop: 12 }}>Analyzing your plant…</Text>
          </View>
        )}

        {/* PICK PHOTO BUTTONS */}
        {!loading && !imageUri && !result && (
          <View style={{ width: "100%", alignItems: "center" }}>
            <TouchableOpacity style={styles.greenBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.greenBtnText}>Take a Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.greenBtn, { backgroundColor: "#43a047" }]} onPress={pickFromLibrary}>
              <Ionicons name="image" size={24} color="#fff" />
              <Text style={styles.greenBtnText}>Upload from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* IMAGE PREVIEW */}
        {imageUri && !loading && !result && (
          <View style={{ alignItems: 'center' }}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          </View>
        )}

        {/* RESULT CARD */}
        {result && (
          <View ref={resultCardRef} collapsable={false} style={styles.resultCard}>
            {!isPlantDetected ? (
              <View style={styles.notFoundCard}>
                <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 10 }}>😕 Plant Not Detected</Text>
                <Text style={{ fontSize: 15, marginBottom: 7 }}>
                  We couldn't recognize the plant from your image.
                </Text>
                <Text style={{ fontSize: 15, color: "#666", marginBottom: 12 }}>
                  Tip: Try taking a clearer photo of a single leaf or the whole plant.
                </Text>
                <TouchableOpacity
                  style={[styles.againBtn, { backgroundColor: "#4285f4" }]}
                  onPress={() => { setImageUri(null); setResult(null); }}
                >
                  <Text style={styles.againBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Share + Encyclopedia Buttons */}
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
                  {result.plant_name && result.plant_name !== "Unknown" && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => navigation.navigate('PlantDetail', { plantId: result.plant_name })}
                    >
                      <Ionicons name="book-outline" size={22} color="#7e57c2" />
                      <Text style={{ marginLeft: 6, fontWeight: '600', color: '#7e57c2' }}>Plant Encyclopedia</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={shareResultCard}
                  >
                    <Ionicons name="share-social-outline" size={22} color="#4285f4" />
                    <Text style={{ marginLeft: 6, fontWeight: '600', color: '#4285f4' }}>Share</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.plantName}>{result.plant_name}</Text>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                )}
                {hasCritical && (
                  <View style={styles.criticalBanner}>
                    <Ionicons name="alert" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                      ⚠️ Urgent: Severe or highly contagious issue detected!
                    </Text>
                  </View>
                )}
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>Analysis Summary</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.summaryLabel}>Status: </Text>
                    <Text style={[
                      styles.statusText,
                      { color: result.is_healthy ? '#38b000' : '#ff8c00' }
                    ]}>
                      {result.is_healthy ? "Healthy" : "Issues Detected"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.summaryLabel}>Confidence: </Text>
                    <Text>{result.confidence ? `${result.confidence}%` : "N/A"}</Text>
                  </View>
                </View>
                {result.results && result.results.length > 0 && (
                  <View>
                    <Text style={styles.issuesTitle}>Detected Issues</Text>
                    {result.results.map((item, i) => (
                      <View key={i} style={styles.issueCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <MaterialIcons name="report-problem" size={22} color="#ca2c2c" style={{ marginRight: 6 }} />
                          <Text style={styles.issueTitle}>
                            {`${i + 1}. ${item.name || "Issue"}`}
                          </Text>
                          <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="alert-circle" size={16} color="#ff7675" />
                            <Text style={styles.severityCard}>{item.severity || ""}</Text>
                          </View>
                        </View>
                        <View style={styles.confBarWrap}>
                          <View style={[
                            styles.confBar,
                            {
                              width: `${parseInt(item.probability) || 0}%`,
                              backgroundColor: getBarColor(item.probability)
                            }
                          ]} />
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          <Text style={styles.cardLabel}>
                            Probability:
                          </Text>
                          <Text style={{ fontWeight: "bold" }}>{item.probability || "N/A"}</Text>
                        </View>
                        {item.symptoms && (
                          <View style={styles.infoCard}>
                            <View style={styles.infoCardHeader}>
                              <MaterialCommunityIcons name="emoticon-sad-outline" size={18} color="#b77aff" />
                              <Text style={styles.infoCardTitle}>Symptoms</Text>
                            </View>
                            {renderMultiLine(item.symptoms)}
                          </View>
                        )}
                        {item.causes && (
                          <View style={styles.infoCard}>
                            <View style={styles.infoCardHeader}>
                              <MaterialIcons name="science" size={18} color="#ffb300" />
                              <Text style={styles.infoCardTitle}>Causes</Text>
                            </View>
                            {renderMultiLine(item.causes)}
                          </View>
                        )}
                        {item.spreading && (
                          <View style={styles.infoCard}>
                            <View style={styles.infoCardHeader}>
                              <Ionicons name="shuffle" size={18} color="#27ae60" />
                              <Text style={styles.infoCardTitle}>Spreading</Text>
                            </View>
                            {renderMultiLine(item.spreading)}
                          </View>
                        )}
                        {item.treatment && (
                          <View style={styles.infoCard}>
                            <View style={styles.infoCardHeader}>
                              <Ionicons name="medkit" size={18} color="#4285F4" />
                              <Text style={styles.infoCardTitle}>Treatment</Text>
                            </View>
                            {renderMultiLine(item.treatment)}
                          </View>
                        )}
                        {item.prevention && (
                          <View style={styles.infoCard}>
                            <View style={styles.infoCardHeader}>
                              <MaterialIcons name="spa" size={18} color="#00b894" />
                              <Text style={styles.infoCardTitle}>Prevention</Text>
                            </View>
                            {renderMultiLine(item.prevention)}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {result.is_healthy && (
                  <Text style={[styles.statusText, { color: "#38b000", marginTop: 18 }]}>Your plant looks healthy!</Text>
                )}
                <TouchableOpacity style={styles.againBtn}
                  onPress={() => { setImageUri(null); setResult(null); }}
                >
                  <Text style={styles.againBtnText}>Analyze Another Plant</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Analysis</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {history.map((h, idx) => (
                <TouchableOpacity key={idx} style={styles.historyCard}
                  onPress={() => { setResult(h.result); setImageUri(h.imageUri); }}
                >
                  <Image source={{ uri: h.imageUri }} style={{ width: 52, height: 52, borderRadius: 6, marginBottom: 4 }} />
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', maxWidth: 70 }}>{h.plant_name}</Text>
                  <Text style={{ fontSize: 11, color: "#777" }}>{h.date.split(',')[0]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Add Plant popup - Available for both user types but with different options */}
      {showPopup && (
        <Modal transparent visible={showPopup} animationType="slide" onRequestClose={() => setShowPopup(false)}>
          <TouchableOpacity style={styles.popupOverlay} onPress={() => setShowPopup(false)}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('plant')}>
                <Text style={styles.modalButtonText}>🌿 Add Plant</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('site')}>
                <Text style={styles.modalButtonText}>📍 Add Site</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Floating Action Buttons: Only for consumers */}
      {!isBusiness && (
        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatingButton} onPress={() => handleTabPress('disease')}>
            <Ionicons name="search" size={32} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
            <Ionicons name="add" size={36} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ---- Use MainLayout for consumers, plain view for business ----
  if (!isBusiness) {
    return (
      <MainLayout currentTab="disease" onTabPress={handleTabPress}>
        {screenContent}
      </MainLayout>
    );
  } else {
    return screenContent;
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 18, paddingHorizontal: 12, paddingBottom: 2,
    backgroundColor: 'transparent', zIndex: 1
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#205d29',
    letterSpacing: 0.5,
  },
  container: { padding: 20, alignItems: 'center', backgroundColor: '#f7f7fa' },
  greenBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#2e7d32",
    borderRadius: 11,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginVertical: 12,
    marginHorizontal: 8,
    width: 230, justifyContent: "center"
  },
  greenBtnText: { color: "#fff", fontWeight: "bold", fontSize: 18, marginLeft: 10 },
  pickBtnText: { color: "#fff", fontWeight: "bold", fontSize: 18, letterSpacing: 1 },
  imagePreview: { width: 230, height: 230, margin: 18, borderRadius: 12, borderWidth: 2, borderColor: "#ddd" },
  resultCard: { 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 18, 
    width: "97%", 
    alignItems: "center", 
    marginTop: 18, 
    marginBottom: 48, 
    ...Platform.select({
      web: { boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)' },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }
    })
  },
  plantName: { fontSize: 23, fontWeight: "bold", marginBottom: 8, color: "#205d29", letterSpacing: 1 },
  summaryBox: { backgroundColor: "#f6f7fa", borderRadius: 9, padding: 12, marginBottom: 16, alignSelf: "stretch" },
  summaryTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 6 },
  summaryLabel: { fontWeight: "600" },
  statusText: { fontWeight: "bold" },
  issuesTitle: { fontWeight: "bold", fontSize: 19, marginVertical: 7, color: "#ca2c2c" },
  issueCard: { backgroundColor: "#fff4f4", borderRadius: 11, padding: 12, marginBottom: 17, borderWidth: 1, borderColor: "#ffd6d6" },
  issueTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 4 },
  severityCard: {
    marginLeft: 2,
    fontSize: 13,
    color: "#b71c1c",
    fontWeight: "bold",
  },
  confBarWrap: { height: 8, backgroundColor: "#eee", borderRadius: 8, marginVertical: 4 },
  confBar: { height: 8, borderRadius: 8 },
  againBtn: { backgroundColor: "#448aff", borderRadius: 8, padding: 10, marginTop: 24, alignSelf: "center" },
  againBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  infoCard: {
    backgroundColor: "#f7f7fa",
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoCardTitle: {
    marginLeft: 6,
    fontWeight: "bold",
    color: "#444"
  },
  notFoundCard: {
    padding: 18, borderRadius: 14, alignItems: "center", marginTop: 20,
    backgroundColor: "#fff4e5", borderColor: "#ffe0b2", borderWidth: 1
  },
  cardLabel: {
    marginTop: 6,
    marginBottom: 2,
    color: "#555"
  },
  criticalBanner: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch'
  },
  navBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#eee', flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, elevation: 10,
  },
  floatingContainer: {
    position: 'absolute', bottom: 70, right: 25, alignItems: 'center',
  },
  floatingButton: { marginBottom: 12 },
  addButton: {
    backgroundColor: '#2e7d32', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 3px 4px rgba(0, 0, 0, 0.3)' },
      default: { elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 }
    })
  },
  popupOverlay: {
    flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    width: width * 0.6, alignSelf: 'flex-end', 
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)' },
      default: { elevation: 5 }
    })
  },
  popupOption: { paddingVertical: 14 },
  modalButtonText: { fontSize: 16, color: '#333', textAlign: 'right' },
  historySection: {
    marginTop: 25, alignSelf: "stretch"
  },
  historyTitle: {
    fontSize: 18, fontWeight: "bold", color: "#205d29", marginBottom: 10
  },
  historyCard: {
    marginRight: 12, alignItems: "center", backgroundColor: "#fff", borderRadius: 10, padding: 8,
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)' },
      default: { elevation: 2 }
    }),
    borderColor: "#f0f0f0", borderWidth: 1, minWidth: 75
  }
});