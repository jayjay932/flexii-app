import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import useBackground from "../hooks/useBackground";
import { backgroundImages } from "../utils/backgroundImages";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export default function WelcomeScreen({ navigation }: Props) {
  const { image, loading } = useBackground("welcome");

  if (loading) {
    return (
      <View style={[styles.background, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={backgroundImages[image || "logement.jpg"]}
      style={styles.background}
    >
      <View style={styles.container}>
        <Text style={styles.title}>FlexiIi</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.buttonText}>Découvrir</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "700",
    color: "#000",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 30,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
});
