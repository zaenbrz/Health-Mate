import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkProfileComplete(token) {
    try {
      const response = await fetch(`${CONFIG.API_URL}/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        const userRole = profile.role || 'patient';
        
        // Store user role for later use
        await AsyncStorage.setItem('user_role', userRole);
        await AsyncStorage.setItem('user_email', profile.email);
        
        // Check if basic profile is complete
        if (!profile.name) {
          navigation.navigate('CompleteProfile');
          return;
        }
        
        // Check if avatar is set (required for both doctors and patients)
        if (!profile.avatar_id) {
          navigation.navigate('AvatarSelection');
          return;
        }
        
        // Navigate to appropriate home screen based on role
        if (userRole === 'doctor') {
          navigation.navigate('DoctorHome');
        } else {
          navigation.navigate('PatientHome');
        }
      } else {
        // If profile doesn't exist or error, go to complete profile
        navigation.navigate('CompleteProfile');
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      // On error, navigate to complete profile to be safe
      navigation.navigate('CompleteProfile');
    }
  }

  function onSignIn() {
    // real auth call
    setLoading(true);
    const API_URL = `${CONFIG.API_URL}/auth/login`;
    console.log("Sending request to:", API_URL);
    console.log("Request body:", { email, password });

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');
        console.log("Response received:", data);
        // Store token and user info
        await AsyncStorage.setItem('access_token', data.access_token);
        await AsyncStorage.setItem('user_role', data.role);
        await AsyncStorage.setItem('user_email', data.email);
        // Check if profile is complete
        await checkProfileComplete(data.access_token);
      })
      .catch(err => {
        console.error("Request failed:", err);
        Alert.alert('Login error', err.message || String(err));
      })
      .finally(() => setLoading(false));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={["#e3f2fd", "#bbdefb"]} style={styles.header}>
        <Text style={styles.title}>HealthMate</Text>
        <Image source={{ uri: 'https://via.placeholder.com/120.png' }} style={styles.logo} />
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome!</Text>
        <TextInput placeholder="Enter your email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
        <TextInput placeholder="Enter your password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />

        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.forgot}>Don't have an account? <Text style={{fontWeight: '700'}}>Sign up</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#1e3a8a" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flex: 0.45, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '700', color: '#102a43', marginTop: 20 },
  logo: { width: 120, height: 120, marginTop: 10 },
  card: { flex: 0.55, backgroundColor: '#fff', marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, alignItems: 'center' },
  welcome: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: { width: '90%', backgroundColor: '#f5f7fa', padding: 12, borderRadius: 12, marginBottom: 12 },
  forgot: { color: '#6b7280', marginVertical: 8 },
  button: { marginTop: 12, backgroundColor: '#dbeafe', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 24 },
  buttonText: { color: '#1e3a8a', fontWeight: '700' }
});

// (loading state handled via useState above)
