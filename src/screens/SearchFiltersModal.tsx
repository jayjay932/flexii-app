import React, { useEffect, useMemo, useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, KeyboardAvoidingView, Platform
} from "react-native";
import Ionicons from '@/src/ui/Icon';;

/* --------- Types (optionnels si tu veux récupérer les filtres plus tard) --------- */
export type Filters = {
  searchQuery?: string;
  locationText?: string;
  guestCount?: number;
  roomCount?: number;
  bathroomCount?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  equipments?: string[];
  reservationOptions?: string[];
  propertyTypes?: string[];
  exceptionalTypes?: string[];
  accommodationType?: "tous" | "chambre" | "entier";
  // datesStart?: string; datesEnd?: string; // si tu veux brancher un vrai date picker plus tard
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (f: Filters) => void; // optionnel: si tu veux capter les filtres plus tard
  initial?: Filters;
};

/* --------- Données statiques (comme dans ton 2e modal web) --------- */
const EQUIPMENTS = [
  { id: "has_tv", label: "Télévision", icon: "📺" },
  { id: "has_air_conditioning", label: "Climatisation", icon: "❄" },
  { id: "has_wifi", label: "Wifi", icon: "📶" },
  { id: "has_washing_machin", label: "Lave-linge", icon: "🧺" },
  { id: "has_pool", label: "Piscine", icon: "🏊" },
  { id: "has_kitchen", label: "Cuisine", icon: "🍳" },
  { id: "has_parking", label: "Parking gratuit", icon: "🅿" },
  { id: "has_balcony", label: "Balcon", icon: "🏞" },
];

const RESERVATION_OPTS = [
  { id: "instantanee", label: "Réservation instantanée", icon: "⚡" },
  { id: "arrivee_autonome", label: "Arrivée autonome", icon: "🔑" },
  { id: "annulation_gratuite", label: "Annulation gratuite", icon: "📅" },
  { id: "animaux_autorises", label: "Animaux autorisés", icon: "🐕" },
];

const PROPERTY_TYPES = [
  { id: "Maison", label: "Maison", icon: "🏠" },
  { id: "Appartement", label: "Appartement", icon: "🏢" },
  { id: "Chambre_d_hotes", label: "Maison d'hôtes", icon: "🏨" },
  { id: "Bateau", label: "Bateau", icon: "⛵" },
];

const RECOMMENDATIONS = [
  { id: "has_wifi", label: "Wifi", icon: "📶" },
  { id: "has_kitchen", label: "Cuisine", icon: "🍳" },
  { id: "has_parking", label: "Parking gratuit", icon: "🅿" },
];

const EXCEPTIONAL = [
  { id: "coup_coeur", label: "Coup de cœur voyageurs", icon: "🏆", description: "Les logements les plus appréciés" },
  { id: "luxe", label: "Luxe", icon: "💎", description: "Logements de luxe au design exceptionnel" },
];

/* --------- Petit compteur réutilisable --------- */
function Counter({
  title, value, onChange,
}: { title: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterTitle}>{title}</Text>
      <View style={styles.counterBtns}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(1, value - 1))}
          style={[styles.roundBtn, value <= 1 && { opacity: 0.5 }]}
          disabled={value <= 1}
        >
          <Ionicons name="remove" size={18} color="#111" />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(value + 1)} style={styles.roundBtn}>
          <Ionicons name="add" size={18} color="#111" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* --------- Le modal principal --------- */
