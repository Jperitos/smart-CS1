import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { voiceNavigation, VoiceSettings } from '@/utils/voiceNavigation';

interface VoiceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceSettingsModal({ visible, onClose }: VoiceSettingsModalProps) {
  const [settings, setSettings] = useState<VoiceSettings>({
    enabled: false, // Voice navigation disabled by default
    volume: 0.8,
    rate: 1.0,
    pitch: 1.0,
    language: 'en-US',
    voice: 'default'
  });

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = () => {
    const currentSettings = voiceNavigation.getSettings();
    setSettings(currentSettings);
  };

  const updateSetting = async (key: keyof VoiceSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await voiceNavigation.saveSettings(newSettings);
  };

  const testVoice = async () => {
    if (settings.enabled) {
      await voiceNavigation.speak('Voice navigation test. This is how your navigation will sound.');
    } else {
      Alert.alert('Voice Disabled', 'Please enable voice navigation first to test the voice.');
    }
  };

  const resetToDefaults = async () => {
    const defaultSettings: VoiceSettings = {
      enabled: false, // Voice navigation disabled by default
      volume: 0.8,
      rate: 1.0,
      pitch: 1.0,
      language: 'en-US',
      voice: 'default'
    };
    
    setSettings(defaultSettings);
    await voiceNavigation.saveSettings(defaultSettings);
    // Only speak if voice is enabled after reset
    if (defaultSettings.enabled) {
      await voiceNavigation.speak('Voice settings reset to defaults.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Voice Navigation Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Voice Enable/Disable */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voice Navigation</Text>
            <TouchableOpacity
              style={[styles.toggleButton, settings.enabled && styles.toggleButtonActive]}
              onPress={() => updateSetting('enabled', !settings.enabled)}
            >
              <Text style={[styles.toggleButtonText, settings.enabled && styles.toggleButtonTextActive]}>
                {settings.enabled ? '🔊 Enabled' : '🔇 Disabled'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Volume Control */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Volume</Text>
            <View style={styles.volumeContainer}>
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((volume) => (
                <TouchableOpacity
                  key={volume}
                  style={[
                    styles.volumeButton,
                    settings.volume === volume && styles.volumeButtonActive
                  ]}
                  onPress={() => updateSetting('volume', volume)}
                >
                  <Text style={[
                    styles.volumeButtonText,
                    settings.volume === volume && styles.volumeButtonTextActive
                  ]}>
                    {Math.round(volume * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Speech Rate */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Speech Rate</Text>
            <View style={styles.rateContainer}>
              {[
                { value: 0.5, label: 'Slow' },
                { value: 0.75, label: 'Medium' },
                { value: 1.0, label: 'Normal' },
                { value: 1.25, label: 'Fast' },
                { value: 1.5, label: 'Very Fast' }
              ].map((rate) => (
                <TouchableOpacity
                  key={rate.value}
                  style={[
                    styles.rateButton,
                    settings.rate === rate.value && styles.rateButtonActive
                  ]}
                  onPress={() => updateSetting('rate', rate.value)}
                >
                  <Text style={[
                    styles.rateButtonText,
                    settings.rate === rate.value && styles.rateButtonTextActive
                  ]}>
                    {rate.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Language Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Language</Text>
            <View style={styles.languageContainer}>
              {[
                { code: 'en-US', name: 'English (US)' },
                { code: 'en-GB', name: 'English (UK)' },
                { code: 'es-ES', name: 'Spanish' },
                { code: 'fr-FR', name: 'French' },
                { code: 'de-DE', name: 'German' },
                { code: 'it-IT', name: 'Italian' }
              ].map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageButton,
                    settings.language === language.code && styles.languageButtonActive
                  ]}
                  onPress={() => updateSetting('language', language.code)}
                >
                  <Text style={[
                    styles.languageButtonText,
                    settings.language === language.code && styles.languageButtonTextActive
                  ]}>
                    {language.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Test and Reset Buttons */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.testButton} onPress={testVoice}>
              <Text style={styles.testButtonText}>🎵 Test Voice</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
              <Text style={styles.resetButtonText}>🔄 Reset to Defaults</Text>
            </TouchableOpacity>
          </View>

          {/* Help Text */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Voice Navigation Features</Text>
            <Text style={styles.helpText}>
              • Automatic route announcements when navigation starts
            </Text>
            <Text style={styles.helpText}>
              • Real-time distance updates as you approach the bin
            </Text>
            <Text style={styles.helpText}>
              • Arrival notifications when you reach your destination
            </Text>
            <Text style={styles.helpText}>
              • GPS status updates (online/offline mode)
            </Text>
            <Text style={styles.helpText}>
              • Task reminders for bin maintenance activities
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 30,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  toggleButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  volumeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  volumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  volumeButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  volumeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  volumeButtonTextActive: {
    color: '#fff',
  },
  rateContainer: {
    gap: 8,
  },
  rateButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  rateButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  rateButtonTextActive: {
    color: '#fff',
  },
  languageContainer: {
    gap: 8,
  },
  languageButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  languageButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  languageButtonTextActive: {
    color: '#fff',
  },
  testButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
