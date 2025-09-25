// src/screens/MyListingsScreen.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image as RNImage,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "MyListings">;

type Kind = "logement" | "vehicule" | "experience";

type UnifiedListing = {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  city?: string | null;
  price: number;
  rental_type: string;
  is_approved: boolean | null;
  created_at: string;
  image_url?: string | null;
};

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(
    Number(n || 0)
  );

const kindLabel: Record<Kind, string> = {
  logement: "Logement",
  vehicule: "Véhicule",
  experience: "Expérience",
};

/* ======== FastImage (fallback Image sur web ou si non dispo) ======== */
let FastImageComp: any = RNImage;
try {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    FastImageComp = require("react-native-fast-image").default;
  }
} catch {
  FastImageComp = RNImage;
}

const CoverImage = memo(function CoverImage({
  uri,
}: {
  uri?: string | null;
}) {
  const source = uri
    ? { uri, priority: FastImageComp.priority?.high }
    : require("../../assets/images/logement.jpg");

  return (
    <FastImageComp
      source={source}
      style={styles.coverImg}
      resizeMode={FastImageComp.resizeMode?.cover ?? "cover"}
    />
  );
});

/* ======== Card mémoïsé (évite les re-rendus) ======== */
const ListingCard = memo(function ListingCard({
  it,
  onPressEdit,
}: {
  it: UnifiedListing;
  onPressEdit: (it: UnifiedListing) => void;
}) {
  return (
    <TouchableOpacity
      key={`${it.kind}-${it.id}`}
      style={styles.card}
      onPress={() => onPressEdit(it)}
      activeOpacity={0.95}
    >
      <View style={styles.cover}>
        <CoverImage uri={it.image_url} />

        {!it.is_approved && (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeTxt}>Action requise</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => onPressEdit(it)}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {it.title}
      </Text>

      <View style={styles.rowBetween}>
        <Text style={styles.meta} numberOfLines={1}>
          {kindLabel[it.kind]}
          {it.city ? ` · ${it.city}` : ""}
        </Text>
        <Text style={styles.price}>
          {money(it.price)} / {it.rental_type}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

/* ======== shallow compare pour éviter setState inutiles ======== */
const itemsShallowEqual = (a: UnifiedListing[], b: UnifiedListing[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    if (
      x.id !== y.id ||
      x.kind !== y.kind ||
      x.title !== y.title ||
      x.city !== y.city ||
      x.price !== y.price ||
      x.rental_type !== y.rental_type ||
      x.is_approved !== y.is_approved ||
      x.created_at !== y.created_at ||
      x.image_url !== y.image_url
    )
      return false;
  }
  return true;
};

export default function MyListingsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<UnifiedListing[]>([]);
  const [filter, setFilter] = useState<"tous" | Kind>("tous");

  // anti-race
  const reqSeq = useRef(0);
  // debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback((fn: () => void, d = 180) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, d);
  }, []);

  const fetchAll = useCallback(async () => {
    const ticket = ++reqSeq.current;
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet");
        return;
      }

      // LOGEMENTS — LEFT JOIN + limit(1) sur la relation imbriquée
      const { data: L, error: eL } = await supabase
        .from("listings_logements")
        .select(
          `
          id, owner_id, title, price, rental_type, city, is_approved, created_at,
          listing_images ( image_url )
        `
        )
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(1, { foreignTable: "listing_images" }); // limite uniquement la table imbriquée
      if (eL) throw eL;

      const logements: UnifiedListing[] = (L || []).map((r: any) => ({
        id: r.id,
        kind: "logement",
        title: r.title,
        subtitle: r.city,
        city: r.city,
        price: Number(r.price || 0),
        rental_type: r.rental_type,
        is_approved: r.is_approved,
        created_at: r.created_at,
        image_url: r?.listing_images?.[0]?.image_url ?? null,
      }));

      // VÉHICULES — même principe (clé étrangère différente)
      const { data: V, error: eV } = await supabase
        .from("listings_vehicules")
        .select(
          `
          id, owner_id, marque, modele, price, rental_type, city, is_approved, created_at,
          listing_images!listing_images_vehicule_id_fkey ( image_url )
        `
        )
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(1, {
          foreignTable: "listing_images!listing_images_vehicule_id_fkey",
        });
      if (eV) throw eV;

      const vehicules: UnifiedListing[] = (V || []).map((v: any) => ({
        id: v.id,
        kind: "vehicule",
        title: `${v.marque} ${v.modele}`.trim(),
        subtitle: v.city,
        city: v.city,
        price: Number(v.price || 0),
        rental_type: v.rental_type,
        is_approved: v.is_approved ?? false,
        created_at: v.created_at,
        image_url: v?.listing_images?.[0]?.image_url ?? null,
      }));

      // EXPÉRIENCES — idem
      const { data: E, error: eE } = await supabase
        .from("listings_experiences")
        .select(
          `
          id, owner_id, title, category, price, rental_type, city, is_approved, created_at,
          listing_images!listing_images_experience_id_fkey ( image_url )
        `
        )
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(1, {
          foreignTable: "listing_images!listing_images_experience_id_fkey",
        });
      if (eE) throw eE;

      const experiences: UnifiedListing[] = (E || []).map((x: any) => ({
        id: x.id,
        kind: "experience",
        title: x.title,
        subtitle: x.category || x.city,
        city: x.city,
        price: Number(x.price || 0),
        rental_type: x.rental_type,
        is_approved: x.is_approved ?? false,
        created_at: x.created_at,
        image_url: x?.listing_images?.[0]?.image_url ?? null,
      }));

      const next = [...logements, ...vehicules, ...experiences].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (ticket === reqSeq.current && !itemsShallowEqual(items, next)) {
        startTransition(() => setItems(next));
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger vos annonces.");
    } finally {
      if (ticket === reqSeq.current) setLoading(false);
    }
  }, [navigation, items]);

  useEffect(() => {
    fetchAll();

    // refetch au focus
    const unsub = navigation.addListener("focus", fetchAll);

    // realtime léger (on écoute les 4 tables et on debounce le refetch)
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        const uid = auth.session?.user?.id;
        if (!uid) return;

        ch = supabase
          .channel("mylistings-rt")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "listings_logements", filter: `owner_id=eq.${uid}` },
            () => debounced(fetchAll)
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "listings_vehicules", filter: `owner_id=eq.${uid}` },
            () => debounced(fetchAll)
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "listings_experiences", filter: `owner_id=eq.${uid}` },
            () => debounced(fetchAll)
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "listing_images" },
            () => debounced(fetchAll)
          )
          .subscribe();
      } catch {}
    })();

    return () => {
      unsub();
      if (ch) supabase.removeChannel(ch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchAll, debounced, navigation]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const filtered = useMemo(
    () => (filter === "tous" ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  const onPressEdit = useCallback(
    (it: UnifiedListing) =>
      navigation.navigate("EditListing", { id: it.id, kind: it.kind }),
    [navigation]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.roundBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes annonces</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => Alert.alert("Recherche", "Bientôt disponible")}
            >
              <Ionicons name="search" size={18} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate("PublishListing" as any)}
            >
              <Ionicons name="add" size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtres segmentés */}
        <View style={styles.segment}>
          {[
            { k: "tous", label: "Tous" },
            { k: "logement", label: "Logements" },
            { k: "vehicule", label: "Véhicules" },
            { k: "experience", label: "Expériences" },
          ].map((opt) => {
            const active = filter === (opt.k as any);
            return (
              <TouchableOpacity
                key={opt.k}
                onPress={() => setFilter(opt.k as any)}
                style={[styles.segBtn, active && styles.segBtnActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.segTxt, active && styles.segTxtActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Liste */}
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucune annonce</Text>
              <Text style={styles.emptySub}>
                Publiez votre première annonce pour commencer.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate("PublishListing" as any)}
              >
                <Text style={styles.ctaTxt}>Créer une annonce</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((it) => (
              <ListingCard key={`${it.kind}-${it.id}`} it={it} onPressEdit={onPressEdit} />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const R = 22;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
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
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#111" },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f3f3",
    alignItems: "center",
    justifyContent: "center",
  },

  segment: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    gap: 6,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  segBtnActive: { backgroundColor: "#fff" },
  segTxt: { fontWeight: "800", color: "#666" },
  segTxtActive: { color: "#111" },

  card: {
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 14,
  },
  cover: { borderRadius: 16, overflow: "hidden" },
  coverImg: { width: "100%", height: 190, backgroundColor: "#eee" },

  badge: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#D63C7B",
  },
  badgeTxt: { fontWeight: "900", color: "#111" },

  fab: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontSize: 18, fontWeight: "900", color: "#111", marginTop: 10 },

  rowBetween: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  meta: { color: "#666", fontWeight: "700", flex: 1 },
  price: { color: "#111", fontWeight: "900" },

  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  emptySub: {
    color: "#666",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  cta: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  ctaTxt: { color: "#fff", fontWeight: "900" },
});
