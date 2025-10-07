import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  InputAccessoryView,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from '@/src/ui/Icon';;
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

/* ---------------------------------------------------- */
/* Types & props                                         */
/* ---------------------------------------------------- */
type Props = NativeStackScreenProps<RootStackParamList, "PublishLogement">;

type Equip = { id: string; name: string; category?: string | null };
type Picked = { uri: string; base64?: string };

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/* ---------------------------------------------------- */
/* Constantes                                            */
/* ---------------------------------------------------- */
const IA_ID = "publish-toolbar";
const BUCKET = "listing-images"; // ✅ même que EditListingScreen
const MIN_PICS = 4;

const HOUSE_TYPES = [
  { key: "appartement", label: "Appartement", icon: "business-outline" },
  { key: "maison", label: "Maison", icon: "home-outline" },
  { key: "hotel", label: "Hôtel", icon: "bed-outline" },
] as const;

const RENTAL_TYPES = ["heure", "nuit", "jour", "mois"] as const;

const TITLE_MIN = 4;
const DESC_MIN = 20;

/* ---------------------------------------------------- */
/* Helpers                                               */
/* ---------------------------------------------------- */
function base64ToUint8Array(base64: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = chars.indexOf(clean[i + 2]);
    const e4 = chars.indexOf(clean[i + 3]);
    const n1 = (e1 << 2) | (e2 >> 4);
    const n2 = ((e2 & 15) << 4) | (e3 >> 2);
    const n3 = ((e3 & 3) << 6) | e4;
    bytes.push(n1);
    if (clean[i + 2] !== "=") bytes.push(n2);
    if (clean[i + 3] !== "=") bytes.push(n3);
  }
  return new Uint8Array(bytes);
}

function guessContentType(uri: string) {
  const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
  if (ext === "png") return { ext, contentType: "image/png" };
  if (ext === "webp") return { ext, contentType: "image/webp" };
  return { ext: "jpg", contentType: "image/jpeg" };
}

