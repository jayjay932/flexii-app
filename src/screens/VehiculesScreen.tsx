// src/screens/VehiculesScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ListRenderItem } from "react-native";
import FastImage from "react-native-fast-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import SegmentedTabs from "@/src/components/SegmentedTabs";
import SearchBar from "@/src/components/SearchBar";
import BottomNavBar, { TabKey } from "@/src/components/BottomNavBar";
import VehicleSearchModal, { VehicleFilters } from "./VehicleSearchModal";

// .

type Vehicule = {
  id: string;
  marque: string;
  modele: string;
  annee: number | null;
  description?: string | null;
  rental_type: string; // 'heure' | 'jour' | 'mois'
  price: number;
  city: string;
  quartier: string | null;
  title?: string | null;
  image_url?: string | null;
  image_id?: string | null; // id de la première image (la plus récente)
  is_approved?: boolean | null;
};

const unitFor = (t?: string | null) => {
  const v = (t || "jour").toLowerCase();
  if (["heure", "hour"].includes(v)) return "heure";
  if (["jour", "day"].includes(v)) return "jour";
  if (["mois", "month"].includes(v)) return "mois";
  return v;
};

const PANEL_BG = "#e6e6e6ff";
const CARD_BG = "#f0eee9";
const { width: SCREEN_W } = Dimensions.get("window");

// Chips strictement typés
const CHIP_LABELS = ["SUV", "Berline", "Moto"] as const;
type ChipLabel = (typeof CHIP_LABELS)[number];
const CHIP_KEYWORDS: Record<ChipLabel, string[]> = {
  SUV: ["suv", "4x4", "crossover"],
  Berline: ["berline", "sedan"],
  Moto: ["moto", "motorbike", "bike"],
};

// ✅ type sûr pour la source FastImage (évite les erreurs de namespace)
type FISource = React.ComponentProps<typeof FastImage>["source"];

