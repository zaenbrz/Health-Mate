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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
      name: 'Brain',
      icon: 'brain',
      iconFamily: 'MaterialCommunityIcons',
      scanType: 'MRI Scan',
      fullScanType: 'Magnetic Resonance Imaging',
      description: 'Advanced brain tumor detection and segmentation',
      requirements: 'Requires 2 images: FLAIR and T1CE',
      isDualImage: true,
      color: '#7E5CAD',
      bgColor: 'rgba(126, 92, 173, 0.1)',
      gradientColors: ['#8B7FC4', '#7E5CAD', '#6B4E9A'],
    },
    liver: {
      name: 'Liver',
      icon: 'stomach',
      iconFamily: 'MaterialCommunityIcons',
      scanType: 'CT Scan',
      fullScanType: 'Computed Tomography',
      description: 'Liver lesion detection and analysis',
      requirements: 'Requires 1 CT scan image',
      isDualImage: false,
      color: '#72BAA9',
      bgColor: 'rgba(114, 186, 169, 0.1)',
      gradientColors: ['#87C7B8', '#72BAA9', '#5FA393'],
    },
    kidney: {
      name: 'Kidney',
      icon: 'water-outline',
      iconFamily: 'Ionicons',
      scanType: 'CT Scan',
      fullScanType: 'Computed Tomography',
      description: 'Kidney stone and abnormality detection',
      requirements: 'Requires 1 CT scan image',
      isDualImage: false,
      color: '#5BA3E0',
      bgColor: 'rgba(91, 163, 224, 0.1)',
      gradientColors: ['#78B5E8', '#5BA3E0', '#4A8DC7'],
    },
    pancreas: {
      name: 'Pancreas',
      icon: 'virus',
      iconFamily: 'MaterialCommunityIcons',
      scanType: 'CT Scan',
      fullScanType: 'Computed Tomography',
      description: 'Pancreatic abnormality detection',
      requirements: 'Requires 1 CT scan image',
      isDualImage: false,
      color: '#B08CB3',
      bgColor: 'rgba(176, 140, 179, 0.1)',
      gradientColors: ['#C4A5C7', '#B08CB3', '#9A7A9D'],
    },
    breast: {
      name: 'Breast',
      icon: 'human-female',
      iconFamily: 'MaterialCommunityIcons',
      scanType: 'Ultrasound',
      fullScanType: 'Ultrasound Imaging',
      description: 'Breast tissue analysis and detection',
      requirements: 'Requires 1 ultrasound image',
      isDualImage: false,
      color: '#9896C4',
      bgColor: 'rgba(152, 150, 196, 0.1)',
      gradientColors: ['#ADA9D4', '#9896C4', '#8482B0'],
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
    <LinearGradient colors={["#e8eef9", "#d5dff5", "#e8eef9"]} style={styles.container}>
      <LinearGradient colors={["#6B70A8", "#9896C4"]} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="scan" size={32} color="#ffffff" />
          <Text style={styles.title}>Medical Scan Analysis</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        {/* Step 1: Organ Selection */}
        {!targetOrgan ? (
          <>
            <View style={styles.introSection}>
              <Text style={styles.introTitle}>Select Scan Type</Text>
              <Text style={styles.introText}>
                Choose the area you'd like to analyze with AI-powered diagnostics
              </Text>
            </View>

            {/* Modern Organ Cards */}
            <View style={styles.organCardsContainer}>
              {Object.entries(organConfigs).map(([key, config]) => (
                <TouchableOpacity 
                  key={key}
                  style={styles.modernOrganCard}
                  onPress={() => setTargetOrgan(key)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={config.gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.organCardGradient}
                  >
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.iconCircle}>
                          {config.iconFamily === 'MaterialCommunityIcons' ? (
                            <MaterialCommunityIcons name={config.icon} size={32} color="#ffffff" />
                          ) : (
                            <Ionicons name={config.icon} size={32} color="#ffffff" />
                          )}
                        </View>
                        <View>
                          <Text style={styles.cardTitle}>{config.name}</Text>
                          <Text style={styles.cardSubtitle}>{config.scanType}</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.moreButton}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.8)" />
                      </TouchableOpacity>
                    </View>

                    {/* Card Content */}
                    <View style={styles.cardContent}>
                      {/* Stats Row */}
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.statText}>1-3 min</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="sparkles-outline" size={16} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.statText}>AI Powered</Text>
                        </View>
                      </View>
                    </View>

                    {/* Decorative Elements */}
                    <View style={styles.decorativeCircle1} />
                    <View style={styles.decorativeCircle2} />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Step 2: Scan Upload for Selected Organ */}
            <View style={styles.content}>
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
                <Ionicons name="arrow-back" size={20} color="#7E5CAD" />
                <Text style={[styles.sectionDescription, { marginBottom: 0, marginLeft: 8, color: '#7E5CAD', fontWeight: '600' }]}>Back to Organ Selection</Text>
              </TouchableOpacity>
              
              <View style={styles.selectedOrganHeader}>
                <View style={styles.selectedOrganTop}>
                  <View style={[styles.selectedOrganIconLarge, { backgroundColor: (getCurrentConfig()?.bgColor || '#f0f0f0') }]}>
                    {getCurrentConfig()?.iconFamily === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons name={getCurrentConfig()?.icon || 'medical-bag'} size={40} color={getCurrentConfig()?.color || '#888'} />
                    ) : (
                      <Ionicons name={getCurrentConfig()?.icon || 'scan'} size={40} color={getCurrentConfig()?.color || '#888'} />
                    )}
                  </View>
                  <View style={styles.selectedOrganTitleContainer}>
                    <Text style={styles.selectedOrganTitle}>
                      {getCurrentConfig()?.name || 'Unknown'}
                    </Text>
                    <View style={styles.scanTypeBadge}>
                      <Ionicons name="medical" size={14} color="#7E5CAD" />
                      <Text style={styles.selectedOrganScanType}>
                        {getCurrentConfig()?.scanType || 'Unknown Scan'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.requirementsBadge}>
                  <Ionicons name="information-circle-outline" size={16} color="#474E93" />
                  <Text style={styles.requirementsText}>{getCurrentConfig()?.requirements || 'No requirements'}</Text>
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
                        <Ionicons name="cloud-upload-outline" size={56} color="#9896C4" />
                        <Text style={styles.uploadText}>Tap to upload scan</Text>
                        <Text style={styles.uploadHint}>Select your medical scan image</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={() => pickImage('single')}
                  >
                    <Ionicons name="folder-open-outline" size={20} color="#ffffff" />
                    <Text style={styles.uploadButtonText}>Choose Scan Image</Text>
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
                    <Ionicons name="cloud-upload-outline" size={56} color="#9896C4" />
                    <Text style={styles.uploadText}>Upload FLAIR Image</Text>
                    <Text style={styles.uploadHint}>Tap to select FLAIR MRI scan</Text>
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
                    <Ionicons name="cloud-upload-outline" size={56} color="#9896C4" />
                    <Text style={styles.uploadText}>Upload T1CE Image</Text>
                    <Text style={styles.uploadHint}>Tap to select T1CE MRI scan</Text>
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
            <ActivityIndicator color="white" size="large" />
          ) : (
            <>
              <Ionicons name="analytics" size={22} color="#ffffff" />
              <Text style={styles.analyzeButtonText}>Analyze Scan</Text>
            </>
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
            </View>
          </>
        )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  introSection: {
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#474E93',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  introText: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  organList: {
    marginBottom: 20,
  },
  organListItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  organListGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#5BA3E0',
  },
  organListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  organIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  organInfo: {
    flex: 1,
  },
  organListName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 4,
  },
  organListScanType: {
    fontSize: 12,
    color: '#7E5CAD',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  organListDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  organGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  organCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  organIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  organEmoji: {
    fontSize: 32,
  },
  organName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#474E93',
    textAlign: 'center',
    marginBottom: 6,
  },
  organScanType: {
    fontSize: 11,
    color: '#7E5CAD',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  organDescription: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  organRequirements: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  backToSelection: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedOrganHeader: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedOrganTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  selectedOrganIconLarge: {
    width: 70,
    height: 70,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOrganTitleContainer: {
    flex: 1,
  },
  selectedOrganTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#474E93',
    marginBottom: 6,
  },
  scanTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  selectedOrganScanType: {
    fontSize: 12,
    color: '#7E5CAD',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedOrganDetails: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 16,
  },
  requirementsBadge: {
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d0e8f0',
  },
  requirementsText: {
    fontSize: 12,
    color: '#474E93',
    fontWeight: '600',
    flex: 1,
  },
  uploadArea: {
    height: 220,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#9896C4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    color: '#7E5CAD',
    fontWeight: '600',
    marginBottom: 6,
  },
  uploadHint: {
    fontSize: 13,
    color: '#94a3b8',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadButton: {
    backgroundColor: '#5BA3E0',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#5BA3E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  analyzeButton: {
    backgroundColor: '#5BA3E0',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    marginBottom: 20,
    shadowColor: '#5BA3E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0.1,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#5BA3E0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
  },
  resultsSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 20,
  },
  resultItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#5BA3E0',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 6,
  },
  resultImage: {
    width: width - 92,
    height: 220,
    backgroundColor: '#e8eef9',
    borderRadius: 12,
    marginTop: 8,
  },
  resetButton: {
    backgroundColor: '#7E5CAD',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modern Card Design Styles (Inspired by UI reference)
  organCardsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  modernOrganCard: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  organCardGradient: {
    flex: 1,
    padding: 20,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 'auto',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -40,
    right: -30,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    bottom: -20,
    right: 60,
  },
});