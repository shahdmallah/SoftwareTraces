import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
  getMySosAlerts,
  updateEmergencyContact,
  updateSosStatus,
  type EmergencyContact,
  type SosAlert,
} from '../api/sosApi';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { RootStackParamList } from '../navigation/types';

type SafetyCenterNavigationProp = StackNavigationProp<RootStackParamList, 'SafetyCenter'>;
type SafetyCenterRouteProp = RouteProp<RootStackParamList, 'SafetyCenter'>;

type ContactDraft = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  notify_by_push: boolean;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_on_sos: boolean;
  is_active: boolean;
};

const emptyContactDraft: ContactDraft = {
  name: '',
  phone: '',
  email: '',
  relationship: '',
  notify_by_push: true,
  notify_by_sms: true,
  notify_by_email: true,
  notify_on_sos: true,
  is_active: true,
};

const statusTone: Record<string, { bg: string; fg: string; label: string }> = {
  created: { bg: '#F7E8D0', fg: '#7A4D00', label: 'Created' },
  notifying: { bg: '#F7E8D0', fg: '#7A4D00', label: 'Notifying' },
  notified: { bg: '#E8F2DF', fg: '#2F6B4F', label: 'Notified' },
  partial: { bg: '#FDF1DD', fg: '#8A5A12', label: 'Partial' },
  acknowledged: { bg: '#E6EEF7', fg: '#315D8C', label: 'Acknowledged' },
  resolved: { bg: '#E8F2DF', fg: '#2F6B4F', label: 'Resolved' },
  cancelled: { bg: '#EFE8DE', fg: '#6B5D4E', label: 'Cancelled' },
  failed: { bg: '#F9E2E1', fg: '#9B1C1C', label: 'Failed' },
};

function getDisplayedSosState(sos: Pick<SosAlert, 'status' | 'notification_status'>) {
  if (sos.status === 'notified' && sos.notification_status === 'partial') {
    return statusTone.partial;
  }

  return statusTone[sos.status] ?? statusTone.created;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function contactToDraft(contact: EmergencyContact): ContactDraft {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    relationship: contact.relationship ?? '',
    notify_by_push: contact.notify_by_push,
    notify_by_sms: contact.notify_by_sms,
    notify_by_email: contact.notify_by_email,
    notify_on_sos: contact.notify_on_sos,
    is_active: contact.is_active,
  };
}

