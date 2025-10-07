import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Pressable,
  StyleProp,
  ViewStyle,
} from "react-native";
import Ionicons from '@/src/ui/Icon';;

type Props = {
  topOffset?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;               // ← ouvre l’onglet Filtres
  placeholder?: string;
};

export default function SearchBar({
  topOffset = 64,
  style,
  onPress,
  placeholder = "Rechercher",
}: Props) {
  const Container: any = onPress ? Pressable : View;

  return (
    <Container
      style={[styles.container, { marginTop: topOffset }, style]}
      {...(onPress ? { onPress, accessibilityRole: "button" } : {})}
    >
      <Ionicons name="search" size={22} color="#444" style={{ marginRight: 10 }} />
      {onPress ? (
        <Text numberOfLines={1} style={styles.fakeInput}>
          {placeholder}
        </Text>
      ) : (
        <TextInput placeholder={placeholder} placeholderTextColor="#666" style={styles.input} returnKeyType="search" />
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 30,
    paddingHorizontal: 16,
    height: 54,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  input: { flex: 1, fontSize: 17, color: "#000" },
  fakeInput: { flex: 1, fontSize: 17, color: "#666", fontWeight: "600" },
});
