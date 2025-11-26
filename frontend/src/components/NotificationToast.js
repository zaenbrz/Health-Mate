import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

const { width } = Dimensions.get('window');

const NotificationToast = () => {
  const [notifications, setNotifications] = useState([]);
  const [lastNotificationId, setLastNotificationId] = useState(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

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
        tension: 50,
        friction: 8,
      }),
      Animated.delay(4000), // Show for 4 seconds
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setNotifications([]);
    });
  };

  const dismissNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
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
      low: '#3498db',
      medium: '#f39c12',
      high: '#e74c3c',
      urgent: '#c0392b'
    };
    return colors[priority] || '#667eea';
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
          backgroundColor: getPriorityColor(notification.priority),
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => handlePress(notification)}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={getNotificationIcon(notification.type)}
            size={28}
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
          <Ionicons name="close" size={22} color="#fff" />
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
    paddingTop: 50, // Account for status bar
    paddingHorizontal: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.95,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
});

export default NotificationToast;
