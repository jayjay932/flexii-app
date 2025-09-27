// src/screens/VehiculeDetailsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CalendarList, DateData, LocaleConfig } from "react-native-calendars";
import FastImage from "react-native-fast-image";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import type { ListRenderItem } from "react-native";

type ImageItem = { id: string; url: string };

/* Alias de type source FastImage (plus robuste que FastImage.Source) */
type FISource = React.ComponentProps<typeof FastImage>["source"];

/* ------- Localisation FR pour react-native-calendars ------- */
LocaleConfig.locales.fr = {
  monthNames: [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre"
  ],
  monthNamesShort: [
    "janv.","févr.","mars","avr.","mai","juin",
    "juil.","août","sept.","oct.","nov.","déc."
  ],
  dayNames: ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"],
  dayNamesShort: ["D","L","M","M","J","V","S"],
  today: "Aujourd’hui",
};
LocaleConfig.defaultLocale = "fr";

type Props = NativeStackScreenProps<RootStackParamList, "VehiculeDetails">;

type Owner = { id: string; full_name: string; avatar_url?: string | null };
type Details = {
  id: string;
  marque: string;
  modele: string;
  annee: number | null;
  description: string | null;
  price: number;
  city: string;
  quartier: string | null;
  rental_type?: string | null; // "heure" | "jour" | "mois"
  transmission?: "manuelle" | "automatique" | null;
  latitude?: number | null;
  longitude?: number | null;
  images: { id: string; url: string }[];
  owner?: Owner;
};
type EquipItem = { id: string; name: string };

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = 310;
const BG = "#ffffffff";
const CARD = "#ffffff";
const TEXT = "#111";
const SUB = "#aeababff";

const unitFor = (t?: string | null) => {
  const v = (t || "jour").toLowerCase();
  if (["heure","hour"].includes(v)) return "heure";
  if (["jour","day"].includes(v)) return "jour";
  if (["mois","month"].includes(v)) return "mois";
  return v;
};
const equipIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const n = (name || "").toLowerCase();
  if (/clim|ac|air/.test(n)) return "snow-outline";
  if (/gps|nav/.test(n)) return "navigate-outline";
  if (/bluetooth/.test(n)) return "bluetooth-outline";
  if (/usb/.test(n)) return "hardware-chip-outline";
  if (/carplay|android/.test(n)) return "phone-portrait-outline";
  if (/cam[ée]ra|recul/.test(n)) return "camera-outline";
  if (/radar|parking/.test(n)) return "radio-outline";
  if (/r[ée]gulateur|cruise/.test(n)) return "speedometer-outline";
  if (/toit|ouvrant|sunroof/.test(n)) return "sunny-outline";
  if (/cuir|si[èe]ges/.test(n)) return "shirt-outline";
  if (/airbag/.test(n)) return "alert-circle-outline";
  if (/abs|frein/.test(n)) return "hand-left-outline";
  if (/esp/.test(n)) return "git-branch-outline";
  if (/direction/.test(n)) return "swap-horizontal-outline";
  if (/vitres/.test(n)) return "browsers-outline";
  if (/verrou/.test(n)) return "lock-closed-outline";
  if (/jantes|alliage/.test(n)) return "ellipse-outline";
  if (/4x4|int[ée]grale/.test(n)) return "trail-sign-outline";
  if (/porte[- ]?bagages|barres/.test(n)) return "briefcase-outline";
  if (/mains? libres|kit/.test(n)) return "mic-outline";
  return "pricetag-outline";
};
const bust = (uri: string, id: string) =>
  `${uri}${uri.includes("?") ? "&" : "?"}v=${encodeURIComponent(id)}`;

/* Helpers UTC-safe pour indispos (fin EXCLUE) */
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
};
const keyUTC = (d: Date) => d.toISOString().slice(0, 10);
const addRangeFromReservation = (startISO: string, endISO: string, into: Record<string, true>) => {
  try {
    const start = toUTC(startISO);
    const end = toUTC(endISO);
    const endExclusive =
      end.getTime() <= start.getTime()
        ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1))
        : end;
    for (let d = new Date(start); d < endExclusive; d.setUTCDate(d.getUTCDate() + 1)) {
      into[keyUTC(d)] = true;
    }
  } catch {}
};

