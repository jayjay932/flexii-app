// src/screens/AvailabilityCalendarScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

/* ---------------- Types ---------------- */
type Props = NativeStackScreenProps<RootStackParamList, "AvailabilityCalendar">;

type OverrideRow = {
  date: string; // YYYY-MM-DD
  is_available: boolean;
  price: number | null;
};

type ReservationRow = {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  status: "pending" | "confirmed" | "completed" | "cancelled" | string | null;
};

const monthNames = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
// évite la clé dupliquée des 2 "M"
const week = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

/* ---------- Dates helpers (UTC) ---------- */
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
const startOfMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0, 1));
const endOfMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0));
const daysInMonth = (y: number, m0: number) => endOfMonth(y, m0).getUTCDate();
const parseUTCDate = (yyyy_mm_dd: string) => new Date(`${yyyy_mm_dd}T00:00:00Z`);
const clampDate = (d: Date, min: Date, max: Date) =>
  new Date(Math.min(Math.max(d.getTime(), min.getTime()), max.getTime()));

/* -------------- Écran -------------- */
export default function AvailabilityCalendarScreen({ route, navigation }: Props) {
  const { id: listingId, kind, title: givenTitle, basePrice, currency } = route.params;

  const [loading, setLoading] = useState(true);
  const [defaultPrice, setDefaultPrice] = useState<number>(basePrice ?? 0);
  const [title, setTitle] = useState<string>(givenTitle ?? "Annonce");

  // curseur mois
  const today = new Date();
  const [year, setYear] = useState<number>(today.getUTCFullYear());
  const [month0, setMonth0] = useState<number>(today.getUTCMonth());

  // overrides du mois visible
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({}); // key: YYYY-MM-DD
  // jours réservés (set de YYYY-MM-DD)
  const [reservedDates, setReservedDates] = useState<Set<string>>(new Set());

  // sélection
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);

  // panneau d’édition
  const [isAvailable, setIsAvailable] = useState(true);
  const [priceInput, setPriceInput] = useState<string>("");

  const periodLabel = `${monthNames[month0]} ${year}`;

  // petit debounce pour le realtime
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback((fn: () => void, delay = 200) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  }, []);

  const fetchListing = useCallback(async () => {
    // Récupère titre & prix de base si non fournis
    try {
      const sel =
        kind === "logement"
          ? supabase.from("listings_logements").select("title, price").eq("id", listingId).maybeSingle()
          : kind === "vehicule"
          ? supabase.from("listings_vehicules").select("marque, modele, price").eq("id", listingId).maybeSingle()
          : supabase.from("listings_experiences").select("title, price").eq("id", listingId).maybeSingle();

      const { data } = (await sel) as any;
      if (data) {
        if (!givenTitle) {
          if (kind === "vehicule")
            setTitle(`${data.marque ?? ""} ${data.modele ?? ""}`.trim() || "Véhicule");
          else setTitle(data.title ?? "Annonce");
        }
        if (basePrice == null && data.price != null) setDefaultPrice(Number(data.price));
      }
    } catch {
      // silencieux
    }
  }, [kind, listingId, basePrice, givenTitle]);

  /** charge overrides + dates réservées pour le mois courant */
  const fetchMonthData = useCallback(async () => {
    try {
      setLoading(true);
      const first = startOfMonth(year, month0);
      const last = endOfMonth(year, month0);

      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet" as any);
        return;
      }

      // 1) Overrides
      const { data: ovData, error: ovErr } = await supabase
        .from("availability_overrides")
        .select("date, is_available, price")
        .eq("owner_id", uid)
        .eq("listing_type", kind)
        .eq("listing_id", listingId)
        .gte("date", ymd(first))
        .lte("date", ymd(last));
      if (ovErr) throw ovErr;

      const map: Record<string, OverrideRow> = {};
      (ovData ?? []).forEach((r: any) => {
        map[r.date] = {
          date: r.date,
          is_available: !!r.is_available,
          price: r.price == null ? null : Number(r.price),
        };
      });
      setOverrides(map);

      // 2) Réservations (tout sauf 'cancelled'), qui **chevauchent** le mois
      let rq = supabase
        .from("reservations")
        .select("start_date, end_date, status")
        .in("status", ["pending", "confirmed", "completed" as any])
        .gte("end_date", ymd(first)) // chevauchement : fin >= début du mois
        .lte("start_date", ymd(last)); // et début <= fin du mois

      if (kind === "logement") rq = rq.eq("logement_id", listingId);
      if (kind === "vehicule") rq = rq.eq("vehicule_id", listingId);
      if (kind === "experience") rq = rq.eq("experience_id", listingId);

      const { data: resData, error: resErr } = (await rq) as {
        data: ReservationRow[] | null;
        error: any;
      };
      if (resErr) throw resErr;

      const set = new Set<string>();
      (resData ?? []).forEach((r) => {
        if (r.status === "cancelled") return;
        const s0 = clampDate(parseUTCDate(r.start_date), first, last);
        const e0 = clampDate(parseUTCDate(r.end_date), first, last);
        for (let d = new Date(s0); d <= e0; d.setUTCDate(d.getUTCDate() + 1)) {
          set.add(ymd(d));
        }
      });
      setReservedDates(set);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger le calendrier.");
    } finally {
      setLoading(false);
    }
  }, [kind, listingId, year, month0, navigation]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  useEffect(() => {
    fetchMonthData();

    const ch = supabase
      .channel(`avail-rt-${kind}-${listingId}`)
      // overrides du listing
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability_overrides",
          filter: `listing_type=eq.${kind},listing_id=eq.${listingId}`,
        },
        () => debounced(fetchMonthData)
      )
      // réservations du listing
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter:
            kind === "logement"
              ? `logement_id=eq.${listingId}`
              : kind === "vehicule"
              ? `vehicule_id=eq.${listingId}`
              : `experience_id=eq.${listingId}`,
        },
        () => debounced(fetchMonthData)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch); // ne pas retourner la Promise
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchMonthData, debounced, kind, listingId]);

  const goPrev = () => {
    if (month0 === 0) {
      setMonth0(11);
      setYear((y) => y - 1);
    } else setMonth0((m) => m - 1);
    setSelStart(null);
    setSelEnd(null);
  };
  const goNext = () => {
    if (month0 === 11) {
      setMonth0(0);
      setYear((y) => y + 1);
    } else setMonth0((m) => m + 1);
    setSelStart(null);
    setSelEnd(null);
  };

  // données du grid
  const days = useMemo(() => {
    const first = startOfMonth(year, month0);
    const last = endOfMonth(year, month0);
    const firstDow = (first.getUTCDay() + 6) % 7; // L=0 … D=6
    const total = firstDow + last.getUTCDate();
    const rows = Math.ceil(total / 7);
    const cells: { key: string; d: Date | null }[] = [];
    for (let i = 0; i < rows * 7; i++) {
      const slot = i - firstDow;
      if (slot < 0 || slot >= last.getUTCDate())
        cells.push({ key: `e-${year}-${month0}-${i}`, d: null });
      else {
        const date = addDays(first, slot);
        cells.push({ key: ymd(date), d: date });
      }
    }
    return cells;
  }, [year, month0]);

  // helpers sélection
  const isBetween = (dateISO: string) => {
    if (!selStart) return false;
    if (!selEnd) return dateISO === selStart;
    return dateISO >= selStart && dateISO <= selEnd;
  };

  const onSelectDay = (d: Date) => {
    const iso = ymd(d);
    if (reservedDates.has(iso)) return; // 🔒 non cliquable si réservé

    if (!selStart || (selStart && selEnd)) {
      setSelStart(iso);
      setSelEnd(null);
      const ov = overrides[iso];
      setIsAvailable(ov?.is_available ?? true);
      setPriceInput(ov?.price != null ? String(ov.price) : "");
      return;
    }
    // on a un start mais pas end : range
    if (iso < selStart) {
      setSelStart(iso);
      setSelEnd(null);
      const ov = overrides[iso];
      setIsAvailable(ov?.is_available ?? true);
      setPriceInput(ov?.price != null ? String(ov.price) : "");
    } else {
      setSelEnd(iso);
    }
  };

  // sauvegarde
  const applyChanges = async () => {
    try {
      if (!selStart) return;
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) return;

      // dates cibles
      const dates: string[] = [];
      const start = parseUTCDate(selStart);
      const finish = selEnd ? parseUTCDate(selEnd) : parseUTCDate(selStart);
      for (let d = new Date(start); d <= finish; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = ymd(d);
        if (!reservedDates.has(iso)) dates.push(iso); // ⚠️ ignore les dates réservées
      }
      if (dates.length === 0) {
        Alert.alert("Info", "Aucune date modifiable (toutes réservées).");
        return;
      }

      const payload = dates.map((date) => ({
        owner_id: uid,
        listing_type: kind,
        listing_id: listingId,
        date,
        is_available: isAvailable,
        price: priceInput === "" ? null : Number(priceInput),
      }));

      const { error } = await supabase
        .from("availability_overrides")
        .upsert(payload, { onConflict: "listing_type,listing_id,date" });
      if (error) throw error;

      await fetchMonthData();
      Alert.alert("Calendrier", "Modifications enregistrées ✓");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Impossible d’enregistrer.");
    }
  };

  const clearOverrides = async () => {
    try {
      if (!selStart) return;
      const start = parseUTCDate(selStart);
      const finish = selEnd ? parseUTCDate(selEnd) : parseUTCDate(selStart);
      const dates: string[] = [];
      for (let d = new Date(start); d <= finish; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = ymd(d);
        if (!reservedDates.has(iso)) dates.push(iso); // ⚠️ ignore les dates réservées
      }
      if (dates.length === 0) {
        Alert.alert("Info", "Aucune date réinitialisable (toutes réservées).");
        return;
      }
      const { error } = await supabase
        .from("availability_overrides")
        .delete()
        .eq("listing_type", kind)
        .eq("listing_id", listingId)
        .in("date", dates);
      if (error) throw error;
      await fetchMonthData();
      setPriceInput("");
      Alert.alert("Calendrier", "Surcharges supprimées ✓");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de réinitialiser.");
    }
  };

  // rendu d’une case
  const renderCell = (d: Date | null) => {
    if (!d) return <View style={styles.cellEmpty} />;
    const iso = ymd(d);
    const day = d.getUTCDate();
    const ov = overrides[iso];
    const customized = !!ov;
    const available = ov?.is_available ?? true;
    const price = ov?.price ?? defaultPrice;

    const selected = isBetween(iso);
    const reserved = reservedDates.has(iso);

    return (
      <TouchableOpacity
        style={[
          styles.cell,
          selected && styles.cellSelected,
          !available && styles.cellBlocked,
          reserved && styles.cellReserved,
        ]}
        activeOpacity={reserved ? 1 : 0.85}
        onPress={() => (reserved ? undefined : onSelectDay(d))}
        disabled={reserved}
      >
        <Text
          style={[
            styles.cellDay,
            selected && { color: "#fff" },
            reserved && { textDecorationLine: "line-through", opacity: 0.6 },
          ]}
        >
          {day}
        </Text>

        <Text
          style={[
            styles.cellPrice,
            selected && { color: "#fff", fontWeight: "900" },
            (!available || reserved) && { textDecorationLine: "line-through", opacity: 0.6 },
          ]}
          numberOfLines={1}
        >
          {price ? `${Number(price).toLocaleString("fr-FR")} F` : "—"}
        </Text>

        {customized && !reserved && <View style={styles.dotCustom} />}

        {reserved && (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed-outline" size={12} color="#666" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const selectionLabel = selStart
    ? selEnd && selEnd !== selStart
      ? `${selStart} → ${selEnd}`
      : selStart
    : "—";

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {/* Mois + nav */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={goPrev} style={styles.pill}>
              <Ionicons name="chevron-back" size={18} color="#111" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{periodLabel}</Text>
            <TouchableOpacity onPress={goNext} style={styles.pill}>
              <Ionicons name="chevron-forward" size={18} color="#111" />
            </TouchableOpacity>
          </View>

          {/* En-tête semaine (clé unique) */}
          <View style={styles.weekRow}>
            {week.map((w, i) => (
              <Text key={`${w}-${i}`} style={styles.weekCell}>
                {w}
              </Text>
            ))}
          </View>

          {/* Grille */}
          <View style={styles.grid}>
            {days.map(({ key, d }) => (
              <View key={key} style={{ width: "14.2857%" }}>
                {renderCell(d)}
              </View>
            ))}
          </View>

          {/* Panneau d’édition (comme la maquette) */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Sélection</Text>
              <Text style={styles.panelSel}>{selectionLabel}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Disponible</Text>
              <TouchableOpacity
                onPress={() => setIsAvailable((v) => !v)}
                style={[styles.toggle, isAvailable ? styles.toggleOn : styles.toggleOff]}
                activeOpacity={0.9}
              >
                <View style={[styles.knob, isAvailable ? { left: 22 } : { left: 2 }]} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Prix personnalisé</Text>
              <TextInput
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder={`${defaultPrice ? defaultPrice.toLocaleString("fr-FR") : "—"} FCFA`}
                keyboardType="numeric"
                style={styles.input}
                placeholderTextColor="#aaa"
              />
              <Text style={styles.hint}>Laisse vide pour utiliser le prix de base.</Text>
            </View>

            <View style={styles.panelActions}>
              <TouchableOpacity
                onPress={clearOverrides}
                style={[styles.secondaryBtn, !selStart && { opacity: 0.35 }]}
                disabled={!selStart}
                activeOpacity={0.9}
              >
                <Text style={styles.secondaryTxt}>Réinitialiser</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyChanges}
                style={[styles.primaryBtn, !selStart && { opacity: 0.35 }]}
                disabled={!selStart}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryTxt}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.legendDot, { backgroundColor: "#EA1261" }]} />
              <Text style={styles.legendTxt}>Personnalisé</Text>
              <View style={[styles.legendDot, { backgroundColor: "#cfcfcf" }]} />
              <Text style={styles.legendTxt}>Indisponible</Text>
              <Ionicons name="lock-closed-outline" size={12} color="#666" style={{ marginLeft: 6 }} />
              <Text style={styles.legendTxt}>Réservé</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ---------------- Styles ---------------- */
const R = 18;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#c4c0c0ff" },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
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
  title: { fontSize: 22, fontWeight: "900", color: "#111", flex: 1, textAlign: "center" },

  monthRow: {
    marginTop: 6,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthTitle: { fontSize: 22, fontWeight: "900", color: "#111" },
  pill: { backgroundColor: "#f2f2f2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },

  weekRow: {
    marginTop: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekCell: { width: "14.2857%", textAlign: "center", color: "#777", fontWeight: "800" },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, marginTop: 6 },

  cellEmpty: { height: 72, margin: 4, borderRadius: 14 },
  cell: {
    height: 72,
    margin: 4,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    padding: 8,
    justifyContent: "space-between",
  },
  cellSelected: { backgroundColor: "#111", borderColor: "#111" },
  cellBlocked: { backgroundColor: "rgba(0,0,0,0.04)" },
  cellReserved: { backgroundColor: "rgba(0,0,0,0.05)" },

  cellDay: { fontWeight: "900", color: "#111" },
  cellPrice: { fontSize: 12, color: "#666", fontWeight: "800" },
  dotCustom: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EA1261",
  },
  lockBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  panel: {
    marginTop: 14,
    marginHorizontal: 12,
    padding: 14,
    borderRadius: R,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: { fontWeight: "900", color: "#111", fontSize: 16 },
  panelSel: { color: "#666", fontWeight: "700" },

  rowBetween: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { fontWeight: "800", color: "#555" },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 2,
    position: "relative",
  },
  toggleOn: { backgroundColor: "#1bd760" },
  toggleOff: { backgroundColor: "#cfcfcf" },
  knob: {
    position: "absolute",
    top: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
  },

  input: {
    marginTop: 6,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f6f6f6",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    color: "#111",
  },
  hint: { marginTop: 6, color: "#888", fontWeight: "600", fontSize: 12 },

  panelActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f3f3f3",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryTxt: { fontWeight: "900", color: "#111" },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryTxt: { color: "#fff", fontWeight: "900" },

  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { color: "#666", fontWeight: "700" },
});
