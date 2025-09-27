import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/src/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export type TabKey = "logements" | "Favoris" | "Voyages" | "Messages" | "Profil";

/** Base height of the visible bar (without device bottom inset) */
export const TABBAR_BASE_HEIGHT = 64; // used by screens to pad their ScrollView

export default function BottomNavBar({
  current,
  onChange,
  onMessagesPress,
  isAuthed,
  onRequireAuth,
  messagesBadge, // nombre réel ou "1+"
}: {
  current: TabKey;
  onChange: (t: TabKey) => void;
  onMessagesPress?: () => void;
  isAuthed?: boolean;
  onRequireAuth?: () => void;
  messagesBadge?: number | string | null;
}) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const GUARD: TabKey[] = ["Favoris", "Voyages", "Messages", "Profil"];

  const [stateAuthed, setStateAuthed] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setStateAuthed(!!data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess: Session | null) => {
      setStateAuthed(!!sess);
    });
    return () => sub?.subscription.unsubscribe();
  }, []);

  const authed = typeof isAuthed === "boolean" ? isAuthed : stateAuthed;

  const Item = ({
    k,
    label,
    icon,
    badgeContent,
  }: {
    k: TabKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    badgeContent?: number | string | null;
  }) => {
    const active = current === k;

    const handlePress = () => {
      if (GUARD.includes(k) && !authed) {
        if (onRequireAuth) onRequireAuth();
        else nav.navigate("AuthSheet");
        return;
      }
      if (k === "Messages" && onMessagesPress) {
        onMessagesPress();
        return;
      }
      onChange(k);
    };

    const displayBadge =
      typeof badgeContent === "number"
        ? badgeContent > 0
          ? badgeContent > 9
            ? "9+"
            : String(badgeContent)
          : null
        : badgeContent || null;

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={handlePress}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={24} color={active ? "#000" : "#8C8C8C"} />
          {k === "Profil" && <View style={styles.badge} />}
          {k === "Messages" && !!displayBadge && (
            <View style={styles.msgBadge}>
              <Text style={styles.msgBadgeTxt}>{displayBadge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View pointerEvents="box-none" style={styles.abs}>
      <View style={styles.bg}>
        <View style={[styles.bar, { paddingBottom: 10 + insets.bottom }]}>
          <Item k="logements" label="Explorer" icon="search" />
          <Item k="logements" label="Favoris" icon="heart-outline" />
          <Item k="Voyages" label="Réservations" icon="airplane-outline" />
          <Item k="Messages" label="Messages" icon="chatbubble-ellipses-outline" badgeContent={messagesBadge ?? null} />
          <Item k="Profil" label="Profil" icon="person-circle-outline" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bg: {
    backgroundColor: "#e9e7e7ff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingTop: 10,
  },
  item: { alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  iconWrap: { position: "relative", height: 25, justifyContent: "center" },
  label: { marginTop: 2, fontSize: 12, color: "#807979ff", fontWeight: "600" },
  labelActive: { color: "#000000ff" },

  badge: {
    position: "absolute",
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#E61E4D",
  },

  msgBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: "#E61E4D",
    alignItems: "center",
    justifyContent: "center",
  },
  msgBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
