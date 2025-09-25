// src/utils/categoryRoutes.ts

import { RootStackParamList } from "@/src/navigation/RootNavigator";

// Associe chaque slug de catégorie avec une route de ton navigator
export const categoryRoutes: Record<string, keyof RootStackParamList> = {
  logements: "Logements",
  vehicules: "Logements",
  experiences: "Logements",
};
