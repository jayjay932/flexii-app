import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ImageBackground,
  ActivityIndicator, Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons, { IconName } from '@/src/ui/Icon';
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AvailabilityDashboard">;

type Card = {
  kind: "logement" | "vehicule" | "experience";
  id: string;
  title: string;
  city?: string | null;
  basePrice?: number | null;
  currency?: string | null;
  cover?: string | null;
};

export default function AvailabilityDashboardScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet" as any);
        return;
      }

      const qL = supabase
        .from("listings_logements")
        .select("id, title, city, price, created_at, listing_images(image_url)")
        .eq("owner_id", uid);

      const qV = supabase
        .from("listings_vehicules")
        .select("id, marque, modele, city, price, created_at, listing_images(image_url)")
        .eq("owner_id", uid);

      const qE = supabase
        .from("listings_experiences")
        .select("id, title, city, price, created_at, listing_images(image_url)")
        .eq("owner_id", uid);

      const [L, V, E] = await Promise.all([qL, qV, qE]);

      const cards: Card[] = [
        ...(L.data ?? []).map((r: any) => ({
          kind: "logement" as const,
          id: r.id,
          title: r.title,
          city: r.city,
          basePrice: r.price,
          currency: "XOF",
          cover: r.listing_images?.[0]?.image_url ?? null,
        })),
        ...(V.data ?? []).map((r: any) => ({
          kind: "vehicule" as const,
          id: r.id,
          title: `${r.marque ?? ""} ${r.modele ?? ""}`.trim() || "Véhicule",
          city: r.city,
          basePrice: r.price ?? null,
          currency: "XOF",
          cover: r.listing_images?.[0]?.image_url ?? null,
        })),
        ...(E.data ?? []).map((r: any) => ({
          kind: "experience" as const,
          id: r.id,
          title: r.title,
          city: r.city,
          basePrice: r.price ?? null,
          currency: "XOF",
          cover: r.listing_images?.[0]?.image_url ?? null,
        })),
      ];

      setRows(cards);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCalendar = (c: Card) =>
    navigation.navigate("AvailabilityCalendar", {
      kind: c.kind,
      id: c.id,
      title: c.title,
      basePrice: c.basePrice ?? undefined,
      currency: c.currency ?? undefined,
    });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title}>Mes annonces</Text>
          <View style={{ width: 36 }} />
        </View>

        <FlatList
          data={rows}
          keyExtractor={(it) => `${it.kind}-${it.id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <ImageBackground
                source={
                  item.cover
                    ? { uri: item.cover }
                    : require("../../assets/images/logement.jpg")
                }
                style={styles.cover}
                imageStyle={{ borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
                blurRadius={Platform.OS === "android" ? 0 : 0}
                resizeMode="cover"
              >
                <TouchableOpacity style={styles.fab} onPress={() => openCalendar(item)}>
                  <Ionicons name="create" size={18} color="#111" />
                </TouchableOpacity>
              </ImageBackground>

              <View style={{ padding: 14 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.kind === "logement" ? "Logement" : item.kind === "vehicule" ? "Véhicule" : "Expérience"}
                  {item.city ? ` · ${item.city}` : ""}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.priceTxt}>
                    {item.basePrice ? `${Number(item.basePrice).toLocaleString("fr-FR")} FCFA / jour` : "—"}
                  </Text>

                  <TouchableOpacity style={styles.blackBtn} onPress={() => openCalendar(item)}>
                    <Text style={styles.blackBtnTxt}>Gérer dispo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const R = 18;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: {
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  title: { fontSize: 28, fontWeight: "900", color: "#111" },
  roundBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center",
  },

  card: {
    backgroundColor: "#fff", borderRadius: R,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    marginBottom: 14,
  },
  cover: { height: 160, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  fab: {
    position: "absolute", right: 12, bottom: 12,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  cardMeta: { marginTop: 2, color: "#666", fontWeight: "700" },
  cardFooter: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceTxt: { fontWeight: "900", color: "#111" },
  blackBtn: { backgroundColor: "#111", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  blackBtnTxt: { color: "#fff", fontWeight: "900" },
});
