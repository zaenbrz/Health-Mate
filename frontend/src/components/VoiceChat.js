import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

export default function VoiceChat({ selectedLanguage, onResponse, onProcessingChange }) {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  useEffect(() => {
    setupAudio();
  }, []);

  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing || isRecording);
    }
  }, [isProcessing, isRecording]);

  async function setupAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  }

  async function startRecording() {
    try {
      // Request permission if not granted
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission...');
        await requestPermission();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    console.log('Stopping recording...');
    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      console.log('Recording stopped, stored at:', uri);
      
      // Process the recording
      await processVoiceInput(uri);
      
      setRecording(null);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsProcessing(false);
    }
  }

  async function processVoiceInput(audioUri) {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Step 1: Transcribe audio to text
      console.log('📝 Transcribing audio...');
      const formData = new FormData();
      formData.append('audio_file', {
        uri: audioUri,
        type: 'audio/x-wav',
        name: 'recording.wav',
      });
      formData.append('language', selectedLanguage);

      const transcribeResponse = await fetch(`${CONFIG.API_URL}/speech/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error('Transcription failed');
      }

      const transcribeData = await transcribeResponse.json();
      const userMessage = transcribeData.transcription;
      console.log('✅ Transcription:', userMessage);

      // Step 2: Get AI response
      console.log('🤖 Getting AI response...');
      const chatResponse = await fetch(`${CONFIG.API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!chatResponse.ok) {
        throw new Error('Chat failed');
      }

      const chatData = await chatResponse.json();
      const aiMessage = chatData.response;
      console.log('✅ AI Response:', aiMessage);

      // Send response to parent component
      if (onResponse) {
        onResponse(aiMessage);
      }

    } catch (error) {
      console.error('Error processing voice input:', error);
      if (onResponse) {
        onResponse('Sorry, I could not process your request. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleMicPress() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  return (
    <View style={styles.micContainer}>
      <TouchableOpacity
        style={[
          styles.micButton,
          isRecording && styles.micButtonRecording,
          isProcessing && styles.micButtonProcessing
        ]}
        onPress={handleMicPress}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <Text style={styles.micIcon}>
            {isRecording ? '⏹️' : '🎤'}
          </Text>
        )}
      </TouchableOpacity>
      
      {isRecording && (
        <Text style={styles.recordingText}>Recording...</Text>
      )}
      {isProcessing && (
        <Text style={styles.processingText}>Processing...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  micContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micButtonRecording: {
    backgroundColor: '#ef4444',
  },
  micButtonProcessing: {
    backgroundColor: '#94a3b8',
  },
  micIcon: {
    fontSize: 40,
  },
  recordingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  processingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
});

