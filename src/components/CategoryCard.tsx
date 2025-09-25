// src/components/CategoryCard.tsx
import React from "react";
import { TouchableOpacity, ImageBackground, Text, StyleSheet } from "react-native";

type Props = {
  title: string;
  image: any;
  onPress: () => void;
};

export default function CategoryCard({ title, image, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <ImageBackground source={image} style={styles.image} imageStyle={styles.imageRadius}>
        <Text style={styles.title}>{title}</Text>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "45%",
    height: 180,
    margin: 10,
    borderRadius: 20,
    overflow: "hidden",
  },
  image: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
  },
  imageRadius: {
    borderRadius: 20,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
});
