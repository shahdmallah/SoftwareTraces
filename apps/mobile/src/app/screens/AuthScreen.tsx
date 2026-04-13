import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { ltrText, rtlText } from '../utils/direction';

type AuthNavigationProp = StackNavigationProp<RootStackParamList, 'Auth'>;

export function AuthScreen() {
  const navigation = useNavigation<AuthNavigationProp>();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    const requiresName = mode === 'signup';
    if (!email.trim() || !password.trim() || (requiresName && !name.trim())) {
      Alert.alert(t('authErrorTitle'), t('authErrorFillAll'));
      return;
    }

    navigation.navigate('AppTabs');
  };

  const handleGuest = () => {
    navigation.navigate('AppTabs');
  };

  return (
    <AnimatedScreen style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AnimatedBlock delay={40} style={styles.hero}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons
                name={isArabic ? 'arrow-forward' : 'arrow-back'}
                size={18}
                color="white"
              />
            </Pressable>

            <View style={styles.logoBadge}>
              <Ionicons name="map" size={22} color="#F5D16F" />
            </View>
            <Text style={[styles.appTitle, isArabic ? rtlText : ltrText]}>Traces</Text>
            <Text style={[styles.appSubtitle, isArabic ? rtlText : ltrText]}>
              {mode === 'signin' ? t('authWelcomeBack') : t('authCreateAccount')}
            </Text>
          </AnimatedBlock>

          <AnimatedBlock delay={140} style={styles.card}>
            <View style={styles.tabContainer}>
              <Pressable
                onPress={() => setMode('signin')}
                style={[styles.tabButton, mode === 'signin' && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                  {t('authSignIn')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('signup')}
                style={[styles.tabButton, mode === 'signup' && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                  {t('authSignUp')}
                </Text>
              </Pressable>
            </View>

            {mode === 'signup' ? (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{t('authFullName')}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('authFullName')}
                  placeholderTextColor="#9E8E80"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                />
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{t('authEmail')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9E8E80"
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, isArabic ? rtlText : ltrText]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{t('authPassword')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#9E8E80"
                  secureTextEntry={!showPassword}
                  style={[styles.passwordInput, isArabic ? rtlText : ltrText]}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#8A7A6A"
                  />
                </Pressable>
              </View>
            </View>

            <Pressable onPress={handleSubmit} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>
                {mode === 'signin' ? t('authSignIn') : t('authSignUp')}
              </Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <Pressable onPress={handleSubmit} style={styles.socialButton}>
                <Ionicons name="logo-google" size={16} color="#2C2418" />
                <Text style={styles.socialButtonText}>Google</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} style={styles.socialButton}>
                <Ionicons name="logo-apple" size={16} color="#2C2418" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </Pressable>
            </View>

            <Pressable onPress={handleGuest} style={styles.guestButton}>
              <Text style={styles.guestButtonText}>{t('skip')}</Text>
            </Pressable>

            <Pressable
              onPress={() => setMode((value) => (value === 'signin' ? 'signup' : 'signin'))}
              style={styles.toggleModeButton}
            >
              <Text style={styles.toggleModeText}>
                {mode === 'signin' ? t('authToggleToSignUp') : t('authToggleToSignIn')}
              </Text>
            </Pressable>
          </AnimatedBlock>
        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE2CC',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: '#630E13',
    paddingTop: 64,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 18,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  appTitle: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
  },
  appSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  card: {
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 24,
    backgroundColor: '#F7F1E2',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E1D5B8',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    color: '#6B5D4E',
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '700',
  },
  textRight: {
    textAlign: 'right',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBBE9E',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#2C2418',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1.5,
    borderColor: '#CBBE9E',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 44,
    paddingVertical: 13,
    fontSize: 14,
    color: '#2C2418',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 12,
  },
  submitButton: {
    marginTop: 6,
    borderRadius: 16,
    paddingVertical: 15,
    backgroundColor: '#630E13',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1C3A4',
  },
  dividerText: {
    color: '#8A7A6A',
    fontSize: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#CBBE9E',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingVertical: 13,
  },
  socialButtonText: {
    color: '#2C2418',
    fontWeight: '700',
  },
  guestButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 10,
  },
  guestButtonText: {
    color: '#8A7A6A',
    fontWeight: '700',
  },
  toggleModeButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleModeText: {
    color: '#630E13',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
