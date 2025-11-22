import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const LanguageSelector = ({ selectedLanguage, onLanguageChange }) => {
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ur', name: 'اردو', flag: '🇵🇰' },
  ];

  return (
    <View style={styles.container}>
      {languages.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[
            styles.languageButton,
            selectedLanguage === lang.code && styles.selectedButton,
          ]}
          onPress={() => onLanguageChange(lang.code)}
        >
          <Text style={styles.flag}>{lang.flag}</Text>
          <Text
            style={[
              styles.languageName,
              selectedLanguage === lang.code && styles.selectedText,
            ]}
          >
            {lang.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  flag: {
    fontSize: 20,
    marginRight: 6,
  },
  languageName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  selectedText: {
    color: '#fff',
  },
});

export default LanguageSelector;
