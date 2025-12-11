import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';
import AvatarViewer3D from '../components/AvatarViewer3D';
import VoiceChat from '../components/VoiceChat';
import SideDrawer from '../components/SideDrawer';
import NotificationBell from '../components/NotificationBell';
import NotificationToast from '../components/NotificationToast';

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

  // Background gradient animation
  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchPatientProfile();
    loadLanguagePreference();

    // Start gradient animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    // Preload all animations when avatar is loaded
    if (avatarLoaded && avatarViewerRef.current) {
      console.log('📦 Preloading all animations...');
      const animations = [
        'Idle2.fbx',        // Index 0: Idle state (default)
        'yes-nod.fbx',     // Index 1: Recording/listening
        'thoughtful.fbx',  // Index 2: Thinking/processing
        'normal.fbx'       // Index 3: Speaking
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
          console.log('✅ All animations preloaded, starting Idle animation');
          // Play Idle animation (index 0 = Idle.fbx) after all are loaded
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
      setDrawerVisible(false); // Close drawer first
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
    <View style={{ flex: 1 }}>
      {/* Light gradient background */}
      <LinearGradient
        colors={['#ffffff', '#fafbfc', '#f4f5f7']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      {/* Toast notifications at the top level */}
      <NotificationToast />

      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        patientName={patientName}
        patientEmail={patientEmail}
        selectedLanguage={selectedLanguage}
        navigation={navigation}
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

      <LinearGradient colors={["#6B70A8", "#9896C4", "#C3C1E6"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => setDrawerVisible(true)}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Hi {patientName},</Text>
          </View>

          <NotificationBell />
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
                console.log('🔄 Audio ended, returning to Idle animation');
                if (avatarViewerRef.current) {
                  avatarViewerRef.current.playAnimation(0, true, 0.5); // Index 0 = Idle.fbx
                }
                // Hide subtitles after a short delay so user can finish reading
                setTimeout(() => {
                  setAiResponse(null);
                }, 3000);
              }}
            />

            {/* Floating Subtitle Overlay - Glassmorphism Style */}
            {aiResponse && (
              <View style={styles.floatingSubtitleContainer}>
                <View style={styles.floatingSubtitleGlass} />

                {aiResponse === 'Thinking...' ? (
                  <View style={styles.thinkingContainer}>
                    <PulsingDots />
                    <Text style={styles.thinkingText}>Processing</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.subtitleScroll}
                    contentContainerStyle={styles.subtitleContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.floatingSubtitleText}>
                      {aiResponse}
                    </Text>
                  </ScrollView>
                )}
              </View>
            )}
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

// Simple Pulsing Dots Component
const PulsingDots = () => {
  const [dot1] = useState(new Animated.Value(0.3));
  const [dot2] = useState(new Animated.Value(0.3));
  const [dot3] = useState(new Animated.Value(0.3));

  useEffect(() => {
    const animate = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 3,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
      <Animated.View style={[dotStyle, { opacity: dot1 }]} />
      <Animated.View style={[dotStyle, { opacity: dot2 }]} />
      <Animated.View style={[dotStyle, { opacity: dot3 }]} />
    </View>
  );
};

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
    flexDirection: 'row',
    alignItems: 'center', // Changed from flex-start to center
    justifyContent: 'space-between',
    marginBottom: 10, // Reduced margin
    paddingHorizontal: 10,
    height: 50, // Fixed height for header top
  },
  hamburgerButton: {
    padding: 10,
  },
  hamburgerIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  greeting: {
    fontSize: 24,
    fontStyle: 'italic',
    color: '#ffffff',
    marginBottom: 0, // Removed margin
  },
  // New Floating Subtitle Styles
  floatingSubtitleContainer: {
    position: 'absolute',
    top: 5, // Moved to top
    left: 20,
    right: 20,
    height: 110, // Slightly reduced height
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  floatingSubtitleGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.2)', // Reduced opacity from 0.5 to 0.3
    borderRadius: 16,
  },
  subtitleScroll: {
    width: '100%',
    maxHeight: '100%',
  },
  subtitleContent: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  floatingSubtitleText: {
    fontSize: 15, // Reduced from 18
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
  // Removed old subtitle styles
  avatarContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // Ensure absolute children work
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
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 15,
  },
  createAvatarButton: {
    backgroundColor: '#5BA3E0',
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
    color: '#ffffff',
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
