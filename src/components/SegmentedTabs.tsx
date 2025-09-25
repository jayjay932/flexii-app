import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

type Option = "Logements" | "Véhicules" | "Expériences";

export default function SegmentedTabs({
  value,
  onChange,
}: {
  value: Option;
  onChange: (next: Option) => void;
}) {
  const options: Option[] = ["Logements", "Véhicules", "Expériences"];
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.9}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 30,
    padding: 4,
    alignSelf: "center",
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  label: { fontWeight: "700", color: "#222", letterSpacing: 0.2 },
  labelActive: { color: "#111" },
});
