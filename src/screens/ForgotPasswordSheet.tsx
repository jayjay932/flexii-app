// src/screens/ResetPasswordSheet.tsx
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons, { IconName } from '@/src/ui/Icon';;

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPasswordSheet">;
type ToastKind = "success" | "error" | "info";

const SUPABASE_URL = "https://qilklozxaubrokidfeyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbGtsb3p4YXVicm9raWRmZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTQ4NzIsImV4cCI6MjA3Mzk3MDg3Mn0.VrN3fl-9lzqWjF0jfmoa68XxMF_Y7MPk1TocHQA-tcw";

export default function ForgotPasswordSheet({ navigation }: Props) {
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errField, setErrField] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ kind: ToastKind; msg: string } | null>(null);
  const toastY = useRef(new Animated.Value(60)).current;

  const showToast = (kind: ToastKind, msg: string) => {
    setToast({ kind, msg });
    Animated.spring(toastY, { toValue: 0, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastY, {
        toValue: 60,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 2500);
  };

  const normalizeEmail = (raw: string) =>
    raw.trim().toLowerCase().replace(/\s+/g, "");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const checkEmailExists = async () => {
    const cleanEmail = normalizeEmail(email);
    
    if (!cleanEmail) {
      setErrField("Email requis");
      showToast("error", "Email requis");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrField("Format d'email invalide");
      showToast("error", "Format d'email invalide");
      return;
    }

    setLoading(true);
    setErrField(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/user-lookup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: cleanEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur lors de la vérification");
      }

      if (!data.exists) {
        setErrField("Aucun compte trouvé avec cet email");
        showToast("error", "Aucun compte trouvé avec cet email");
        return;
      }

      // Email existe, passer à l'étape suivante
      showToast("success", "Email vérifié ✓");
      setTimeout(() => setStep("password"), 500);

    } catch (e: any) {
      const msg = e?.message || "Erreur de connexion";
      setErrField(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword.trim()) {
      setErrField("Nouveau mot de passe requis");
      showToast("error", "Nouveau mot de passe requis");
      return;
    }

    if (newPassword.length < 6) {
      setErrField("Le mot de passe doit faire au moins 6 caractères");
      showToast("error", "Mot de passe trop court (min. 6 caractères)");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrField("Les mots de passe ne correspondent pas");
      showToast("error", "Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    setErrField(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: normalizeEmail(email),
            newPassword: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur lors de la réinitialisation");
      }

      showToast("success", "Mot de passe réinitialisé avec succès 🎉");
      setTimeout(() => navigation.goBack(), 1000);

    } catch (e: any) {
      const msg = e?.message || "Erreur de connexion";
      setErrField(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Close button */}
      <TouchableOpacity
        accessibilityLabel="Fermer"
        onPress={() => navigation.goBack()}
        style={styles.closeBtn}
        hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
      >
        <Ionicons name="close" size={22} color="#111" />
      </TouchableOpacity>

      {/* Toast */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.kind === "success" && styles.toastSuccess,
            toast.kind === "error" && styles.toastError,
            toast.kind === "info" && styles.toastInfo,
            { transform: [{ translateY: toastY }] },
          ]}
        >
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          {/* Logo/Title */}
          <Text style={styles.brand}>FLEXIII</Text>
          <Text style={styles.subtitle}>Réinitialiser le mot de passe</Text>

          {/* Card */}
          <View style={styles.card}>
            {step === "email" ? (
              <>
                <Text style={styles.instruction}>
                  Entrez votre adresse email pour réinitialiser votre mot de passe
                </Text>

                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder="Email"
                    placeholderTextColor="#c9c9c9"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                  />
                </View>

                {!!errField && <Text style={styles.error}>{errField}</Text>}

                <TouchableOpacity
                  style={[styles.cta, loading && { opacity: 0.6 }]}
                  onPress={checkEmailExists}
                  disabled={loading}
                >
                  <Text style={styles.ctaText}>
                    {loading ? "Vérification…" : "Continuer"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.instruction}>
                  Choisissez un nouveau mot de passe pour {email}
                </Text>

                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="#c9c9c9"
                    secureTextEntry={!pwdVisible}
                    textContentType="newPassword"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    style={[styles.input, { paddingRight: 42 }]}
                  />
                  <TouchableOpacity
                    onPress={() => setPwdVisible((v) => !v)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={pwdVisible ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputWrap, { marginTop: 14 }]}>
                  <TextInput
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor="#c9c9c9"
                    secureTextEntry={!pwdVisible}
                    textContentType="newPassword"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.input}
                  />
                </View>

                {!!errField && <Text style={styles.error}>{errField}</Text>}

                <TouchableOpacity
                  style={[styles.cta, loading && { opacity: 0.6 }]}
                  onPress={resetPassword}
                  disabled={loading}
                >
                  <Text style={styles.ctaText}>
                    {loading ? "Mise à jour…" : "Réinitialiser"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setStep("email");
                    setNewPassword("");
                    setConfirmPassword("");
                    setErrField(null);
                  }}
                  style={{ marginTop: 12 }}
                >
                  <Text style={styles.backLink}>← Changer d'email</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const R = 22;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 18,
    top: 14,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 60,
  },
  brand: {
    fontSize: 42,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 26,
  },
  card: {
    width: "100%",
    backgroundColor: "#f7f7f7",
    borderRadius: 28,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  instruction: {
    fontSize: 15,
    color: "#666",
    marginBottom: 18,
    textAlign: "center",
    lineHeight: 22,
  },
  inputWrap: {
    backgroundColor: "#fff",
    borderRadius: R,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 16,
    height: 56,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    color: "#111",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    height: 56,
    justifyContent: "center",
  },
  cta: {
    backgroundColor: "#111",
    borderRadius: R,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },
  backLink: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
  },
  error: {
    color: "#c0392b",
    marginTop: 10,
    textAlign: "center",
  },
  toast: {
    position: "absolute",
    top: 60,
    left: 18,
    right: 18,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  toastText: {
    color: "#111",
    fontWeight: "700",
    textAlign: "center",
  },
  toastSuccess: { backgroundColor: "#d1fae5" },
  toastError: { backgroundColor: "#fee2e2" },
  toastInfo: { backgroundColor: "#e5e7eb" },
});