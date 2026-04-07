import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

interface StatCardProps {
  label: string;
  value: string;
}

export function StatCard({ label, value }: StatCardProps): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.mist,
    borderRadius: 16,
    padding: spacing.md,
    minWidth: 120
  },
  value: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  label: {
    color: colors.olive,
    marginTop: spacing.xs
  }
});
