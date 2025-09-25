// src/screens/OwnerReservationDetailsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, ImageBackground, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "OwnerReservationDetails">;

type ListingPics = { image_url: string | null }[];

type Row = {
  id: string;
  created_at: string;
  confirmed_at?: string | null;
  start_date: string;
  end_date: string;
  status: string; // on normalise en runtime
  total_price: number;
  currency: string | null;

  logement_id: string | null;
  vehicule_id: string | null;
  experience_id: string | null;

  reservation_code: string | null;
  espece_confirmation: boolean | null;
  price_espece: number | string | null; // <- peut arriver en string

  user_id: string | null;
  users?: { full_name: string | null; email: string | null; phone: string | null; avatar_url?: string | null } | null;

  listings_logements?: {
    title: string; city: string; quartier?: string | null; adresse?: string | null;
    listing_images?: ListingPics;
  } | null;
  listings_vehicules?: {
    marque: string; modele: string; city: string | null; listing_images?: ListingPics;
  } | null;
  listings_experiences?: { title: string; city: string | null; listing_images?: ListingPics } | null;
};

type Txn = {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded" | string;
  amount: number;
  created_at: string;
  payment_method?: string | null;
};

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur as any }).format(Number(n || 0));

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

function useCountdown(deadlineISO?: string) {
  const [left, setLeft] = useState<number>(0);
  useEffect(() => {
    if (!deadlineISO) return;
    const tick = () => setLeft(Math.max(0, new Date(deadlineISO).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineISO]);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return { h, m, s, done: left <= 0 };
}

export default function OwnerReservationDetailsScreen({ route, navigation }: Props) {
  const { id } = route.params;

  const [row, setRow] = useState<Row | null>(null);
  const [txn, setTxn] = useState<Txn | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id, created_at, confirmed_at, start_date, end_date, status, total_price, currency,
          logement_id, vehicule_id, experience_id, reservation_code,
          espece_confirmation, price_espece, user_id,
          users:user_id ( full_name, email, phone, avatar_url ),
          listings_logements:logement_id ( title, city, quartier, adresse:adresse, listing_images ( image_url ) ),
          listings_vehicules:vehicule_id ( marque, modele, city, listing_images ( image_url ) ),
          listings_experiences:experience_id ( title, city, listing_images ( image_url ) )
        `)
        .eq("id", id)
        .maybeSingle<Row>();
      if (error) throw error;
      setRow(data ?? null);

      const txnq = await supabase
        .from("transactions")
        .select("id, status, amount, created_at, payment_method")
        .eq("reservation_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<Txn>();
      if (txnq.error && (txnq as any).error?.code !== "PGRST116") throw txnq.error;
      setTxn(txnq.data ?? null);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger la réservation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase
      .channel("owner-res-details-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `id=eq.${id}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `reservation_id=eq.${id}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const cur = row?.currency ?? "XOF";
  const kind = row?.logement_id ? "logement" : row?.vehicule_id ? "vehicule" : "experience";
  const pics =
    kind === "logement"
      ? row?.listings_logements?.listing_images
      : kind === "vehicule"
      ? row?.listings_vehicules?.listing_images
      : row?.listings_experiences?.listing_images;
  const cover = pics?.[0]?.image_url || undefined;

  const title =
    kind === "vehicule"
      ? `${row?.listings_vehicules?.marque ?? ""} ${row?.listings_vehicules?.modele ?? ""}`.trim() || "Véhicule"
      : (kind === "logement" ? row?.listings_logements?.title : row?.listings_experiences?.title) || "Annonce";

  const city =
    (kind === "logement" ? row?.listings_logements?.city :
     kind === "vehicule" ? row?.listings_vehicules?.city :
     row?.listings_experiences?.city) || "—";

  // ===== Conditions =====
  const statusNorm = (row?.status || "").toLowerCase().trim();
  const isConfirmed = statusNorm === "confirmed" || statusNorm === "completed";
  const txnPaid = txn?.status === "paid";

  // montant espèces dû (coerce -> number)
  const priceEspece = Number(row?.price_espece || 0);
  const cashDue = priceEspece > 0;

  // Coordonnées visibles si confirmé + txn paid (règle business)
  const showClientInfo = !!row && isConfirmed && txnPaid;

  // Fenêtre d’annulation : 24h après confirmation (fallback created_at)
  const baseISO = row?.confirmed_at ?? row?.created_at;
  const cancelDeadlineISO = baseISO
    ? new Date(new Date(baseISO).getTime() + 24 * 3600 * 1000).toISOString()
    : undefined;
  const { h, m, s, done } = useCountdown(cancelDeadlineISO);

  // 🔑 Boutons
  const canConfirmReservation = statusNorm === "pending";
  // 👉 EXIGENCES : confirmé + price_espece > 0 + pas déjà confirmé — INDÉPENDANT de txnPaid
 // Avant
// const canConfirmCash = isConfirmed && cashDue && !row?.espece_confirmation;

// Après
const canConfirmCash = isConfirmed && !row?.espece_confirmation;
  // Annuler interdit si txn paid OU espèces confirmées OU délai fini
  const canCancel = isConfirmed && !done && !txnPaid && !row?.espece_confirmation;

  const onConfirmReservation = async () => {
    if (!row) return;
    try {
      setMutating(true);
      const { error } = await supabase
        .from("reservations")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      await fetchData();
      Alert.alert("Réservation confirmée");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de confirmer.");
    } finally {
      setMutating(false);
    }
  };

  // ✅ Ne fait qu'une chose: passer espece_confirmation = true
  const onConfirmCash = async () => {
    if (!row) return;
    Alert.alert(
      "Confirmer paiement en espèces",
      "Cette action marque uniquement l'espèce comme confirmée (ne change pas la transaction).",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "destructive",
          onPress: async () => {
            try {
              setMutating(true);
              const { error } = await supabase
                .from("reservations")
                .update({ espece_confirmation: true })
                .eq("id", row.id);
              if (error) throw error;
              await fetchData();
              Alert.alert("Paiement (espèces) confirmé ✓");
            } catch (e) {
              console.error(e);
              Alert.alert("Erreur", "Impossible d’enregistrer.");
            } finally {
              setMutating(false);
            }
          },
        },
      ]
    );
  };

  const onCancel = async () => {
    if (!row || !canCancel) return;
    Alert.alert("Annuler la réservation ?", "Cette action est définitive.", [
      { text: "Non", style: "cancel" },
      {
        text: "Oui, annuler",
        style: "destructive",
        onPress: async () => {
          try {
            setMutating(true);
            const { error } = await supabase
              .from("reservations")
              .update({ status: "cancelled" })
              .eq("id", row.id);
            if (error) throw error;
            await fetchData();
            Alert.alert("Réservation annulée");
          } catch (e) {
            console.error(e);
            Alert.alert("Erreur", "Impossible d’annuler.");
          } finally {
            setMutating(false);
          }
        },
      },
    ]);
  };

  if (loading || !row) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const statusLabel =
    statusNorm === "confirmed" ? "Confirmée"
    : statusNorm === "pending" ? "En attente"
    : statusNorm === "cancelled" ? "Annulée"
    : "Terminée";

  const code = row.reservation_code || row.id.slice(0, 8).toUpperCase();

  // Affichage paiement
  const paymentLabel = txnPaid
    ? (cashDue && !row.espece_confirmation ? "Payé (in-app) · espèces à confirmer" : "Payé")
    : row.espece_confirmation
    ? "Espèces confirmées"
    : (txn?.status ?? "—");

  const showCountdown = canCancel;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerCity}>{city}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.topCard}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{fmtShort(row.start_date)} – {fmtShort(row.end_date)}</Text>

            {/* Statuts */}
            <View style={styles.pillRow}>
              <View style={styles.pill}><Text style={styles.pillTxt}>{statusLabel}</Text></View>
              <View style={styles.pill}><Text style={styles.pillTxt}>Paiement : {paymentLabel}</Text></View>
            </View>

            {/* Code de réservation */}
            <View style={styles.codeRow}>
              <Ionicons name="ticket-outline" size={18} color="#555" />
              <Text style={styles.codeLabel}>Code réservation</Text>
              <View style={styles.codePill}>
                <Text style={styles.codeTxt}>{code}</Text>
              </View>
            </View>

            {cover ? (
              <ImageBackground source={{ uri: cover }} style={styles.hero} imageStyle={{ borderRadius: 14 }} />
            ) : (
              <View style={[styles.hero, { backgroundColor: "#efefef" }]} />
            )}
          </View>

          {/* Client */}
          <View style={styles.clientCard}>
            <Text style={styles.sectionTitle}>Client</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <Image
                source={
                  row.users?.avatar_url
                    ? { uri: row.users.avatar_url }
                    : require("../../assets/images/logement.jpg")
                }
                style={styles.clientAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{row.users?.full_name ?? "—"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Ionicons name="mail-outline" size={16} color="#666" />
                  {showClientInfo ? (
                    <Text style={styles.contactTxt}>{row.users?.email ?? "—"}</Text>
                  ) : (
                    <View style={styles.blurBox}><Text style={styles.blurTxt}>Email visible après confirmation & paiement</Text></View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <Ionicons name="call-outline" size={16} color="#666" />
                  {showClientInfo ? (
                    <Text style={styles.contactTxt}>{row.users?.phone ?? "—"}</Text>
                  ) : (
                    <View style={styles.blurBox}><Text style={styles.blurTxt}>Téléphone visible après confirmation & paiement</Text></View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Compteur / infos annulation */}
          {txnPaid || row.espece_confirmation ? (
            <View style={styles.infoPill}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#2a7" />
              <Text style={styles.infoPillTxt}>
                {txnPaid ? "Paiement confirmé — annulation indisponible" : "Paiement (espèces) confirmé — annulation indisponible"}
              </Text>
            </View>
          ) : showCountdown ? (
            <View style={styles.countdownPill}>
              <Text style={styles.countdownLabel}>Il vous reste</Text>
              <Text style={styles.countdownTxt}>
                {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
              </Text>
              <Text style={styles.countdownLabel}>pour annuler</Text>
            </View>
          ) : (
            <View style={styles.infoPill}>
              <Ionicons name="time-outline" size={16} color="#777" />
              <Text style={styles.infoPillTxt}>Délai d’annulation expiré</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.secondaryBtn, (!canCancel || mutating) && { opacity: 0.35 }]}
              disabled={!canCancel || mutating}
              activeOpacity={0.9}
            >
              <Ionicons name="close-circle" size={18} color="#111" />
              <Text style={styles.secondaryTxt}>Annuler</Text>
            </TouchableOpacity>

            {canConfirmReservation ? (
              <TouchableOpacity
                onPress={onConfirmReservation}
                style={[styles.primaryBtn, mutating && { opacity: 0.5 }]}
                disabled={mutating}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryTxt}>Confirmer la réservation</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onConfirmCash}
                style={[styles.primaryBtn, (!canConfirmCash || mutating) && { opacity: 0.4 }]}
                disabled={!canConfirmCash || mutating}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryTxt}>
                  {row.espece_confirmation ? "Espèces confirmées ✓" : "Confirmer le paiement (espèces)"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(row.total_price, cur)}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const R = 18;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  headerCity: { fontSize: 24, fontWeight: "900", color: "#111" },

  topCard: { marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff", borderRadius: R, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 3 },
  title: { fontSize: 22, fontWeight: "900", color: "#111" },
  sub: { color: "#666", fontWeight: "700", marginTop: 4 },
  hero: { height: 140, borderRadius: 14, marginTop: 12 },

  pillRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  pill: { backgroundColor: "rgba(0,0,0,0.08)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillTxt: { fontWeight: "800", color: "#111", fontSize: 12 },

  codeRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  codeLabel: { color: "#555", fontWeight: "800" },
  codePill: { marginLeft: "auto", backgroundColor: "#111", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  codeTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.2 },

  clientCard: { marginTop: 10, marginHorizontal: 16, backgroundColor: "#fff", borderRadius: R, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 2 },
  sectionTitle: { fontWeight: "900", color: "#111", fontSize: 16 },
  clientAvatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12, backgroundColor: "#eee" },
  clientName: { fontWeight: "900", color: "#111", fontSize: 16 },
  contactTxt: { fontWeight: "800", color: "#111" },
  blurBox: { flex: 1, height: 22, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.06)", justifyContent: "center", paddingHorizontal: 8 },
  blurTxt: { color: "#888", fontWeight: "700", fontSize: 12 },

  countdownPill: {
    marginTop: 10, marginHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
  },
  countdownLabel: { color: "#666", fontWeight: "700", fontSize: 12 },
  countdownTxt: { fontWeight: "900", color: "#111" },

  infoPill: {
    marginTop: 10, marginHorizontal: 16,
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: "#f6f6f6", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12,
  },
  infoPillTxt: { fontWeight: "800", color: "#555" },

  actionsBar: { marginTop: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryBtn: { flex: 1, backgroundColor: "#f3f3f3", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  secondaryTxt: { fontWeight: "900", color: "#111" },

  primaryBtn: { backgroundColor: "#111", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  primaryTxt: { color: "#fff", fontWeight: "900" },

  totalCard: { marginTop: 12, marginHorizontal: 16, marginBottom: 20, backgroundColor: "#fff", borderRadius: R, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  totalLabel: { color: "#666", fontWeight: "700" },
  totalValue: { color: "#111", fontWeight: "900", fontSize: 20, marginTop: 2 },
});
