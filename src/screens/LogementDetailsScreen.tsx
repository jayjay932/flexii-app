// src/screens/LogementDetailsScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  FlatList,
  Dimensions,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { CalendarList, DateData, LocaleConfig } from "react-native-calendars";
import { supabase } from "@/src/lib/supabase";
import { RootStackParamList } from "../navigation/RootNavigator";
import type { Session } from "@supabase/supabase-js";

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

/* -------- Types -------- */
type Props = NativeStackScreenProps<RootStackParamList, "LogementDetails">;

type Owner = { id: string; full_name: string; avatar_url?: string | null };

type Details = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  city: string;
  quartier: string | null;
  images: string[];
  bedrooms?: number;
  toilets?: number;
  showers?: number;
  max_guests?: number;
  owner?: Owner;
  rating?: number;
  reviews_count?: number;
  comments_count?: number;
  rental_type?: string | null;
  check_in_start?: string | null;
  check_out?: string | null;
};

type EquipItem = { name: string; category?: string | null };

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: Owner;
};

type ReservationRow = {
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

/* -------- Constantes UI -------- */
const { width: SCREEN_W } = Dimensions.get("window");
const BANNER_H = 340;
const PANEL_BG = "#f4efe6";

/* petites icônes pour équipements */
const equipIcon = (label: string) => {
  const L = (label || "").toLowerCase();
  if (/(wi[-]?fi|internet)/.test(L)) return "wifi-outline";
  if (/clim|air|ac|conditionn/.test(L)) return "snow-outline";
  if (/chauffage|heater/.test(L)) return "flame-outline";
  if (/t[v|élévision]/.test(L)) return "tv-outline";
  if (/parking|garage|voiture|car/.test(L)) return "car-outline";
  if (/cuisine|kitchen|four|micro/.test(L)) return "restaurant-outline";
  if (/lave[- ]?linge|laundry|wash/.test(L)) return "refresh-outline";
  if (/sèche[- ]?cheveux|hair/.test(L)) return "cut-outline";
  if (/piscine|pool/.test(L)) return "water-outline";
  if (/sécurit|coffre|security|safe/.test(L)) return "shield-checkmark-outline";
  if (/balcon|terrasse|jardin|garden/.test(L)) return "leaf-outline";
  if (/animaux|pets?/.test(L)) return "paw-outline";
  if (/lit|bed/.test(L)) return "bed-outline";
  if (/ascenseur|elevator/.test(L)) return "swap-vertical-outline";
  if (/bureau|workspace|desk/.test(L)) return "laptop-outline";
  return "pricetag-outline";
};

/* util pluriel FR */
const plural = (n: number | undefined, one: string, many: string) => {
  const v = typeof n === "number" ? n : 0;
  return `${v} ${v > 1 ? many : one}`;
};

/* renvoie le 1er élément si la relation est un tableau */
function takeFirst<T>(v: T | T[] | null | undefined): T | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "long" });

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "—");

