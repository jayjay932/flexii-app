// src/screens/OwnerReservationsScreen.tsx
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
  Dimensions,
  PixelRatio,
  Image, // pour le fond flou
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ReservationsRecues">;

/** Relation embarquée normalisée */
type AnyListing = {
  title?: string | null;
  city?: string | null;
  listing_images?: { image_url: string | null }[];
  marque?: string | null; // véhicule
  modele?: string | null; // véhicule
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
  // Ces trois champs sont ceux que TU consommes dans le render :
  listings_logements?: AnyListing | null;
  listings_vehicules?: AnyListing | null;
  listings_experiences?: AnyListing | null;
  // Suivant tes selects, Supabase peut aussi renvoyer:
  logement?: AnyListing | AnyListing[] | null;
  vehicule?: AnyListing | AnyListing[] | null;
  experience?: AnyListing | AnyListing[] | null;
};

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: (cur as any) || "XOF" }).format(
    Number(n || 0)
  );

const fmtRange = (a: string, b: string) => {
  const A = new Date(a),
    B = new Date(b);
  const opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${A.toLocaleDateString("fr-FR", opt)} – ${B.toLocaleDateString("fr-FR", opt)}`;
};

// PostgREST peut renvoyer un tableau sur les relations → on prend le 1er
function takeOne<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] as T) ?? null : (val as T);
}

/* ------- Helpers images (miniatures Supabase + cache) ------- */
const { width: SCREEN_W } = Dimensions.get("window");
const THUMB_H = 110;
const THUMB_W = (SCREEN_W - 16 * 2 - 12) / 2; // 2 colonnes, padding 16, gap 12
const PLACEHOLDER1 = require("../../assets/images/logement2.jpg");
const PLACEHOLDER2 = require("../../assets/images/logement.jpg");

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
  return url || undefined;
};

export default function OwnerReservationsScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // —— Anti-race condition (ignore les réponses obsolètes) ——
  const reqSeq = useRef(0);

  // —— Debounce (typé de façon portable RN/Web) ——
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

        // —— Logements (⚠️ je garde TA requête et ta logique)
        const qL = await supabase
          .from("reservations")
          .select(
            `
            id, created_at, start_date, end_date, status, total_price, currency, espece_confirmation,
            logement_id, vehicule_id, experience_id,
            transactions!inner ( status ),
            logement:logement_id!inner ( id, title, owner_id, city, listing_images ( image_url ) )
          `
          )
          .eq("logement.owner_id", uid)
          .order("start_date", { ascending: false });

        // —— Véhicules
        const qV = await supabase
          .from("reservations")
          .select(
            `
            id, created_at, start_date, end_date, status, total_price, currency, espece_confirmation,
            logement_id, vehicule_id, experience_id,
            transactions!inner ( status ),
            vehicule:vehicule_id!inner ( id, title, owner_id, marque, modele, city, listing_images ( image_url ) )
          `
          )
          .eq("vehicule.owner_id", uid)
          .order("start_date", { ascending: false });

        // —— Expériences
        const qE = await supabase
          .from("reservations")
          .select(
            `
            id, created_at, start_date, end_date, status, total_price, currency, espece_confirmation,
            logement_id, vehicule_id, experience_id,
            transactions!inner ( status ),
            experience:experience_id!inner ( id, title, owner_id, city, listing_images ( image_url ) )
          `
          )
          .eq("experience.owner_id", uid)
          .order("start_date", { ascending: false });

        const [L, V, E] = await Promise.all([qL, qV, qE]);
        if (L.error) throw L.error;
        if (V.error) throw V.error;
        if (E.error) throw E.error;

        // Normalisation (⚠️ je ne change pas ta logique d’affichage : je remplis juste les champs attendus)
        const normL: Row[] = (L.data as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          espece_confirmation: r.espece_confirmation ?? null,
          logement_id: r.logement_id ?? r.logement?.id ?? null,
          vehicule_id: r.vehicule_id ?? null,
          experience_id: r.experience_id ?? null,
          // supporte 'logement' ou 'listings_logements'
          listings_logements: (takeOne<AnyListing>(r.listings_logements) ??
            takeOne<AnyListing>(r.logement)) as AnyListing | null,
          listings_vehicules: null,
          listings_experiences: null,
        }));

        const normV: Row[] = (V.data as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          espece_confirmation: r.espece_confirmation ?? null,
          logement_id: r.logement_id ?? null,
          vehicule_id: r.vehicule_id ?? r.vehicule?.id ?? null,
          experience_id: r.experience_id ?? null,
          listings_logements: null,
          // supporte 'vehicule' ou 'listings_vehicules'
          listings_vehicules: (takeOne<AnyListing>(r.listings_vehicules) ??
            takeOne<AnyListing>(r.vehicule)) as AnyListing | null,
          listings_experiences: null,
        }));

        const normE: Row[] = (E.data as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          start_date: r.start_date,
          end_date: r.end_date,
          total_price: r.total_price,
          currency: r.currency,
          status: r.status,
          espece_confirmation: r.espece_confirmation ?? null,
          logement_id: r.logement_id ?? null,
          vehicule_id: r.vehicule_id ?? null,
          experience_id: r.experience_id ?? r.experience?.id ?? null,
          listings_logements: null,
          listings_vehicules: null,
          // supporte 'experience' ou 'listings_experiences'
          listings_experiences: (takeOne<AnyListing>(r.listings_experiences) ??
            takeOne<AnyListing>(r.experience)) as AnyListing | null,
        }));

        const merged = [...normL, ...normV, ...normE].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (ticket === reqSeq.current) setRows(merged);

        // Précharge léger (non bloquant)
        try {
          const urls =
            merged
              .flatMap((it) => {
                const Lst =
                  it.listings_logements ?? it.listings_vehicules ?? it.listings_experiences;
                return Lst?.listing_images?.map((x) => x?.image_url) ?? [];
              })
              .filter(Boolean)
              .slice(0, 30) as string[];
          FastImage.preload(urls.map((u) => ({ uri: supaThumb(u), priority: FastImage.priority.low })));
        } catch {}
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

    // re-fetch rapide au retour sur l’écran
    const offFocus = navigation.addListener("focus", () => fetchData(true));

    // —— Realtime —— (patch local immédiat sur UPDATE)
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

          // Patch local instantané (évite l’ancien statut “En attente”)
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

          // petit resync silencieux pour les relations/joins
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const openDetails = (id: string) => {
    const parent = navigation.getParent?.();
    try {
      navigation.navigate("OwnerReservationDetails" as any, { id });
    } catch {
      parent?.navigate?.("OwnerReservationDetails" as any, { id });
    }
  };

  const empty = !loading && rows.length === 0;

  return (
    <View style={styles.root}>
      {/* Fond doux */}
      <Image
        source={require("../../assets/images/logement.jpg")}
        style={StyleSheet.absoluteFillObject as any}
        blurRadius={Platform.OS === "android" ? 8 : 12}
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
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
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

              const imgs = L?.listing_images?.map((x) => x?.image_url).filter(Boolean) ?? [];
              const cover = (imgs[0] as string) || "";
              const second = (imgs[1] as string) || cover;

              const title =
                kind === "vehicule"
                  ? `${L?.marque ?? ""} ${L?.modele ?? ""}`.trim() || "Véhicule"
                  : L?.title || (kind === "logement" ? "Logement" : "Expérience");

              const city = L?.city ?? "";
              const cur = item.currency ?? "XOF";
              const range = fmtRange(item.start_date, item.end_date);
              const status =
                item.status === "confirmed"
                  ? "Confirmée"
                  : item.status === "pending"
                  ? "En attente"
                  : item.status === "cancelled"
                  ? "Annulée"
                  : "Terminée";

              const coverUri = supaThumb(cover);
              const secondUri = supaThumb(second);

              return (
                <View style={styles.cardWrap}>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.pill}>
                        <Text style={styles.pillTxt}>{status}</Text>
                      </View>
                    </View>

                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {city} • {range} •{" "}
                      {kind === "logement" ? "Logement" : kind === "vehicule" ? "Véhicule" : "Expérience"}
                    </Text>

                    <View style={styles.thumbRow}>
                      <FastImage
                        source={coverUri ? { uri: coverUri, priority: FastImage.priority.normal } : PLACEHOLDER1}
                        style={styles.thumb}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                      <FastImage
                        source={secondUri ? { uri: secondUri, priority: FastImage.priority.normal } : PLACEHOLDER2}
                        style={styles.thumb}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    </View>

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
  emptySub: { marginTop: 6, color: "#666", fontWeight: "600", textAlign: "center", paddingHorizontal: 16 },

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

  footerRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { color: "#6b6b6b", fontWeight: "700" },
  totalValue: { color: "#111", fontWeight: "900", fontSize: 18, marginTop: 2 },

  cta: { backgroundColor: "#111", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  ctaTxt: { color: "#fff", fontWeight: "900" },
});
