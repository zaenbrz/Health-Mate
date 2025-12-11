import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

export default function VoiceChat({ selectedLanguage, onResponse, onProcessingChange, avatarViewerRef }) {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wave1Anim = useRef(new Animated.Value(0)).current;
  const wave2Anim = useRef(new Animated.Value(0)).current;
  const wave3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setupAudio();
  }, []);

  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing || isRecording);
    }
  }, [isProcessing, isRecording]);

  // Animate when recording
  useEffect(() => {
    if (isRecording) {
      // Pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Wave animations with stagger
      const waveAnimation = (anim, delay) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      waveAnimation(wave1Anim, 0);
      waveAnimation(wave2Anim, 500);
      waveAnimation(wave3Anim, 1000);
    } else {
      // Idle state - gentle breathing animation
      pulseAnim.setValue(1);
      wave1Anim.setValue(0);
      wave2Anim.setValue(0);
      wave3Anim.setValue(0);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isRecording]);

  // Scale animation on press
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

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

      // Play yes-nod animation while recording (index 1)
      if (avatarViewerRef?.current) {
        console.log('🎬 Playing yes-nod animation (loop) while recording');
        avatarViewerRef.current.playAnimation(1, true, 0.3);
      }

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

      // Play thoughtful animation while AI generates response (index 2)
      if (avatarViewerRef?.current) {
        console.log('🤔 Playing thoughtful animation (loop) while thinking');
        avatarViewerRef.current.playAnimation(2, true, 0.3);
      }

      // Show "Thinking..." state instead of immediate response
      if (onResponse) {
        onResponse("Thinking...");
      }

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

      // Don't show full response yet - wait for speech

      // Step 3: Generate speech with lip-sync (don't fail if this errors)
      try {
        console.log('🎤 Generating speech with lip-sync...');
        const lipsyncResponse = await fetch(`${CONFIG.API_URL}/speech/lipsync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: aiMessage,
            language: selectedLanguage
          }),
        });

        if (!lipsyncResponse.ok) {
          console.error('⚠️ Lip-sync generation failed');
          // Fallback: show full text immediately if audio fails
          if (onResponse) onResponse(aiMessage);
          return;
        }

        const lipsyncData = await lipsyncResponse.json();
        console.log('✅ Lip-sync data received');

        // Step 4: Play audio and animate avatar
        if (avatarViewerRef?.current) {
          const audioUrl = `${CONFIG.API_URL}${lipsyncData.audio_url}`;
          console.log('🔊 Playing audio with lip-sync:', audioUrl);

          // Play normal animation while speaking (index 3 = normal.fbx)
          console.log('🗣️ Playing normal animation while speaking');
          avatarViewerRef.current.playAnimation(3, true, 0.3);

          // Start lip-sync audio immediately
          setTimeout(() => {
            avatarViewerRef.current.playAudioWithLipsync(audioUrl, lipsyncData.visemes);

            // Start Subtitles
            playSubtitles(aiMessage);
          }, 200);
        } else {
          console.warn('⚠️ Avatar viewer ref not available');
          if (onResponse) onResponse(aiMessage);
        }
      } catch (lipsyncError) {
        console.error('⚠️ Lip-sync failed:', lipsyncError);
        if (onResponse) onResponse(aiMessage);
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

  // Helper function to play subtitles sentence by sentence
  const playSubtitles = (text) => {
    if (!onResponse) return;

    // Split text into sentences (keeping punctuation)
    // Matches: (any chars except .!?)+(one or more .!? or end of string)
    const sentences = text.match(/[^.!?]+([.!?]+|$)/g) || [text];

    let currentSentenceIndex = 0;

    const showNextSentence = () => {
      if (currentSentenceIndex >= sentences.length) {
        // Finished - show full text or keep last sentence?
        // Let's show the full text at the end so user can read everything
        // onResponse(text); 
        return;
      }

      const sentence = sentences[currentSentenceIndex].trim();
      onResponse(sentence);

      // Calculate duration based on word count
      const wordCount = sentence.split(/\s+/).length;
      // Assume ~300ms per word + 500ms base
      const duration = Math.max(1500, wordCount * 300 + 500);

      currentSentenceIndex++;
      setTimeout(showNextSentence, duration);
    };

    showNextSentence();
  };

  async function handleMicPress() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  return (
    <View style={styles.micContainer}>
      {/* Animated wave rings - only show when recording */}
      {isRecording && (
        <>
          <Animated.View
            style={[
              styles.waveRing,
              {
                opacity: wave1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: wave1Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.waveRing,
              {
                opacity: wave2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: wave2Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.waveRing,
              {
                opacity: wave3Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: wave3Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      )}

      {/* Main button with pulse effect */}
      <Animated.View
        style={{
          transform: [{ scale: isRecording ? pulseAnim : scaleAnim }],
        }}
      >
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording && styles.micButtonRecording,
            isProcessing && styles.micButtonProcessing
          ]}
          onPress={handleMicPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {/* Gradient overlay for depth */}
          <View style={styles.buttonGradientOverlay} />

          <View style={styles.buttonInner}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : (
              <Ionicons
                name={isRecording ? "stop-circle" : "mic"}
                size={isRecording ? 40 : 36}
                color="#fff"
              />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Status text */}
      {isRecording && (
        <View style={styles.statusContainer}>
          <View style={styles.recordingDot} />
          <Text style={styles.statusText}>Listening...</Text>
        </View>
      )}
      {isProcessing && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Thinking...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  micContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    position: 'relative',
  },
  waveRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
  },
  idleRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#5BA3E0',
    backgroundColor: 'transparent',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#5BA3E0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5BA3E0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'visible',
  },
  micButtonRecording: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  micButtonProcessing: {
    backgroundColor: '#474E93',
    shadowColor: '#474E93',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  buttonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tapToSpeakText: {
    fontSize: 10,
    color: '#fff',
    marginTop: 4,
    fontWeight: '600',
    opacity: 0.9,
  },
  processingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});


