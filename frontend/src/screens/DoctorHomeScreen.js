import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';
import AvatarViewer3D from '../components/AvatarViewer3D';
import VoiceChat from '../components/VoiceChat';
import SideDrawer from '../components/SideDrawer';
import NotificationBell from '../components/NotificationBell';
import NotificationToast from '../components/NotificationToast';
import { Ionicons } from '@expo/vector-icons';

export default function DoctorHomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [avatarId, setAvatarId] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [aiResponse, setAiResponse] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const avatarViewerRef = useRef(null);

  useEffect(() => {
    fetchDoctorProfile();
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

  async function fetchDoctorProfile() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDoctorName(data.name || data.email.split('@')[0]);
        setDoctorEmail(data.email);
        
        // Load avatar directly from profile data
        if (data.avatar_id) {
          setAvatarId(data.avatar_id);
          setAvatarUrl(data.avatar_url);
        }
      } else {
        navigation.navigate('Login');
      }
    } catch (error) {
      console.error('Error fetching doctor profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      setDrawerVisible(false);
      await AsyncStorage.multiRemove(['access_token', 'user_role', 'user_email']);
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  function handleAvatarLoaded() {
    console.log('✅ Avatar loaded successfully in DoctorHomeScreen');
    setAvatarLoaded(true);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <NotificationToast />
      
      <SideDrawer 
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        patientName={doctorName}
        patientEmail={doctorEmail}
        selectedLanguage={selectedLanguage}
        onLanguageChange={(lang) => {
          handleLanguageChange(lang);
          setTimeout(() => setDrawerVisible(false), 300);
        }}
        customMenuItems={[
          {
            icon: 'calendar-outline',
            label: 'Appointments',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('DoctorAppointments'), 100);
            }
          },
          {
            icon: 'time-outline',
            label: 'Set Schedule',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('DoctorAvailability'), 100);
            }
          },
          {
            icon: 'person-circle-outline',
            label: 'Manage Avatar',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('AvatarSelection'), 100);
            }
          },
          {
            icon: 'create-outline',
            label: 'Edit Profile',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('CompleteProfile'), 100);
            }
          },
          {
            icon: 'search-outline',
            label: 'Scan Analysis',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('ScanAnalysis'), 100);
            }
          }
        ]}
        onLogout={handleLogout}
      />
      
      {/* Modern Header */}
      <LinearGradient colors={["#474E93", "#7E5CAD"]} style={styles.modernHeader}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.hamburgerButton}
            onPress={() => setDrawerVisible(true)}
          >
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Doctor Dashboard</Text>
            <Text style={styles.headerSubtitle}>Welcome, Dr. {doctorName || 'Doctor'}</Text>
          </View>
          <NotificationBell />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.modernActionCard, { backgroundColor: '#5BA3E0' }]}
              onPress={() => navigation.navigate('DoctorAppointments')}
            >
                <View style={styles.iconCircle}>
                  <Ionicons name="calendar-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>Manage Appointments</Text>
                <Text style={styles.actionSubtitle}>View & manage</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modernActionCard, { backgroundColor: '#5BA3E0' }]}
              onPress={() => navigation.navigate('DoctorAvailability')}
            >
                <View style={styles.iconCircle}>
                  <Ionicons name="time-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>Set Schedule</Text>
                <Text style={styles.actionSubtitle}>Availability</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Text style={styles.sectionTitle}>Medical Assistant</Text>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <AvatarViewer3D 
                ref={avatarViewerRef}
                avatarUrl={avatarUrl} 
                style={styles.avatar}
                onAvatarLoaded={handleAvatarLoaded}
              />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.placeholderText}>No Avatar Selected</Text>
                <TouchableOpacity 
                  style={styles.selectAvatarButton}
                  onPress={() => navigation.navigate('AvatarSelection')}
                >
                  <Text style={styles.selectAvatarText}>Select Avatar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {aiResponse && (
            <View style={styles.responseContainer}>
              <Text style={styles.responseLabel}>Assistant:</Text>
              <Text style={styles.responseText}>{aiResponse}</Text>
            </View>
          )}
        </View>

        {/* Voice Chat */}
        <View style={styles.voiceChatSection}>
          <VoiceChat 
            selectedLanguage={selectedLanguage}
            onResponse={(response) => setAiResponse(response)}
            avatarViewerRef={avatarViewerRef}
          />
        </View>
      </ScrollView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  modernHeader: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#474E93',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerButton: {
    padding: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  quickActionsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 16,
  },
  modernActionCard: {
    width: 160,
    height: 170,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(71, 78, 147, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#474E93',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textAlign: 'center',
  },
  avatarSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 16,
  },
  avatarContainer: {
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  avatar: {
    flex: 1,
  },
  placeholderAvatar: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 16,
  },
  selectAvatarButton: {
    backgroundColor: '#60a5fa',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  selectAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
  },
  voiceChatSection: {
    marginBottom: 20,
  },
});
