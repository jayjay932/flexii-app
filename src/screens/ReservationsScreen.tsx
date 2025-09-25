// src/screens/ReservationsScreen.tsx
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image, // gardé pour le fond flou
  RefreshControl,
  Platform,
  Dimensions,
  PixelRatio,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Reservations">;

type Row = {
  id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  currency: string | null;
  status: string | null;
  listings_logements?:
    | {
        title: string;
        city: string;
        listing_images?: { image_url: string | null }[];
      }
    | {
        title: string;
        city: string;
        listing_images?: { image_url: string | null }[];
      }[] // <- parfois PostgREST renvoie un tableau selon la relation
    | null;
};

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur as any }).format(
    Number(n || 0)
  );

const fmtRange = (a: string, b: string) => {
  const A = new Date(a), B = new Date(b);
  const opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${A.toLocaleDateString("fr-FR", opt)} – ${B.toLocaleDateString("fr-FR", opt)}`;
};

const mapStatus = (s?: string | null) =>
  s === "confirmed" ? "Confirmée"
  : s === "pending" ? "En attente"
  : s === "cancelled" ? "Annulée"
  : "Terminée";

/* ------- Helpers images (miniatures Supabase + cache) ------- */
const { width: SCREEN_W } = Dimensions.get("window");
const THUMB_H = 110;
const PLACEHOLDER = require("../../assets/images/logement.jpg");

// largeur d’une vignette (2 colonnes, padding 16, gap 12)
const THUMB_W = (SCREEN_W - 16 * 2 - 12) / 2;

const supaThumb = (
  url?: string | null,
  w = THUMB_W,
  h = THUMB_H,
  q = 70,
  mode: "cover" | "contain" = "cover"
) => {
  if (!url) return undefined;
  try {
    if (url.includes("/storage/v1/object/public/")) {
      const [base] = url.split("?");
      const render = base.replace("/object/public/", "/render/image/public/");
      const pxW = Math.min(Math.round(w * PixelRatio.get()), 1000);
      const pxH = Math.min(Math.round(h * PixelRatio.get()), 1000);
      return `${render}?width=${pxW}&height=${pxH}&quality=${q}&resize=${mode}`;
    }
  } catch {}
  return url;
};

// prend le premier élément si la relation est un tableau
const first = <T,>(v: T | T[] | null | undefined): T | undefined =>
  !v ? undefined : Array.isArray(v) ? v[0] : v;

export default function ReservationsScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet");
        return;
      }
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id, start_date, end_date, total_price, currency, status,
          listings_logements:logement_id ( title, city, listing_images ( image_url ) )
        `)
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;

      setRows((data as Row[]) ?? []);

      // Précharge léger (optionnel, non bloquant)
      try {
        const urls =
          (data ?? [])
            .flatMap((r: any) => {
              const lg = first(r.listings_logements);
              return lg?.listing_images?.map((x: any) => x?.image_url) ?? [];
            })
            .filter(Boolean)
            .slice(0, 24);
        FastImage.preload(
          urls.map((u: string) => ({
            uri: supaThumb(u),
            priority: FastImage.priority.low,
          }))
        );
      } catch {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const openDetails = (id: string) => {
    const parent = navigation.getParent?.();
    try {
      navigation.navigate("ReservationDetails" as any, { id });
    } catch {
      parent?.navigate?.("ReservationDetails" as any, { id });
    }
  };

  const empty = !loading && rows.length === 0;

  return (
    <View style={styles.root}>
      {/* Fond doux façon iOS (pas de blur natif nécessaire) */}
      <Image
        source={require("../../assets/images/logement.jpg")}
        style={StyleSheet.absoluteFillObject as any}
        blurRadius={Platform.OS === "android" ? 8 : 12}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(240,238,233,0.75)" }]} />

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
            <Text style={styles.emptySub}>
              Elles apparaîtront ici après votre première réservation.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => {
              // 🔒 garder TA logique, juste robustesse pour array/object
              const lg = first(item.listings_logements);
              const imgs = (lg?.listing_images ?? [])
                .map((x) => x?.image_url)
                .filter(Boolean) as string[];

              const cover = imgs[0] || "";
              const second = imgs[1] || cover;
              const title = lg?.title ?? "Logement";
              const city = lg?.city ?? "";
              const cur = item.currency ?? "XOF";
              const range = fmtRange(item.start_date, item.end_date);
              const status = mapStatus(item.status);

              const coverUri = supaThumb(cover);
              const secondUri = supaThumb(second);

              return (
                <View style={styles.cardWrap}>
                  <View style={styles.card}>
                    {/* titre + statut */}
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.pill}>
                        <Text style={styles.pillTxt}>{status}</Text>
                      </View>
                    </View>

                    {/* ville + dates */}
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {city} • {range}
                    </Text>

                    {/* miniatures (2) */}
                    <View style={styles.thumbRow}>
                      <FastImage
                        source={coverUri ? { uri: coverUri, priority: FastImage.priority.normal } : PLACEHOLDER}
                        style={styles.thumb}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                      <FastImage
                        source={secondUri ? { uri: secondUri, priority: FastImage.priority.normal } : PLACEHOLDER}
                        style={styles.thumb}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    </View>

                    {/* total + bouton noir */}
                    <View style={styles.footerRow}>
                      <View>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{money(item.total_price, cur)}</Text>
                      </View>
                      <TouchableOpacity activeOpacity={0.9} style={styles.cta} onPress={() => openDetails(item.id)}>
                        <Text style={styles.ctaTxt}>Voir les détails</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
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
  emptySub: {
    marginTop: 6, color: "#666", fontWeight: "600",
    textAlign: "center", paddingHorizontal: 16,
  },

  // ——— Carte façon Apple
  cardWrap: { marginBottom: 16 },
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
  thumb: { flex: 1, height: THUMB_H, borderRadius: 14, overflow: "hidden" },

  footerRow: {
    marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  totalLabel: { color: "#6b6b6b", fontWeight: "700" },
  totalValue: { color: "#111", fontWeight: "900", fontSize: 18, marginTop: 2 },

  cta: { backgroundColor: "#111", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  ctaTxt: { color: "#fff", fontWeight: "900" },
});
