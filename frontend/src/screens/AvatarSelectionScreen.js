import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

const RPM_SUBDOMAIN = CONFIG.RPM_SUBDOMAIN;

export default function AvatarSelectionScreen({ navigation }) {
  const [showCreator, setShowCreator] = useState(false);
  const [loading, setLoading] = useState(false);
  const webViewRef = useRef(null);

  const openAvatarCreator = () => {
    setShowCreator(true);
  };

  const handleMessage = async (event) => {
    try {
      const json = JSON.parse(event.nativeEvent.data);
      
      if (json?.source !== 'readyplayerme') {
        return;
      }

      console.log('RPM Event:', json.eventName);

      // Subscribe to all events when frame is ready
      if (json.eventName === 'v1.frame.ready') {
        const subscribeMessage = JSON.stringify({
          target: 'readyplayerme',
          type: 'subscribe',
          eventName: 'v1.**'
        });
        // Send subscribe message to WebView
        if (webViewRef.current) {
          webViewRef.current.postMessage(subscribeMessage);
        }
        console.log('Frame ready, subscribing to events');
      }

      // Get the avatar URL when export is complete
      if (json.eventName === 'v1.avatar.exported') {
        const avatarUrl = json.data.url;
        console.log('Avatar created:', avatarUrl);
        
        // Extract avatar ID from URL (format: https://models.readyplayer.me/{avatarId}.glb)
        const avatarId = avatarUrl.split('/').pop().replace('.glb', '');
        
        setShowCreator(false);
        setLoading(true);

        // Save avatar to backend
        const token = await AsyncStorage.getItem('access_token');
        const response = await fetch(`${CONFIG.API_URL}/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            avatar_id: avatarId,
            avatar_url: avatarUrl
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save avatar');
        }

        // Get user role to navigate to correct home screen
        const userRole = await AsyncStorage.getItem('user_role');
        
        Alert.alert('Success', 'Avatar created successfully!');
        
        if (userRole === 'doctor') {
          navigation.navigate('DoctorHome');
        } else {
          navigation.navigate('PatientHome');
        }
      }
    } catch (error) {
      console.error('Error handling RPM message:', error);
      Alert.alert('Error', 'Failed to process avatar. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showCreator) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={["#6366f1", "#3b82f6"]} style={styles.webviewHeader}>
          <Text style={styles.webviewTitle}>Create Your Avatar</Text>
          <TouchableOpacity 
            onPress={() => setShowCreator(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </LinearGradient>
        <WebView
          ref={webViewRef}
          source={{ uri: `https://${RPM_SUBDOMAIN}.readyplayer.me/avatar?frameApi&bodyType=fullbody` }}
          onMessage={handleMessage}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ flex: 1 }}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Saving your avatar...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <LinearGradient colors={["#f8fafc", "#e8eef9", "#f8fafc"]} style={{ flex: 1 }}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={async () => {
          const userRole = await AsyncStorage.getItem('user_role');
          const homeScreen = userRole === 'doctor' ? 'DoctorHome' : 'PatientHome';
          navigation.navigate(homeScreen);
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>

      <View style={styles.container}>
        <View style={styles.headerContent}>
          <Ionicons name="person" size={80} color="#7E5CAD" />
          <Text style={styles.title}>Create Your Avatar</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="color-palette" size={28} color="#5BA3E0" />
            <Text style={styles.infoTitle}>Personalize Your Look</Text>
          </View>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Face shape and features</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Hair style and color</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Outfits and accessories</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Glasses and masks</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={openAvatarCreator}
        >
          <Ionicons name="brush" size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Start Creating</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: 20,
    top: 50,
    padding: 8,
    zIndex: 10,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    marginBottom: 30,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  featuresList: {
    gap: 12,
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#64748b',
    flex: 1,
  },
  button: {
    backgroundColor: '#5BA3E0',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  webviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});
