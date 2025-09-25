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


// ...
export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Logements: undefined;
  Vehicules: undefined;
  Experiences: undefined;
PublishLogement: undefined;
  LogementsFilters: undefined;
  BookingSummary: { listingId: string; acceptedPrice?: number };

  AllReviews: { listingId: string; title?: string };



  // 💬 Chat: on ajoute 2 champs optionnels
  Chat: {
    listingId: string;
    ownerId: string;
    listingTitle: string;
    conversationId?: string;        // ✅ permet d’ouvrir une conv précise

    forceOpenNegotiation?: boolean; // ✅ ouvre le composer en mode négo
  };
  OwnerReservationDetails: { id: string };

  AuthSheet: undefined;
  Conversations: undefined;
  Profile: undefined;
  Revenus: undefined;
  ReservationsRecues: undefined;
  AccountSettings: undefined;
  Help: undefined;
  PublicProfile: { id?: string };
  Privacy: undefined;
  MyListings: undefined;
  PublishListing: undefined;
  AvailabilityDashboard: undefined;
  AvailabilityCalendar: {
    kind: 'logement' | 'vehicule' | 'experience';
    id: string;
    title?: string;
    basePrice?: number | null;
    currency?: string | null;
  };
  
  
  EditListing: { id: string; kind: "logement" | "vehicule" | "experience" };
  Legal: undefined;

  /* Onglets supplémentaires */
  Explorer: undefined;
  Favorites: undefined;

Checkout: {
    // soit on vient avec un draft (rien en BDD)
    draft?: {
      logementId: string;
      startDate: string;
      endDate: string;
      unitPrice: number;
      addOns?: { id: string; name: string; price: number; pricing_model: string }[];
      selectedAddOnIds?: string[];
      guests?: number;
      currency?: "XOF" | "EUR";
    };
    // soit (optionnel) un id existant si tu veux encore supporter l'ancien flux
    reservationId?: string;
    step?: 1 | 2 | 3;
  };
  ReservationDetails: { id: string }; // si tu veux un écran de détail
  Reservations: undefined;
  HostProfile: { hostId: string; hostName?: string; avatarUrl?: string | null };
LogementDetails: {
  id: string;
  resetFromChatReserve?: boolean;   // ouvre le calendrier à l’arrivée depuis chat
  negotiatedUnitPrice?: number;     // prix accepté (par nuit)
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

      <Stack.Screen name="Conversations" component={ConversationsScreen} />

      <Stack.Screen
        name="AuthSheet"
        component={AuthSheet}
        options={{ presentation: "modal", headerShown: false }}
      />

<Stack.Screen name="Reservations" component={ReservationsScreen} options={{ headerShown: false }} />
<Stack.Screen name="ReservationDetails" component={ReservationDetailsScreen} />
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

    </Stack.Navigator>
  );
}
