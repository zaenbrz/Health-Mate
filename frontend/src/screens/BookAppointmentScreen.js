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
  TextInput,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../config';

const BookAppointmentScreen = ({ route, navigation }) => {
  const { doctor } = route.params;
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());

  useEffect(() => {
    fetchDoctorAvailability();
    // Set initial week start to today
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  }, []);

  const fetchDoctorAvailability = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(
        `${CONFIG.API_URL}/doctor-availability/weekly-schedule/${doctor.email}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailability(data.schedule);
      } else if (response.status === 404) {
        Alert.alert('No Availability', 'This doctor has not set their availability yet');
      } else {
        Alert.alert('Error', 'Failed to fetch doctor availability');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getAvailableSlots = (date) => {
    const dayName = getDayName(date).toLowerCase();
    const daySchedule = availability[dayName];

    if (!daySchedule || !daySchedule.is_available) {
      return [];
    }

    // Generate 30-minute slots from start to end time
    const slots = [];
    const start = new Date(`2000-01-01T${daySchedule.start_time}`);
    const end = new Date(`2000-01-01T${daySchedule.end_time}`);

    let current = new Date(start);
    while (current < end) {
      const next = new Date(current.getTime() + 30 * 60000);
      slots.push({
        start_time: current.toTimeString().slice(0, 5),
        end_time: next.toTimeString().slice(0, 5)
      });
      current = next;
    }

    return slots;
  };

  const handleDatePress = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotPress = (slot) => {
    setSelectedSlot(slot);
    setBookingModalVisible(true);
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedSlot) {
      Alert.alert('Error', 'Please select a date and time slot');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userEmail = await AsyncStorage.getItem('user_email');

      if (!token || !userEmail) {
        navigation.navigate('Login');
        return;
      }

      // Format date as YYYY-MM-DD
      const dateStr = selectedDate.toISOString().split('T')[0];

      const appointmentData = {
        patient_email: userEmail,
        doctor_email: doctor.email,
        appointment_date: dateStr,
        appointment_time: selectedSlot.start_time + ':00', // Add seconds
        duration_minutes: 30,
        appointment_type: 'consultation',
        notes: notes
      };

      const response = await fetch(`${CONFIG.API_URL}/appointments/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointmentData)
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'Appointment booked successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setBookingModalVisible(false);
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('Error', 'Failed to book appointment');
    } finally {
      setSaving(false);
    }
  };

  const navigateWeek = (direction) => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    setCurrentWeekStart(newWeekStart);
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const weekDates = getWeekDates();

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.doctorInfoCard}>
        <View style={styles.doctorAvatar}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <View style={styles.doctorDetails}>
          <Text style={styles.doctorName}>Dr. {doctor.name || doctor.email}</Text>
          <Text style={styles.doctorSpecialization}>
            {doctor.specialization || 'General Practitioner'}
          </Text>
          {doctor.phone && (
            <Text style={styles.doctorPhone}>📞 {doctor.phone}</Text>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading availability...</Text>
          </View>
        ) : (
          <>
            <View style={styles.weekNavigator}>
              <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navButton}>
                <Ionicons name="chevron-back" size={24} color="#667eea" />
              </TouchableOpacity>
              <Text style={styles.weekText}>
                {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' - '}
                {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navButton}>
                <Ionicons name="chevron-forward" size={24} color="#667eea" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {weekDates.map((date, index) => {
                const dayName = getDayName(date);
                const slots = getAvailableSlots(date);
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <View key={index} style={styles.dayContainer}>
                    <TouchableOpacity
                      style={[
                        styles.dayHeader,
                        isSelected && styles.dayHeaderSelected,
                        isPast && styles.dayHeaderPast
                      ]}
                      onPress={() => !isPast && handleDatePress(date)}
                      disabled={isPast || slots.length === 0}
                    >
                      <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                        {dayName}
                      </Text>
                      <Text style={[styles.dayDate, isSelected && styles.dayDateSelected]}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                      {slots.length === 0 && (
                        <Text style={styles.noSlotsText}>Not Available</Text>
                      )}
                    </TouchableOpacity>

                    {isSelected && slots.length > 0 && (
                      <View style={styles.slotsContainer}>
                        <Text style={styles.slotsTitle}>Available Time Slots:</Text>
                        <View style={styles.slotsGrid}>
                          {slots.map((slot, slotIndex) => (
                            <TouchableOpacity
                              key={slotIndex}
                              style={[
                                styles.slotButton,
                                selectedSlot?.start_time === slot.start_time && styles.slotButtonSelected
                              ]}
                              onPress={() => handleSlotPress(slot)}
                            >
                              <Text
                                style={[
                                  styles.slotText,
                                  selectedSlot?.start_time === slot.start_time && styles.slotTextSelected
                                ]}
                              >
                                {slot.start_time}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      <Modal
        visible={bookingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Appointment</Text>

            <View style={styles.confirmationDetails}>
              <View style={styles.confirmRow}>
                <Ionicons name="person-outline" size={20} color="#667eea" />
                <Text style={styles.confirmLabel}>Doctor:</Text>
                <Text style={styles.confirmValue}>Dr. {doctor.name || doctor.email}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Ionicons name="calendar-outline" size={20} color="#667eea" />
                <Text style={styles.confirmLabel}>Date:</Text>
                <Text style={styles.confirmValue}>
                  {selectedDate?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Ionicons name="time-outline" size={20} color="#667eea" />
                <Text style={styles.confirmLabel}>Time:</Text>
                <Text style={styles.confirmValue}>{selectedSlot?.start_time}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Ionicons name="hourglass-outline" size={20} color="#667eea" />
                <Text style={styles.confirmLabel}>Duration:</Text>
                <Text style={styles.confirmValue}>30 minutes</Text>
              </View>
            </View>

            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes (Optional):</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Any specific concerns or requests..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setBookingModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleBookAppointment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  doctorInfoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  doctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorSpecialization: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 4,
  },
  doctorPhone: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    marginTop: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  weekNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 15,
  },
  navButton: {
    padding: 5,
  },
  weekText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dayContainer: {
    marginBottom: 15,
  },
  dayHeader: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayHeaderSelected: {
    backgroundColor: '#667eea',
  },
  dayHeaderPast: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  dayNameSelected: {
    color: '#fff',
  },
  dayDate: {
    fontSize: 14,
    color: '#666',
  },
  dayDateSelected: {
    color: '#fff',
  },
  noSlotsText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  slotsContainer: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 15,
    borderRadius: 12,
  },
  slotsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  slotButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    margin: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  slotButtonSelected: {
    backgroundColor: '#764ba2',
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  slotTextSelected: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmationDetails: {
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 10,
    marginRight: 8,
  },
  confirmValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  notesContainer: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    marginHorizontal: -5,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#667eea',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default BookAppointmentScreen;
