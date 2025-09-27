import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  listMyConversations,
  subscribeToMany,
  ConversationPreview,
  Message,
  sendOffer,
  acceptOffer,
  rejectOffer,
} from "@/src/services/chat.service";
import { supabase } from "@/src/lib/supabase";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";

import BottomNavBar, { TABBAR_BASE_HEIGHT, type TabKey } from "@/src/components/BottomNavBar";
import * as Notifications from "expo-notifications";
import { useIsFocused } from "@react-navigation/native";

type Props = NativeStackScreenProps<RootStackParamList, "Conversations">;

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const buildSuggestions = (base?: number | null) => {
  if (!base || base <= 0) return [45, 48, 50, 55];
  const p = Math.round(base);
  return [Math.round(p * 0.9), Math.round(p * 0.95), p, Math.round(p * 1.1)];
};

export default function ConversationsScreen({ navigation }: Props) {
  const [items, setItems] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [offerOpen, setOfferOpen] = useState<{ conv: ConversationPreview; priceText: string } | null>(null);

  useEffect(() => {
    (async () => {
      setMe((await supabase.auth.getUser()).data.user?.id ?? null);
      await reload();
      try {
        await Notifications.requestPermissionsAsync();
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("messages", {
            name: "Messages",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
      } catch {}
    })();
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listMyConversations();
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setItems(await listMyConversations());
    } finally {
      setRefreshing(false);
    }
  };

  const convIds = useMemo(() => items.map((i) => i.id), [items]);

  useEffect(() => {
    if (!items.length || !me) {
      setUnreadCount(0);
      return;
    }
    const count = items.reduce((acc, it) => {
      const lastAt = it.lastMessageAt ? new Date(it.lastMessageAt).getTime() : 0;
      // @ts-ignore support optionnel
      const lastReadAt = it.lastReadAt ? new Date((it as any).lastReadAt).getTime() : 0;
      const fromOther = !!it.lastMsgSenderId && it.lastMsgSenderId !== me;
      const isUnread = fromOther && (lastReadAt ? lastAt > lastReadAt : true);
      return acc + (isUnread ? 1 : 0);
    }, 0);
    setUnreadCount(count);
  }, [items, me]);

  useEffect(() => {
    if (!convIds.length) return;
    const off = subscribeToMany(convIds, async (m: Message) => {
      setItems((prev) => {
        const next = prev.map((p) =>
          p.id === m.conversation_id
            ? {
                ...p,
                lastMessageAt: m.created_at,
                lastMsgType: m.type,
                lastMsgSenderId: m.sender_id,
                lastMsgPrice: m.price ?? null,
                lastMsgText: m.content ?? p.lastMsgText,
              }
            : p
        );
        next.sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
        return next;
      });

      if (m.sender_id !== me && !isFocused) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: { title: "Nouveau message", body: m.content || "Vous avez reçu un nouveau message" },
            trigger: null,
          });
        } catch {}
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convIds.join("|"), me, isFocused]);

  const row = (it: ConversationPreview) => {
    const title = it.other?.full_name ?? (it.listingTitle ?? "Discussion");
    const subtitle = it.lastMsgText ?? "";
    const isBuyer = me === it.buyerId;
    const isOwner = me === it.sellerId;

    const showOwnerActions =
      isOwner && it.lastMsgType === "offer" && it.lastMsgSenderId === it.buyerId && typeof it.lastMsgPrice === "number";

    return (
      <View style={styles.rowWrap}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate("Chat", {
              conversationId: it.id,
              listingId: it.listingId,
              ownerId: it.sellerId,
              listingTitle: it.listingTitle ?? title,
            } as any)
          }
        >
          <View style={styles.avatarWrap}>
            {it.other?.avatar_url ? (
              <Image source={{ uri: it.other.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarTxt}>{(it.other?.full_name ?? "?").charAt(0)}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text numberOfLines={1} style={styles.name}>{title}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
          </View>

          {isBuyer && (
            <TouchableOpacity
              onPress={() => setOfferOpen({ conv: it, priceText: "" })}
              style={styles.quickBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pricetag-outline" size={20} color="#111" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {showOwnerActions && (
          <View style={styles.ownerActions}>
            <Text style={styles.ownerInfo}>Dernière offre: {euro(it.lastMsgPrice!)} • {it.other?.full_name ?? "Client"}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
             
              
            </View>
          </View>
        )}
      </View>
    );
  };

  const QuickOffer = () => {
    if (!offerOpen) return null;
    const conv = offerOpen.conv;
    const suggestions = buildSuggestions(conv.basePrice);

    const price = Number(offerOpen.priceText.replace(/[^\d]/g, "")) || 0;
    const canSend = price > 0;

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setOfferOpen(null)}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Proposer un prix</Text>
            <Text style={styles.modalSub}>{conv.listingTitle ?? "Votre conversation"}</Text>

            <View style={styles.suggestions}>
              {suggestions.map((p) => (
                <TouchableOpacity key={p} style={styles.chip} onPress={() => setOfferOpen({ ...offerOpen, priceText: String(p) })}>
                  <Text style={styles.chipText}>{euro(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.priceInput}>
              <TextInput
                placeholder="Montant (XOF)"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={offerOpen.priceText}
                onChangeText={(t) => setOfferOpen({ ...offerOpen, priceText: t })}
                style={{ fontSize: 18, fontWeight: "800", color: "#111" }}
              />
            </View>

            <TouchableOpacity
              disabled={!canSend}
              style={[styles.modalCta, !canSend && { opacity: 0.5 }]}
              onPress={async () => {
                try {
                  await sendOffer(conv.id, price);
                  setOfferOpen(null);
                } catch (e: any) {
                  Alert.alert("Oups", e?.message ?? "Impossible d’envoyer l’offre.");
                }
              }}
            >
              <Text style={styles.modalCtaTxt}>Envoyer l’offre {canSend ? `(${euro(price)})` : ""}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setOfferOpen(null)}>
              <Text style={{ fontWeight: "800", color: "#111" }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ✅ Fix TS: appelle navigate avec des littéraux via switch (pas de map variable)
  const handleTabChange = (t: TabKey) => {
    if (t === "Messages") return;
    switch (t) {
      case "logements":
        navigation.navigate("Logements");
        break;
      case "Favoris":
        navigation.navigate("Logements");
        break;
      case "Voyages":
        navigation.navigate("Reservations");
        break;
      case "Profil":
        navigation.navigate("Profile");
        break;
      default:
        break;
    }
  };

  const messagesBadge = unreadCount > 0 ? unreadCount : "1+";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Messages</Text>
        <TouchableOpacity onPress={reload}><Ionicons name="refresh" size={22} color="#111" /></TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => row(item)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: TABBAR_BASE_HEIGHT + insets.bottom + 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <View style={{ alignItems: "center", marginTop: 40 }}><Text style={{ color: "#777" }}>Aucune conversation.</Text></View> : null}
      />

      <QuickOffer />

      <BottomNavBar
        current="Messages"
        onChange={handleTabChange}
        onMessagesPress={() => {}}
        messagesBadge={messagesBadge}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 34, fontWeight: "800", color: "#111" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(0,0,0,0.06)", marginLeft: 80 },

  rowWrap: { backgroundColor: "#fff" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  avatarWrap: { width: 56, marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#eee" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontWeight: "800", color: "#555" },
  name: { fontSize: 16, fontWeight: "800", color: "#111" },
  subtitle: { color: "#666", marginTop: 2 },
  quickBtn: { padding: 6, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)" },

  ownerActions: { paddingHorizontal: 16, paddingBottom: 12, marginTop: -6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ownerInfo: { color: "#444", fontWeight: "600" },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14 },
  actionPrimary: { backgroundColor: "#111" },
  actionPrimaryText: { color: "#fff", fontWeight: "800" },
  actionGhost: { backgroundColor: "rgba(0,0,0,0.06)" },
  actionGhostText: { color: "#111", fontWeight: "800" },

  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", backgroundColor: "#fff", borderRadius: 22, padding: 18 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  modalSub: { color: "#666", marginTop: 4 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { backgroundColor: "rgba(0,0,0,0.06)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  chipText: { fontWeight: "800", color: "#111" },
  priceInput: { marginTop: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  modalCta: { marginTop: 12, backgroundColor: "#111", borderRadius: 18, paddingVertical: 12, alignItems: "center" },
  modalCtaTxt: { color: "#fff", fontWeight: "900" },
});