export default function VehiculeDetailsScreen({ route, navigation }: Props) {
  const { id } = route.params;

  const [data, setData] = useState<Details | null>(null);
  const [equipements, setEquipements] = useState<EquipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setIndex(viewableItems[0].index ?? 0);
  });

  // ====== Calendrier / prix jour ======
  const [unavailable, setUnavailable] = useState<Record<string, true>>({});
  const [overridePrices, setOverridePrices] = useState<Record<string, number>>({});
  const [dayPriceOverride, setDayPriceOverride] = useState<number | null>(null);
  const [unitPriceOverride, setUnitPriceOverride] = useState<number | null>(null);

  const [isCalOpen, setCalOpen] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [tab, setTab] = useState<"dates" | "mois" | "flex">("dates");

  // Refs de realtime (séparer détails vs calendrier)
  const detailChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const calChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchCalendarRef = useRef<null | (() => Promise<void>)>(null);

  // calcul “nuits/jours”
  const nights = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
    return diff;
  }, [startDate, endDate]);

  const effectiveUnit = useMemo(
    () => (dayPriceOverride ?? unitPriceOverride ?? data?.price ?? 0),
    [dayPriceOverride, unitPriceOverride, data?.price]
  );
  const totalPrice = useMemo(() => effectiveUnit * nights, [effectiveUnit, nights]);

  /* ===== Fetch calendrier réutilisable ===== */
  const fetchCalendar = useCallback(async () => {
    // Réservations confirmées/completed → indispos (fin EXCLUE)
    const { data: res } = await supabase
      .from("reservations")
      .select("start_date, end_date, status")
      .eq("vehicule_id", id)
      .in("status", ["confirmed", "completed"]);

    const disabledByResa: Record<string, true> = {};
    (res ?? []).forEach((r: any) => {
      if (r.start_date && r.end_date) addRangeFromReservation(r.start_date, r.end_date, disabledByResa);
    });

    // Overrides (prix & indispo)
    const today = new Date();
    const future = new Date();
    future.setMonth(future.getMonth() + 18);
    const todayKey = today.toISOString().slice(0, 10);
    const futureKey = future.toISOString().slice(0, 10);

    const { data: ov } = await supabase
      .from("availability_overrides")
      .select("date, is_available, price")
      .eq("listing_type", "vehicule")
      .eq("listing_id", id)
      .gte("date", todayKey)
      .lte("date", futureKey);

    const ovPrices: Record<string, number> = {};
    const ovDisabled: Record<string, true> = {};
    (ov ?? []).forEach((r: any) => {
      const k = r.date as string;
      if (r.is_available === false) ovDisabled[k] = true;
      if (r.price != null) ovPrices[k] = Number(r.price);
    });

    setOverridePrices(ovPrices);
    setUnavailable({ ...disabledByResa, ...ovDisabled });
  }, [id]);

  // expose la fonction pour realtime
  useEffect(() => {
    fetchCalendarRef.current = fetchCalendar;
  }, [fetchCalendar]);

  /* ====== Chargement principal ====== */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Détails + images + owner
      const { data: row, error } = await supabase
        .from("listings_vehicules")
        .select(`
          id, marque, modele, annee, description, price, city, quartier,
          rental_type, transmission, latitude, longitude,
          users:owner_id ( id, full_name, avatar_url ),
          listing_images ( id, image_url )
        `)
        .eq("id", id)
        .maybeSingle<any>();
      if (error || !row) throw error || new Error("Vehicule not found");

      const images: Details["images"] = (row.listing_images ?? [])
        .filter((i: any) => i?.image_url)
        .map((i: any) => ({ id: i.id as string, url: i.image_url as string }));

      const owner = row.users
        ? { id: row.users.id, full_name: row.users.full_name, avatar_url: row.users.avatar_url }
        : undefined;

      setData({
        id: row.id,
        marque: row.marque,
        modele: row.modele,
        annee: typeof row.annee === "number" ? row.annee : row.annee ? Number(row.annee) : null,
        description: row.description ?? null,
        price: Number(row.price),
        city: row.city,
        quartier: row.quartier,
        rental_type: row.rental_type ?? "jour",
        transmission: row.transmission ?? null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        images,
        owner,
      });

      // 2) Équipements
      const { data: eqRows } = await supabase
        .from("listing_equipements")
        .select(`equipements:equipement_id ( id, name, category )`)
        .eq("vehicule_id", id);
      const eq: EquipItem[] =
        (eqRows ?? [])
          .map((r: any) => r?.equipements)
          .filter((e: any) => e && (e.category === "vehicule" || e.category == null))
          .map((e: any) => ({ id: e.id as string, name: e.name as string })) ?? [];
      setEquipements(eq);

      // 3) Calendrier & overrides (séparé pour pouvoir le rafraîchir en temps réel)
      await fetchCalendar();
    } catch (e) {
      console.error(e);
      setData(null);
      setEquipements([]);
      setUnavailable({});
      setOverridePrices({});
    } finally {
      setLoading(false);
    }
  }, [id, fetchCalendar]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ===== Realtime : détails ===== */
  useEffect(() => {
    if (detailChRef.current) {
      supabase.removeChannel(detailChRef.current);
      detailChRef.current = null;
    }
    const ch = supabase
      .channel(`vehicule-detail-${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "listings_vehicules", filter: `id=eq.${id}` },
        fetchAll
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "listing_images", filter: `vehicule_id=eq.${id}` },
        fetchAll
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "listing_equipements", filter: `vehicule_id=eq.${id}` },
        fetchAll
      )
      .subscribe();
    detailChRef.current = ch;

    return () => {
      if (detailChRef.current) {
        supabase.removeChannel(detailChRef.current);
        detailChRef.current = null;
      }
    };
  }, [id, fetchAll]);

  /* ===== Realtime : calendrier (léger) ===== */
  useEffect(() => {
    if (calChRef.current) {
      supabase.removeChannel(calChRef.current);
      calChRef.current = null;
    }
    const handleCal = () => fetchCalendarRef.current?.();

    const ch = supabase
      .channel(`vehicule-cal-rt-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `vehicule_id=eq.${id}` },
        handleCal
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability_overrides",
          filter: `listing_id=eq.${id}`,
        },
        handleCal
      )
      .subscribe();

    calChRef.current = ch;
    return () => {
      if (calChRef.current) {
        supabase.removeChannel(calChRef.current);
        calChRef.current = null;
      }
    };
  }, [id]);

  // ====== Négociation (identique à logement, mais kind="vehicule") ======
  const onPressNegocier = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const sess = auth?.session ?? null;
      if (!sess) return navigation.navigate("AuthSheet");
      if (!data?.owner?.id) return Alert.alert("Indisponible", "Propriétaire introuvable.");

      const payload = {
        listing_id: data.id,
        listing_kind: "vehicule" as const,
        buyer_id: sess.user.id,
        seller_id: data.owner.id,
        last_message_at: new Date().toISOString(),
      };

      let conversationId: string | null = null;
      const ins = await supabase.from("conversations").insert(payload).select("id").single<{ id: string }>();
      if (ins.error) {
        const ex = await supabase
          .from("conversations")
          .select("id")
          .eq("listing_id", data.id)
          .eq("listing_kind", "vehicule")
          .eq("buyer_id", sess.user.id)
          .eq("seller_id", data.owner.id)
          .maybeSingle<{ id: string }>();
        if (ex.error || !ex.data?.id) {
          console.error(ins.error, ex.error);
          return Alert.alert("Erreur", "Impossible d’ouvrir la négociation.");
        }
        conversationId = ex.data.id;
      } else {
        conversationId = ins.data!.id;
      }

      // marqueur système best-effort
      try {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: sess.user.id,
          type: "system",
          content: "🔁 Nouvelle négociation ouverte",
          meta: { action: "negotiation_open" },
        });
        await supabase.from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch {}

      navigation.navigate("Chat", {
        listingId: data.id,
        ownerId: data.owner.id,
        listingTitle: `${data.marque} ${data.modele}`,
        conversationId,
        forceOpenNegotiation: true,
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Une erreur est survenue.");
    }
  }, [data, navigation]);

  // retour depuis chat avec prix négocié → ouvre calendrier
  useEffect(() => {
    if (route.params?.resetFromChatReserve) {
      if (typeof route.params?.negotiatedUnitPrice === "number") {
        setUnitPriceOverride(route.params.negotiatedUnitPrice);
      }
      setCalOpen(true);
      navigation.setParams({ resetFromChatReserve: false } as any);
    }
  }, [route.params?.resetFromChatReserve, route.params?.negotiatedUnitPrice, navigation]);

  // ====== Calendrier (identique à logement) ======
  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const isPastKey = (key: string) => key < todayKey;

  const onDayPress = (day: DateData) => {
    const d = day.dateString;
    if (unavailable[d] || isPastKey(d)) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(d);
      setEndDate(null);
      setDayPriceOverride(overridePrices[d] ?? null);
      return;
    }

    if (startDate && !endDate) {
      if (d < startDate) {
        setStartDate(d);
        setDayPriceOverride(overridePrices[d] ?? null);
      } else {
        setEndDate(d);
      }
    }
  };

  const markedDates = () => {
    const md: Record<
      string,
      { color?: string; textColor?: string; startingDay?: boolean; endingDay?: boolean; disabled?: boolean; disableTouchEvent?: boolean }
    > = {};

    Object.keys(unavailable).forEach((k) => {
      md[k] = { ...(md[k] || {}), disabled: true, disableTouchEvent: true };
    });

    if (startDate && endDate) {
      let cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        const key = toKey(cur);
        md[key] = { ...(md[key] || {}), color: "#111", textColor: "#fff" };
        cur.setDate(cur.getDate() + 1);
      }
      md[startDate] = { ...(md[startDate] || {}), startingDay: true, color: "#111", textColor: "#fff" };
      md[endDate]   = { ...(md[endDate]   || {}), endingDay:   true, color: "#111", textColor: "#fff" };
    } else if (startDate) {
      md[startDate] = { ...(md[startDate] || {}), startingDay: true, endingDay: true, color: "#111", textColor: "#fff" };
    }
    return md;
  };

  const resetDates = () => {
    setStartDate(null);
    setEndDate(null);
    setDayPriceOverride(null);
  };

  // ouvrir calendrier (pas d’écran externe)
  const openCalendar = () => setCalOpen(true);

  // Aller au checkout (draft vehicule)
  const proceedToCheckout = (s?: string, e?: string) => {
    if (!data) return;
    const start = s ?? startDate;
    const end = e ?? endDate ?? startDate;
    if (!start || !end) return;

    const draft = {
      vehiculeId: data.id,
      startDate: start,
      endDate: end,
      unitPrice: effectiveUnit,
      guests: 1,
      currency: "XOF" as const,
    };

    navigation.navigate("Checkout", { draft, step: 1 });
  };

  const onValidateDates = async () => {
    if (!startDate) return;
    const s = startDate;
    const e = endDate ?? startDate;

    setEndDate(e);
    setCalOpen(false);

    const { data: authData } = await supabase.auth.getSession();
    const sess = authData?.session ?? null;
    if (!sess) {
      navigation.navigate("AuthSheet");
      return;
    }
    proceedToCheckout(s, e);
  };

  // ====== UI ======
  if (loading || !data) {
    return (
      <View style={[styles.center, { backgroundColor: "#fff" }]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const unit = unitFor(data.rental_type);
  const imageCount = data.images.length;
  const title = `${data.marque} ${data.modele}${data.annee ? ` · ${data.annee}` : ""}`;

  const openMaps = () => {
    if (data.latitude && data.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
      Linking.openURL(url).catch(() => {});
    } else {
      Alert.alert("Localisation", data.quartier ? `${data.city}, ${data.quartier}` : data.city);
    }
  };

  const Day = ({
    date, state, marking, onPress,
  }: {
    date: { dateString: string; day: number };
    state: "selected" | "disabled" | "";
    marking?: any;
    onPress: () => void;
  }) => {
    const key = date.dateString;
    const disabled = isPastKey(key) || unavailable[key] || marking?.disabled || state === "disabled";
    const isSE = marking?.startingDay || marking?.endingDay;
    const inPeriod = marking?.color && !isSE;
    const bg = isSE ? "#111" : inPeriod ? "#e5e5e5" : "transparent";
    const txt = isSE ? "#fff" : disabled ? "#bbb" : "#111";

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={disabled ? undefined : onPress}
        style={{
          height: 40, width: 40, alignItems: "center", justifyContent: "center",
          alignSelf: "center", borderRadius: 20, backgroundColor: bg,
        }}
      >
        <Text style={{ color: txt, fontWeight: "700", textDecorationLine: disabled ? "line-through" : "none" }}>
          {date.day}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ===== Render item FastImage (carrousel) ===== */
  // ✅ signature correcte (index bien typé)
const renderSlide: ListRenderItem<ImageItem> = useCallback(({ item, index }) => {
  const isFirst = index === 0;
  const src: FISource = item.url
    ? {
        uri: bust(item.url, item.id),
        priority: isFirst ? FastImage.priority.high : FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }
    : require("../../assets/images/logement.jpg");

  return (
    <FastImage
      source={src}
      style={styles.heroImage}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
}, []);

// ✅ précise le type des items de la FlatList
<FlatList<ImageItem>
  data={imageCount ? data.images : [{ id: "placeholder", url: "" }]}
  keyExtractor={(it) => it.id}
  horizontal
  pagingEnabled
  renderItem={renderSlide}
  onViewableItemsChanged={onViewableItemsChanged.current}
  viewabilityConfig={viewConfigRef.current}
  initialNumToRender={1}
  maxToRenderPerBatch={2}
  windowSize={3}
  removeClippedSubviews
  getItemLayout={(_: any, i: number) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
/>
  const keySlide = useCallback((it: any) => it.id, []);
  const getItemLayout = useCallback(
    (_: any, i: number) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i }),
    []
  );

  return (
    <View style={styles.root}>
      {/* ===== HERO ===== */}
      <View style={styles.hero}>
        <FlatList
          data={imageCount ? data.images : [{ id: "placeholder", url: "" }]}
          keyExtractor={keySlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderSlide}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewConfigRef.current}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          getItemLayout={getItemLayout}
        />

        <SafeAreaView edges={["top"]} style={styles.heroTopBar}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.roundBtn}>
              <Ionicons name="share-outline" size={20} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn}>
              <Ionicons name="heart-outline" size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {imageCount > 1 && (
          <View style={styles.dots}>
            {data.images.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* ===== CONTENU ===== */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>

          <View style={styles.primaryRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.meta}>{data.quartier ? `${data.city}, ${data.quartier}` : data.city}</Text>
            </View>
            <Text style={styles.price}>{data.price} XOF / {unit}</Text>
          </View>

          {/* Tags */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}><Ionicons name="pricetag-outline" size={16} color="#111" /><Text style={styles.tagText}>{data.marque}</Text></View>
            <View style={styles.tag}><Ionicons name="car-sport-outline" size={16} color="#111" /><Text style={styles.tagText}>{data.modele}</Text></View>
            {!!data.transmission && (
              <View style={styles.tag}><Ionicons name="settings-outline" size={16} color="#111" /><Text style={styles.tagText}>{data.transmission === "automatique" ? "Auto" : "Manuelle"}</Text></View>
            )}
            {!!data.annee && (
              <View style={styles.tag}><Ionicons name="calendar-outline" size={16} color="#111" /><Text style={styles.tagText}>{data.annee}</Text></View>
            )}
          </View>
        </View>

        {!!data.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.desc}>{data.description}</Text>
          </View>
        )}

        {/* Équipements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Équipements</Text>
          {equipements.length === 0 ? (
            <Text style={{ color: "#777" }}>Aucun équipement renseigné.</Text>
          ) : (
            <View style={styles.equipGrid}>
              {equipements.map((e) => (
                <View key={e.id} style={styles.equipItem}>
                  <Ionicons name={equipIcon(e.name)} size={18} color="#111" />
                  <Text style={styles.equipText} numberOfLines={1}>{e.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Localisation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localisation</Text>
          <TouchableOpacity style={styles.mapRow} onPress={openMaps} activeOpacity={0.85}>
            <Ionicons name="map-outline" size={18} color="#111" />
            <Text style={styles.mapText}>
              Voir sur la carte {data.latitude && data.longitude ? `(${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})` : ""}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Hôte */}
        {data.owner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Faites connaissance avec votre hôte</Text>
            <View style={styles.hostCard}>
              <View style={styles.hostRow}>
                <FastImage
                  source={
                    data.owner.avatar_url
                      ? ({
                          uri: data.owner.avatar_url,
                          priority: FastImage.priority.normal,
                          cache: FastImage.cacheControl.immutable,
                        } as FISource)
                      : (require("../../assets/images/logement.jpg") as FISource)
                  }
                  style={styles.hostAvatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.hostName}>{data.owner.full_name}</Text>
                  <Text style={styles.hostRole}>Propriétaire</Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: "#eee", marginVertical: 12 }} />

              <Text style={styles.hostInfo}>Taux de réponse : 100%</Text>
              <Text style={styles.hostInfo}>Répond généralement en 1h</Text>

              <TouchableOpacity style={styles.hostBtn} onPress={onPressNegocier} activeOpacity={0.9}>
                <Text style={styles.hostBtnTxt}>Contacter l’hôte</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Règlement & conditions (voiture) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Règlement & conditions</Text>
          {[
            { icon: "id-card-outline", text: "Conducteur principal : 18 ans minimum, permis valide requis." },
            { icon: "sparkles-outline", text: "Rendre le véhicule propre. Frais de nettoyage en cas d’état anormal." },
            { icon: "water-outline", text: "Carburant plein/plein : refaire le plein avant restitution." },
            { icon: "speedometer-outline", text: "Respect du code de la route. Usages dangereux interdits." },
            { icon: "construct-outline", text: "Signaler immédiatement tout incident, dommage ou voyant anormal." },
            { icon: "alert-circle-outline", text: "Amendes et péages à la charge du locataire." },
            { icon: "shield-checkmark-outline", text: "Assurance / caution : peut être requise selon le véhicule." },
            { icon: "alarm-outline", text: "Retard de restitution : frais supplémentaires possibles." },
          ].map((r, i) => (
            <View key={i} style={styles.ruleRow}>
              <Ionicons name={r.icon as any} size={18} color="#111" />
              <Text style={styles.ruleText}>{r.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ===== BARRE BAS ===== */}
      <SafeAreaView style={styles.bottomSafe} edges={[]}>
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomPrice}>
              {totalPrice} <Text style={styles.priceUnit}>XOF / {unit}</Text>
            </Text>
            <Text style={styles.bottomMuted}>
              {nights} {unit === "jour" ? "jour" : "nuit"}{nights > 1 ? "s" : ""} · {effectiveUnit} XOF / {unit}
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={openCalendar}>
              <Text style={styles.primaryText}>Réserver</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={onPressNegocier}>
              <Text style={styles.secondaryText}>Négocier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ===== Calendrier (Modal) ===== */}
      <Modal visible={isCalOpen} animationType="slide" transparent onRequestClose={() => setCalOpen(false)}>
        <View style={styles.calBackdrop}>
          <View style={styles.calSheet}>
            <Pressable style={styles.calClose} onPress={() => setCalOpen(false)}>
              <Ionicons name="close" size={22} color="#111" />
            </Pressable>

            <Text style={styles.calTitle}>Quand ?</Text>

            <View style={styles.tabsRow}>
              {[
                { key: "dates", label: "Dates" },
                { key: "mois", label: "Mois" },
                { key: "flex", label: "Flexible" },
              ].map((t) => {
                const active = tab === (t.key as typeof tab);
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => setTab(t.key as typeof tab)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {tab === "dates" ? (
              <>
                {startDate && (
                  <Text style={{ textAlign: "center", marginBottom: 6, color: "#111", fontWeight: "800" }}>
                    {overridePrices[startDate] != null
                      ? `${overridePrices[startDate]} XOF / ${unit}`
                      : `${data.price} XOF / ${unit}`}
                  </Text>
                )}

                <CalendarList
                  pastScrollRange={0}
                  futureScrollRange={12}
                  onDayPress={onDayPress}
                  markedDates={markedDates()}
                  markingType="period"
                  firstDay={1}
                  minDate={todayKey}
                  disableAllTouchEventsForDisabledDays
                  theme={{ arrowColor: "#111", monthTextColor: "#111", textSectionTitleColor: "#999" }}
                  dayComponent={(p: any) => (
                    <Day
                      date={p.date}
                      state={p.state}
                      marking={p.marking}
                      onPress={() => onDayPress({ dateString: p.date.dateString } as DateData)}
                    />
                  )}
                  style={{ alignSelf: "stretch", height: 420 }}
                />
              </>
            ) : (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#666" }}>La vue “Dates” est active. “Mois” et “Flexible” sont décoratives.</Text>
              </View>
            )}

            <View style={styles.calFooter}>
              <TouchableOpacity onPress={resetDates} activeOpacity={0.8}>
                <Text style={styles.resetLink}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, !startDate && { opacity: 0.4 }]}
                disabled={!startDate}
                onPress={onValidateDates}
                activeOpacity={0.9}
              >
                <Text style={styles.nextBtnText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // HERO
  hero: { width: "100%", height: HERO_H, backgroundColor: "#ddd" },
  heroImage: { width: SCREEN_W, height: "100%" },
  heroTopBar: {
    position: "absolute", left: 0, right: 0, top: 0,
    paddingHorizontal: 12, paddingTop: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  roundBtn: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999,
  },
  dots: {
    position: "absolute", bottom: 10, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.2)" },
  dotActive: { backgroundColor: "#111" },

  // SECTIONS
  section: { paddingHorizontal: 16, paddingTop: 14 },
  title: { fontSize: 26, fontWeight: "900", color: TEXT },
  primaryRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta: { marginLeft: 6, color: SUB, fontWeight: "700" },
  price: { fontSize: 18, fontWeight: "900", color: TEXT },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eee", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  tagText: { color: TEXT, fontWeight: "800" },

  sectionTitle: { fontSize: 18, fontWeight: "900", color: TEXT, marginBottom: 8 },
  desc: { color: "#2f2f2f", lineHeight: 22 },

  // Équipements
  equipGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 10 },
  equipItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: CARD, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#eee",
  },
  equipText: { color: TEXT, fontWeight: "800", maxWidth: SCREEN_W * 0.6 },

  // Map row
  mapRow: {
    backgroundColor: CARD, borderRadius: 12, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#eee",
  },
  mapText: { flex: 1, fontWeight: "800", color: TEXT },

  // Hôte
  hostCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: "#eee",
  },
  hostRow: { flexDirection: "row", alignItems: "center" },
  hostAvatar: { width: 64, height: 64, borderRadius: 32, marginRight: 12 },
  hostName: { fontSize: 18, fontWeight: "900", color: TEXT },
  hostRole: { color: SUB, marginTop: 2, fontWeight: "700" },
  hostInfo: { color: TEXT, fontWeight: "700", marginTop: 6 },
  hostBtn: { marginTop: 12, backgroundColor: "#111", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  hostBtnTxt: { color: "#fff", fontWeight: "900" },

  // Règlement
  ruleRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: "#eee",
    borderRadius: 12, padding: 12, marginTop: 8,
  },
  ruleText: { flex: 1, color: TEXT, fontWeight: "700", lineHeight: 20 },

  // Bottom bar
  bottomSafe: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "transparent" },
  bottomBar: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, height: 100,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: -4 }, shadowRadius: 10, elevation: 6,
  },
  bottomPrice: { color: "#111", fontSize: 20, fontWeight: "900" },
  priceUnit: { fontSize: 16, fontWeight: "700", color: "#111" },
  bottomMuted: { color: SUB, fontSize: 12, fontWeight: "700", marginTop: 2 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryBtn: { backgroundColor: "#111", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryBtn: { backgroundColor: "rgba(0,0,0,0.06)", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  secondaryText: { color: "#111", fontWeight: "900", fontSize: 14 },

  // Modal calendrier
  calBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  calSheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, maxHeight: "90%", overflow: "hidden" },
  calClose: {
    position: "absolute", left: 14, top: 14, zIndex: 2,
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#f2f2f2",
  },
  calTitle: { textAlign: "center", fontSize: 28, fontWeight: "900", color: "#111", marginTop: 8, marginBottom: 8 },
  tabsRow: { flexDirection: "row", alignSelf: "center", gap: 8, marginBottom: 8 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "#efefef" },
  tabBtnActive: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  tabText: { color: "#666", fontWeight: "700" },
  tabTextActive: { color: "#111" },
  calFooter: {
    paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#eee",
  },
  resetLink: { textDecorationLine: "underline", fontWeight: "800", color: "#111", fontSize: 16 },
  nextBtn: { backgroundColor: "#111", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  nextBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
