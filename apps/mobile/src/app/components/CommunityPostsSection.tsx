import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ltrText, rtlText } from '../utils/direction';
import { useLanguage } from '../contexts/LanguageContext';

interface Post {
  id: string;
  user: string;
  timeKey: string;
  textEn: string;
  textAr: string;
}

interface CommunityPostsSectionProps {
  posts: Post[];
}

export function CommunityPostsSection({ posts }: CommunityPostsSectionProps) {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{t('detailCommunityTitle')}</Text>
      {posts.map((post) => (
        <View key={post.id} style={styles.postCard}>
          <View style={styles.postHeader}>
            <Text style={styles.postUser}>{post.user}</Text>
            <Text style={styles.postTime}>{t(post.timeKey as never)}</Text>
          </View>
          <Text style={[styles.postText, isArabic ? rtlText : ltrText]}>
            {isArabic ? post.textAr : post.textEn}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
    marginBottom: 12,
  },
  postCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F6F0E0',
    marginTop: 10,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUser: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '800',
  },
  postTime: {
    color: '#8A7A6A',
    fontSize: 11,
  },
  postText: {
    color: '#4A4131',
    fontSize: 14,
    lineHeight: 20,
  },
});