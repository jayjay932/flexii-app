// src/screens/ReservationDetailsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@/src/ui/Icon";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";
import { Image } from "expo-image";

type Props = NativeStackScreenProps<RootStackParamList, "ReservationDetails">;

type HostUser = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url?: string | null;
} | null;

type AnyListingCommon = {
  city?: string | null;
  quartier?: string | null;
  address?: string | null; // logement
  listing_images?: { image_url: string | null }[] | null;
  users?: HostUser; // owner
};

type LogementListing = AnyListingCommon & {
  title: string;
  check_in_start?: string | null;
  check_out?: string | null;
};

type VehiculeListing = AnyListingCommon & {
  marque?: string | null;
  modele?: string | null;
};

type Row = {
  id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | string;
  total_price: number;
  currency: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  logement_id: string | null;
  vehicule_id: string | null;
  reservation_code: string | null;
  arrival_confirmation: boolean | null;

  listings_logements?: LogementListing | null;
  listings_vehicules?: VehiculeListing | null;
};

type Txn = {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded" | string;
  amount: number;
  created_at: string;
};

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(Number(n || 0));

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

const addDays = (iso: string, d: number) => {
  const x = new Date(iso);
  x.setDate(x.getDate() + d);
  return x;
};

function useCountdown(deadlineISO?: string) {
  const [left, setLeft] = useState<number>(0);
  useEffect(() => {
    if (!deadlineISO) return;
    const tick = () => {
      const now = Date.now();
      const t = new Date(deadlineISO).getTime() - now;
      setLeft(Math.max(0, t));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineISO]);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const done = left <= 0;
  return { left, h, m, s, done };
}

export default function ReservationDetailsScreen({ route, navigation }: Props) {
  const { id } = route.params;

  const [row, setRow] = useState<Row | null>(null);
  const [txn, setTxn] = useState<Txn | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  // anti race-condition
  const reqSeq = useRef(0);
  // debounce pour coalescer le realtime
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback((fn: () => void, delay = 200) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    const ticket = ++reqSeq.current;
    if (!silent) setLoading(true);
    try {
      const [resq, txnq] = await Promise.all([
        supabase
          .from("reservations")
          .select(
            `
            id, start_date, end_date, created_at, status, total_price, currency,
            check_in_time, check_out_time, logement_id, vehicule_id,
            reservation_code, arrival_confirmation,

            logement:logement_id(
              title,
              city,
              quartier,
              adresse,
              check_in_start,
              check_out,
              listing_images(image_url),
              owner:owner_id(
                full_name,
                email,
                phone,
                avatar_url
              )
            ),

            vehicule:vehicule_id(
              marque,
              modele,
              city,
              quartier,
              listing_images(image_url),
              owner:owner_id(
                full_name,
                email,
                phone,
                avatar_url
              )
            )
          `
          )
          .eq("id", id)
          .maybeSingle<any>(),
        supabase
          .from("transactions")
          .select(`id, status, amount, created_at`)
          .eq("reservation_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<Txn>(),
      ]);

      if (resq.error) throw resq.error;

      // normalisation -> mêmes clés que l’ancienne structure
      const r = resq.data
        ? ({
            id: resq.data.id,
            start_date: resq.data.start_date,
            end_date: resq.data.end_date,
            created_at: resq.data.created_at,
            status: resq.data.status,
            total_price: resq.data.total_price,
            currency: resq.data.currency,
            check_in_time: resq.data.check_in_time,
            check_out_time: resq.data.check_out_time,
            logement_id: resq.data.logement_id,
            vehicule_id: resq.data.vehicule_id,
            reservation_code: resq.data.reservation_code,
            arrival_confirmation: resq.data.arrival_confirmation,
            listings_logements: resq.data.logement
              ? ({
                  title: resq.data.logement.title,
                  city: resq.data.logement.city,
                  quartier: resq.data.logement.quartier,
                  address: resq.data.logement.adresse,
                  check_in_start: resq.data.logement.check_in_start,
                  check_out: resq.data.logement.check_out,
                  listing_images: resq.data.logement.listing_images,
                  users: resq.data.logement.owner,
                } as LogementListing)
              : null,
            listings_vehicules: resq.data.vehicule
              ? ({
                  marque: resq.data.vehicule.marque,
                  modele: resq.data.vehicule.modele,
                  city: resq.data.vehicule.city,
                  quartier: resq.data.vehicule.quartier,
                  listing_images: resq.data.vehicule.listing_images,
                  users: resq.data.vehicule.owner,
                } as VehiculeListing)
              : null,
          } as Row)
        : null;

      if (ticket === reqSeq.current) setRow(r);

      // La table transactions peut ne pas avoir de ligne (Pas de paiement encore)
      if (!txnq.error || (txnq as any).error?.code === "PGRST116") {
        if (ticket === reqSeq.current) setTxn(txnq.data ?? null);
      } else {
        throw txnq.error;
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger la réservation.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const offFocus = navigation.addListener("focus", () => fetchData(true));

    // Realtime ciblé sur la réservation + ses transactions
    const ch = supabase
      .channel(`reservation-details-${id}`, { config: { broadcast: { ack: false } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `id=eq.${id}` },
        (payload) => {
          // maj locale rapide sur champs simples, puis refetch coalescé
          const r = payload.new as Partial<Row> & { id: string };
          setRow((prev) =>
            prev && prev.id === r.id
              ? {
                  ...prev,
                  status: (r.status as any) ?? prev.status,
                  total_price: typeof r.total_price === "number" ? r.total_price : prev.total_price,
                  currency: (r.currency as any) ?? prev.currency,
                  arrival_confirmation:
                    typeof (r as any).arrival_confirmation === "boolean"
                      ? (r as any).arrival_confirmation
                      : prev.arrival_confirmation,
                }
              : prev
          );
          debounced(() => fetchData(true), 180);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `reservation_id=eq.${id}` },
        () => debounced(() => fetchData(true), 180)
      )
      .subscribe();

    return () => {
      offFocus();
      supabase.removeChannel(ch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData, debounced, id, navigation]);

  const kind: "logement" | "vehicule" = row?.logement_id ? "logement" : "vehicule";

  // —— Dérivés d’affichage unifiés (titre, ville, photo, hôte, adresse) —— //
  const cur = row?.currency ?? "XOF";
  const Lh = row?.listings_logements;
  const Vh = row?.listings_vehicules;

  const title =
    kind === "vehicule"
      ? `${Vh?.marque ?? ""} ${Vh?.modele ?? ""}`.trim() || "Véhicule"
      : Lh?.title ?? "Logement";

  const city = (kind === "vehicule" ? Vh?.city : Lh?.city) ?? "—";

  const cover =
    (kind === "vehicule"
      ? Vh?.listing_images?.[0]?.image_url
      : Lh?.listing_images?.[0]?.image_url) || undefined;

  const host: HostUser = kind === "vehicule" ? Vh?.users ?? null : Lh?.users ?? null;

  const address =
    (kind === "vehicule" ? Vh?.quartier ?? Vh?.city : Lh?.address ?? Lh?.quartier ?? Lh?.city) ?? city;

  // heures (logement; pour véhicule, fallback)
  const ci = row?.check_in_time ?? (Lh?.check_in_start ?? null) ?? "15:00:00";
  const co = row?.check_out_time ?? (Lh?.check_out ?? null) ?? "11:00:00";

  // deadline annulation : 24h après created_at
  const cancelDeadline = row
    ? new Date(new Date(row.created_at).getTime() + 24 * 3600 * 1000).toISOString()
    : undefined;
  const { h, m, s, done } = useCountdown(cancelDeadline);

  const arrivalConfirmed = !!row?.arrival_confirmation;
  const canConfirmArrival = !!row && row.status === "confirmed" && !arrivalConfirmed;

  // Annulation: pas annulée/terminée, délai 24h non expiré, et arrivée NON confirmée
  const canCancel = !!row && row.status !== "cancelled" && row.status !== "completed" && !done && !arrivalConfirmed;
  const cancelDisabled = !canCancel || mutating;
  const showCountdown =
    !done && row?.status !== "cancelled" && row?.status !== "completed" && !arrivalConfirmed;

  const onCancel = async () => {
    if (!row) return;
    Alert.alert("Annuler la réservation ?", "Cette action est définitive.", [
      { text: "Non", style: "cancel" },
      {
        text: "Oui, annuler",
        style: "destructive",
        onPress: async () => {
          try {
            setMutating(true);
            const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", row.id);
            if (error) throw error;
            await fetchData(true);
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

  const onConfirmArrival = async () => {
    if (!row) return;
    try {
      setMutating(true);
      const { error } = await supabase.from("reservations").update({ arrival_confirmation: true }).eq("id", row.id);
      if (error) throw error;
      await fetchData(true);
      Alert.alert("Bienvenue ✨", "Arrivée confirmée !");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de confirmer l’arrivée.");
    } finally {
      setMutating(false);
    }
  };

  const openDirections = () => {
    if (!address) return;
    const q = encodeURIComponent(address + " " + city);
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url);
  };

  // ——— Timeline ———
  const days = useMemo(() => {
    if (!row) return [];
    const s = new Date(row.start_date);
    const e = new Date(row.end_date);
    const list: { key: string; label: string; note?: string; img?: string }[] = [];
    let i = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (i === 0) {
        list.push({ key, label: "Flexii vous souhaite un bon voyage", note: address, img: cover });
      } else if (d.getTime() === e.getTime()) {
        list.push({
          key,
          label: `Départ avant ${co?.slice(0, 5) || "11:00"}`,
          note: kind === "vehicule" ? "Merci pour votre location ✨" : "Merci de votre séjour ✨",
          img: cover,
        });
      } else {
        list.push({
          key,
          label: kind === "vehicule" ? "Profitez de votre véhicule" : "Profitez de votre séjour",
          note: kind === "vehicule" ? "Conduite prudente, bonne route !" : "Activités, visites, repos…",
        });
      }
      i++;
    }
    return list;
  }, [row?.start_date, row?.end_date, kind, address, cover, co]);

  if (loading || !row) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  // Infos hôte visibles SEULEMENT si (réservation confirmée/terminée) ET (transaction payée)
  const txnPaid = txn?.status === "paid";
  const hostExposed = (row.status === "confirmed" || row.status === "completed") && txnPaid;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerCity}>{city}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Reservations")} style={styles.roundBtn}>
            <Ionicons name="grid-outline" size={18} color="#111" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Top card */}
          <View style={styles.topCard}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>
              {fmtShort(row.start_date)} – {fmtShort(row.end_date)} · Hôte : {host?.full_name ?? "—"}
            </Text>

            {/* Code de réservation */}
            <View style={styles.codeRow}>
              <Ionicons name="ticket-outline" size={18} color="#555" />
              <Text style={styles.codeLabel}>Code réservation</Text>
              <View style={styles.codePill}>
                <Text style={styles.codeTxt}>{row.reservation_code || row.id.slice(0, 8).toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={18} color="#777" />
              <Text style={styles.addr} numberOfLines={1}>
                {address}
              </Text>
              <TouchableOpacity onPress={openDirections} activeOpacity={0.9} style={styles.directionsBtn}>
                <Text style={styles.directionsTxt}>Itinéraire</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.timelineWrap}>
            <View style={styles.timelineLine} />
            {days.map((d, idx) => {
              const dateObj = addDays(row.start_date, idx);
              const dow = dateObj.toLocaleDateString("en-US", { weekday: "short" });
              const dd = dateObj.getDate();
              return (
                <View key={d.key} style={styles.timeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeDow}>{dow}</Text>
                    <Text style={styles.badgeDay}>{dd}</Text>
                  </View>

                  <View style={styles.itemCard}>
                    {d.img ? (
                      <Image
                        source={{ uri: d.img }}
                        style={styles.hero}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        allowDownscaling
                        transition={120}
                        placeholder={require("../../assets/images/flexii.png")}
                      />
                    ) : (
                      <View style={[styles.hero, { backgroundColor: "#efefef" }]} />
                    )}
                    <Text style={styles.itemTitle}>{d.label}</Text>
                    {!!d.note && (
                      <Text style={styles.itemNote} numberOfLines={2}>
                        {d.note}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Carte hôte / contacts */}
          <View style={styles.hostCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={
                  host?.avatar_url ? { uri: host.avatar_url } : require("../../assets/images/logement.jpg")
                }
                style={styles.hostAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                allowDownscaling
                transition={120}
                placeholder={require("../../assets/images/flexii.png")}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.hostName}>{host?.full_name ?? "Hôte"}</Text>
                <Text style={styles.hostRole}>Hôte</Text>
              </View>
              {row.arrival_confirmation ? (
                <View style={styles.arrivalPill}>
                  <Ionicons name="checkmark-circle" size={14} color="#0a0" />
                  <Text style={styles.arrivalPillTxt}>Arrivée confirmée</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color="#555" />
              {hostExposed ? (
                <Text style={styles.contactTxt}>{host?.email ?? "—"}</Text>
              ) : (
                <View style={styles.blurredBox}>
                  <Text style={styles.blurredTxt}>Email visible après confirmation et paiement réussi</Text>
                </View>
              )}
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color="#555" />
              {hostExposed ? (
                <Text style={styles.contactTxt}>{host?.phone ?? "—"}</Text>
              ) : (
                <View style={styles.blurredBox}>
                  <Text style={styles.blurredTxt}>Téléphone visible après confirmation et paiement réussi</Text>
                </View>
              )}
            </View>
          </View>

          {/* Info paiement / compte à rebours */}
          {arrivalConfirmed ? (
            <View style={styles.infoPill}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#2a7" />
              <Text style={styles.infoPillTxt}>Arrivée confirmée — annulation indisponible</Text>
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
            {canCancel ? (
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.secondaryBtn, cancelDisabled && styles.secondaryBtnDisabled]}
                disabled={cancelDisabled}
                activeOpacity={0.9}
              >
                <Ionicons name="close-circle" size={18} color="#111" />
                <Text style={styles.secondaryTxt}>Annuler</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={onConfirmArrival}
              style={[styles.primaryBtn, (!canConfirmArrival || mutating) && { opacity: 0.4 }]}
              disabled={!canConfirmArrival || mutating}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryTxt}>
                {arrivalConfirmed ? "Arrivée confirmée ✓" : "Confirmer mon arrivée"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(row.total_price, cur)}</Text>
            <Text style={styles.statusLine}>
              Statut :{" "}
              {row.status === "confirmed"
                ? "Confirmée"
                : row.status === "pending"
                ? "En attente"
                : row.status === "cancelled"
                ? "Annulée"
                : "Terminée"}
            </Text>
            <Text style={[styles.statusLine, { marginTop: 4 }]}>
              Paiement : {txnPaid ? "Payé" : txn?.status === "pending" ? "En cours" : txn?.status ? txn.status : "—"}
            </Text>
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

  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCity: { fontSize: 24, fontWeight: "900", color: "#111" },

  // top card
  topCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  title: { fontSize: 24, fontWeight: "900", color: "#111" },
  sub: { color: "#666", fontWeight: "700", marginTop: 4 },

  codeRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  codeLabel: { color: "#555", fontWeight: "800" },
  codePill: { marginLeft: "auto", backgroundColor: "#111", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  codeTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.2 },

  addrRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  addr: { flex: 1, color: "#333", fontWeight: "700" },
  directionsBtn: { backgroundColor: "#f2f2f2", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  directionsTxt: { fontWeight: "800", color: "#111" },

  // timeline
  timelineWrap: { marginTop: 14, paddingHorizontal: 16 },
  timelineLine: { position: "absolute", left: 34, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(0,0,0,0.08)" },
  timeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  badge: { width: 44, alignItems: "center", marginTop: 6 },
  badgeDow: { fontSize: 12, fontWeight: "900", color: "#D63C7B" },
  badgeDay: { fontSize: 16, fontWeight: "900", color: "#222" },

  itemCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  hero: { height: 120, borderRadius: 14, marginBottom: 10, width: "100%" },
  itemTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  itemNote: { marginTop: 4, color: "#666", fontWeight: "600" },

  // host card
  hostCard: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  hostAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  hostName: { fontSize: 18, fontWeight: "900", color: "#111" },
  hostRole: { color: "#777", fontWeight: "700" },
  contactRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  contactTxt: { fontWeight: "800", color: "#111" },

  // “blur” visuel simple
  blurredBox: {
    flex: 1,
    height: 22,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  blurredTxt: { color: "#888", fontWeight: "700", fontSize: 12 },

  arrivalPill: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#e9f7ee",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  arrivalPillTxt: { color: "#0a0", fontWeight: "900", fontSize: 12 },

  // actions
  actionsBar: { marginTop: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f3f3f3",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryTxt: { fontWeight: "900", color: "#111" },
  secondaryBtnDisabled: { backgroundColor: "#eee" },

  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginHorizontal: 16,
    marginTop: 12,
  },
  countdownLabel: { color: "#666", fontWeight: "700", fontSize: 12 },
  countdownTxt: { fontWeight: "900", color: "#111" },

  infoPill: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#f6f6f6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  infoPillTxt: { fontWeight: "800", color: "#555" },

  primaryBtn: { backgroundColor: "#111", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  primaryTxt: { color: "#fff", fontWeight: "900" },

  // total
  totalCard: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  totalLabel: { color: "#666", fontWeight: "700" },
  totalValue: { color: "#111", fontWeight: "900", fontSize: 20, marginTop: 2 },
  statusLine: { marginTop: 6, color: "#555", fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
