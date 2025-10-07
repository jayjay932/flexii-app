import React from "react";
import { View, TextInput, StyleSheet, ViewStyle } from "react-native";
import Ionicons from '@/src/ui/Icon';;

export default function SearchBar({
  topOffset = 0,
  style,
}: {
  topOffset?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View style={[styles.container, { marginTop: topOffset }, style]}>
      <Ionicons name="search" size={22} color="#444" style={{ marginRight: 10 }} />
      <TextInput
        placeholder="Rechercher"
        placeholderTextColor="#666"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 30,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  input: { flex: 1, fontSize: 17, color: "#000" },
});
