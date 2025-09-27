// src/screens/ReservationsScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ImageBackground,
  RefreshControl,
  Platform,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Reservations">;

type AnyListing = {
  title?: string | null;       // logement/expérience
  city?: string | null;
  listing_images?: { image_url: string | null }[] | null;
  marque?: string | null;      // véhicule
  modele?: string | null;      // véhicule
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

export default function ReservationsScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet");
        return;
      }
      if (userId !== uid) setUserId(uid);

      // Un seul SELECT pour les 3 types + photos
      const { data, error } = await supabase
        .from("reservations")
        .select(
          `
          id, start_date, end_date, total_price, currency, status,
          logement_id, vehicule_id, experience_id,
          listings_logements:logement_id (
            title, city,
            listing_images ( image_url )
          ),
          listings_vehicules:vehicule_id (
            marque, modele, city,
            listing_images ( image_url )
          ),
          listings_experiences:experience_id (
            title, city,
            listing_images ( image_url )
          )
        `
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .returns<Row[]>();

      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [navigation, userId]);

  // Session bootstrap (utile si on arrive direct sur l’écran)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!mounted) return;
      const uid = auth.session?.user?.id ?? null;
      if (uid) setUserId(uid);
      else navigation.replace("AuthSheet");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setUserId(sess?.user?.id ?? null);
    });
    return () => sub?.subscription.unsubscribe();
  }, [navigation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: écoute les réservations de l’utilisateur
  useEffect(() => {
    if (!userId) return;

    // nettoie un éventuel ancien canal
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const softRefresh = () => fetchData(); // pas de spinner ici (déjà à l’écran)

    const ch = supabase
      .channel(`reservations-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `user_id=eq.${userId}` },
        softRefresh
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchData]);

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
      {/* Fond doux */}
      <Image
        source={require("../../assets/images/logement.jpg")}
        style={RNStyleSheet.absoluteFillObject as any}
        blurRadius={Platform.OS === "android" ? 8 : 12}
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
            removeClippedSubviews
            windowSize={7}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            renderItem={({ item }) => {
              // Détecte le type (logement / vehicule / experience)
              const kind = item.logement_id
                ? "logement"
                : item.vehicule_id
                ? "vehicule"
                : "experience";

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

              // Sources FastImage (cache + priorité)
              const coverSrc: React.ComponentProps<typeof FastImage>["source"] = cover
                ? {
                    uri: cover,
                    priority: FastImage.priority.high,
                    cache: FastImage.cacheControl.immutable,
                  }
                : require("../../assets/images/logement.jpg");
              const secondSrc: React.ComponentProps<typeof FastImage>["source"] = second
                ? {
                    uri: second,
                    priority: FastImage.priority.normal,
                    cache: FastImage.cacheControl.immutable,
                  }
                : require("../../assets/images/logement.jpg");

              return (
                <View style={styles.cardWrap}>
                  {/* Rasterisation sur un View parent (et pas sur TouchableOpacity) */}
                  <View renderToHardwareTextureAndroid shouldRasterizeIOS>
                    <View style={styles.card}>
                      {/* Titre + statut */}
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {title}
                        </Text>
                        <View style={styles.pill}>
                          <Text style={styles.pillTxt}>{status}</Text>
                        </View>
                      </View>

                      {/* Ville + dates + type */}
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {city ? `${city} • ` : ""}
                        {range} •{" "}
                        {kind === "logement"
                          ? "Logement"
                          : kind === "vehicule"
                          ? "Véhicule"
                          : "Expérience"}
                      </Text>

                      {/* 2 miniatures (FastImage) */}
                      <View style={styles.thumbRow}>
                        <View style={styles.thumb}>
                          <FastImage source={coverSrc} style={styles.thumbImgFast} resizeMode={FastImage.resizeMode.cover} />
                        </View>
                        <View style={styles.thumb}>
                          <FastImage source={secondSrc} style={styles.thumbImgFast} resizeMode={FastImage.resizeMode.cover} />
                        </View>
                      </View>

                      {/* Total + CTA */}
                      <View style={styles.footerRow}>
                        <View>
                          <Text style={styles.totalLabel}>Total</Text>
                          <Text style={styles.totalValue}>{money(item.total_price, cur)}</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          style={styles.cta}
                          onPress={() => openDetails(item.id)}
                        >
                          <Text style={styles.ctaTxt}>Voir les détails</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
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
  emptySub: {
    marginTop: 6,
    color: "#666",
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 16,
  },

  // Carte
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#111", flex: 1 },
  cardMeta: { marginTop: 4, color: "#4b4b4b", fontWeight: "700" },

  pill: {
    backgroundColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillTxt: { fontWeight: "800", color: "#111", fontSize: 12 },

  thumbRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  thumb: { flex: 1, height: 110, borderRadius: 14, overflow: "hidden" },

  // FastImage remplit la vignette
  thumbImgFast: {
    ...RNStyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  } as any,

  footerRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: { color: "#6b6b6b", fontWeight: "700" },
  totalValue: { color: "#111", fontWeight: "900", fontSize: 18, marginTop: 2 },

  cta: {
    backgroundColor: "#111",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  ctaTxt: { color: "#fff", fontWeight: "900" },
});