export default function VehiculesScreen({ navigation }: any) {
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<VehicleFilters>({});
  const [activeChip, setActiveChip] = useState<ChipLabel | null>(null);
  const [tab, setTab] = useState<"Logements" | "Véhicules" | "Expériences">("Véhicules");

  // Realtime (un seul canal)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // cache-buster par véhicule (maj quand image_id change)
  const lastImageIdRef = useRef<Record<string, string | null>>({});
  const [imageBust, setImageBust] = useState<Record<string, number>>({});

  // Filtres actifs ?
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      (filters.searchQuery && filters.searchQuery.trim() !== "") ||
        (filters.locationText && filters.locationText.trim() !== "") ||
        typeof filters.minPrice === "number" ||
        typeof filters.maxPrice === "number" ||
        (filters.vehicleTypes && filters.vehicleTypes.length > 0) ||
        activeChip
    );
  }, [filters, activeChip]);

  const resetFilters = useCallback(() => {
    setFilters({});
    setActiveChip(null);
  }, []);

  const fetchVehicules = useCallback(
    async (opts?: { showSpinner?: boolean }) => {
      const showSpinner = opts?.showSpinner ?? true;
      if (showSpinner) setLoading(true);

      let query = supabase
        .from("listings_vehicules")
        .select(
          `
          id,
          marque,
          modele,
          annee,
          description,
          rental_type,
          price,
          city,
          quartier,
          title,
          is_approved,
          listing_images ( id, image_url )
        `
        )
        .eq("is_approved", true)
        .order("id", { ascending: false, foreignTable: "listing_images" });

      // Recherche texte
      if (filters.searchQuery?.trim()) {
        const q = filters.searchQuery.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.or(`title.ilike.%${q}%,marque.ilike.%${q}%,modele.ilike.%${q}%`);
      }

      // Ville / quartier
      if (filters.locationText?.trim()) {
        const c = filters.locationText.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.or(`city.ilike.%${c}%,quartier.ilike.%${c}%`);
      }

      // Prix min/max
      if (typeof filters.minPrice === "number") query = query.gte("price", filters.minPrice);
      if (typeof filters.maxPrice === "number") query = query.lte("price", filters.maxPrice);

      // Chip catégorie
      if (activeChip) {
        const kws = CHIP_KEYWORDS[activeChip];
        const ors = [
          ...kws.map((k) => `title.ilike.%${k}%`),
          ...kws.map((k) => `marque.ilike.%${k}%`),
          ...kws.map((k) => `modele.ilike.%${k}%`),
        ].join(",");
        query = query.or(ors);
      }

      // Types depuis le modal
      if (filters.vehicleTypes && filters.vehicleTypes.length > 0) {
        const validTypes = filters.vehicleTypes.filter((v): v is ChipLabel =>
          (CHIP_LABELS as readonly string[]).includes(v as string)
        );
        if (validTypes.length > 0) {
          const all = validTypes.flatMap((v) => CHIP_KEYWORDS[v]);
          const ors = [
            ...all.map((k) => `title.ilike.%${k}%`),
            ...all.map((k) => `marque.ilike.%${k}%`),
            ...all.map((k) => `modele.ilike.%${k}%`),
          ].join(",");
          query = query.or(ors);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        setVehicules([]);
      } else {
        const items: Vehicule[] =
          (data as any[]).map((x) => {
            const img = Array.isArray(x.listing_images) ? x.listing_images[0] : null;
            return {
              id: x.id,
              marque: x.marque,
              modele: x.modele,
              annee: typeof x.annee === "number" ? x.annee : x.annee ? Number(x.annee) : null,
              description: x.description,
              rental_type: x.rental_type,
              price: Number(x.price),
              city: x.city,
              quartier: x.quartier,
              title: x.title,
              image_url: img?.image_url ?? null,
              image_id: img?.id ?? null,
            };
          }) ?? [];

        // met à jour le cache-buster si l'image_id a changé
        setImageBust((prev) => {
          const next = { ...prev };
          const nextImageIds: Record<string, string | null> = {};
          items.forEach((it) => {
            const prevId = lastImageIdRef.current[it.id] ?? null;
            const curId = it.image_id ?? null;
            nextImageIds[it.id] = curId;
            if (prevId !== curId) {
              next[it.id] = Date.now(); // nouvelle version
            }
          });
          lastImageIdRef.current = nextImageIds;
          return next;
        });

        setVehicules(items);
      }

      if (showSpinner) setLoading(false);
    },
    [activeChip, filters]
  );

  // Chargement initial + à chaque changement de filtres/chips
  useEffect(() => {
    fetchVehicules({ showSpinner: true });
  }, [fetchVehicules]);

  // Realtime : UN SEUL canal
  useEffect(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const handleChange = () => fetchVehicules({ showSpinner: false });

    const ch = supabase
      .channel("vehicules-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings_vehicules" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listing_images" },
        (payload) => {
          const vehiculeId =
            (payload.new as any)?.vehicule_id ?? (payload.old as any)?.vehicule_id;
          if (vehiculeId) {
            setImageBust((prev) => ({ ...prev, [vehiculeId]: Date.now() }));
          }
          handleChange();
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchVehicules]);

  // Soft refresh au focus
  useEffect(() => {
    const unsub = navigation.addListener("focus", () =>
      fetchVehicules({ showSpinner: false })
    );
    return unsub;
  }, [navigation, fetchVehicules]);

  const handleTabChange = (next: "Logements" | "Véhicules" | "Expériences") => {
    setTab(next);
    if (next === "Logements") navigation.navigate("Logements");
    if (next === "Véhicules") return;
    if (next === "Expériences") navigation.navigate("Experiences");
  };

  const handleBottomTab = (k: TabKey) => {
    switch (k) {
      case "logements":
        navigation.navigate("Logements");
        break;
      case "Favoris":
        navigation.navigate("Favoris");
        break;
      case "Voyages":
        navigation.navigate("Reservations");
        break;
      case "Messages":
        navigation.navigate("Conversations");
        break;
      case "Profil":
        navigation.navigate("Profile");
        break;
    }
  };

  const titleOf = (v: Vehicule) => v.title || `${v.marque} ${v.modele}`.trim();

  // ✅ renderItem typé (évite les erreurs) + FastImage pour perf


// ...

const renderCard: ListRenderItem<Vehicule> = ({ item }) => {
  const bust = imageBust[item.id];
  const uri =
    item.image_url &&
    `${item.image_url}${item.image_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(
      String(bust ?? 1)
    )}`;

  const src: React.ComponentProps<typeof FastImage>["source"] = uri
    ? {
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }
    : require("../../assets/images/logement.jpg");

  return (
    <View renderToHardwareTextureAndroid={true} shouldRasterizeIOS={true}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate("VehiculeDetails", { id: item.id })}
        style={styles.card}
      >
        <View style={styles.cardImageWrap}>
          <FastImage
            key={`${item.id}-${item.image_id ?? "noimg"}-${bust ?? 0}`}
            source={src}
            style={styles.cardImage}
            resizeMode={FastImage.resizeMode.cover}
          />
          <View style={styles.favBtn}>
            <Ionicons name="heart-outline" size={20} color="#111" />
          </View>
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {titleOf(item)}
          </Text>
          <Text style={styles.cardPrice}>
            {item.price} €/ {unitFor(item.rental_type)}
          </Text>
        </View>

        <View style={styles.specRow}>
          <View style={styles.specItem}>
            <Ionicons name="pricetag-outline" size={16} color="#111" />
            <Text style={styles.specText} numberOfLines={1}>
              {item.marque}
            </Text>
          </View>
          <View style={styles.specItem}>
            <Ionicons name="car-sport-outline" size={16} color="#111" />
            <Text style={styles.specText} numberOfLines={1}>
              {item.modele}
            </Text>
          </View>
          <View style={styles.specItem}>
            <Ionicons name="calendar-outline" size={16} color="#111" />
            <Text style={styles.specText}>{item.annee ?? "—"}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

 

  const keyExtractor = useCallback((it: Vehicule) => it.id, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require("../../assets/images/vehicule.jpg")}
        style={styles.banner}
        imageStyle={{ resizeMode: "cover" }}
      >
        <SafeAreaView edges={["top"]} style={styles.bannerSafe}>
          <SegmentedTabs value={tab} onChange={handleTabChange} />

          {/* Recherche + chips empilés */}
          <View style={styles.searchWrap}>
            <SearchBar topOffset={0} style={{ width: "92%" }} onPress={() => setSearchOpen(true)} />
            <View style={styles.chipsRow}>
              {CHIP_LABELS.map((label) => {
                const active = activeChip === label;
                return (
                  <TouchableOpacity
                    key={label}
                    onPress={() => setActiveChip((prev) => (prev === label ? null : label))}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bouton Réinitialiser juste sous la recherche/chips */}
            {hasActiveFilters && (
              <TouchableOpacity onPress={resetFilters} style={styles.resetInlineBtn} activeOpacity={0.9}>
                <Ionicons name="refresh" size={16} color="#111" />
                <Text style={styles.resetInlineTxt}>Réinitialiser</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </ImageBackground>

      <View style={styles.panel}>
        {/* En-tête section avec bouton reset à droite */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Véhicules populaires</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} style={styles.resetSmallBtn} activeOpacity={0.9}>
              <Ionicons name="refresh" size={16} color="#111" />
              <Text style={styles.resetSmallTxt}>Réinitialiser</Text>
            </TouchableOpacity>
          )}
        </View>

        {vehicules.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: "#555", fontWeight: "700" }}>
              Aucun véhicule ne correspond à votre recherche.
            </Text>
            <TouchableOpacity onPress={resetFilters} style={styles.resetBtn} activeOpacity={0.9}>
              <Text style={styles.resetTxt}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList<Vehicule>
            data={vehicules}
            keyExtractor={keyExtractor}
            renderItem={renderCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 80 }}
            // ⚡️ perf : on rend peu d’items au début, fenêtre courte, clipping
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            // scrollsToTop et autres options safe par défaut
          />
        )}
      </View>

      <BottomNavBar current={"logements"} onChange={handleBottomTab} />

      <VehicleSearchModal
        visible={searchOpen}
        initial={filters}
        onClose={() => setSearchOpen(false)}
        onSubmit={(f) => {
          setFilters(f);
          setActiveChip(null);
          setSearchOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PANEL_BG },

  // Banner
  banner: {
    width: "100%",
    height: 400,
  },
  bannerSafe: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchWrap: {
    marginTop: 14,
    alignItems: "center",
  },
  chipsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  chip: {
    backgroundColor: "rgba(183, 183, 183, 0.92)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E6E2DA" },
  chipText: { fontSize: 14, fontWeight: "800", color: "#222" },
  chipTextActive: { color: "#111" },

  // Panel
  panel: {
    flex: 1,
    backgroundColor: PANEL_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -16,
    paddingTop: 12,
    paddingHorizontal: 16,
  },

  // Section header + bouton reset
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 22, fontWeight: "900", color: "#111" },

  resetSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetSmallTxt: { fontWeight: "900", color: "#111" },

  resetInlineBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resetInlineTxt: { fontWeight: "900", color: "#111" },

  // Card
  card: {
    backgroundColor: "#e2dbdbff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    overflow: "hidden",
  },
  cardImageWrap: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: "hidden",
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  cardImage: { width: "100%", height: "100%" },
  favBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "rgba(253, 245, 245, 0.95)",
    borderRadius: 16,
    padding: 6,
  },

  cardRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#111", flex: 1, paddingRight: 10 },
  cardPrice: { fontSize: 16, fontWeight: "900", color: "#111" },

  specRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingBottom: 2,
  },
  specItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  specText: { fontWeight: "800", color: "#222" },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Bouton reset (état vide)
  resetBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetTxt: { color: "#fff", fontWeight: "900" },
});
