import React from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { register } from "../../shared/services/api/client";
import { useAuthStore } from "../store/authStore";

interface SignUpValues {
  email: string;
  username: string;
  password: string;
  fullName: string;
}

export default function SignUpScreen(): JSX.Element {
  const setSession = useAuthStore((state) => state.setSession);
  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    defaultValues: { email: "", username: "", password: "", fullName: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await register(values);
      await setSession(session);
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Please try again.");
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your hiking profile</Text>
      <Controller control={control} name="fullName" render={({ field: { onChange, value } }) => <TextInput style={styles.input} placeholder="Full name" onChangeText={onChange} value={value} />} />
      <Controller control={control} name="username" render={({ field: { onChange, value } }) => <TextInput style={styles.input} placeholder="Username" onChangeText={onChange} value={value} autoCapitalize="none" />} />
      <Controller control={control} name="email" render={({ field: { onChange, value } }) => <TextInput style={styles.input} placeholder="Email" onChangeText={onChange} value={value} autoCapitalize="none" />} />
      <Controller control={control} name="password" render={({ field: { onChange, value } }) => <TextInput style={styles.input} placeholder="Password" onChangeText={onChange} value={value} secureTextEntry />} />
      <Button title={formState.isSubmitting ? "Creating..." : "Create Account"} onPress={() => void onSubmit()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 14 }
});
