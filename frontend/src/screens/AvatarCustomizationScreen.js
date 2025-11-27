import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

// Get RPM identifiers from config
const RPM_APP_ID = CONFIG.RPM_APP_ID; // For API that requires App ID
const RPM_SUBDOMAIN = CONFIG.RPM_SUBDOMAIN; // For subdomain-based API calls

export default function AvatarCustomizationScreen({ navigation, route }) {
  const { avatarId, rpmToken } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('outfit');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [currentAvatarData, setCurrentAvatarData] = useState(null);

  // Asset categories
  const categories = [
    { id: 'outfit', name: 'Outfits', icon: 'shirt-outline' },
    { id: 'hairStyle', name: 'Hair', icon: 'cut-outline' },
    { id: 'glasses', name: 'Glasses', icon: 'glasses-outline' },
    { id: 'faceMask', name: 'Face Mask', icon: 'Happy-outline' },
    { id: 'headwear', name: 'Headwear', icon: 'fitness-outline' },
  ];

  useEffect(() => {
    fetchAssets();
    fetchCurrentAvatar();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchAssets();
    }
  }, [selectedCategory]);

  async function fetchCurrentAvatar() {
    try {
      // Fetch current avatar data
      const response = await fetch(
        `https://api.readyplayer.me/v2/avatars/${avatarId}`,
        {
          headers: {
            'Authorization': `Bearer ${rpmToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentAvatarData(data.data);
      }

      // Set preview URL
      setAvatarPreviewUrl(`https://api.readyplayer.me/v2/avatars/${avatarId}.glb?preview=true`);
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  }

  async function fetchAssets() {
    try {
      setLoading(true);
      
      // Get user profile to get RPM user ID
      const token = await AsyncStorage.getItem('access_token');
      const profileResponse = await fetch(`${CONFIG.API_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profile = await profileResponse.json();
      const rpmUserId = profile.rpm_user_id;

      // Fetch assets from Ready Player Me
      const response = await fetch(
        `https://api.readyplayer.me/v1/assets?filter=usable-by-user-and-app&filterApplicationId=${RPM_APP_ID}&filterUserId=${rpmUserId}&type=${selectedCategory}`,
        {
          headers: {
            'X-APP-ID': RPM_APP_ID,
            'Authorization': `Bearer ${rpmToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }

      const data = await response.json();
      setAssets(data.data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      Alert.alert('Error', 'Failed to load customization options');
    } finally {
      setLoading(false);
    }
  }

  async function equipAsset(assetId) {
    try {
      // Update avatar with new asset
      const updateData = {};
      updateData[selectedCategory] = assetId;

      const response = await fetch(
        `https://api.readyplayer.me/v2/avatars/${avatarId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rpmToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to equip asset');
      }

      const data = await response.json();
      setCurrentAvatarData(data.data);
      
      // Refresh preview
      setAvatarPreviewUrl(`https://api.readyplayer.me/v2/avatars/${avatarId}.glb?preview=true&t=${Date.now()}`);
      
      Alert.alert('Success', 'Item equipped successfully!');
    } catch (error) {
      console.error('Error equipping asset:', error);
      Alert.alert('Error', 'Failed to equip item');
    }
  }

  async function saveAndContinue() {
    try {
      setSaving(true);

      // Save the avatar (make changes permanent)
      const saveResponse = await fetch(
        `https://api.readyplayer.me/v2/avatars/${avatarId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${rpmToken}`
          }
        }
      );

      if (!saveResponse.ok) {
        throw new Error('Failed to save avatar');
      }

      // Get user role to navigate to correct home screen
      const userRole = await AsyncStorage.getItem('user_role');
      
      Alert.alert('Success', 'Avatar customized successfully!');
      
      if (userRole === 'doctor') {
        navigation.navigate('DoctorHome');
      } else {
        navigation.navigate('PatientHome');
      }
      
    } catch (error) {
      console.error('Error saving avatar:', error);
      Alert.alert('Error', 'Failed to save avatar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <LinearGradient colors={["#e8eef9", "#d5dff5", "#e8eef9"]} style={{ flex: 1 }}>
      <LinearGradient colors={["#6B70A8", "#9896C4"]} style={styles.header}>
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
        <Text style={styles.title}>Customize Avatar</Text>
        <Text style={styles.subtitle}>Choose your unique style</Text>
      </LinearGradient>

      {/* Avatar Preview */}
      <View style={styles.previewContainer}>
        <View style={styles.previewPlaceholder}>
          <Ionicons name="person" size={60} color="#3b82f6" />
          <Text style={styles.previewText}>Avatar Preview</Text>
          <Text style={styles.previewHint}>3D render will appear here</Text>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryTab,
              selectedCategory === category.id && styles.categoryTabActive
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons 
              name={category.icon} 
              size={28} 
              color={selectedCategory === category.id ? '#ffffff' : '#64748b'} 
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === category.id && styles.categoryTextActive
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Assets List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading options...</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.assetsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.assetItem,
                currentAvatarData?.assets[selectedCategory] === item.id && styles.assetItemActive
              ]}
              onPress={() => equipAsset(item.id)}
            >
              <Image 
                source={{ uri: item.iconUrl }} 
                style={styles.assetImage}
                resizeMode="cover"
              />
              <Text style={styles.assetName} numberOfLines={2}>{item.name}</Text>
              {currentAvatarData?.assets[selectedCategory] === item.id && (
                <View style={styles.equippedBadge}>
                  <Text style={styles.equippedText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items available in this category</Text>
          }
        />
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={async () => {
            const userRole = await AsyncStorage.getItem('user_role');
            const homeScreen = userRole === 'doctor' ? 'DoctorHome' : 'PatientHome';
            navigation.navigate(homeScreen);
          }}
        >
          <Ionicons name="close-circle-outline" size={20} color="#94a3b8" />
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={saveAndContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save & Continue</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(226, 232, 240, 0.8)',
    marginTop: 6,
  },
  previewContainer: {
    height: 220,
    margin: 20,
    marginBottom: 15,
  },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  previewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
  },
  previewHint: {
    fontSize: 13,
    color: 'rgba(148, 163, 184, 0.8)',
    marginTop: 6,
  },
  categoryContainer: {
    maxHeight: 90,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  categoryTab: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    minWidth: 95,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  categoryTabActive: {
    backgroundColor: '#5BA3E0',
    borderColor: '#3b82f6',
  },
  categoryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 6,
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  assetsList: {
    padding: 15,
  },
  assetItem: {
    flex: 1,
    margin: 6,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minHeight: 130,
    maxWidth: '30%',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  assetItemActive: {
    borderColor: '#5BA3E0',
    backgroundColor: 'rgba(91, 163, 224, 0.05)',
  },
  assetImage: {
    width: 65,
    height: 65,
    borderRadius: 33,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  assetName: {
    fontSize: 11,
    color: '#1e293b',
    textAlign: 'center',
    fontWeight: '500',
  },
  equippedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10b981',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equippedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 50,
    fontSize: 15,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1.5,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  skipButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
