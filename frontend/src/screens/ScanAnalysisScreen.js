import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

const { width } = Dimensions.get('window');

export default function ScanAnalysisScreen({ navigation }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [targetOrgan, setTargetOrgan] = useState(''); // Selected organ first
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [flairImage, setFlairImage] = useState(null);
  const [t1ceImage, setT1ceImage] = useState(null);

  // Define organ configurations with their scan types and requirements
  const organConfigs = {
    brain: {
      name: '🧠 Brain',
      scanType: 'MRI (Magnetic Resonance Imaging)',
      description: 'Advanced brain tumor detection and segmentation using dual-modality MRI analysis',
      requirements: 'Requires 2 images: FLAIR and T1CE sequences',
      isDualImage: true,
      color: '#8B5CF6',
      details: 'Our AI analyzes brain MRI scans to detect and segment different tumor regions including enhancing tumor, edema, and necrotic core areas.'
    },
    liver: {
      name: '🫀 Liver',
      scanType: 'CT Scan (Computed Tomography)',
      description: 'Liver lesion detection and analysis using CT imaging',
      requirements: 'Requires 1 CT scan image',
      isDualImage: false,
      color: '#10B981',
      details: 'AI-powered analysis of liver CT scans to identify abnormalities, lesions, and assess liver health.'
    },
    kidney: {
      name: '🫘 Kidney',
      scanType: 'CT Scan (Computed Tomography)',
      description: 'Kidney stone and abnormality detection using CT imaging',
      requirements: 'Requires 1 CT scan image',
      isDualImage: false,
      color: '#F59E0B',
      details: 'Comprehensive kidney analysis using CT scans to detect stones, cysts, and other renal abnormalities.'
    },
    pancreas: {
      name: '🥞 Pancreas',
      scanType: 'CT Scan (Computed Tomography)',
      description: 'Pancreatic abnormality and lesion detection using CT imaging',
      requirements: 'Requires 1 CT scan image',
      isDualImage: false,
      color: '#EF4444',
      details: 'Advanced pancreatic analysis using CT imaging to detect lesions, inflammation, and structural abnormalities.'
    },
    breast: {
      name: '🤱 Breast',
      scanType: 'Ultrasound Imaging',
      description: 'Breast tissue analysis and abnormality detection using ultrasound',
      requirements: 'Requires 1 ultrasound image',
      isDualImage: false,
      color: '#EC4899',
      details: 'AI-assisted breast ultrasound analysis to identify masses, cysts, and tissue abnormalities with high accuracy.'
    }
  };

  // Get current organ configuration
  const getCurrentConfig = () => {
    return organConfigs[targetOrgan] || null;
  };

  // Check if dual image is required
  const isDualImageRequired = () => {
    const config = getCurrentConfig();
    return config ? config.isDualImage : false;
  };

  const pickImage = async (imageType = 'single') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        if (imageType === 'single') {
          setSelectedImage({
            uri: asset.uri,
            base64: asset.base64,
          });
        } else if (imageType === 'flair') {
          setFlairImage({
            uri: asset.uri,
            base64: asset.base64,
          });
        } else if (imageType === 't1ce') {
          setT1ceImage({
            uri: asset.uri,
            base64: asset.base64,
          });
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const analyzeScan = async () => {
    try {
      setLoading(true);
      setAnalysisResult(null);
      
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      let endpoint;
      let body;

      if (isDualImageRequired()) {
        // Brain MRI requires dual modality
        if (!flairImage || !t1ceImage) {
          Alert.alert('Error', 'Please select both FLAIR and T1CE images for brain MRI segmentation');
          return;
        }
        endpoint = `${CONFIG.API_URL}/scan/segment/two-modalities`;
        body = {
          flair_image: flairImage.base64,
          t1ce_image: t1ceImage.base64,
        };
      } else {
        // Single image analysis for other combinations
        if (!selectedImage) {
          Alert.alert('Error', 'Please select an image');
          return;
        }
        
        if (targetOrgan === 'breast') {
          endpoint = `${CONFIG.API_URL}/scan/segment/breast`;
        } else if (targetOrgan === 'kidney') {
          endpoint = `${CONFIG.API_URL}/scan/segment/kidney`;
        } else if (targetOrgan === 'pancreas') {
          endpoint = `${CONFIG.API_URL}/scan/segment/pancreas`;
        } else if (targetOrgan === 'liver') {
          endpoint = `${CONFIG.API_URL}/scan/segment/liver`;
        } else {
          endpoint = `${CONFIG.API_URL}/scan/segment`;
        }
        
        if (targetOrgan === 'breast' || targetOrgan === 'kidney' || targetOrgan === 'pancreas' || targetOrgan === 'liver') {
          body = {
            image_data: selectedImage.base64,
          };
        } else {
          const currentConfig = getCurrentConfig();
          body = {
            image_data: selectedImage.base64,
            scan_type: currentConfig?.scanType?.split(' ')[0]?.toLowerCase() || 'general',
            target_area: targetOrgan,
          };
        }
      }      console.log('Analyzing scan with endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Navigate to report screen with analysis data
        const currentConfig = getCurrentConfig();
        navigation.navigate('ScanReport', {
          reportData: {
            ...data,
            scan_type: currentConfig?.scanType?.split(' ')[0]?.toLowerCase() || targetOrgan || 'general',
            target_area: targetOrgan,
            analysis_date: new Date().toISOString()
          }
        });
      } else {
        Alert.alert('Analysis Failed', data.message || data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error analyzing scan:', error);
      Alert.alert('Error', 'Failed to analyze scan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setSelectedImage(null);
    setFlairImage(null);
    setT1ceImage(null);
    setAnalysisResult(null);
    setScanType('mri');
    setTargetArea('brain');
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#60a5fa', '#3b82f6']} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan Analysis</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Step 1: Organ Selection */}
        {!targetOrgan ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏥 Select Organ for Analysis</Text>
              <Text style={styles.sectionDescription}>
                Choose the organ you want to analyze. Each organ uses specialized AI models and imaging techniques for optimal results.
              </Text>
            </View>

            {/* Organ Selection Cards */}
            <View style={styles.organGrid}>
              {Object.entries(organConfigs).map(([key, config]) => (
                <TouchableOpacity 
                  key={key}
                  style={[styles.organCard, { borderColor: config.color }]}
                  onPress={() => setTargetOrgan(key)}
                >
                  <View style={[styles.organIcon, { backgroundColor: config.color + '20' }]}>
                    <Text style={styles.organEmoji}>{config.name.split(' ')[0]}</Text>
                  </View>
                  <Text style={styles.organName}>{config.name.split(' ').slice(1).join(' ')}</Text>
                  <Text style={styles.organScanType}>{config.scanType}</Text>
                  <Text style={styles.organDescription}>{config.description}</Text>
                  <Text style={styles.organRequirements}>{config.requirements}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Step 2: Scan Upload for Selected Organ */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.backToSelection}
                onPress={() => {
                  setTargetOrgan('');
                  setSelectedImage(null);
                  setFlairImage(null);
                  setT1ceImage(null);
                  setAnalysisResult(null);
                }}
              >
                <Text style={styles.backText}>← Back to Organ Selection</Text>
              </TouchableOpacity>
              
              <View style={[styles.selectedOrganHeader, { backgroundColor: (getCurrentConfig()?.color || '#888') + '10' }]}>
                <Text style={styles.selectedOrganTitle}>
                  {getCurrentConfig()?.name || 'Unknown'} Analysis
                </Text>
                <Text style={styles.selectedOrganScanType}>
                  {getCurrentConfig()?.scanType || 'Unknown Scan Type'}
                </Text>
                <Text style={styles.selectedOrganDetails}>
                  {getCurrentConfig()?.details || 'No details available'}
                </Text>
                <View style={styles.requirementsBadge}>
                  <Text style={styles.requirementsText}>{getCurrentConfig()?.requirements || 'No requirements specified'}</Text>
                </View>
              </View>
            </View>

            {!isDualImageRequired() ? (
              <>
                {/* Single Image Upload */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Upload {getCurrentConfig()?.scanType || 'Scan'}</Text>
                  <TouchableOpacity 
                    style={styles.uploadArea}
                    onPress={() => pickImage('single')}
                  >
                    {selectedImage ? (
                      <Image source={{ uri: selectedImage.uri }} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Text style={styles.uploadIcon}>📷+</Text>
                        <Text style={styles.uploadText}>No image selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={() => pickImage('single')}
                  >
                    <Text style={styles.uploadButtonText}>📁 Upload Scan</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Dual Modality Brain MRI Upload */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FLAIR Image</Text>
              <Text style={styles.sectionDescription}>
                Upload the FLAIR (Fluid Attenuated Inversion Recovery) MRI scan
              </Text>
              <TouchableOpacity 
                style={styles.uploadArea}
                onPress={() => pickImage('flair')}
              >
                {flairImage ? (
                  <Image source={{ uri: flairImage.uri }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadIcon}>🧠</Text>
                    <Text style={styles.uploadText}>Upload FLAIR Image</Text>
                    <Text style={styles.uploadHint}>Tap to select FLAIR scan</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>T1CE Image</Text>
              <Text style={styles.sectionDescription}>
                Upload the T1CE (T1-weighted Contrast Enhanced) MRI scan
              </Text>
              <TouchableOpacity 
                style={styles.uploadArea}
                onPress={() => pickImage('t1ce')}
              >
                {t1ceImage ? (
                  <Image source={{ uri: t1ceImage.uri }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadIcon}>🧠</Text>
                    <Text style={styles.uploadText}>Upload T1CE Image</Text>
                    <Text style={styles.uploadHint}>Tap to select T1CE scan</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>📋 Instructions:</Text>
              <Text style={styles.infoText}>
                • FLAIR: Best for detecting brain lesions and edema{'\n'}
                • T1CE: Shows enhanced tumor regions after contrast{'\n'}
                • Both images are required for accurate brain tumor segmentation
              </Text>
            </View>
          </>
        )}

        {/* Analyze Button */}
        <TouchableOpacity 
          style={[
            styles.analyzeButton, 
            ((isDualImageRequired() && (!flairImage || !t1ceImage)) ||
             (!isDualImageRequired() && !selectedImage) ||
             loading) && styles.analyzeButtonDisabled
          ]}
          onPress={analyzeScan}
          disabled={loading || 
            (isDualImageRequired() && (!flairImage || !t1ceImage)) ||
            (!isDualImageRequired() && !selectedImage)
          }
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analyze Scan</Text>
          )}
        </TouchableOpacity>

        {/* Analysis Results */}
        {analysisResult && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>Analysis Results</Text>
            
            {analysisResult.segmentation_mask && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Segmentation Result:</Text>
                <Image 
                  source={{ uri: `data:image/png;base64,${analysisResult.segmentation_mask}` }} 
                  style={styles.resultImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {analysisResult.segmentation_result && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Segmentation Result:</Text>
                <Image 
                  source={{ uri: `data:image/png;base64,${analysisResult.segmentation_result}` }} 
                  style={styles.resultImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {analysisResult.statistics && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Statistics:</Text>
                <Text style={styles.resultText}>
                  Total Pixels: {analysisResult.statistics.total_pixels?.toLocaleString()}
                </Text>
                <Text style={styles.resultText}>
                  Segmented Pixels: {analysisResult.statistics.segmented_pixels?.toLocaleString()}
                </Text>
                <Text style={styles.resultText}>
                  Percentage: {analysisResult.statistics.segmentation_percentage?.toFixed(2)}%
                </Text>
              </View>
            )}

            {analysisResult.class_statistics && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Class Statistics:</Text>
                {Object.entries(analysisResult.class_statistics).map(([className, stats]) => (
                  <Text key={className} style={styles.resultText}>
                    {className.replace('_', ' ').toUpperCase()}: {stats.pixels?.toLocaleString()} pixels ({stats.percentage?.toFixed(2)}%)
                  </Text>
                ))}
              </View>
            )}

            {analysisResult.insights && analysisResult.insights.length > 0 && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Insights:</Text>
                {analysisResult.insights.map((insight, index) => (
                  <Text key={index} style={styles.resultText}>• {insight}</Text>
                ))}
              </View>
            )}

            {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Recommendations:</Text>
                {analysisResult.recommendations.map((rec, index) => (
                  <Text key={index} style={styles.resultText}>• {rec}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetAnalysis}
            >
              <Text style={styles.resetButtonText}>Analyze Another Scan</Text>
            </TouchableOpacity>
          </View>
        )}
        </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  modeTextActive: {
    color: 'white',
  },
  uploadArea: {
    height: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 10,
    opacity: 0.5,
  },
  uploadText: {
    fontSize: 16,
    color: '#6b7280',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  picker: {
    height: 50,
  },
  analyzeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
  },
  resultItem: {
    marginBottom: 20,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  resultImage: {
    width: width - 80,
    height: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  resetButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
    lineHeight: 18,
  },
  uploadHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  // New organ selection styles
  organGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  organCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 15,
  },
  organIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  organEmoji: {
    fontSize: 28,
  },
  organName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  organScanType: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  organDescription: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  organRequirements: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  backToSelection: {
    marginBottom: 15,
  },
  selectedOrganHeader: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedOrganTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  selectedOrganScanType: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 10,
  },
  selectedOrganDetails: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 15,
  },
  requirementsBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  requirementsText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
});