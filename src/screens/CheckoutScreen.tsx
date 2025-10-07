// src/screens/CheckoutScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from '@/src/ui/Icon';;
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/src/lib/supabase";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

/* ---------- Helpers ---------- */
const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(n);

const SERVICE_FEE_PER_NIGHT = 0 as const;

const genReservationCode = () =>
  (
    "TG-" +
    Math.random().toString(36).slice(2, 6) +
    "-" +
    Date.now().toString(36).slice(-4)
  )
    .replace(/[^A-Z0-9-]/gi, "")
    .toUpperCase();

/* ---------- Types BDD minimales ---------- */
type ReservationRow = {
  id: string;
  logement_id: string | null;
  vehicule_id: string | null;
  start_date: string;
  end_date: string;
  unit_price: number | null;
  total_price: number;
  status: string | null;
  currency: string | null;
  guests_count: number | null;
  guest_info: any | null;
};

type LogementRow = {
  id: string;
  title: string;
  price: number;
  city: string;
  listing_images?: { image_url: string | null }[];
};

type VehiculeRow = {
  id: string;
  marque: string;
  modele: string;
  annee: number | null;
  price: number;
  city: string;
  rental_type?: string | null;
  listing_images?: { image_url: string | null }[];
};

/* ---------- État visuel générique (carte en haut) ---------- */
type Subject =
  | {
      kind: "logement";
      id: string;
      title: string;
      subtitle?: string;
      rating?: number | null;
      reviews?: number | null;
      cover?: string | null;
      price: number;
    }
  | {
      kind: "vehicule";
      id: string;
      title: string; // ex: "BMW M3 · 2020"
      subtitle?: string; // ville
      rating?: number | null;
      reviews?: number | null;
      cover?: string | null;
      price: number;
    };

