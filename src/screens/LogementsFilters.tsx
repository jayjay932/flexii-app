import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform,
  KeyboardAvoidingView, TouchableOpacity, TextInput, Keyboard,
  InputAccessoryView
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Ionicons, { IconName } from '@/src/ui/Icon';;
import { useRoute, useNavigation } from "@react-navigation/native";
import { supabase } from "@/src/lib/supabase";

type PropertyType = "maison" | "appartement" | "hotel";

type Filters = {
  q?: string;
  city?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  bedroomsMin?: number | null;
  bathroomsMin?: number | null;
  types?: PropertyType[];
  equipementIds?: string[];
};

type Equip = { id: string; name: string; category?: string | null };

const TYPES: Array<{ key: PropertyType; label: string; emoji: string }> = [
  { key: "maison", label: "Maison", emoji: "🏠" },
  { key: "appartement", label: "Appartement", emoji: "🏢" },
  { key: "hotel", label: "Hôtel", emoji: "🏨" },
];

const emojiForEquip = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("wifi")) return "📶";
  if (n.includes("clim")) return "❄️";
  if (n.includes("télé") || n.includes("tv")) return "📺";
  if (n.includes("lave") || n.includes("linge")) return "🧺";
  if (n.includes("piscine")) return "🏊";
  if (n.includes("parking")) return "🅿️";
  if (n.includes("cuisine")) return "🍳";
  return "▫️";
};

const IA_ID = "filters-accessory";