/** ✅ Demande d'autorisation claire (conforme App Store) */
async function ensurePhotoPermission(): Promise<boolean> {
  try {
    // 1) Vérifie l'état actuel
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();

    // 2) Demande si possible
    if (perm.status !== "granted" && perm.canAskAgain) {
      perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    // 3) Si toujours pas accordée
    if (perm.status !== "granted") {
      Alert.alert(
        "Accès aux photos requis",
        "Flexii utilise vos photos pour illustrer vos annonces (ex. photos du logement). Vous pouvez autoriser l'accès dans Réglages.",
        [
          { text: "Ouvrir Réglages", onPress: () => Linking.openSettings() },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("ensurePhotoPermission error", e);
    Alert.alert("Oups", "Impossible de vérifier la permission Photos.");
    return false;
  }
}

/** ✅ Ouvre la galerie pour sélectionner PLUSIEURS images */
async function pickMultipleImages(): Promise<Picked[]> {
  const ok = await ensurePhotoPermission();
  if (!ok) return [];

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    base64: true,
    allowsMultipleSelection: true, // ✅ Active la sélection multiple
    selectionLimit: 0, // ✅ 0 = pas de limite (ou mettez un nombre comme 10)
    exif: false,
    allowsEditing: false,
  });

  if (res.canceled || !res.assets?.length) return [];
  
  // ✅ Retourner toutes les images sélectionnées
  return res.assets.map(a => ({ 
    uri: a.uri, 
    base64: a.base64 || undefined 
  }));
}

/* ---------------------------------------------------- */
/* Petits composants UI                                  */
/* ---------------------------------------------------- */
function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function Label({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <Text style={[styles.label, small && { fontSize: 12 }]}>{children}</Text>;
}
function Seg({
  values, value, onChange,
}: { values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segment}>
      {values.map((v) => {
        const active = value === v;
        return (
          <TouchableOpacity
            key={v}
            onPress={() => onChange(v)}
            style={[styles.segBtn, active && styles.segBtnActive]}
            activeOpacity={0.9}
          >
            <Text style={[styles.segTxt, active && styles.segTxtActive]}>{v}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      inputAccessoryViewID={Platform.OS === "ios" ? IA_ID : undefined}
      returnKeyType="done"
      onSubmitEditing={Keyboard.dismiss}
      blurOnSubmit
      style={[styles.input, props.style]}
      placeholderTextColor="#A1A1A1"
    />
  );
}

function Stepper({
  label, value, setValue, min = 0, max = 99,
}: { label: string; value: number; setValue: (n: number) => void; min?: number; max?: number }) {
  const dec = () => setValue(Math.max(min, value - 1));
  const inc = () => setValue(Math.min(max, value + 1));
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperCtrls}>
        <TouchableOpacity onPress={dec} style={styles.stepperBtn} activeOpacity={0.8}>
          <Ionicons name="remove" size={18} color="#111" />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity onPress={inc} style={styles.stepperBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#111" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const iconForEquip = (name: string): IoniconName => {
  const n = name.toLowerCase();
  if (n.includes("wifi")) return "wifi";
  if (n.includes("tv")) return "tv-outline";
  if (n.includes("clim") || n.includes("ac") || n.includes("air")) return "snow";
  if (n.includes("parking") || n.includes("garage")) return "car-outline";
  if (n.includes("piscine") || n.includes("pool")) return "water-outline";
  if (n.includes("cuisine") || n.includes("kitchen")) return "restaurant-outline";
  if (n.includes("chauffe") || n.includes("chaud")) return "flame-outline";
  if (n.includes("machine") || n.includes("linge")) return "sync-outline";
  return "ellipse-outline";
};

/* ---------------------------------------------------- */
/* Equipements                                           */
/* ---------------------------------------------------- */
function EquipementsPicker({
  selectedIds, onToggle,
}: { selectedIds: string[]; onToggle: (id: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [equipements, setEquipements] = useState<Equip[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("equipements")
          .select("id, name, category")
          .eq("category", "logement");
        if (error) throw error;
        setEquipements((data || []) as any);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ paddingVertical: 8 }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.equipWrap}>
      {equipements.map((e) => {
        const active = selectedIds.includes(e.id);
        return (
          <TouchableOpacity
            key={e.id}
            onPress={() => onToggle(e.id)}
            activeOpacity={0.85}
            style={[styles.equipChip, active && styles.equipChipActive]}
          >
            <Ionicons name={iconForEquip(e.name)} size={18} color={active ? "#fff" : "#666"} />
            <Text numberOfLines={1} style={[styles.equipTxt, active && styles.equipTxtActive]}>
              {e.name}
            </Text>
          </TouchableOpacity>
        );
      })}
      {equipements.length === 0 && (
        <Text style={styles.hint}>Aucun équipement disponible.</Text>
      )}
    </View>
  );
}

/* ---------------------------------------------------- */
/* Écran principal                                       */
/* ---------------------------------------------------- */
export default function PublishLogementScreen({ navigation }: Props) {
  // Infos essentielles
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Type logement / location / prix
  const [lgType, setLgType] = useState<"appartement" | "maison" | "hotel">("appartement");
  const [rentalType, setRentalType] = useState<"heure" | "nuit" | "jour" | "mois">("nuit");
  const [price, setPrice] = useState<string>("");

  // Détails capacité
  const [bedrooms, setBedrooms] = useState(0);
  const [showers, setShowers] = useState(0);
  const [toilets, setToilets] = useState(0);
  const [maxGuests, setMaxGuests] = useState(1);

  // Localisation
  const [city, setCity] = useState("");
  const [quartier, setQuartier] = useState("");
  const [adresse, setAdresse] = useState("");

  // Équipements & photos
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>([]);
  const [images, setImages] = useState<Picked[]>([]);

  const [publishing, setPublishing] = useState(false);

  // 🔎 Invalidités (live)
  const invalidTitle = title.trim().length < TITLE_MIN;
  const invalidDesc = description.trim().length < DESC_MIN;
  const invalidCity = city.trim().length === 0;
  const invalidPrice = isNaN(Number(price)) || Number(price) <= 0;
  const invalidImages = images.length < MIN_PICS;

  const canPublish = useMemo(() => {
    return (
      !invalidTitle &&
      !invalidDesc &&
      !invalidCity &&
      !!rentalType &&
      !invalidPrice &&
      !invalidImages
    );
  }, [invalidTitle, invalidDesc, invalidCity, rentalType, invalidPrice, invalidImages]);

  const addPhoto = async () => {
    try {
      const picked = await pickMultipleImages(); // ✅ Utiliser la nouvelle fonction
      if (picked.length === 0) return;
      
      // ✅ Ajouter toutes les images sélectionnées (les nouvelles en premier)
      setImages((prev) => [...picked, ...prev]);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Oups", "Impossible d'ouvrir votre galerie.");
    }
  };

  const removePhoto = (uri: string) => {
    setImages((prev) => prev.filter((p) => p.uri !== uri));
  };

  const toggleEquip = (id: string) =>
    setSelectedEquipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /* ---------------- Publication ---------------- */
  const publish = async () => {
    try {
      if (publishing) return;

      if (!canPublish) {
        const errs: string[] = [];
        if (invalidTitle) errs.push(`Titre : ${TITLE_MIN} caractères minimum (il manque ${Math.max(0, TITLE_MIN - title.trim().length)})`);
        if (invalidDesc) errs.push(`Description : ${DESC_MIN} caractères minimum (il manque ${Math.max(0, DESC_MIN - description.trim().length)})`);
        if (invalidCity) errs.push("Ville : champ requis");
        if (invalidPrice) errs.push("Prix : un nombre positif est requis");
        if (invalidImages) errs.push(`Photos : ${MIN_PICS} minimum (il manque ${Math.max(0, MIN_PICS - images.length)})`);
        Alert.alert("Formulaire incomplet", "Corrige ces points :\n\n• " + errs.join("\n• "));
        return;
      }

      setPublishing(true);

      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        setPublishing(false);
        navigation.navigate("AuthSheet");
        return;
      }

      // 1) insert listing
      const ins = await supabase
        .from("listings_logements")
        .insert({
          title: title.trim(),
          description: description.trim(),
          type: lgType,
          rental_type: rentalType,
          price: Number(price),
          city: city.trim(),
          quartier: quartier.trim() || null,
          adresse: adresse.trim() || null,
          bedrooms,
          showers,
          toilets,
          max_guests: maxGuests,
        })
        .select("id")
        .single<{ id: string }>();

      if (ins.error || !ins.data?.id) throw ins.error ?? new Error("insert failed");
      const listingId = ins.data.id;

      // 2) upload photos — ordre respecté (0,1,2,…) + filenames indexés
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const base64 = img.base64 ?? (await FileSystem.readAsStringAsync(img.uri, { encoding: "base64" }));
        const bytes = base64ToUint8Array(base64);
        const { ext, contentType } = guessContentType(img.uri);
        const filename = `${String(i).padStart(3, "0")}_${Date.now()}.${ext}`;
        const path = `logement/${listingId}/${filename}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = pub.publicUrl;

        const { error: imgErr } = await supabase
          .from("listing_images")
          .insert({ logement_id: listingId, image_url: publicUrl } as any);
        if (imgErr) throw imgErr;
      }

      // 3) équipements
      if (selectedEquipIds.length > 0) {
        const rows = selectedEquipIds.map((equipement_id) => ({
          logement_id: listingId,
          equipement_id,
        }));
        const { error: eqErr } = await supabase.from("listing_equipements").insert(rows as any);
        if (eqErr) throw eqErr;
      }

      Alert.alert("Annonce créée", "Votre logement sera publié après validation.");
      navigation.replace("LogementDetails", { id: listingId });
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Impossible de publier l'annonce.");
    } finally {
      setPublishing(false);
    }
  };

  const headerTitle = useMemo(() => "Publier un logement", []);

  return (
    <View style={styles.root}>
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

      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.xBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Type logement */}
              <Card>
                <Label>Type de logement</Label>
                <View style={styles.grid2}>
                  {HOUSE_TYPES.map((t) => {
                    const on = lgType === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        activeOpacity={0.9}
                        onPress={() => setLgType(t.key)}
                        style={[styles.tile, on && styles.tileOn]}
                      >
                        <Ionicons name={t.icon as any} size={20} color={on ? "#111" : "#444"} />
                        <Text style={[styles.tileLabel, on && styles.tileLabelOn]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>

              {/* Photos */}
              <Card>
                <View style={styles.imagesHeader}>
                  <Label>Photos</Label>
                  <TouchableOpacity onPress={addPhoto} style={styles.addPhotoBtn} activeOpacity={0.9}>
                    <Text style={styles.addPhotoTxt}>Ajouter des photos</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.hint}>💡 Les dernières photos ajoutées seront affichées en premier.</Text>

                <View style={[styles.imagesGrid, invalidImages && styles.imagesGridError]}>
                  <TouchableOpacity onPress={addPhoto} style={styles.plusTile} activeOpacity={0.8}>
                    <Ionicons name="add" size={22} color="#111" />
                  </TouchableOpacity>

                  {images.map((img) => (
                    <View key={img.uri} style={styles.imgTile}>
                      <Image source={{ uri: img.uri }} style={styles.img} />
                      <TouchableOpacity
                        style={styles.imgTrash}
                        onPress={() => removePhoto(img.uri)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {invalidImages && (
                  <Text style={[styles.hint, styles.hintError, { marginTop: 6 }]}>
                    Minimum {MIN_PICS} photos. Il manque {Math.max(0, MIN_PICS - images.length)} photo(s).
                  </Text>
                )}
              </Card>

              {/* Titre & description */}
              <Card>
                <Label>Titre</Label>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Titre de l'annonce"
                  style={[invalidTitle && styles.inputError]}
                />
                {invalidTitle && (
                  <Text style={[styles.hint, styles.hintError]}>
                    {TITLE_MIN} caractères minimum • Il manque {Math.max(0, TITLE_MIN - title.trim().length)}
                  </Text>
                )}

                <View style={{ height: 10 }} />
                <Label>Description</Label>
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Décrivez votre logement…"
                  multiline
                  style={[{ height: 140, textAlignVertical: "top" }, invalidDesc && styles.inputError]}
                />
                <Text style={[styles.hint, invalidDesc && styles.hintError]}>
                  {description.length}/500
                  {invalidDesc ? ` • Il manque ${Math.max(0, DESC_MIN - description.trim().length)}` : ""}
                </Text>
              </Card>

              {/* Détails & prix */}
              <Card>
                <Label>Tarification</Label>
                <Seg values={RENTAL_TYPES as unknown as string[]} value={rentalType} onChange={(v) => setRentalType(v as any)} />
                <View style={{ height: 8 }} />
                <Input
                  value={price}
                  onChangeText={setPrice}
                  placeholder="Prix (XOF)"
                  keyboardType="decimal-pad"
                  style={[invalidPrice && styles.inputError]}
                />
                {invalidPrice && <Text style={[styles.hint, styles.hintError]}>Entrez un nombre strictement positif</Text>}
              </Card>

              <Card>
                <Label>Capacité & pièces</Label>
                <Stepper label="Chambres" value={bedrooms} setValue={setBedrooms} min={0} />
                <Stepper label="Douches" value={showers} setValue={setShowers} min={0} />
                <Stepper label="Toilettes" value={toilets} setValue={setToilets} min={0} />
                <Stepper label="Voyageurs max" value={maxGuests} setValue={setMaxGuests} min={1} />
              </Card>

              {/* Localisation */}
              <Card>
                <Label>Localisation</Label>
                <Input
                  value={city}
                  onChangeText={setCity}
                  placeholder="Ville"
                  style={[invalidCity && styles.inputError]}
                />
                {invalidCity && <Text style={[styles.hint, styles.hintError]}>Ville requise</Text>}
                <View style={{ height: 8 }} />
                <Input value={quartier} onChangeText={setQuartier} placeholder="Quartier (optionnel)" />
                <View style={{ height: 8 }} />
                <Input value={adresse} onChangeText={setAdresse} placeholder="Adresse (optionnel)" />
              </Card>

              {/* Equipements */}
              <Card>
                <Label>Équipements</Label>
                <EquipementsPicker selectedIds={selectedEquipIds} onToggle={toggleEquip} />
              </Card>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Footer */}
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, publishing && { opacity: 0.6 }]}
          disabled={publishing}
          onPress={publish}
          activeOpacity={0.9}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.saveTxt}>Publier</Text>
            </>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

/* ---------------------------------------------------- */
/* Styles                                                */
/* ---------------------------------------------------- */
const R = 18;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1 },

  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  xBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#f2f2f2",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111" },

  card: {
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
    marginTop: 12,
  },

  label: { color: "#666", fontWeight: "800", marginBottom: 6 },

  input: {
    height: Platform.OS === "ios" ? 46 : 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f7f7f7",
    color: "#111",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  inputError: {
    borderColor: "#E61E4D",
    backgroundColor: "#fff5f7",
  },

  segment: {
    marginTop: 4,
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    gap: 6,
  },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center" },
  segBtnActive: { backgroundColor: "#fff" },
  segTxt: { fontWeight: "800", color: "#666" },
  segTxtActive: { color: "#111" },

  // Stepper
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  stepperLabel: { fontWeight: "800", color: "#111" },
  stepperCtrls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#f3f3f3", alignItems: "center", justifyContent: "center",
  },
  stepperValue: { width: 28, textAlign: "center", fontWeight: "900", color: "#111" },

  // Images
  imagesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  addPhotoBtn: { backgroundColor: "#111", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 },
  addPhotoTxt: { color: "#fff", fontWeight: "900" },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  imagesGridError: {
    borderWidth: 1,
    borderColor: "#E61E4D",
    borderRadius: 12,
    padding: 6,
  },
  plusTile: {
    width: 92, height: 92, borderRadius: 12, borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center", backgroundColor: "#f7f7f7",
  },
  imgTile: { width: 92, height: 92, borderRadius: 12, overflow: "hidden", backgroundColor: "#eee" },
  img: { width: "100%", height: "100%" },
  imgTrash: {
    position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center",
  },

  // Equipements
  equipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  equipChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: "#f4f4f4",
  },
  equipChipActive: {
    backgroundColor: "#111", borderWidth: 1, borderColor: "#111",
  },
  equipTxt: { fontWeight: "800", color: "#666", maxWidth: 160 },
  equipTxtActive: { color: "#fff" },
  hint: { marginTop: 6, color: "#888", fontSize: 12, fontWeight: "600" },
  hintError: { color: "#E61E4D" },

  // Keyboard accessory
  kbToolbar: {
    backgroundColor: "#f6f6f6",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kbDone: { backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  kbDoneTxt: { color: "#fff", fontWeight: "900" },

  // Footer
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.98)",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: -4 }, shadowRadius: 10, elevation: 8,
  },
  saveBtn: {
    backgroundColor: "#111", height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  saveTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },

  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%", padding: 14, backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", alignItems: "center", gap: 8,
  },
  tileOn: { borderColor: "#111", backgroundColor: "#f9f9f9" },
  tileLabel: { fontWeight: "800", color: "#444" },
  tileLabelOn: { color: "#111" },
});