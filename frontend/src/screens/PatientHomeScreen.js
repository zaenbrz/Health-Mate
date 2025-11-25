import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';
import AvatarViewer3D from '../components/AvatarViewer3D';
import VoiceChat from '../components/VoiceChat';
import SideDrawer from '../components/SideDrawer';

export default function PatientHomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [avatarId, setAvatarId] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [aiResponse, setAiResponse] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const avatarViewerRef = useRef(null);

  useEffect(() => {
    fetchPatientProfile();
    loadLanguagePreference();
  }, []);

  useEffect(() => {
    // Preload all animations when avatar is loaded
    if (avatarLoaded && avatarViewerRef.current) {
      console.log('📦 Preloading all animations...');
      const animations = [
        'loop.fbx',
        'yes-nod.fbx',
        'Thinking.fbx',
        'thoughtful.fbx'
      ];

      // Load all animations sequentially
      let loadIndex = 0;
      const loadNext = () => {
        if (loadIndex < animations.length) {
          const animUrl = `${CONFIG.API_URL}/animations/${animations[loadIndex]}`;
          console.log(`📦 Loading animation ${loadIndex + 1}/${animations.length}: ${animations[loadIndex]}`);
          avatarViewerRef.current.loadAnimation(animUrl);
          loadIndex++;
          setTimeout(loadNext, 500); // Small delay between loads
        } else {
          console.log('✅ All animations preloaded, starting first animation (loop)');
          // Play first animation (index 0 = loop) after all are loaded
          avatarViewerRef.current.playAnimation(0, true, 0.5);
        }
      };
      loadNext();
    }
  }, [avatarLoaded]);

  async function loadLanguagePreference() {
    try {
      const savedLanguage = await AsyncStorage.getItem('preferred_language');
      if (savedLanguage) {
        setSelectedLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  }

  async function handleLanguageChange(languageCode) {
    console.log('🌐 Changing language from', selectedLanguage, 'to', languageCode);
    setSelectedLanguage(languageCode);
    try {
      await AsyncStorage.setItem('preferred_language', languageCode);
      console.log('✅ Language changed to:', languageCode);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  }

  async function fetchPatientProfile() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        setPatientName(profile.name || 'User');
        setPatientEmail(profile.email || '');
        setAvatarId(profile.avatar_id);
        setAvatarUrl(profile.avatar_url);
        
        console.log('Profile loaded:', {
          name: profile.name,
          email: profile.email,
          avatar_id: profile.avatar_id,
          avatar_url: profile.avatar_url
        });

        // Debug avatar URL
        if (!profile.avatar_url) {
          console.warn('⚠️ No avatar_url in profile! User needs to create an avatar.');
        } else {
          console.log('✅ Avatar URL found:', profile.avatar_url);
        }
      } else {
        console.error('Profile fetch failed:', response.status);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        patientName={patientName}
        patientEmail={patientEmail}
        selectedLanguage={selectedLanguage}
        onLanguageChange={(lang) => {
          handleLanguageChange(lang);
          setTimeout(() => setDrawerVisible(false), 300);
        }}
        onManageAvatar={() => {
          setDrawerVisible(false);
          navigation.navigate('AvatarSelection');
        }}
        onEditProfile={() => {
          setDrawerVisible(false);
          navigation.navigate('CompleteProfile');
        }}
        onScanAnalysis={() => {
          setDrawerVisible(false);
          navigation.navigate('ScanAnalysis');
        }}
        onLogout={handleLogout}
      />
      
      <LinearGradient colors={["#e3f2fd", "#bbdefb"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.hamburgerButton}
            onPress={() => setDrawerVisible(true)}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
          
          <Text style={styles.greeting}>Hi {patientName},</Text>
          <ScrollView 
            style={styles.subtitleContainer}
            contentContainerStyle={styles.subtitleContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>
              {aiResponse || "How can I help you?"}
            </Text>
          </ScrollView>
        </View>
        
        {avatarUrl ? (
          <View style={styles.avatarContainer}>
            <AvatarViewer3D
              ref={avatarViewerRef}
              avatarUrl={avatarUrl}
              style={styles.avatarViewer}
              onAvatarLoaded={() => {
                console.log('✅ Avatar fully loaded, ready for animation');
                setAvatarLoaded(true);
              }}
              onAudioEnded={() => {
                console.log('🔄 Audio ended, returning to loop animation');
                if (avatarViewerRef.current) {
                  avatarViewerRef.current.playAnimation(0, true, 0.5); // Index 0 = loop
                }
              }}
            />
          </View>
        ) : (
          <View style={styles.avatarContainer}>
            <View style={styles.noAvatarPlaceholder}>
              <Text style={styles.noAvatarText}>No Avatar</Text>
              <TouchableOpacity 
                style={styles.createAvatarButton}
                onPress={() => navigation.navigate('AvatarSelection')}
              >
                <Text style={styles.createAvatarButtonText}>Create Avatar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>

      <View style={styles.bottomSection}>
        <VoiceChat 
          selectedLanguage={selectedLanguage}
          avatarViewerRef={avatarViewerRef}
          onResponse={(response) => {
            console.log('AI Response received:', response);
            setAiResponse(response);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  headerTop: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  hamburgerButton: {
    position: 'absolute',
    top: 0,
    left: 10,
    padding: 10,
    zIndex: 10,
  },
  hamburgerIcon: {
    fontSize: 28,
    color: '#1e3a8a',
    fontWeight: '600',
  },
  greeting: {
    fontSize: 24,
    fontStyle: 'italic',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  subtitleContainer: {
    maxHeight: 80,
    width: '100%',
  },
  subtitleContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#1e3a8a',
    textAlign: 'center',
    lineHeight: 22,
  },
  avatarContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarViewer: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micIcon: {
    fontSize: 40,
  },
  noAvatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noAvatarText: {
    fontSize: 18,
    color: '#1e3a8a',
    fontWeight: '600',
    marginBottom: 15,
  },
  createAvatarButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createAvatarButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: 'white',
    marginTop: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  avatarHint: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  question: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1e3a8a',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  featuresPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
  },
});
