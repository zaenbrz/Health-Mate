import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

export default function CompleteProfileScreen({ navigation, route }) {
  const [userRole, setUserRole] = useState('patient'); // default to patient
  const [loading, setLoading] = useState(false);
  
  // Patient fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('');
  
  // Doctor fields
  const [specialization, setSpecialization] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [consultationFee, setConsultationFee] = useState('');

  useEffect(() => {
    fetchUserRole();
  }, []);

  async function fetchUserRole() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${CONFIG.API_URL}/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        const role = profile.role || 'patient';
        setUserRole(role);
        // Store role for later use
        await AsyncStorage.setItem('user_role', role);
        await AsyncStorage.setItem('user_email', profile.email);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  }

  async function onCompleteProfile() {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (userRole === 'doctor') {
      if (!specialization.trim()) {
        Alert.alert('Error', 'Please enter your specialization');
        return;
      }
      if (!experienceYears || parseInt(experienceYears) < 0) {
        Alert.alert('Error', 'Please enter valid years of experience');
        return;
      }
      if (!consultationFee || parseFloat(consultationFee) < 0) {
        Alert.alert('Error', 'Please enter valid consultation fee');
        return;
      }
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Error', 'Please login first');
        navigation.navigate('Login');
        return;
      }

      let profileData = { name };

      if (userRole === 'patient') {
        // Parse medical history and allergies from comma-separated strings
        const medicalHistoryArray = medicalHistory.split(',').map(item => item.trim()).filter(item => item);
        const allergiesArray = allergies.split(',').map(item => item.trim()).filter(item => item);

        profileData = {
          ...profileData,
          age: age ? parseInt(age) : null,
          medical_history: medicalHistoryArray,
          allergies: allergiesArray
        };
      } else if (userRole === 'doctor') {
        profileData = {
          ...profileData,
          specialization: specialization.trim(),
          experience_years: parseInt(experienceYears),
          consultation_fee: parseFloat(consultationFee),
          availability: {} // Initialize empty availability
        };
      }

      const response = await fetch(`${CONFIG.API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update profile');
      }

      Alert.alert('Success', 'Profile completed successfully!');
      
      // Both patients and doctors go to avatar selection
      navigation.navigate('AvatarSelection');
      
    } catch (error) {
      console.error('Error completing profile:', error);
      Alert.alert('Error', error.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#f8fafc' }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={{ flex: 1 }}>
        <LinearGradient colors={["#6B70A8", "#9896C4"]} style={styles.header}>
          <Ionicons name="person-circle" size={60} color="#ffffff" />
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            {userRole === 'doctor' ? 'Set up your professional profile' : 'Help us personalize your experience'}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Ionicons name="person" size={16} color="#3b82f6" /> Full Name *
            </Text>
            <TextInput 
              placeholder="Enter your full name" 
              value={name} 
              onChangeText={setName} 
              style={styles.input}
              placeholderTextColor="#94a3b8"
            />
          </View>

          {userRole === 'patient' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="calendar" size={16} color="#3b82f6" /> Age
                </Text>
                <TextInput 
                  placeholder="Enter your age" 
                  value={age} 
                  onChangeText={setAge} 
                  style={styles.input}
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="medical" size={16} color="#3b82f6" /> Medical History
                </Text>
                <Text style={styles.hint}>Separate conditions with commas</Text>
                <TextInput 
                  placeholder="E.g., Diabetes, Hypertension, Asthma" 
                  value={medicalHistory} 
                  onChangeText={setMedicalHistory} 
                  style={[styles.input, styles.multiline]}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="alert-circle" size={16} color="#3b82f6" /> Allergies
                </Text>
                <Text style={styles.hint}>Separate allergies with commas</Text>
                <TextInput 
                  placeholder="E.g., Penicillin, Peanuts, Dust" 
                  value={allergies} 
                  onChangeText={setAllergies} 
                  style={[styles.input, styles.multiline]}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="medical" size={16} color="#3b82f6" /> Specialization *
                </Text>
                <TextInput 
                  placeholder="E.g., Cardiology, Dermatology" 
                  value={specialization} 
                  onChangeText={setSpecialization} 
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="time" size={16} color="#3b82f6" /> Years of Experience *
                </Text>
                <TextInput 
                  placeholder="Enter years of experience" 
                  value={experienceYears} 
                  onChangeText={setExperienceYears} 
                  style={styles.input}
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="cash" size={16} color="#3b82f6" /> Consultation Fee *
                </Text>
                <TextInput 
                  placeholder="Enter consultation fee (in USD)" 
                  value={consultationFee} 
                  onChangeText={setConsultationFee} 
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <Text style={styles.hint}>
                <Ionicons name="information-circle" size={14} color="#64748b" /> You can set availability later from settings
              </Text>
            </>
          )}

          <TouchableOpacity 
            style={styles.button} 
            onPress={onCompleteProfile} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Complete Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 70,
    paddingBottom: 35,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    margin: 20,
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    color: '#1e293b',
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#5BA3E0',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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
});