function compact(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function SafetyCenterScreen() {
  const navigation = useNavigation<SafetyCenterNavigationProp>();
  const route = useRoute<SafetyCenterRouteProp>();
  const insets = useSafeAreaInsets();
  const isOnboarding = route.params?.onboarding === true;
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const activeContactCount = useMemo(
    () => contacts.filter((contact) => contact.is_active && contact.notify_on_sos).length,
    [contacts],
  );
  const latestSos = sosAlerts[0] ?? null;

  const goToRecommendationSetup = useCallback((notice?: string) => {
    navigation.replace('RecommendationPreferences', {
      onboarding: true,
      ...(notice ? { notice } : {}),
    });
  }, [navigation]);

  const loadSafetyCenter = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMessage('');

    try {
      const [nextContacts, nextSosAlerts] = await Promise.all([
        getEmergencyContacts(),
        getMySosAlerts(),
      ]);
      setContacts(nextContacts);
      setSosAlerts(nextSosAlerts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load safety settings.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSafetyCenter();
  }, [loadSafetyCenter]);

  const handleSaveContact = useCallback(async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Add a contact name before saving.');
      return;
    }

    if (!compact(draft.phone) && !compact(draft.email)) {
      Alert.alert('Reachable contact needed', 'Add a phone number or email. Push only works for linked Traces accounts.');
      return;
    }

    setIsSavingContact(true);
    try {
      if (draft.id) {
        const updated = await updateEmergencyContact(draft.id, {
          name,
          phone: compact(draft.phone),
          email: compact(draft.email),
          relationship: compact(draft.relationship),
          notify_by_push: draft.notify_by_push,
          notify_by_sms: draft.notify_by_sms,
          notify_by_email: draft.notify_by_email,
          notify_on_sos: draft.notify_on_sos,
          is_active: draft.is_active,
        });
        setContacts((current) => current.map((contact) => (contact.id === updated.id ? updated : contact)));
      } else {
        const created = await createEmergencyContact({
          name,
          phone: compact(draft.phone),
          email: compact(draft.email),
          relationship: compact(draft.relationship),
          notify_by_push: draft.notify_by_push,
          notify_by_sms: draft.notify_by_sms,
          notify_by_email: draft.notify_by_email,
          notify_on_sos: draft.notify_on_sos,
        });
        setContacts((current) => [created, ...current]);
      }
      setDraft(null);
    } catch (error) {
      Alert.alert('Unable to save contact', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSavingContact(false);
    }
  }, [draft]);

  const handleDeleteContact = useCallback((contact: EmergencyContact) => {
    Alert.alert('Delete emergency contact?', `${contact.name} will no longer receive SOS messages.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPendingAction(`delete-${contact.id}`);
          try {
            await deleteEmergencyContact(contact.id);
            setContacts((current) => current.filter((item) => item.id !== contact.id));
          } catch (error) {
            Alert.alert('Unable to delete contact', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setPendingAction(null);
          }
        },
      },
    ]);
  }, []);

  const handleToggleContact = useCallback(async (contact: EmergencyContact, isActive: boolean) => {
    setPendingAction(`toggle-${contact.id}`);
    try {
      const updated = await updateEmergencyContact(contact.id, { is_active: isActive });
      setContacts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      Alert.alert('Unable to update contact', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPendingAction(null);
    }
  }, []);

  const handleSosAction = useCallback(async (sos: SosAlert, status: 'acknowledged' | 'resolved' | 'cancelled') => {
    setPendingAction(`${status}-${sos.id}`);
    try {
      const updated = await updateSosStatus(sos.id, { status });
      setSosAlerts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      Alert.alert('Unable to update SOS', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPendingAction(null);
    }
  }, []);

  const renderSosActions = (sos: SosAlert) => {
    if (sos.status === 'resolved' || sos.status === 'cancelled') {
      return null;
    }

    if (sos.status === 'acknowledged') {
      return (
        <Pressable style={styles.smallActionButton} onPress={() => void handleSosAction(sos, 'resolved')} disabled={Boolean(pendingAction)}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#2F6B4F" />
          <Text style={styles.smallActionText}>Resolve</Text>
        </Pressable>
      );
    }

    return (
      <View style={styles.sosActionRow}>
        <Pressable style={styles.smallActionButton} onPress={() => void handleSosAction(sos, 'acknowledged')} disabled={Boolean(pendingAction)}>
          <Ionicons name="eye-outline" size={15} color="#315D8C" />
          <Text style={styles.smallActionText}>Acknowledge</Text>
        </Pressable>
        <Pressable style={[styles.smallActionButton, styles.cancelActionButton]} onPress={() => void handleSosAction(sos, 'cancelled')} disabled={Boolean(pendingAction)}>
          <Ionicons name="close-circle-outline" size={15} color="#9B1C1C" />
          <Text style={[styles.smallActionText, styles.cancelActionText]}>Cancel</Text>
        </Pressable>
      </View>
    );
  };

  const handleSkipOnboarding = useCallback(() => {
    const notice = 'You can update your emergency contacts later from Profile > Settings.';

    Alert.alert('Skip for now', notice, [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => goToRecommendationSetup(notice),
      },
    ]);
  }, [goToRecommendationSetup]);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(14, insets.top + 8), paddingBottom: Math.max(30, insets.bottom + 24) }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadSafetyCenter('refresh')} tintColor="#630E13" />}
      >
        <AnimatedBlock delay={30}>
          <View style={styles.header}>
            {isOnboarding ? (
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1 of 2</Text>
              </View>
            ) : (
              <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={20} color="#2C2418" />
              </Pressable>
            )}
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{isOnboarding ? 'Safety setup' : 'Safety Center'}</Text>
              <Text style={styles.subtitle}>
                {isOnboarding
                  ? 'Add emergency contacts before your first hike, or skip and update them later from Profile.'
                  : 'Manage SOS contacts and review emergency alerts.'}
              </Text>
            </View>
            <Pressable style={styles.addButton} onPress={() => setDraft(emptyContactDraft)}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </AnimatedBlock>

        {isOnboarding ? (
          <AnimatedBlock delay={55} style={styles.onboardingBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#630E13" />
            <View style={styles.onboardingBannerCopy}>
              <Text style={styles.onboardingBannerTitle}>Set this up now or skip it</Text>
              <Text style={styles.onboardingBannerText}>
                We&apos;ll only ask once, and you can always edit your SOS contacts from your profile later.
              </Text>
            </View>
          </AnimatedBlock>
        ) : null}

        {isLoading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color="#630E13" />
          </View>
        ) : errorMessage ? (
          <AnimatedBlock delay={80} style={styles.errorBlock}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadSafetyCenter()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </AnimatedBlock>
        ) : (
          <>
            <AnimatedBlock delay={70} style={styles.summaryBand}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{activeContactCount}</Text>
                <Text style={styles.summaryLabel}>SOS contacts</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{sosAlerts.length}</Text>
                <Text style={styles.summaryLabel}>Alerts</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{latestSos ? getDisplayedSosState(latestSos).label : 'None'}</Text>
                <Text style={styles.summaryLabel}>Latest</Text>
              </View>
            </AnimatedBlock>

            <AnimatedBlock delay={110} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Emergency contacts</Text>
                  <Text style={styles.sectionSubtitle}>Phone numbers are best right now. Push only works for linked Traces accounts.</Text>
                </View>
                <Pressable style={styles.textButton} onPress={() => setDraft(emptyContactDraft)}>
                  <Text style={styles.textButtonLabel}>Add</Text>
                </Pressable>
              </View>

              {contacts.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Ionicons name="person-add-outline" size={24} color="#630E13" />
                  <Text style={styles.emptyTitle}>No contacts yet</Text>
                  <Text style={styles.emptyText}>Add at least one trusted person before your next hike.</Text>
                </View>
              ) : (
                contacts.map((contact) => {
                  const isPending = pendingAction === `toggle-${contact.id}` || pendingAction === `delete-${contact.id}`;
                  return (
                    <View key={contact.id} style={styles.contactRow}>
                      <View style={styles.contactAvatar}>
                        <Text style={styles.contactAvatarText}>{contact.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.contactBody}>
                        <Text style={styles.contactName}>{contact.name}</Text>
                        <Text style={styles.contactMeta} numberOfLines={1}>
                          {[contact.relationship, contact.phone, contact.email].filter(Boolean).join(' | ') || 'Push contact'}
                        </Text>
                        <View style={styles.contactFlags}>
                          {contact.notify_by_push ? <Text style={styles.flag}>Push</Text> : null}
                          {contact.notify_by_sms ? <Text style={styles.flag}>SMS</Text> : null}
                          {contact.notify_by_email ? <Text style={styles.flag}>Email</Text> : null}
                        </View>
                      </View>
                      <View style={styles.contactActions}>
                        {isPending ? (
                          <ActivityIndicator color="#630E13" />
                        ) : (
                          <Switch
                            value={contact.is_active}
                            onValueChange={(nextValue) => void handleToggleContact(contact, nextValue)}
                            trackColor={{ true: '#D7BDA7', false: '#E5DDD2' }}
                            thumbColor={contact.is_active ? '#630E13' : '#FFFFFF'}
                          />
                        )}
                        <View style={styles.iconActionRow}>
                          <Pressable style={styles.miniIconButton} onPress={() => setDraft(contactToDraft(contact))}>
                            <Ionicons name="create-outline" size={16} color="#6B5D4E" />
                          </Pressable>
                          <Pressable style={styles.miniIconButton} onPress={() => handleDeleteContact(contact)}>
                            <Ionicons name="trash-outline" size={16} color="#9B1C1C" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </AnimatedBlock>

            <AnimatedBlock delay={150} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>SOS history</Text>
                  <Text style={styles.sectionSubtitle}>Track delivery status and close resolved alerts.</Text>
                </View>
              </View>

              {sosAlerts.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#2F6B4F" />
                  <Text style={styles.emptyTitle}>No SOS alerts</Text>
                  <Text style={styles.emptyText}>Emergency alerts from recordings will appear here.</Text>
                </View>
              ) : (
                sosAlerts.map((sos) => {
                  const tone = getDisplayedSosState(sos);
                  return (
                    <View key={sos.id} style={styles.sosRow}>
                      <View style={styles.sosTopRow}>
                        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.statusPillText, { color: tone.fg }]}>{tone.label}</Text>
                        </View>
                        <Text style={styles.sosTime}>{formatDate(sos.occurred_at)}</Text>
                      </View>
                      <Text style={styles.sosMessage} numberOfLines={2}>
                        {sos.message || 'Emergency SOS alert'}
                      </Text>
                      <Text style={styles.sosMeta}>
                        {Number(sos.notified_contact_count ?? 0)}/{Number(sos.contact_count ?? 0)} contacts notified
                        {sos.latitude != null && sos.longitude != null ? ` | ${sos.latitude.toFixed(4)}, ${sos.longitude.toFixed(4)}` : ''}
                      </Text>
                      {sos.status_note ? <Text style={styles.sosNote}>{sos.status_note}</Text> : null}
                      {renderSosActions(sos)}
                    </View>
                  );
                })
              )}
            </AnimatedBlock>

            {isOnboarding ? (
              <AnimatedBlock delay={190} style={styles.onboardingActions}>
                <Pressable style={styles.onboardingSecondaryButton} onPress={handleSkipOnboarding}>
                  <Text style={styles.onboardingSecondaryButtonText}>Skip for now</Text>
                </Pressable>
                <Pressable style={styles.onboardingPrimaryButton} onPress={() => goToRecommendationSetup()}>
                  <Text style={styles.onboardingPrimaryButtonText}>
                    {activeContactCount > 0 ? 'Continue to trail preferences' : 'Continue without contacts'}
                  </Text>
                </Pressable>
              </AnimatedBlock>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={Boolean(draft)} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDraft(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{draft?.id ? 'Edit contact' : 'Add emergency contact'}</Text>
                <Text style={styles.sheetSubtitle}>Keep contact details reachable and current.</Text>
              </View>
              <Pressable style={styles.iconButton} onPress={() => setDraft(null)}>
                <Ionicons name="close" size={18} color="#2C2418" />
              </Pressable>
            </View>

            {draft ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <TextInput
                  value={draft.name}
                  onChangeText={(name) => setDraft((current) => current ? { ...current, name } : current)}
                  placeholder="Name"
                  placeholderTextColor="#A18F7A"
                  style={styles.input}
                />
                <TextInput
                  value={draft.phone}
                  onChangeText={(phone) => setDraft((current) => current ? { ...current, phone } : current)}
                  placeholder="Phone"
                  placeholderTextColor="#A18F7A"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                <TextInput
                  value={draft.email}
                  onChangeText={(email) => setDraft((current) => current ? { ...current, email } : current)}
                  placeholder="Email"
                  placeholderTextColor="#A18F7A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={draft.relationship}
                  onChangeText={(relationship) => setDraft((current) => current ? { ...current, relationship } : current)}
                  placeholder="Relationship"
                  placeholderTextColor="#A18F7A"
                  style={styles.input}
                />

                {[
                  ['notify_on_sos', 'Notify during SOS'],
                  ['notify_by_push', 'Push notification'],
                  ['notify_by_sms', 'SMS'],
                  ['notify_by_email', 'Email'],
                  ['is_active', 'Active'],
                ].map(([key, label]) => (
                  <View key={key} style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{label}</Text>
                    <Switch
                      value={Boolean(draft[key as keyof ContactDraft])}
                      onValueChange={(value) => setDraft((current) => current ? { ...current, [key]: value } : current)}
                      trackColor={{ true: '#D7BDA7', false: '#E5DDD2' }}
                      thumbColor={draft[key as keyof ContactDraft] ? '#630E13' : '#FFFFFF'}
                    />
                  </View>
                ))}

                <Pressable style={[styles.saveButton, isSavingContact && styles.disabledButton]} onPress={() => void handleSaveContact()} disabled={isSavingContact}>
                  {isSavingContact ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save contact</Text>}
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#2C2418', fontSize: 25, lineHeight: 30, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#7B6D5A', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  stepBadge: {
    minWidth: 54,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  stepBadgeText: { color: '#630E13', fontSize: 12, fontWeight: '900' },
  addButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#630E13', alignItems: 'center', justifyContent: 'center' },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#FFF6E8',
    borderWidth: 1,
    borderColor: '#F0DBC1',
    padding: 14,
    marginBottom: 14,
  },
  onboardingBannerCopy: { flex: 1 },
  onboardingBannerTitle: { color: '#2C2418', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  onboardingBannerText: { marginTop: 4, color: '#7B6D5A', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  stateBlock: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  errorBlock: { borderRadius: 18, backgroundColor: '#FFFDF8', padding: 18, alignItems: 'center' },
  errorText: { color: '#9B1C1C', fontSize: 13, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  retryButton: { marginTop: 12, borderRadius: 12, backgroundColor: '#630E13', paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  summaryBand: { flexDirection: 'row', borderRadius: 20, backgroundColor: '#3A070B', paddingVertical: 16, marginBottom: 14 },
  summaryItem: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  summaryValue: { color: '#FFF8EA', fontSize: 18, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  summaryLabel: { marginTop: 3, color: 'rgba(255,248,234,0.72)', fontSize: 10, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,248,234,0.22)' },
  section: { borderRadius: 22, backgroundColor: '#FFFDF8', padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sectionTitle: { color: '#2C2418', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  sectionSubtitle: { marginTop: 2, color: '#7B6D5A', fontSize: 11, lineHeight: 16, fontWeight: '700', maxWidth: 260 },
  textButton: { minHeight: 34, borderRadius: 17, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7EBE8' },
  textButtonLabel: { color: '#630E13', fontSize: 12, fontWeight: '900' },
  emptyBlock: { borderRadius: 18, padding: 20, alignItems: 'center', backgroundColor: '#F8F1E7' },
  emptyTitle: { marginTop: 8, color: '#2C2418', fontSize: 14, fontWeight: '900' },
  emptyText: { marginTop: 4, color: '#7B6D5A', fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDE5D6' },
  contactAvatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#D4A843', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: '#FFF8EA', fontSize: 17, fontWeight: '900' },
  contactBody: { flex: 1, minWidth: 0 },
  contactName: { color: '#2C2418', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  contactMeta: { marginTop: 2, color: '#7B6D5A', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  contactFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  flag: { overflow: 'hidden', borderRadius: 8, backgroundColor: '#F0EBE1', paddingHorizontal: 7, paddingVertical: 3, color: '#630E13', fontSize: 9, lineHeight: 11, fontWeight: '900' },
  contactActions: { alignItems: 'center', gap: 8 },
  iconActionRow: { flexDirection: 'row', gap: 6 },
  miniIconButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0EBE1', alignItems: 'center', justifyContent: 'center' },
  sosRow: { paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDE5D6' },
  sosTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusPill: { minHeight: 24, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  statusPillText: { fontSize: 10, lineHeight: 12, fontWeight: '900' },
  sosTime: { color: '#8A7A6A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  sosMessage: { marginTop: 8, color: '#2C2418', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  sosMeta: { marginTop: 4, color: '#7B6D5A', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sosNote: { marginTop: 6, color: '#8A4D1E', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sosActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallActionButton: { alignSelf: 'flex-start', minHeight: 32, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E6EEF7', marginTop: 10 },
  cancelActionButton: { backgroundColor: '#F9E2E1', marginTop: 0 },
  smallActionText: { color: '#315D8C', fontSize: 11, fontWeight: '900' },
  cancelActionText: { color: '#9B1C1C' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,36,24,0.34)' },
  sheet: { maxHeight: '88%', marginHorizontal: 12, borderRadius: 24, backgroundColor: '#FFFDF8', paddingHorizontal: 16, paddingTop: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sheetTitle: { color: '#2C2418', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sheetSubtitle: { marginTop: 2, color: '#7B6D5A', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  input: { minHeight: 46, borderRadius: 14, backgroundColor: '#F3F1ED', paddingHorizontal: 14, color: '#2C2418', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDE5D6' },
  toggleLabel: { flex: 1, color: '#2C2418', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  saveButton: { minHeight: 48, borderRadius: 16, backgroundColor: '#630E13', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  onboardingActions: { gap: 10, marginBottom: 8 },
  onboardingSecondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9C9B3',
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingSecondaryButtonText: { color: '#6B5D4E', fontSize: 14, fontWeight: '800' },
  onboardingPrimaryButton: {
    minHeight: 50,
    borderRadius: 17,
    backgroundColor: '#630E13',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  onboardingPrimaryButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '900', textAlign: 'center' },
});
