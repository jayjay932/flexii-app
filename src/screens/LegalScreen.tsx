// src/screens/LegalScreen.tsx
import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, Text, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from '@/src/ui/Icon';;
import { useNavigation } from "@react-navigation/native";

/**
 * Écran d'informations juridiques (statique, non interactif)
 * - Conforme App Review Apple : EULA Apple, confidentialité, responsabilités, licences, etc.
 * - AUCUN lien/bouton cliquable dans le contenu (URLs affichées en clair et copiable).
 * - Seul le bouton "Retour" (flèche) est cliquable pour fermer l’écran.
 */

/** ====== Coordonnées & URLs (affichées en clair, non cliquables) ====== */
const MAIL = "flexii@flexiihouse.com";
const TEL = "+33 07 59 89 10 39";

const WEBSITE = "https://www.flexiihouse.com";
const TERMS_URL = "https://www.flexiihouse.com/legal/terms";
const PRIVACY_URL = "https://www.flexiihouse.com/politique-de-confidentialite";
const EULA_URL_APPLE = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"; // EULA standard Apple
const EULA_URL_VENDOR = "https://www.flexiihouse.com/legal/eula"; // EULA éditeur (optionnel)
const OSS_URL = "https://www.flexiihouse.com/legal/open-source-licenses";

