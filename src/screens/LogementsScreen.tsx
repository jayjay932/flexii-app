// src/screens/LogementsScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback, startTransition } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView, ImageBackground, Dimensions, PixelRatio,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import SearchBar from "@/src/components/SearchBar";
import SegmentedTabs from "@/src/components/SegmentedTabs";
import BottomNavBar, { TabKey } from "@/src/components/BottomNavBar";
import SearchModal, { Filters as BaseFilters } from "./SearchFiltersModal";
import FastImage from "react-native-fast-image";

type Filters = BaseFilters & {
  datesStart?: string; // "YYYY-MM-DD"
  datesEnd?: string;   // "YYYY-MM-DD"
};

type Logement = {
  id: string;
  title: string;
  description: string;
  price: number;
  city: string;
  quartier: string | null;
  image_url?: string;
  __empty?: boolean;
  rental_type?: string | null; // "nuit" | "jour" | "semaine" | "mois"
};

const unitFor = (t?: string | null) => {
  const v = (t || "nuit").toLowerCase();
  if (["nuit", "night"].includes(v)) return "nuit";
  if (["jour", "day"].includes(v)) return "jour";
  if (["semaine", "week"].includes(v)) return "semaine";
  if (["mois", "month"].includes(v)) return "mois";
  return v;
};

// Valeurs possibles en BDD (normalisées) par libellé du chip
const TYPE_MAP: Record<string, string[]> = {
  "Hôtel": ["hotel", "hôtel", "Hotel", "Hôtel"],
  "Appartement meublé": ["appartement", "appartement meublé", "appartement_meublé", "Appartement", "Appartement meublé"],
  "Maison à louer": ["maison", "maison à louer", "maison_a_louer", "Maison", "Maison à louer", "house"],
};

// Chips à afficher (on rajoute "Tout" en premier)
const CHIP_LABELS = ["Tout", ...Object.keys(TYPE_MAP)];

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_COLS = 2;
const GUTTER = 12;
const CARD_W = Math.floor((SCREEN_W - GUTTER * (NUM_COLS + 1)) / NUM_COLS);
const IMG_H = 170;
const PANEL_BG = "#f4efe6";
const CHIP_BG = "rgba(255,255,255,0.92)";
const PLACEHOLDER_URL = "https://via.placeholder.com/600x400";
const REFRESH_DEBOUNCE_MS = 250;

// Mots-clés pour mapper les IDs "has_..." du modal vers equipements.name
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

// ---- Helpers perf images ----

// Génère une URL miniature **si** c'est une URL publique Supabase Storage.
// Sinon, retourne l'URL d’origine.
function toThumb(url?: string) {
  if (!url) return PLACEHOLDER_URL;
  try {
    // Supabase public: .../storage/v1/object/public/<bucket>/<path>
    if (url.includes("/storage/v1/object/public/")) {
      const [base] = url.split("?");
      const transformed = base.replace("/object/public/", "/render/image/public/");
      const pxW = Math.min(Math.round(CARD_W * PixelRatio.get()), 800);
      const pxH = Math.min(Math.round(IMG_H * PixelRatio.get()), 800);
      // cover = crop central, quality 75 = léger et net
      return `${transformed}?width=${pxW}&height=${pxH}&quality=75&resize=cover`;
    }
  } catch {}
  return url;
}

// Carte logement optimisée et mémoïsée (évite les re-rendus inutiles)
const LogementCard = React.memo(function ({
  item,
  onOpen,
}: {
  item: Logement;
  onOpen: (id: string) => void;
}) {
  const uri = toThumb(item.image_url) || PLACEHOLDER_URL;

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_W, marginHorizontal: GUTTER / 2 }]}
      activeOpacity={0.9}
      onPress={() => onOpen(item.id)}
    >
      <View style={styles.cardImageWrap}>
        <FastImage
          source={{
            uri,
            priority: FastImage.priority.high,
            cache: FastImage.cacheControl.immutable,
          }}
          style={styles.cardImage}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View style={styles.heartBadge}>
          <Ionicons name="heart-outline" size={18} color="#202020" />
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardPrice}>
          {item.price} XOF / {unitFor(item.rental_type)}
        </Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardLocation} numberOfLines={1}>
          {item.city}
          {item.quartier ? `, ${item.quartier}` : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => {
  // Re-render uniquement si l'essentiel change
  return (
    prev.item.id === next.item.id &&
    prev.item.image_url === next.item.image_url &&
    prev.item.price === next.item.price &&
    prev.item.title === next.item.title &&
    prev.item.city === next.item.city &&
    prev.item.quartier === next.item.quartier &&
    prev.item.rental_type === next.item.rental_type
  );
});

