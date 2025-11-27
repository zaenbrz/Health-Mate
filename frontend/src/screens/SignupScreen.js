import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../config';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
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

  function onSignUp() {
    setLoading(true);
    const API_URL = `${CONFIG.API_URL}/auth/signup`;
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Signup failed');
        setMessage('Signup successful!');
        navigation.navigate('Login');
      })
      .catch(err => setMessage(`Error: ${err.message || String(err)}`))
      .finally(() => setLoading(false));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={["#6B70A8", "#7E5CAD", "#9896C4"]} style={styles.header}>
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
          <Ionicons name="person-add" size={70} color="#ffffff" />
          <Text style={styles.title}>Create Account</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.welcome}>Join HealthMate</Text>
        <Text style={styles.subtitle}>Start your health journey today</Text>
        
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

        <View style={styles.roleContainer}>
          <Ionicons name="briefcase-outline" size={22} color="#94a3b8" style={styles.inputIcon} />
          <View style={styles.roleOptions}>
            <TouchableOpacity 
              style={[styles.roleButton, role === 'patient' && styles.roleButtonActive]}
              onPress={() => setRole('patient')}
            >
              <Text style={[styles.roleButtonText, role === 'patient' && styles.roleButtonTextActive]}>Patient</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleButton, role === 'doctor' && styles.roleButtonActive]}
              onPress={() => setRole('doctor')}
            >
              <Text style={[styles.roleButtonText, role === 'doctor' && styles.roleButtonTextActive]}>Doctor</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.forgot}>Already have an account? <Text style={{fontWeight: '700', color: '#5BA3E0'}}>Sign in</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onSignUp} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>Create Account</Text>
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { 
    flex: 0.35, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
  },
  title: { 
    fontSize: 34, 
    fontWeight: '700', 
    color: '#ffffff', 
    marginTop: 16,
    letterSpacing: 0.5,
  },
  card: { 
    flex: 0.65, 
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
  roleContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  roleOptions: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#5BA3E0',
  },
  roleButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#ffffff',
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
  message: { 
    marginTop: 16, 
    color: '#10b981', 
    fontWeight: '600',
    textAlign: 'center',
  },
});
