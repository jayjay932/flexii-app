// src/screens/VehicleSearchModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import Ionicons, { IconName } from '@/src/ui/Icon';;

/* ---------- Types ---------- */
export type VehicleFilters = {
  searchQuery?: string;
  locationText?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  rentalUnit?: "tous" | "heure" | "jour" | "mois";
  forSale?: boolean;
  vehicleTypes?: Array<"SUV" | "Berline" | "Moto" | string>;
  /** NEW: Transmission filter */
  transmission?: "toutes" | "auto" | "manuelle";
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (f: VehicleFilters) => void;
  initial?: VehicleFilters;
};

/* ---------- Données UI ---------- */
const VEHICLE_TYPES: Array<{ id: "SUV" | "Berline" | "Moto"; label: string; icon: string }> = [
  { id: "SUV", label: "SUV", icon: "🚙" },
  { id: "Berline", label: "Berline", icon: "🚗" },
  { id: "Moto", label: "Moto", icon: "🏍️" },
];

const RENTAL_UNITS: Array<VehicleFilters["rentalUnit"]> = ["tous", "heure", "jour", "mois"];
const TRANSMISSIONS: Array<NonNullable<VehicleFilters["transmission"]>> = [
  "toutes",
  "auto",
  "manuelle",
];

/* ---------- Helpers ---------- */
const parseNum = (s?: string): number | undefined => {
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeRange = (min?: number, max?: number): [number | undefined, number | undefined] => {
  if (min !== undefined && max !== undefined && min > max) {
    return [max, min];
  }
  return [min, max];
};

/* ---------- Composant ---------- */
export default function VehicleSearchModal({ visible, onClose, onSubmit, initial }: Props) {
  // états contrôlés
  const [searchQuery, setSearchQuery] = useState(initial?.searchQuery ?? "");
  const [locationText, setLocationText] = useState(initial?.locationText ?? "");
  const [minPrice, setMinPrice] = useState(
    typeof initial?.minPrice === "number" ? String(initial!.minPrice) : ""
  );
  const [maxPrice, setMaxPrice] = useState(
    typeof initial?.maxPrice === "number" ? String(initial!.maxPrice) : ""
  );
  const [minYear, setMinYear] = useState(
    typeof initial?.minYear === "number" ? String(initial!.minYear) : ""
  );
  const [maxYear, setMaxYear] = useState(
    typeof initial?.maxYear === "number" ? String(initial!.maxYear) : ""
  );
  const [rentalUnit, setRentalUnit] = useState<VehicleFilters["rentalUnit"]>(
    initial?.rentalUnit ?? "tous"
  );
  const [forSale, setForSale] = useState<boolean>(!!initial?.forSale);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initial?.vehicleTypes ?? []);
  const [transmission, setTransmission] = useState<NonNullable<VehicleFilters["transmission"]>>(
    initial?.transmission ?? "toutes"
  );

  // ➜ Sync fiable à chaque ouverture + si 'initial' change
  useEffect(() => {
    if (!visible) return;
    setSearchQuery(initial?.searchQuery ?? "");
    setLocationText(initial?.locationText ?? "");
    setMinPrice(typeof initial?.minPrice === "number" ? String(initial!.minPrice) : "");
    setMaxPrice(typeof initial?.maxPrice === "number" ? String(initial!.maxPrice) : "");
    setMinYear(typeof initial?.minYear === "number" ? String(initial!.minYear) : "");
    setMaxYear(typeof initial?.maxYear === "number" ? String(initial!.maxYear) : "");
    setRentalUnit(initial?.rentalUnit ?? "tous");
    setForSale(!!initial?.forSale);
    setSelectedTypes(initial?.vehicleTypes ?? []);
    setTransmission(initial?.transmission ?? "toutes");
  }, [visible, initial]);

  const hasActiveFilters = useMemo(() => {
    return (
      !!searchQuery.trim() ||
      !!locationText.trim() ||
      !!minPrice ||
      !!maxPrice ||
      !!minYear ||
      !!maxYear ||
      rentalUnit !== "tous" ||
      forSale ||
      selectedTypes.length > 0 ||
      transmission !== "toutes"
    );
  }, [
    searchQuery,
    locationText,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    rentalUnit,
    forSale,
    selectedTypes,
    transmission,
  ]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ➜ Reset qui applique immédiatement et ferme (plus besoin de rouvrir)
  const resetAndApply = () => {
    const cleared: VehicleFilters = {};
    onSubmit?.(cleared);
    onClose();
  };

  const apply = () => {
    // parse + normalise
    const pMin = parseNum(minPrice);
    const pMax = parseNum(maxPrice);
    const yMin = parseNum(minYear);
    const yMax = parseNum(maxYear);

    const [priceMin, priceMax] = normalizeRange(pMin, pMax);
    const [yearMin, yearMax] = normalizeRange(yMin, yMax);

    const result: VehicleFilters = {
      searchQuery: searchQuery.trim() || undefined,
      locationText: locationText.trim() || undefined,
      minPrice: priceMin,
      maxPrice: priceMax,
      minYear: yearMin,
      maxYear: yearMax,
      rentalUnit,
      forSale: forSale || undefined,
      vehicleTypes: selectedTypes.length ? (selectedTypes as any) : undefined,
      transmission: transmission !== "toutes" ? transmission : undefined,
    };
    onSubmit?.(result);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          {/* Header */}
          <SafeAreaView style={styles.header}>
            <Text style={styles.hTitle}>Filtres véhicules</Text>
            <TouchableOpacity onPress={onClose} style={styles.xBtn}>
              <Ionicons name="close" size={20} color="#111" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Contenu */}
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Recherche */}
            <Text style={styles.section}>Rechercher</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="search" size={18} color="#777" style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Marque, modèle…"
                placeholderTextColor="#9A9A9A"
                style={styles.input}
                returnKeyType="search"
                onSubmitEditing={apply} // ➜ Entrée clavier valide la recherche
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#bbb" />
                </TouchableOpacity>
              )}
            </View>

            {/* Localisation */}
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

            {/* Unité de location */}
            <Text style={styles.section}>Unité de location</Text>
            <View style={styles.rowWrap}>
              {RENTAL_UNITS.map((u) => {
                const on = rentalUnit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setRentalUnit(u)}
                    activeOpacity={0.9}
                    style={[styles.typeBtn, on && styles.typeBtnOn]}
                  >
                    <Text style={[styles.typeTxt, on && styles.typeTxtOn]}>
                      {u === "tous" ? "Toutes" : u}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Transmission */}
            <Text style={styles.section}>Transmission</Text>
            <View style={styles.rowWrap}>
              {TRANSMISSIONS.map((t) => {
                const on = transmission === t;
                const label =
                  t === "toutes" ? "Toutes" : t === "auto" ? "Automatique" : "Manuelle";
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTransmission(t)}
                    activeOpacity={0.9}
                    style={[styles.typeBtn, on && styles.typeBtnOn]}
                  >
                    <Text style={[styles.typeTxt, on && styles.typeTxtOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Catégories (multi) */}
            <Text style={styles.section}>Catégories</Text>
            <View style={styles.chipsRow}>
              {VEHICLE_TYPES.map((t) => {
                const on = selectedTypes.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => toggleType(t.id)}
                    style={[styles.chip, on && styles.chipOn]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.chipEmoji}>{t.icon}</Text>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Prix */}
            <Text style={styles.section}>Fourchette de prix</Text>
            <Text style={styles.small}>Tarif de location (toutes taxes comprises)</Text>
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
                  <Text style={styles.unit}>€</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Maximum</Text>
                <View style={styles.numWrap}>
                  <TextInput
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                    keyboardType="number-pad"
                    placeholder="500+"
                    style={styles.numInput}
                  />
                  <Text style={styles.unit}>€</Text>
                </View>
              </View>
            </View>

            {/* Année */}
            <Text style={styles.section}>Année</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Min</Text>
                <View style={styles.numWrap}>
                  <TextInput
                    value={minYear}
                    onChangeText={setMinYear}
                    keyboardType="number-pad"
                    placeholder="2008"
                    style={styles.numInput}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Max</Text>
                <View style={styles.numWrap}>
                  <TextInput
                    value={maxYear}
                    onChangeText={setMaxYear}
                    keyboardType="number-pad"
                    placeholder="2025"
                    style={styles.numInput}
                  />
                </View>
              </View>
            </View>

            {/* Vente */}
            <Text style={styles.section}>Vente</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Afficher uniquement les véhicules à vendre</Text>
              <Switch value={forSale} onValueChange={setForSale} />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={resetAndApply} style={styles.resetBtn} activeOpacity={0.85}>
                <Text style={styles.resetTxt}>Effacer tout</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
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

/* ---------- Styles ---------- */
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  xBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },

  content: { padding: 16, paddingBottom: 120 },

  section: { marginTop: 16, fontWeight: "900", color: "#1d1d1f", fontSize: 16 },
  small: { fontSize: 12, color: "#666", fontWeight: "700", marginTop: 6, marginBottom: 6 },

  inputWrap: {
    marginTop: 6,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f7f7f7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  input: { flex: 1, color: "#111", fontWeight: "700" },

  rowWrap: { flexDirection: "row", gap: 8, marginTop: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e5e5e5",
    alignItems: "center",
  },
  typeBtnOn: { backgroundColor: "#111", borderColor: "#111" },
  typeTxt: { fontWeight: "800", color: "#444" },
  typeTxtOn: { color: "#fff" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f4f4f4",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipOn: { backgroundColor: "#111" },
  chipEmoji: { fontSize: 16 },
  chipTxt: { fontWeight: "800", color: "#444" },
  chipTxtOn: { color: "#fff" },

  numWrap: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f7f7f7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  numInput: { flex: 1, color: "#111", fontWeight: "800", textAlign: "center" },
  unit: { color: "#777", fontWeight: "800" },

  switchRow: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f7f7f7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  switchLabel: { fontWeight: "800", color: "#333" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row",
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  resetTxt: { fontWeight: "900", color: "#111" },
  applyBtn: {
    flex: 1.2,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  applyTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