export default function SearchModal({ visible, onClose, onSubmit, initial }: Props) {
  const [searchQuery, setSearchQuery] = useState(initial?.searchQuery ?? "");
  const [locationText, setLocationText] = useState(initial?.locationText ?? "");
  const [guestCount, setGuestCount] = useState(initial?.guestCount ?? 1);
  const [roomCount, setRoomCount] = useState(initial?.roomCount ?? 1);
  const [bathroomCount, setBathroomCount] = useState(initial?.bathroomCount ?? 1);
  const [minPrice, setMinPrice] = useState(
    typeof initial?.minPrice === "number" ? String(initial?.minPrice) : ""
  );
  const [maxPrice, setMaxPrice] = useState(
    typeof initial?.maxPrice === "number" ? String(initial?.maxPrice) : ""
  );

  const [selectedEquipments, setSelectedEquipments] = useState<string[]>(initial?.equipments ?? []);
  const [selectedReservationOptions, setSelectedReservationOptions] = useState<string[]>(initial?.reservationOptions ?? []);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(initial?.propertyTypes ?? []);
  const [selectedExceptional, setSelectedExceptional] = useState<string[]>(initial?.exceptionalTypes ?? []);
  const [accommodationType, setAccommodationType] = useState<"tous" | "chambre" | "entier">(initial?.accommodationType ?? "tous");

  const hasActiveFilters = useMemo(() => {
    return (
      !!searchQuery.trim() ||
      !!locationText.trim() ||
      guestCount !== 1 ||
      roomCount !== 1 ||
      bathroomCount !== 1 ||
      !!minPrice ||
      !!maxPrice ||
      selectedEquipments.length > 0 ||
      selectedReservationOptions.length > 0 ||
      selectedPropertyTypes.length > 0 ||
      selectedExceptional.length > 0 ||
      accommodationType !== "tous"
    );
  }, [
    searchQuery, locationText, guestCount, roomCount, bathroomCount, minPrice, maxPrice,
    selectedEquipments.length, selectedReservationOptions.length,
    selectedPropertyTypes.length, selectedExceptional.length, accommodationType,
  ]);

  useEffect(() => {
    if (!visible) return;
    // si tu veux précharger quelque chose quand le modal s’ouvre, c’est ici
  }, [visible]);

  const toggle = (list: string[], setList: (x: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const reset = () => {
    setSearchQuery("");
    setLocationText("");
    setGuestCount(1);
    setRoomCount(1);
    setBathroomCount(1);
    setMinPrice("");
    setMaxPrice("");
    setSelectedEquipments([]);
    setSelectedReservationOptions([]);
    setSelectedPropertyTypes([]);
    setSelectedExceptional([]);
    setAccommodationType("tous");
  };

  const apply = () => {
    const result: Filters = {
      searchQuery: searchQuery.trim() || undefined,
      locationText: locationText.trim() || undefined,
      guestCount,
      roomCount,
      bathroomCount,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      equipments: selectedEquipments,
      reservationOptions: selectedReservationOptions,
      propertyTypes: selectedPropertyTypes,
      exceptionalTypes: selectedExceptional,
      accommodationType,
    };
    onSubmit?.(result); // (facultatif) — tu ne changes pas ta logique si tu n’en fais rien
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header sticky avec X bien visible */}
          <SafeAreaView style={styles.header}>
            <Text style={styles.hTitle}>Filtres</Text>
            <TouchableOpacity onPress={onClose} style={styles.xBtn}>
              <Ionicons name="close" size={20} color="#111" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Contenu scrollable */}
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ——— Barre de recherche ——— */}
            <Text style={styles.section}>Rechercher par nom</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="search" size={18} color="#777" style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher un logement par nom…"
                placeholderTextColor="#9A9A9A"
                style={styles.input}
                returnKeyType="search"
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#bbb" />
                </TouchableOpacity>
              )}
            </View>

            {/* ——— Localisation ——— */}
            <Text style={styles.section}>Où</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color="#777" style={{ marginRight: 8 }} />
              <TextInput
                value={locationText}
                onChangeText={setLocationText}
                placeholder="Ville, quartier…"
                placeholderTextColor="#9A9A9A"
                style={styles.input}
              />
              {!!locationText && (
                <TouchableOpacity onPress={() => setLocationText("")}>
                  <Ionicons name="close-circle" size={18} color="#bbb" />
                </TouchableOpacity>
              )}
            </View>

            {/* ——— Dates (placeholders visuels) ——— */}
            <Text style={styles.section}>Dates de réservation</Text>
            <View style={styles.fakeCalendar}>
              <Ionicons name="calendar-outline" size={18} color="#666" />
              <Text style={styles.fakeCalendarTxt}>Sélecteur de dates (à brancher plus tard)</Text>
            </View>

            {/* ——— Recommandations ——— */}
            <Text style={styles.section}>Nos recommandations</Text>
            <View style={{ gap: 8 }}>
              {RECOMMENDATIONS.map((rec) => {
                const on = selectedEquipments.includes(rec.id);
                return (
                  <TouchableOpacity
                    key={rec.id}
                    onPress={() => toggle(selectedEquipments, setSelectedEquipments, rec.id)}
                    style={[styles.recCard, on && styles.recCardOn]}
                    activeOpacity={0.9}
                  >
                    <View style={styles.recIconBox}><Text style={{ fontSize: 20 }}>{rec.icon}</Text></View>
                    <Text style={[styles.recLabel, on && { color: "#111" }]}>{rec.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ——— Type d’hébergement ——— */}
            <Text style={styles.section}>Type de logement</Text>
            <View style={styles.grid3}>
              {(["tous", "chambre", "entier"] as const).map((t) => {
                const on = accommodationType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setAccommodationType(t)}
                    style={[styles.typeBtn, on && styles.typeBtnOn]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.typeTxt, on && styles.typeTxtOn]}>
                      {t === "tous" ? "Tous les types" : t === "chambre" ? "Chambre" : "Logement entier"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ——— Fourchette de prix ——— */}
            <Text style={styles.section}>Fourchette de prix</Text>
            <Text style={styles.small}>Prix du voyage, tous frais compris</Text>
            <View style={styles.priceGraph}>
              {Array.from({ length: 48 }).map((_, i) => (
                <View key={i} style={[styles.priceBar, { height: ((i * 17) % 80) + 20 }]} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Minimum</Text>
                <View style={styles.numWrap}>
                  <TextInput
                    value={minPrice}
                    onChangeText={setMinPrice}
                    keyboardType="number-pad"
                    placeholder="0"
                    style={styles.numInput}
                  />
                  <Text style={styles.fcfa}>FCFA</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Maximum</Text>
                <View style={styles.numWrap}>
                  <TextInput
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                    keyboardType="number-pad"
                    placeholder="500000+"
                    style={styles.numInput}
                  />
                  <Text style={styles.fcfa}>FCFA</Text>
                </View>
              </View>
            </View>

            {/* ——— Chambres et lits ——— */}
            <Text style={styles.section}>Chambres et lits</Text>
            <View style={{ gap: 10 }}>
              <Counter title="Chambres" value={roomCount} onChange={setRoomCount} />
              <Counter title="Lits" value={guestCount} onChange={setGuestCount} />
              <Counter title="Salles de bain" value={bathroomCount} onChange={setBathroomCount} />
            </View>

            {/* ——— Équipements ——— */}
            <Text style={styles.section}>Équipements</Text>
            <View style={styles.chipsRow}>
              {EQUIPMENTS.map((e) => {
                const on = selectedEquipments.includes(e.id);
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => toggle(selectedEquipments, setSelectedEquipments, e.id)}
                    style={[styles.chip, on && styles.chipOn]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.chipEmoji}>{e.icon}</Text>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{e.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ——— Type de propriété ——— */}
            <Text style={styles.section}>Type de propriété</Text>
            <View style={styles.chipsRow}>
              {PROPERTY_TYPES.map((t) => {
                const on = selectedPropertyTypes.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => toggle(selectedPropertyTypes, setSelectedPropertyTypes, t.id)}
                    style={[styles.chip, on && styles.chipOn]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.chipEmoji}>{t.icon}</Text>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ——— Options de réservation ——— */}
            <Text style={styles.section}>Options de réservation</Text>
            <View style={{ gap: 8 }}>
              {RESERVATION_OPTS.map((o) => {
                const on = selectedReservationOptions.includes(o.id);
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => toggle(selectedReservationOptions, setSelectedReservationOptions, o.id)}
                    style={[styles.rowCard, on && styles.rowCardOn]}
                    activeOpacity={0.9}
                  >
                    <Text style={{ fontSize: 18 }}>{o.icon}</Text>
                    <Text style={[styles.rowCardTxt, on && { color: "#111" }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ——— Logements exceptionnels ——— */}
            <Text style={styles.section}>Logements exceptionnels</Text>
            <View style={{ gap: 8 }}>
              {EXCEPTIONAL.map((ex) => {
                const on = selectedExceptional.includes(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => toggle(selectedExceptional, setSelectedExceptional, ex.id)}
                    style={[styles.bigRow, on && styles.bigRowOn]}
                    activeOpacity={0.9}
                  >
                    <Text style={{ fontSize: 24 }}>{ex.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bigRowTitle, on && { color: "#111" }]}>{ex.label}</Text>
                      <Text style={styles.bigRowSub}>{ex.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer fixe */}
          <View style={styles.footer}>
            {hasActiveFilters && (
              <TouchableOpacity onPress={reset} style={styles.resetBtn} activeOpacity={0.85}>
                <Text style={styles.resetTxt}>Effacer tout</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={apply} style={styles.applyBtn} activeOpacity={0.9}>
              <Text style={styles.applyTxt}>Rechercher</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------- Styles ------------------- */

const R = 22;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: R,
    borderTopRightRadius: R,
    maxHeight: "92%",
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  hTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  xBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center",
  },

  section: { marginTop: 16, fontWeight: "900", color: "#1d1d1f", fontSize: 16 },
  small: { fontSize: 12, color: "#666", fontWeight: "700", marginTop: 6, marginBottom: 6 },

  inputWrap: {
    marginTop: 6, height: 48, borderRadius: 14, backgroundColor: "#f7f7f7",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
  },
  input: { flex: 1, color: "#111", fontWeight: "700" },

  fakeCalendar: {
    marginTop: 6, height: 56, borderRadius: 14, backgroundColor: "#f7f7f7",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8,
  },
  fakeCalendarTxt: { color: "#666", fontWeight: "700" },

  priceGraph: {
    marginTop: 4, height: 64, backgroundColor: "#fafafa", borderRadius: 12,
    flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 6,
    overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
  },
  priceBar: {
    width: 4, backgroundColor: "#EA1261", marginHorizontal: 1,
    borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.85,
  },

  numWrap: {
    height: 48, borderRadius: 14, backgroundColor: "#f7f7f7",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  numInput: { flex: 1, color: "#111", fontWeight: "800", textAlign: "center" },
  fcfa: { color: "#777", fontWeight: "800" },

  grid3: { flexDirection: "row", gap: 8, marginTop: 8 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: "#e5e5e5", alignItems: "center" },
  typeBtnOn: { backgroundColor: "#111", borderColor: "#111" },
  typeTxt: { fontWeight: "800", color: "#444" },
  typeTxtOn: { color: "#fff" },

  recCard: {
    borderWidth: 2, borderColor: "#f1f1f1", backgroundColor: "#fafafa",
    borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
  },
  recCardOn: { borderColor: "#111", backgroundColor: "#f7f7f7" },
  recIconBox: { width: 48, height: 48, backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center", elevation: 1 },
  recLabel: { fontWeight: "800", color: "#333" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#f4f4f4",
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  chipOn: { backgroundColor: "#111" },
  chipEmoji: { fontSize: 16 },
  chipTxt: { fontWeight: "800", color: "#444" },
  chipTxtOn: { color: "#fff" },

  rowCard: {
    borderWidth: 2, borderColor: "#e9e9e9", borderRadius: 16,
    padding: 12, flexDirection: "row", alignItems: "center", gap: 10,
  },
  rowCardOn: { borderColor: "#111", backgroundColor: "#f9f9f9" },
  rowCardTxt: { fontWeight: "800", color: "#444" },

  bigRow: {
    borderWidth: 2, borderColor: "#e9e9e9", borderRadius: 16,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  bigRowOn: { borderColor: "#111", backgroundColor: "#f9f9f9" },
  bigRowTitle: { fontWeight: "900", color: "#111" },
  bigRowSub: { color: "#666", fontWeight: "600", marginTop: 2 },

  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counterTitle: { fontWeight: "900", color: "#111" },
  counterBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  roundBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#eee",
    alignItems: "center", justifyContent: "center",
  },
  counterValue: { minWidth: 28, textAlign: "center", fontWeight: "900", color: "#111" },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, padding: 16,
    backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row", gap: 10,
  },
  resetBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: "#eee", alignItems: "center", justifyContent: "center" },
  resetTxt: { fontWeight: "900", color: "#111" },
  applyBtn: { flex: 1.2, height: 52, borderRadius: 26, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  applyTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
});