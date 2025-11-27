import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

const { width } = Dimensions.get('window');

// Updated glassmorphic notification toast with purple-blue palette
const NotificationToast = () => {
  const [notifications, setNotifications] = useState([]);
  const [lastNotificationId, setLastNotificationId] = useState(null);
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    // Check for new notifications every 10 seconds
    const interval = setInterval(checkForNewNotifications, 10000);
    checkForNewNotifications(); // Check immediately on mount
    
    return () => clearInterval(interval);
  }, [lastNotificationId]);

  const checkForNewNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${CONFIG.API_URL}/notifications/?unread_only=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // If we have new notifications
        if (data.length > 0) {
          const latestNotification = data[0];
          
          // Only show if it's a new notification we haven't shown before
          if (latestNotification.id !== lastNotificationId) {
            showNotification(latestNotification);
            setLastNotificationId(latestNotification.id);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  };

  const showNotification = (notification) => {
    setNotifications([notification]);
    
    // Slide down animation
    Animated.sequence([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.delay(4000), // Show for 4 seconds
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setNotifications([]);
    });
  };

  const dismissNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setNotifications([]);
    });
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await fetch(`${CONFIG.API_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handlePress = (notification) => {
    markAsRead(notification.id);
    dismissNotification();
    // You can add navigation logic here based on notification type
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#5BA3E0',
      medium: '#72BAA9',
      high: '#B08CB3',
      urgent: '#7E5CAD'
    };
    return colors[priority] || '#7E5CAD';
  };

  const getNotificationIcon = (type) => {
    const icons = {
      appointment_booked: 'checkmark-circle',
      appointment_cancelled: 'close-circle',
      new_appointment_for_doctor: 'notifications',
      health_reminder: 'fitness',
      appointment_reminder: 'alarm'
    };
    return icons[type] || 'information-circle';
  };

  if (notifications.length === 0) return null;

  const notification = notifications[0];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.content,
          { borderLeftColor: getPriorityColor(notification.priority) }
        ]}
        onPress={() => handlePress(notification)}
        activeOpacity={0.9}
      >
        <View style={[
          styles.iconContainer,
          { backgroundColor: getPriorityColor(notification.priority) }
        ]}>
          <Ionicons
            name={getNotificationIcon(notification.type)}
            size={24}
            color="#fff"
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismissNotification}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={24} color="#ffffff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(71, 78, 147, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: 'blur(10px)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    opacity: 0.9,
  },
});

export default NotificationToast;
