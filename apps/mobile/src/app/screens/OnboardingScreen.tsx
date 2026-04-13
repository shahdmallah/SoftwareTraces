import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage, type TranslationKey } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';

type OnboardingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Onboarding'>;

const { width, height } = Dimensions.get('window');

const slides: ReadonlyArray<{
  id: number;
  image: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  accent: string;
}> = [
  {
    id: 0,
    image: 'https://images.unsplash.com/photo-1636385927808-8177f1c8f570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    titleKey: 'onboardingSlide1Title',
    subtitleKey: 'onboardingSlide1Subtitle',
    accent: '#630E13',
  },
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1772013971664-5808a8e1a102?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    titleKey: 'onboardingSlide2Title',
    subtitleKey: 'onboardingSlide2Subtitle',
    accent: '#D4A843',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    titleKey: 'onboardingSlide3Title',
    subtitleKey: 'onboardingSlide3Subtitle',
    accent: '#630E13',
  },
];

export function OnboardingScreen() {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const [current, setCurrent] = useState(0);
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const goNext = () => {
    if (current < slides.length - 1) {
      setCurrent(c => c + 1);
    } else {
      navigation.navigate('Auth');
    }
  };

  const skip = () => {
    navigation.navigate('Auth');
  };

  const slide = slides[current];

  return (
    <AnimatedScreen style={styles.container}>
      <Image source={{ uri: slide.image }} style={styles.backgroundImage} />
      <View style={styles.overlay} />

      <AnimatedBlock key={slide.id} delay={80} duration={360} style={styles.content}>
        <Text style={[styles.title, { color: slide.accent }]}>{t(slide.titleKey)}</Text>
        <Text style={styles.subtitle}>{t(slide.subtitleKey)}</Text>
      </AnimatedBlock>

      <AnimatedBlock
        key={`bottom-${slide.id}`}
        delay={160}
        duration={380}
        style={[styles.bottom, { paddingBottom: Math.max(16, insets.bottom + 12) }]}
      >
        <View style={styles.indicators}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.indicator,
                idx === current && { backgroundColor: slide.accent }
              ]}
            />
          ))}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity onPress={skip} style={styles.skipButton}>
            <Text style={styles.skipText}>{t('skip')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goNext} style={[styles.nextButton, { backgroundColor: slide.accent }]}>
            <Text style={styles.nextText}>
              {current === slides.length - 1 ? t('getStarted') : t('next')}
            </Text>
          </TouchableOpacity>
        </View>
      </AnimatedBlock>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE2CC',
  },
  backgroundImage: {
    position: 'absolute',
    width,
    height,
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#fff',
    opacity: 0.92,
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 18,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  skipText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.9,
  },
  nextButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 18,
  },
  nextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
