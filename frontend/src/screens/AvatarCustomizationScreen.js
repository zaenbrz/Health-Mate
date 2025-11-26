import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    { id: 'outfit', name: 'Outfits', icon: '👕' },
    { id: 'hairStyle', name: 'Hair', icon: '💇' },
    { id: 'glasses', name: 'Glasses', icon: '👓' },
    { id: 'faceMask', name: 'Face Mask', icon: '😷' },
    { id: 'headwear', name: 'Headwear', icon: '🎩' },
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
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <LinearGradient colors={["#e3f2fd", "#bbdefb"]} style={styles.header}>
        <Text style={styles.title}>Customize Your Avatar</Text>
        <Text style={styles.subtitle}>Choose your style</Text>
      </LinearGradient>

      {/* Avatar Preview */}
      <View style={styles.previewContainer}>
        <View style={styles.previewPlaceholder}>
          <Text style={styles.previewText}>Avatar Preview</Text>
          <Text style={styles.previewHint}>3D preview will render here</Text>
          {/* TODO: Integrate 3D viewer for GLB file */}
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
            <Text style={styles.categoryIcon}>{category.icon}</Text>
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
          <ActivityIndicator size="large" color="#60a5fa" />
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
            <Text style={styles.saveButtonText}>Save & Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  previewContainer: {
    height: 200,
    margin: 20,
    marginBottom: 10,
  },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  previewHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 5,
  },
  categoryContainer: {
    maxHeight: 80,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    minWidth: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTabActive: {
    backgroundColor: '#60a5fa',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  categoryTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetsList: {
    padding: 15,
  },
  assetItem: {
    flex: 1,
    margin: 5,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    minHeight: 120,
    maxWidth: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  assetItemActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
  },
  assetImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 5,
  },
  assetName: {
    fontSize: 11,
    color: '#1e3a8a',
    textAlign: 'center',
    fontWeight: '500',
  },
  equippedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#60a5fa',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equippedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 40,
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  skipButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#60a5fa',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
