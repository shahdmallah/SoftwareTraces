import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrText, rtlText } from '../utils/direction';

type ForgotPasswordNavigationProp = StackNavigationProp<RootStackParamList, 'ForgotPassword'>;
type ForgotPasswordRouteProp = RouteProp<RootStackParamList, 'ForgotPassword'>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const route = useRoute<ForgotPasswordRouteProp>();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const copy = useMemo(
    () => ({
      title: isArabic ? 'استعادة كلمة المرور' : 'Reset your password',
      subtitle: isArabic
        ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً للعودة إلى حسابك.'
        : 'Enter your email and we will send a secure link to get you back into your account.',
      email: isArabic ? 'البريد الإلكتروني' : 'Email address',
      placeholder: isArabic ? 'name@example.com' : 'name@example.com',
      send: isArabic ? 'إرسال رابط الاستعادة' : 'Send reset link',
      sending: isArabic ? 'جار الإرسال...' : 'Sending...',
      backToSignIn: isArabic ? 'العودة لتسجيل الدخول' : 'Back to sign in',
      error: isArabic ? 'أدخل بريداً إلكترونياً صالحاً.' : 'Enter a valid email address.',
      sentTitle: isArabic ? 'تحقق من بريدك' : 'Check your email',
      sentCopy: isArabic
        ? 'إذا كان هذا البريد مسجلاً في Traces، ستصلك تعليمات استعادة كلمة المرور خلال دقائق.'
        : 'If this email is registered with Traces, password reset instructions will arrive in a few minutes.',
      tip: isArabic ? 'لم يصلك الرابط؟ تحقق من البريد غير المرغوب أو حاول مرة أخرى.' : 'No link yet? Check spam or try again.',
    }),
    [isArabic]
  );

  const handleSubmit = () => {
    if (!isValidEmail(email)) {
      setErrorMessage(copy.error);
      return;
    }

    setErrorMessage('');
    setIsSubmitted(true);
  };

  return (
    <AnimatedScreen style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AnimatedBlock delay={40} style={styles.hero}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name={isArabic ? 'arrow-forward' : 'arrow-back'} size={18} color="white" />
            </Pressable>

            <View style={styles.logoBadge}>
              <Ionicons name={isSubmitted ? 'mail-open-outline' : 'key-outline'} size={25} color="#F5D16F" />
            </View>
            <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isSubmitted ? copy.sentTitle : copy.title}</Text>
            <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>{isSubmitted ? copy.sentCopy : copy.subtitle}</Text>
          </AnimatedBlock>

          <AnimatedBlock delay={120} style={styles.card}>
            {!isSubmitted ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{copy.email}</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="mail-outline" size={18} color="#8A7A6A" />
                    <TextInput
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder={copy.placeholder}
                      placeholderTextColor="#A18F7A"
                      style={[styles.input, isArabic ? rtlText : ltrText]}
                    />
                  </View>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={18} color="#8B1E1E" />
                    <Text style={[styles.errorBannerText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
                  </View>
                ) : null}

                <Pressable onPress={handleSubmit} style={styles.submitButton}>
                  <Text style={styles.submitButtonText}>{copy.send}</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.successState}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={34} color="#2F7D4F" />
                </View>
                <Text style={[styles.successCopy, isArabic ? rtlText : ltrText]}>{copy.tip}</Text>
                <Pressable onPress={handleSubmit} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{copy.send}</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={() => navigation.navigate('Auth', { mode: 'signin' })} style={styles.backToSignInButton}>
              <Text style={styles.backToSignInText}>{copy.backToSignIn}</Text>
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
    paddingBottom: 46,
    paddingHorizontal: 22,
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
  title: {
    marginTop: 14,
    fontSize: 27,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 9,
    maxWidth: 310,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 7,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '800',
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.12)',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: '#2C2418',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
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
    marginTop: 4,
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: '#630E13',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  successState: {
    alignItems: 'center',
    paddingTop: 4,
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,125,79,0.12)',
  },
  successCopy: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B5D4E',
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#EFE5CD',
  },
  secondaryButtonText: {
    color: '#630E13',
    fontSize: 14,
    fontWeight: '800',
  },
  backToSignInButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 9,
  },
  backToSignInText: {
    color: '#630E13',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});
