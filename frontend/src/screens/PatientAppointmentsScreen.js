import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../config';

const PatientAppointmentsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('book'); // 'book' or 'my-appointments'
  const [doctors, setDoctors] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (activeTab === 'book') {
      await fetchDoctors();
    } else {
      await fetchMyAppointments();
    }
  };

  const fetchDoctors = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/appointments/doctors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDoctors(data);
      } else {
        Alert.alert('Error', 'Failed to fetch doctors');
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      Alert.alert('Error', 'Failed to load doctors');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMyAppointments = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/appointments/my-appointments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Fetch doctor details for each appointment
        const appointmentsWithDoctorDetails = await Promise.all(
          data.map(async (appointment) => {
            try {
              const doctorResponse = await fetch(`${CONFIG.API_URL}/appointments/doctors`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (doctorResponse.ok) {
                const allDoctors = await doctorResponse.json();
                const doctor = allDoctors.find(d => d.email === appointment.doctor_email);

                if (doctor) {
                  return {
                    ...appointment,
                    doctor_name: doctor.name
                  };
                }
              }
            } catch (error) {
              console.error('Error fetching doctor details:', error);
            }
            return appointment;
          })
        );

        setMyAppointments(appointmentsWithDoctorDetails);
      } else {
        Alert.alert('Error', 'Failed to fetch appointments');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      Alert.alert('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleDoctorPress = (doctor) => {
    navigation.navigate('BookAppointment', { doctor });
  };

  const filteredDoctors = doctors.filter(doctor => {
    const searchLower = searchQuery.toLowerCase();
    return (
      doctor.name?.toLowerCase().includes(searchLower) ||
      doctor.specialization?.toLowerCase().includes(searchLower) ||
      doctor.email?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10b981';
      case 'confirmed':
      case 'scheduled':
      case 'pending':
        return '#5BA3E0';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    // Handle both "HH:MM:SS" and "HH:MM" formats
    const timePart = timeString.split(':').slice(0, 2).join(':');
    return timePart;
  };

  const renderDoctorCard = (doctor) => (
    <TouchableOpacity
      style={styles.doctorCard}
      onPress={() => handleDoctorPress(doctor)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#ffffff', '#f8fafc']}
        style={styles.doctorCardGradient}
      >
        <View style={styles.doctorCardHeader}>
          <View style={styles.doctorAvatarContainer}>
            <LinearGradient
              colors={['#7E5CAD', '#9896C4']}
              style={styles.doctorAvatar}
            >
              <Ionicons name="medical" size={32} color="#fff" />
            </LinearGradient>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            </View>
          </View>
          <View style={styles.doctorMainInfo}>
            <Text style={styles.doctorName}>Dr. {doctor.name || 'Doctor'}</Text>
            <View style={styles.specializationRow}>
              <View style={styles.specializationBadge}>
                <Ionicons name="fitness" size={12} color="#3b82f6" />
                <Text style={styles.doctorSpecialization}>
                  {doctor.specialization || 'General Practitioner'}
                </Text>
              </View>
            </View>
            {doctor.experience_years && (
              <View style={styles.experienceRow}>
                <Ionicons name="ribbon" size={14} color="#64748b" />
                <Text style={styles.experienceText}>{doctor.experience_years}+ years experience</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.doctorCardFooter}>
          <View style={styles.infoItem}>
            <Ionicons name="mail" size={14} color="#64748b" />
            <Text style={styles.infoText} numberOfLines={1}>{doctor.email}</Text>
          </View>
          {doctor.phone && (
            <View style={styles.infoItem}>
              <Ionicons name="call" size={14} color="#64748b" />
              <Text style={styles.infoText}>{doctor.phone}</Text>
            </View>
          )}
          {doctor.consultation_fee && (
            <View style={styles.feeContainer}>
              <Ionicons name="cash-outline" size={14} color="#10b981" />
              <Text style={styles.feeText}>Rs {doctor.consultation_fee}</Text>
            </View>
          )}
        </View>

        <LinearGradient
          colors={['#5BA3E0', '#4A8FCC']}
          style={styles.bookButton}
        >
          <TouchableOpacity
            style={styles.bookButtonInner}
            onPress={() => handleDoctorPress(doctor)}
            activeOpacity={0.8}
          >
            <Text style={styles.bookButtonText}>Book Appointment</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderAppointmentCard = (appointment) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appointmentDoctor}>
            Dr. {appointment.doctor_name || 'Doctor'}
          </Text>
          <Text style={styles.appointmentType}>{appointment.appointment_type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
          <Text style={styles.statusText}>{appointment.status?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color="#5BA3E0" />
          <Text style={styles.detailText}>{formatDate(appointment.appointment_date)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color="#5BA3E0" />
          <Text style={styles.detailText}>{formatTime(appointment.appointment_time)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="hourglass-outline" size={18} color="#5BA3E0" />
          <Text style={styles.detailText}>{appointment.duration_minutes} minutes</Text>
        </View>
      </View>

      {appointment.notes && (
        <Text style={styles.appointmentNotes}>Notes: {appointment.notes}</Text>
      )}

      {appointment.completion_notes && appointment.status === 'COMPLETED' && (
        <View style={styles.completionNotesContainer}>
          <Text style={styles.completionNotesTitle}>Doctor's Notes:</Text>
          <Text style={styles.completionNotesText}>{appointment.completion_notes}</Text>
        </View>
      )}

      {appointment.status === 'pending' && (
        <View style={styles.appointmentActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => handleCancelAppointment(appointment._id)}
          >
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const handleCancelAppointment = (appointmentId) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              const response = await fetch(`${CONFIG.API_URL}/appointments/${appointmentId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                }
              });

              if (response.ok) {
                Alert.alert('Success', 'Appointment cancelled successfully');
                fetchMyAppointments();
              } else {
                Alert.alert('Error', 'Failed to cancel appointment');
              }
            } catch (error) {
              console.error('Error cancelling appointment:', error);
              Alert.alert('Error', 'Failed to cancel appointment');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient colors={['#6B70A8', '#9896C4']} style={styles.headerGradient}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Ionicons name="calendar" size={32} color="#fff" />
            <Text style={styles.headerTitle}>Appointments</Text>
          </View>
          <View style={styles.backButton} />
        </LinearGradient>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'book' && styles.activeTab]}
          onPress={() => setActiveTab('book')}
        >
          <Text style={[styles.tabText, activeTab === 'book' && styles.activeTabText]}>
            Book Appointment
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-appointments' && styles.activeTab]}
          onPress={() => setActiveTab('my-appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'my-appointments' && styles.activeTabText]}>
            My Appointments
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'book' && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search doctors by name or specialization..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {activeTab === 'book' ? (
              filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor, index) => (
                  <View key={doctor._id || index}>
                    {renderDoctorCard(doctor)}
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={80} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No doctors found' : 'No doctors available'}
                  </Text>
                </View>
              )
            ) : (
              myAppointments.length > 0 ? (
                myAppointments.map((appointment, index) => (
                  <View key={appointment._id || index}>
                    {renderAppointmentCard(appointment)}
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={80} color="#ccc" />
                  <Text style={styles.emptyText}>No appointments yet</Text>
                  <Text style={styles.emptySubtext}>Book your first appointment</Text>
                </View>
              )
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 25,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748b',
  },
  doctorCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  doctorCardGradient: {
    padding: 18,
  },
  doctorCardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  doctorAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  doctorAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 2,
  },
  doctorMainInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  specializationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  specializationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  doctorSpecialization: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  experienceText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  doctorCardFooter: {
    gap: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  feeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
  },
  bookButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  bookButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  appointmentCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#5BA3E0',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appointmentDoctor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#474E93',
    marginBottom: 4,
  },
  appointmentType: {
    fontSize: 14,
    color: '#7E5CAD',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  appointmentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#1e293b',
    marginLeft: 8,
    fontWeight: '500',
  },
  appointmentNotes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  completionNotesContainer: {
    backgroundColor: '#e8f4f8',
    borderLeftWidth: 4,
    borderLeftColor: '#5BA3E0',
    padding: 12,
    marginTop: 12,
    borderRadius: 8,
  },
  completionNotesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#474E93',
    marginBottom: 6,
  },
  completionNotesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  appointmentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 20,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
});

export default PatientAppointmentsScreen;
