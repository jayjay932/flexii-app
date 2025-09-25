import React from "react";
import { View, StyleSheet, ImageBackground, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SearchBar from "@/src/components/SearchBar";
import CategoryCard from "@/src/components/CategoryCard";
import useCategories from "@/src/hooks/useCategories";
import { categoryImages } from "@/src/utils/categoryImages";
import { categoryRoutes } from "@/src/utils/categoryRoutes";

export default function HomePage({ navigation }: any) {
  const { categories, loading } = useCategories();

  return (
    <ImageBackground
      source={require("../../assets/images/logement.jpg")}
      style={styles.background}
    >
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <SearchBar topOffset={72} />

        {loading ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.cardContainer}>
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                title={cat.title}
                image={categoryImages[cat.slug]}
                onPress={() => {
                  const route = categoryRoutes[cat.slug];
                  if (route) {
                    navigation.navigate(route);
                  }
                }}
              />
            ))}
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: "cover" },
  safe: { flex: 1 },
  cardContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 28,
  },
});