const demoRange = () => {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  const opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${start.toLocaleDateString("fr-FR", opt)} – ${end.toLocaleDateString("fr-FR", opt)}`;
};

/* ====== Screen ====== */
export default function LogementDetailsScreen({ route, navigation }: Props) {
  const { id } = route.params;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Details | null>(null);
  const [equipements, setEquipements] = useState<EquipItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Auth / session
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // indisponibilités (réservations + overrides indispo)
  const [unavailable, setUnavailable] = useState<Record<string, true>>({});

  // --- Availability overrides (prix jour & indispo jour)
  const [overridePrices, setOverridePrices] = useState<Record<string, number>>({});
  const [overrideUnavailable, setOverrideUnavailable] = useState<Record<string, true>>({});

  // --- Prix override du jour sélectionné
  const [dayPriceOverride, setDayPriceOverride] = useState<number | null>(null);

  // --- Carousel state
  const [index, setIndex] = useState(0);
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setIndex(viewableItems[0].index ?? 0);
  });

  // --- Calendrier (modal)
  const [isCalOpen, setCalOpen] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [tab, setTab] = useState<"dates" | "mois" | "flex">("dates");

  // --- Add-ons ---
  const [addOns, setAddOns] = useState<
    { id: string; name: string; price: number; pricing_model: string }[]
  >([]);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  // --- Réservation (draft) ---
  const [savingReservation, setSavingReservation] = useState(false);

  // Calcul du nombre de nuits (sélection = un seul jour → 1)
  const nights = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
    return diff;
  }, [startDate, endDate]);

  // Totaux add-ons (pour guest_info)
  const addOnsTotals = useMemo(() => {
    let total = 0;
    for (const addon of addOns) {
      if (selectedAddOns.includes(addon.id)) {
        if (addon.pricing_model === "per_night") total += addon.price * nights;
        else total += addon.price;
      }
    }
    return total;
  }, [addOns, selectedAddOns, nights]);

  // Prix négocié éventuel (provenant du chat)
  const [unitPriceOverride, setUnitPriceOverride] = useState<number | null>(null);

  // Prix effectif: prix du jour > prix négocié > prix de base
  const effectiveUnit = useMemo(
    () => (dayPriceOverride ?? unitPriceOverride ?? data?.price ?? 0),
    [dayPriceOverride, unitPriceOverride, data?.price]
  );

  // Prix total dynamique
  const totalPrice = useMemo(() => {
    let base = effectiveUnit * nights;
    for (const addon of addOns) {
      if (selectedAddOns.includes(addon.id)) {
        if (addon.pricing_model === "per_night") base += addon.price * nights;
        else if (addon.pricing_model === "per_stay") base += addon.price;
      }
    }
    return base;
  }, [effectiveUnit, nights, selectedAddOns, addOns]);

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // 👉 handler "Négocier"
  const onPressNegocier = async () => {
    try {
      const { data: authData } = await supabase.auth.getSession();
      const sess = authData?.session ?? null;
      if (!sess) {
        navigation.navigate("AuthSheet");
        return;
      }
      const buyerId = sess.user.id;

      if (!data?.owner?.id) {
        Alert.alert("Indisponible", "Impossible d’ouvrir la négociation : hôte introuvable.");
        return;
      }

      const payload = {
        listing_id: data.id,
        listing_kind: "logement" as const,
        buyer_id: buyerId,
        seller_id: data.owner.id,
        last_message_at: new Date().toISOString(),
      };

      let cid: string | null = null;
      const ins = await supabase
        .from("conversations")
        .insert(payload)
        .select("id")
        .single<{ id: string }>();

      if (ins.error) {
        if ((ins.error as any).code === "23505") {
          const existing = await supabase
            .from("conversations")
            .select("id")
            .eq("listing_id", data.id)
            .eq("listing_kind", "logement")
            .eq("buyer_id", buyerId)
            .eq("seller_id", data.owner.id)
            .maybeSingle<{ id: string }>();

          if (existing.error || !existing.data?.id) {
            console.error(existing.error);
            Alert.alert("Erreur", "Impossible de récupérer la conversation existante.");
            return;
          }
          cid = existing.data.id;
        } else {
          console.error(ins.error);
          Alert.alert("Erreur", "Impossible de créer une nouvelle négociation.");
          return;
        }
      } else {
        cid = ins.data!.id;
      }

      try {
        await supabase.from("messages").insert({
          conversation_id: cid,
          sender_id: buyerId,
          type: "system",
          content: "🔁 Nouvelle négociation ouverte",
          meta: { action: "negotiation_open" },
        });
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", cid);
      } catch (e) {
        console.warn("Impossible d’insérer le marqueur de négo", e);
      }

      navigation.navigate("Chat", {
        listingId: data.id,
        ownerId: data.owner.id,
        listingTitle: data.title,
        conversationId: cid!,
        forceOpenNegotiation: true,
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Une erreur est survenue.");
    }
  };

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

  /* ===== Session ===== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: authData } = await supabase.auth.getSession();
      if (mounted) setSession(authData?.session ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
      if (sess) setShowAuth(false);
    });
    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, []);

  /* ===== Chargements init ===== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        type RawRow = {
          id: string;
          title: string;
          description: string | null;
          price: number;
          city: string;
          quartier: string | null;
          bedrooms?: number;
          toilets?: number;
          showers?: number;
          max_guests?: number;
          rental_type?: string | null;
          check_in_start?: string | null;
          check_out?: string | null;
          listing_images?: { image_url: string | null }[];
          users?:
            | { id: string; full_name: string; avatar_url?: string | null }
            | Array<{
                id: string;
                full_name: string;
                avatar_url?: string | null;
              }>;
        };

        /* 1) Listing */
        const { data: logement, error } = await supabase
          .from("listings_logements")
          .select(
            `
            id, title, description, price, city, quartier,
            bedrooms, toilets, showers, max_guests,
            check_in_start, check_out,
            rental_type,   
            listing_images ( image_url ),
            users:owner_id ( id, full_name, avatar_url )
          `
          )
          .eq("id", id)
          .maybeSingle<RawRow>();

        if (error) throw error;
        if (!logement) throw new Error("Listing introuvable");

        const imgs =
          (logement.listing_images ?? [])
            .map((x) => x?.image_url)
            .filter(Boolean) as string[];

        const u = takeFirst(logement.users);
        const owner: Owner | undefined = u
          ? { id: u.id, full_name: u.full_name, avatar_url: u.avatar_url }
          : undefined;

        /* 2) Équipements */
        let eq: EquipItem[] = [];
        try {
          const { data: eqRows } = await supabase
            .from("listing_equipements")
            .select(`equipements:equipement_id ( name, category )`)
            .eq("logement_id", id);
          eq =
            eqRows?.map((row: any) => ({
              name: row?.equipements?.name ?? "",
              category: row?.equipements?.category ?? null,
            })) ?? [];
        } catch {}

        /* 3) Réservations -> indisponibles (check-in inclus -> check-out exclu) */
      /* 3) Réservations -> indisponibles (fin EXCLUE = jour de checkout dispo) */
/* Helpers UTC-safe (évite les décalages DST) */
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
};
const keyUTC = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Ajoute toutes les dates réservées dans into avec fin EXCLUE.
 * - Si end <= start (ex: réservation d'1 seul jour stockée start=end),
 *   on considère endExclusive = start + 1 jour → le jour 'start' est barré.
 */
const addRangeFromReservation = (
  startISO: string,
  endISO: string,
  into: Record<string, true>
) => {
  try {
    const start = toUTC(startISO);
    const end = toUTC(endISO);

    // calcul fin exclusive
    const endExclusive =
      end.getTime() <= start.getTime()
        ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1))
        : end;

    for (let d = new Date(start); d < endExclusive; d.setUTCDate(d.getUTCDate() + 1)) {
      into[keyUTC(d)] = true;
    }
  } catch {}
};

const { data: res } = await supabase
  .from("reservations")
  .select("start_date, end_date, status")
  .eq("logement_id", id)
  .in("status", ["confirmed", "completed"]);

const disabledByResa: Record<string, true> = {};
(res ?? []).forEach((r) => {
  if (r.start_date && r.end_date) {
    addRangeFromReservation(r.start_date, r.end_date, disabledByResa);
  }
});

/* 3bis) Availability Overrides (indispo + prix) — inchangé */
const today = new Date();
const future = new Date();
future.setMonth(future.getMonth() + 18);
const todayKey = today.toISOString().slice(0, 10);
const futureKey = future.toISOString().slice(0, 10);

const { data: ov } = await supabase
  .from("availability_overrides")
  .select("date, is_available, price")
  .eq("listing_type", "logement")
  .eq("listing_id", id)
  .gte("date", todayKey)
  .lte("date", futureKey);

const ovPrices: Record<string, number> = {};
const ovDisabled: Record<string, true> = {};
(ov ?? []).forEach((r: any) => {
  const k = r.date; // 'YYYY-MM-DD'
  if (r.is_available === false) ovDisabled[k] = true;
  if (r.price != null) ovPrices[k] = Number(r.price);
});

// Final : indispo = réservations + overrides non dispo
const combinedDisabled: Record<string, true> = { ...disabledByResa, ...ovDisabled };

setOverridePrices(ovPrices);
setOverrideUnavailable(ovDisabled);
setUnavailable(combinedDisabled);
        /* 4) Add-ons */
        let addOnsFetched: {
          id: string;
          name: string;
          price: number;
          pricing_model: string;
        }[] = [];
        try {
          const { data: addRows } = await supabase
            .from("listing_add_ons")
            .select(`
              id,
              add_ons ( id, name, price, pricing_model )
            `)
            .eq("logement_id", id);
          addOnsFetched =
            addRows?.map((r: any) => ({
              id: r.add_ons.id,
              name: r.add_ons.name,
              price: Number(r.add_ons.price),
              pricing_model: r.add_ons.pricing_model,
            })) ?? [];
        } catch {}

        /* 5) Avis */
        const { data: resRows } = await supabase
          .from("reservations")
          .select("id")
          .eq("logement_id", id)
          .in("status", ["completed", "confirmed"]);

        let revs: Review[] = [];
        if (Array.isArray(resRows) && resRows.length > 0) {
          const resIds = resRows.map((r: any) => r.id);
          const { data: rws } = await supabase
            .from("reviews")
            .select(
              `
              id, rating, comment, created_at,
              reviewer:reviewer_id ( id, full_name, avatar_url )
            `
            )
            .in("reservation_id", resIds)
            .order("created_at", { ascending: false });

          revs =
            (rws ?? []).map((r: any) => ({
              id: r.id,
              rating: r.rating,
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
        }

        const reviews_count = revs.length;
        const avg =
          reviews_count > 0
            ? Math.round(
                (revs.reduce((s, rr) => s + (Number(rr.rating) || 0), 0) / reviews_count) * 10
              ) / 10
            : undefined;

        if (!cancelled) {
          setData({
            id: logement.id,
            title: logement.title,
            description: logement.description,
            price: logement.price,
            city: logement.city,
            quartier: logement.quartier,
            rental_type: logement.rental_type ?? "nuit",
            images: imgs.length ? imgs : [""],
            bedrooms: logement.bedrooms ?? 0,
            toilets: logement.toilets ?? 0,
            showers: logement.showers ?? 0,
            max_guests: logement.max_guests ?? 1,
            owner,
            rating: avg,
            reviews_count,
            comments_count: reviews_count,
            check_in_start: logement.check_in_start ?? null,
            check_out: logement.check_out ?? null,
          });
          setEquipements(eq);
          setReviews(revs);
          setOverridePrices(ovPrices);
          setOverrideUnavailable(ovDisabled);
          setUnavailable(combinedDisabled);
          setAddOns(addOnsFetched);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setData(null);
          setReviews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const locationText = useMemo(() => {
    if (!data) return "";
    return data.quartier ? `${data.city}, ${data.quartier}` : data.city;
  }, [data]);

  const unitLabel = useMemo(() => {
    const t = (data?.rental_type || "nuit").toLowerCase();
    if (["nuit", "night"].includes(t)) return "nuit";
    if (["jour", "day"].includes(t)) return "jour";
    if (["semaine", "week"].includes(t)) return "semaine";
    if (["mois", "month"].includes(t)) return "mois";
    return t;
  }, [data?.rental_type]);

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const imageCount = data.images.length;
  const toggle = (rid: string) => setExpanded((m) => ({ ...m, [rid]: !m[rid] }));

  /* ===== Calendrier helpers ===== */
  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const isPastKey = (key: string) => key < todayKey;

  // Sélectionne 1 seul jour ; applique le prix override du jour si présent
  // === Sélection de dates ===
const onDayPress = (day: DateData) => {
  const d = day.dateString;
  if (unavailable[d] || isPastKey(d)) return;

  // Aucun start -> on initialise
  if (!startDate || (startDate && endDate)) {
    setStartDate(d);
    setEndDate(null);
    setDayPriceOverride(overridePrices[d] ?? null);
    return;
  }

  // Si start existe mais pas encore end
  if (startDate && !endDate) {
    if (d < startDate) {
      // si l'utilisateur clique avant le start, on redéfinit start
      setStartDate(d);
      setDayPriceOverride(overridePrices[d] ?? null);
    } else {
      // sinon on définit la plage
      setEndDate(d);
    }
  }
};

// === Marquage des dates ===
const markedDates = () => {
  const md: Record<
    string,
    {
      color?: string;
      textColor?: string;
      startingDay?: boolean;
      endingDay?: boolean;
      disabled?: boolean;
      disableTouchEvent?: boolean;
    }
  > = {};

  // Jours indispos
  Object.keys(unavailable).forEach((k) => {
    md[k] = { ...(md[k] || {}), disabled: true, disableTouchEvent: true };
  });

  // Si plage complète
  if (startDate && endDate) {
    let cur = new Date(startDate);
    const end = new Date(endDate);

    while (cur <= end) {
      const key = toKey(cur);
      md[key] = {
        ...(md[key] || {}),
        color: "#111",
        textColor: "#fff",
      };
      cur.setDate(cur.getDate() + 1);
    }

    md[startDate] = { ...(md[startDate] || {}), startingDay: true, color: "#111", textColor: "#fff" };
    md[endDate] = { ...(md[endDate] || {}), endingDay: true, color: "#111", textColor: "#fff" };
  }

  // Si seulement start sélectionné
  else if (startDate) {
    md[startDate] = {
      ...(md[startDate] || {}),
      startingDay: true,
      endingDay: true,
      color: "#111",
      textColor: "#fff",
    };
  }

  return md;
};


  const resetDates = () => {
    setStartDate(null);
    setEndDate(null);
    setDayPriceOverride(null);
  };

  /* ========= NAVIGATION CHECKOUT ========= */

  const openCalendar = () => {
    setCalOpen(true);
  };

  // Navigation vers Checkout (appelée depuis "Suivant")
  // ⬇ Remplace ta version de proceedToCheckout par celle-ci
const proceedToCheckout = (s?: string, e?: string) => {
  if (!data) return;

  // On utilise ce qui est passé, sinon l’état, et on retombe
  // sur startDate si end est absent (cas “un seul jour”)
  const start = s ?? startDate;
  const end = e ?? endDate ?? startDate;

  if (!start || !end) return;

  const draft = {
    logementId: data.id,
    startDate: start,
    endDate: end,
    unitPrice: effectiveUnit,         // prix jour > négocié > base
    addOns,
    selectedAddOnIds: selectedAddOns,
    guests: 1,
    currency: "XOF" as const,
  };

  navigation.navigate("Checkout", { draft, step: 1 });
};

// ⬇ Remplace ta version de onValidateDates par celle-ci
const onValidateDates = async () => {
  if (!startDate) return;

  // Si l’utilisateur n’a choisi qu’un seul jour, on prend start = end
  const s = startDate;
  const e = endDate ?? startDate;

  // On peut mettre l’état pour l’UI, mais on ne s’en sert pas pour naviguer
  setEndDate(e);
  setCalOpen(false);

  const { data: authData } = await supabase.auth.getSession();
  const sess = authData?.session ?? null;
  if (!sess) {
    navigation.navigate("AuthSheet");
    return;
  }

  // ✅ Navigue avec la plage calculée localement (pas dépendant du setState)
  proceedToCheckout(s, e);
};


  const Day = ({
    date,
    state,
    marking,
    onPress,
  }: {
    date: { dateString: string; day: number };
    state: "selected" | "disabled" | "";
    marking?: any;
    onPress: () => void;
  }) => {
    const key = date.dateString;
    const disabled =
      isPastKey(key) || unavailable[key] || marking?.disabled || state === "disabled";

    const isSE = marking?.startingDay || marking?.endingDay;
    const inPeriod = marking?.color && !isSE;

    const bg = isSE ? "#111" : inPeriod ? "#e5e5e5" : "transparent";
    const txt = isSE ? "#fff" : disabled ? "#bbb" : "#111";

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={disabled ? undefined : onPress}
        style={{
          height: 40,
          width: 40,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          borderRadius: 20,
          backgroundColor: bg,
        }}
      >
        <Text
          style={{
            color: txt,
            fontWeight: "700",
            textDecorationLine: disabled ? "line-through" : "none",
          }}
        >
          {date.day}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      {/* ===== BANNIÈRE / CAROUSEL ===== */}
      <View style={styles.banner}>
        <FlatList
          data={data.images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image
              source={
                item
                  ? { uri: item }
                  : require("../../assets/images/logement.jpg")
              }
              style={{ width: SCREEN_W, height: BANNER_H }}
              resizeMode="cover"
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewConfigRef.current}
        />

        {imageCount > 1 && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {index + 1} / {imageCount}
            </Text>
          </View>
        )}

        <SafeAreaView edges={["top"]} style={styles.bannerTop}>
          <TouchableOpacity
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: "Logements" }],
              })
            }
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="share-outline" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFav((v) => !v)}
              style={styles.iconBtn}
            >
              <Ionicons
                name={fav ? "heart" : "heart-outline"}
                size={22}
                color={fav ? "#E61E4D" : "#000"}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* ===== FEUILLE ===== */}
      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 220 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Titre + localisation */}
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>Logement entier · {locationText}</Text>

          {/* Ligne type Airbnb */}
          <Text style={styles.badgesLine}>
            {plural(data.max_guests, "voyageur", "voyageurs")} ·{" "}
            {plural(data.bedrooms, "chambre", "chambres")} ·{" "}
            {plural(data.showers, "douche", "douches")}
            {data.toilets && data.toilets > 0
              ? ` · ${plural(data.toilets, "toilette", "toilettes")}`
              : ""}
          </Text>

          {/* Note courte */}
          <View style={styles.row}>
            <Ionicons name="star" size={16} color="#111" />
            <Text style={styles.rateText}>
              {typeof data.rating === "number" ? data.rating : "4,9"}{" "}
              <Text style={styles.muted}>{data.reviews_count ?? 0} avis</Text>
            </Text>
          </View>

          {/* Description */}
          {data.description && (
            <>
              <View style={styles.hr} />
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.desc}>{data.description}</Text>
            </>
          )}

          {/* Équipements */}
          {equipements.length > 0 && (
            <>
              <View style={styles.hr} />
              <Text style={styles.sectionTitle}>Équipements</Text>
              <View style={styles.equipWrap}>
                {equipements.map((eq, idx) => (
                  <View key={`${eq.name}-${idx}`} style={styles.equipItem}>
                    <Ionicons name={equipIcon(eq.name) as any} size={18} color="#222" />
                    <Text style={styles.equipText} numberOfLines={1}>
                      {eq.name}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ===== Options & services (Add-ons) ===== */}
          {addOns.length > 0 && (
            <>
              <View style={styles.hr} />
              <Text style={styles.sectionTitle}>Options & services</Text>

              <View style={styles.addOnWrap}>
                {addOns.map((opt) => {
                  const selected = selectedAddOns.includes(opt.id);
                  const priceLabel =
                    opt.pricing_model === "per_night"
                      ? `${opt.price} XOF/nuit`
                      : `${opt.price} XOF / séjour`;

                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.85}
                      onPress={() => toggleAddOn(opt.id)}
                      style={[
                        styles.addOnItem,
                        selected && styles.addOnItemSelected,
                      ]}
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={20}
                        color={selected ? "#111" : "#666"}
                        style={{ marginRight: 10 }}
                      />

                      <View style={{ flex: 1 }}>
                        <Text style={styles.addOnName}>{opt.name}</Text>
                        <Text style={styles.addOnMeta}>{priceLabel}</Text>
                      </View>

                      <Text style={styles.addOnPrice}>
                        {opt.pricing_model === "per_night"
                          ? `+${opt.price}XOF /nuit`
                          : `+${opt.price}XOF`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ===== Host Card ===== */}
          {data.owner && (
            <>
              <View style={styles.hr} />
              <Text style={styles.sectionTitle}>
                Faites connaissance avec votre hôte
              </Text>
              <View style={styles.hr} />

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate("HostProfile", {
                    hostId: data.owner!.id,
                    hostName: data.owner!.full_name,
                  })
                }
              >
                <View style={styles.hostCard}>
                  <View style={styles.hostRow}>
                    <Image
                      source={
                        data.owner.avatar_url
                          ? { uri: data.owner.avatar_url }
                          : require("../../assets/images/logement.jpg")
                      }
                      style={styles.hostAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hostNameBig}>
                        {data.owner.full_name}
                      </Text>
                      <Text style={styles.hostRole}>Hôte</Text>
                    </View>
                    <View style={styles.hostStats}>
                      <Text style={styles.hostStatValue}>
                        {data.reviews_count ?? 0}
                      </Text>
                      <Text style={styles.hostStatLabel}>évaluations</Text>
                    </View>
                  </View>

                  <View style={styles.hostInfoRow}>
                    <Ionicons name="school-outline" size={18} color="#222" />
                    <Text style={styles.hostInfoText}>
                      L’endroit où j’ai étudié : —
                    </Text>
                  </View>
                  <View style={styles.hostInfoRow}>
                    <Ionicons name="language-outline" size={18} color="#222" />
                    <Text style={styles.hostInfoText}>
                      Langues parlées : —
                    </Text>
                  </View>

                  <View style={styles.hostDivider} />

                  <Text style={styles.hostInfoHeader}>
                    Informations sur l’hôte
                  </Text>
                  <Text style={styles.hostInfoText}>Taux de réponse : 100 %</Text>
                  <Text style={styles.hostInfoText}>Répond dans l’heure</Text>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.hostMessageBtn}
                    onPress={onPressNegocier}
                  >
                    <Text style={styles.hostMessageText}>
                      Envoyer un message à l’hôte
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* ===== Commentaires ===== */}
          <View style={styles.hr} />
          <View style={styles.reviewHero}>
            <Ionicons
              name="leaf"
              size={30}
              color="#333"
              style={{ opacity: 0.7 }}
            />
            <Text style={styles.reviewHeroScore}>
              {typeof data.rating === "number"
                ? data.rating.toFixed(2).replace(".", ",")
                : "4,84"}
            </Text>
            <Ionicons
              name="leaf"
              size={30}
              color="#333"
              style={{ opacity: 0.7 }}
            />
          </View>
          <Text style={styles.reviewHeroTitle}>Coup de cœur voyageurs</Text>
          <Text style={styles.reviewHeroDesc}>
            Ce logement fait partie des Coups de cœur voyageurs, à partir des
            évaluations, commentaires et de la fiabilité des annonces selon les
            voyageurs.
          </Text>

          {reviews.length === 0 ? (
            <Text style={{ color: "#666", marginTop: 8 }}>
              Aucun commentaire pour l’instant.
            </Text>
          ) : (
            <View style={styles.reviewGrid}>
              {reviews.slice(0, 2).map((rv) => {
                const isOpen = expanded[rv.id];
                const text = rv.comment ?? "";
                const short =
                  text.length > 160 && !isOpen
                    ? text.slice(0, 160).trimEnd() + "…"
                    : text;
                return (
                  <View key={rv.id} style={styles.reviewTile}>
                    <View style={styles.reviewHeader}>
                      <Image
                        source={
                          rv.reviewer?.avatar_url
                            ? { uri: rv.reviewer.avatar_url }
                            : require("../../assets/images/logement.jpg")
                        }
                        style={styles.reviewAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewName}>
                          {rv.reviewer?.full_name ?? "Voyageur"}
                        </Text>
                        <Text style={styles.reviewDate}>
                          {fmtDate(rv.created_at)}
                        </Text>
                      </View>
                      <View style={styles.reviewNote}>
                        <Ionicons name="star" size={14} color="#111" />
                        <Text style={styles.reviewNoteText}>{rv.rating}</Text>
                      </View>
                    </View>
                    {!!short && <Text style={styles.reviewText}>{short}</Text>}

                    {text.length > 160 && (
                      <TouchableOpacity onPress={() => toggle(rv.id)}>
                        <Text style={styles.link}>
                          {isOpen ? "Afficher moins" : "Afficher plus"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {reviews.length > 0 && (
            <TouchableOpacity
              style={styles.showAllBtn}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate("AllReviews", {
                  listingId: data.id,
                  title: data.title,
                })
              }
            >
              <Text style={styles.showAllText}>
                Afficher les {reviews.length} commentaires
              </Text>
            </TouchableOpacity>
          )}

          {/* ===== Sections supplémentaires ===== */}
          <View style={styles.hr} />
          <Text style={styles.sectionTitle}>Disponibilités</Text>
          <TouchableOpacity style={styles.rowLink} activeOpacity={0.8}>
            <Text style={styles.rowLinkText}>{demoRange()}</Text>
            <Ionicons name="chevron-forward" size={18} color="#222" />
          </TouchableOpacity>

          <View style={styles.sectionBlock}>
            <Text style={styles.blockTitle}>Conditions d'annulation</Text>
            <Text style={styles.blockText}>
              Si vous annulez avant l'arrivée prévue, vous aurez droit à un
              remboursement partiel. Passé ce délai, cette réservation n'est pas
              remboursable.
            </Text>
            <View style={styles.inlineLinkRow}>
              <Text style={styles.inlineLink}>
                Consultez les conditions complètes de cet hôte
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#111" />
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.blockTitle}>Règlement intérieur</Text>
            <Text style={styles.blockText}>
              Arrivée à partir de {fmtTime(data.check_in_start)}
            </Text>
            <Text style={styles.blockText}>
              Départ avant {fmtTime(data.check_out)}
            </Text>
            <Text style={styles.blockText}>
              {plural(
                data.max_guests,
                "voyageur maximum",
                "voyageurs maximum"
              )}
            </Text>
            <Text style={styles.inlineLink}>Lire la suite</Text>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.blockTitle}>Sécurité et logement</Text>
            <Text style={styles.blockText}>Détecteur de monoxyde de carbone</Text>
            <Text style={styles.blockText}>Détecteur de fumée</Text>
            <Text style={styles.inlineLink}>Lire la suite</Text>
          </View>

          <TouchableOpacity style={styles.reportRow} activeOpacity={0.8}>
            <Ionicons name="flag-outline" size={18} color="#111" />
            <Text style={styles.reportText}>Signaler cette annonce</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ===== Bas de page ===== */}
      <SafeAreaView style={styles.bottomSafe} edges={[]}>
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.price}>
              {totalPrice} <Text style={styles.priceUnit}>XOF/ {unitLabel} </Text>
            </Text>
            <Text style={styles.priceSmall}>
              {nights} nuit{nights > 1 ? "s" : ""} · {effectiveUnit}XOF /{unitLabel}
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={openCalendar}
            >
              <Text style={styles.primaryText}>Réserver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onPressNegocier}
            >
              <Text style={styles.secondaryText}>Négocier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ===== Calendrier (Modal) ===== */}
      <Modal
        visible={isCalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCalOpen(false)}
      >
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
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {tab === "dates" ? (
              <>
                {startDate && (
                  <Text
                    style={{
                      textAlign: "center",
                      marginBottom: 6,
                      color: "#111",
                      fontWeight: "800",
                    }}
                  >
                    {overridePrices[startDate] != null
                      ? `${overridePrices[startDate]} XOF / ${unitLabel}`
                      : `${data.price} XOF / ${unitLabel}`}
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
                  theme={{
                    arrowColor: "#111",
                    monthTextColor: "#111",
                    textSectionTitleColor: "#999",
                  }}
                  dayComponent={(p: any) => (
                    <Day
                      date={p.date}
                      state={p.state}
                      marking={p.marking}
                      onPress={() =>
                        onDayPress({ dateString: p.date.dateString } as DateData)
                      }
                    />
                  )}
                  style={{ alignSelf: "stretch", height: 420 }}
                />
              </>
            ) : (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#666" }}>
                  La vue “Dates” est active. “Mois” et “Flexible” sont
                  décoratives.
                </Text>
              </View>
            )}

            <View style={styles.calFooter}>
              <TouchableOpacity onPress={resetDates} activeOpacity={0.8}>
                <Text style={styles.resetLink}>Réinitialiser</Text>
              </TouchableOpacity>
             <TouchableOpacity
  style={[
    styles.nextBtn,
    (!(startDate) || savingReservation) && { opacity: 0.4 },
  ]}
  disabled={!(startDate) || savingReservation}
  onPress={onValidateDates}
  activeOpacity={0.9}
>
  {savingReservation ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={styles.nextBtnText}>Suivant</Text>
  )}
</TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* -------- Styles -------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Bannière / Carousel
  banner: { width: "100%", height: BANNER_H, backgroundColor: "#000" },
  bannerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  counterBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(30,30,30,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  counterText: { color: "#fff", fontWeight: "700" },

  // Feuille
  sheet: {
    flex: 1,
    backgroundColor: PANEL_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -12,
    paddingTop: 16,
    paddingHorizontal: 18,
  },

  title: { fontSize: 28, fontWeight: "800", color: "#111" },
  meta: { fontSize: 15, color: "#565656", marginTop: 6 },

  badgesLine: {
    marginTop: 6,
    fontSize: 15,
    color: "#6b6b6b",
    fontWeight: "600",
  },

  row: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  rateText: { marginLeft: 6, fontSize: 15, fontWeight: "700", color: "#111" },
  muted: { color: "#6b6b6b", fontWeight: "600" },

  hr: { height: 1, backgroundColor: "rgba(0,0,0,0.08)", marginVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111" },

  desc: { marginTop: 8, fontSize: 15, lineHeight: 22, color: "#2f2f2f" },

  // Add-ons
  addOnWrap: { marginTop: 10, gap: 10 },
  addOnItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  addOnItemSelected: { borderColor: "#111" },
  addOnName: { fontSize: 15, fontWeight: "700", color: "#111" },
  addOnMeta: { marginTop: 2, fontSize: 13, color: "#6b6b6b" },
  addOnPrice: { fontSize: 14, fontWeight: "800", color: "#111", marginLeft: 10 },

  // Bottom bar extra
  priceSmall: { fontSize: 12, color: "#6b6b6b", fontWeight: "600", marginTop: 2 },

  // Reviews hero
  reviewHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  reviewHeroScore: {
    fontSize: 48,
    fontWeight: "900",
    color: "#111",
    letterSpacing: 0.5,
  },
  reviewHeroTitle: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
  },
  reviewHeroDesc: {
    textAlign: "center",
    marginTop: 8,
    color: "#6b6b6b",
    lineHeight: 20,
  },

  // Reviews grid
  reviewGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewTile: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center" },
  reviewAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  reviewName: { fontSize: 15, fontWeight: "700", color: "#111" },
  reviewDate: { fontSize: 12, color: "#777", marginTop: 2 },
  reviewNote: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewNoteText: { marginLeft: 4, fontWeight: "800", color: "#111" },
  reviewText: { marginTop: 8, fontSize: 14, color: "#2f2f2f", lineHeight: 20 },
  link: {
    marginTop: 6,
    fontSize: 14,
    textDecorationLine: "underline",
    color: "#111",
    fontWeight: "700",
  },

  // Équipements
  equipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 12,
    marginTop: 10,
  },
  equipItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  equipText: {
    marginLeft: 8,
    maxWidth: 160,
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },

  // Host card
  hostCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  hostRow: { flexDirection: "row", alignItems: "center" },
  hostAvatar: { width: 72, height: 72, borderRadius: 36, marginRight: 14 },
  hostNameBig: { fontSize: 22, fontWeight: "800", color: "#111" },
  hostRole: { fontSize: 14, color: "#6b6b6b", marginTop: 2 },
  hostStats: { alignItems: "flex-end" },
  hostStatValue: { fontSize: 20, fontWeight: "800", color: "#111" },
  hostStatLabel: { fontSize: 12, color: "#6b6b6b" },
  hostInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  hostInfoText: { fontSize: 15, color: "#222" },
  hostDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.08)", marginVertical: 14 },
  hostInfoHeader: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 6 },
  hostMessageBtn: {
    marginTop: 14,
    backgroundColor: "#f3f3f3",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  hostMessageText: { fontWeight: "700", color: "#111" },

  // Bouton "Afficher les X commentaires"
  showAllBtn: {
    marginTop: 14,
    backgroundColor: "#f3f3f3",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  showAllText: { fontWeight: "800", color: "#111", fontSize: 15 },

  // Sections
  rowLink: {
    marginTop: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLinkText: { fontSize: 15, fontWeight: "700", color: "#111" },

  sectionBlock: {
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  blockTitle: { fontSize: 22, fontWeight: "900", color: "#111", marginBottom: 8 },
  blockText: { fontSize: 15, color: "#2f2f2f", lineHeight: 22, marginBottom: 4 },

  inlineLinkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  inlineLink: { color: "#111", textDecorationLine: "underline", fontWeight: "800" },

  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  reportText: { fontSize: 16, fontWeight: "800", color: "#111", textDecorationLine: "underline" },

  // Bottom bar
  bottomSafe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  bottomBar: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 10,
    elevation: 6,
  },
  price: { fontSize: 20, fontWeight: "900", color: "#111" },
  priceUnit: { fontSize: 16, fontWeight: "700", color: "#111" },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryBtn: { backgroundColor: "#111", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryBtn: {
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryText: { color: "#111", fontWeight: "900", fontSize: 14 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ===== Modal calendrier =====
  calBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  calSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    maxHeight: "90%",
    overflow: "hidden",
  },
  calClose: {
    position: "absolute",
    left: 14,
    top: 14,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f2",
  },
  calTitle: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "900",
    color: "#111",
    marginTop: 8,
    marginBottom: 8,
  },
  tabsRow: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 8,
    marginBottom: 8,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#efefef",
  },
  tabBtnActive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  tabText: { color: "#666", fontWeight: "700" },
  tabTextActive: { color: "#111" },

  calFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
  },
  resetLink: { textDecorationLine: "underline", fontWeight: "800", color: "#111", fontSize: 16 },
  nextBtn: { backgroundColor: "#111", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  nextBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
