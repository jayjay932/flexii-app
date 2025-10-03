// src/screens/ReservationsScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@/src/ui/Icon";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";
import { Image } from "expo-image";

type Props = NativeStackScreenProps<RootStackParamList, "Reservations">;

type AnyListing = {
  title?: string | null; // logement/expérience
  city?: string | null;
  listing_images?: { image_url: string | null }[] | null;
  marque?: string | null; // véhicule
  modele?: string | null; // véhicule
};

type Row = {
  id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  currency: string | null;
  status: string | null;
  logement_id: string | null;
  vehicule_id: string | null;
  experience_id: string | null;
  listings_logements?: AnyListing | null;
  listings_vehicules?: AnyListing | null;
  listings_experiences?: AnyListing | null;
};

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: cur as any,
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const fmtRange = (a: string, b: string) => {
  const A = new Date(a),
    B = new Date(b);
  const opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${A.toLocaleDateString("fr-FR", opt)} – ${B.toLocaleDateString("fr-FR", opt)}`;
};

// Prend le premier élément quand PostgREST renvoie un tableau sur les relations
function takeOne<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return (val[0] as T) ?? null;
  return (val ?? null) as T | null;
}

export default function ReservationsScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // anti race-condition
  const reqSeq = useRef(0);

  // debounce coalescé pour le realtime
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback((fn: () => void, delay = 200) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    const ticket = ++reqSeq.current;
    if (!silent) setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet");
        return;
      }

      // Un seul SELECT qui ramène les 3 types + leurs photos
      const { data, error } = await supabase
        .from("reservations")
        .select(
          `
          id, start_date, end_date, total_price, currency, status,
          logement_id, vehicule_id, experience_id,
          logement:logement_id (
            title, city,
            listing_images ( image_url )
          ),
          vehicule:vehicule_id (
            marque, modele, city,
            listing_images ( image_url )
          ),
          experience:experience_id (
            title, city,
            listing_images ( image_url )
          )
        `
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized: Row[] =
        (data ?? []).map((r: any) => ({
          id: r.id,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          logement_id: r.logement_id,
          vehicule_id: r.vehicule_id,
          experience_id: r.experience_id,
          listings_logements: takeOne<AnyListing>(r.logement),
          listings_vehicules: takeOne<AnyListing>(r.vehicule),
          listings_experiences: takeOne<AnyListing>(r.experience),
        })) ?? [];

      if (ticket === reqSeq.current) setRows(normalized);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchData();

    const offFocus = navigation.addListener("focus", () => fetchData(true));

    // Realtime unique + coalescing
    const ch = supabase
      .channel("user-reservations-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations" },
        (payload: any) => {
          const r = payload.new as { id: string; status?: string | null; total_price?: number | null; currency?: string | null };
          setRows((prev) =>
            prev.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    status: r.status ?? x.status,
                    total_price: typeof r.total_price === "number" ? r.total_price : x.total_price,
                    currency: r.currency ?? x.currency,
                  }
                : x
            )
          );
          debounced(() => fetchData(true), 200);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservations" },
        () => debounced(() => fetchData(true), 150)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "reservations" },
        (payload: any) => {
          const id = payload.old?.id as string | undefined;
          if (!id) return;
          setRows((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .subscribe();

    return () => {
      offFocus();
      supabase.removeChannel(ch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData, debounced, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  const openDetails = useCallback(
    (id: string) => {
      const parent = navigation.getParent?.();
      try {
        navigation.navigate("ReservationDetails" as any, { id });
      } catch {
        parent?.navigate?.("ReservationDetails" as any, { id });
      }
    },
    [navigation]
  );

  const empty = !loading && rows.length === 0;

  // ---- Sous-composant carte mémoïsé pour limiter les re-renders ----
  type CardProps = { item: Row; onPress: (id: string) => void };
  const Card = useCallback(({ item, onPress }: CardProps) => {
    const kind = item.logement_id ? "logement" : item.vehicule_id ? "vehicule" : "experience";
    const L =
      kind === "logement"
        ? item.listings_logements
        : kind === "vehicule"
        ? item.listings_vehicules
        : item.listings_experiences;

    const imgs =
      (L?.listing_images ?? [])
        .map((x) => x?.image_url || "")
        .filter(Boolean) as string[];

    const cover = imgs[0] || "";
    const second = imgs[1] || cover;

    const title =
      kind === "vehicule"
        ? `${L?.marque ?? ""} ${L?.modele ?? ""}`.trim() || "Véhicule"
        : L?.title || (kind === "logement" ? "Logement" : "Expérience");

    const city = L?.city ?? "";
    const cur = (item.currency || "XOF") as string;
    const range = fmtRange(item.start_date, item.end_date);
    const status =
      item.status === "confirmed"
        ? "Confirmée"
        : item.status === "pending"
        ? "En attente"
        : item.status === "cancelled"
        ? "Annulée"
        : item.status === "completed"
        ? "Terminée"
        : (item.status || "—");

    return (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillTxt}>{status}</Text>
            </View>
          </View>

          <Text style={styles.cardMeta} numberOfLines={1}>
            {city ? `${city} • ` : ""}
            {range} • {kind === "logement" ? "Logement" : kind === "vehicule" ? "Véhicule" : "Expérience"}
          </Text>

          <View style={styles.thumbRow}>
            <Image
              source={cover ? { uri: cover } : require("../../assets/images/logement.jpg")}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              priority="high"
              allowDownscaling
              placeholder={require("../../assets/images/flexii.png")}
            />
            <Image
              source={second ? { uri: second } : require("../../assets/images/logement.jpg")}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              allowDownscaling
              placeholder={require("../../assets/images/flexii.png")}
            />
          </View>

          <View style={styles.footerRow}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(item.total_price, cur)}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.9} style={styles.cta} onPress={() => onPress(item.id)}>
              <Text style={styles.ctaTxt}>Voir les détails</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => <Card item={item} onPress={openDetails} />,
    [openDetails, Card]
  );

  const keyExtractor = useCallback((it: Row) => it.id, []);
  const ItemSeparator = useCallback(() => <View style={{ height: 16 }} />, []);

  return (
    <View style={styles.root}>
      {/* Fond doux ultra light avec expo-image */}
      <Image
        source={require("../../assets/images/logement.jpg")}
        style={RNStyleSheet.absoluteFillObject as any}
        contentFit="cover"
        blurRadius={Platform.OS === "android" ? 8 : 12}
        transition={150}
        cachePolicy="memory-disk"
      />
      <View style={[RNStyleSheet.absoluteFill, { backgroundColor: "rgba(240,238,233,0.75)" }]} />

      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title}>Mes réservations</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Liste */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : empty ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Aucune réservation</Text>
            <Text style={styles.emptySub}>Elles apparaîtront ici après votre première réservation.</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            // Perf
            initialNumToRender={6}
            windowSize={7}
            maxToRenderPerBatch={6}
            updateCellsBatchingPeriod={16}
            removeClippedSubviews
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const R = 18;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EFEDE8" },
  safe: { flex: 1 },

  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "900", color: "#111" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  emptySub: { marginTop: 6, color: "#666", fontWeight: "600", textAlign: "center", paddingHorizontal: 16 },

  cardWrap: {},
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 5,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#111", flex: 1 },
  cardMeta: { marginTop: 4, color: "#4b4b4b", fontWeight: "700" },

  pill: { backgroundColor: "rgba(0,0,0,0.08)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillTxt: { fontWeight: "800", color: "#111", fontSize: 12 },

  thumbRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  thumb: { flex: 1, height: 110, borderRadius: 14, overflow: "hidden" },

  footerRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { color: "#6b6b6b", fontWeight: "700" },
  totalValue: { color: "#111", fontWeight: "900", fontSize: 18, marginTop: 2 },

  cta: { backgroundColor: "#111", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  ctaTxt: { color: "#fff", fontWeight: "900" },
});