export default function LegalScreen() {
  const navigation = useNavigation<any>();
  const lastUpdate = useMemo(
    () =>
      new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* ===== Header avec flèche back en haut à gauche ===== */}
      <View style={header.headerContainer} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={header.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="legal-back-button"
        >
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={header.title} numberOfLines={1}>Informations juridiques</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ===== Contenu légal (statique, non interactif) ===== */}
      <ScrollView contentContainerStyle={styles.body}>
        {/* Titre principal */}
        <View style={styles.card}>
          <Text style={styles.h1} accessibilityRole="header" accessibilityLabel="Informations juridiques Flexii">
            Informations juridiques – Flexii
          </Text>
          <Text style={styles.muted} selectable>
            Dernière mise à jour : {lastUpdate}
          </Text>
          <Text style={[styles.p, styles.mt8]} selectable>
            Cette page rassemble les informations juridiques de l’application Flexii pour répondre aux
            exigences de transparence et de conformité (App Store Review, confidentialité, licences, EULA, etc.).
            Elle s’applique à l’utilisation de l’app et complète les documents publiés sur notre site.
          </Text>
        </View>

        {/* Sommaire (non interactif) */}
        <View style={styles.card}>
          <Text style={styles.h2}>Sommaire (aperçu non interactif)</Text>
          <List
            items={[
              "1. Introduction & portée",
              "2. Conditions d’utilisation (Terms of Service)",
              "3. EULA iOS (EULA standard Apple) + EULA éditeur",
              "4. Confidentialité & conformité (Politique de confidentialité)",
              "5. Propriété intellectuelle & marques",
              "6. Contenu utilisateur & modération",
              "7. Responsabilités, garanties & limitations",
              "8. Disponibilité du service & support",
              "9. Licences open-source",
              "10. Loi applicable & juridiction",
              "11. Coordonnées & signalement",
              "12. Notes spécifiques iOS (exigences App Review)",
            ]}
          />
        </View>

        {/* 1. Introduction */}
        <Section title="1. Introduction & portée">
          <P selectable>
            L’utilisation de l’app Flexii implique l’acceptation de nos Conditions d’utilisation (« Terms ») et de notre
            Politique de confidentialité (« Privacy Policy »). L’app met en relation des hôtes/propriétaires de logements,
            véhicules et expériences avec des voyageurs/clients. Selon votre pays/région, des dispositions locales
            d’ordre public peuvent s’appliquer.
          </P>
          <Info selectable>
            Documents de référence (texte copiable) :
            {"\n"}• Site : {WEBSITE}
            {"\n"}• Conditions d’utilisation : {TERMS_URL}
            {"\n"}• Politique de confidentialité : {PRIVACY_URL}
          </Info>
        </Section>

        {/* 2. Terms */}
        <Section title="2. Conditions d’utilisation (Terms of Service)">
          <P selectable>
            Les Conditions d’utilisation régissent la création et la gestion de compte, les règles d’usage, la publication
            d’annonces, la réservation, la conduite des utilisateurs, les mesures en cas de fraude ou de non-respect, et
            les modalités de résolution des litiges. La version opposable est publiée sur notre site.
          </P>
          <List
            items={[
              "Fournir des informations exactes lors de la création de compte et des réservations ;",
              "Ne pas publier de contenus illicites, contrefaisants ou trompeurs ;",
              "Respecter les lois locales (hébergement, location de véhicules, activités).",
            ]}
          />
          <Mono selectable>Conditions complètes : {TERMS_URL}</Mono>
        </Section>

        {/* 3. EULA */}
        <Section title="3. EULA iOS (EULA standard Apple) + EULA éditeur">
          <P selectable>
            Sur iOS, l’utilisation de l’app est soumise au « Standard Apple End User License Agreement » (EULA).
            Cette licence régit vos droits d’utilisation de l’app et inclut des limitations et exclusions prévues par Apple.
            En complément, Flexii peut fournir son propre EULA éditeur (sans contredire l’EULA Apple).
          </P>
          <List
            items={[
              "Licence non exclusive, non transférable, limitée à un appareil dont vous êtes propriétaire ou contrôlez l’usage ;",
              "Interdiction d’ingénierie inverse lorsque la loi ne l’autorise pas ;",
              "L’app est fournie « en l’état » ; des mises à jour peuvent être publiées.",
            ]}
          />
          <Mono selectable>EULA Apple : {EULA_URL_APPLE}</Mono>
          <Mono selectable>EULA éditeur : {EULA_URL_VENDOR}</Mono>
        </Section>

        {/* 4. Confidentialité */}
        <Section title="4. Confidentialité & conformité (Politique de confidentialité)">
          <P selectable>
            Flexii applique des principes de minimisation des données et ne vend pas vos données. Les accès système
            sensibles (Photos, Caméra, Localisation, Notifications) ne sont demandés qu’au moment de l’usage de la
            fonctionnalité. Les traitements reposent sur l’exécution du service, l’intérêt légitime ou votre consentement,
            selon les cas. Consultez la Politique de confidentialité pour les détails : finalités, durées, partages,
            droits (accès, rectification, suppression, opposition, limitation, portabilité), contact DPO/Privacy.
          </P>
          <Mono selectable>Politique de confidentialité : {PRIVACY_URL}</Mono>
          <Small>
            iOS – InfoPlist (exemples) : NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription,
            NSCameraUsageDescription, NSLocationWhenInUseUsageDescription, etc.
          </Small>
        </Section>

        {/* 5. IP & marques */}
        <Section title="5. Propriété intellectuelle & marques">
          <P selectable>
            L’app, son code, son design, ses marques et logos « Flexii »/« Flexii House » sont protégés par la propriété
            intellectuelle. Vous ne pouvez pas les utiliser sans autorisation écrite. Les contenus (textes, photos) restent
            la propriété de leurs auteurs, sous réserve de la licence d’exploitation nécessaire à l’affichage dans l’app.
          </P>
        </Section>

        {/* 6. UGC */}
        <Section title="6. Contenu utilisateur & modération">
          <List
            items={[
              "Vous garantissez disposer des droits nécessaires sur les contenus publiés (photos, textes).",
              "Nous pouvons retirer, désindexer ou bloquer tout contenu contraire à la loi ou à nos règles.",
              `Signalement d’un abus ou d’une contrefaçon : ${MAIL}`,
            ]}
          />
        </Section>

        {/* 7. Responsabilité */}
        <Section title="7. Responsabilités, garanties & limitations">
          <P selectable>
            Flexii met en relation des utilisateurs et n’est pas partie aux contrats conclus entre eux (sauf disposition
            légale contraire). Dans les limites permises par la loi, nous excluons la responsabilité pour les dommages
            indirects, pertes de profit, pertes de données ou préjudices immatériels. Rien n’exclut la responsabilité en
            cas de faute lourde ou dolosive ou toute responsabilité qui ne peut être exclue par la loi applicable.
          </P>
        </Section>

        {/* 8. Disponibilité & support */}
        <Section title="8. Disponibilité du service & support">
          <List
            items={[
              "Service fourni sans garantie d’absence d’interruption ; des maintenances planifiées peuvent survenir ;",
              `Support : ${MAIL} • ${TEL}`,
              "Vous pouvez désinstaller l’app à tout moment depuis l’App Store / Play Store.",
            ]}
          />
        </Section>

        {/* 9. Open-source */}
        <Section title="9. Licences open-source">
          <P selectable>
            L’app utilise des bibliothèques open-source sous leurs licences respectives. La liste et les textes des licences
            sont publiés sur notre site. Exemples (non limitatifs) : React Native, Expo, react-navigation.
          </P>
          <Mono selectable>Liste des licences : {OSS_URL}</Mono>
        </Section>

        {/* 10. Loi applicable */}
        <Section title="10. Loi applicable & juridiction">
          <P selectable>
            Sauf disposition impérative contraire, la loi applicable et les tribunaux compétents sont ceux précisés dans
            nos Conditions d’utilisation. Les consommateurs peuvent bénéficier de droits supplémentaires dans leur pays
            de résidence habituelle.
          </P>
        </Section>

        {/* 11. Contact */}
        <Section title="11. Coordonnées & signalement">
          <P selectable>
            Courriel : {MAIL}
            {"\n"}
            Téléphone : {TEL}
            {"\n"}
            Site : {WEBSITE}
          </P>
          <Small>
            (Texte copiable, non cliquable — conçu pour être visible aussi par le relecteur App Review.)
          </Small>
        </Section>

        {/* 12. Notes iOS */}
        <Section title="12. Notes spécifiques iOS (conformité App Store Review)">
          <List
            items={[
              "EULA : l’app iOS est couverte par le EULA standard Apple ; si un EULA éditeur existe, il ne doit pas contredire le EULA Apple.",
              "Confidentialité : fournir des justifications claires pour chaque permission (Photos, Caméra, Localisation, Notifications) dans InfoPlist.",
              "Aucune fonctionnalité cachée : pas de contenu ou de comportement différent entre la review et la version publique.",
              "Comptes : fournir un moyen de suppression du compte (dans l’app ou via instructions claires) ; documenter le délai d’effacement.",
              "Paiements : si des achats intégrés sont ajoutés plus tard, documenter clairement le type (IAP/abonnements) et la gestion via le compte Apple.",
              "Liens : pas de lien externe visant à contourner l’IAP pour du contenu numérique payant.",
              "UGC : prévoir un mécanisme de signalement et de modération.",
            ]}
          />
          <Small selectable>Référence EULA Apple : {EULA_URL_APPLE}</Small>
        </Section>

        {/* Pied de page */}
        <View style={[styles.card, styles.mb16]}>
          <Text style={styles.small} selectable>
            Remarque : ce document ne remplace pas un conseil juridique. Pour des cas spécifiques (droit local,
            secteur réglementé), consultez un conseil professionnel.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Header styles ---------- */
const header = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f2",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
});

