import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ToastAndroid,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/src/lib/supabase";
import BottomNavBar from "@/src/components/BottomNavBar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";
import type { TabKey } from "@/src/components/BottomNavBar";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "client" | "proprio" | "admin" | null;
};

const prettyName = (n?: string | null) => (n || "").trim() || "Utilisateur";

// 👉 mapping onglet → nom de route dans ton RootStackParamList
const TAB_TO_SCREEN: Record<TabKey, keyof RootStackParamList> = {
  logements: "Logements",
  Favoris: "Reservations",
  Voyages: "Reservations",
  Messages: "Conversations",
  Profil: "Profile",
};

// hauteur locale pour laisser respirer le ScrollView sous la bottom nav
const LOCAL_TABBAR_HEIGHT = 72;

// 🔧 Bucket avatars (configurable via .env)
const AVATAR_BUCKET = process.env.EXPO_PUBLIC_AVATAR_BUCKET ?? "avatars";

// petit helper pour deviner l'extension & le contentType
// avant
// const guessExt = (fileName?: string, mimeType?: string) => { ... }
// const guessContentType = (ext: string) => { ... }

// après : null-safe + toujours une string en retour
const guessExt = (fileName?: string | null, mimeType?: string | null): string => {
  const name = fileName ?? "";
  const mt = mimeType ?? "";

  const extFromName = name.split(".").pop()?.toLowerCase();
  if (extFromName && extFromName.length <= 5) return extFromName;

  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("heic") || mt.includes("heif")) return "heic";
  if (mt.includes("gif")) return "gif";
  return "jpg";
};

const guessContentType = (ext: string): string => {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
};


