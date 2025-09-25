// src/screens/HostProfileScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  ScrollView,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "HostProfile">;

type Host = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  created_at?: string | null;
};

type Card = {
  id: string;
  title: string;
  city: string;
  quartier: string | null;
  price: number;
  rental_type: string;
  images: string[];
  rating?: number;
  reviews_count?: number;
};

const { width } = Dimensions.get("window");
const HERO_H = 240; // hauteur du bandeau
const PANEL_BG = "#F5EFE6";

export default function HostProfileScreen({ route, navigation }: Props) {
  const { hostId, hostName, avatarUrl } = route.params;

  const [host, setHost] = useState<Host | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoading(true);

        // 1) hôte
        const { data: u } = await supabase
          .from("users")
          .select("id, full_name, avatar_url, created_at")
          .eq("id", hostId)
          .maybeSingle<Host>();

        // 2) listings de l’hôte
        type Row = {
          id: string;
          title: string;
          city: string;
          quartier: string | null;
          price: number;
          rental_type: string;
          listing_images?: { image_url: string | null }[];
        };
        const { data: listings } = (await supabase
          .from("listings_logements")
          .select(
            `
            id, title, city, quartier, price, rental_type,
            listing_images ( image_url )
          `
          )
          .eq("owner_id", hostId)
          .eq("is_approved", true)
          .order("created_at", { ascending: false })) as { data: Row[] | null };

        // 3) (simple) agrégations avis par logement
        const ids = (listings ?? []).map((l) => l.id);
        let ratingByListing: Record<string, { sum: number; count: number }> = {};
        if (ids.length) {
          const { data: revs } = await supabase
            .from("reviews")
            .select("rating, reservations:reservation_id ( logement_id )")
            .not("reservation_id", "is", null);

          (revs ?? []).forEach((r: any) => {
            const lodgId = r?.reservations?.logement_id;
            if (!lodgId || !ids.includes(lodgId)) return;
            if (!ratingByListing[lodgId])
              ratingByListing[lodgId] = { sum: 0, count: 0 };
            ratingByListing[lodgId].sum += Number(r.rating) || 0;
            ratingByListing[lodgId].count += 1;
          });
        }

        const mapped: Card[] =
          (listings ?? []).map((l) => {
            const imgs =
              (l.listing_images ?? [])
                .map((x) => x?.image_url || undefined)
                .filter(Boolean) as string[];
            const agg = ratingByListing[l.id];
            const rating =
              agg && agg.count > 0
                ? Math.round((agg.sum / agg.count) * 10) / 10
                : undefined;

            return {
              id: l.id,
              title: l.title,
              city: l.city,
              quartier: l.quartier,
              price: Number(l.price),
              rental_type: l.rental_type,
              images: imgs, // pas de chaîne vide
              rating,
              reviews_count: agg?.count ?? 0,
            };
          }) ?? [];

        if (!stop) {
          setHost(
            u ?? { id: hostId, full_name: hostName ?? "Hôte", avatar_url: avatarUrl ?? null }
          );
          setCards(mapped);
        }
      } catch (e) {
        console.error(e);
        if (!stop) {
          setHost({ id: hostId, full_name: hostName ?? "Hôte", avatar_url: avatarUrl ?? null });
          setCards([]);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [hostId]);

  const yearsOnApp = useMemo(() => {
    if (!host?.created_at) return undefined;
    try {
      const start = new Date(host.created_at);
      const now = new Date();
      return Math.max(0, now.getFullYear() - start.getFullYear());
    } catch {
      return undefined;
    }
  }, [host?.created_at]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // Arrière-plan = 1ère image du 1er logement ou avatar (simple arrière-plan)
 // APRÈS
const LOCAL_COVER = require("../../assets/images/logement2.jpg"); // ← image locale
const cover = LOCAL_COVER; // on force l’usage de l’image locale



  return (
    <View style={{ flex: 1, backgroundColor: PANEL_BG }}>
      {/* ====== Bandeau image (arrière-plan) ====== */}
    
<ImageBackground
  source={cover}   // pas de { uri: ... } pour une ressource locale
  style={{ width, height: HERO_H }}
  imageStyle={{ resizeMode: "cover" }} // ou "contain" si tu ne veux pas de recadrage
>
        <SafeAreaView edges={["top"]} style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="share-outline" size={18} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="heart-outline" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Overlay nom + avatar (remonté) */}
        <View style={styles.headerOverlay}>
          <Image
            source={
              host?.avatar_url
                ? { uri: host.avatar_url }
                : require("../../assets/images/logement.jpg")
            }
            style={styles.hostAvatar}
          />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.hostName}>{host?.full_name ?? "Hôte"}</Text>
            {yearsOnApp !== undefined && (
              <Text style={styles.hostSub}>
                {yearsOnApp} an{yearsOnApp > 1 ? "s" : ""} sur la plateforme
              </Text>
            )}
          </View>
        </View>
      </ImageBackground>

      {/* ====== Panneau arrondi + cards espacées ====== */}
      <View style={styles.panel}>
        <FlatList
          data={cards}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />} // espace entre cards
          renderItem={({ item }) => (
            <ListingCard
              item={item}
              onPress={() => navigation.navigate("LogementDetails", { id: item.id })}
            />
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#666", marginTop: 12 }}>
              Cet hôte n’a encore publié aucune annonce.
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

/** === Carte annonce (style Airbnb) === */
function ListingCard({
  item,
  onPress,
}: {
  item: Card;
  onPress: () => void;
}) {
  const [idx, setIdx] = useState(0);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      {/* image + points */}
      <View style={styles.cardImageWrap}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const w = e.nativeEvent.layoutMeasurement.width;
            const x = e.nativeEvent.contentOffset.x;
            const i = Math.round(x / w);
            if (i !== idx) setIdx(i);
          }}
          scrollEventThrottle={16}
        >
          {(item.images?.length ? item.images : [undefined]).map((uri, i) => (
            <Image
              key={`${uri ?? "placeholder"}-${i}`}
              source={uri ? { uri } : require("../../assets/images/logement.jpg")}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* points */}
        {(item.images?.length ?? 0) > 1 && (
          <View style={styles.dotsRow}>
            {item.images.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
            ))}
          </View>
        )}

        {/* cœur overlay */}
        <View style={styles.heartWrap}>
          <Ionicons name="heart-outline" size={20} color="#fff" />
        </View>
      </View>

      {/* texte */}
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title} {item.quartier ? `- ${item.quartier}` : ""}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        Suite/Chalet cosy • {item.city}
      </Text>
      <Text style={styles.cardSub2} numberOfLines={1}>
        Hôte particulier
      </Text>

      <View style={styles.cardRow}>
        <Text style={styles.cardPrice}>
          {item.price} XOF <Text style={styles.cardUnit}>pour 1 {item.rental_type}</Text>
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="star" size={14} color="#111" />
          <Text style={styles.cardNote}>
            {(item.rating ?? 5).toFixed(1)}{" "}
            <Text style={{ color: "#666" }}>({item.reviews_count ?? 0})</Text>
          </Text>
        </View>
      </View>

      <Text style={styles.freeCancel}>Annulation gratuite</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // bandeau
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  iconBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  headerOverlay: {
    position: "absolute",
    left: 16,
    bottom: 36, // ← remonté pour ne pas être caché par le panneau
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  hostAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#eee" },
  hostName: { fontSize: 20, fontWeight: "900", color: "#111" },
  hostSub: { fontSize: 12, color: "#333", marginTop: 2 },

  // panneau arrondi qui chevauche l’image
  panel: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18, // chevauche le bandeau sans couvrir l’overlay
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 8,
    elevation: 2,
  },

  // card
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  cardImageWrap: {
    width: "100%",
    height: 210,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#f1f1f1",
  },
  cardImage: { width: width - 28 - 24, height: 210 }, // remplit le wrap (padding pris en compte)
  dotsRow: {
    position: "absolute",
    bottom: 8,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff" },
  heartWrap: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  cardTitle: { marginTop: 10, fontSize: 16, fontWeight: "800", color: "#111" },
  cardSub: { marginTop: 2, fontSize: 13, color: "#666" },
  cardSub2: { marginTop: 2, fontSize: 13, color: "#666" },

  cardRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardPrice: { fontSize: 15, fontWeight: "900", color: "#111" },
  cardUnit: { fontSize: 13, fontWeight: "700", color: "#111" },
  cardNote: { fontSize: 13, fontWeight: "800", color: "#111" },
  freeCancel: { marginTop: 2, fontSize: 12, color: "#666" },
});
