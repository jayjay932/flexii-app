// src/screens/AllReviewsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from '@/src/ui/Icon';;
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/src/lib/supabase";
import { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AllReviews">;

type Owner = { id: string; full_name: string; avatar_url?: string | null };
type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: Owner;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "long" });

export default function AllReviewsScreen({ route, navigation }: Props) {
  const { listingId, title } = route.params;

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "best" | "worst">("recent");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // 1) toutes les réservations de ce logement
        const { data: resRows, error: resErr } = await supabase
          .from("reservations")
          .select("id")
          .eq("logement_id", listingId)
          .in("status", ["completed", "confirmed"]);
        if (resErr) throw resErr;

        const ids = (resRows ?? []).map((r: any) => r.id);
        if (!ids.length) {
          if (!cancel) setReviews([]);
          return;
        }

        // 2) toutes les reviews pour ces réservations
        const { data: rws, error } = await supabase
          .from("reviews")
          .select(
            `
            id, rating, comment, created_at,
            reviewer:reviewer_id ( id, full_name, avatar_url )
          `
          )
          .in("reservation_id", ids);

        if (error) throw error;

        const arr: Review[] =
          (rws ?? []).map((r: any) => ({
            id: r.id,
            rating: Number(r.rating) || 0,
            comment: r.comment,
            created_at: r.created_at,
            reviewer: r.reviewer
              ? {
                  id: r.reviewer.id,
                  full_name: r.reviewer.full_name,
                  avatar_url: r.reviewer.avatar_url,
                }
              : undefined,
          })) ?? [];

        if (!cancel) setReviews(arr);
      } catch (e) {
        console.error(e);
        if (!cancel) setReviews([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [listingId]);

  // stats
  const { avg, counts } = useMemo(() => {
    if (!reviews.length) return { avg: undefined as number | undefined, counts: [0,0,0,0,0] as number[] };
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
    const avg = Math.round((sum / reviews.length) * 100) / 100;
    const c = [0,0,0,0,0];
    reviews.forEach((r) => {
      const idx = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
      c[idx] += 1;
    });
    return { avg, counts: c };
  }, [reviews]);

  // filtres
  const filtered = useMemo(() => {
    let arr = reviews.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((r) => (r.comment || "").toLowerCase().includes(q));
    }
    if (sort === "recent") {
      arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === "best") {
      arr.sort((a, b) => b.rating - a.rating);
    } else {
      arr.sort((a, b) => a.rating - b.rating);
    }
    return arr;
  }, [reviews, query, sort]);

  // “sous-notes” démo (facultatif — on les dérive de la moyenne pour coller au visuel)
  const subNote = (mult: number) => {
    const v = typeof avg === "number" ? Math.min(5, Math.max(0, avg * mult)) : 0;
    return Math.round(v * 10) / 10;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ? `Commentaires · ${title}` : "Commentaires"}
        </Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
        data={filtered}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={
          <>
            {/* Hero */}
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="leaf" size={32} color="#333" style={{ opacity: 0.7 }} />
                <Text style={styles.heroScore}>
                  {typeof avg === "number" ? avg.toFixed(2).replace(".", ",") : "—"}
                </Text>
                <Ionicons name="leaf" size={32} color="#333" style={{ opacity: 0.7 }} />
              </View>
              <Text style={styles.heroTitle}>Coup de cœur voyageurs</Text>
              <Text style={styles.heroDesc}>
                Ce logement fait partie des Coups de cœur voyageurs, à partir des évaluations,
                commentaires et de la fiabilité des annonces selon les voyageurs.
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.distCol}>
                <Text style={styles.distTitle}>Évaluation globale</Text>
                {[5,4,3,2,1].map((note, idx) => {
                  const total = reviews.length || 1;
                  const c = counts[note-1] || 0;
                  const pct = (c / total) * 100;
                  return (
                    <View key={note} style={styles.distLine}>
                      <Text style={styles.distLabel}>{note}</Text>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.subCard}>
                <Text style={styles.subTitle}>Propreté</Text>
                <Text style={styles.subValue}>{subNote(0.97).toFixed(1)}</Text>
                <Ionicons name="sparkles-outline" size={22} color="#111" />
              </View>
              <View style={styles.subCard}>
                <Text style={styles.subTitle}>Précision</Text>
                <Text style={styles.subValue}>{subNote(1.02).toFixed(1)}</Text>
                <Ionicons name="checkmark-circle-outline" size={22} color="#111" />
              </View>
              <View style={styles.subCard}>
                <Text style={styles.subTitle}>Arrivée</Text>
                <Text style={styles.subValue}>{subNote(1.0).toFixed(1)}</Text>
                <Ionicons name="log-in-outline" size={22} color="#111" />
              </View>
            </View>

            {/* Entête liste + tri */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>{reviews.length} commentaires</Text>
              <TouchableOpacity
                style={styles.sortPill}
                onPress={() =>
                  setSort((s) => (s === "recent" ? "best" : s === "best" ? "worst" : "recent"))
                }
              >
                <Text style={styles.sortPillText}>
                  {sort === "recent" ? "Les plus récents" : sort === "best" ? "Mieux notés" : "Moins bien notés"}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#111" />
              </TouchableOpacity>
            </View>

            {/* aide / fonctionnement */}
            <Text style={styles.helpLink}>Fonctionnement des commentaires</Text>

            {/* Recherche */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#666" />
              <TextInput
                placeholder="Rechercher dans les commentaires"
                placeholderTextColor="#999"
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.cardHeader}>
              <Image
                source={
                  item.reviewer?.avatar_url
                    ? { uri: item.reviewer.avatar_url }
                    : require("../../assets/images/logement.jpg")
                }
                style={styles.avatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.reviewer?.full_name ?? "Voyageur"}</Text>
                <Text style={styles.metaSmall}>{fmtDate(item.created_at)} · Séjour de quelques nuits</Text>
              </View>
            </View>

            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < Math.round(item.rating) ? "star" : "star-outline"}
                  size={14}
                  color="#111"
                />
              ))}
            </View>

            {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#666", marginTop: 24, textAlign: "center" }}>
            Aucun commentaire pour le moment.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: 12,
    paddingTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "800", color: "#111" },

  heroScore: { fontSize: 58, fontWeight: "900", color: "#111" },
  heroTitle: { marginTop: 6, fontSize: 20, fontWeight: "800", color: "#111", textAlign: "center" },
  heroDesc: {
    marginTop: 6,
    color: "#6b6b6b",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginTop: 18,
  },
  distCol: { flex: 1 },
  distTitle: { fontWeight: "800", color: "#111", marginBottom: 8 },
  distLine: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  distLabel: { width: 12, textAlign: "right", color: "#111", fontWeight: "700" },
  barBg: { flex: 1, height: 6, borderRadius: 6, backgroundColor: "#eee" },
  barFill: { height: 6, borderRadius: 6, backgroundColor: "#111" },

  subCard: {
    width: 92,
    paddingVertical: 10,
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(0,0,0,0.08)",
  },
  subTitle: { color: "#111", fontWeight: "700" },
  subValue: { fontSize: 18, fontWeight: "900", color: "#111", marginVertical: 4 },

  listHeaderRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listHeaderTitle: { fontSize: 24, fontWeight: "900", color: "#111" },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
  },
  sortPillText: { fontWeight: "800", color: "#111" },

  helpLink: {
    marginTop: 10,
    textDecorationLine: "underline",
    fontWeight: "700",
    color: "#111",
  },

  searchBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: "#111" },

  reviewCard: {
    marginTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  name: { fontSize: 16, fontWeight: "800", color: "#111" },
  metaSmall: { color: "#666", fontSize: 12, marginTop: 2 },

  starsRow: { flexDirection: "row", gap: 2, marginBottom: 8 },
  comment: { fontSize: 15, color: "#222", lineHeight: 22 },
});
