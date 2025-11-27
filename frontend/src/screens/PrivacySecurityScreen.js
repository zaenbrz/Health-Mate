import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySecurityScreen({ navigation }) {
  return (
    <LinearGradient colors={["#e8eef9", "#d5dff5", "#e8eef9"]} style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#6B70A8", "#9896C4"]} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="shield-checkmark" size={32} color="#ffffff" />
          <Text style={styles.title}>Privacy & Security</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Info Card */}
        <View style={styles.mainCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color="#7E5CAD" />
          </View>
          <Text style={styles.mainTitle}>Your Privacy Matters</Text>
          <Text style={styles.mainDescription}>
            HealthMate is committed to protecting your personal health information and maintaining the highest standards of data security.
          </Text>
        </View>

        {/* Data Usage Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={24} color="#5BA3E0" />
            <Text style={styles.sectionTitle}>How We Use Your Data</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.paragraph}>
              Your medical data is processed by our AI-powered medical triage system to provide you with preliminary health assessments and recommendations.
            </Text>
            <Text style={styles.paragraph}>
              This includes:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color="#72BAA9" />
                <Text style={styles.bulletText}>Symptom analysis and diagnosis suggestions</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color="#72BAA9" />
                <Text style={styles.bulletText}>Medical scan image analysis</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color="#72BAA9" />
                <Text style={styles.bulletText}>Personalized health recommendations</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color="#72BAA9" />
                <Text style={styles.bulletText}>Connection with appropriate healthcare specialists</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Data Protection Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={24} color="#7E5CAD" />
            <Text style={styles.sectionTitle}>Data Protection Guarantee</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.importantText}>
              We want to assure you that:
            </Text>
            <View style={styles.guaranteeCard}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.guaranteeText}>
                Your data is <Text style={styles.boldText}>NOT sold</Text> to third parties
              </Text>
            </View>
            <View style={styles.guaranteeCard}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.guaranteeText}>
                Your data is <Text style={styles.boldText}>NOT used</Text> for advertising purposes
              </Text>
            </View>
            <View style={styles.guaranteeCard}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.guaranteeText}>
                Your data is <Text style={styles.boldText}>NOT shared</Text> without your explicit consent
              </Text>
            </View>
          </View>
        </View>

        {/* AI Processing Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="hardware-chip" size={24} color="#5BA3E0" />
            <Text style={styles.sectionTitle}>AI Medical Triage</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.paragraph}>
              Our AI system processes your health information to provide preliminary medical assessments. This processing:
            </Text>
            <View style={styles.infoBox}>
              <Ionicons name="cloud-outline" size={20} color="#7E5CAD" />
              <Text style={styles.infoBoxText}>
                Happens securely in encrypted environments
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={20} color="#7E5CAD" />
              <Text style={styles.infoBoxText}>
                Data is processed only during active consultations
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Ionicons name="trash-outline" size={20} color="#7E5CAD" />
              <Text style={styles.infoBoxText}>
                Temporary processing data is automatically deleted
              </Text>
            </View>
          </View>
        </View>

        {/* Your Rights Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="hand-right" size={24} color="#72BAA9" />
            <Text style={styles.sectionTitle}>Your Rights</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.paragraph}>
              You have complete control over your data:
            </Text>
            <View style={styles.rightItem}>
              <View style={styles.rightIconCircle}>
                <Ionicons name="eye" size={20} color="#ffffff" />
              </View>
              <View style={styles.rightTextContainer}>
                <Text style={styles.rightTitle}>Access Your Data</Text>
                <Text style={styles.rightDescription}>View all your stored information anytime</Text>
              </View>
            </View>
            <View style={styles.rightItem}>
              <View style={styles.rightIconCircle}>
                <Ionicons name="download" size={20} color="#ffffff" />
              </View>
              <View style={styles.rightTextContainer}>
                <Text style={styles.rightTitle}>Export Your Data</Text>
                <Text style={styles.rightDescription}>Download your medical reports and history</Text>
              </View>
            </View>
            <View style={styles.rightItem}>
              <View style={styles.rightIconCircle}>
                <Ionicons name="trash" size={20} color="#ffffff" />
              </View>
              <View style={styles.rightTextContainer}>
                <Text style={styles.rightTitle}>Delete Your Data</Text>
                <Text style={styles.rightDescription}>Request complete data deletion at any time</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.contactCard}>
          <Ionicons name="mail" size={24} color="#5BA3E0" />
          <Text style={styles.contactTitle}>Questions About Privacy?</Text>
          <Text style={styles.contactText}>
            Contact our privacy team at privacy@healthmate.com
          </Text>
        </View>

        <View style={styles.bottomPadding} />
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(126, 92, 173, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#474E93',
    marginBottom: 12,
    textAlign: 'center',
  },
  mainDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#7E5CAD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#474E93',
  },
  sectionContent: {
    gap: 12,
  },
  paragraph: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
  },
  importantText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#474E93',
    marginBottom: 8,
  },
  bulletList: {
    gap: 10,
    marginTop: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  guaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 12,
    marginVertical: 6,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#474E93',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(126, 92, 173, 0.05)',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7E5CAD',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  rightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 8,
  },
  rightIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5BA3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightTextContainer: {
    flex: 1,
  },
  rightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#474E93',
    marginBottom: 4,
  },
  rightDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#5BA3E0',
    borderStyle: 'dashed',
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#474E93',
    marginTop: 12,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});
