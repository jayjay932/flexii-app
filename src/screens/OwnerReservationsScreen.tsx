// src/screens/OwnerReservationsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@/src/ui/Icon";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";
import { Image } from "expo-image";

type Props = NativeStackScreenProps<RootStackParamList, "ReservationsRecues">;

type AnyListing = {
  title?: string | null;
  city?: string | null;
  listing_images?: { image_url: string | null }[] | null;
  marque?: string | null;
  modele?: string | null;
};

type Row = {
  id: string;
  created_at: string;
  start_date: string;
  end_date: string;
  total_price: number;
  currency: string | null;
  status: string | null;
  espece_confirmation: boolean | null;
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
  return `${A.toLocaleDateString("fr-FR", opt)} – ${B.toLocaleDateString(
    "fr-FR",
    opt
  )}`;
};

function takeOne<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return (val[0] as T) ?? null;
  return (val ?? null) as T | null;
}

export default function OwnerReservationsScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // anti race-condition
  const reqSeq = useRef(0);

  // debounce coalescé
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback((fn: () => void, delay = 200) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  }, []);

  const fetchData = useCallback(
    async (silent = false) => {
      const ticket = ++reqSeq.current;
      if (!silent) setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getSession();
        const uid = auth.session?.user?.id;
        if (!uid) {
          navigation.replace("AuthSheet");
          return;
        }

        // LOGEMENTS
        const qL = await supabase
          .from("reservations")
          .select(
            `
            id, created_at, start_date, end_date, status, total_price, currency, espece_confirmation,
            logement_id, vehicule_id, experience_id,
            logement:logement_id!inner (
              id, title, city, owner_id,
              listing_images ( image_url )
            )
          `
          )
          .eq("logement.owner_id", uid)
          .order("created_at", { ascending: false });

        // VEHICULES
        const qV = await supabase
          .from("reservations")
          .select(
            `
            id, created_at, start_date, end_date, status, total_price, currency, espece_confirmation,
            logement_id, vehicule_id, experience_id,
            vehicule:vehicule_id!inner (
              id, marque, modele, city, owner_id,
              listing_images ( image_url )
            )
          `
          )
          .eq("vehicule.owner_id", uid)
          .order("created_at", { ascending: false });

        // EXPERIENCES
        const qE = await supabase
          .from("reservations")
          .select(
            `
            id, created_at, start_date, end_date, status, total_price, currency, espece_confirmation,
            logement_id, vehicule_id, experience_id,
            experience:experience_id!inner (
              id, title, city, owner_id,
              listing_images ( image_url )
            )
          `
          )
          .eq("experience.owner_id", uid)
          .order("created_at", { ascending: false });

        if (qL.error) throw qL.error;
        if (qV.error) throw qV.error;
        if (qE.error) throw qE.error;

        const normL: Row[] = (qL.data as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          espece_confirmation: r.espece_confirmation,
          logement_id: r.logement_id,
          vehicule_id: r.vehicule_id,
          experience_id: r.experience_id,
          listings_logements: takeOne<AnyListing>(r.logement),
          listings_vehicules: null,
          listings_experiences: null,
        }));

        const normV: Row[] = (qV.data as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          espece_confirmation: r.espece_confirmation,
          logement_id: r.logement_id,
          vehicule_id: r.vehicule_id,
          experience_id: r.experience_id,
          listings_logements: null,
          listings_vehicules: takeOne<AnyListing>(r.vehicule),
          listings_experiences: null,
        }));

        const normE: Row[] = (qE.data as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          espece_confirmation: r.espece_confirmation,
          logement_id: r.logement_id,
          vehicule_id: r.vehicule_id,
          experience_id: r.experience_id,
          listings_logements: null,
          listings_vehicules: null,
          listings_experiences: takeOne<AnyListing>(r.experience),
        }));

        const merged = [...normL, ...normV, ...normE].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

        if (ticket === reqSeq.current) setRows(merged);
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [navigation]
  );

  useEffect(() => {
    fetchData();
    const offFocus = navigation.addListener("focus", () => fetchData(true));

    // Realtime unique + coalescing
    const ch = supabase
      .channel("owner-reservations-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations" },
        (payload: any) => {
          const r = payload.new as {
            id: string;
            status?: string | null;
            espece_confirmation?: boolean | null;
          };
          setRows((prev) =>
            prev.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    status: r.status ?? x.status,
                    espece_confirmation:
                      typeof r.espece_confirmation === "boolean"
                        ? r.espece_confirmation
                        : x.espece_confirmation,
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
        navigation.navigate("OwnerReservationDetails" as any, { id });
      } catch {
        parent?.navigate?.("OwnerReservationDetails" as any, { id });
      }
    },
    [navigation]
  );

  const empty = !loading && rows.length === 0;

  // ---- RenderItem mémoïsé + sous-composant pour limiter les re-renders ----
  type ItemProps = { row: Row; onPress: (id: string) => void };
  const Card = useCallback(({ row, onPress }: ItemProps) => {
    const kind = row.logement_id ? "logement" : row.vehicule_id ? "vehicule" : "experience";
    const L =
      kind === "logement"
        ? row.listings_logements
        : kind === "vehicule"
        ? row.listings_vehicules
        : row.listings_experiences;

    const imgs =
      (L?.listing_images ?? []).map((x) => x?.image_url || "").filter(Boolean) as string[];

    const cover = imgs[0] || "";
    const second = imgs[1] || cover;

    const title =
      kind === "vehicule"
        ? `${L?.marque ?? ""} ${L?.modele ?? ""}`.trim() || "Véhicule"
        : L?.title || (kind === "logement" ? "Logement" : "Expérience");

    const city = L?.city ?? "";
    const cur = (row.currency || "XOF") as string;
    const range = fmtRange(row.start_date, row.end_date);

    const status =
      row.status === "confirmed"
        ? "Confirmée"
        : row.status === "pending"
        ? "En attente"
        : row.status === "cancelled"
        ? "Annulée"
        : row.status === "completed"
        ? "Terminée"
        : (row.status || "—");

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
              source={cover ? { uri: cover } : require("../../assets/images/logement2.jpg")}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              priority="high"
              allowDownscaling
              placeholder={require("../../assets/images/flexii.png")}
              blurRadius={0}
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
              <Text style={styles.totalValue}>{money(row.total_price, cur)}</Text>
            </View>

            <TouchableOpacity activeOpacity={0.9} style={styles.cta} onPress={() => onPress(row.id)}>
              <Text style={styles.ctaTxt}>Voir les détails</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => <Card row={item} onPress={openDetails} />,
    [openDetails, Card]
  );

  const keyExtractor = useCallback((it: Row) => it.id, []);
  const ItemSeparator = useCallback(() => <View style={{ height: 16 }} />, []);

  return (
    <View style={styles.root}>
      {/* fond flou ultra light avec expo-image */}
      <Image
        source={require("../../assets/images/logement.jpg")}
        style={StyleSheet.absoluteFillObject as any}
        contentFit="cover"
        blurRadius={Platform.OS === "android" ? 8 : 12}
        transition={150}
        cachePolicy="memory-disk"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(240,238,233,0.78)" }]} />

      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title}>Réservations reçues</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : empty ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Aucune réservation reçue</Text>
            <Text style={styles.emptySub}>
              Elles apparaîtront ici dès qu’un client réservera chez vous.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ItemSeparatorComponent={ItemSeparator}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "900", color: "#111" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  emptySub: { marginTop: 6, color: "#666", fontWeight: "600", textAlign: "center", paddingHorizontal: 16 },

  cardWrap: { },
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