export default function LogementsScreen({ navigation }: any) {
  const [logements, setLogements] = useState<Logement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<Filters | null>(null);
  // Par défaut on garde le même comportement : rien de sélectionné => appartements
  const [activeChip, setActiveChip] = useState<string | null>(null); // null => "Appartement meublé"
  const [tab, setTab] = useState<"Logements" | "Véhicules" | "Expériences">("Logements");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // mapping simple si tu utilises "propertyTypes" du modal
  const mapPropertyType = (t: string) => {
    const v = t.toLowerCase();
    if (v.includes("maison")) return "maison";
    if (v.includes("appartement")) return "appartement";
    if (v.includes("hotel") || v.includes("hôtel")) return "hotel";
    return v;
  };

  // Utilitaire pour récupérer les logement_ids qui ont au moins un des équipements
  const fetchLogementIdsByEquipments = useCallback(async (equipKeys: string[]) => {
    if (!equipKeys.length) return null;

    // 1) on traduit les clés 'has_wifi' -> mots-clés name.ilike
    const words = Array.from(
      new Set(
        equipKeys
          .flatMap((k) => EQUIP_KEYWORDS[k] || [])
          .map((w) => w.trim())
          .filter(Boolean)
      )
    );
    if (!words.length) return null;

    // 2) on récupère les equipements(category='logement') dont le name matche au moins un mot
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

    // 3) on récupère les logements qui possèdent au moins un de ces équipements
    const { data: linkRows, error: linkErr } = await supabase
      .from("listing_equipements")
      .select("logement_id")
      .in("equipement_id", equipIds)
      .not("logement_id", "is", null);

    if (linkErr) {
      console.error(linkErr);
      return [];
    }

    const ids = Array.from(new Set((linkRows || []).map((r: any) => r.logement_id)));
    return ids;
  }, []);

  // Utilitaire : exclude ids réservés si on a un range de dates
  const fetchBusyLogementIds = useCallback(async (dStart?: string, dEnd?: string) => {
    if (!dStart || !dEnd) return [];
    // overlap si: res.start_date <= dEnd AND res.end_date >= dStart
    const { data, error } = await supabase
      .from("reservations")
      .select("logement_id, status")
      .not("logement_id", "is", null)
      .lte("start_date", dEnd)
      .gte("end_date", dStart)
      .in("status", ["pending", "confirmed", "completed"]); // on ignore "cancelled"

    if (error) {
      console.error(error);
      return [];
    }
    const ids = Array.from(new Set((data || []).map((r: any) => r.logement_id)));
    return ids;
  }, []);

  // ------- Fetch (on garde ta logique et on empile des filtres) -------
  const fetchLogements = useCallback(
    async (opts?: { showSpinner?: boolean }) => {
      const showSpinner = opts?.showSpinner ?? true;
      if (showSpinner) setLoading(true);

      try {
        let constrainIds: string[] | null = null;  // whiteliste via équipements
        let excludeIds: string[] = [];             // blacklist via disponibilités

        if (filters?.equipments?.length) {
          const ids = await fetchLogementIdsByEquipments(filters.equipments);
          if (ids && ids.length === 0) {
            startTransition(() => setLogements([]));
            if (showSpinner) setLoading(false);
            return;
          }
          constrainIds = ids;
        }

        if (filters?.datesStart && filters?.datesEnd) {
          excludeIds = await fetchBusyLogementIds(filters.datesStart, filters.datesEnd);
        }

        let query = supabase
          .from("listings_logements")
          .select(`
            id, title, description, price, city, quartier, rental_type, type, is_approved,
            listing_images(image_url)
          `)
          .eq("is_approved", true);

        // —— chips
        if (activeChip === "Tout") {
          // pas de filtre
        } else if (!activeChip) {
          query = query.in("type", TYPE_MAP["Appartement meublé"]);
        } else {
          const values = TYPE_MAP[activeChip] ?? TYPE_MAP["Appartement meublé"];
          query = query.in("type", values);
        }

        // —— Filtres simples
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

        if (constrainIds && constrainIds.length) {
          query = query.in("id", constrainIds);
        }

        if (excludeIds.length) {
          const inList = `(${excludeIds.map((id) => `"${id}"`).join(",")})`;
          query = query.not("id", "in", inList);
        }

        const { data, error } = await query;

        if (error) {
          console.error(error);
          startTransition(() => setLogements([]));
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
          })) as Logement[];

          // Transition non bloquante (React 19) pour éviter les saccades UI
          startTransition(() => setLogements(items));

          // Précharger les 12 premières images (défilement plus fluide)
          const preload = items.slice(0, 12).map((it) => ({ uri: toThumb(it.image_url) || PLACEHOLDER_URL }));
          FastImage.preload(preload);
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [activeChip, filters, fetchBusyLogementIds, fetchLogementIdsByEquipments]
  );

  // Initial fetch + refetch quand chip/filtres changent
  useEffect(() => {
    fetchLogements({ showSpinner: true });
  }, [activeChip, filters, fetchLogements]);

  // Revenir focus => soft refresh
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => fetchLogements({ showSpinner: false }));
    return unsub;
  }, [navigation, fetchLogements]);

  // Realtime avec **dé-bounce** (évite 2 fetchs si listings + images bougent)
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      fetchLogements({ showSpinner: false });
    }, REFRESH_DEBOUNCE_MS);
  }, [fetchLogements]);

  useEffect(() => {
    channelRef.current?.unsubscribe();

    const channel = supabase
      .channel("realtime-listings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings_logements" },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listing_images" },
        () => scheduleRefetch()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [scheduleRefetch]);

  // grille homogène
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

  // Navigation vers le détail (stable ref pour éviter re-rendus)
  const openDetails = useCallback(
    (id: string) => navigation.navigate("LogementDetails", { id }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Logement }) => {
      if (item.__empty) return <View style={{ width: CARD_W, marginHorizontal: GUTTER / 2 }} />;
      return <LogementCard item={item} onOpen={openDetails} />;
    },
    [openDetails]
  );

  const handleTabChange = (next: "Logements" | "Véhicules" | "Expériences") => {
    setTab(next);
    if (next === "Logements") return;
    if (next === "Véhicules") navigation.navigate("Logements");
    if (next === "Expériences") navigation.navigate("Logements");
  };

  const handleBottomTab = (k: TabKey) => {
    switch (k) {
      case "logements":
        break;
      case "Favoris":
        navigation.navigate("Logements");
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

  // Réinitialiser — état de départ
  const resetAll = () => {
    setFilters(null);
    setActiveChip(null);
    fetchLogements({ showSpinner: true });
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

          {/* Search centrée */}
          <View style={styles.searchCenter}>
            <SearchBar topOffset={0} style={{ width: "92%" }} onPress={() => setSearchOpen(true)} />
          </View>

          {/* Chips (avec "Tout") */}
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
        </SafeAreaView>
      </ImageBackground>

      {/* ===== Panel contenu ===== */}
      <View style={styles.panel}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => setSearchOpen(true)}>
            <Text style={styles.actionText}>Filtrer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={resetAll}>
            <Text style={styles.actionText}>Réinitialiser</Text>
          </TouchableOpacity>
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
            // ---- Virtualization perf ----
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={16}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </View>

      {/* Bottom Nav avec onRequireAuth conservé */}
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

  // search au centre
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
  },
  chipActive: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E6E2DA" },
  chipText: { fontSize: 14, fontWeight: "700", color: "#222" },
  chipTextActive: { color: "#111" },

  panel: {
    flex: 1,
    backgroundColor: PANEL_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -20,
    paddingTop: 12,
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  actionCard: { backgroundColor: "#efe7dc", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 32 },
  actionText: { fontSize: 16, fontWeight: "700", color: "#303030" },

  // espace suffisant pour scroller au-dessus de la barre
  list: { paddingTop: 6, paddingBottom: 70 },

  card: {
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
    marginVertical: 10,
    // petits boosts GPU:
    elevation: 1,
  },
  cardImageWrap: {
    width: "100%",
    height: IMG_H,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: "100%" },
  heartBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 6,
  },
  cardInfo: { padding: 12 },
  cardPrice: { fontSize: 16, fontWeight: "800", color: "#111" },
  cardTitle: { fontSize: 14, fontWeight: "700", marginTop: 4, color: "#222" },
  cardLocation: { fontSize: 12, color: "#6b6b6b", marginTop: 2 },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
});
