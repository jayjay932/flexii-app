// src/screens/ChatScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from '@/src/ui/Icon';;
import { supabase } from "@/src/lib/supabase";
import type { RootStackParamList } from "@/src/navigation/RootNavigator";
import type { Session } from "@supabase/supabase-js";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

type MsgType = "text" | "offer" | "offer_accept" | "offer_reject" | "system";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MsgType;
  content: string | null;
  price: number | null;
  meta: any | null;
  created_at: string; // ISO
};

type ComposerMode = "initial" | "negotiation";
type ListingKind = "logement" | "vehicule";

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(n);

const buildSuggestions = (base?: number) => {
  if (!base || base <= 0) return [45_000, 48_000, 50_000, 55_000];
  const p = Math.round(base);
  return [Math.round(p * 0.9), Math.round(p * 0.95), p, Math.round(p * 1.1)];
};

const isAcceptMsg = (m?: Message | null) =>
  !!m && (m.type === "offer_accept" || (m.type === "system" && m.meta?.action === "offer_accept"));
const isRejectMsg = (m?: Message | null) =>
  !!m && (m.type === "offer_reject" || (m.type === "system" && m.meta?.action === "offer_reject"));

export default function ChatScreen({ route, navigation }: Props) {
  const {
    listingId,
    ownerId,
    listingTitle: listingTitleFromRoute,
    conversationId: convFromRoute,
    forceOpenNegotiation,
  } = (route.params as RootStackParamList["Chat"] & {
    conversationId?: string;
    forceOpenNegotiation?: boolean;
  });

  // ----- Auth / participants -----
  const [session, setSession] = useState<Session | null>(null);
  const me = session?.user?.id ?? null;
  const isOwner = !!me && me === ownerId;

  // ----- Conversation & messages -----
  const [conversationId, setConversationId] = useState<string | null>(convFromRoute ?? null);
  const [listingKind, setListingKind] = useState<ListingKind | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<Message>>(null);

  // ----- Données annonce -----
  const [listingTitle, setListingTitle] = useState<string>(listingTitleFromRoute || "");
  const [listingBasePrice, setListingBasePrice] = useState<number | undefined>(undefined);
  const [listingThumb, setListingThumb] = useState<string | null>(null);

  // ----- Barre d'offre (ACHETEUR) -----
  const [proposals, setProposals] = useState<number[]>([45_000, 48_000, 50_000, 55_000]);
  const [priceText, setPriceText] = useState("");
  const price = useMemo(() => Number(priceText.replace(/[^\d]/g, "")) || 0, [priceText]);
  const canSend = price > 0;

  // Contrôle d’ouverture manuelle après refus
  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("initial");

  // ----- Participants (affichage noms) -----
  const [participants, setParticipants] = useState<Record<string, { name: string }>>({});

  // ----- Modal "négocier" (pour répondre à une offre reçue) -----
  const [negoModal, setNegoModal] = useState<{ open: boolean; price: string }>({ open: false, price: "" });

  // ====== Tick d’horloge pour l’expiration 48h / warning 24h ======
  const MS_MIN = 60_000;
  const MS_HOUR = 60 * MS_MIN;
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MS_MIN);
    return () => clearInterval(id);
  }, []);
  // ===============================================================

  // Helpers
  const last = <T,>(arr: T[]) => (arr.length ? arr[arr.length - 1] : undefined);
  const findMsgById = (id?: string | null) => (id ? msgs.find((m) => m.id === id) : undefined);
  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const opts: Intl.DateTimeFormatOptions = sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };
    return new Intl.DateTimeFormat("fr-FR", opts).format(d);
  };
  const pickDisplayName = (
    u:
      | { id: string; full_name?: string | null; name?: string | null; username?: string | null; email?: string | null; phone?: string | null }
      | null,
    fallback: string
  ) => (u?.full_name || u?.name || u?.username || u?.email || (u?.phone ? `+${u.phone}` : "") || fallback);
  const getName = (uid?: string | null) =>
    uid ? participants[uid]?.name || (uid === ownerId ? "Vendeur" : uid === me ? "Vous" : "Acheteur") : "—";

  const formatRemaining = (ms: number) => {
    const clamped = Math.max(0, ms);
    const totalMin = Math.floor(clamped / MS_MIN);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h} h ${m.toString().padStart(2, "0")} min`;
  };

  /* ---------------------- KIND-AWARE HELPERS ---------------------- */

  // Détecte le kind depuis la DB via l'id d'annonce
  async function detectKindFromDB(id: string): Promise<ListingKind | null> {
    const { data: v } = await supabase.from("listings_vehicules").select("id").eq("id", id).maybeSingle<{ id: string }>();
    if (v?.id) return "vehicule";
    const { data: l } = await supabase.from("listings_logements").select("id").eq("id", id).maybeSingle<{ id: string }>();
    if (l?.id) return "logement";
    return null;
  }

  // Charge meta (titre, prix, image) selon kind
  async function loadListingMeta(kind: ListingKind, id: string) {
    if (kind === "logement") {
      const { data: row } = await supabase
        .from("listings_logements")
        .select("title, price, listing_images(image_url)")
        .eq("id", id)
        .maybeSingle<{ title: string; price: number | null; listing_images: { image_url: string | null }[] | null }>();
      setListingTitle(row?.title || listingTitleFromRoute || "Annonce");
      setListingBasePrice(row?.price ?? undefined);
      setListingThumb(row?.listing_images?.[0]?.image_url ?? null);
      setProposals(buildSuggestions(row?.price ?? undefined));
    } else {
      const { data: row } = await supabase
        .from("listings_vehicules")
        .select("marque, modele, price, listing_images(image_url)")
        .eq("id", id)
        .maybeSingle<{ marque: string | null; modele: string | null; price: number | null; listing_images: { image_url: string | null }[] | null }>();
      const t = `${row?.marque ?? ""} ${row?.modele ?? ""}`.trim() || listingTitleFromRoute || "Véhicule";
      setListingTitle(t);
      setListingBasePrice(row?.price ?? undefined);
      setListingThumb(row?.listing_images?.[0]?.image_url ?? null);
      setProposals(buildSuggestions(row?.price ?? undefined));
    }
  }

  // Récupère (ou crée) la conversation, en supportant les 2 kinds
  async function ensureConversation(kindHint?: ListingKind): Promise<{ id: string; kind: ListingKind }> {
    const sess = (await supabase.auth.getSession()).data.session;
    const uid = sess?.user?.id;
    if (!uid) throw new Error("Connexion requise. Veuillez vous connecter.");
    if (uid === ownerId) throw new Error("Vous ne pouvez pas négocier avec votre propre annonce.");

    // Retrouver une conv existante quel que soit le kind
    const { data: existing } = await supabase
      .from("conversations")
      .select("id, listing_kind")
      .eq("listing_id", listingId)
      .eq("seller_id", ownerId)
      .eq("buyer_id", uid)
      .in("listing_kind", ["logement", "vehicule"])
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; listing_kind: ListingKind }>();

    if (existing?.id) return { id: existing.id, kind: existing.listing_kind };

    // Sinon déterminer le kind (hint > DB)
    let kind: ListingKind | null = kindHint ?? null;
    if (!kind) kind = await detectKindFromDB(listingId);
    if (!kind) throw new Error("Annonce introuvable (ni logement ni véhicule).");

    // Créer la conversation
    const { data: created, error: cErr } = await supabase
      .from("conversations")
      .insert({
        listing_id: listingId,
        listing_kind: kind,
        buyer_id: uid,
        seller_id: ownerId,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (cErr) throw cErr;
    if (!created?.id) throw new Error("Création de la conversation échouée.");
    return { id: created.id, kind };
  }

  function subscribeToConversation(cid: string): () => void {
    const channel = supabase
      .channel(`messages:conversation=${cid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` },
        (payload) => {
          const msg = payload.new as Message;
          setMsgs((prev) => [...prev, msg]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function bumpConversation(cid: string) {
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", cid);
  }

  async function loadParticipants(cid: string) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", cid)
      .maybeSingle<{ buyer_id: string; seller_id: string }>();

    const ids = [conv?.buyer_id, conv?.seller_id].filter(Boolean) as string[];
    if (!ids.length) return;

    const res = (await supabase
      .from("users")
      .select("id, full_name, name, username, email, phone")
      .in("id", ids)) as unknown as {
      data:
        | { id: string; full_name?: string | null; name?: string | null; username?: string | null; email?: string | null; phone?: string | null }[]
        | null;
    };

    const map: Record<string, { name: string }> = {};
    ids.forEach((id) => {
      const row = res.data?.find((u) => u.id === id) ?? null;
      map[id] = { name: pickDisplayName(row, id === ownerId ? "Vendeur" : "Acheteur") };
    });
    setParticipants(map);
  }

  // Init (session + annonce + conversation + kind)
  useEffect(() => {
    let cleanupAuth: (() => void) | null = null;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      setSession(s.session ?? null);

      // 1) Si on a une conversation → on lit son kind
      if (convFromRoute) {
        const { data: convRow, error } = await supabase
          .from("conversations")
          .select("id, listing_kind")
          .eq("id", convFromRoute)
          .maybeSingle<{ id: string; listing_kind: ListingKind }>();
        if (!error && convRow?.id) {
          setConversationId(convRow.id);
          setListingKind(convRow.listing_kind);
          await loadListingMeta(convRow.listing_kind, listingId);
        }
      } else {
        // 2) Pas de conversation → on détecte le kind par l’ID d’annonce
        const kindDetected = await detectKindFromDB(listingId);
        if (kindDetected) {
          setListingKind(kindDetected);
          await loadListingMeta(kindDetected, listingId);
        } else {
          // fallback visuel si rien trouvé
          setListingTitle(listingTitleFromRoute || "Annonce");
        }

        // 3) Si l’utilisateur est connecté (pas le vendeur), on assure la conversation
        const uid = s.session?.user?.id;
        if (uid && uid !== ownerId) {
          try {
            const { id: cid, kind } = await ensureConversation(kindDetected ?? undefined);
            setConversationId(cid);
            setListingKind(kind);
          } catch (e: any) {
            Alert.alert("Discussion indisponible", e?.message ?? "Erreur inconnue");
          }
        }
      }

      const sub = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess ?? null));
      cleanupAuth = () => sub.data?.subscription.unsubscribe();
    })();
    return () => cleanupAuth?.();
  }, [listingId, ownerId, convFromRoute, listingTitleFromRoute]);

  // Charger messages + Realtime + Participants
  useEffect(() => {
    if (!conversationId) return;
    let stopRealtime: (() => void) | null = null;
    let isCancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!isCancelled) {
        if (error) console.error(error);
        setMsgs((data ?? []) as Message[]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
        setLoading(false);
      }
      await loadParticipants(conversationId);

      // Si on n’a pas encore la meta (ex: arrivé via conv id), recharge la meta avec le kind lu
      if (listingKind) {
        await loadListingMeta(listingKind, listingId);
      } else {
        // on lit le kind depuis la conv
        const { data: convRow } = await supabase
          .from("conversations")
          .select("listing_kind")
          .eq("id", conversationId)
          .maybeSingle<{ listing_kind: ListingKind }>();
        if (convRow?.listing_kind) {
          setListingKind(convRow.listing_kind);
          await loadListingMeta(convRow.listing_kind, listingId);
        }
      }
    })();

    stopRealtime = subscribeToConversation(conversationId);
    return () => {
      isCancelled = true;
      stopRealtime?.();
    };
  }, [conversationId]);

  // Forcer l’ouverture du composer en mode négo (depuis Détails)
  useEffect(() => {
    if (forceOpenNegotiation) {
      setComposerMode("negotiation");
      setComposerOpen(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [forceOpenNegotiation]);

  // Envoi depuis la barre (initial OU réouverture)
  const sendFromComposer = async () => {
    try {
      const n = price;
      if (n <= 0) return;
      const ensured = await ensureConversation(listingKind ?? undefined);
      const cid = ensured.id;
      if (!me) throw new Error("Connexion requise.");

      const lastRejectFromOther = [...msgs]
        .reverse()
        .find(
          (m) =>
            isRejectMsg(m) &&
            m.sender_id !== me &&
            findMsgById(m.meta?.rejected_from)?.sender_id === me
        );
      const isReopen = composerMode === "negotiation" && !!lastRejectFromOther;

      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: cid,
          sender_id: me,
          type: "offer",
          content: isReopen ? `Je négocie pour ${n} XOF` : `Je propose ${n} XOF`,
          price: n,
          meta: isReopen
            ? { negotiation: true, reopened_from: lastRejectFromOther?.meta?.rejected_from ?? null }
            : { kind: "initial_offer" },
        })
        .select("*")
        .single<Message>();

      if (error) throw error;

      setConversationId(cid); // au cas où
      setListingKind(ensured.kind);
      setMsgs((prev) => [...prev, inserted as Message]);
      setPriceText("");
      setComposerOpen(false);
      setComposerMode("initial");
      bumpConversation(cid).catch(() => {});
    } catch (e: any) {
      console.error(e);
      Alert.alert("Oups", e?.message ?? "Impossible d’envoyer la proposition.");
    }
  };

  // Actions sur offre reçue
  const acceptOffer = async (m: Message) => {
    try {
      if (!conversationId || !me) return;
      const baseInsert = {
        conversation_id: conversationId,
        sender_id: me,
        price: m.price,
        meta: { accepted_from: m.id },
      };
      let { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          ...baseInsert,
          type: "offer_accept",
          content: `Offre acceptée à ${euro(m.price || 0)}`,
        })
        .select("*")
        .single<Message>();

      if (error && (error as any).code === "23514") {
        const fb = await supabase
          .from("messages")
          .insert({
            ...baseInsert,
            type: "system",
            content: `Offre acceptée à ${euro(m.price || 0)}`,
            meta: { ...baseInsert.meta, action: "offer_accept" },
          })
          .select("*")
          .single<Message>();
        inserted = fb.data as Message;
      } else if (error) throw error;

      setMsgs((prev) => [...prev, inserted!]);
      bumpConversation(conversationId).catch(() => {});
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Action impossible.");
    }
  };

  const rejectOffer = async (m: Message) => {
    try {
      if (!conversationId || !me) return;
      const baseInsert = {
        conversation_id: conversationId,
        sender_id: me,
        price: m.price,
        meta: { rejected_from: m.id },
      };
      let { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          ...baseInsert,
          type: "offer_reject",
          content: "Offre refusée",
        })
        .select("*")
        .single<Message>();

      if (error && (error as any).code === "23514") {
        const fb = await supabase
          .from("messages")
          .insert({
            ...baseInsert,
            type: "system",
            content: "Offre refusée",
            meta: { ...baseInsert.meta, action: "offer_reject" },
          })
          .select("*")
          .single<Message>();
        inserted = fb.data as Message;
      } else if (error) throw error;

      setMsgs((prev) => [...prev, inserted!]);
      bumpConversation(conversationId).catch(() => {});
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Action impossible.");
    }
  };

  const sendCounterOffer = async () => {
    try {
      if (!conversationId || !me) return;
      const p = Number(negoModal.price.replace(/[^\d]/g, "")) || 0;
      if (p <= 0) {
        Alert.alert("Montant invalide", "Entrez un prix valide.");
        return;
      }
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: me,
          type: "offer",
          content: `Je négocie pour ${p} XOF`,
          price: p,
          meta: { negotiation: true },
        })
        .select("*")
        .single<Message>();
      if (error) throw error;

      setMsgs((prev) => [...prev, inserted!]);
      setNegoModal({ open: false, price: "" });
      bumpConversation(conversationId).catch(() => {});
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Impossible d’envoyer la négociation.");
    }
  };

  // Dérivés d’UI (barre visible ?)
  const lastMsg = last(msgs);
  const hasMyOffer = !!me && msgs.some((m) => m.type === "offer" && m.sender_id === me);
  const showComposer = !isOwner && !isAcceptMsg(lastMsg) && (!hasMyOffer || composerOpen);

  // UI helpers
  const MiniListingCard = () => (
    <TouchableOpacity
      onPress={() =>
        listingKind === "vehicule"
          ? navigation.navigate("VehiculeDetails", { id: listingId })
          : navigation.navigate("LogementDetails", { id: listingId })
      }
      activeOpacity={0.85}
      style={styles.miniCard}
    >
      <View style={styles.miniThumbWrap}>
        {listingThumb ? (
          <Image source={{ uri: listingThumb }} style={styles.miniThumb} />
        ) : (
          <View style={[styles.miniThumb, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Ionicons name="image-outline" size={20} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.miniInfo}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {listingTitle || (listingKind === "vehicule" ? "Véhicule" : "Annonce")}
        </Text>
        {!!listingBasePrice && <Text style={styles.miniPrice}>{euro(Math.round(listingBasePrice))}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </TouchableOpacity>
  );

  const SenderCaption: React.FC<{ uid?: string | null; when: string; align?: "left" | "right" }> = ({
    uid,
    when,
    align = "left",
  }) => (
    <Text style={[styles.caption, { alignSelf: align === "right" ? "flex-end" : "flex-start" }]}>
      {getName(uid)} · {formatWhen(when)}
    </Text>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.sender_id === me;

    if (item.type === "offer") {
      const body = (
        <View style={[styles.offerBubble, { alignSelf: mine ? "flex-end" : "flex-start" }]}>
          <Text style={styles.offerText}>{item.content ?? `Proposition: ${euro(item.price || 0)}`}</Text>
          <MiniListingCard />
          {!!item.price && (
            <View style={styles.offerTotal}>
              <Text style={styles.offerTotalLine}>Total proposé : {euro(item.price)}</Text>
            </View>
          )}
        </View>
      );

      if (!mine) {
        return (
          <View style={{ marginBottom: 12 }}>
            {body}
            <SenderCaption uid={item.sender_id} when={item.created_at} align="left" />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => acceptOffer(item)}>
                <Text style={styles.actionPrimaryText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDark]}
                onPress={() => setNegoModal({ open: true, price: String(item.price || "") })}
              >
                <Text style={styles.actionDarkText}>Négocier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionGhost]} onPress={() => rejectOffer(item)}>
                <Text style={styles.actionGhostText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      return (
        <View style={{ marginBottom: 8 }}>
          {body}
          <SenderCaption uid={item.sender_id} when={item.created_at} align="right" />
        </View>
      );
    }

    // ====== Carte “Offre acceptée” + compte à rebours + Réserver (kind-aware) ======
    if (isAcceptMsg(item)) {
      const iAmBuyer = !isOwner;

      const acceptedAt = new Date(item.created_at).getTime();
      const deadline = acceptedAt + 48 * MS_HOUR;
      const remaining = deadline - now;

      const showReserveBtn = remaining > 0;
      const show24hNotice = remaining > 0 && remaining <= 24 * MS_HOUR;

      return (
        <View style={styles.systemCard}>
          <Text style={styles.systemTitle}>🎉 Offre acceptée</Text>
          <Text style={styles.systemText}>L’offre est acceptée à {euro(item.price || 0)}.</Text>
          <Text style={styles.systemMeta}>par {getName(item.sender_id)} · {formatWhen(item.created_at)}</Text>

          <View style={{ marginTop: 10 }}>
            <MiniListingCard />
          </View>

          {iAmBuyer && showReserveBtn && (
            <Text style={[styles.systemText, { marginTop: 10 }]}>
              ⏳ Temps restant : <Text style={{ fontWeight: "900" }}>{formatRemaining(remaining)}</Text>
            </Text>
          )}

          {iAmBuyer && show24hNotice && (
            <Text style={[styles.systemText, { marginTop: 6 }]}>
              ⚠️ Le bouton <Text style={{ fontWeight: "900" }}>Réserver</Text> disparaîtra dans 24 h.
            </Text>
          )}

          {iAmBuyer && showReserveBtn && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary, { alignSelf: "center", marginTop: 12 }]}
              onPress={() =>
                listingKind === "vehicule"
                  ? (navigation as any).navigate("VehiculeDetails", {
                      id: listingId,
                      resetFromChatReserve: true,
                      negotiatedUnitPrice: item.price || 0,
                    })
                  : (navigation as any).navigate("LogementDetails", {
                      id: listingId,
                      resetFromChatReserve: true,
                      negotiatedUnitPrice: item.price || 0,
                    })
              }
              activeOpacity={0.9}
            >
              <Text style={styles.actionPrimaryText}>Réserver</Text>
            </TouchableOpacity>
          )}

          {iAmBuyer && !showReserveBtn && (
            <Text style={[styles.systemText, { marginTop: 10 }]}>
              ⏰ Délai de 48 h dépassé — le bouton <Text style={{ fontWeight: "900" }}>Réserver</Text> n’est plus disponible.
            </Text>
          )}
        </View>
      );
    }

    if (isRejectMsg(item)) {
      const rejectedMsg = findMsgById(item.meta?.rejected_from);
      const iWasAuthor = rejectedMsg?.sender_id === me;

      return (
        <View style={styles.systemCard}>
          <Text style={styles.systemTitle}>Offre refusée</Text>
          <Text style={styles.systemText}>
            {iWasAuthor ? "Votre offre a été refusée. Voulez-vous proposer une négociation ?" : "Vous avez refusé l’offre."}
          </Text>
          <Text style={styles.systemMeta}>par {getName(item.sender_id)} · {formatWhen(item.created_at)}</Text>

          {iWasAuthor && !isOwner && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDark, { alignSelf: "center", marginTop: 8 }]}
              onPress={() => {
                setComposerMode("negotiation");
                setComposerOpen(true);
                setPriceText(String(rejectedMsg?.price || ""));
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
              }}
            >
              <Text style={styles.actionDarkText}>Proposer une négociation</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // message texte simple
    return (
      <View style={{ marginBottom: 8 }}>
        <View style={[styles.textBubble, { alignSelf: mine ? "flex-end" : "flex-start" }]}>
          <Text style={styles.textBubbleTxt}>{item.content}</Text>
        </View>
        <SenderCaption uid={item.sender_id} when={item.created_at} align={mine ? "right" : "left"} />
      </View>
    );
  };

  return (
    <ImageBackground source={require("../../assets/images/logement2.jpg")} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{listingTitle || (listingKind === "vehicule" ? "Véhicule" : "Discussion")}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Messages */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
            renderItem={renderMessage}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            extraData={now}
          />
        )}

        {/* Barre “proposer un prix” */}
        {!isOwner && showComposer && (
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: "padding", android: undefined })}
            keyboardVerticalOffset={Platform.select({ ios: 24, android: 0 })}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <View style={styles.bottomCard}>
              <View style={styles.chipsRow}>
                {proposals.map((p) => (
                  <TouchableOpacity key={p} style={styles.chip} onPress={() => setPriceText(String(p))}>
                    <Text style={styles.chipText}>{euro(p)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputWrap}>
                <TextInput
                  placeholder={composerMode === "negotiation" ? "Montant de votre négociation…" : "Proposez un prix…"}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={styles.input}
                  keyboardType="number-pad"
                  value={priceText}
                  onChangeText={setPriceText}
                />
              </View>

              <TouchableOpacity
                style={[styles.cta, !canSend && { opacity: 0.5 }]}
                disabled={!canSend}
                onPress={sendFromComposer}
                activeOpacity={0.9}
              >
                <Text style={styles.ctaText}>
                  {price > 0
                    ? composerMode === "negotiation"
                      ? `Négocier ${euro(price)}`
                      : `Proposer ${euro(price)}`
                    : composerMode === "negotiation"
                    ? "Envoyer la négociation"
                    : "Proposer un prix"}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      {/* Modal de négociation */}
      <Modal
        visible={negoModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => setNegoModal({ open: false, price: "" })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Proposer une négociation</Text>

            <View style={[styles.inputWrap, { width: "100%", backgroundColor: "#f2f2f2" }]}>
              <TextInput
                placeholder="Montant (XOF)"
                placeholderTextColor="#999"
                style={[styles.input, { color: "#111" }]}
                value={negoModal.price}
                keyboardType="number-pad"
                onChangeText={(t) => setNegoModal((s) => ({ ...s, price: t }))}
              />
            </View>

            <TouchableOpacity style={styles.modalPrimary} onPress={sendCounterOffer}>
              <Text style={styles.modalPrimaryText}>Envoyer (Je négocie)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalGhost} onPress={() => setNegoModal({ open: false, price: "" })}>
              <Text style={styles.modalGhostText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  safe: { flex: 1 },

  header: {
    height: 48,
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 18,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },

  textBubble: {
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 4,
    maxWidth: "86%",
  },
  textBubbleTxt: { color: "#fff", fontSize: 16, fontWeight: "600" },

  offerBubble: {
    backgroundColor: "rgba(0,0,0,0.70)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 4,
    maxWidth: "90%",
    gap: 10,
  },
  offerText: { color: "#fff", fontSize: 18, fontWeight: "800" },

  caption: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },

  // Mini-card d’annonce
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 8,
    gap: 10,
  },
  miniThumbWrap: {
    borderRadius: 10,
    overflow: "hidden",
    width: 54,
    height: 54,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  miniThumb: { width: "100%", height: "100%" },
  miniInfo: { flex: 1 },
  miniTitle: { color: "#fff", fontWeight: "800" },
  miniPrice: { color: "rgba(255,255,255,0.9)", marginTop: 2, fontWeight: "700" },

  offerTotal: {
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 10,
    borderRadius: 14,
  },
  offerTotalLine: { color: "#fff", fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16 },
  actionPrimary: { backgroundColor: "#000" },
  actionPrimaryText: { color: "#fff", fontWeight: "900" },
  actionDark: { backgroundColor: "rgba(0,0,0,0.55)" },
  actionDarkText: { color: "#fff", fontWeight: "800" },
  actionGhost: { backgroundColor: "rgba(255,255,255,0.14)" },
  actionGhostText: { color: "#111", fontWeight: "800" },

  // Barre du bas
  bottomCard: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12, backgroundColor: "rgba(0,0,0,0.25)" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  chip: { backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  chipText: { color: "#fff", fontWeight: "800" },

  inputWrap: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: { color: "#fff", fontSize: 16, fontWeight: "700" },

  cta: {
    backgroundColor: "#000",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  systemCard: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    marginVertical: 6,
  },
  systemTitle: { fontWeight: "900", color: "#111", fontSize: 15 },
  systemText: { color: "#333", marginTop: 4 },
  systemMeta: { color: "#666", fontSize: 12, marginTop: 4 },

  // Modale négo
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#111", textAlign: "center" },
  modalPrimary: {
    marginTop: 14,
    backgroundColor: "#111",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalPrimaryText: { color: "#fff", fontWeight: "900" },
  modalGhost: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 18 },
  modalGhostText: { color: "#111", fontWeight: "800" },
});
