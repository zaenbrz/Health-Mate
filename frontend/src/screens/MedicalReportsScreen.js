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
  Share,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import CONFIG from '../config';

const MedicalReportsScreen = ({ navigation }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/reports/my-reports`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data);
      } else {
        console.error('Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateNewReport = async () => {
    setGenerating(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${CONFIG.API_URL}/reports/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          'Success',
          'Medical report generated successfully!',
          [{ text: 'OK', onPress: () => fetchReports() }]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (reportId) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      Alert.alert('Downloading', 'Please wait...');

      const response = await fetch(`${CONFIG.API_URL}/reports/download/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result.split(',')[1];
          
          // Save to file system
          const fileUri = `${FileSystem.documentDirectory}medical_report_${reportId}.pdf`;
          await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: FileSystem.EncodingType.Base64
          });

          // Share the file
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Save or Share Medical Report'
            });
          } else {
            Alert.alert('Success', `Report saved to: ${fileUri}`);
          }
        };
        reader.readAsDataURL(blob);
      } else {
        Alert.alert('Error', 'Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      Alert.alert('Error', 'Failed to download report');
    }
  };

  const shareReport = async (reportId) => {
    Alert.prompt(
      'Share Report',
      'Enter email address to share with:',
      async (email) => {
        if (!email) return;

        try {
          const token = await AsyncStorage.getItem('access_token');
          const response = await fetch(`${CONFIG.API_URL}/reports/share/${reportId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
          });

          if (response.ok) {
            const data = await response.json();
            Alert.alert('Success', data.message);
          } else {
            Alert.alert('Error', 'Failed to share report');
          }
        } catch (error) {
          console.error('Error sharing report:', error);
          Alert.alert('Error', 'Failed to share report');
        }
      },
      'plain-text'
    );
  };

  const deleteReport = async (reportId) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              const response = await fetch(`${CONFIG.API_URL}/reports/${reportId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (response.ok) {
                Alert.alert('Success', 'Report deleted successfully');
                fetchReports();
              } else {
                Alert.alert('Error', 'Failed to delete report');
              }
            } catch (error) {
              console.error('Error deleting report:', error);
              Alert.alert('Error', 'Failed to delete report');
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleReportExpansion = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

  const renderReportCard = (report) => {
    const isExpanded = expandedReport === report.report_id;
    const reportData = report.report_data;

    return (
      <View key={report.report_id} style={styles.reportCard}>
        <TouchableOpacity 
          onPress={() => toggleReportExpansion(report.report_id)}
          style={styles.reportHeader}
        >
          <View style={styles.reportHeaderLeft}>
            <Ionicons name="document-text" size={24} color="#667eea" />
            <View style={styles.reportHeaderText}>
              <Text style={styles.reportId}>{report.report_id}</Text>
              <Text style={styles.reportDate}>{formatDate(report.generated_at)}</Text>
            </View>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={24} 
            color="#666" 
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.reportDetails}>
            {/* AI Diagnosis Section */}
            {reportData.ai_triage_diagnosis && (
              <View style={styles.diagnosisSection}>
                <Text style={styles.sectionTitle}>🩺 AI Medical Assessment</Text>
                <Text style={styles.diagnosisText}>
                  {reportData.ai_triage_diagnosis.diagnosis_summary}
                </Text>
                
                {reportData.ai_triage_diagnosis.symptoms_discussed?.length > 0 && (
                  <View style={styles.subsection}>
                    <Text style={styles.subsectionTitle}>Symptoms:</Text>
                    {reportData.ai_triage_diagnosis.symptoms_discussed.map((symptom, idx) => (
                      <Text key={idx} style={styles.bulletPoint}>• {symptom}</Text>
                    ))}
                  </View>
                )}
                
                {reportData.ai_triage_diagnosis.recommendations_given?.length > 0 && (
                  <View style={styles.subsection}>
                    <Text style={styles.subsectionTitle}>Recommendations:</Text>
                    {reportData.ai_triage_diagnosis.recommendations_given.map((rec, idx) => (
                      <Text key={idx} style={styles.bulletPoint}>• {rec}</Text>
                    ))}
                  </View>
                )}
                
                {reportData.ai_triage_diagnosis.specialist_referrals?.length > 0 && (
                  <View style={styles.subsection}>
                    <Text style={styles.subsectionTitle}>Specialist Referrals:</Text>
                    {reportData.ai_triage_diagnosis.specialist_referrals.map((spec, idx) => (
                      <Text key={idx} style={styles.bulletPoint}>• {spec}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
            
            {/* Summary Section */}
            <View style={styles.reportSummary}>
              <Text style={styles.summaryTitle}>📊 Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Consultations:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.total_consultations}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Scans:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.total_scans}</Text>
              </View>
              {reportData.summary.last_consultation && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Last Consultation:</Text>
                  <Text style={styles.summaryValue}>{reportData.summary.last_consultation}</Text>
                </View>
              )}
            </View>
            
            {/* Recent Consultations */}
            {reportData.consultations?.length > 0 && (
              <View style={styles.consultationsSection}>
                <Text style={styles.sectionTitle}>👨‍⚕️ Recent Consultations ({reportData.consultations.length})</Text>
                {reportData.consultations.slice(0, 3).map((consult, idx) => (
                  <View key={idx} style={styles.consultationItem}>
                    <Text style={styles.consultationDate}>{consult.date} at {consult.time}</Text>
                    <Text style={styles.consultationDoctor}>Dr. {consult.doctor_name}</Text>
                    <Text style={styles.consultationNotes}>{consult.notes || 'No notes'}</Text>
                  </View>
                ))}
                {reportData.consultations.length > 3 && (
                  <Text style={styles.moreText}>+{reportData.consultations.length - 3} more (view in download)</Text>
                )}
              </View>
            )}
            
            {/* Recent Scans */}
            {reportData.scan_reports?.length > 0 && (
              <View style={styles.scansSection}>
                <Text style={styles.sectionTitle}>🔬 Recent Scans ({reportData.scan_reports.length})</Text>
                {reportData.scan_reports.slice(0, 2).map((scan, idx) => (
                  <View key={idx} style={styles.scanItem}>
                    <Text style={styles.scanType}>{scan.scan_type}</Text>
                    <Text style={styles.scanDate}>{scan.date}</Text>
                    {scan.insights?.length > 0 && (
                      <Text style={styles.scanInsight}>• {scan.insights[0]}</Text>
                    )}
                  </View>
                ))}
                {reportData.scan_reports.length > 2 && (
                  <Text style={styles.moreText}>+{reportData.scan_reports.length - 2} more (view in download)</Text>
                )}
              </View>
            )}

            <View style={styles.reportActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.downloadButton]}
                onPress={() => downloadReport(report.report_id)}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Download</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.shareButton]}
                onPress={() => shareReport(report.report_id)}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => deleteReport(report.report_id)}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#6B70A8', '#9896C4']} style={styles.container}>
      <LinearGradient colors={["#6B70A8", "#9896C4"]} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="document-text" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>Medical Reports</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Ionicons name="information-circle" size={24} color="#5BA3E0" />
          </View>
          <Text style={styles.infoText}>
            Generate comprehensive medical reports including your health history, consultations, and scan results.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.generateButton}
          onPress={generateNewReport}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.generateButtonText}>Generate New Report</Text>
            </>
          )}
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7E5CAD" />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {reports.length > 0 ? (
              reports.map(renderReportCard)
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={80} color="#ccc" />
                <Text style={styles.emptyText}>No reports yet</Text>
                <Text style={styles.emptySubtext}>Generate your first medical report</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 24,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#5BA3E0',
  },
  infoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(91, 163, 224, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5BA3E0',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 24,
    shadowColor: '#5BA3E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
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
    color: '#666',
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: '#ffffff',
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportHeaderText: {
    marginLeft: 14,
    flex: 1,
  },
  reportId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 13,
    color: '#64748b',
  },
  reportDetails: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 15,
  },
  diagnosisSection: {
    backgroundColor: 'rgba(126, 92, 173, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#7E5CAD',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 12,
  },
  diagnosisText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 12,
  },
  subsection: {
    marginTop: 10,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7E5CAD',
    marginBottom: 6,
  },
  bulletPoint: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    marginBottom: 3,
  },
  consultationsSection: {
    backgroundColor: 'rgba(91, 163, 224, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#5BA3E0',
  },
  consultationItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#5BA3E0',
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  consultationDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  consultationDoctor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  consultationNotes: {
    fontSize: 13,
    color: '#666',
  },
  scansSection: {
    backgroundColor: 'rgba(114, 186, 169, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#72BAA9',
  },
  scanItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#72BAA9',
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  scanType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  scanDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  scanInsight: {
    fontSize: 13,
    color: '#666',
  },
  moreText: {
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
    marginTop: 5,
    textAlign: 'center',
  },
  reportSummary: {
    marginBottom: 15,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reportActions: {
    flexDirection: 'row',
    marginHorizontal: -5,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  downloadButton: {
    backgroundColor: '#72BAA9',
  },
  shareButton: {
    backgroundColor: '#5BA3E0',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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

export default MedicalReportsScreen;
