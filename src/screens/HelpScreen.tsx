// src/screens/HelpScreen.tsx
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
 * Écran "Obtenir de l'aide" ultra détaillé
 * - Conforme App Store Review (pas de liens cliquables externes).
 * - Seul le bouton "Retour" est interactif.
 * - Contenu copiable (emails, téléphone, URLs).
 * - Approche "support + produit + dev" : diagnostics, checklists, matrices, gabarits.
 */

/** ===== Coordonnées affichées en clair (non cliquables) ===== */
const SUPPORT_NAME = "Équipe Support Flexii";
const SUPPORT_MAIL = "flexii@flexiihouse.com";
const PRIVACY_MAIL = "privacy@flexiihouse.com";
const TEL = "+33 07 59 89 10 39";
const WEBSITE = "https://www.flexiihouse.com";
const STATUSPAGE = "https://www.flexiihouse.com/status";
const HELP_CENTER = "https://www.flexiihouse.com/support";
const DELETE_URL = "https://www.flexiihouse.com/delete-account";

export default function HelpScreen() {
  const navigation = useNavigation<any>();
  const today = useMemo(
    () =>
      new Date().toLocaleString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  // Infos device (sans lib externe) — utiles au support
  const deviceInfo = useMemo(
    () => ({
      os: Platform.OS,
      osVersion: String(Platform.Version ?? "?"),
      // L’app version peut être passé via props/Context; ici on laisse un champ à compléter par l’utilisateur.
      appVersion: "Renseigner dans le ticket (ex: 1.2.3)",
      network: "Wi-Fi / 4G/5G (à préciser)",
      storageFree: "Espace libre : à préciser",
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
          testID="help-back-button"
        >
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={header.title} numberOfLines={1}>Obtenir de l’aide</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ===== Contenu (statique, non interactif) ===== */}
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <H1>Besoin d’aide ?</H1>
          <Muted selectable>Dernière mise à jour : {today}</Muted>
          <P selectable>
            Cette page vous guide pas à pas pour résoudre un problème, préparer un bon ticket support,
            et comprendre les réglages iOS/Android à vérifier (permissions, réseau, notifications, etc.).
            Pour protéger votre confidentialité, ne communiquez jamais de mots de passe ni de codes 2FA.
          </P>
          <Info selectable>
            Coordonnées support (copier-coller) :
            {"\n"}• Support : {SUPPORT_MAIL}
            {"\n"}• Confidentialité : {PRIVACY_MAIL}
            {"\n"}• Téléphone : {TEL}
            {"\n"}• Centre d’aide : {HELP_CENTER}
            {"\n"}• État du service : {STATUSPAGE}
            {"\n"}• Site : {WEBSITE}
          </Info>
        </Card>

        {/* A. Diagnostic rapide */}
        <Card>
          <H2>A. Diagnostic rapide (checklist)</H2>
          <List
            items={[
              "1) Redémarrez l’app puis l’appareil.",
              "2) Vérifiez la connexion (Wi-Fi/Cellulaire) et essayez un autre réseau.",
              "3) Espace libre suffisant ? (≥ 500 Mo recommandés).",
              "4) Heure & date en automatique (OS) — évite des erreurs de certificats.",
              "5) Mettez l’app à jour depuis l’App Store/Play Store.",
              "6) Vérifiez les autorisations nécessaires (Photos/Caméra/Localisation/Notifications).",
              "7) Essayez en session déconnectée puis reconnectée.",
              "8) Si possible, testez avec un autre compte pour isoler (compte vs. appareil).",
            ]}
          />
        </Card>

        {/* B. Problèmes fréquents (matrices) */}
        <Card>
          <H2>B. Problèmes fréquents & solutions</H2>

          <Matrix
            title="B.1 Connexion / Compte"
            items={[
              ["Symptôme", "Impossible de se connecter, code OTP non reçu, compte bloqué."],
              ["Vérifier", "E-mail/numéro exact, dossier spam, fuseau horaire, clavier auto-correct."],
              ["Actions", "Réinitialiser le mot de passe ; réessayer OTP ; attendre 60 s puis renvoyer ; vérifier numéro."],
              ["Si persiste", `Préparez un ticket (ci-dessous) et écrivez à : ${SUPPORT_MAIL}`],
            ]}
          />

          <Matrix
            title="B.2 Réservation (logement / véhicule / expérience)"
            items={[
              ["Symptôme", "Échec de réservation, prix incorrect, calendrier non à jour."],
              ["Vérifier", "Dates valides, moyen de paiement prêt (si activé), stabilité réseau, mises à jour."],
              ["Actions", "Rafraîchir l’écran, re-sélectionner les dates, vider le cache de recherche (si UI présente)."],
              ["Si persiste", "Fournir ID de l’annonce, captures (si possible), heure approximative du bug."],
            ]}
          />

          <Matrix
            title="B.3 Paiement (si/Quand activé)"
            items={[
              ["Symptôme", "Paiement refusé, reçu non généré, débit en attente."],
              ["Vérifier", "Plafond CB, 3-D Secure, connexion stable, app à jour."],
              ["Actions", "Réessayer ; vérifier l’historique de transactions ; ne pas dupliquer sans certitude."],
              ["Si persiste", "Communiquer le montant, horodatage, 4 derniers chiffres CB (PAS le numéro complet)."],
            ]}
          />

          <Matrix
            title="B.4 Notifications"
            items={[
              ["Symptôme", "Pas d’alerte nouveau message/réservation."],
              ["Vérifier", "Autorisation notifications (OS) ; mode Focus/Ne pas déranger ; token push renouvelé."],
              ["Actions", "Désactiver/activer la permission ; ouvrir l’app (renouvelle le token). Redémarrer l’appareil."],
              ["iOS", "Réglages > Notifications > Flexii : Autoriser | Styles d’alerte à votre convenance."],
            ]}
          />

          <Matrix
            title="B.5 Photos & Caméra"
            items={[
              ["Symptôme", "Impossible d’ajouter des photos, app ne voit pas la photothèque/caméra."],
              ["Vérifier", "Permissions Photos/Caméra ; fichiers trop lourds ; espace libre ; format non supporté."],
              ["Actions", "Autoriser dans Réglages ; réduire la taille ; réessayer une image test."],
              ["iOS", "NSPhotoLibraryUsageDescription / NSCameraUsageDescription doivent refléter le besoin (OK)."],
            ]}
          />

          <Matrix
            title="B.6 Localisation"
            items={[
              ["Symptôme", "Recherche locale non pertinente ou indisponible."],
              ["Vérifier", "Localisation activée pour l’app (Pendant l’utilisation)."],
              ["Actions", "Révoquer puis réautoriser ; vérifier services de localisation globaux iOS/Android."],
              ["Note", "La localisation est optionnelle ; aucune collecte en arrière-plan sans action explicite."],
            ]}
          />
        </Card>

        {/* C. Permissions iOS/Android (rappel non cliquable) */}
        <Card>
          <H2>C. Permissions iOS/Android (rappel)</H2>
          <List
            items={[
              "Photos : pour ajouter des visuels à vos annonces.",
              "Caméra : pour prendre des photos depuis l’app.",
              "Localisation : pour la recherche par proximité (optionnelle).",
              "Notifications : pour les alertes (messages, réservations).",
            ]}
          />
          <Small>
            Sur iOS, les textes InfoPlist décrivent précisément l’usage (Photos, Caméra, Localisation, Notifications).
            Les autorisations ne sont demandées qu’au moment de l’usage.
          </Small>
        </Card>

        {/* D. Réseau & cache */}
        <Card>
          <H2>D. Réseau & cache</H2>
          <List
            items={[
              "Tester un autre réseau (Wi-Fi ↔︎ 4G/5G).",
              "Désactiver VPN/Proxy le cas échéant.",
              "Heure & date en auto (certificats).",
              "Vider le cache (si option exposée en app).",
              "Redémarrer l’appareil après une mise à jour.",
            ]}
          />
        </Card>

        {/* E. Collecte d’informations pour un bon ticket */}
        <Card>
          <H2>E. Préparer un bon ticket support (modèle à copier)</H2>

          <Small>
            Envoyez ce modèle rempli par e-mail au support. Évitez d’envoyer des journaux complets non sollicités ; s’ils sont demandés, suivez les consignes ci-dessous (filtrer/supprimer les données sensibles).
          </Small>
        </Card>

        {/* F. Journaux & crash (sans outils externes) */}
        <Card>
          <H2>F. Journaux, crash & preuves</H2>
          <List
            items={[
              "Notez l’heure exacte (avec fuseau) et l’action effectuée.",
              "Si un message d’erreur apparaît, copiez-le intégralement.",
              "Captures d’écran : recadrez pour exclure des informations sensibles.",
              "Crash : indiquez ce que vous faisiez juste avant.",
            ]}
          />
          <Info selectable>
            À la demande du support, fournissez uniquement les éléments strictement nécessaires (principe de minimisation).
          </Info>
        </Card>

        {/* G. Compte & suppression */}
        <Card>
          <H2>G. Compte & suppression</H2>
          <List
            items={[
              "Suppression du compte : possible (procédure expliquée dans l’app).",
              `URL d’information (copiable) : ${DELETE_URL}`,
              "Délai : suppression/anonymisation sous 30 jours (sauf obligations légales).",
            ]}
          />
          <Small>
            Pour confidentialité/données, contactez : {PRIVACY_MAIL}
          </Small>
        </Card>

        {/* H. Accessibilité */}
        <Card>
          <H2>H. Accessibilité</H2>
          <List
            items={[
              "Textes lisibles, contrastes adaptés autant que possible.",
              "Compatibilité lecteur d’écran (VoiceOver / TalkBack) pour les éléments clés.",
              "Taille de police dynamique (si activée au niveau système).",
            ]}
          />
          <Small>
            Si vous rencontrez une barrière d’accessibilité, décrivez-la précisément au support (composant, action, résultat attendu).
          </Small>
        </Card>

        {/* I. Quand contacter d’urgence l’hôte/le client (hors panne) */}
        <Card style={styles.mb16}>
          <H2>I. Urgences liées à une réservation</H2>
          <List
            items={[
              "Problème d’arrivée / check-in : utilisez la messagerie in-app (si possible) et les coordonnées partagées.",
              "Problème de sécurité : contactez les numéros d’urgence locaux ; informez l’hôte/le client ensuite.",
              "Litige : gardez un ton factuel, fournissez les éléments (photos, horodatages) si nécessaire.",
            ]}
          />
          <Muted>
            Le support produit peut aider au cadre procédural, mais n’intervient pas dans les situations d’urgence.
          </Muted>
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

  /* matrix */
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
