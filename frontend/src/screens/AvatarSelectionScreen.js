import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
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
        <View style={styles.webviewHeader}>
          <Text style={styles.webviewTitle}>Create Your Avatar</Text>
          <TouchableOpacity 
            onPress={() => setShowCreator(false)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
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
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Saving avatar...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <LinearGradient colors={["#e3f2fd", "#bbdefb"]} style={styles.header}>
        <Text style={styles.title}>Choose Your Avatar</Text>
        <Text style={styles.subtitle}>Create a personalized 3D avatar for your profile</Text>
      </LinearGradient>

      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🎨 Create Your Avatar</Text>
          <Text style={styles.infoText}>
            You'll be able to customize:
          </Text>
          <Text style={styles.infoItem}>• Face shape and features</Text>
          <Text style={styles.infoItem}>• Hair style and color</Text>
          <Text style={styles.infoItem}>• Outfits and accessories</Text>
          <Text style={styles.infoItem}>• Glasses and face masks</Text>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={openAvatarCreator}
        >
          <Text style={styles.buttonText}>Start Creating</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={async () => {
          const userRole = await AsyncStorage.getItem('user_role');
          const homeScreen = userRole === 'doctor' ? 'DoctorHome' : 'PatientHome';
          Alert.alert('Note', 'You can create an avatar later from your profile settings');
          navigation.navigate(homeScreen);
        }}>
          <Text style={styles.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 10,
  },
  infoItem: {
    fontSize: 15,
    color: '#475569',
    marginLeft: 10,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#60a5fa',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skip: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 10,
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#60a5fa',
  },
  webviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
});