export default function CheckoutScreen({ route, navigation }: Props) {
  const { reservationId, draft, step: stepFromRoute = 1 } = route.params;

  // véh./logement depuis le draft
  const draftAny = draft as any;
  const vehiculeIdFromDraft = (draftAny?.vehiculeId as string | undefined) || undefined;
  const logementIdFromDraft = draft?.logementId;

  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<ReservationRow | null>(null);

  const [subject, setSubject] = useState<Subject | null>(null); // carte du haut
  const [payChoice, setPayChoice] = useState<"service_fee_only" | "all_online">("service_fee_only");
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>((stepFromRoute as 1 | 2 | 3) ?? 1);
  const NEXT: Record<1 | 2 | 3, 1 | 2 | 3> = { 1: 2, 2: 3, 3: 3 };

  /** ------- helpers de chargement sûrs ------- */
  const loadVehiculeSubject = async (vehId: string): Promise<Subject | null> => {
    const { data: v, error } = await supabase
      .from("listings_vehicules")
      .select(`id, marque, modele, annee, price, city, rental_type, listing_images(image_url)`)
      .eq("id", vehId)
      .maybeSingle<VehiculeRow>();
    if (error) throw error;
    if (!v) return null;
    return {
      kind: "vehicule",
      id: v.id,
      title: `${v.marque ?? ""} ${v.modele ?? ""}${v.annee ? ` · ${v.annee}` : ""}`.trim(),
      subtitle: v.city,
      cover: v.listing_images?.[0]?.image_url ?? undefined,
      price: Number(v.price),
    };
  };

  const loadLogementSubject = async (logId: string): Promise<Subject | null> => {
    // ⚠️ IMPORTANT: ne pas demander 'reviews_count' / 'rating' si elles n’existent pas chez toi
    const { data: l, error } = await supabase
      .from("listings_logements")
      .select(`id, title, price, city, listing_images(image_url)`)
      .eq("id", logId)
      .maybeSingle<LogementRow>();
    if (error) throw error;
    if (!l) return null;
    return {
      kind: "logement",
      id: l.id,
      title: l.title,
      subtitle: l.city,
      rating: null, // valeur par défaut (tu peux les brancher plus tard)
      reviews: null,
      cover: l.listing_images?.[0]?.image_url ?? undefined,
      price: Number(l.price),
    };
  };

  /* ---------- Chargement initial ---------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 1) Mode DRAFT (depuis un détail)
        if (draft) {
          if (vehiculeIdFromDraft) {
            const subj = await loadVehiculeSubject(vehiculeIdFromDraft);
            setSubject(subj);
            setRes(null);
          } else if (logementIdFromDraft) {
            const subj = await loadLogementSubject(logementIdFromDraft);
            setSubject(subj);
            setRes(null);
          } else {
            throw new Error("Draft invalide : aucun identifiant.");
          }
        }

        // 2) Mode “reservation existante”
        else if (reservationId) {
          const { data: r, error } = await supabase
            .from("reservations")
            .select(
              `id, logement_id, vehicule_id, start_date, end_date, unit_price, total_price, currency, status, guests_count, guest_info`
            )
            .eq("id", reservationId)
            .maybeSingle<ReservationRow>();
          if (error) throw error;
          setRes(r || null);

          if (r?.vehicule_id) {
            const subj = await loadVehiculeSubject(r.vehicule_id);
            setSubject(subj);
          } else if (r?.logement_id) {
            const subj = await loadLogementSubject(r.logement_id);
            setSubject(subj);
          } else {
            throw new Error("Réservation sans cible (logement/vehicule).");
          }
        } else {
          throw new Error("Paramètres manquants.");
        }
      } catch (e: any) {
        console.error("[Checkout] load error:", e?.message ?? e);
        Alert.alert("Erreur", "Impossible de charger les données.");
      } finally {
        setLoading(false);
      }
    })();
  }, [reservationId, draft, logementIdFromDraft, vehiculeIdFromDraft]);

  /* ---------- Données calculées ---------- */
  const cur = draft?.currency || res?.currency || "XOF";
  const unit = draft?.unitPrice ?? res?.unit_price ?? subject?.price ?? 0;

  const startISO: string = draft?.startDate ?? res?.start_date ?? "";
  const endISO: string = draft?.endDate ?? res?.end_date ?? "";

  const nights = useMemo(() => {
    const s = new Date(startISO).getTime();
    const e = new Date(endISO).getTime();
    if (!isNaN(s) && !isNaN(e) && e > s) {
      const d = Math.round((e - s) / (1000 * 60 * 60 * 24));
      return Math.max(1, d);
    }
    return 1;
  }, [startISO, endISO]);

  // Add-ons (logements pour l’instant)
  const addOns = draft?.addOns ?? (res?.guest_info?.add_ons ?? []);
  const selectedIds =
    draft?.selectedAddOnIds ?? (addOns?.map((a: any) => a.id) ?? []);
  const addOnsTotal = useMemo(() => {
    let total = 0;
    for (const a of addOns || []) {
      const selected = selectedIds.includes(a.id);
      if (!selected) continue;
      if (a.pricing_model === "per_night") total += Number(a.price) * nights;
      else total += Number(a.price || 0);
    }
    return total;
  }, [addOns, selectedIds, nights]);

  const base = unit * nights;
  const serviceFeeTotal = SERVICE_FEE_PER_NIGHT * nights;
  const totalDueHost = base + addOnsTotal;
  const grandTotal = totalDueHost;
  const espece = Math.max(grandTotal - serviceFeeTotal, 0);

  const cover = subject?.cover || undefined;

  /* ---------- Handlers ---------- */
  const handleClose = () => {
    if (!subject) return;
    if (subject.kind === "vehicule") {
      navigation.navigate("VehiculeDetails", { id: subject.id, resetFromCheckout: true });
    } else {
      navigation.navigate("LogementDetails", { id: subject.id, resetFromCheckout: true });
    }
  };

  const proceed = async () => {
    if (step < 3) {
      setStep((p) => NEXT[p]);
      return;
    }

    try {
      if (!subject) throw new Error("Aucune annonce sélectionnée.");
      if (!startISO || !endISO) throw new Error("Dates invalides.");

      setPaying(true);

      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id;
      if (!userId) throw new Error("Veuillez vous connecter.");

      const addOnsPayload = (addOns || [])
        .filter((a: any) => selectedIds.includes(a.id))
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          price: Number(a.price),
          pricing_model: a.pricing_model,
        }));

      const guestInfo = {
        ...(res?.guest_info ?? {}),
        nights,
        add_ons: addOnsPayload,
        add_ons_total: addOnsTotal,
        service_fee_per_night: SERVICE_FEE_PER_NIGHT,
        service_fee_total: serviceFeeTotal,
        payment_choice: payChoice as "service_fee_only" | "all_online",
        totals: {
          unit_price: unit,
          base,
          add_ons: addOnsTotal,
          due_host: totalDueHost,
          grand_total: grandTotal,
          espece: Math.max(grandTotal - serviceFeeTotal, 0),
        },
      };

      const _commission = +serviceFeeTotal;
      const _priceEspece = Math.max(grandTotal - _commission, 0);
      const _totalPrice = +grandTotal;

      // Insert réservation + code unique
      let insertedRes: { id: string; reservation_code: string } | null = null;

      for (let i = 0; i < 5; i++) {
        const code = genReservationCode();
        const payload: any = {
          user_id: userId,
          start_date: startISO,
          end_date: endISO,
          unit_price: unit,
          total_price: _totalPrice,
          commission: _commission,
          price_espece: _priceEspece,
          currency: cur,
          status: "pending",
          guests_count: draft?.guests ?? 1,
          reservation_code: code,
          guest_info: guestInfo,
        };

        if (subject.kind === "vehicule") payload.vehicule_id = subject.id;
        else payload.logement_id = subject.id;

        const { data: ins, error: insErr } = await supabase
          .from("reservations")
          .insert(payload)
          .select("id,reservation_code")
          .single();

        if (!insErr && ins) {
          insertedRes = ins;
          break;
        }
        if ((insErr as any)?.code === "23505") continue; // collision code unique
        throw insErr;
      }

      if (!insertedRes) {
        throw new Error("Impossible de générer un code de réservation unique. Réessayez.");
      }

      const txnAmount = payChoice === "service_fee_only" ? serviceFeeTotal : _totalPrice;
      const { error: txnErr } = await supabase.from("transactions").insert({
        reservation_id: insertedRes.id,
        user_id: userId,
        amount: txnAmount,
        commission: _commission,
        payment_method: payChoice,
        status: "paid",
      });
      if (txnErr) {
        await supabase.from("reservations").delete().eq("id", insertedRes.id);
        throw txnErr;
      }

      // Emails (best-effort)
      try {
        await supabase.functions.invoke("send-booking-emails", {
          body: { reservationId: insertedRes.id },
        });
      } catch (e) {
        console.warn("[emails] échec d’envoi:", e);
      }

      Alert.alert(
        "Réservation confirmée",
        (payChoice === "service_fee_only"
          ? `Merci ! Vous payez maintenant les frais de réservation de ${money(
              serviceFeeTotal,
              cur
            )}.\nLe reste (${money(totalDueHost, cur)}) sera réglé en espèces à l’hôte.`
          : "Le paiement intégral sur l’app sera bientôt disponible.") +
          `\n\nCode de réservation : ${insertedRes.reservation_code}`,
        [
          {
            text: "Voir la réservation",
            onPress: () => navigation.replace("ReservationDetails", { id: insertedRes!.id }),
          },
        ]
      );
    } catch (e: any) {
      console.error("[Checkout] proceed error:", e?.message ?? e);
      Alert.alert("Erreur", e?.message ?? "Impossible d’enregistrer la réservation.");
    } finally {
      setPaying(false);
    }
  };

  /* ---------- Render ---------- */
  if (loading || (!draft && !res) || !subject) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const titleLine = subject.title || (subject.kind === "vehicule" ? "Véhicule" : "Logement");
  const subLine =
    subject.kind === "vehicule"
      ? subject.subtitle ?? ""
      : `${subject.subtitle ?? ""}${subject.reviews != null ? ` · ${subject.reviews} avis` : ""}`;

  const leftLabel =
    subject.kind === "vehicule"
      ? `Véhicule (${nights} × ${money(unit, cur).replace(/\s/g, "\u00A0")})`
      : `Logement (${nights} × ${money(unit, cur).replace(/\s/g, "\u00A0")})`;

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <TouchableOpacity style={styles.xBtn} onPress={handleClose}>
          <Ionicons name="close" size={22} color="#111" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {step === 1 ? "Vérifiez et continuez" : step === 2 ? "Paiement" : "Confirmation"}
        </Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>

      {/* Body */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        {/* Carte récap sujet */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Image
              source={cover ? { uri: cover } : require("../../assets/images/logement.jpg")}
              style={styles.thumb}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {titleLine}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                {subject.kind === "logement" ? (
                  <>
                    <Ionicons name="star" size={14} color="#111" />
                    <Text style={styles.muted}>
                      {subject.rating ?? "4,58"} ({subject.reviews ?? 122})
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="location-outline" size={14} color="#111" />
                    <Text style={styles.muted}>{subject.subtitle ?? "—"}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          <View style={styles.sep} />

          {/* Dates + nuits */}
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.label}>Dates</Text>
              <Text style={styles.value}>
                {new Date(startISO).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}{" "}
                –{" "}
                {new Date(endISO).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {nights} {subject.kind === "vehicule" ? "jour" : "nuit"}
                {nights > 1 ? "s" : ""} réservé{nights > 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.smallBtn}>
              <Text style={styles.smallBtnTxt}>Modifier</Text>
            </TouchableOpacity>
          </View>

          {/* Voyageurs */}
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Voyageurs</Text>
              <Text style={styles.value}>
                {(draft?.guests ?? res?.guests_count ?? 1)} adulte
                {(draft?.guests ?? res?.guests_count ?? 1) > 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert("À venir", "Sélection des voyageurs.")}
              style={styles.smallBtn}
            >
              <Text style={styles.smallBtnTxt}>Modifier</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Détails prix + Réservation */}
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Détails du prix</Text>

          <View style={styles.line}>
            <Text style={styles.lineLeft}>{leftLabel}</Text>
            <Text style={styles.lineRight}>{money(base, cur)}</Text>
          </View>

          {addOnsTotal > 0 && (
            <View style={styles.line}>
              <Text style={styles.lineLeft}>Options</Text>
              <Text style={styles.lineRight}>{money(addOnsTotal, cur)}</Text>
            </View>
          )}

          <View style={styles.line}>
            <Text style={styles.lineLeft}>Frais de réservation</Text>
            <Text style={styles.lineRight}>
              {money(SERVICE_FEE_PER_NIGHT, cur)} × {nights} = {money(SERVICE_FEE_PER_NIGHT * nights, cur)}
            </Text>
          </View>

          <View style={styles.sep} />

          <View style={styles.line}>
            <Text style={[styles.lineLeft, { fontWeight: "900" }]}>
              Total {subject.kind === "vehicule" ? "de la location" : "du séjour"}
            </Text>
            <Text style={[styles.lineRight, { fontWeight: "900" }]}>{money(grandTotal, cur)}</Text>
          </View>

          <View style={styles.line}>
            <Text style={[styles.lineLeft, { fontWeight: "900" }]}>À payer dès maintenant</Text>
            <Text style={[styles.lineRight, { fontWeight: "900" }]}>{money(SERVICE_FEE_PER_NIGHT * nights, cur)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={[styles.lineLeft, { fontWeight: "900" }]}>À payer en espèces</Text>
            <Text style={[styles.lineRight, { fontWeight: "900" }]}>{money(espece, cur)}</Text>
          </View>

          <Text style={[styles.muted, { marginTop: 8 }]}>
            {money(totalDueHost, cur)} seront réglés en espèces à l’hôte.{"\n"}
            {payChoice === "service_fee_only"
              ? `${money(SERVICE_FEE_PER_NIGHT * nights, cur)} de frais à payer maintenant sur l’app.`
              : "Le paiement intégral sur l’app sera bientôt disponible."}
          </Text>
        </View>

        {/* Étape 2 : paiement */}
        {step >= 2 && (
          <View style={styles.card}>
            <Text style={styles.blockTitle}>Choisissez comment payer</Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPayChoice("service_fee_only")}
              style={[styles.payOption, payChoice === "service_fee_only" && styles.payOptionSelected]}
            >
              <Ionicons
                name={payChoice === "service_fee_only" ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={payChoice === "service_fee_only" ? "#111" : "#bbb"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.payLabel}>Payer uniquement les frais de réservation maintenant</Text>
                <Text style={styles.paySub}>
                  {money(SERVICE_FEE_PER_NIGHT * nights, cur)} sur l’app · {money(totalDueHost, cur)} en espèces
                </Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.payOption, { opacity: 0.5 }]}>
              <Ionicons name="radio-button-off" size={18} color="#bbb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.payLabel}>Tout payer sur l’app</Text>
                <Text style={[styles.paySub, { color: "#999" }]}>Bientôt disponible</Text>
              </View>
            </View>
          </View>
        )}

        {/* Étape 3 : confirmation */}
        {step >= 3 && (
          <View style={styles.card}>
            <Text style={styles.blockTitle}>Dernière étape</Text>
            <Text style={styles.muted}>Vérifiez vos informations puis confirmez la réservation.</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, paying && { opacity: 0.6 }]}
          disabled={paying}
          onPress={proceed}
          activeOpacity={0.9}
        >
          {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{step < 3 ? "Suivant" : "Confirmer"}</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  xBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f2",
  },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#111" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: "#eee" },
  title: { fontSize: 18, fontWeight: "800", color: "#111" },
  muted: { color: "#666", fontWeight: "600" },
  sep: { height: 1, backgroundColor: "#eee", marginVertical: 12 },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  label: { color: "#6b6b6b", fontWeight: "700" },
  value: { color: "#111", fontWeight: "800", marginTop: 2 },

  smallBtn: {
    backgroundColor: "#f3f3f3",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  smallBtnTxt: { fontWeight: "800", color: "#111" },

  blockTitle: { fontSize: 18, fontWeight: "900", color: "#111", marginBottom: 10 },

  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  lineLeft: { color: "#222", fontWeight: "700" },
  lineRight: { color: "#111", fontWeight: "800" },

  payOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    marginTop: 8,
  },
  payOptionSelected: { borderColor: "#111", backgroundColor: "#fafafa" },
  payLabel: { fontWeight: "800", color: "#111" },
  paySub: { marginTop: 2, color: "#6b6b6b", fontWeight: "600" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.98)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 10,
    elevation: 8,
  },
  cta: {
    backgroundColor: "#111",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: { color: "#fff", fontWeight: "900", fontSize: 18 },
});
