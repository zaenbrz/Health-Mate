import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={{ flex: 1 }}>
        <LinearGradient colors={["#e3f2fd", "#bbdefb"]} style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            {userRole === 'doctor' ? 'Set up your professional profile' : 'Help us personalize your experience'}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput 
            placeholder="Enter your full name" 
            value={name} 
            onChangeText={setName} 
            style={styles.input}
          />

          {userRole === 'patient' ? (
            <>
              <Text style={styles.label}>Age</Text>
              <TextInput 
                placeholder="Enter your age" 
                value={age} 
                onChangeText={setAge} 
                style={styles.input}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Medical History</Text>
              <Text style={styles.hint}>Enter conditions separated by commas (e.g., Diabetes, Hypertension)</Text>
              <TextInput 
                placeholder="E.g., Diabetes, Hypertension, Asthma" 
                value={medicalHistory} 
                onChangeText={setMedicalHistory} 
                style={[styles.input, styles.multiline]}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Allergies</Text>
              <Text style={styles.hint}>Enter allergies separated by commas (e.g., Penicillin, Peanuts)</Text>
              <TextInput 
                placeholder="E.g., Penicillin, Peanuts, Dust" 
                value={allergies} 
                onChangeText={setAllergies} 
                style={[styles.input, styles.multiline]}
                multiline
                numberOfLines={3}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Specialization *</Text>
              <TextInput 
                placeholder="E.g., Cardiology, Dermatology" 
                value={specialization} 
                onChangeText={setSpecialization} 
                style={styles.input}
              />

              <Text style={styles.label}>Years of Experience *</Text>
              <TextInput 
                placeholder="Enter years of experience" 
                value={experienceYears} 
                onChangeText={setExperienceYears} 
                style={styles.input}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Consultation Fee *</Text>
              <TextInput 
                placeholder="Enter consultation fee (in USD)" 
                value={consultationFee} 
                onChangeText={setConsultationFee} 
                style={styles.input}
                keyboardType="decimal-pad"
              />

              <Text style={styles.hint}>Note: You can set your availability schedule later from your profile settings</Text>
            </>
          )}

          <TouchableOpacity 
            style={styles.button} 
            onPress={onCompleteProfile} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1e3a8a" />
            ) : (
              <Text style={styles.buttonText}>Complete Profile</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => {
            // TODO: Navigate to home (skip for now)
            Alert.alert('Note', 'You can complete your profile later from settings');
          }}>
            <Text style={styles.skip}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  card: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 5,
    marginTop: 10,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#60a5fa',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#1e3a8a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skip: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 15,
    fontSize: 14,
  },
});
