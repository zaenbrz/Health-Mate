import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../config';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00'
];

const DoctorAvailabilityScreen = ({ navigation }) => {
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [blockReasonModalVisible, setBlockReasonModalVisible] = useState(false);
  const [selectedSlotToBlock, setSelectedSlotToBlock] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  // Helper function to generate 30-minute time slots from start to end time
  const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    let current = new Date(start);
    while (current < end) {
      const next = new Date(current.getTime() + 30 * 60000); // Add 30 minutes
      slots.push({
        start: current.toTimeString().slice(0, 5), // HH:MM format
        end: next.toTimeString().slice(0, 5)
      });
      current = next;
    }
    
    return slots;
  };

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userEmail = await AsyncStorage.getItem('user_email');

      if (!token || !userEmail) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/doctor-availability/weekly-schedule/${userEmail}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const schedule = data.schedule;
        
        // Convert weekly schedule to time slots for each day
        const structuredAvailability = {};
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        days.forEach(day => {
          const dayKey = day.toLowerCase();
          if (schedule[dayKey] && schedule[dayKey].is_available) {
            // Generate 30-minute slots from start to end time
            const slots = generateTimeSlots(schedule[dayKey].start_time, schedule[dayKey].end_time);
            structuredAvailability[day] = slots.map(slot => ({
              start_time: slot.start,
              end_time: slot.end,
              is_available: true
            }));
          }
        });
        
        setAvailability(structuredAvailability);
      } else if (response.status === 404) {
        // No availability set yet
        setAvailability({});
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to fetch availability');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = (day) => {
    setSelectedDay(day);
    setSelectedSlots(availability[day] || []);
    setEditModalVisible(true);
  };

  const toggleTimeSlot = (time) => {
    const existingSlot = selectedSlots.find(s => s.start_time === time);
    
    if (existingSlot) {
      // Remove slot
      setSelectedSlots(selectedSlots.filter(s => s.start_time !== time));
    } else {
      // Add slot (default 30 min duration)
      const [hours, minutes] = time.split(':');
      const endHour = minutes === '30' ? parseInt(hours) + 1 : hours;
      const endMinutes = minutes === '30' ? '00' : '30';
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes}`;
      
      setSelectedSlots([...selectedSlots, {
        start_time: time,
        end_time: endTime,
        is_available: true
      }]);
    }
  };

  const handleBlockSlot = (slot) => {
    setSelectedSlotToBlock(slot);
    setBlockReason(slot.reason || '');
    setBlockReasonModalVisible(true);
  };

  const confirmBlockSlot = () => {
    if (!blockReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for blocking');
      return;
    }

    const updatedSlots = selectedSlots.map(s => 
      s.start_time === selectedSlotToBlock.start_time
        ? { ...s, is_available: false, reason: blockReason }
        : s
    );
    setSelectedSlots(updatedSlots);
    setBlockReasonModalVisible(false);
    setBlockReason('');
  };

  const handleUnblockSlot = (slot) => {
    const updatedSlots = selectedSlots.map(s => 
      s.start_time === slot.start_time
        ? { ...s, is_available: true, reason: undefined }
        : s
    );
    setSelectedSlots(updatedSlots);
  };

  const saveAvailability = async () => {
    if (!selectedDay) return;

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userEmail = await AsyncStorage.getItem('user_email');

      if (!token || !userEmail) {
        navigation.navigate('Login');
        return;
      }

      // Build weekly schedule payload
      // For the selected day, find the earliest start and latest end time
      let daySchedule = null;
      if (selectedSlots.length > 0) {
        const availableSlots = selectedSlots.filter(s => s.is_available);
        if (availableSlots.length > 0) {
          const startTimes = availableSlots.map(s => s.start_time);
          const endTimes = availableSlots.map(s => s.end_time);
          daySchedule = {
            start_time: startTimes[0], // First slot start
            end_time: endTimes[endTimes.length - 1], // Last slot end
            is_available: true
          };
        }
      }

      // Build the weekly schedule object
      const weeklySchedule = {
        doctor_email: userEmail,
        monday: selectedDay === 'Monday' ? daySchedule : availability.Monday?.[0] ? {
          start_time: availability.Monday[0].start_time,
          end_time: availability.Monday[availability.Monday.length - 1].end_time,
          is_available: true
        } : null,
        tuesday: selectedDay === 'Tuesday' ? daySchedule : availability.Tuesday?.[0] ? {
          start_time: availability.Tuesday[0].start_time,
          end_time: availability.Tuesday[availability.Tuesday.length - 1].end_time,
          is_available: true
        } : null,
        wednesday: selectedDay === 'Wednesday' ? daySchedule : availability.Wednesday?.[0] ? {
          start_time: availability.Wednesday[0].start_time,
          end_time: availability.Wednesday[availability.Wednesday.length - 1].end_time,
          is_available: true
        } : null,
        thursday: selectedDay === 'Thursday' ? daySchedule : availability.Thursday?.[0] ? {
          start_time: availability.Thursday[0].start_time,
          end_time: availability.Thursday[availability.Thursday.length - 1].end_time,
          is_available: true
        } : null,
        friday: selectedDay === 'Friday' ? daySchedule : availability.Friday?.[0] ? {
          start_time: availability.Friday[0].start_time,
          end_time: availability.Friday[availability.Friday.length - 1].end_time,
          is_available: true
        } : null,
        saturday: selectedDay === 'Saturday' ? daySchedule : availability.Saturday?.[0] ? {
          start_time: availability.Saturday[0].start_time,
          end_time: availability.Saturday[availability.Saturday.length - 1].end_time,
          is_available: true
        } : null,
        sunday: selectedDay === 'Sunday' ? daySchedule : availability.Sunday?.[0] ? {
          start_time: availability.Sunday[0].start_time,
          end_time: availability.Sunday[availability.Sunday.length - 1].end_time,
          is_available: true
        } : null,
        slot_duration_minutes: 30
      };

      const response = await fetch(`${CONFIG.API_URL}/doctor-availability/set-weekly-schedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(weeklySchedule)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save availability');
      }

      // Update local state
      setAvailability({
        ...availability,
        [selectedDay]: selectedSlots
      });

      Alert.alert('Success', 'Availability updated successfully');
      setEditModalVisible(false);
      fetchAvailability(); // Refresh data
    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const deleteAllSlotsForDay = async () => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete all availability for ${selectedDay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              const userEmail = await AsyncStorage.getItem('user_email');

              const response = await fetch(
                `${CONFIG.API_URL}/doctor-availability/${userEmail}/${selectedDay}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (response.ok) {
                const updatedAvailability = { ...availability };
                delete updatedAvailability[selectedDay];
                setAvailability(updatedAvailability);
                setSelectedSlots([]);
                Alert.alert('Success', 'Availability deleted');
              } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.detail || 'Failed to delete availability');
              }
            } catch (error) {
              console.error('Error deleting availability:', error);
              Alert.alert('Error', 'Failed to delete availability');
            }
          }
        }
      ]
    );
  };

  const DayCard = ({ day }) => {
    const slots = availability[day] || [];
    const availableSlots = slots.filter(s => s.is_available).length;
    const blockedSlots = slots.filter(s => !s.is_available).length;

    return (
      <TouchableOpacity
        style={styles.dayCard}
        onPress={() => handleDayPress(day)}
      >
        <View style={styles.dayHeader}>
          <Text style={styles.dayName}>{day}</Text>
          <Ionicons name="create-outline" size={20} color="#667eea" />
        </View>
        {slots.length > 0 ? (
          <View style={styles.slotsSummary}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={16} color="#2ecc71" />
              <Text style={[styles.summaryText, {marginLeft: 5}]}>{availableSlots} available</Text>
            </View>
            {blockedSlots > 0 && (
              <View style={styles.summaryItem}>
                <Ionicons name="close-circle" size={16} color="#e74c3c" />
                <Text style={[styles.summaryText, {marginLeft: 5}]}>{blockedSlots} blocked</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.noSlotsText}>No slots set</Text>
        )}
      </TouchableOpacity>
    );
  };

  const EditAvailabilityModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={editModalVisible}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedDay} Availability</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close-circle" size={30} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.instructionText}>
              Tap time slots to add/remove availability
            </Text>

            <View style={styles.timeSlotsGrid}>
              {TIME_SLOTS.map((time) => {
                const isSelected = selectedSlots.some(s => s.start_time === time);
                const slot = selectedSlots.find(s => s.start_time === time);
                const isBlocked = slot && !slot.is_available;

                return (
                  <View key={time} style={styles.timeSlotContainer}>
                    <TouchableOpacity
                      style={[
                        styles.timeSlot,
                        isSelected && styles.timeSlotSelected,
                        isBlocked && styles.timeSlotBlocked
                      ]}
                      onPress={() => toggleTimeSlot(time)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        (isSelected || isBlocked) && styles.timeSlotTextSelected
                      ]}>
                        {time}
                      </Text>
                      {isBlocked && (
                        <Ionicons name="lock-closed" size={12} color="#fff" />
                      )}
                    </TouchableOpacity>
                    {isSelected && (
                      <View style={styles.slotActions}>
                        {!isBlocked ? (
                          <TouchableOpacity
                            style={styles.blockButton}
                            onPress={() => handleBlockSlot(slot)}
                          >
                            <Ionicons name="lock-closed-outline" size={14} color="#e74c3c" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.unblockButton}
                            onPress={() => handleUnblockSlot(slot)}
                          >
                            <Ionicons name="lock-open-outline" size={14} color="#2ecc71" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {selectedSlots.length > 0 && (
              <View style={styles.selectedSlotsInfo}>
                <Text style={styles.selectedSlotsTitle}>Selected Slots:</Text>
                {selectedSlots.map((slot, index) => (
                  <View key={index} style={styles.selectedSlotItem}>
                    <Text style={styles.selectedSlotTime}>
                      {slot.start_time} - {slot.end_time}
                    </Text>
                    {!slot.is_available && (
                      <Text style={styles.blockReasonText}>
                        Blocked: {slot.reason}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {selectedSlots.length > 0 && (
              <TouchableOpacity
                style={[styles.footerButton, styles.deleteButton]}
                onPress={deleteAllSlotsForDay}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={[styles.footerButtonText, {marginLeft: 8}]}>Delete All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.footerButton, styles.saveButton]}
              onPress={saveAvailability}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={[styles.footerButtonText, {marginLeft: 8}]}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const BlockReasonModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={blockReasonModalVisible}
      onRequestClose={() => setBlockReasonModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.reasonModalContent}>
          <Text style={styles.reasonModalTitle}>Block Time Slot</Text>
          <Text style={styles.reasonModalSubtitle}>
            Provide a reason for blocking this time slot:
          </Text>
          
          <TextInput
            style={styles.reasonInput}
            placeholder="e.g., Meeting, Break, Personal"
            value={blockReason}
            onChangeText={setBlockReason}
            multiline
            maxLength={100}
          />

          <View style={styles.reasonModalButtons}>
            <TouchableOpacity
              style={[styles.reasonButton, styles.cancelReasonButton]}
              onPress={() => {
                setBlockReasonModalVisible(false);
                setBlockReason('');
              }}
            >
              <Text style={styles.reasonButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reasonButton, styles.confirmReasonButton]}
              onPress={confirmBlockSlot}
            >
              <Text style={styles.reasonButtonText}>Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading availability...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Availability</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#667eea" />
          <Text style={styles.infoText}>
            Set your weekly availability. Patients can only book appointments during available slots.
          </Text>
        </View>

        {DAYS_OF_WEEK.map((day) => (
          <DayCard key={day} day={day} />
        ))}
      </ScrollView>

      <EditAvailabilityModal />
      <BlockReasonModal />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#666',
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  slotsSummary: {
    flexDirection: 'row',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  summaryText: {
    fontSize: 13,
    color: '#666',
  },
  noSlotsText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeSlotContainer: {
    position: 'relative',
    margin: 5,
  },
  timeSlot: {
    width: 85,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#2ecc71',
  },
  timeSlotBlocked: {
    backgroundColor: '#e74c3c',
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  timeSlotTextSelected: {
    color: '#fff',
  },
  slotActions: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  blockButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  unblockButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2ecc71',
  },
  selectedSlotsInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
  },
  selectedSlotsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  selectedSlotItem: {
    paddingVertical: 5,
  },
  selectedSlotTime: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  blockReasonText: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#667eea',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  footerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reasonModalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 'auto',
    borderRadius: 15,
    padding: 20,
  },
  reasonModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  reasonModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reasonModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  reasonButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelReasonButton: {
    backgroundColor: '#95a5a6',
  },
  confirmReasonButton: {
    backgroundColor: '#e74c3c',
  },
  reasonButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default DoctorAvailabilityScreen;