/* ---------- Sous-composants (non interactifs) ---------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card} accessible accessibilityRole="summary" accessibilityLabel={title}>
      <Text style={styles.h2}>{title}</Text>
      <View style={{ height: 8 }} />
      {children}
    </View>
  );
}

function P({ children, selectable = false }: { children: React.ReactNode; selectable?: boolean }) {
  return (
    <Text style={styles.p} selectable={selectable}>
      {children}
    </Text>
  );
}

function Mono({ children, selectable = false }: { children: React.ReactNode; selectable?: boolean }) {
  return (
    <Text style={styles.mono} selectable={selectable}>
      {children}
    </Text>
  );
}

function Small({ children, selectable = false }: { children: React.ReactNode; selectable?: boolean }) {
  return (
    <Text style={styles.small} selectable={selectable}>
      {children}
    </Text>
  );
}

function Info({ children, selectable = false }: { children: React.ReactNode; selectable?: boolean }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoText} selectable={selectable}>
        {children}
      </Text>
    </View>
  );
}

function List({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((it, i) => (
        <View key={i} style={styles.liRow}>
          <Text style={styles.liDot}>•</Text>
          {typeof it === "string" ? (
            <Text style={styles.p}>{it}</Text>
          ) : (
            <View style={{ flex: 1 }}>{it}</View>
          )}
        </View>
      ))}
    </View>
  );
}

/* ---------- Styles contenus ---------- */
const R = 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 16, paddingBottom: 24 },

  card: {
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: Platform.select({ ios: 0.06, android: 0.08 }),
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },

  h1: { fontSize: 20, fontWeight: "900", color: "#111" },
  h2: { fontSize: 16, fontWeight: "900", color: "#111" },

  p: { fontSize: 14, color: "#222", lineHeight: 20 },

  mono: {
    fontSize: 13,
    color: "#1f2937",
    backgroundColor: "#f7f7f7",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "System",
    }),
    marginTop: 6,
  },

  small: { color: "#666", fontSize: 12, lineHeight: 18 },

  muted: { color: "#666", fontSize: 12, marginTop: 4 },

  liRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  liDot: { color: "#111", fontSize: 16, marginTop: 1 },

  infoBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  infoText: { color: "#1f2937", fontSize: 13.5, lineHeight: 20 },

  mt8: { marginTop: 8 },
  mb16: { marginBottom: 16 },
});
