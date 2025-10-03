import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "../screens/WelcomeScreen";
import HomePage from "../screens/HomePage";
import LogementsScreen from "../screens/LogementsScreen";
import LogementDetailsScreen from "../screens/LogementDetailsScreen";
import AllReviewsScreen from "@/src/screens/AllReviewsScreen";
import HostProfileScreen from "../screens/HostProfileScreen";
import ChatScreen from "../screens/ChatScreen";
import AuthSheet from "../screens/AuthSheet";
import ConversationsScreen from "../screens/ConversationsScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import ReservationsScreen from "../screens/ReservationsScreen";
import ReservationDetailsScreen from "../screens/ReservationDetailsScreen";
import ProfileScreen from "@/src/screens/ProfileScreen";   

import MyListingsScreen from "@/src/screens/MyListingsScreen";
import EditListingScreen from "@/src/screens/EditListingScreen";
import OwnerReservationDetailsScreen from "../screens/OwnerReservationDetailsScreen";
import OwnerReservationsScreen from "../screens/OwnerReservationsScreen";
import EarningsScreen from "../screens/EarningsScreen";
import AvailabilityDashboardScreen from "@/src/screens/AvailabilityDashboardScreen";
import AvailabilityCalendarScreen from "@/src/screens/AvailabilityCalendarScreen";
import PublishLogementWizard from "../screens/PublishLogementWizard";
import LogementsFilters from "../screens/LogementsFilters";
import VehiculesScreen from "../screens/VehiculesScreen";
import VehiculeDetailsScreen from "../screens/VehiculeDetailsScreen";
import PublishVehiculeScreen from "../screens/PublishVehiculeScreen";
import ProfileScreenVehicules from "../screens/ProfileScreenVehicules";
import DataSafetyScreen from "../screens/DataSafetyScreen";
import LegalScreen from "../screens/LegalScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import HelpScreen from "../screens/HelpScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import ForgotPasswordSheet from "../screens/ForgotPasswordSheet";


// ..
type Money = "XOF" | "EUR";

type DraftBase = {
  startDate: string;
  endDate: string;
  unitPrice: number;
  addOns?: { id: string; name: string; price: number; pricing_model: string }[];
  selectedAddOnIds?: string[];
  guests?: number;
  currency?: Money;
};


export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Logements: undefined;
  Vehicules: undefined;
  Experiences: undefined;
  PublishLogement: undefined;
  LogementsFilters: undefined;
  legal : undefined;
help :undefined;
DeleteAccount :undefined;
  BookingSummary: { listingId: string; acceptedPrice?: number };
  AllReviews: { listingId: string; title?: string };
Favoris :undefined;
  Chat: {
    listingId: string;
    ownerId: string;
    listingTitle: string;
    conversationId?: string;
    forceOpenNegotiation?: boolean;
  };
  DataSafety :  undefined;

  OwnerReservationDetails: { id: string };

  AuthSheet: undefined;
  Conversations: undefined;
  Profile: undefined;
  profileVehicules: undefined;
  Revenus: undefined;
  ReservationsRecues: undefined;
  AccountSettings: undefined;
  Help: undefined;
  PublicProfile: { id?: string };
  Privacy: undefined;
  MyListings: undefined;
  PublishListing: undefined;
  PublishVehicule: undefined;
  privacy: undefined;

  AvailabilityDashboard: undefined;
  AvailabilityCalendar: {
    kind: "logement" | "vehicule" | "experience";
    id: string;
    title?: string;
    basePrice?: number | null;
    currency?: string | null;
  };

  ForgotPasswordSheet: undefined;

  EditListing: { id: string; kind: "logement" | "vehicule" | "experience" };
  Legal: undefined;

  Explorer: undefined;
  Favorites: undefined;

  // ✅ Checkout accepte logement OU véhicule (rétro-compatible).
  Checkout: {
    draft?: DraftBase & {
      logementId?: string;   // ← reste OK pour tes pages logements
      vehiculeId?: string;   // ← permet tes nouveaux flux véhicules
      experienceId?: string; // (si tu en as besoin plus tard)
    };
    reservationId?: string;
    step?: 1 | 2 | 3;
  };

  VehiculeDetails: {
    id: string;
    resetFromChatReserve?: boolean;
    negotiatedUnitPrice?: number;
    resetFromCheckout?: boolean;
  };

  ExperienceDetails: { id: string };
  ReservationDetails: { id: string };
  Reservations: undefined;

  HostProfile: { hostId: string; hostName?: string; avatarUrl?: string | null };

  LogementDetails: {
    id: string;
    resetFromChatReserve?: boolean;
    negotiatedUnitPrice?: number;
    resetFromCheckout?: boolean;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Home" component={HomePage} />
      <Stack.Screen name="Logements" component={LogementsScreen} />
      <Stack.Screen name="LogementDetails" component={LogementDetailsScreen} />
      <Stack.Screen name="privacy" component={PrivacyScreen} />
      <Stack.Screen name="help" component={HelpScreen} />

      <Stack.Screen
        name="AllReviews"
        component={AllReviewsScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        name="Favoris"
        component={FavoritesScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen name="Conversations" component={ConversationsScreen} />
         <Stack.Screen 
  name="ForgotPasswordSheet" 
  component={ForgotPasswordSheet}
  options={{
    presentation: "modal",
    headerShown: false,
  }}
/>
      

      <Stack.Screen
        name="AuthSheet"
        component={AuthSheet}
        options={{ presentation: "modal", headerShown: false }}
      />

        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />

      

<Stack.Screen name="Reservations" component={ReservationsScreen} options={{ headerShown: false }} />
<Stack.Screen name="ReservationDetails" component={ReservationDetailsScreen} />
<Stack.Screen name="VehiculeDetails" component={VehiculeDetailsScreen} />
    <Stack.Screen
  name="LogementsFilters"
  component={LogementsFilters}
  options={{
    headerShown: false,
    presentation: "transparentModal",
    animation: "slide_from_bottom",
    contentStyle: { backgroundColor: "transparent" },
  }}
/>





<Stack.Screen
  name="Checkout"
  component={CheckoutScreen}
  options={{ headerShown: false }}
/>

<Stack.Screen
  name="DataSafety"
  component={DataSafetyScreen}
  options={{ headerShown: false }}
/>

<Stack.Screen
  name="legal"
  component={LegalScreen}
  options={{ headerShown: false }}
/>


<Stack.Screen name="Experiences" component={LogementsScreen} />
      <Stack.Screen name="Vehicules" component={ VehiculesScreen} />



      <Stack.Screen name="AvailabilityCalendar" component={AvailabilityCalendarScreen} />
      <Stack.Screen name="AvailabilityDashboard" component={AvailabilityDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    


      
<Stack.Screen name="MyListings" component={MyListingsScreen} options={{ headerShown: false }} />
<Stack.Screen name="EditListing" component={EditListingScreen} options={{ headerShown: false }} />




      <Stack.Screen name="HostProfile" component={HostProfileScreen} />
      <Stack.Screen
        name="OwnerReservationDetails"
        component={OwnerReservationDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ReservationsRecues" component={OwnerReservationsScreen} options={{ headerShown: false }} />
      <Stack.Screen
  name="Revenus"
  component={EarningsScreen}
  options={{ headerShown: false }}
/>


<Stack.Screen
  name="PublishLogement"
  component={PublishLogementWizard}
  options={{ headerShown: false, presentation: "modal" }}
/>
<Stack.Screen
  name="PublishVehicule"
  component={PublishVehiculeScreen}
  options={{ headerShown: false, presentation: "modal" }}
/>

    </Stack.Navigator>
  );
}
