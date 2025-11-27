import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      <LinearGradient colors={["#6B70A8", "#7E5CAD", "#9896C4"]} style={styles.header}>
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
          <Ionicons name="fitness" size={70} color="#ffffff" />
          <Text style={styles.title}>HealthMate</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.welcome}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your journey</Text>
        
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={22} color="#94a3b8" style={styles.inputIcon} />
          <TextInput 
            placeholder="Email address" 
            value={email} 
            onChangeText={setEmail} 
            style={styles.input} 
            keyboardType="email-address" 
            autoCapitalize="none"
            placeholderTextColor="rgba(148, 163, 184, 0.6)"
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={22} color="#94a3b8" style={styles.inputIcon} />
          <TextInput 
            placeholder="Password" 
            value={password} 
            onChangeText={setPassword} 
            style={styles.input} 
            secureTextEntry={!showPassword}
            placeholderTextColor="rgba(148, 163, 184, 0.6)"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.forgot}>Don't have an account? <Text style={{fontWeight: '700', color: '#5BA3E0'}}>Sign up</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onSignIn} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { 
    flex: 0.4, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
  },
  title: { 
    fontSize: 36, 
    fontWeight: '700', 
    color: '#ffffff', 
    marginTop: 16,
    letterSpacing: 0.5,
  },
  card: { 
    flex: 0.6, 
    backgroundColor: '#ffffff', 
    marginTop: -30, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 28,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  welcome: { 
    fontSize: 26, 
    fontWeight: '700', 
    marginBottom: 10,
    color: '#474E93',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
    fontWeight: '400',
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: { 
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#474E93',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },
  forgot: { 
    color: '#64748b', 
    marginVertical: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  button: { 
    marginTop: 20, 
    backgroundColor: '#5BA3E0', 
    paddingVertical: 16, 
    paddingHorizontal: 48, 
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#5BA3E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: { 
    color: '#ffffff', 
    fontWeight: '700',
    fontSize: 16,
  },
});

// (loading state handled via useState above)