export default function LogementsFilters() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const initial: Filters = route.params?.initial || {};

  const [q, setQ] = useState(initial.q || "");
  const [city, setCity] = useState(initial.city || "");
  const [priceMin, setPriceMin] = useState<string>(initial.priceMin?.toString() || "");
  const [priceMax, setPriceMax] = useState<string>(initial.priceMax?.toString() || "");
  const [bedroomsMin, setBedroomsMin] = useState<string>(initial.bedroomsMin?.toString() || "");
  const [bathroomsMin, setBathroomsMin] = useState<string>(initial.bathroomsMin?.toString() || "");
  const [types, setTypes] = useState<PropertyType[]>(initial.types ?? []);
  const [equipements, setEquipements] = useState<Equip[]>([]);
  const [equipementIds, setEquipementIds] = useState<string[]>(initial.equipementIds || []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("equipements")
        .select("id, name, category")
        .or("category.eq.logement,category.is.null");
      if (!error) setEquipements((data || []) as any);
    })();
  }, []);

  const toggleType = (k: PropertyType) =>
    setTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const toggleEquip = (id: string) =>
    setEquipementIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const reset = () => {
    setQ("");
    setCity("");
    setPriceMin("");
    setPriceMax("");
    setBedroomsMin("");
    setBathroomsMin("");
    setTypes([]);
    setEquipementIds([]);
  };

  const apply = () => {
    const filters: Filters = {
      q: q.trim() || undefined,
      city: city.trim() || undefined,
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
      bedroomsMin: bedroomsMin ? Number(bedroomsMin) : null,
      bathroomsMin: bathroomsMin ? Number(bathroomsMin) : null,
      types: types.length ? types : undefined,
      equipementIds: equipementIds.length ? equipementIds : undefined,
    };

    navigation.navigate({
      name: "Logements",
      params: { _filters: filters, _appliedAt: Date.now() },
      merge: true,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.modalBg} edges={["bottom"]}>
      {/* feuille (sheet) */}
      <View style={styles.sheet}>
        {/* Header Airbnb-like */}
        <View style={[styles.header, { paddingTop: 8 + insets.top * 0.1 }]}>
          <Text style={styles.hTitle}>Filtres</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Fermer les filtres"
          >
            <Ionicons name="close" size={22} color="#111" />
          </TouchableOpacity>
        </View>

        {/* iOS kb bar */}
        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={IA_ID}>
            <View style={styles.kbToolbar}>
              <View />
              <TouchableOpacity onPress={Keyboard.dismiss} style={styles.kbDone}>
                <Text style={styles.kbDoneTxt}>Terminer</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Rechercher par nom */}
            <Text style={styles.section}>Rechercher par nom</Text>
            <View style={styles.inputRow}>
              <Ionicons name="search" size={18} color="#6B6B6B" style={{ marginRight: 8 }} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Rechercher un logement par nom…"
                style={styles.inputFlex}
                returnKeyType="search"
                onSubmitEditing={apply}
                inputAccessoryViewID={Platform.OS === "ios" ? IA_ID : undefined}
                placeholderTextColor="#9A9A9A"
              />
            </View>

            {/* Où */}
            <Text style={styles.section}>Où</Text>
            <View style={styles.inputRow}>
              <Ionicons name="location-outline" size={18} color="#6B6B6B" style={{ marginRight: 8 }} />
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Anywhere"
                style={styles.inputFlex}
                inputAccessoryViewID={Platform.OS === "ios" ? IA_ID : undefined}
                placeholderTextColor="#9A9A9A"
              />
              <Ionicons name="chevron-down" size={18} color="#9A9A9A" />
            </View>

            {/* Dates (placeholder visuel simple) */}
            <Text style={styles.section}>Dates de réservation</Text>
            <View style={styles.calendarStub}>
              <Text style={{ color: "#8c8c8c", fontWeight: "600" }}>Sélectionnez vos dates</Text>
            </View>

            {/* Prix */}
            <Text style={styles.section}>Fourchette de prix</Text>
            <View style={{ marginBottom: 8, height: 52, borderRadius: 14, backgroundColor: "#fff", justifyContent: "center", paddingHorizontal: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 }}>
              <View style={{ height: 12, backgroundColor: "#ff385c33", borderRadius: 6 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Minimum</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={priceMin}
                    onChangeText={setPriceMin}
                    placeholder="0"
                    keyboardType="number-pad"
                    style={styles.inputFlex}
                    inputAccessoryViewID={Platform.OS === "ios" ? IA_ID : undefined}
                  />
                  <Text style={styles.unit}>FCFA</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.small}>Maximum</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={priceMax}
                    onChangeText={setPriceMax}
                    placeholder="500000"
                    keyboardType="number-pad"
                    style={styles.inputFlex}
                    inputAccessoryViewID={Platform.OS === "ios" ? IA_ID : undefined}
                  />
                  <Text style={styles.unit}>FCFA</Text>
                </View>
              </View>
            </View>
            <Text style={styles.helper}>Prix sélectionné: {priceMin || 0} - {priceMax || 500000} FCFA</Text>

            {/* Chambres / SDB */}
            <Text style={styles.section}>Chambres et lits</Text>
            {[
              { label: "Chambres", value: bedroomsMin, setValue: setBedroomsMin },
              { label: "Salles de bain", value: bathroomsMin, setValue: setBathroomsMin },
            ].map((row) => (
              <View key={row.label} style={styles.counterRow}>
                <Text style={styles.counterLabel}>{row.label}</Text>
                <View style={styles.counterBtns}>
                  <TouchableOpacity
                    onPress={() => row.setValue(String(Math.max(0, Number(row.value || 0) - 1)))}
                    style={styles.roundBtn}
                  >
                    <Text style={styles.roundBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{row.value || "0"}</Text>
                  <TouchableOpacity
                    onPress={() => row.setValue(String(Number(row.value || 0) + 1))}
                    style={styles.roundBtn}
                  >
                    <Text style={styles.roundBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Recos (exemples visuels) */}
            <Text style={styles.section}>Nos recommandations</Text>
            <View style={{ gap: 10 }}>
              {["Wifi", "Cuisine", "Parking gratuit"].map((name) => (
                <View key={name} style={styles.recoCard}>
                  <Text style={styles.recoEmoji}>{emojiForEquip(name)}</Text>
                  <Text style={styles.recoText}>{name}</Text>
                </View>
              ))}
            </View>

            {/* Type de propriété */}
            <Text style={styles.section}>Type de propriété</Text>
            <View style={styles.typeGrid}>
              {TYPES.map((t) => {
                const on = types.includes(t.key);
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => toggleType(t.key)}
                    activeOpacity={0.9}
                    style={[styles.typeCell, on && styles.typeCellOn]}
                  >
                    <Text style={styles.typeEmoji}>{t.emoji}</Text>
                    <Text style={[styles.typeLabel, on && styles.typeLabelOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Équipements (depuis BDD) */}
            <Text style={styles.section}>Équipements</Text>
            <View style={styles.equipGrid}>
              {equipements.map((e) => {
                const on = equipementIds.includes(e.id);
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => toggleEquip(e.id)}
                    activeOpacity={0.9}
                    style={[styles.equipChip, on && styles.equipChipOn]}
                  >
                    <Text style={styles.equipEmoji}>{emojiForEquip(e.name)}</Text>
                    <Text style={[styles.equipTxt, on && styles.equipTxtOn]}>{e.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={reset} style={styles.resetBtn} activeOpacity={0.85}>
            <Text style={styles.resetTxt}>Réinitialiser</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={apply} style={styles.applyBtn} activeOpacity={0.9}>
            <Text style={styles.applyTxt}>Rechercher</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const PANEL_BG = "rgba(0,0,0,0.35)";

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: PANEL_BG, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "92%",
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  hTitle: { fontSize: 24, fontWeight: "900", color: "#111", alignSelf: "flex-start" },
  closeBtn: {
    position: "absolute",
    right: 12,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f4f4f4",
    alignItems: "center",
    justifyContent: "center",
  },

  section: { marginTop: 18, marginBottom: 8, fontWeight: "900", color: "#111827", fontSize: 18 },
  small: { fontSize: 12, color: "#666", fontWeight: "700", marginBottom: 6 },
  helper: { fontSize: 12, color: "#666", marginTop: 6 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12,
    height: Platform.OS === "ios" ? 48 : 50,
  },
  inputFlex: { flex: 1, color: "#111", fontWeight: "700" },
  unit: { fontWeight: "800", color: "#666", marginLeft: 6 },

  calendarStub: {
    height: 220,
    borderRadius: 16,
    backgroundColor: "#f7f7f7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  counterLabel: { fontSize: 16, fontWeight: "700", color: "#222" },
  counterBtns: { flexDirection: "row", alignItems: "center", gap: 14 },
  roundBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: "#d8d8d8", alignItems: "center", justifyContent: "center",
  },
  roundBtnTxt: { fontSize: 18, fontWeight: "900", color: "#333" },
  counterVal: { width: 26, textAlign: "center", fontWeight: "800", color: "#111" },

  recoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#ffe7d1",
  },
  recoEmoji: { fontSize: 18, marginRight: 10 },
  recoText: { fontWeight: "800", color: "#333" },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCell: {
    width: "47.5%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#fff",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCellOn: { borderColor: "#111", backgroundColor: "#11111108" },
  typeEmoji: { fontSize: 22, marginBottom: 6 },
  typeLabel: { fontWeight: "800", color: "#333" },
  typeLabelOn: { color: "#111" },

  equipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  equipChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  equipChipOn: { borderColor: "#111", backgroundColor: "#11111108" },
  equipEmoji: { fontSize: 16, marginRight: 8 },
  equipTxt: { fontWeight: "800", color: "#444" },
  equipTxtOn: { color: "#111" },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", gap: 10, padding: 16,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: -4 }, shadowRadius: 10, elevation: 8,
  },
  resetBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: "#eee", alignItems: "center", justifyContent: "center" },
  resetTxt: { fontWeight: "900", color: "#111" },
  applyBtn: { flex: 1.4, height: 52, borderRadius: 26, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  applyTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },

  kbToolbar: {
    backgroundColor: "#f6f6f6",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  kbDone: { backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  kbDoneTxt: { color: "#fff", fontWeight: "900" },
});
