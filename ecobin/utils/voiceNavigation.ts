import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VoiceSettings {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
  language: string;
  voice: string;
}

export class VoiceNavigationService {
  private static instance: VoiceNavigationService;
  private isPlaying: boolean = false;
  private currentSound: Audio.Sound | null = null;
  private settings: VoiceSettings = {
    enabled: false, // Voice navigation disabled by default
    volume: 0.8,
    rate: 1.0,
    pitch: 1.0,
    language: 'en-US',
    voice: 'default'
  };

  private constructor() {
    this.loadSettings();
  }

  public static getInstance(): VoiceNavigationService {
    if (!VoiceNavigationService.instance) {
      VoiceNavigationService.instance = new VoiceNavigationService();
    }
    return VoiceNavigationService.instance;
  }

  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem('voiceSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        this.settings = { ...this.settings, ...parsedSettings };
        
        // Ensure voice is disabled by default if not explicitly enabled
        if (parsedSettings.enabled === undefined) {
          this.settings.enabled = false;
          await this.saveSettings({ enabled: false });
        }
      } else {
        // If no saved settings, ensure voice is disabled by default
        this.settings.enabled = false;
        await this.saveSettings({ enabled: false });
      }
    } catch (error) {
      console.error('Error loading voice settings:', error);
      // On error, ensure voice is disabled
      this.settings.enabled = false;
    }
  }

  public async saveSettings(settings: Partial<VoiceSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    try {
      await AsyncStorage.setItem('voiceSettings', JSON.stringify(this.settings));
      
      // If voice is being disabled, stop any current speech
      if (settings.enabled === false) {
        await this.stopSpeaking();
      }
    } catch (error) {
      console.error('Error saving voice settings:', error);
    }
  }

  // Method to completely disable voice navigation
  public async disableVoice(): Promise<void> {
    await this.stopSpeaking();
    await this.saveSettings({ enabled: false });
  }

  // Method to enable voice navigation
  public async enableVoice(): Promise<void> {
    await this.saveSettings({ enabled: true });
  }

  // Method to force disable voice navigation (for app startup)
  public async forceDisableVoice(): Promise<void> {
    await this.stopSpeaking();
    this.settings.enabled = false;
    await AsyncStorage.setItem('voiceSettings', JSON.stringify(this.settings));
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public async speak(text: string, priority: 'high' | 'normal' = 'normal'): Promise<void> {
    if (!this.settings.enabled) {
      return;
    }

    try {
      // Stop any current speech
      await this.stopSpeaking();

      console.log(`[VoiceNavigation] Speaking: "${text}"`);

      // Use expo-speech for basic TTS
      await Speech.speak(text, {
        language: this.settings.language,
        pitch: this.settings.pitch,
        rate: this.settings.rate,
        volume: this.settings.volume,
        onStart: () => {
          this.isPlaying = true;
          console.log('[VoiceNavigation] Speech started');
        },
        onDone: () => {
          this.isPlaying = false;
          console.log('[VoiceNavigation] Speech completed');
        },
        onStopped: () => {
          this.isPlaying = false;
          console.log('[VoiceNavigation] Speech stopped');
        },
        onError: (error) => {
          this.isPlaying = false;
          console.error('[VoiceNavigation] Speech error:', error);
        }
      });

    } catch (error) {
      console.error('[VoiceNavigation] Error speaking text:', error);
      this.isPlaying = false;
    }
  }

  public async stopSpeaking(): Promise<void> {
    try {
      if (this.isPlaying) {
        await Speech.stop();
        this.isPlaying = false;
        console.log('[VoiceNavigation] Speech stopped');
      }
    } catch (error) {
      console.error('[VoiceNavigation] Error stopping speech:', error);
    }
  }

  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  // Navigation-specific voice commands
  public async announceRouteStart(binLocation: string, distance: number): Promise<void> {
    const text = `Navigation started. Proceed to ${binLocation}. Distance: ${Math.round(distance)} meters.`;
    await this.speak(text, 'high');
  }

  public async announceDistanceUpdate(distance: number, binLocation: string): Promise<void> {
    let text = '';
    
    if (distance < 10) {
      text = `You have arrived at ${binLocation}.`;
    } else if (distance < 50) {
      text = `Approaching ${binLocation}. ${Math.round(distance)} meters remaining.`;
    } else if (distance < 100) {
      text = `${Math.round(distance)} meters to ${binLocation}.`;
    } else if (distance < 500) {
      text = `Continue for ${Math.round(distance)} meters to ${binLocation}.`;
    } else {
      text = `Proceed ${Math.round(distance)} meters to ${binLocation}.`;
    }

    await this.speak(text, 'normal');
  }

  public async announceArrival(binLocation: string): Promise<void> {
    const text = `You have arrived at ${binLocation}. Task location reached.`;
    await this.speak(text, 'high');
  }

  public async announceTaskReminder(binId: string, taskType: string): Promise<void> {
    const text = `Remember to complete ${taskType} for bin ${binId}.`;
    await this.speak(text, 'normal');
  }

  public async announceRouteUpdate(newDistance: number, direction: string): Promise<void> {
    const text = `${direction}. ${Math.round(newDistance)} meters remaining.`;
    await this.speak(text, 'normal');
  }

  public async announceOfflineMode(): Promise<void> {
    const text = 'GPS signal lost. Continuing with last known location.';
    await this.speak(text, 'high');
  }

  public async announceGPSRestored(): Promise<void> {
    const text = 'GPS signal restored. Resuming navigation.';
    await this.speak(text, 'normal');
  }

  // Utility method to generate contextual navigation messages
  public generateNavigationMessage(
    currentDistance: number, 
    previousDistance: number, 
    binLocation: string,
    binId: string
  ): string {
    const distanceDiff = previousDistance - currentDistance;
    
    if (currentDistance < 10) {
      return `You have arrived at ${binLocation}.`;
    } else if (currentDistance < 50) {
      return `Approaching ${binLocation}. ${Math.round(currentDistance)} meters remaining.`;
    } else if (distanceDiff > 20) {
      return `Good progress. ${Math.round(currentDistance)} meters to ${binLocation}.`;
    } else if (distanceDiff < -10) {
      return `You may have missed the turn. ${Math.round(currentDistance)} meters to ${binLocation}.`;
    } else {
      return `Continue straight. ${Math.round(currentDistance)} meters to ${binLocation}.`;
    }
  }

  // Method to preload common phrases for better performance
  public async preloadCommonPhrases(): Promise<void> {
    // Only preload if voice is enabled
    if (!this.settings.enabled) {
      return;
    }

    // Skip preloading to avoid any speech engine activation
    // Phrases will be loaded on-demand when actually needed
    console.log('[VoiceNavigation] Preloading skipped - voice is disabled or preloading disabled');
  }
}

// Export singleton instance
export const voiceNavigation = VoiceNavigationService.getInstance();
