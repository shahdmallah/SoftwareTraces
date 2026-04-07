import React from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { login } from "../../shared/services/api/client";
import { useAuthStore } from "../store/authStore";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen(): JSX.Element {
  const navigation = useNavigation();
  const setSession = useAuthStore((state) => state.setSession);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await login(values);
      await setSession(session);
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Please try again.");
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traces</Text>
      <Controller control={control} name="email" render={({ field: { onChange, value } }) => <TextInput style={styles.input} placeholder="Email" onChangeText={onChange} value={value} autoCapitalize="none" />} />
      <Controller control={control} name="password" render={({ field: { onChange, value } }) => <TextInput style={styles.input} placeholder="Password" onChangeText={onChange} value={value} secureTextEntry />} />
      <Button title={formState.isSubmitting ? "Signing in..." : "Sign In"} onPress={() => void onSubmit()} />
      <Button title="Create account" onPress={() => navigation.navigate("SignUp" as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 36, fontWeight: "700", textAlign: "center" },
  input: { backgroundColor: "white", borderRadius: 12, padding: 14 }
});