export default function ProfileScreen({ navigation }: Props) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const insets = useSafeAreaInsets();

  const fetchMe = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) {
        navigation.replace("AuthSheet");
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, phone, avatar_url, role")
        .eq("id", uid)
        .maybeSingle<UserRow>();
      if (error) throw error;
      setUser(data);
      setFullName(data?.full_name || "");
      setPhone(data?.phone || "");
      setAvatarUrl(data?.avatar_url || "");
    setEmail(data?.email || "");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger le profil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
    const unsub = navigation.addListener("focus", fetchMe);
    return unsub;
  }, [navigation]);

  const initialLetter = useMemo(
    () => prettyName(user?.full_name).charAt(0).toUpperCase(),
    [user?.full_name]
  );

  const onSaveProfile = async () => {
    if (!user) return;
    try {
      setSaving(true);

      // 1) table publique
      const { error: e1 } = await supabase
        .from("users")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          avatar_url: avatarUrl.trim() || null,
            email: email.trim(),
        })
        .eq("id", user.id);
      if (e1) throw e1;

      // 2) métadonnées auth
      const { error: e2 } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          avatar_url: avatarUrl.trim() || null,
            email: email.trim(),
        },
      });
      if (e2) throw e2;

      setUser((u) =>
        u
          ? {
              ...u,
              full_name: fullName.trim(),
              phone: phone.trim(),
              avatar_url: avatarUrl.trim() || null,
                email: email.trim(),

            }
          : u
      );
      setEditOpen(false);
      Alert.alert("Profil", "Informations enregistrées ✓");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  // 📸 Choisir une image et uploader vers Supabase Storage
  const pickAndUploadAvatar = async () => {
    try {
      if (!user?.id) {
        Alert.alert("Session", "Vous devez être connecté.");
        return;
      }

      // permission galerie
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission", "Autorisez l’accès à la galerie pour changer l’avatar.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (res.canceled) return;

      const asset = res.assets[0];
      const ext = guessExt(asset.fileName, asset.mimeType);
      const contentType = asset.mimeType ?? guessContentType(ext);
      const path = `users/${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      setUploadingAvatar(true);

      // ⚠️ RN/Expo : on passe par fetch(uri) puis arrayBuffer()
      const resp = await fetch(asset.uri);
      const bytes = await resp.arrayBuffer();

      const { error: upErr } = await supabase
        .storage
        .from(AVATAR_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });

      if (upErr) {
        // message plus clair si le bucket n’existe pas
        if ((upErr as any)?.message?.includes("Bucket not found")) {
          throw new Error(
            `Le bucket "${AVATAR_BUCKET}" est introuvable. Crée-le dans Supabase Storage (public) ou change AVATAR_BUCKET.`
          );
        }
        throw upErr;
      }

      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // met à jour immédiatement l’UI
      setAvatarUrl(publicUrl);
      setUser((u) => (u ? { ...u, avatar_url: publicUrl } : u));

      // et persiste côté BDD + auth meta
      const { error: e1 } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (e1) throw e1;

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      Alert.alert("Avatar", "Photo de profil mise à jour ✓");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload avatar", e?.message ?? "Échec de l’upload de l’avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleHostMode = async () => {
    if (!user) return;
    try {
      const next = user.role === "proprio" ? "client" : "proprio";
      const { error } = await supabase.from("users").update({ role: next }).eq("id", user.id);
      if (error) throw error;
      setUser({ ...user, role: next as any });
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de changer de mode.");
    }
  };

  const signOut = () => {
  const name = prettyName(user?.full_name);

  Alert.alert(
    "Se déconnecter",
    "Voulez-vous vraiment vous déconnecter ?",
    [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui, me déconnecter",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();

            // petit message chaleureux
            const msg = `Déconnexion réussie. À bientôt, ${name} 👋`;
            if (Platform.OS === "android") {
              ToastAndroid.show(msg, ToastAndroid.LONG);
            } else {
              Alert.alert("Déconnexion", msg);
            }

            // retour à l’accueil
            navigation.reset({ index: 0, routes: [{ name: "Logements" }] });
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Impossible de se déconnecter.");
          }
        },
      },
    ],
    { cancelable: true }
  );
};

  // ---- Navigation par onglet depuis la bottom nav
  const handleTabChange = (t: TabKey) => {
    if (t === "Profil") return;
    const target = TAB_TO_SCREEN[t];
    navigation.navigate(target as never);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profil</Text>
          <TouchableOpacity style={styles.bell} onPress={() => Alert.alert("Notifications", "À venir")}>
            <Ionicons name="notifications-outline" size={20} color="#111" />
            <View style={styles.dot} />
          </TouchableOpacity>
        </View>

        {/* Scroll avec padding bas pour ne pas être masqué par la nav */}
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: LOCAL_TABBAR_HEIGHT + insets.bottom + 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Carte identité */}
          <View style={styles.identityCard}>
            <View style={styles.avatarWrap}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{initialLetter}</Text>
                </View>
              )}
              <View style={styles.verified}>
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
              </View>
            </View>

            <Text style={styles.name}>{prettyName(user?.full_name)}</Text>
            <Text style={styles.roleText}>{user?.role === "proprio" ? "Hôte" : "Voyageur"}</Text>

            <TouchableOpacity style={styles.editBtn} onPress={() => setEditOpen(true)}>
              <Ionicons name="create-outline" size={16} color="#111" />
              <Text style={styles.editTxt}>Modifier mes infos</Text>
            </TouchableOpacity>
          </View>

          {/* Grid 2 colonnes (cartes avec image) */}
          <View style={styles.grid}>
            <Tile
              title="Revenus"
              subtitle="Vos gains en tant que propriétaire"
              image={require("../../assets/images/revenue.jpg")}
              badge="NOUVEAU"
              onPress={() => navigation.navigate("Revenus")}
            />
            <Tile
              title="Réservations reçues"
              subtitle="En tant que propriétaire"
              image={require("../../assets/images/reservation.jpg")}
              badge="NOUVEAU"
              onPress={() => navigation.navigate("ReservationsRecues")}
            />
          </View>

          <View style={styles.grid}>
            <Tile
              title="Disponibilités"
              subtitle="Modifier la disponibilité de vos annonces et les prix"
              image={require("../../assets/images/disponibilite.jpg")}
              onPress={() => navigation.navigate("AvailabilityDashboard")}
            />
            <Tile
              title="publier un logement"
              subtitle="publier un nouveau logement"
              image={require("../../assets/images/annonce.jpg")}
              onPress={() => navigation.navigate("PublishLogement")}
            />
          </View>
          

          {/* Cartes longues (sans image) */}
          <LongCard
            title="modifier mon logement"
            subtitle="modifier ou supprimer une annonce"
            onPress={() => navigation.navigate("MyListings")}
          />

          <LongCards
            title="publier un Véhicule"
            subtitle="publier un Véhicule"
            onPress={() => navigation.navigate("PublishVehicule")}
          />

          {/* Liste style “réglages” */}
          <SettingsList
            items={[

                {
                icon: "settings-outline",
                label: "suppression du compte (Delete-account)",
                onPress: () => navigation.navigate("DeleteAccount"),
                dot: true,
              },
              {
                icon: "help-circle-outline",
                label: "Obtenir de l'aide",
                onPress: () => navigation.navigate("help"),
              },
              {
                icon: "person-outline",
                label: "Autorisation de donné",
                onPress: () => navigation.navigate("DataSafety"),
              },
              {
                icon: "shield-outline",
                label: "Confidentialité",
                onPress: () => navigation.navigate("privacy"),
              },
              { divider: true },
              {
                icon: "home-outline",
                label: "Mes logements",
                onPress: () => navigation.navigate("MyListings"),
              },
              {
                icon: "add-circle-outline",
                label: "Publier un logement",
                onPress: () => navigation.navigate("PublishLogement"),
              },
              {
                icon: "newspaper-outline",
                label: "Juridique",
                onPress: () => navigation.navigate("legal"),
              },
             { icon: "log-out-outline", label: "Se déconnecter", danger: true, onPress: signOut }
,
            ]    }

            
          />




          {/* Switch mode hôte */}
          <TouchableOpacity style={styles.hostPill} onPress={toggleHostMode} activeOpacity={0.9}>
            <Ionicons name="swap-vertical" size={18} color="#fff" />
            <Text style={styles.hostPillTxt}>
              {user?.role === "proprio" ? "Revenir en mode voyageur" : "Passer en mode hôte"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* —— Bottom Nav collée —— */}
      <BottomNavBar
        current="Profil"
        onChange={handleTabChange}
        onMessagesPress={() => navigation.navigate("Conversations")}
        onRequireAuth={() => navigation.navigate("AuthSheet")}
        messagesBadge="1+"   // 👈 ajouté, rien d’autre modifié
      />

      {/* —— Modal d’édition —— */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.modalTitle}>Mes informations</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Aperçu avatar + bouton choisir */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Image
                source={
                  avatarUrl
                    ? { uri: avatarUrl }
                    : require("../../assets/images/logement.jpg")
                }
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#eee" }}
              />
              <TouchableOpacity
                onPress={pickAndUploadAvatar}
                style={[styles.chooseBtn, uploadingAvatar && { opacity: 0.6 }]}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={16} color="#fff" />
                    <Text style={styles.chooseTxt}>Choisir une photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Nom complet</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Votre nom"
                style={styles.input}
                placeholderTextColor="#bbb"
              />
            </View>

             

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+225 00 00 00 00"
                style={styles.input}
                placeholderTextColor="#bbb"
              />
            </View>


            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Avatar (URL)</Text>
              <TextInput
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                placeholder="https://…/photo.jpg"
                style={styles.input}
                placeholderTextColor="#bbb"
                autoCapitalize="none"
              />
              <Text style={styles.hint}>
                Astuce : clique sur “Choisir une photo” pour uploader dans le bucket “{AVATAR_BUCKET}”.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, (saving || uploadingAvatar) && { opacity: 0.6 }]}
              onPress={onSaveProfile}
              disabled={saving || uploadingAvatar}
              activeOpacity={0.9}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Petits composants UI ---------- */

function Tile({
  title,
  subtitle,
  image,
  badge,
  onPress,
}: {
  title: string;
  subtitle?: string;
  image?: any;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.92}>
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badge}</Text>
        </View>
      )}
      {image ? (
        <Image source={image} style={styles.tileImg} resizeMode="cover" />
      ) : (
        <View style={[styles.tileImg, { backgroundColor: "#f1f1f1" }]} />
      )}
      <Text style={styles.tileTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.tileSub}>{subtitle}</Text>}
    </TouchableOpacity>
  );
}


function LongCards({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}){
  return (
    <TouchableOpacity style={styles.longCard} onPress={onPress} activeOpacity={0.92}>
      <Image
        source={require("../../assets/images/vehicule.jpg")}
        style={{ width: 56, height: 56, marginRight: 8, borderRadius: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.longTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.longSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </TouchableOpacity>
  );
}




function LongCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.longCard} onPress={onPress} activeOpacity={0.92}>
      <Image
        source={require("../../assets/images/logement.jpg")}
        style={{ width: 56, height: 56, marginRight: 8, borderRadius: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.longTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.longSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </TouchableOpacity>
  );
}

function SettingsList({
  items,
}: {
  items: (
    | {
        divider?: undefined;
        icon: string;
        label: string;
        onPress?: () => void;
        dot?: boolean;
        danger?: boolean;
      }
    | { divider: true }
  )[];
}) {
  return (
    <View style={styles.settingsCard}>
      {items.map((it, idx) =>
        "divider" in it ? (
          <View key={`div-${idx}`} style={styles.divider} />
        ) : (
          <TouchableOpacity
            key={it.label}
            style={styles.row}
            onPress={it.onPress}
            activeOpacity={0.8}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons
  name={it.icon as any}                // ← on respecte l’icône passée
  size={22}
  color={it.danger ? "#B00020" : "#111"}  // ← rouge si danger
/>

              {it.dot && <View style={styles.dotSmall} />}
            </View>
            <Text style={[styles.rowLabel, it.danger && { color: "#B00020" }]}>{it.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#bbb" />
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

/* ------------------- Styles ------------------- */

const R = 22;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1 },

  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#111" },

  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f3f3",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff2d55",
  },

  identityCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 14,
  },
  avatarWrap: { alignSelf: "center", width: 96, height: 96 },
  avatarImg: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#eee" },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontWeight: "800", fontSize: 40 },
  verified: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  name: { textAlign: "center", fontSize: 24, fontWeight: "900", color: "#111", marginTop: 10 },
  roleText: { textAlign: "center", color: "#888", fontWeight: "700" },

  editBtn: {
    marginTop: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f4f4f4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  editTxt: { fontWeight: "800", color: "#111" },

  grid: { flexDirection: "row", gap: 12, marginBottom: 12 },

  tile: {
    flex: 1,
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
  },
  tileImg: { width: "100%", height: 96, borderRadius: 14, marginBottom: 8 },
  tileTitle: { fontSize: 17, fontWeight: "900", color: "#111" },
  tileSub: { marginTop: 2, color: "#666", fontWeight: "600" },

  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#16304e",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  badgeTxt: { color: "#fff", fontWeight: "900", fontSize: 10, letterSpacing: 0.4 },

  longCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    marginBottom: 12,
  },
  longTitle: { fontWeight: "900", color: "#111", fontSize: 17 },
  longSub: { marginTop: 2, color: "#666", fontWeight: "600" },

  settingsCard: {
    backgroundColor: "#fff",
    borderRadius: R,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginTop: 6,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowIconWrap: { width: 28, alignItems: "center", marginRight: 10, position: "relative" },
  rowLabel: { flex: 1, fontWeight: "800", color: "#111" },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginVertical: 4, marginHorizontal: 14 },
  dotSmall: {
    position: "absolute",
    top: 6,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff2d55",
  },

  hostPill: {
    alignSelf: "center",
    marginTop: 16,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  hostPillTxt: { color: "#fff", fontWeight: "900" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
    justifyContent: "center",
  },

  inputWrap: { marginTop: 12 },
  inputLabel: { fontWeight: "800", color: "#666", marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#f7f7f7",
    color: "#111",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  hint: { marginTop: 6, color: "#888", fontSize: 12, fontWeight: "600" },

  saveBtn: {
    marginTop: 16,
    backgroundColor: "#111",
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  saveTxt: { color: "#fff", fontWeight: "900" },

  // Bouton choisir photo
  chooseBtn: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chooseTxt: { color: "#fff", fontWeight: "900" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
