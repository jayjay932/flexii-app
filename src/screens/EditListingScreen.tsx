// src/screens/EditListingScreen.tsx
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
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/src/lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "EditListing">;
type Kind = "logement" | "vehicule" | "experience";

/* ---------- helpers ---------- */

const toPgTime = (val?: string | null) => {
  const s = (val || "").trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return null;
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
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

// base64 -> Uint8Array (sans atob)
function base64ToUint8Array(base64: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = chars.indexOf(clean[i + 2]);
    const enc4 = chars.indexOf(clean[i + 3]);
    const n1 = (enc1 << 2) | (enc2 >> 4);
    const n2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const n3 = ((enc3 & 3) << 6) | enc4;
    bytes.push(n1);
    if (clean[i + 2] !== "=") bytes.push(n2);
    if (clean[i + 3] !== "=") bytes.push(n3);
  }
  return new Uint8Array(bytes);
}

const BUCKET = "listing-images";

type Picked = { uri: string; base64?: string };
async function pickSingleImage(): Promise<Picked | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission", "Autorise l’accès aux photos pour ajouter des images.");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    base64: true, // ✅ récupère directement le base64
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, base64: a.base64 || undefined };
}

function guessContentType(uri: string) {
  const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
  if (ext === "png") return { ext, contentType: "image/png" };
  if (ext === "webp") return { ext, contentType: "image/webp" };
  return { ext: "jpg", contentType: "image/jpeg" };
}

function storagePathFromPublicUrl(url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : null;
}

/* ---------- UI atoms ---------- */

