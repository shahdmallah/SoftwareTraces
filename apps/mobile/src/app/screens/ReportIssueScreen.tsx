import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { RootStackParamList } from '../navigation/types';
import { reportIncident, type IncidentType, type SafetySeverity } from '../api/safetyApi';
import { AnimatedScreen } from '../components/AnimatedUI';
import { useAuth } from '../contexts/AuthContext';

type ReportIssueNavigationProp = StackNavigationProp<RootStackParamList, 'ReportIssue'>;
type ReportIssueRouteProp = RouteProp<RootStackParamList, 'ReportIssue'>;

const incidentTypes: Array<{ value: IncidentType; label: string }> = [
  { value: 'settler_attack', label: 'Settler attack' },
  { value: 'road_block', label: 'Road blocked' },
  { value: 'military_checkpoint', label: 'Military checkpoint' },
  { value: 'flying_checkpoint', label: 'Flying checkpoint' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'land_confiscation', label: 'Land confiscation' },
  { value: 'tree_uprooting', label: 'Tree uprooting' },
  { value: 'settler_presence', label: 'Settler presence' },
  { value: 'military_raid', label: 'Military raid' },
  { value: 'other', label: 'Other' },
];

const severityLevels: Array<{ value: SafetySeverity; label: string }> = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function ReportIssueScreen() {
  const navigation = useNavigation<ReportIssueNavigationProp>();
  const route = useRoute<ReportIssueRouteProp>();
  const { isAuthenticated } = useAuth();
  const [incidentType, setIncidentType] = useState<IncidentType>('settler_presence');
  const [severity, setSeverity] = useState<SafetySeverity>('medium');
  const [latitude, setLatitude] = useState(route.params?.latitude != null ? String(route.params.latitude) : '');
  const [longitude, setLongitude] = useState(route.params?.longitude != null ? String(route.params.longitude) : '');
  const [locationName, setLocationName] = useState(route.params?.locationName ?? '');
  const [description, setDescription] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const useCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location required', 'Allow location access to auto-fill this report.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    } catch (error) {
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Please enter coordinates manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const submit = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      Alert.alert('Location needed', 'Add a valid latitude and longitude.');
      return;
    }

    setIsSubmitting(true);
    try {
      await reportIncident({
        incident_type: incidentType,
        severity,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        location_name: locationName.trim() || undefined,
        description: description.trim() || undefined,
      });
      Alert.alert('Incident reported', 'Other hikers nearby will be alerted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#2C2418" />
        </Pressable>
        <Text style={styles.title}>Report Incident</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>Incident type</Text>
          <View style={styles.chipRow}>
            {incidentTypes.map((item) => {
              const active = item.value === incidentType;
              return (
                <Pressable key={item.value} style={[styles.chip, active && styles.chipActive]} onPress={() => setIncidentType(item.value)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Severity</Text>
          <View style={styles.chipRow}>
            {severityLevels.map((item) => {
              const active = item.value === severity;
              return (
                <Pressable key={item.value} style={[styles.chip, active && styles.severityChipActive]} onPress={() => setSeverity(item.value)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.locationHeader}>
            <Text style={styles.label}>Location</Text>
            <Pressable style={styles.locationButton} onPress={() => void useCurrentLocation()} disabled={isLocating}>
              {isLocating ? <ActivityIndicator size="small" color="#630E13" /> : <Ionicons name="locate-outline" size={16} color="#630E13" />}
              <Text style={styles.locationButtonText}>Use current</Text>
            </Pressable>
          </View>
          <View style={styles.coordinateRow}>
            <TextInput value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="decimal-pad" style={styles.input} />
            <TextInput value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="decimal-pad" style={styles.input} />
          </View>
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Location name (optional)"
            placeholderTextColor="#9E8E80"
            style={styles.inputFull}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What happened? Add details that help others avoid danger."
            placeholderTextColor="#9E8E80"
            style={[styles.inputFull, styles.textarea]}
            multiline
          />
        </View>

        <Pressable style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={() => void submit()} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="warning-outline" size={18} color="#fff" />}
          <Text style={styles.submitButtonText}>{isSubmitting ? 'Submitting...' : 'Submit report'}</Text>
        </Pressable>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 14 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  content: { paddingBottom: 36, gap: 14 },
  section: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  label: { color: '#2C2418', fontSize: 13, fontWeight: '900', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F7F3E7', borderWidth: 1, borderColor: 'rgba(44,36,24,0.08)' },
  chipActive: { backgroundColor: '#630E13', borderColor: '#630E13' },
  severityChipActive: { backgroundColor: '#BB2823', borderColor: '#BB2823' },
  chipText: { color: '#4A4131', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#FFFFFF' },
  locationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F7EBE8' },
  locationButtonText: { color: '#630E13', fontSize: 12, fontWeight: '900' },
  coordinateRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FDFBF8',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.12)',
    color: '#2C2418',
  },
  inputFull: {
    marginTop: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FDFBF8',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.12)',
    color: '#2C2418',
  },
  textarea: { minHeight: 112, textAlignVertical: 'top' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: '#630E13',
  },
  submitButtonDisabled: { opacity: 0.72 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
