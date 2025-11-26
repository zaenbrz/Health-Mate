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
            icon: '📅',
            label: 'Appointments',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('DoctorAppointments'), 100);
            }
          },
          {
            icon: '⏰',
            label: 'Set Schedule',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('DoctorAvailability'), 100);
            }
          },
          {
            icon: '👤',
            label: 'Manage Avatar',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('AvatarSelection'), 100);
            }
          },
          {
            icon: '✏️',
            label: 'Edit Profile',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('CompleteProfile'), 100);
            }
          },
          {
            icon: '🔬',
            label: 'Scan Analysis',
            onPress: () => {
              setDrawerVisible(false);
              setTimeout(() => navigation.navigate('ScanAnalysis'), 100);
            }
          }
        ]}
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
          
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Dr. {doctorName || 'Doctor'}</Text>
          </View>
          
          <NotificationBell />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('DoctorAppointments')}
          >
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={styles.actionTitle}>Appointments</Text>
            <Text style={styles.actionSubtitle}>View & manage</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('DoctorAvailability')}
          >
            <Text style={styles.actionIcon}>⏰</Text>
            <Text style={styles.actionTitle}>Set Schedule</Text>
            <Text style={styles.actionSubtitle}>Availability</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('ScanAnalysis')}
          >
            <Text style={styles.actionIcon}>🔬</Text>
            <Text style={styles.actionTitle}>Scan Analysis</Text>
            <Text style={styles.actionSubtitle}>Review scans</Text>
          </TouchableOpacity>
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
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerButton: {
    padding: 10,
  },
  hamburgerIcon: {
    fontSize: 28,
    color: '#1e3a8a',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
