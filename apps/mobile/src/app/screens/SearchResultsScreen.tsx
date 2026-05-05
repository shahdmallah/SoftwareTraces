import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { AnimatedScreen } from '../components/AnimatedUI';

type SearchResultsNavigationProp = StackNavigationProp<RootStackParamList, 'SearchResults'>;
type SearchResultsRouteProp = RouteProp<RootStackParamList, 'SearchResults'>;

export function SearchResultsScreen() {
  const navigation = useNavigation<SearchResultsNavigationProp>();
  const route = useRoute<SearchResultsRouteProp>();
  const query = route.params?.query?.trim();

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#2C2418" />
        </Pressable>
        <Text style={styles.title}>Search Results</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          {query ? `Showing results for "${query}"` : 'Type a search query from Explore to see results here.'}
        </Text>
      </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  content: { flex: 1, justifyContent: 'center' },
  subtitle: { color: '#6B5D4E', fontSize: 15, textAlign: 'center' },
});
