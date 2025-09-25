// src/services/chat.service.ts
import { supabase } from "@/src/lib/supabase";

/* ------------ Types ------------ */
export type MsgType = "text" | "offer" | "offer_accept" | "offer_reject" | "system";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MsgType;
  content: string | null;
  price: number | null;
  meta: any | null;
  created_at: string;
};

export type ConversationPreview = {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  listingKind: "logement" | "vehicule" | "experience";
  lastMessageAt: string | null;

  // "autre" participant
  other: { id: string; full_name: string; avatar_url: string | null } | null;

  // listing
  listingTitle?: string | null;
  basePrice?: number | null;

  // dernier message (pour actions rapides)
  lastMsgType?: MsgType | null;
  lastMsgSenderId?: string | null;
  lastMsgPrice?: number | null;
  lastMsgText?: string;
};

/* ------------ Utils ------------ */
const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const snippet = (type: MsgType, content: string | null, price: number | null) => {
  switch (type) {
    case "offer": return `Proposition • ${price ? euro(price) : ""}`.trim();
    case "offer_accept": return `✅ Offre acceptée ${price ? `(${euro(price)})` : ""}`.trim();
    case "offer_reject": return "❌ Offre refusée";
    default: return (content ?? "").slice(0, 120);
  }
};

/* ================= LISTE DE TOUTES MES CONVERSATIONS ================= */
export async function listMyConversations(): Promise<ConversationPreview[]> {
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) return [];

  // 1) conversations où je suis buyer ou seller (RLS requis côté DB)
  const { data: convs, error: eConvs } = await supabase
    .from("conversations")
    .select("id,buyer_id,seller_id,listing_id,listing_kind,last_message_at,created_at")
    .order("last_message_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (eConvs) throw eConvs;

  const convIds = (convs ?? []).map((c) => c.id);
  if (!convIds.length) return [];

  // 2) dernier message de chaque conv (ordre desc)
  type PickMsg = { conversation_id: string; sender_id: string; type: MsgType; content: string | null; price: number | null; created_at: string };
  const { data: msgs, error: eMsgs } = await supabase
    .from("messages")
    .select("conversation_id,sender_id,type,content,price,created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  if (eMsgs) throw eMsgs;

  const lastByConv = new Map<string, PickMsg>();
  for (const m of (msgs ?? []) as PickMsg[]) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
  }

  // 3) profils “autre”
  const otherIds = Array.from(
    new Set((convs ?? []).map((c) => (me === c.buyer_id ? c.seller_id : c.buyer_id)))
  );
  const { data: users, error: eUsers } = await supabase
    .from("users")
    .select("id,full_name,avatar_url")
    .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
  if (eUsers) throw eUsers;
  const userMap = new Map(users?.map((u) => [u.id, u]) ?? []);

  // 4) listings (on couvre “logement”; dupliques pour vehicule/experience si besoin)
  const logementIds = Array.from(new Set((convs ?? []).filter(c => c.listing_kind === "logement").map(c => c.listing_id)));
  const { data: logs, error: eLogs } = await supabase
    .from("listings_logements")
    .select("id,title,price,owner_id")
    .in("id", logementIds.length ? logementIds : ["00000000-0000-0000-0000-000000000000"]);
  if (eLogs) throw eLogs;
  const logMap = new Map<string, { title: string; price: number; owner_id: string }>();
  for (const l of logs ?? []) logMap.set(l.id, { title: l.title, price: Number(l.price), owner_id: l.owner_id });

  // 5) assemble
  const out: ConversationPreview[] = (convs ?? []).map((c) => {
    const last = lastByConv.get(c.id);
    const otherId = me === c.buyer_id ? c.seller_id : c.buyer_id;
    const other = userMap.get(otherId) ?? null;
    const li = logMap.get(c.listing_id);
    return {
      id: c.id,
      buyerId: c.buyer_id,
      sellerId: c.seller_id,
      listingId: c.listing_id,
      listingKind: c.listing_kind,
      lastMessageAt: last?.created_at ?? c.last_message_at ?? c.created_at,
      other,
      listingTitle: li?.title ?? null,
      basePrice: li?.price ?? null,
      lastMsgType: last?.type ?? null,
      lastMsgSenderId: last?.sender_id ?? null,
      lastMsgPrice: last?.price ?? null,
      lastMsgText: last ? snippet(last.type, last.content, last.price) : "",
    };
  });

  out.sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
  return out;
}

/* ================= HISTORIQUE D’UNE CONV ================= */
export async function fetchMessages(conversationId: string, limit = 100, before?: string): Promise<Message[]> {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: !before });
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q.limit(limit);
  if (error) throw error;
  const arr = (data ?? []) as Message[];
  return before ? arr.reverse() : arr;
}

/* ================= ENVOIS ================= */
export async function sendText(conversationId: string, content: string) {
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) throw new Error("Connexion requise");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: me, type: "text", content, price: null, meta: null,
  });
  if (error) throw error;
}

export async function sendOffer(conversationId: string, price: number, meta: any = null) {
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) throw new Error("Connexion requise");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: me, type: "offer", content: `Je propose ${price} XOF`, price, meta,
  });
  if (error) throw error;
}

export async function acceptOffer(conversationId: string, offerMessageId: string, price: number) {
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) throw new Error("Connexion requise");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: me, type: "offer_accept",
    content: `Offre acceptée à ${euro(price)}`, price, meta: { accepted_from: offerMessageId },
  });
  if (error) throw error;
}

export async function rejectOffer(conversationId: string, offerMessageId: string, price: number) {
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) throw new Error("Connexion requise");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: me, type: "offer_reject",
    content: `Offre refusée`, price, meta: { rejected_from: offerMessageId },
  });
  if (error) throw error;
}

/* ================= REALTIME ================= */
export function subscribeToConversation(conversationId: string, onInsert: (m: Message) => void) {
  const ch = supabase
    .channel(`conv:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as Message)
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToMany(conversationIds: string[], onInsert: (m: Message) => void) {
  const offs = conversationIds.map((id) => subscribeToConversation(id, onInsert));
  return () => offs.forEach((off) => off());
}
