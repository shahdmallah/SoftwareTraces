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
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { ltrText, rtlText } from '../utils/direction';
import { login, signup } from '../lib/auth';

type AuthNavigationProp = StackNavigationProp<RootStackParamList, 'Auth'>;
type AuthRouteProp = RouteProp<RootStackParamList, 'Auth'>;

export function AuthScreen() {
  const navigation = useNavigation<AuthNavigationProp>();
  const route = useRoute<AuthRouteProp>();
  const { t, language } = useLanguage();
  const { setSession } = useAuth();
  const isArabic = language === 'ar';
  const [mode, setMode] = useState<'signin' | 'signup'>(route.params?.mode ?? 'signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  React.useEffect(() => {
    if (route.params?.mode) {
      setMode(route.params.mode);
      setErrorMessage('');
    }
  }, [route.params?.mode]);

  const handleSubmit = async () => {
    const requiresName = mode === 'signup';
    if (!email.trim() || !password.trim() || (requiresName && !name.trim())) {
      setErrorMessage(t('authErrorFillAll'));
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim();

      if (mode === 'signup') {
        await signup({
          email: trimmedEmail,
          password,
          full_name: name.trim(),
        });
      }

      const session = await login({
        email: trimmedEmail,
        password,
      });

      setSession(session);
      navigation.navigate('AppTabs');
    } catch (error) {
      setSession(null);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to authenticate right now.');
    } finally {
      setIsSubmitting(false);
    }
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
              <Ionicons name="map" size={24} color="#F5D16F" />
            </View>
            <Text style={[styles.appTitle, isArabic ? rtlText : ltrText]}>Traces</Text>
            <Text style={[styles.appSubtitle, isArabic ? rtlText : ltrText]}>
              {mode === 'signin' ? t('authWelcomeBack') : t('authCreateAccount')}
            </Text>
          </AnimatedBlock>

          <AnimatedBlock delay={140} style={styles.card}>
            <View style={styles.tabContainer}>
              <Pressable
                onPress={() => {
                  setMode('signin');
                  setErrorMessage('');
                }}
                style={[styles.tabButton, mode === 'signin' && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                  {t('authSignIn')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode('signup');
                  setErrorMessage('');
                }}
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
                  onChangeText={(value) => {
                    setName(value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                />
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{t('authEmail')}</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (errorMessage) setErrorMessage('');
                }}
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
                  onChangeText={(value) => {
                    setPassword(value);
                    if (errorMessage) setErrorMessage('');
                  }}
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

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#8B1E1E" />
                <Text style={[styles.errorBannerText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Please wait...' : mode === 'signin' ? t('authSignIn') : t('authSignUp')}
              </Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <Pressable style={styles.socialButton}>
                <Ionicons name="logo-google" size={16} color="#2C2418" />
                <Text style={styles.socialButtonText}>Google</Text>
              </Pressable>
              <Pressable style={styles.socialButton}>
                <Ionicons name="logo-apple" size={16} color="#2C2418" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </Pressable>
            </View>

            <Pressable onPress={handleGuest} style={styles.guestButton}>
              <Text style={styles.guestButtonText}>{t('skip')}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode((value) => (value === 'signin' ? 'signup' : 'signin'));
                setErrorMessage('');
              }}
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
    backgroundColor: '#EFE5CD',
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
    paddingBottom: 42,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
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
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appTitle: {
    marginTop: 14,
    fontSize: 30,
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
    marginTop: -20,
    borderRadius: 28,
    backgroundColor: '#FBF7EE',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 7,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E7DCC2',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
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
    marginBottom: 16,
  },
  label: {
    marginBottom: 7,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '700',
  },
  textRight: {
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.12)',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#2C2418',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.12)',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 48,
    paddingVertical: 14,
    fontSize: 14,
    color: '#2C2418',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(139,30,30,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(139,30,30,0.18)',
  },
  errorBannerText: {
    flex: 1,
    color: '#8B1E1E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 6,
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: '#630E13',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.75,
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
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.12)',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
