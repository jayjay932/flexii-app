// src/screens/DeleteAccountScreen.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  Modal,
  Pressable,
  AccessibilityInfo,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons, { IconName } from '@/src/ui/Icon';;
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/src/lib/supabase";

/** ========= CONFIG ========= */
const EDGE_DELETE_URL =
  "https://qilklozxaubrokidfeyl.supabase.co/functions/v1/delete-account";
const DELETE_INFO_URL = "https://www.flexiihouse.com/delete-account";

const DELETION_WINDOW_LABEL =
  "La suppression complète est engagée immédiatement. Certaines traces minimales peuvent persister uniquement le temps légal nécessaire (ex. obligations comptables), puis être purgées automatiquement (sauvegardes par rotation).";

const DEBUG_MODE = true;

export default function DeleteAccountScreen() {
  const nav = useNavigation<any>();
  const [ackChecked, setAckChecked] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Vérifier l'authentification au montage
  React.useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (DEBUG_MODE) {
        console.log("🔐 Auth check on mount:", {
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
          email: data?.session?.user?.email,
          error: error?.message,
        });
      }

      if (error || !data?.session) {
        Alert.alert(
          "Non connecté",
          "Vous devez être connecté pour supprimer votre compte.",
          [
            {
              text: "OK",
              onPress: () => nav.goBack(),
            },
          ]
        );
        return;
      }
    } catch (e) {
      console.error("❌ Auth check error:", e);
      Alert.alert(
        "Erreur",
        "Impossible de vérifier votre session. Réessayez.",
        [{ text: "OK", onPress: () => nav.goBack() }]
      );
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const canContinue = useMemo(
    () => ackChecked && confirmText.trim().toUpperCase() === "SUPPRIMER",
    [ackChecked, confirmText]
  );

  const disableReason = useMemo(() => {
    if (!ackChecked && confirmText.trim().length === 0) {
      return "Cochez la case et saisissez SUPPRIMER pour activer le bouton.";
    }
    if (!ackChecked) return "Cochez la case de compréhension pour continuer.";
    if (confirmText.trim().toUpperCase() !== "SUPPRIMER")
      return 'Tapez exactement "SUPPRIMER" pour confirmer.';
    return null;
  }, [ackChecked, confirmText]);

  const openConfirmModal = () => {
    if (!canContinue) {
      if (disableReason) {
        AccessibilityInfo.announceForAccessibility?.(disableReason);
      }
      return;
    }
    setConfirmModal(true);
  };

  const actuallyDelete = async () => {
    try {
      setConfirmModal(false);
      setLoading(true);

      // 1) Forcer le refresh de la session
      if (DEBUG_MODE) {
        console.log("🔄 Refreshing session...");
      }

      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();

      if (DEBUG_MODE) {
        console.log("🔄 Refresh result:", {
          hasSession: !!refreshData?.session,
          error: refreshError?.message,
        });
      }

      // 2) Récupérer le token de session
      const { data, error } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (DEBUG_MODE) {
        console.log("🔍 DEBUG - Session data:", {
          hasSession: !!data?.session,
          hasToken: !!token,
          userId: data?.session?.user?.id,
          email: data?.session?.user?.email,
          error: error?.message,
        });
      }

      if (error || !token) {
        setLoading(false);
        Alert.alert(
          "Session expirée",
          "Votre session n'est plus valide. Veuillez vous reconnecter.",
          [{ text: "OK" }]
        );
        return;
      }

      if (DEBUG_MODE) {
        console.log("🚀 Calling Edge Function:", EDGE_DELETE_URL);
        console.log("📝 Token (first 20 chars):", token.substring(0, 20) + "...");
      }

      // 3) Appeler l'Edge Function de suppression
      const res = await fetch(EDGE_DELETE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (DEBUG_MODE) {
        console.log("📡 Response status:", res.status);
        console.log("📡 Response ok:", res.ok);
      }

      // 4) Parser la réponse
      let body: any = {};
      const responseText = await res.text();

      if (DEBUG_MODE) {
        console.log("📥 Raw response:", responseText);
      }

      try {
        body = JSON.parse(responseText);
        if (DEBUG_MODE) {
          console.log("📦 Parsed body:", JSON.stringify(body, null, 2));
        }
      } catch (parseError) {
        if (DEBUG_MODE) {
          console.error("❌ JSON parse error:", parseError);
        }
      }

      // 5) Gérer les différents codes de statut
      if (res.ok || res.status === 202) {
        // Succès - Déconnecter et rediriger
        await supabase.auth.signOut();
        setLoading(false);

        Alert.alert(
          "Compte supprimé",
          "Votre compte a été supprimé avec succès. Vos données personnelles ont été anonymisées et votre accès est définitivement révoqué.",
          [
            {
              text: "OK",
              onPress: () =>
                nav.reset({
                  index: 0,
                  routes: [{ name: "Welcome" }],
                }),
            },
          ]
        );
      } else if (res.status === 401) {
        // Token invalide
        setLoading(false);
        Alert.alert(
          "Session expirée",
          "Votre session n'est plus valide. Veuillez vous reconnecter et réessayer."
        );
      } else if (res.status === 409) {
        // Conflit (réservations actives, etc.)
        setLoading(false);
        Alert.alert(
          "Action impossible",
          body?.error ||
            body?.details ||
            "Une opération en cours empêche la suppression (ex. réservation active). Terminez-la avant de recommencer."
        );
      } else {
        // Autre erreur
        setLoading(false);
        console.error("❌ Deletion error:", { status: res.status, body });
        Alert.alert(
          "Erreur",
          body?.error ||
            body?.details ||
            `La suppression a échoué (code ${res.status}). Réessayez plus tard ou contactez le support.`
        );
      }
    } catch (e: any) {
      setLoading(false);
      console.error("❌ Deletion exception:", e);
      Alert.alert(
        "Erreur réseau",
        e?.message ||
          "Impossible de contacter le serveur. Vérifiez votre connexion."
      );
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {isCheckingAuth ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#E11D48" />
          <Text style={{ marginTop: 12, color: "#666", fontSize: 14 }}>
            Vérification de votre session...
          </Text>
        </View>
      ) : (
        <>
          {/* ========== HEADER ========== */}
          <View style={header.container}>
            <TouchableOpacity
              onPress={() => nav.goBack()}
              style={header.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Revenir en arrière"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color="#111" />
            </TouchableOpacity>
            <Text
              style={header.title}
              accessibilityRole="header"
              numberOfLines={1}
            >
              Supprimer mon compte
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* ========== CONTENU SCROLLABLE ========== */}
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <H2>Ce que cette action fait</H2>
              <List
                items={[
                  "Suppression initiée et finalisée ici. Aucun appel ni e-mail au support requis.",
                  "Compte désactivé immédiatement et reconnexion bloquée.",
                  "Données personnelles (nom, e-mail, téléphone, avatar) supprimées ou anonymisées.",
                  "Sessions et tokens révoqués automatiquement.",
                ]}
              />

              <H2 style={{ marginTop: 16 }}>
                Ce qui peut être conservé temporairement
              </H2>
              <List
                items={[
                  "Éléments strictement nécessaires si la loi l'exige (obligations comptables, prévention fraude).",
                  "Données minimisées et pseudonymisées, jamais utilisées à des fins marketing.",
                  "Sauvegardes purgées automatiquement par rotation.",
                ]}
              />

              <H2 style={{ marginTop: 16 }}>Délais & informations</H2>
              <P>{DELETION_WINDOW_LABEL}</P>
              <Link label="En savoir plus" href={DELETE_INFO_URL} />
            </Card>

            <Card>
              <H2>Confirmer la suppression</H2>
              <CheckRow
                checked={ackChecked}
                onPress={() => setAckChecked((v) => !v)}
                label="J'ai lu et compris les conséquences. Cette action est définitive."
              />

              <Text
                style={styles.label}
                accessibilityLabel="Veuillez saisir SUPPRIMER pour confirmer"
              >
                Saisissez "SUPPRIMER" pour confirmer :
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="SUPPRIMER"
                autoCapitalize="characters"
                style={styles.input}
                accessibilityLabel="Champ de confirmation"
                editable={!loading}
              />
            </Card>

            {/* Espace pour la barre sticky */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* ========== BARRE STICKY AVEC CTA ========== */}
          <View style={sticky.wrap} accessibilityRole="summary">
            {disableReason ? (
              <Text style={sticky.hint}>{disableReason}</Text>
            ) : (
              <Text style={sticky.hintOK}>Prêt à supprimer votre compte</Text>
            )}

            <TouchableOpacity
              onPress={openConfirmModal}
              disabled={!canContinue || loading}
              activeOpacity={0.9}
              style={[
                sticky.cta,
                (!canContinue || loading) && sticky.ctaDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Supprimer mon compte définitivement"
              accessibilityState={{ disabled: !canContinue || loading }}
              testID="delete-account-cta"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={sticky.ctaTxt}>Supprimer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ========== MODAL DE CONFIRMATION FINALE ========== */}
          <Modal
            visible={confirmModal}
            transparent
            animationType="fade"
            onRequestClose={() => !loading && setConfirmModal(false)}
          >
            <Pressable
              style={modal.overlay}
              onPress={() => !loading && setConfirmModal(false)}
              accessibilityLabel="Fermer la confirmation"
              accessibilityRole="button"
              disabled={loading}
            >
              <Pressable
                style={modal.card}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={modal.title} accessibilityRole="header">
                  Confirmer la suppression ?
                </Text>
                <Text style={modal.p}>
                  • Désactivation immédiate{"\n"}
                  • Impossibilité de se reconnecter{"\n"}
                  • Données personnelles anonymisées{"\n"}
                  • Action irréversible
                </Text>

                <View style={modal.row}>
                  <TouchableOpacity
                    onPress={() => setConfirmModal(false)}
                    style={[modal.btn, modal.btnCancel]}
                    accessibilityRole="button"
                    accessibilityLabel="Annuler"
                    disabled={loading}
                  >
                    <Text style={[modal.btnTxt, { color: "#111" }]}>
                      Annuler
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={actuallyDelete}
                    style={[modal.btn, modal.btnDelete]}
                    accessibilityRole="button"
                    accessibilityLabel="Confirmer la suppression"
                    testID="confirm-delete"
                    disabled={loading}
                  >
                    <Text style={[modal.btnTxt, { color: "#fff" }]}>
                      Oui, supprimer
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANTS UI
   ═══════════════════════════════════════════════════════════ */

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function H2({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Text style={[styles.h2, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function List({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {items.map((text, i) => (
        <View key={i} style={styles.liRow}>
          <Text style={styles.liDot}>•</Text>
          <Text style={styles.p}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

function Link({ label, href }: { label: string; href: string }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(href)}
      style={{ marginTop: 12 }}
      accessibilityRole="link"
    >
      <Text style={styles.link}>{label} →</Text>
    </TouchableOpacity>
  );
}

function CheckRow({
  checked,
  onPress,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */

const header = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  body: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  h2: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  p: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  liRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  liDot: {
    color: "#888",
    fontSize: 16,
    lineHeight: 20,
  },
  link: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 14,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    color: "#111",
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: "#222",
    lineHeight: 20,
  },
});

const sticky = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.select({ ios: 20, android: 16 }),
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  hint: {
    color: "#E11D48",
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "500",
  },
  hintOK: {
    color: "#10B981",
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "500",
  },
  cta: {
    backgroundColor: "#E11D48",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },
  p: {
    color: "#444",
    lineHeight: 22,
    fontSize: 14,
  },
  row: {
    marginTop: 24,
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 100,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: "#f5f5f5",
  },
  btnDelete: {
    backgroundColor: "#E11D48",
  },
  btnTxt: {
    fontWeight: "700",
    fontSize: 15,
  },
});