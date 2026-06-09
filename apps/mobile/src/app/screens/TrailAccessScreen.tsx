import React from 'react';
import { StyleSheet } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedScreen } from '../components/AnimatedUI';
import { GettingThereSection } from '../components/GettingThereSection';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';

type TrailAccessRouteProp = RouteProp<RootStackParamList, 'TrailAccess'>;
type TrailAccessNavigationProp = StackNavigationProp<RootStackParamList, 'TrailAccess'>;

export function TrailAccessScreen() {
  const route = useRoute<TrailAccessRouteProp>();
  const navigation = useNavigation<TrailAccessNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { trailId, trailName, canEditTrailhead = false } = route.params;

  return (
    <AnimatedScreen style={styles.container}>
      <GettingThereSection
        trailId={trailId}
        trailName={trailName}
        isArabic={isArabic}
        autoLoad
        fullScreen
        topInset={insets.top}
        bottomInset={insets.bottom}
        onBack={() => navigation.goBack()}
        onRequireAuth={() => navigation.navigate('Auth', { mode: 'signin' })}
        canEditTrailhead={canEditTrailhead}
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15130F',
  },
});
