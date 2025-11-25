import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Share
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import CONFIG from '../config';

const { width } = Dimensions.get('window');

export default function ScanReportScreen({ route, navigation }) {
  const { reportData } = route.params;
  const [patientInfo, setPatientInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef();

  useEffect(() => {
    fetchPatientInfo();
  }, []);

  const fetchPatientInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch(`${CONFIG.API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const profile = await response.json();
        setPatientInfo(profile);
      }
    } catch (error) {
      console.error('Error fetching patient info:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScanTypeDisplay = () => {
    if (reportData.scan_type === 'mri' && reportData.target_area === 'brain') {
      return 'Brain MRI Segmentation';
    }
    return `${reportData.scan_type?.toUpperCase() || 'Scan'} - ${reportData.target_area?.charAt(0).toUpperCase() + reportData.target_area?.slice(1) || 'Analysis'}`;
  };

  const generateImagesSection = () => {
    let imagesHtml = '';
    
    // Add original images if available (for brain MRI dual images)
    if (reportData.original_images) {
      let originalImagesHtml = '';
      if (reportData.original_images.flair) {
        originalImagesHtml += `
          <div style="text-align: center; margin: 10px 0;">
            <h4 style="color: #3b82f6; margin-bottom: 10px;">FLAIR Sequence</h4>
            <img src="data:image/png;base64,${reportData.original_images.flair}" style="max-width: 45%; height: auto; border: 2px solid #e5e7eb; border-radius: 8px; margin: 5px;" />
          </div>`;
      }
      if (reportData.original_images.t1ce) {
        originalImagesHtml += `
          <div style="text-align: center; margin: 10px 0;">
            <h4 style="color: #3b82f6; margin-bottom: 10px;">T1CE Sequence</h4>
            <img src="data:image/png;base64,${reportData.original_images.t1ce}" style="max-width: 45%; height: auto; border: 2px solid #e5e7eb; border-radius: 8px; margin: 5px;" />
          </div>`;
      }
      
      if (originalImagesHtml) {
        imagesHtml += `
          <div class="section">
            <h3>Original MRI Scans</h3>
            <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
              ${originalImagesHtml}
            </div>
          </div>
        `;
      }
    }
    
    // Add single original image if available (for CT/Ultrasound)
    if (reportData.original_image) {
      imagesHtml += `
        <div class="section">
          <h3>Original ${reportData.scan_type?.toUpperCase() || 'Scan'}</h3>
          <div style="text-align: center; margin: 20px 0;">
            <img src="data:image/png;base64,${reportData.original_image}" style="max-width: 60%; height: auto; border: 2px solid #e5e7eb; border-radius: 8px;" />
            <p style="font-style: italic; color: #6b7280; margin-top: 10px; font-size: 14px;">Original ${reportData.scan_type?.toUpperCase() || 'scan'} image</p>
          </div>
        </div>
      `;
    }
    
    // Add segmentation overlay with dynamic legend
    if (reportData.segmentation_mask || reportData.segmentation_result) {
      // Determine analysis title and legend based on target area
      let analysisTitle = 'Segmentation Analysis';
      let legendItems = '';
      let overlayDescription = 'AI-generated segmentation overlay';
      
      if (reportData.target_area === 'brain') {
        analysisTitle = 'Tumor Segmentation Analysis';
        legendItems = `
          <span style="margin: 5px;">🔴 Enhancing Tumor</span>
          <span style="margin: 5px;">🟢 Edema</span>
          <span style="margin: 5px;">🔵 Necrotic Core</span>
          <span style="margin: 5px;">⚫ Background</span>
        `;
        overlayDescription = 'AI-generated overlay showing different tumor regions mapped onto the brain MRI';
      } else if (reportData.target_area === 'kidney') {
        analysisTitle = 'Kidney Segmentation Analysis';
        legendItems = `
          <span style="margin: 5px;">🔴 Kidney Tissue (Red)</span>
          <span style="margin: 5px;">⚫ Background (Black)</span>
        `;
        overlayDescription = 'AI-generated overlay showing kidney boundaries on the CT scan';
      } else if (reportData.target_area === 'breast') {
        analysisTitle = 'Lesion Detection Analysis';
        legendItems = `
          <span style="margin: 5px;">🔴 Suspicious Lesions (Red)</span>
          <span style="margin: 5px;">⚫ Normal Tissue (Black)</span>
        `;
        overlayDescription = 'AI-generated overlay highlighting suspicious lesions in the ultrasound image';
      } else if (reportData.target_area === 'pancreas') {
        analysisTitle = 'Pancreas Segmentation Analysis';
        legendItems = `
          <span style="margin: 5px;">🔴 Pancreas Tissue (Red)</span>
          <span style="margin: 5px;">⚫ Background (Black)</span>
        `;
        overlayDescription = 'AI-generated overlay showing pancreas boundaries on the CT scan';
      } else if (reportData.target_area === 'liver') {
        analysisTitle = 'Liver Segmentation Analysis';
        legendItems = `
          <span style="margin: 5px;">🟢 Liver Tissue (Green)</span>
          <span style="margin: 5px;">🔴 Tumor/Lesion (Red)</span>
          <span style="margin: 5px;">⚫ Background (Black)</span>
        `;
        overlayDescription = 'AI-generated overlay showing liver and tumor regions on the CT scan';
      } else {
        legendItems = `
          <span style="margin: 5px;">🔴 Target Region (Red)</span>
          <span style="margin: 5px;">⚫ Background (Black)</span>
        `;
      }
      
      imagesHtml += `
        <div class="section">
          <h3>${analysisTitle}</h3>
          <div style="text-align: center; margin: 20px 0;">
            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e0e0e0;">
              <h4 style="color: #2c3e50; margin-bottom: 10px;">Color Legend:</h4>
              <div style="display: flex; justify-content: space-around; flex-wrap: wrap; font-size: 14px;">
                ${legendItems}
              </div>
            </div>
            <img src="data:image/png;base64,${reportData.segmentation_mask || reportData.segmentation_result}" style="max-width: 70%; height: auto; border: 3px solid #3b82f6; border-radius: 8px;" />
            <p style="font-style: italic; color: #6b7280; margin-top: 10px; font-size: 13px;">${overlayDescription}</p>
          </div>
        </div>
      `;
    }
    
    return imagesHtml;
  };

  const generatePDFContent = () => {
    const currentDate = formatDate(new Date());
    const patientName = patientInfo?.name || 'Patient';
    const patientEmail = patientInfo?.email || 'N/A';
    
    let statisticsHtml = '';
    if (reportData.statistics) {
      statisticsHtml = `
        <div class="section">
          <h3>Statistical Analysis</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Total Pixels:</span>
              <span class="stat-value">${reportData.statistics.total_pixels?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">${reportData.target_area === 'kidney' ? 'Kidney Pixels:' : reportData.target_area === 'breast' ? 'Lesion Pixels:' : reportData.target_area === 'pancreas' ? 'Pancreas Pixels:' : reportData.target_area === 'liver' ? 'Liver Pixels:' : 'Segmented Pixels:'}</span>
              <span class="stat-value">${(reportData.statistics.segmented_pixels || reportData.statistics.kidney_pixels || reportData.statistics.lesion_pixels || reportData.statistics.pancreas_pixels || reportData.statistics.liver_pixels)?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">${reportData.target_area === 'kidney' ? 'Kidney Percentage:' : reportData.target_area === 'breast' ? 'Lesion Percentage:' : reportData.target_area === 'pancreas' ? 'Pancreas Percentage:' : reportData.target_area === 'liver' ? 'Liver Percentage:' : 'Segmentation Percentage:'}</span>
              <span class="stat-value">${(reportData.statistics.segmentation_percentage || reportData.statistics.kidney_percentage || reportData.statistics.lesion_percentage || reportData.statistics.pancreas_percentage || reportData.statistics.liver_percentage)?.toFixed(2) || 'N/A'}%</span>
            </div>
            ${(reportData.target_area === 'kidney' || reportData.target_area === 'pancreas') && reportData.statistics.estimated_volume_ml ? `
            <div class="stat-item">
              <span class="stat-label">Estimated Volume:</span>
              <span class="stat-value">${reportData.statistics.estimated_volume_ml?.toFixed(1) || 'N/A'} ml</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    let classStatsHtml = '';
    if (reportData.class_statistics) {
      const classItems = Object.entries(reportData.class_statistics).map(([className, stats]) => `
        <div class="class-item">
          <span class="class-name">${className.replace('_', ' ').toUpperCase()}</span>
          <span class="class-stats">${stats.pixels?.toLocaleString() || '0'} pixels (${stats.percentage?.toFixed(2) || '0'}%)</span>
        </div>
      `).join('');
      
      classStatsHtml = `
        <div class="section">
          <h3>Classification Analysis</h3>
          <div class="class-stats">
            ${classItems}
          </div>
        </div>
      `;
    }

    let insightsHtml = '';
    if (reportData.insights?.length > 0) {
      const insightItems = reportData.insights.map(insight => `<li>${insight}</li>`).join('');
      insightsHtml = `
        <div class="section">
          <h3>Clinical Insights</h3>
          <ul class="insights-list">
            ${insightItems}
          </ul>
        </div>
      `;
    }

    let recommendationsHtml = '';
    if (reportData.recommendations?.length > 0) {
      const recItems = reportData.recommendations.map(rec => `<li>${rec}</li>`).join('');
      recommendationsHtml = `
        <div class="section">
          <h3>Recommendations</h3>
          <ul class="recommendations-list">
            ${recItems}
          </ul>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Medical Scan Report</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
            color: #333;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 10px;
          }
          .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 5px;
          }
          .report-subtitle {
            font-size: 16px;
            color: #6b7280;
          }
          .patient-info {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #3b82f6;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: 600;
            color: #374151;
            flex: 1;
          }
          .info-value {
            flex: 2;
            color: #1f2937;
          }
          .section {
            margin-bottom: 25px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background-color: #ffffff;
          }
          .section h3 {
            color: #1f2937;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }
          .stat-item {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #10b981;
          }
          .stat-label {
            display: block;
            font-weight: 600;
            color: #374151;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .stat-value {
            display: block;
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
          }
          .class-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .class-item:last-child {
            border-bottom: none;
          }
          .class-name {
            font-weight: 600;
            color: #374151;
          }
          .class-stats {
            color: #1f2937;
          }
          .insights-list, .recommendations-list {
            margin: 0;
            padding-left: 20px;
          }
          .insights-list li, .recommendations-list li {
            margin-bottom: 8px;
            color: #374151;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
          }
          .disclaimer {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            font-size: 12px;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏥 HealthMate</div>
          <div class="report-title">Medical Scan Analysis Report</div>
          <div class="report-subtitle">${getScanTypeDisplay()}</div>
        </div>

        <div class="patient-info">
          <div class="info-row">
            <span class="info-label">Patient Name:</span>
            <span class="info-value">${patientName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Patient Email:</span>
            <span class="info-value">${patientEmail}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Report Date:</span>
            <span class="info-value">${currentDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Scan Type:</span>
            <span class="info-value">${getScanTypeDisplay()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Report ID:</span>
            <span class="info-value">${reportData.report_id || 'Generated'}</span>
          </div>
        </div>

        ${generateImagesSection()}
        ${statisticsHtml}
        ${classStatsHtml}
        ${insightsHtml}
        ${recommendationsHtml}

        <div class="disclaimer">
          <strong>Medical Disclaimer:</strong> This report is generated by AI-assisted analysis and should not be used as a substitute for professional medical diagnosis. Always consult with qualified healthcare professionals for medical advice and treatment decisions.
        </div>

        <div class="footer">
          <p>Generated by HealthMate AI Analysis System</p>
          <p>Report generated on ${currentDate}</p>
        </div>
      </body>
      </html>
    `;
  };

  const downloadPDF = async () => {
    try {
      setGenerating(true);
      
      const htmlContent = generatePDFContent();
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const patientName = patientInfo?.name?.replace(/\s+/g, '_') || 'Patient';
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `HealthMate_Report_${patientName}_${timestamp}.pdf`;
      
      const newUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Medical Report'
        });
      } else {
        Alert.alert('Success', `Report saved to: ${newUri}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report');
    } finally {
      setGenerating(false);
    }
  };



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading patient information...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#3b82f6', '#1e40af']} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.hospitalName}>🏥 HealthMate</Text>
          <Text style={styles.reportTitle}>Medical Scan Report</Text>
          <Text style={styles.reportSubtitle}>{getScanTypeDisplay()}</Text>
        </View>
      </LinearGradient>

      <View style={styles.content} ref={reportRef}>
        {/* Patient Information */}
        <View style={styles.patientInfoCard}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{patientInfo?.name || 'Patient'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{patientInfo?.email || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Report Date:</Text>
            <Text style={styles.infoValue}>{formatDate(new Date())}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Scan Type:</Text>
            <Text style={styles.infoValue}>{getScanTypeDisplay()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Report ID:</Text>
            <Text style={styles.infoValue}>{reportData.report_id || 'Generated'}</Text>
          </View>
        </View>

        {/* Segmentation Analysis */}
        {(reportData.segmentation_mask || reportData.segmentation_result) && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>
              {reportData.target_area === 'brain' ? 'Brain Tumor Segmentation Analysis' : 
               reportData.target_area === 'kidney' ? 'Kidney Segmentation Analysis' :
               reportData.target_area === 'breast' ? 'Breast Ultrasound Analysis' :
               reportData.target_area === 'pancreas' ? 'Pancreas CT Analysis' :
               'Medical Segmentation Analysis'}
            </Text>
            
            {/* Color Legend */}
            <View style={styles.legendContainer}>
              <Text style={styles.legendTitle}>
                {reportData.target_area === 'brain' ? 'Tumor Region Classification:' : 
                 reportData.target_area === 'kidney' ? 'Kidney Segmentation Classification:' :
                 reportData.target_area === 'breast' ? 'Lesion Detection Classification:' :
                 reportData.target_area === 'pancreas' ? 'Pancreas Segmentation Classification:' :
                 'Segmentation Classification:'}
              </Text>
              <View style={styles.legendGrid}>
                {reportData.target_area === 'brain' ? (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#FF0000' }]} />
                      <Text style={styles.legendText}>Enhancing Tumor (Red)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#00FF00' }]} />
                      <Text style={styles.legendText}>Edema (Green)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#0000FF' }]} />
                      <Text style={styles.legendText}>Necrotic Core (Blue)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#000000' }]} />
                      <Text style={styles.legendText}>Background (Black)</Text>
                    </View>
                  </>
                ) : reportData.target_area === 'kidney' ? (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#FF0000' }]} />
                      <Text style={styles.legendText}>Kidney Tissue (Red)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#000000' }]} />
                      <Text style={styles.legendText}>Background (Black)</Text>
                    </View>
                  </>
                ) : reportData.target_area === 'breast' ? (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#FF0000' }]} />
                      <Text style={styles.legendText}>Suspicious Lesions (Red)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#000000' }]} />
                      <Text style={styles.legendText}>Normal Tissue (Black)</Text>
                    </View>
                  </>
                ) : reportData.target_area === 'pancreas' ? (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#FF0000' }]} />
                      <Text style={styles.legendText}>Pancreas Tissue (Red)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#000000' }]} />
                      <Text style={styles.legendText}>Background (Black)</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#FF0000' }]} />
                      <Text style={styles.legendText}>Target Region (Red)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.colorBox, { backgroundColor: '#000000' }]} />
                      <Text style={styles.legendText}>Background (Black)</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Image Comparison */}
            <View style={styles.imageComparisonContainer}>
              {/* Original MRI Images */}
              {reportData.original_images && (
                <View style={styles.imageSection}>
                  <Text style={styles.imageLabel}>Original MRI Scans</Text>
                  <View style={styles.originalImagesRow}>
                    {reportData.original_images.flair && (
                      <View style={styles.originalImageContainer}>
                        <Text style={styles.modalityLabel}>FLAIR</Text>
                        <Image 
                          source={{ uri: `data:image/png;base64,${reportData.original_images.flair}` }} 
                          style={styles.originalImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                    {reportData.original_images.t1ce && (
                      <View style={styles.originalImageContainer}>
                        <Text style={styles.modalityLabel}>T1CE</Text>
                        <Image 
                          source={{ uri: `data:image/png;base64,${reportData.original_images.t1ce}` }} 
                          style={styles.originalImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Single Original Image (for CT/Ultrasound) */}
              {reportData.original_image && (
                <View style={styles.imageSection}>
                  <Text style={styles.imageLabel}>Original {reportData.scan_type?.toUpperCase() || 'Scan'}</Text>
                  <View style={styles.singleImageContainer}>
                    <Image 
                      source={{ uri: `data:image/png;base64,${reportData.original_image}` }} 
                      style={styles.singleOriginalImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.singleImageDescription}>
                      Original {reportData.scan_type?.toUpperCase() || 'scan'} image used for analysis
                    </Text>
                  </View>
                </View>
              )}

              {/* Segmentation Overlay */}
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>
                  {reportData.target_area === 'brain' ? 'Tumor Segmentation Overlay' : 
                   reportData.target_area === 'kidney' ? 'Kidney Segmentation Overlay' :
                   reportData.target_area === 'breast' ? 'Lesion Detection Overlay' :
                   reportData.target_area === 'pancreas' ? 'Pancreas Segmentation Overlay' :
                   'Segmentation Overlay'}
                </Text>
                <Image 
                  source={{ 
                    uri: `data:image/png;base64,${reportData.segmentation_mask || reportData.segmentation_result}` 
                  }} 
                  style={styles.overlayImage}
                  resizeMode="contain"
                />
                <Text style={styles.overlayDescription}>
                  {reportData.target_area === 'brain' ? 
                    'AI-generated overlay showing different tumor regions mapped onto the brain MRI. Colors indicate specific pathological areas as defined in the legend above.' :
                   reportData.target_area === 'kidney' ?
                    'AI-generated overlay showing segmented kidney regions in the CT scan. Red areas indicate identified kidney tissue.' :
                   reportData.target_area === 'breast' ?
                    'AI-generated overlay showing segmented lesion regions in the ultrasound. Red areas indicate suspicious regions requiring evaluation.' :
                   reportData.target_area === 'pancreas' ?
                    'AI-generated overlay showing segmented pancreatic tissue in the CT scan. Red areas indicate identified pancreas regions.' :
                   'AI-generated segmentation overlay showing identified regions of interest.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Statistics */}
        {reportData.statistics && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Statistical Analysis</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Pixels</Text>
                <Text style={styles.statValue}>{reportData.statistics.total_pixels?.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {reportData.target_area === 'kidney' ? 'Kidney Pixels' : 
                   reportData.target_area === 'breast' ? 'Lesion Pixels' : 
                   reportData.target_area === 'pancreas' ? 'Pancreas Pixels' : 
                   reportData.target_area === 'liver' ? 'Liver Pixels' : 
                   'Segmented Pixels'}
                </Text>
                <Text style={styles.statValue}>
                  {(reportData.statistics.segmented_pixels || reportData.statistics.kidney_pixels || reportData.statistics.lesion_pixels || reportData.statistics.pancreas_pixels || reportData.statistics.liver_pixels)?.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {reportData.target_area === 'kidney' ? 'Kidney Percentage' : 
                   reportData.target_area === 'breast' ? 'Lesion Percentage' : 
                   reportData.target_area === 'pancreas' ? 'Pancreas Percentage' : 
                   reportData.target_area === 'liver' ? 'Liver Percentage' : 
                   'Percentage'}
                </Text>
                <Text style={styles.statValue}>
                  {(reportData.statistics.segmentation_percentage || reportData.statistics.kidney_percentage || reportData.statistics.lesion_percentage || reportData.statistics.pancreas_percentage || reportData.statistics.liver_percentage)?.toFixed(2)}%
                </Text>
              </View>
              {/* Show estimated volume for kidney and pancreas scans */}
              {(reportData.target_area === 'kidney' || reportData.target_area === 'pancreas') && reportData.statistics.estimated_volume_ml && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Estimated Volume</Text>
                  <Text style={styles.statValue}>{reportData.statistics.estimated_volume_ml?.toFixed(1)} ml</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Class Statistics */}
        {reportData.class_statistics && (
          <View style={styles.classCard}>
            <Text style={styles.sectionTitle}>Classification Analysis</Text>
            {Object.entries(reportData.class_statistics).map(([className, stats]) => (
              <View key={className} style={styles.classItem}>
                <Text style={styles.className}>{className.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.classStats}>{stats.pixels?.toLocaleString()} pixels ({stats.percentage?.toFixed(2)}%)</Text>
              </View>
            ))}
          </View>
        )}

        {/* Insights */}
        {reportData.insights?.length > 0 && (
          <View style={styles.insightsCard}>
            <Text style={styles.sectionTitle}>Clinical Insights</Text>
            {reportData.insights.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {reportData.recommendations?.length > 0 && (
          <View style={styles.recommendationsCard}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {reportData.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Medical Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>⚠️ Medical Disclaimer</Text>
          <Text style={styles.disclaimerText}>
            This report is generated by AI-assisted analysis and should not be used as a substitute for professional medical diagnosis. 
            Always consult with qualified healthcare professionals for medical advice and treatment decisions.
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.downloadButton, generating && styles.buttonDisabled]}
          onPress={downloadPDF}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>📄 Download & Share PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  backText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  hospitalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#e0f2fe',
  },
  content: {
    padding: 20,
  },
  patientInfoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    flex: 2,
    textAlign: 'right',
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  legendContainer: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8
  },
  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333'
  },
  legendText: {
    fontSize: 14,
    color: '#34495e',
    fontWeight: '500'
  },
  imageComparisonContainer: {
    marginTop: 15
  },
  imageSection: {
    marginBottom: 20
  },
  imageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center'
  },
  originalImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10
  },
  originalImageContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5
  },
  modalityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 5,
    textAlign: 'center'
  },
  originalImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  overlayImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#3498db'
  },
  overlayDescription: {
    fontSize: 13,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 18
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  classCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  classStats: {
    fontSize: 14,
    color: '#6b7280',
  },
  insightsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#059669',
    marginRight: 10,
    fontWeight: 'bold',
  },
  insightText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  recommendationsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  recommendationText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  disclaimerCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 10,
  },
  disclaimerText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  actionButtons: {
    padding: 20,
  },
  downloadButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  singleImageContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  singleOriginalImage: {
    width: '80%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  singleImageDescription: {
    fontSize: 13,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});