// src/screens/PrivacyScreen.tsx
import React, { useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons, { IconName } from '@/src/ui/Icon';;
import { useNavigation } from "@react-navigation/native";

/**
 * Écran de Confidentialité ULTRA DÉTAILLÉ (statique, non interactif)
 * - Conforme App Store Review (Apple) & RGPD (UE) : inventaire par catégories (App Privacy Labels),
 *   finalités, bases légales, durées, partage, transferts, sécurité, droits des personnes, suppression.
 * - Aucun lien cliquable : URLs/contacts sont du texte copiable.
 * - Seul le bouton "Retour" (flèche) est cliquable pour fermer l'écran.
 */

/** ====== Identité & URLs affichées en clair (copiables) ====== */
const CONTROLLER = "Flexii / Flexii House";
const DPO_MAIL = "flexii@flexiihouse.com";       // conseillé pour RGPD
const SUPPORT_MAIL = "flexii@flexiihouse.com";
const TEL = "+33 07 59 89 10 39";

const WEBSITE = "https://www.flexiihouse.com";
const PRIVACY_URL = "https://www.flexiihouse.com/politique-de-confidentialite";
const TERMS_URL = "https://www.flexiihouse.com/legal/terms";
const DELETE_URL = "https://www.flexiihouse.com/delete-account";
const OSS_URL = "https://www.flexiihouse.com/legal/open-source-licenses";
const EULA_APPLE = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"; // référence non cliquable

export default function PrivacyScreen() {
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
      {/* ===== Header avec flèche back ===== */}
      <View style={header.headerContainer} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={header.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="privacy-back-button"
        >
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={header.title} numberOfLines={1}>Confidentialité</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* En-tête & rappel de principe */}
        <Card>
          <H1>Politique de confidentialité – Flexii</H1>
          <Muted selectable>Dernière mise à jour : {lastUpdate}</Muted>
          <P selectable>
            {CONTROLLER} respecte les principes de minimisation et de sécurité des données. Nous ne vendons pas vos
            données. Les accès sensibles (Photos, Caméra, Localisation, Notifications) sont demandés uniquement au
            moment d’usage de la fonctionnalité. Ce document couvre les exigences d’Apple (App Privacy Labels, InfoPlist),
            le RGPD, et les bonnes pratiques de sécurité.
          </P>
         
        </Card>

        {/* Inventaire Apple App Privacy Labels */}
        <Card>
          <H2>1. Inventaire des catégories (format Apple – App Privacy)</H2>
          <Small>
            Déclare ce tableau dans App Store Connect (Privacy) et garde l’alignement avec la collecte effective in-app.
            Aucune finalité de « tracking inter-apps » (ATT) n’est utilisée.
          </Small>

          <DataTable
            title="Catégories & sous-catégories"
            rows={[
              ["Contact Info", "Nom, prénom, e-mail, téléphone (fourni par l’utilisateur)."],
              ["User Content", "Photos/vidéos d’annonces, descriptions, titres (public si annonce publiée)."],
              ["Identifiers", "ID d’appareil aléatoire, token push, identifiants de session."],
              ["Usage Data", "Événements de base (écran, actions clés), performances (si activés)."],
              ["Diagnostics", "Crash logs, erreurs, traces techniques (si activés)."],
              ["Location", "Position approximative/précise (uniquement si l’utilisateur active une feature)."],
            ]}
          />

          <DataTable
            title="Finalités Apple (mapping haut-niveau)"
            rows={[
              ["App Functionality", "Authentification, réservations, messagerie transactionnelle, notifications utiles."],
              ["Analytics", "Stabilité, dépannage, amélioration UX (agrégées/anonymisées si possible)."],
              ["Product Personalization", "Optionnel : suggestions locales si localisation activée."],
            ]}
          />

          <DataTable
            title="Tracking (ATT)"
            rows={[
              ["App Tracking Transparency", "Non utilisé. Aucun suivi inter-apps/publicitaire. Pas d’IDFA."],
              ["SKAdNetwork", "Non applicable par défaut. Si activé, documenter dans App Privacy."],
            ]}
          />
        </Card>

        {/* Matrice Collecte → Finalités → Base légale → Durée → Partage → Contrôles */}
        <Card>
          <H2>2. Matrice complète (Collecte → Finalité → Base légale → Durée → Partage → Contrôles)</H2>

          <Matrix
            title="2.1 Coordonnées & identifiants de compte"
            items={[
              ["Collecte", "Nom, prénom, e-mail, téléphone, avatar (optionnel)."],
              ["Quand", "Inscription, gestion de profil, réservations, support."],
              ["Finalités", "Création/gestion de compte, communication transactionnelle, support."],
              ["Base légale", "Exécution du contrat ; intérêt légitime (support)."],
              ["Durée", "Pendant l’usage + suppression/anonymisation sous 30–90 jours après clôture (backups ~30 jours)."],
              ["Partage", "Hébergeur, e-mailing, auth (sous-traitants). Aucun courtage/vente de données."],
              ["Contrôles", "Éditer profil ; supprimer compte (voir procédure) ; se désabonner de notifications non-essentielles."],
            ]}
          />

          <Matrix
            title="2.2 Contenus utilisateur (annonces & médias)"
            items={[
              ["Collecte", "Photos/vidéos, titres, descriptions, catégories, prix, ville/quartier."],
              ["Quand", "Publication/modification d’une annonce."],
              ["Finalités", "Affichage public ; réservation ; modération anti-fraude."],
              ["Base légale", "Exécution du contrat ; intérêt légitime (intégrité du service)."],
              ["Durée", "Jusqu’à suppression de l’annonce/compte ; caches/backups temporaires."],
              ["Partage", "Stockage images/CDN, serveurs ; visibilité publique si annonce publique."],
              ["Contrôles", "Retirer/modifier l’annonce ; retirer des médias ; supprimer le compte."],
            ]}
          />

          <Matrix
            title="2.3 Messagerie & notifications"
            items={[
              ["Collecte", "Messages liés à une réservation, pièces jointes (si supportées), token push."],
              ["Quand", "Pendant l’usage (chat) ; activation notifications."],
              ["Finalités", "Communication transactionnelle ; alertes utiles (nouveau message, réservation)."],
              ["Base légale", "Exécution du contrat ; consentement pour push."],
              ["Durée", "Durées opérationnelles + obligations légales/litiges."],
              ["Partage", "Prestataire push ; hébergeur ; jamais vendu."],
              ["Contrôles", "Désactiver les push ; supprimer conversation (si UI prévue)."],
            ]}
          />

          <Matrix
            title="2.4 Localisation (désactivée par défaut)"
            items={[
              ["Collecte", "Position approximative/précise selon autorisation OS."],
              ["Quand", "Seulement si l’utilisateur active une fonctionnalité de proximité."],
              ["Finalités", "Pertinence locale (recherche, suggestions)."],
              ["Base légale", "Consentement (autorisation iOS/Android)."],
              ["Durée", "Non conservée au-delà de la feature, hors agrégation anonymisée."],
              ["Partage", "Non partagée hors prestataires techniques indispensables."],
              ["Contrôles", "Révoquer dans Réglages iOS/Android ; toggles in-app si fournis."],
            ]}
          />

          <Matrix
            title="2.5 Données d’usage, diagnostics & identifiants techniques"
            items={[
              ["Collecte", "Événements d’usage, crash logs, ID d’appareil aléatoire, version OS/app."],
              ["Quand", "Pendant l’usage et en cas de crash."],
              ["Finalités", "Stabilité, performances, sécurité, amélioration produit."],
              ["Base légale", "Intérêt légitime ; consentement si analytics non essentiels."],
              ["Durée", "Agrégation/anonymisation quand possible ; sinon durée minimale pour support (≤ 13 mois recommandé)."],
              ["Partage", "Outils crash/monitoring/analytics (sous-traitants)."],
              ["Contrôles", "Opt-out des analytics non essentiels (si UI fournie)."],
            ]}
          />

          <Matrix
            title="2.6 Paiements (si/Quand activés)"
            items={[
              ["Collecte", "Métadonnées de transaction ; tokenisation via prestataire certifié. Aucune carte stockée chez Flexii."],
              ["Quand", "Lors d’un paiement IAP/checkout géré par prestataire."],
              ["Finalités", "Traitement paiement ; prévention fraude ; obligations comptables."],
              ["Base légale", "Exécution du contrat ; obligation légale."],
              ["Durée", "Conformément aux obligations légales (ex. 6–10 ans selon pays)."],
              ["Partage", "Prestataire de paiement ; Apple (IAP) si applicable."],
              ["Contrôles", "Gérer abonnements IAP dans le Compte Apple ; réclamations via support."],
            ]}
          />
        </Card>

        {/* Permissions iOS (InfoPlist) */}
        <Card>
          <H2>3. Permissions iOS (InfoPlist) – formulations d’usage</H2>
          <List
            items={[
              "NSPhotoLibraryUsageDescription : « Flexii a besoin d’accéder à votre photothèque pour ajouter des photos à vos annonces. »",
              "NSPhotoLibraryAddUsageDescription : « Flexii peut enregistrer des images (reçus/export) dans votre photothèque. »",
              "NSCameraUsageDescription : « Flexii utilise la caméra pour prendre des photos de votre logement ou véhicule. »",
              "NSLocationWhenInUseUsageDescription : « Flexii utilise votre position pour améliorer la recherche par proximité. »",
              "NSUserTrackingUsageDescription (si requis) : « Flexii n’effectue pas de suivi publicitaire inter-apps. »",
            ]}
          />
          <Small>
            Déclare ces clés dans Info.plist (ou app.json Expo). Demande l’autorisation uniquement au moment d’usage.
          </Small>
        </Card>

        {/* Sécurité technique & organisationnelle */}
        <Card>
          <H2>4. Sécurité (technique & organisationnelle)</H2>
          <List
            items={[
              "Chiffrement en transit (HTTPS/TLS) ; chiffrement au repos selon le prestataire.",
              "Séparation des environnements (prod/préprod) ; principe du moindre privilège ; rotation des clés.",
              "Journaux d’accès ; alertes d’intrusion ; sauvegardes chiffrées avec rétention limitée.",
              "Revue de code ; correctifs de sécurité ; dépendances monitorées (OSS).",
              "Contrôles organisationnels : gestion des habilitations, clauses de confidentialité employées/prestataires.",
            ]}
          />
        </Card>

        {/* Journalisation & rétention */}
        <Card>
          <H2>5. Journalisation & rétention</H2>
          <P selectable>
            Les logs techniques (accès, erreurs, performances) sont conservés pour la sécurité et le support, avec des
            durées minimales (ex. 7–90 jours) puis rotation/suppression. Les backups ont une rétention limitée
            (ex. ≤ 30 jours) et servent uniquement à la reprise d’activité.
          </P>
        </Card>

        {/* Sous-traitants & transferts internationaux */}
        <Card>
          <H2>6. Sous-traitants & transferts internationaux</H2>
          <P selectable>
            Des sous-traitants techniques (hébergeur cloud, CDN images, e-mailing, push, crash/monitoring) traitent des
            données pour notre compte, selon des clauses de protection (DPA) et mesures adéquates. En cas de transferts
            hors de votre juridiction, des garanties (ex. clauses contractuelles types) et mesures complètent la protection.
          </P>
          <Info selectable>
            Catégories de sous-traitants : hébergeur/DB, stockage images/CDN, e-mailing/support, notifications push,
            crash/monitoring/analytics. La liste détaillée peut être fournie sur demande à : {DPO_MAIL}.
          </Info>
        </Card>

        {/* Droits RGPD et procédure */}
        <Card>
          <H2>7. Vos droits & procédure (RGPD/lois locales)</H2>
          <List
            items={[
              "Accès : recevoir une copie des données traitées vous concernant.",
              "Rectification : corriger les données inexactes.",
              "Suppression : obtenir l’effacement (hors obligations légales).",
              "Opposition/limitation : bloquer certains traitements.",
              "Portabilité : recevoir les données fournies, dans un format structuré.",
              "Retrait du consentement : notifications, Localisation, Photos/Caméra, analytics optionnels.",
            ]}
          />
          <P selectable>
            Délai de réponse : sous 1 mois (prorogeable de 2 mois en cas de complexité). Une vérification d’identité peut être
            requise. Adresse dédiée : {DPO_MAIL}. Support : {SUPPORT_MAIL} • {TEL}.
          </P>
          <Small>
            Conseils iOS : proposer des bascules internes pour analytics/notifications et guider vers Réglages iOS/Android pour révoquer les autorisations OS.
          </Small>
        </Card>

        {/* Suppression de compte (procédure) */}
        <Card>
          <H2>8. Suppression de compte – procédure et délais</H2>
          <DataTable
            title="Étapes & délais"
            rows={[
              ["Initiation", "Via l’écran Compte (si UI prévue) ou via la page (copiable) : " + DELETE_URL],
              ["Vérification", "Confirmation d’identité (e-mail/OTP)."],
              ["Traitement", "Suppression ou anonymisation sous 30 jours (hors obligations légales)."],
              ["Backups", "Effacement progressif lors des cycles de rétention (≈ 30 jours)."],
              ["Exceptions", "Conservation limitée pour obligations légales, litiges, prévention fraude."],
            ]}
          />
        </Card>

        {/* Enfants/mineurs */}
        <Card>
          <H2>9. Utilisateurs mineurs</H2>
          <P selectable>
            L’app n’est pas destinée aux enfants n’ayant pas l’âge requis pour consentir au traitement des données dans
            leur pays/région. Si vous pensez qu’un mineur nous a fourni des données de manière non conforme, écrivez à :
            {` ${DPO_MAIL}`}.
          </P>
        </Card>

        {/* DPIA */}
        <Card>
          <H2>10. Analyses d’impact (DPIA) & réévaluations</H2>
          <P selectable>
            En cas d’introduction de nouveaux traitements susceptibles d’engendrer un risque élevé pour les droits et
            libertés (ex. profilage étendu), une analyse d’impact (DPIA) est réalisée et les mesures nécessaires sont
            mises en œuvre. La politique est revue régulièrement.
          </P>
        </Card>

        {/* SDKs & analytics */}
        <Card>
          <H2>11. SDKs & analytics</H2>
          <P selectable>
            Des SDKs peuvent être intégrés pour la stabilité (crash), la performance et des métriques agrégées.
            Ils ne servent pas à du tracking publicitaire inter-apps. Si des analytics non essentiels sont proposés,
            un opt-out in-app est prévu.
          </P>
        </Card>

        {/* Addendum régional */}
        <Card>
          <H2>12. Addendum régional</H2>
          <List
            items={[
              "UE/EEE : droits RGPD complets ; transferts encadrés par des garanties appropriées.",
              "États-Unis : selon l’État, des droits de confidentialité spécifiques peuvent s’appliquer (accès/suppression/opt-out).",
              "Afrique (ex. Congo) : les lois locales de protection des données peuvent s’appliquer et prévaut l’ordre public local.",
            ]}
          />
        </Card>

        {/* Modification de la politique */}
        <Card>
          <H2>13. Modifications de cette politique</H2>
          <P selectable>
            En cas de mise à jour substantielle (ex. nouvelles finalités, nouveaux SDKs), une information sera fournie dans
            l’app. La date de mise à jour figure en haut de page.
          </P>
        </Card>

        {/* Coordonnées finales */}
        <Card style={styles.mb16}>
          <H2>14. Coordonnées</H2>
          <P selectable>
            Responsable : {CONTROLLER}
            {"\n"}Contact confidentialité : {DPO_MAIL}
            {"\n"}Support : {SUPPORT_MAIL}
            {"\n"}Téléphone : {TEL}
            {"\n"}Site : {WEBSITE}
          </P>
          <Small>(Texte copiable. Aucun lien cliquable.)</Small>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ==================== UI helpers (non interactifs) ==================== */
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
function P({ children, selectable = false }: { children: React.ReactNode; selectable?: boolean }) {
  return (
    <Text style={styles.p} selectable={selectable}>
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
function Muted({ children, selectable = false }: { children: React.ReactNode; selectable?: boolean }) {
  return (
    <Text style={styles.muted} selectable={selectable}>
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
function DataTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <View style={styles.table}>
      <Text style={styles.tableTitle}>{title}</Text>
      {rows.map(([k, v], idx) => (
        <View key={idx} style={[styles.row, idx === 0 && styles.rowFirst]}>
          <Text style={styles.cellKey}>{k}</Text>
          <Text style={styles.cellVal} selectable>
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}
function Matrix({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <View style={styles.matrix}>
      <Text style={styles.matrixTitle}>{title}</Text>
      {items.map(([k, v], idx) => (
        <View key={idx} style={styles.kvRow}>
          <Text style={styles.kvKey}>{k}</Text>
          <Text style={styles.kvVal} selectable>
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ==================== Styles ==================== */
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
  small: { color: "#666", fontSize: 12, lineHeight: 18 },
  muted: { color: "#666", fontSize: 12, marginTop: 4 },

  /* list */
  liRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  liDot: { color: "#111", fontSize: 16, marginTop: 1 },

  /* info box */
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

  /* table */
  table: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 8,
  },
  tableTitle: {
    fontWeight: "900",
    color: "#111",
    padding: 10,
    backgroundColor: "#FCFCFC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  row: {
    flexDirection: "row",
    padding: 10,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  cellKey: { width: 130, fontWeight: "700", color: "#111" },
  cellVal: { flex: 1, color: "#222", lineHeight: 20 },

  /* matrix (key/val stacked) */
  matrix: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: "#FCFCFC",
  },
  matrixTitle: { fontWeight: "900", color: "#111", marginBottom: 8 },
  kvRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  kvKey: { width: 110, color: "#555", fontWeight: "700" },
  kvVal: { flex: 1, color: "#222", lineHeight: 20 },

  mb16: { marginBottom: 16 },
});
