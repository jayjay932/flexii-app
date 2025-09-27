// src/screens/AuthSheet.tsx
import React, { useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AuthSheet">;
type Mode = "signin" | "signup";
type ToastKind = "success" | "error" | "info";

export default function AuthSheet({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>("signin");

  // Champs communs
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);

  // Champs signup
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [errField, setErrField] = useState<string | null>(null);

  // ------- Mini toast (sans dépendance) -------
  const [toast, setToast] = useState<{ kind: ToastKind; msg: string } | null>(
    null
  );
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
    }, 2200);
  };

  // ------- Helpers email -------
  const normalizeEmail = (raw: string) =>
    raw.trim().toLowerCase().replace(/\s+/g, ""); // retire espaces internes/fin/début

  // Regex simple et suffisante pour la majorité des cas
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // ------- Validation -------
  const validate = () => {
    const e = normalizeEmail(email);
    if (!e) return "Email requis";
    if (!isValidEmail(e)) return "Format d’email invalide";
    if (!pwd.trim()) return "Mot de passe requis";
    if (mode === "signup") {
      if (!fullName.trim()) return "Nom complet requis";
      if (!phone.trim()) return "Téléphone requis";
    }
    return null;
  };

  // ------- Mapping d’erreurs Supabase -> message sympa -------
  const prettyError = (raw?: string) => {
    const m = (raw || "").toLowerCase();
    if (m.includes("invalid login credentials"))
      return "Email ou mot de passe incorrect.";
    if (m.includes("email not confirmed") || m.includes("email not verified"))
      return "Votre email n’est pas encore vérifié. Ouvrez le lien reçu par email.";
    if (m.includes("user already registered"))
      return "Cet email est déjà utilisé.";
    if (m.includes("password should be at least"))
      return "Mot de passe trop court.";
    if (m.includes("rate limit"))
      return "Trop de tentatives. Réessayez dans un instant.";
    if (m.includes("unable to validate email") || m.includes("invalid format"))
      return "Format d’adresse email invalide.";
    return raw || "Une erreur est survenue.";
  };

  const onSubmit = async () => {
    setErrField(null);
    const v = validate();
    if (v) {
      setErrField(v);
      showToast("error", v);
      return;
    }

    const cleanEmail = normalizeEmail(email);

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pwd,
        });
        if (error) throw error;

        showToast("success", "Connexion réussie ✓");
        setTimeout(() => navigation.goBack(), 600);
      } else {
        // --- SIGNUP ---
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: pwd,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              avatar_url: null,
            },
            // emailRedirectTo: "https://ton-domaine/finish-signup", // si besoin
          },
        });
        if (error) throw error;

        // Si pas de session (email confirmation activée), on tente un sign-in,
        // sinon on affiche un message d'info.
        if (!data.session) {
          const { error: e2 } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: pwd,
          });
          if (e2) {
            showToast(
              "info",
              "Compte créé. Vérifiez votre email pour activer le compte."
            );
            setMode("signin");
            setLoading(false);
            return;
          }
        }

        showToast("success", "Compte créé avec succès 🎉");
        setTimeout(() => navigation.goBack(), 700);
      }
    } catch (e: any) {
      const msg = prettyError(e?.message);
      setErrField(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setErrField(null);
    setMode((m) => (m === "signin" ? "signup" : "signin"));
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Close (X) */}
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

          {/* Card */}
          <View style={styles.card}>
            {mode === "signup" && (
              <>
                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder="Nom complet"
                    placeholderTextColor="#c9c9c9"
                    autoCapitalize="words"
                    value={fullName}
                    onChangeText={setFullName}
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputWrap, { marginTop: 14 }]}>
                  <TextInput
                    placeholder="Téléphone"
                    placeholderTextColor="#c9c9c9"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    style={styles.input}
                  />
                </View>
              </>
            )}

            <View
              style={[styles.inputWrap, { marginTop: mode === "signup" ? 14 : 0 }]}
            >
              <TextInput
                placeholder="Email"
                placeholderTextColor="#c9c9c9"
                autoCapitalize="none"
                autoCorrect={false}              // 👈 important pour éviter espaces/auto-correct
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
            </View>

            <View style={[styles.inputWrap, { marginTop: 14 }]}>
              <TextInput
                placeholder="Mot de passe"
                placeholderTextColor="#c9c9c9"
                secureTextEntry={!pwdVisible}
                textContentType="password"
                value={pwd}
                onChangeText={setPwd}
                style={[styles.input, { paddingRight: 42 }]}
              />
              <TouchableOpacity
                onPress={() => setPwdVisible((v) => !v)}
                style={styles.eyeBtn}
                accessibilityLabel={
                  pwdVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
              >
                <Ionicons
                  name={pwdVisible ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {!!errField && <Text style={styles.error}>{errField}</Text>}

            <TouchableOpacity
              style={[styles.cta, loading && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={styles.ctaText}>
                {loading
                  ? "Veuillez patienter…"
                  : mode === "signin"
                  ? "Se connecter"
                  : "Créer mon compte"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Switch line */}
          <View style={{ alignItems: "center", marginTop: 22 }}>
            <Text style={styles.gray}>
              {mode === "signin"
                ? "Vous n'avez pas de compte ?"
                : "Vous avez déjà un compte ?"}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleMode} style={{ marginTop: 8 }}>
            <Text style={styles.link}>
              {mode === "signin" ? "Créer un compte" : "Se connecter"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const R = 22; // rayon pour coller à la maquette

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
  gray: { color: "#8a8a8a", fontSize: 15 },
  link: { fontSize: 20, fontWeight: "800", color: "#111", textAlign: "center" },
  error: { color: "#c0392b", marginTop: 10, textAlign: "center" },

  // Toast styles
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
  toastText: { color: "#111", fontWeight: "700", textAlign: "center" },
  toastSuccess: { backgroundColor: "#d1fae5" }, // vert doux
  toastError: { backgroundColor: "#fee2e2" }, // rouge doux
  toastInfo: { backgroundColor: "#e5e7eb" }, // gris
});