const Seg = ({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) => (
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

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function Label({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <Text style={[styles.label, small && { fontSize: 12 }]}>{children}</Text>;
}

const IA_ID = "editing-toolbar";
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
  label,
  value,
  setValue,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min?: number;
  max?: number;
}) {
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

/* ---------- Equipements grid ---------- */
type Equip = { id: string; name: string; category: Kind };

function EquipementsPicker({
  kind,
  selectedIds,
  onToggle,
}: {
  kind: Kind;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [equipements, setEquipements] = useState<Equip[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("equipements")
          .select("id, name, category")
          .eq("category", kind);
        if (error) throw error;
        setEquipements((data || []) as any);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [kind]);

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
          <Pressable
            key={e.id}
            onPress={() => onToggle(e.id)}
            style={({ pressed }) => [
              styles.equipChip,
              (active || pressed) && styles.equipChipActive,
            ]}
          >
            {({ pressed }) => (
              <>
                <Ionicons
                  name={iconForEquip(e.name)}
                  size={18}
                  color={active || pressed ? "#fff" : "#666"}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.equipTxt, (active || pressed) && styles.equipTxtActive]}
                >
                  {e.name}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
      {equipements.length === 0 && (
        <Text style={styles.hint}>Aucun équipement disponible pour cette catégorie.</Text>
      )}
    </View>
  );
}

/* ---------- Images du listing ---------- */
type ListingImage = { id: string; image_url: string };

function ImagesCard({ kind, listingId }: { kind: Kind; listingId: string }) {
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [items, setItems] = useState<ListingImage[]>([]);

  const pivotCol = kind === "logement" ? "logement_id" : kind === "vehicule" ? "vehicule_id" : "experience_id";

  const fetchImages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("listing_images")
        .select("id, image_url")
        .eq(pivotCol, listingId);
      if (error) throw error;
      setItems((data || []) as any);
    } catch (e) {
      console.error(e);
      Alert.alert("Images", "Impossible de charger les images.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [listingId, kind]);

  const addImage = async () => {
    try {
      setAdding(true);
      const picked = await pickSingleImage();
      if (!picked) return;

      // ✅ on privilégie le base64 renvoyé par ImagePicker
      const base64 =
        picked.base64 ??
        (await FileSystem.readAsStringAsync(picked.uri, { encoding: "base64" }));

      const bytes = base64ToUint8Array(base64);
      const { ext, contentType } = guessContentType(picked.uri);
      const filename = `${Date.now()}.${ext}`;
      const path = `${kind}/${listingId}/${filename}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { data: inserted, error: insErr } = await supabase
        .from("listing_images")
        .insert({ [pivotCol]: listingId, image_url: publicUrl } as any)
        .select("id, image_url")
        .single();
      if (insErr) throw insErr;

      setItems((prev) => [inserted as ListingImage, ...prev]);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload", e?.message ?? "Échec de l’upload.");
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = (row: ListingImage) => {
    Alert.alert("Supprimer l'image", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteImage(row) },
    ]);
  };

  const deleteImage = async (row: ListingImage) => {
    try {
      const { error: delRowErr } = await supabase.from("listing_images").delete().eq("id", row.id);
      if (delRowErr) throw delRowErr;
      setItems((prev) => prev.filter((x) => x.id !== row.id));
      const p = storagePathFromPublicUrl(row.image_url);
      if (p) await supabase.storage.from(BUCKET).remove([p]);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Suppression", e?.message ?? "Échec de la suppression.");
    }
  };

  return (
    <Card>
      <View style={styles.imagesHeader}>
        <Label>Photos</Label>
        <TouchableOpacity
          onPress={addImage}
          style={[styles.addPhotoBtn, adding && { opacity: 0.6 }]}
          disabled={adding}
          activeOpacity={0.9}
        >
          {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addPhotoTxt}>Ajouter une photo</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 10 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={styles.imagesGrid}>
          <TouchableOpacity onPress={addImage} style={styles.plusTile} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#111" />
          </TouchableOpacity>

          {items.map((img) => (
            <View key={img.id} style={styles.imgTile}>
              <Image source={{ uri: img.image_url }} style={styles.img} />
              <TouchableOpacity style={styles.imgTrash} onPress={() => confirmDelete(img)} activeOpacity={0.85}>
                <Ionicons name="trash" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {items.length === 0 && (
            <Text style={[styles.hint, { marginTop: 8 }]}>Aucune image. Ajoute des photos de ton annonce.</Text>
          )}
        </View>
      )}
    </Card>
  );
}

/* ========================================================= */

export default function EditListingScreen({ route, navigation }: Props) {
  const { id, kind } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- États partagés
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");

  // logement
  const [lg_type, setLgType] = useState<"appartement" | "maison" | "hotel">("appartement");
  const [lg_rental, setLgRental] = useState<"heure" | "nuit" | "jour" | "mois">("nuit");
  const [lg_price, setLgPrice] = useState<string>("0");
  const [bedrooms, setBedrooms] = useState<number>(0);
  const [showers, setShowers] = useState<number>(0);
  const [toilets, setToilets] = useState<number>(0);
  const [maxGuests, setMaxGuests] = useState<number>(1);
  const [checkInStart, setCheckInStart] = useState<string>("15:00");
  const [checkInEnd, setCheckInEnd] = useState<string>("21:00");
  const [checkOut, setCheckOut] = useState<string>("11:00");

  // véhicule
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [veh_rental, setVehRental] = useState<"heure" | "jour" | "mois">("jour");
  const [veh_price, setVehPrice] = useState<string>("0");
  const [annee, setAnnee] = useState<string>("2020");
  const [isForSale, setIsForSale] = useState(false);
  const [salePrice, setSalePrice] = useState<string>("0");

  // expérience
  const [exp_category, setExpCategory] = useState("");
  const [exp_rental, setExpRental] = useState<"heure" | "jour" | "mois">("jour");
  const [exp_price, setExpPrice] = useState<string>("0");

  // équipements (sélection)
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>([]);

  const rentalValuesLogement: Array<"heure" | "nuit" | "jour" | "mois"> = ["heure", "nuit", "jour", "mois"];
  const rentalValuesCommon: Array<"heure" | "jour" | "mois"> = ["heure", "jour", "mois"];

  // -------- Fetch --------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        if (kind === "logement") {
          const { data, error } = await supabase
            .from("listings_logements")
            .select(
              "title, city, type, rental_type, price, bedrooms, showers, toilets, max_guests, check_in_start, check_in_end, check_out"
            )
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;

          setTitle(data?.title ?? "");
          setCity(data?.city ?? "");
          setLgType((data?.type as any) ?? "appartement");
          setLgRental((data?.rental_type as any) ?? "nuit");
          setLgPrice(String(data?.price ?? "0"));
          setBedrooms(Number(data?.bedrooms ?? 0));
          setShowers(Number(data?.showers ?? 0));
          setToilets(Number(data?.toilets ?? 0));
          setMaxGuests(Number(data?.max_guests ?? 1));
          setCheckInStart((data?.check_in_start as any) ?? "15:00");
          setCheckInEnd((data?.check_in_end as any) ?? "21:00");
          setCheckOut((data?.check_out as any) ?? "11:00");
        } else if (kind === "vehicule") {
          const { data, error } = await supabase
            .from("listings_vehicules")
            .select("marque, modele, price, rental_type, annee, city, is_for_sale, sale_price")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;

          setMarque(data?.marque ?? "");
          setModele(data?.modele ?? "");
          setVehPrice(String(data?.price ?? "0"));
          setVehRental((data?.rental_type as any) ?? "jour");
          setAnnee(String(data?.annee ?? "2020"));
          setCity(data?.city ?? "");
          setIsForSale(!!data?.is_for_sale);
          setSalePrice(String(data?.sale_price ?? "0"));
          setTitle(`${data?.marque ?? ""} ${data?.modele ?? ""}`.trim());
        } else {
          const { data, error } = await supabase
            .from("listings_experiences")
            .select("title, category, price, rental_type, city")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;

          setTitle(data?.title ?? "");
          setExpCategory(data?.category ?? "");
          setExpPrice(String(data?.price ?? "0"));
          setExpRental((data?.rental_type as any) ?? "jour");
          setCity(data?.city ?? "");
        }

        const pivotCol =
          kind === "logement" ? "logement_id" : kind === "vehicule" ? "vehicule_id" : "experience_id";
        const { data: piv, error: ePiv } = await supabase
          .from("listing_equipements")
          .select("equipement_id")
          .eq(pivotCol, id);
        if (ePiv) throw ePiv;
        setSelectedEquipIds((piv || []).map((r: any) => r.equipement_id));
      } catch (e) {
        console.error(e);
        Alert.alert("Erreur", "Impossible de charger l’annonce.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, kind]);

  const onToggleEquip = (eid: string) => {
    setSelectedEquipIds((prev) =>
      prev.includes(eid) ? prev.filter((x) => x !== eid) : [...prev, eid]
    );
  };

  const onSave = async () => {
    try {
      setSaving(true);

      if (kind === "logement") {
        const { error } = await supabase
          .from("listings_logements")
          .update({
            title: title.trim(),
            city: city.trim(),
            type: lg_type,
            rental_type: lg_rental,
            price: Number(lg_price || 0),
            bedrooms,
            showers,
            toilets,
            max_guests: maxGuests,
            check_in_start: toPgTime(checkInStart),
            check_in_end: toPgTime(checkInEnd),
            check_out: toPgTime(checkOut),
          })
          .eq("id", id);
        if (error) throw error;
      } else if (kind === "vehicule") {
        const { error } = await supabase
          .from("listings_vehicules")
          .update({
            marque: marque.trim(),
            modele: modele.trim(),
            city: city.trim(),
            rental_type: veh_rental,
            price: Number(veh_price || 0),
            annee: Number(annee || 0),
            is_for_sale: isForSale,
            sale_price: isForSale ? Number(salePrice || 0) : null,
          })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("listings_experiences")
          .update({
            title: title.trim(),
            category: exp_category.trim() || null,
            city: city.trim(),
            rental_type: exp_rental,
            price: Number(exp_price || 0),
          })
          .eq("id", id);
        if (error) throw error;
      }

      const pivotCol =
        kind === "logement" ? "logement_id" : kind === "vehicule" ? "vehicule_id" : "experience_id";

      const { error: delErr } = await supabase.from("listing_equipements").delete().match({ [pivotCol]: id } as any);
      if (delErr) throw delErr;

      if (selectedEquipIds.length > 0) {
        const rows = selectedEquipIds.map((equipement_id) => ({ equipement_id, [pivotCol]: id }));
        const { error: insErr } = await supabase.from("listing_equipements").insert(rows as any);
        if (insErr) throw insErr;
      }

      Alert.alert("Enregistré", "Les modifications ont été sauvegardées.");
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = useMemo(() => "Outil de modification d'annonce", []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.xBtn}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.fakeTabs}>
         
          <View style={[styles.fakeTab, styles.fakeTabActive]}>
            <Text style={[styles.fakeTabTxt, styles.fakeTabTxtActive]}>Mon annonces</Text>
          </View>
          <View style={styles.fakeTab}>
            <Text style={styles.fakeTabTxt}>Guide d'arrivée</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
              {/* Commun */}
              <Card>
                <Label>Titre</Label>
                <Input value={title} onChangeText={setTitle} placeholder="Titre de l’annonce" />
                <View style={{ height: 12 }} />
                <Label>Ville</Label>
                <Input value={city} onChangeText={setCity} placeholder="Ville" />
              </Card>

              {kind === "logement" && (
                <>
                  <Card>
                    <Label>Type de logement</Label>
                    <Seg values={["appartement", "maison", "hotel"]} value={lg_type} onChange={(v) => setLgType(v as any)} />
                    <View style={{ height: 12 }} />
                    <Label>Tarification</Label>
                    <Seg values={["heure", "nuit", "jour", "mois"]} value={lg_rental} onChange={(v) => setLgRental(v as any)} />
                    <View style={{ height: 8 }} />
                    <Input value={lg_price} onChangeText={setLgPrice} keyboardType="decimal-pad" placeholder="Prix par unité" />
                  </Card>

                  <Card>
                    <Label>Disponibilité</Label>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Label small>Arrivée (début)</Label>
                        <Input value={checkInStart} onChangeText={setCheckInStart} placeholder="15:00" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Label small>Arrivée (fin)</Label>
                        <Input value={checkInEnd} onChangeText={setCheckInEnd} placeholder="21:00" />
                      </View>
                    </View>
                    <View style={{ height: 8 }} />
                    <Label small>Départ</Label>
                    <Input value={checkOut} onChangeText={setCheckOut} placeholder="11:00" />
                  </Card>

                  <Card>
                    <Label>Capacité & pièces</Label>
                    <Stepper label="Chambres" value={bedrooms} setValue={setBedrooms} min={0} />
                    <Stepper label="Douches" value={showers} setValue={setShowers} min={0} />
                    <Stepper label="Toilettes" value={toilets} setValue={setToilets} min={0} />
                    <Stepper label="Voyageurs max" value={maxGuests} setValue={setMaxGuests} min={1} />
                  </Card>
                </>
              )}

              {kind === "vehicule" && (
                <>
                  <Card>
                    <Label>Modèle</Label>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Input value={marque} onChangeText={setMarque} placeholder="Marque" />
                      <Input value={modele} onChangeText={setModele} placeholder="Modèle" />
                    </View>
                    <View style={{ height: 8 }} />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Input value={annee} onChangeText={setAnnee} placeholder="Année" keyboardType="number-pad" />
                      <Input value={veh_price} onChangeText={setVehPrice} placeholder="Prix location" keyboardType="decimal-pad" />
                    </View>
                    <View style={{ height: 12 }} />
                    <Label>Type de location</Label>
                    <Seg values={["heure", "jour", "mois"]} value={veh_rental} onChange={(v) => setVehRental(v as any)} />
                  </Card>

                  <Card>
                    <Label>Vente (optionnel)</Label>
                    <TouchableOpacity
                      style={[styles.switchRow, isForSale && { backgroundColor: "#111" }]}
                      onPress={() => setIsForSale((p) => !p)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={isForSale ? "checkmark-circle" : "ellipse-outline"} size={18} color={isForSale ? "#fff" : "#111"} />
                      <Text style={[styles.switchTxt, isForSale && { color: "#fff" }]}>Proposer à la vente</Text>
                    </TouchableOpacity>
                    {isForSale && (
                      <>
                        <View style={{ height: 8 }} />
                        <Input value={salePrice} onChangeText={setSalePrice} placeholder="Prix de vente" keyboardType="decimal-pad" />
                      </>
                    )}
                  </Card>
                </>
              )}

              {kind === "experience" && (
                <>
                  <Card>
                    <Label>Catégorie</Label>
                    <Input value={exp_category} onChangeText={setExpCategory} placeholder="Catégorie" />
                    <View style={{ height: 12 }} />
                    <Label>Tarification</Label>
                    <Seg values={["heure", "jour", "mois"]} value={exp_rental} onChange={(v) => setExpRental(v as any)} />
                    <View style={{ height: 8 }} />
                    <Input value={exp_price} onChangeText={setExpPrice} placeholder="Prix" keyboardType="decimal-pad" />
                  </Card>
                </>
              )}

              {/* --------- IMAGES --------- */}
              <ImagesCard kind={kind} listingId={id} />

              {/* --------- EQUIPEMENTS --------- */}
              <Card>
                <Label>Équipements</Label>
                <EquipementsPicker kind={kind} selectedIds={selectedEquipIds} onToggle={onToggleEquip} />
              </Card>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={onSave}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveTxt}>Enregistrer</Text>
            </>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

/* ------------------- Styles ------------------- */
const R = 18;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: {
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
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111" },

  fakeTabs: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    gap: 6,
  },
  fakeTab: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: "center" },
  fakeTabActive: { backgroundColor: "#fff" },
  fakeTabTxt: { color: "#666", fontWeight: "800" },
  fakeTabTxtActive: { color: "#111" },

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
    marginHorizontal: 16,
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

  switchRow: {
    marginTop: 6,
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchTxt: { fontWeight: "900", color: "#111" },

  // Equipements
  equipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  equipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#f4f4f4",
  },
  equipChipActive: {
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#111",
  },
  equipTxt: { fontWeight: "800", color: "#666", maxWidth: 160 },
  equipTxtActive: { color: "#fff" },
  hint: { marginTop: 6, color: "#888", fontSize: 12, fontWeight: "600" },

  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  stepperLabel: { fontWeight: "800", color: "#111" },
  stepperCtrls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f3f3f3",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: { width: 28, textAlign: "center", fontWeight: "900", color: "#111" },

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
  saveBtn: {
    backgroundColor: "#111",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
   roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Images
  imagesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addPhotoBtn: { backgroundColor: "#111", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 },
  addPhotoTxt: { color: "#fff", fontWeight: "900" },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
});
