import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import SearchBar from "@/src/components/SearchBar";
import SegmentedTabs from "@/src/components/SegmentedTabs";
import BottomNavBar, { TabKey } from "@/src/components/BottomNavBar";
import SearchModal, { Filters as BaseFilters } from "./SearchFiltersModal";

type Filters = BaseFilters & { datesStart?: string; datesEnd?: string };
type Logement = {
  id: string;
  title: string;
  description: string;
  price: number;
  city: string;
  quartier: string | null;
  image_url?: string;
  __empty?: boolean;
  rental_type?: string | null;
};

const unitFor = (t?: string | null) => {
  const v = (t || "nuit").toLowerCase();
  if (["nuit", "night"].includes(v)) return "nuit";
  if (["jour", "day"].includes(v)) return "jour";
  if (["semaine", "week"].includes(v)) return "semaine";
  if (["mois", "month"].includes(v)) return "mois";
  return v;
};

const TYPE_MAP: Record<string, string[]> = {
  Hôtel: ["hotel", "hôtel", "Hotel", "Hôtel"],
  "Appartement meublé": [
    "appartement",
    "appartement meublé",
    "appartement_meublé",
    "Appartement",
    "Appartement meublé",
  ],
  "Maison à louer": ["maison", "maison à louer", "maison_a_louer", "Maison", "Maison à louer", "house"],
};
const CHIP_LABELS = ["Tout", ...Object.keys(TYPE_MAP)] as const;

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_COLS = 2;
const GUTTER = 12;
const CARD_W = Math.floor((SCREEN_W - GUTTER * (NUM_COLS + 1)) / NUM_COLS);
const IMG_H = 170;
const IMG_RADIUS = 18;
const PANEL_BG = "#f4efe6";
const CHIP_BG = "rgba(255,255,255,0.92)";

const EQUIP_KEYWORDS: Record<string, string[]> = {
  has_tv: ["tv", "télé", "télévision"],
  has_wifi: ["wifi", "wi-fi"],
  has_air_conditioning: ["clim", "climatisation", "air"],
  has_washing_machin: ["lave", "linge", "machine"],
  has_pool: ["piscine"],
  has_kitchen: ["cuisine"],
  has_parking: ["parking"],
  has_balcony: ["balcon"],
};

