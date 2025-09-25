// src/screens/ChatScreen.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image as RNImage,
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
import { Ionicons } from "@expo/vector-icons";
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

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "xof",
    maximumFractionDigits: 0,
  }).format(n);

const buildSuggestions = (base?: number) => {
  if (!base || base <= 0) return [45, 48, 50, 55];
  const p = Math.round(base);
  return [Math.round(p * 0.9), Math.round(p * 0.95), p, Math.round(p * 1.1)];
};

const isAcceptMsg = (m?: Message | null) =>
  !!m && (m.type === "offer_accept" || (m.type === "system" && m.meta?.action === "offer_accept"));
const isRejectMsg = (m?: Message | null) =>
  !!m && (m.type === "offer_reject" || (m.type === "system" && m.meta?.action === "offer_reject"));

/* ==== FastImage (fallback Image) ==== */
let FastImage: any = RNImage;
try {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    FastImage = require("react-native-fast-image").default;
  }
} catch {
  FastImage = RNImage;
}

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
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<Message>>(null);

  // anti-race pour les chargements init
  const reqSeq = useRef(0);

  // ----- Données annonce -----
  const [listingTitle, setListingTitle] = useState<string>(listingTitleFromRoute || "");
  const [listingBasePrice, setListingBasePrice] = useState<number | undefined>(undefined);
  const [listingThumb, setListingThumb] = useState<string | null>(null);

  // ----- Barre d'offre (ACHETEUR) -----
  const [proposals, setProposals] = useState<number[]>([45, 48, 50, 55]);
  const [priceText, setPriceText] = useState("");
  const price = useMemo(() => Number(priceText.replace(/[^\d]/g, "")) || 0, [priceText]);
  const canSend = price > 0;

  // Contrôle d’ouverture manuelle après refus
  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("initial");

  // ----- Participants (affichage noms) -----
  const [participants, setParticipants] = useState<Record<string, { name: string }>>({});

  // ----- Modal "négocier" -----
  const [negoModal, setNegoModal] = useState<{ open: boolean; price: string }>({ open: false, price: "" });

  // ====== Tick d’horloge pour l’expiration 48h / warning 24h ======
  const MS_MIN = 60_000;
  const MS_HOUR = 60 * MS_MIN;

  // ⚠️ pour limiter les re-rendus: on stocke l’instant dans un ref + state léger
  const nowRef = useRef<number>(Date.now());
  const [now, setNow] = useState<number>(nowRef.current);
  useEffect(() => {
    const id = setInterval(() => {
      nowRef.current = Date.now();
      setNow(nowRef.current); // FlatList est tunée (window/batch) pour que le tick reste cheap
    }, MS_MIN);
    return () => clearInterval(id);
  }, []);
  // ===============================================================

  // Helpers
  const last = useCallback(<T,>(arr: T[]) => (arr.length ? arr[arr.length - 1] : undefined), []);
  const findMsgById = useCallback((id?: string | null) => (id ? msgs.find((m) => m.id === id) : undefined), [msgs]);

  const formatWhen = useCallback((iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const opts: Intl.DateTimeFormatOptions = sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };
    return new Intl.DateTimeFormat("fr-FR", opts).format(d);
  }, []);

  const pickDisplayName = useCallback(
    (
      u:
        | {
            id: string;
            full_name?: string | null;
            name?: string | null;
            username?: string | null;
            email?: string | null;
            phone?: string | null;
          }
        | null,
      fallback: string
    ) => {
      if (!u) return fallback;
      return u.full_name || u.name || u.username || u.email || (u.phone ? `+${u.phone}` : "") || fallback;
    },
    []
  );

  const getName = useCallback(
    (uid?: string | null) => {
      if (!uid) return "—";
      return participants[uid]?.name || (uid === ownerId ? "Vendeur" : uid === me ? "Vous" : "Acheteur");
    },
    [participants, ownerId, me]
  );

  const formatRemaining = useCallback((ms: number) => {
    const clamped = Math.max(0, ms);
    const totalMin = Math.floor(clamped / MS_MIN);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h} h ${m.toString().padStart(2, "0")} min`;
  }, []);

  const ensureConversation = useCallback(async (): Promise<string> => {
    const sess = (await supabase.auth.getSession()).data.session;
    const uid = sess?.user?.id;
    if (!uid) throw new Error("Connexion requise. Veuillez vous connecter.");
    if (uid === ownerId) throw new Error("Vous ne pouvez pas négocier avec votre propre annonce.");

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", uid)
      .maybeSingle<{ id: string }>();
    if (userErr) throw userErr;
    if (!userRow?.id) throw new Error("Profil incomplet : votre fiche utilisateur n’est pas provisionnée (public.users).");

    const { data: found, error: qErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("listing_kind", "logement")
      .eq("buyer_id", uid)
      .eq("seller_id", ownerId)
      .maybeSingle<{ id: string }>();
    if (qErr) throw qErr;
    if (found?.id) return found.id;

    const { data: created, error: cErr } = await supabase
      .from("conversations")
      .insert({
        listing_id: listingId,
        listing_kind: "logement",
        buyer_id: uid,
        seller_id: ownerId,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (cErr) throw cErr;
    if (!created?.id) throw new Error("Création de la conversation échouée.");
    return created.id;
  }, [listingId, ownerId]);

  const subscribeToConversation = useCallback((cid: string) => {
    const channel = supabase
      .channel(`messages:conversation=${cid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` },
        (payload) => {
          const msg = payload.new as Message;
          // dédoublonnage au cas où le RT arrive après notre insert local
          setMsgs((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 36);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const bumpConversation = useCallback(async (cid: string) => {
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", cid);
  }, []);

  const loadParticipants = useCallback(
    async (cid: string) => {
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
          | {
              id: string;
              full_name?: string | null;
              name?: string | null;
              username?: string | null;
              email?: string | null;
              phone?: string | null;
            }[]
          | null;
      };

      const map: Record<string, { name: string }> = {};
      ids.forEach((id) => {
        const row = res.data?.find((u) => u.id === id) ?? null;
        map[id] = { name: pickDisplayName(row, id === ownerId ? "Vendeur" : "Acheteur") };
      });
      setParticipants(map);
    },
    [ownerId, pickDisplayName]
  );

  // Init (session + annonce + conversation)
  useEffect(() => {
    const ticket = ++reqSeq.current;
    let cleanupAuth: (() => void) | null = null;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (ticket !== reqSeq.current) return;
      setSession(s.session ?? null);

      // charge annonce + suggestions
      const { data: row } = await supabase
        .from("listings_logements")
        .select("title, price, listing_images(image_url)")
        .eq("id", listingId)
        .maybeSingle<{ title: string; price: number; listing_images: { image_url: string }[] }>();

      if (ticket !== reqSeq.current) return;

      if (row) {
        startTransition(() => {
          setListingTitle(row.title || listingTitleFromRoute || "Annonce");
          setListingBasePrice(row.price);
          setListingThumb(row.listing_images?.[0]?.image_url ?? null);
          setProposals(buildSuggestions(row.price));
        });
      } else {
        setListingTitle(listingTitleFromRoute || "Annonce");
        setProposals(buildSuggestions(undefined));
      }

      const uid = s.session?.user?.id;
      if (uid && uid !== ownerId && !convFromRoute) {
        try {
          const cid = await ensureConversation();
          if (ticket !== reqSeq.current) return;
          setConversationId(cid);
        } catch (e: any) {
          Alert.alert("Discussion indisponible", e?.message ?? "Erreur inconnue");
        }
      } else if (convFromRoute) {
        setConversationId(convFromRoute);
      }

      const sub = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess ?? null));
      cleanupAuth = () => sub.data?.subscription.unsubscribe();
    })();
    return () => cleanupAuth?.();
  }, [listingId, ownerId, convFromRoute, listingTitleFromRoute, ensureConversation]);

  // Charger messages + Realtime + Participants
  useEffect(() => {
    if (!conversationId) return;
    let stopRealtime: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!cancelled) {
        if (error) console.error(error);
        startTransition(() => setMsgs((data ?? []) as Message[]));
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
        setLoading(false);
      }
      await loadParticipants(conversationId);
    })();

    stopRealtime = subscribeToConversation(conversationId);
    return () => {
      cancelled = true;
      stopRealtime?.();
    };
  }, [conversationId, subscribeToConversation, loadParticipants]);

  // Forcer l’ouverture du composer en mode négo (depuis Détails)
  useEffect(() => {
    if (forceOpenNegotiation) {
      setComposerMode("negotiation");
      setComposerOpen(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [forceOpenNegotiation]);

  const sendFromComposer = useCallback(async () => {
    try {
      const n = price;
      if (n <= 0) return;
      const cid = conversationId ?? (await ensureConversation());
      if (!me) throw new Error("Connexion requise.");

      const lastRejectFromOther = [...msgs]
        .reverse()
        .find(
          (m) =>
            isRejectMsg(m) &&
            m.sender_id !== me &&
            (findMsgById(m.meta?.rejected_from)?.sender_id === me)
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

      startTransition(() => setMsgs((prev) => [...prev, inserted as Message]));
      setPriceText("");
      setComposerOpen(false);
      setComposerMode("initial");
      bumpConversation(cid).catch(() => {});
    } catch (e: any) {
      console.error(e);
      Alert.alert("Oups", e?.message ?? "Impossible d’envoyer la proposition.");
    }
  }, [price, conversationId, ensureConversation, me, msgs, composerMode, findMsgById, bumpConversation]);

  const acceptOffer = useCallback(
    async (m: Message) => {
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

        startTransition(() => setMsgs((prev) => [...prev, inserted!]));
        bumpConversation(conversationId).catch(() => {});
      } catch (e: any) {
        console.error(e);
        Alert.alert("Erreur", e?.message ?? "Action impossible.");
      }
    },
    [conversationId, me, bumpConversation]
  );

  const rejectOffer = useCallback(
    async (m: Message) => {
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

        startTransition(() => setMsgs((prev) => [...prev, inserted!]));
        bumpConversation(conversationId).catch(() => {});
      } catch (e: any) {
        console.error(e);
        Alert.alert("Erreur", e?.message ?? "Action impossible.");
      }
    },
    [conversationId, me, bumpConversation]
  );

  const sendCounterOffer = useCallback(async () => {
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

      startTransition(() => setMsgs((prev) => [...prev, inserted!]));
      setNegoModal({ open: false, price: "" });
      bumpConversation(conversationId).catch(() => {});
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", e?.message ?? "Impossible d’envoyer la négociation.");
    }
  }, [conversationId, me, negoModal.price, bumpConversation]);

  // Dérivés d’UI
  const lastMsg = useMemo(() => last(msgs), [msgs, last]);
  const hasMyOffer = useMemo(() => !!me && msgs.some((m) => m.type === "offer" && m.sender_id === me), [msgs, me]);
  const showComposer = useMemo(
    () => !isOwner && !isAcceptMsg(lastMsg) && (!hasMyOffer || composerOpen),
    [isOwner, lastMsg, hasMyOffer, composerOpen]
  );

  /* ===== Composants mémoïsés légers ===== */
  const MiniListingCard = memo(function MiniListingCardInner({
    onPress,
  }: {
    onPress: () => void;
  }) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.miniCard}>
        <View style={styles.miniThumbWrap}>
          {listingThumb ? (
            <FastImage
              source={{ uri: listingThumb, priority: FastImage.priority?.high }}
              style={styles.miniThumb}
              resizeMode={FastImage.resizeMode?.cover ?? "cover"}
            />
          ) : (
            <View style={[styles.miniThumb, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Ionicons name="image-outline" size={20} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.miniInfo}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {listingTitle || "Annonce"}
          </Text>
          {!!listingBasePrice && <Text style={styles.miniPrice}>{euro(Math.round(listingBasePrice))}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>
    );
  });

  const SenderCaption = memo(function SenderCaptionInner({
    uid,
    when,
    align = "left",
  }: {
    uid?: string | null;
    when: string;
    align?: "left" | "right";
  }) {
    return (
      <Text style={[styles.caption, { alignSelf: align === "right" ? "flex-end" : "flex-start" }]}>
        {getName(uid)} · {formatWhen(when)}
      </Text>
    );
  });

  /* ===== Rendu d’un message (mémo) ===== */
  const MessageItem = memo(function MessageItemInner({
    item,
    meId,
    ownerFlag,
    nowValue,
    onAccept,
    onReject,
    onOpenNego,
    onOpenListing,
  }: {
    item: Message;
    meId: string | null;
    ownerFlag: boolean;
    nowValue: number;
    onAccept: (m: Message) => void;
    onReject: (m: Message) => void;
    onOpenNego: (m: Message) => void;
    onOpenListing: () => void;
  }) {
    const mine = item.sender_id === meId;

    if (item.type === "offer") {
      const body = (
        <View style={[styles.offerBubble, { alignSelf: mine ? "flex-end" : "flex-start" }]}>
          <Text style={styles.offerText}>{item.content ?? `Proposition: ${euro(item.price || 0)}`}</Text>
          <MiniListingCard onPress={onOpenListing} />
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
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => onAccept(item)}>
                <Text style={styles.actionPrimaryText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDark]}
                onPress={() => onOpenNego(item)}
              >
                <Text style={styles.actionDarkText}>Négocier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionGhost]} onPress={() => onReject(item)}>
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

    // ====== Offre acceptée → minuteur / 24h notice / bouton ======
    if (isAcceptMsg(item)) {
      const iAmBuyer = !ownerFlag;
      const acceptedAt = new Date(item.created_at).getTime();
      const deadline = acceptedAt + 48 * MS_HOUR;
      const remaining = deadline - nowValue;

      const showReserveBtn = remaining > 0;
      const show24hNotice = remaining > 0 && remaining <= 24 * MS_HOUR;

      return (
        <View style={styles.systemCard}>
          <Text style={styles.systemTitle}>🎉 Offre acceptée</Text>
          <Text style={styles.systemText}>L’offre est acceptée à {euro(item.price || 0)}.</Text>
          <Text style={styles.systemMeta}>
            par {getName(item.sender_id)} · {formatWhen(item.created_at)}
          </Text>

          <View style={{ marginTop: 10 }}>
            <MiniListingCard onPress={onOpenListing} />
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
              onPress={onOpenListing}
              activeOpacity={0.9}
            >
              <Text style={styles.actionPrimaryText}>Réserver</Text>
            </TouchableOpacity>
          )}

          {iAmBuyer && !showReserveBtn && (
            <Text style={[styles.systemText, { marginTop: 10 }]}>
              ⏰ Délai de 48 h dépassé — le bouton <Text style={{ fontWeight: "900" }}>Réserver</Text> n’est plus
              disponible.
            </Text>
          )}
        </View>
      );
    }

    if (isRejectMsg(item)) {
      return (
        <View style={styles.systemCard}>
          <Text style={styles.systemTitle}>Offre refusée</Text>
          <Text style={styles.systemText}>
            {findMsgById(item.meta?.rejected_from)?.sender_id === meId
              ? "Votre offre a été refusée. Voulez-vous proposer une négociation ?"
              : "Vous avez refusé l’offre."}
          </Text>
          <Text style={styles.systemMeta}>
            par {getName(item.sender_id)} · {formatWhen(item.created_at)}
          </Text>

          {findMsgById(item.meta?.rejected_from)?.sender_id === meId && !ownerFlag && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDark, { alignSelf: "center", marginTop: 8 }]}
              onPress={() => onOpenNego(item)}
              activeOpacity={0.9}
            >
              <Text style={styles.actionDarkText}>Proposer une négociation</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // message texte simple
    const mineAlign = item.sender_id === meId ? "flex-end" : "flex-start";
    return (
      <View style={{ marginBottom: 8 }}>
        <View style={[styles.textBubble, { alignSelf: mineAlign as any }]}>
          <Text style={styles.textBubbleTxt}>{item.content}</Text>
        </View>
        <SenderCaption uid={item.sender_id} when={item.created_at} align={mineAlign === "flex-end" ? "right" : "left"} />
      </View>
    );
  });

  /* ===== Handlers UI mémo ===== */
  const openListing = useCallback(
    () =>
      (navigation as any).navigate("LogementDetails", {
        id: listingId,
        resetFromChatReserve: true,
        negotiatedUnitPrice: msgs.find((m) => isAcceptMsg(m))?.price || 0,
      }),
    [navigation, listingId, msgs]
  );

  const openNegoFromMsg = useCallback((m: Message) => {
    setNegoModal({ open: true, price: String(m.price || "") });
  }, []);

  /* ===== renderItem stable ===== */
  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageItem
        item={item}
        meId={me}
        ownerFlag={!!isOwner}
        nowValue={now}
        onAccept={acceptOffer}
        onReject={rejectOffer}
        onOpenNego={openNegoFromMsg}
        onOpenListing={openListing}
      />
    ),
    [me, isOwner, now, acceptOffer, rejectOffer, openNegoFromMsg, openListing]
  );

  return (
    <ImageBackground source={require("../../assets/images/logement2.jpg")} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{listingTitle || "Discussion"}</Text>
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
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            windowSize={6}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={14}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            // pas de extraData ici (on passe now via props à l’item, donc FlatList rerend seulement les items visibles)
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
