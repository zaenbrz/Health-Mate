import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

export default function SideDrawer({ 
  visible, 
  onClose, 
  patientName, 
  patientEmail,
  selectedLanguage,
  onLanguageChange,
  onManageAvatar,
  onEditProfile,
  onScanAnalysis,
  onLogout,
  customMenuItems, // New prop for custom menu items
  navigation // Navigation prop for patient appointments
}) {
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'ur', name: 'اردو' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View 
          style={[
            styles.drawer,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Profile Section */}
            <View style={styles.profileSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {patientName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <Text style={styles.profileName}>{patientName || 'User'}</Text>
              <Text style={styles.profileEmail}>{patientEmail || ''}</Text>
            </View>

            <View style={styles.divider} />

            {/* Language Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Language</Text>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang.code && styles.languageOptionSelected,
                  ]}
                  onPress={() => onLanguageChange(lang.code)}
                >
                  <Text
                    style={[
                      styles.languageName,
                      selectedLanguage === lang.code && styles.languageNameSelected,
                    ]}
                  >
                    {lang.name}
                  </Text>
                  {selectedLanguage === lang.code && (
                    <Ionicons name="checkmark" size={20} color="#60a5fa" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Settings Menu Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Menu</Text>
              
              {/* Custom menu items if provided (for doctor) */}
              {customMenuItems && customMenuItems.map((item, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.menuItem}
                  onPress={item.onPress}
                >
                  <Ionicons name={item.icon} size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                  <Text style={styles.menuText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              
              {/* Default menu items if no custom items (for patient) */}
              {!customMenuItems && (
                <>
                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={onManageAvatar}
                  >
                    <Ionicons name="person-circle-outline" size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Manage Avatar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={onEditProfile}
                  >
                    <Ionicons name="create-outline" size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Complete Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={() => {
                      onClose();
                      navigation.navigate('PatientAppointments');
                    }}
                  >
                    <Ionicons name="calendar-outline" size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Appointments</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={onScanAnalysis}
                  >
                    <Ionicons name="search-outline" size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Scan Analysis</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={() => {
                      onClose();
                      navigation.navigate('MedicalReports');
                    }}
                  >
                    <Ionicons name="document-text-outline" size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Medical Reports</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={() => {
                      onClose();
                      navigation.navigate('PrivacySecurity');
                    }}
                  >
                    <Ionicons name="shield-checkmark-outline" size={22} color="rgba(226, 232, 240, 0.9)" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Privacy & Security</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.divider} />

            {/* Logout */}
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={onLogout}
            >
              <Ionicons name="log-out-outline" size={22} color="#fca5a5" style={styles.logoutIcon} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: 'rgba(71, 78, 147, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(71, 78, 147, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(126, 92, 173, 0.3)',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#5BA3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'rgba(91, 163, 224, 0.4)',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(226, 232, 240, 0.8)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    marginVertical: 10,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(148, 163, 184, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 15,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(109, 40, 217, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  languageOptionSelected: {
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    color: 'rgba(226, 232, 240, 0.9)',
    flex: 1,
  },
  languageNameSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#93c5fd',
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 5,
  },
  menuIcon: {
    fontSize: 22,
    marginRight: 15,
    width: 30,
  },
  menuText: {
    fontSize: 16,
    color: 'rgba(226, 232, 240, 0.9)',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutIcon: {
    fontSize: 22,
    marginRight: 15,
    width: 30,
  },
  logoutText: {
    fontSize: 16,
    color: '#fca5a5',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 30,
  },
});