export default function LogementsScreen({ navigation }: any) {
  const [logements, setLogements] = useState<Logement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [tab, setTab] = useState<"Logements" | "Véhicules" | "Expériences">("Logements");

  // Realtime wiring
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchRef = useRef<null | ((opts?: { showSpinner?: boolean }) => Promise<void>)>(null);

  const mapPropertyType = (t: string) => {
    const v = t.toLowerCase();
    if (v.includes("maison")) return "maison";
    if (v.includes("appartement")) return "appartement";
    if (v.includes("hotel") || v.includes("hôtel")) return "hotel";
    return v;
  };

  const hasActiveFilters = useMemo(() => {
    const f = filters;
    const base = Boolean(
      f &&
        ((f.searchQuery && f.searchQuery.trim() !== "") ||
          (f.locationText && f.locationText.trim() !== "") ||
          typeof f.minPrice === "number" ||
          typeof f.maxPrice === "number" ||
          (f.propertyTypes && f.propertyTypes.length > 0) ||
          (f.equipments && f.equipments.length > 0) ||
          ((f.roomCount ?? 1) > 1) ||
          ((f.bathroomCount ?? 1) > 1) ||
          ((f.guestCount ?? 1) > 1) ||
          (f.datesStart && f.datesEnd))
    );
    return base || activeChip !== null;
  }, [filters, activeChip]);

  const fetchLogementIdsByEquipments = useCallback(async (equipKeys: string[]) => {
    if (!equipKeys.length) return null;
    const words = Array.from(
      new Set(equipKeys.flatMap((k) => EQUIP_KEYWORDS[k] || []).map((w) => w.trim()).filter(Boolean))
    );
    if (!words.length) return null;
    const orFilter = words.map((w) => `name.ilike.%${w}%`).join(",");
    const { data: eqRows, error: eqErr } = await supabase
      .from("equipements")
      .select("id")
      .eq("category", "logement")
      .or(orFilter);
    if (eqErr) {
      console.error(eqErr);
      return [];
    }
    const equipIds = (eqRows || []).map((r: any) => r.id);
    if (!equipIds.length) return [];
    const { data: linkRows, error: linkErr } = await supabase
      .from("listing_equipements")
      .select("logement_id")
      .in("equipement_id", equipIds)
      .not("logement_id", "is", null);
    if (linkErr) {
      console.error(linkErr);
      return [];
    }
    return Array.from(new Set((linkRows || []).map((r: any) => r.logement_id)));
  }, []);

  const fetchBusyLogementIds = useCallback(async (dStart?: string, dEnd?: string) => {
    if (!dStart || !dEnd) return [];
    const { data, error } = await supabase
      .from("reservations")
      .select("logement_id, status")
      .not("logement_id", "is", null)
      .lte("start_date", dEnd)
      .gte("end_date", dStart)
      .in("status", ["pending", "confirmed", "completed"]);
    if (error) {
      console.error(error);
      return [];
    }
    return Array.from(new Set((data || []).map((r: any) => r.logement_id)));
  }, []);

  const fetchLogements = useCallback(
    async (opts?: { showSpinner?: boolean }) => {
      const showSpinner = opts?.showSpinner ?? true;
      if (showSpinner) setLoading(true);

      try {
        let constrainIds: string[] | null = null;
        let excludeIds: string[] = [];

        if (filters?.equipments?.length) {
          const ids = await fetchLogementIdsByEquipments(filters.equipments);
          if (ids && ids.length === 0) {
            setLogements([]);
            setLoading(false);
            return;
          }
          constrainIds = ids;
        }
        if (filters?.datesStart && filters?.datesEnd) {
          excludeIds = await fetchBusyLogementIds(filters.datesStart, filters.datesEnd);
        }

        let query = supabase
          .from("listings_logements")
          .select(
            `
            id, title, description, price, city, quartier, rental_type, type, is_approved,
            listing_images(image_url)
          `
          )
          .eq("is_approved", true);

        if (activeChip === "Tout") {
          // none
        } else if (!activeChip) {
          query = query.in("type", TYPE_MAP["Appartement meublé"]);
        } else {
          const values = TYPE_MAP[activeChip] ?? TYPE_MAP["Appartement meublé"];
          query = query.in("type", values);
        }

        if (filters?.searchQuery) {
          const t = filters.searchQuery.replace(/%/g, "");
          query = query.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
        }
        if (filters?.locationText) {
          const t = filters.locationText.replace(/%/g, "");
          query = query.or(`city.ilike.%${t}%,quartier.ilike.%${t}%`);
        }
        if (typeof filters?.minPrice === "number") query = query.gte("price", filters.minPrice!);
        if (typeof filters?.maxPrice === "number") query = query.lte("price", filters.maxPrice!);
        if ((filters?.roomCount ?? 1) > 1) query = query.gte("bedrooms", filters!.roomCount!);
        if ((filters?.bathroomCount ?? 1) > 1) query = query.gte("showers", filters!.bathroomCount!);
        if ((filters?.guestCount ?? 1) > 1) query = query.gte("max_guests", filters!.guestCount!);
        if (filters?.propertyTypes?.length) {
          const norm = filters.propertyTypes.map(mapPropertyType);
          query = query.in("type", norm);
        }
        if (constrainIds && constrainIds.length) query = query.in("id", constrainIds);
        if (excludeIds.length) {
          const inList = `(${excludeIds.map((id) => `"${id}"`).join(",")})`;
          query = query.not("id", "in", inList);
        }

        const { data, error } = await query;
        if (error) {
          console.error(error);
          setLogements([]);
        } else {
          const items = (data as any[]).map((x) => ({
            id: x.id,
            title: x.title,
            description: x.description,
            price: x.price,
            city: x.city,
            quartier: x.quartier,
            rental_type: x.rental_type,
            image_url: x.listing_images?.[0]?.image_url,
          }));
          setLogements(items);
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [activeChip, filters, fetchBusyLogementIds, fetchLogementIdsByEquipments]
  );

  useEffect(() => {
    fetchRef.current = fetchLogements;
  }, [fetchLogements]);

  useEffect(() => {
    fetchLogements({ showSpinner: true });
  }, [activeChip, filters, fetchLogements]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => fetchLogements({ showSpinner: false }));
    return unsub;
  }, [navigation, fetchLogements]);

  useEffect(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const handleChange = () => fetchRef.current?.({ showSpinner: false });
    const ch = supabase
      .channel("logements-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings_logements" }, handleChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "listing_images" }, handleChange)
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // pour compléter la dernière colonne
  const gridData = useMemo(() => {
    if (logements.length % NUM_COLS === 0) return logements;
    const fillers = NUM_COLS - (logements.length % NUM_COLS);
    return [
      ...logements,
      ...Array(fillers)
        .fill(0)
        .map((_, i) => ({ id: `spacer-${i}`, __empty: true } as Logement)),
    ];
  }, [logements]);

  /** ——— STYLES D’ÉCRITURE “MANUELS” (pas de fonts à charger) ——— */
  // on reproduit le rendu iOS: graisse + tracking léger + hauteurs de ligne
  const txtPrice = {
    fontWeight: Platform.OS === "ios" ? ("900" as const) : ("900" as const),
    letterSpacing: 0.1,
  };
  const txtTitle = {
    fontWeight: Platform.OS === "ios" ? ("800" as const) : ("700" as const),
    letterSpacing: 0.1,
  };
  const txtLoc = {
    fontWeight: ("400" as const),
    letterSpacing: 0.15,
  };

  const renderItem = ({ item }: { item: Logement }) => {
    if (item.__empty) return <View style={{ width: CARD_W, marginHorizontal: GUTTER / 2 }} />;
    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD_W, marginHorizontal: GUTTER / 2 }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("LogementDetails", { id: item.id })}
      >
        {/* IMAGE arrondie, isolée */}
        <View style={styles.cardImageWrap}>
          <Image
            source={{ uri: item.image_url || "https://via.placeholder.com/600x400" }}
            style={styles.cardImage}
          />
          <View style={styles.heartBadge}>
            <Ionicons name="heart-outline" size={18} color="rgba(0,0,0,0.75)" />
          </View>
        </View>

        {/* INFOS : container invisible, sans padding horizontal */}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardPrice, txtPrice]}>
            {item.price} XOF / {unitFor(item.rental_type)}
          </Text>
          <Text style={[styles.cardTitle, txtTitle]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.cardLocation, txtLoc]} numberOfLines={1}>
            {item.city}
            {item.quartier ? `, ${item.quartier}` : ""}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleTabChange = (next: "Logements" | "Véhicules" | "Expériences") => {
    setTab(next);
    if (next === "Logements") return;
    if (next === "Véhicules") navigation.navigate("Vehicules");
    if (next === "Expériences") navigation.navigate("Experiences");
  };

  const handleBottomTab = (k: TabKey) => {
    switch (k) {
      case "logements":
        break;
      case "Favoris":
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

  const resetAll = () => {
    setFilters(null);
    setActiveChip(null);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const showEmpty = logements.length === 0;

  return (
    <View style={styles.root}>
      {/* ===== Bannière ===== */}
      <ImageBackground
        source={require("../../assets/images/logement2.jpg")}
        style={styles.banner}
        imageStyle={{ resizeMode: "cover" }}
      >
        <SafeAreaView edges={["top"]} style={styles.bannerSafe}>
          <SegmentedTabs value={tab} onChange={handleTabChange} />

          {/* Recherche au centre */}
          <View style={styles.searchCenter}>
            <SearchBar topOffset={0} style={{ width: "92%" }} onPress={() => setSearchOpen(true)} />
          </View>

          {/* Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {CHIP_LABELS.map((label) => {
              const active = activeChip === label || (!activeChip && label === "Appartement meublé");
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    if (label === "Tout") setActiveChip("Tout");
                    else if (activeChip === label) setActiveChip(null);
                    else setActiveChip(label);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {hasActiveFilters && (
            <View style={{ alignItems: "center", marginTop: 10 }}>
              <TouchableOpacity onPress={resetAll} style={styles.resetInlineBtn} activeOpacity={0.9}>
                <Ionicons name="refresh" size={16} color="#111" />
                <Text style={styles.resetInlineTxt}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </ImageBackground>

      {/* ===== Panel contenu ===== */}
      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Logements populaires</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetAll} style={styles.resetSmallBtn} activeOpacity={0.9}>
              <Ionicons name="refresh" size={16} color="#111" />
              <Text style={styles.resetSmallTxt}>Réinitialiser</Text>
            </TouchableOpacity>
          )}
        </View>

        {showEmpty ? (
          <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 16 }}>
            <Ionicons name="search-outline" size={36} color="#6b6b6b" />
            <Text style={{ marginTop: 10, fontWeight: "800", color: "#111" }}>Aucun logement trouvé</Text>
            <Text style={{ marginTop: 4, color: "#6b6b6b", textAlign: "center" }}>
              Essaie d’élargir ta recherche ou réinitialise les filtres.
            </Text>
            <TouchableOpacity onPress={resetAll} style={[styles.actionCard, { marginTop: 12 }]}>
              <Text style={styles.actionText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={gridData}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLS}
            columnWrapperStyle={{ paddingHorizontal: GUTTER }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Bottom Nav */}
      <BottomNavBar
        current="logements"
        onChange={handleBottomTab}
        messagesBadge="1+"
        onRequireAuth={() => navigation.navigate("AuthSheet")}
      />

      {/* Modal de recherche connecté */}
      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        initial={filters ?? undefined}
        onSubmit={(f) => setFilters(f as Filters)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PANEL_BG },

  banner: { width: "100%", height: 380, justifyContent: "space-between" },
  bannerSafe: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },

  searchCenter: { flex: 1, justifyContent: "center", alignItems: "center" },

  chipsRow: { paddingHorizontal: 12, paddingBottom: 2 },
  chip: {
    backgroundColor: CHIP_BG,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    height: 38,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "android" ? { borderWidth: 0.5, borderColor: "rgba(0,0,0,0.05)" } : null),
  },
  chipActive: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E6E2DA" },
  chipText: { fontSize: 14, fontWeight: "700", color: "#222", letterSpacing: 0.1 },
  chipTextActive: { color: "#111" },

  panel: {
    flex: 1,
    backgroundColor: PANEL_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -20,
    paddingTop: 12,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 22, fontWeight: "900", color: "#111", letterSpacing: 0.2 },

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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resetInlineTxt: { fontWeight: "900", color: "#111" },

  actionCard: {
    backgroundColor: "#efe7dc",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  actionText: { fontSize: 16, fontWeight: "700", color: "#303030" },

  list: { paddingTop: 6, paddingBottom: 70 },

  /** ——— CARDS : image arrondie + texte sans conteneur visible ——— */
  card: { backgroundColor: "transparent", marginVertical: 10 },
  cardImageWrap: { width: "100%", height: IMG_H, borderRadius: IMG_RADIUS, overflow: "hidden" },
  cardImage: { width: "100%", height: "100%", resizeMode: "cover" },
  heartBadge: { position: "absolute", right: 10, top: 10, padding: 2, backgroundColor: "transparent" },

  cardInfo: { backgroundColor: "transparent", paddingHorizontal: 0, paddingTop: 10 },

  // “Écriture” manuelle façon iOS
  cardPrice: {
    fontSize: 17,
    fontWeight: "900",
    color: "#373030ff",
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
    color: "#5e5959ff",
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  cardLocation: {
    fontSize: 13,
    color: "#6b6b6b",
    marginTop: 2,
    lineHeight: 18,
    letterSpacing: 0.15,
    fontWeight: "400",
  },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
});
