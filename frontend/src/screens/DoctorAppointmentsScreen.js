import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../config';

const DoctorAppointmentsScreen = ({ navigation }) => {
  console.log('🔄 DoctorAppointmentsScreen RENDER');
  
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [viewingFullReport, setViewingFullReport] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [completionNotesModal, setCompletionNotesModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const modalStateRef = useRef(false);

  useEffect(() => {
    console.log('🔄 completionNotesModal state changed to:', completionNotesModal);
    modalStateRef.current = completionNotesModal;
  }, [completionNotesModal]);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userEmail = await AsyncStorage.getItem('user_email');
      
      const response = await fetch(`${CONFIG.API_URL}/appointments/doctor/${userEmail}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const sorted = data.sort((a, b) => {
          const dateA = new Date(`${a.appointment_date} ${a.appointment_time}`);
          const dateB = new Date(`${b.appointment_date} ${b.appointment_time}`);
          return dateB - dateA;
        });
        setAppointments(sorted);
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
    fetchAppointments();
  };

  const openAppointmentDetails = async (appointment) => {
    setSelectedAppointment(appointment);
    setModalVisible(true);
    setPatientData(null);
    setReportData(null);

    // Fetch patient details
    setLoadingPatient(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch(`${CONFIG.API_URL}/profile/patient/${appointment.patient_email}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPatientData(data);
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
    } finally {
      setLoadingPatient(false);
    }

    // Fetch patient report
    setLoadingReport(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch(`${CONFIG.API_URL}/reports/patient/${appointment.patient_email}/latest`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.report) {
          setReportData(data.report);
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setViewingFullReport(false);
    setTimeout(() => {
      setSelectedAppointment(null);
      setPatientData(null);
      setReportData(null);
      setExpandedSections({});
    }, 300);
  };

  const generateReport = async () => {
    if (!selectedAppointment) return;

    setGeneratingReport(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch(`${CONFIG.API_URL}/reports/patient/${selectedAppointment.patient_email}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data.report);
        Alert.alert('Success', 'Medical report generated successfully');
      } else {
        Alert.alert('Error', 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const updateAppointmentStatus = async (status, notes = '') => {
    if (!selectedAppointment) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      const body = { status };
      
      // Add completion notes if status is COMPLETED
      if (status === 'COMPLETED' && notes) {
        body.completion_notes = notes;
      }

      const response = await fetch(`${CONFIG.API_URL}/appointments/${selectedAppointment.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        Alert.alert('Success', `Appointment ${status.toLowerCase()}`);
        closeModal();
        fetchAppointments();
      } else {
        Alert.alert('Error', 'Failed to update appointment');
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      Alert.alert('Error', 'Failed to update appointment');
    }
  };

  const handleCompleteAppointment = useCallback(() => {
    console.log('handleCompleteAppointment called');
    console.log('Selected appointment:', selectedAppointment);
    console.log('Current completionNotesModal state:', completionNotesModal);
    
    // Close the appointment details modal first
    setModalVisible(false);
    
    // Then open the completion notes modal after a short delay
    setTimeout(() => {
      modalStateRef.current = true;
      setCompletionNotesModal(true);
      console.log('Setting completionNotesModal to true and modalStateRef to true');
    }, 300); // Wait for the first modal to close
    
    // Force a slight delay to check if state updates
    setTimeout(() => {
      console.log('completionNotesModal state after setTimeout:', completionNotesModal);
      console.log('modalStateRef after setTimeout:', modalStateRef.current);
    }, 500);
  }, [selectedAppointment, completionNotesModal]);

  const submitCompletion = useCallback(() => {
    console.log('submitCompletion called with notes:', completionNotes);
    setCompletionNotesModal(false);
    modalStateRef.current = false;
    updateAppointmentStatus('COMPLETED', completionNotes);
    setCompletionNotes('');
  }, [completionNotes]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status) => {
    const colors = {
      'SCHEDULED': '#3498db',
      'CONFIRMED': '#2ecc71',
      'CANCELLED': '#e74c3c',
      'COMPLETED': '#4caf50',
      'NO_SHOW': '#e67e22'
    };
    return colors[status] || '#95a5a6';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Appointments</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={80} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No appointments found</Text>
          </View>
        ) : (
          appointments.map((appointment) => (
            <TouchableOpacity
              key={appointment.id}
              style={styles.appointmentCard}
              onPress={() => openAppointmentDetails(appointment)}
            >
              <View style={styles.appointmentHeader}>
                <View style={styles.patientInfo}>
                  <Ionicons name="person-circle-outline" size={40} color="#3498db" />
                  <View style={styles.patientDetails}>
                    <Text style={styles.patientName}>
                      {appointment.patient_name || appointment.patient_email}
                    </Text>
                    <Text style={styles.appointmentType}>{appointment.appointment_type}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
                  <Text style={styles.statusText}>{appointment.status}</Text>
                </View>
              </View>

              <View style={styles.appointmentDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color="#666" />
                  <Text style={styles.detailText}>{formatDate(appointment.appointment_date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.detailText}>{formatTime(appointment.appointment_time)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="hourglass-outline" size={18} color="#666" />
                  <Text style={styles.detailText}>{appointment.duration_minutes} min</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible && !viewingFullReport}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment Details</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close-circle" size={30} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedAppointment && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Appointment Info</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedAppointment.appointment_date)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Time:</Text>
                    <Text style={styles.infoValue}>{formatTime(selectedAppointment.appointment_time)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Type:</Text>
                    <Text style={styles.infoValue}>{selectedAppointment.appointment_type}</Text>
                  </View>
                </View>
              )}

              {loadingPatient ? (
                <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
              ) : patientData ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Patient Details</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>{patientData.name || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{patientData.email || 'N/A'}</Text>
                  </View>
                  {patientData.phone && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone:</Text>
                      <Text style={styles.infoValue}>{patientData.phone}</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {/* Medical Report Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Medical Report</Text>
                {loadingReport ? (
                  <ActivityIndicator size="small" color="#3498db" />
                ) : reportData ? (
                  <View style={styles.reportContainer}>
                    <View style={styles.reportSummary}>
                      <Ionicons name="document-text" size={24} color="#2ecc71" />
                      <Text style={styles.reportId}>
                        {reportData.report_data?.report_id || 'Report Available'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.viewReportButton}
                      onPress={() => setViewingFullReport(true)}
                    >
                      <Text style={styles.viewReportText}>View Full Report</Text>
                      <Ionicons name="arrow-forward" size={18} color="#3498db" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.noReportContainer}>
                    <Text style={styles.noReportText}>No medical report found</Text>
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={generateReport}
                      disabled={generatingReport}
                    >
                      {generatingReport ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={20} color="#fff" />
                          <Text style={styles.generateButtonText}>Generate Report</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              {(() => {
                const shouldShow = selectedAppointment && selectedAppointment.status !== 'COMPLETED' && selectedAppointment.status !== 'CANCELLED';
                console.log('Should show action buttons:', shouldShow);
                console.log('Appointment status:', selectedAppointment?.status);
                return shouldShow;
              })() && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    onPress={handleCompleteAppointment}
                  >
                    <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Mark Completed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => updateAppointmentStatus('CANCELLED')}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Cancel Appointment</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Show completion notes if appointment is completed */}
              {selectedAppointment && selectedAppointment.status === 'COMPLETED' && selectedAppointment.completion_notes && (
                <View style={styles.completionNotesContainer}>
                  <Text style={styles.completionNotesTitle}>Completion Notes:</Text>
                  <Text style={styles.completionNotesText}>{selectedAppointment.completion_notes}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full Report Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={viewingFullReport}
        onRequestClose={() => setViewingFullReport(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setViewingFullReport(false)}>
                <Ionicons name="arrow-back" size={24} color="#666" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Medical Report</Text>
              <View style={{width: 24}} />
            </View>

            <ScrollView style={styles.modalBody}>
              {reportData && reportData.report_data && (
                <>
                  {/* Report Header */}
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportIdLarge}>{reportData.report_data.report_id}</Text>
                    <Text style={styles.reportDate}>
                      {formatDate(reportData.generated_at)}
                    </Text>
                  </View>

                  {/* Summary */}
                  {reportData.report_data.summary && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>📋 Summary</Text>
                      <Text style={styles.summaryText}>
                        {reportData.report_data.summary.overview || 'No summary available'}
                      </Text>
                    </View>
                  )}

                  {/* AI Diagnosis */}
                  {reportData.report_data.ai_triage_diagnosis && (
                    <View style={styles.section}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleSection('diagnosis')}
                      >
                        <Text style={styles.sectionTitle}>🩺 AI Medical Assessment</Text>
                        <Ionicons
                          name={expandedSections.diagnosis ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#667eea"
                        />
                      </TouchableOpacity>
                      {expandedSections.diagnosis && (
                        <View>
                          <Text style={styles.diagnosisText}>
                            {reportData.report_data.ai_triage_diagnosis.diagnosis_summary}
                          </Text>
                          {reportData.report_data.ai_triage_diagnosis.recommendations_given?.length > 0 && (
                            <View style={styles.listContainer}>
                              <Text style={styles.listTitle}>Recommendations:</Text>
                              {reportData.report_data.ai_triage_diagnosis.recommendations_given.map((rec, idx) => (
                                <Text key={idx} style={styles.bulletPoint}>• {rec}</Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Consultations */}
                  {reportData.report_data.consultations?.length > 0 && (
                    <View style={styles.section}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleSection('consultations')}
                      >
                        <Text style={styles.sectionTitle}>
                          👨‍⚕️ Consultations ({reportData.report_data.consultations.length})
                        </Text>
                        <Ionicons
                          name={expandedSections.consultations ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#667eea"
                        />
                      </TouchableOpacity>
                      {expandedSections.consultations && (
                        <View>
                          {reportData.report_data.consultations.map((consult, idx) => (
                            <View key={idx} style={styles.consultationItem}>
                              <Text style={styles.consultationDate}>
                                {consult.date} at {consult.time}
                              </Text>
                              <Text style={styles.consultationDoctor}>
                                Dr. {consult.doctor_name || consult.doctor}
                              </Text>
                              {consult.notes && (
                                <Text style={styles.consultationNotes}>{consult.notes}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Scan Reports */}
                  {reportData.report_data.scan_reports?.length > 0 && (
                    <View style={styles.section}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleSection('scans')}
                      >
                        <Text style={styles.sectionTitle}>
                          🔬 Scan Reports ({reportData.report_data.scan_reports.length})
                        </Text>
                        <Ionicons
                          name={expandedSections.scans ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#667eea"
                        />
                      </TouchableOpacity>
                      {expandedSections.scans && (
                        <View>
                          {reportData.report_data.scan_reports.map((scan, idx) => (
                            <View key={idx} style={styles.scanItem}>
                              <Text style={styles.scanType}>{scan.scan_type}</Text>
                              <Text style={styles.scanDate}>Date: {scan.date}</Text>
                              {scan.insights?.length > 0 && (
                                <View style={styles.listContainer}>
                                  <Text style={styles.listTitle}>Insights:</Text>
                                  {scan.insights.map((insight, i) => (
                                    <Text key={i} style={styles.bulletPoint}>• {insight}</Text>
                                  ))}
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Completion Notes Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={completionNotesModal || modalStateRef.current}
        onRequestClose={() => {
          console.log('🚪 Modal onRequestClose called');
          setCompletionNotesModal(false);
          modalStateRef.current = false;
        }}
        hardwareAccelerated={true}
      >
        {console.log('🎨 Modal RENDERING - visible:', (completionNotesModal || modalStateRef.current))}
        <View style={styles.notesModalOverlay}>
          <View style={styles.notesModalContent}>
            <Text style={styles.notesModalTitle}>Complete Appointment</Text>
            <Text style={styles.notesModalSubtitle}>Add completion notes (optional)</Text>
            
            <TextInput
              style={styles.notesInput}
              placeholder="Enter notes about the consultation, diagnosis, or follow-up instructions..."
              value={completionNotes}
              onChangeText={setCompletionNotes}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.notesModalButtons}>
              <TouchableOpacity
                style={[styles.notesModalButton, styles.notesCancelButton]}
                onPress={() => {
                  setCompletionNotesModal(false);
                  modalStateRef.current = false;
                  setCompletionNotes('');
                }}
              >
                <Text style={styles.notesButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notesModalButton, styles.notesSubmitButton]}
                onPress={submitCompletion}
              >
                <Text style={[styles.notesButtonText, styles.submitButtonText]}>Complete</Text>
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
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patientDetails: {
    marginLeft: 10,
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  appointmentType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  appointmentDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
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
    maxHeight: '90%',
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  loader: {
    marginVertical: 20,
  },
  reportContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reportSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  viewReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f4fd',
    padding: 12,
    borderRadius: 8,
  },
  viewReportText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
  },
  noReportContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noReportText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtons: {
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  completeButton: {
    backgroundColor: '#2ecc71',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  reportHeader: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  reportIdLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagnosisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginTop: 10,
  },
  listContainer: {
    marginTop: 15,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    paddingLeft: 10,
  },
  consultationItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  consultationDate: {
    fontSize: 13,
    color: '#666',
  },
  consultationDoctor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  consultationNotes: {
    fontSize: 13,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  scanItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  scanType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scanDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  completionNotesContainer: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
    padding: 15,
    marginTop: 15,
    borderRadius: 8,
  },
  completionNotesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  completionNotesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  notesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  notesModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    margin: 20,
    width: '90%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  notesModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  notesModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 20,
  },
  notesModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  notesModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  notesCancelButton: {
    backgroundColor: '#e0e0e0',
  },
  notesSubmitButton: {
    backgroundColor: '#4caf50',
  },
  notesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  submitButtonText: {
    color: '#fff',
  },
});

export default DoctorAppointmentsScreen;
