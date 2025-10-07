import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from "react-native";
import Ionicons from '@/src/ui/Icon';;
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

/** ====== Liens & contacts ====== */
const EMAIL = "flexii@flexiihouse.com";
const DELETE_URL = "https://flexiihouse.com/delete-account"; // ta page suppression
const PRIVACY_URL = "https://flexiihouse.com/politique-confidentialite"; // ta politique
const HELP_URL = "https://flexiihouse.com/support";

export default function DataSafetyScreen() {
  const navigation = useNavigation<any>();
  const open = (url: string) =>
    Linking.openURL(url).catch(() =>
      Alert.alert("Oups", "Impossible d’ouvrir le lien.")
    );
  const openSettings = () =>
    Linking.openSettings().catch(() =>
      Alert.alert("Oups", "Impossible d’ouvrir les réglages.")
    );

  return (
    <View style={s.root}>
      <HeaderBack title="Données & Partage" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.body}>
        <Lead>
          Cette page détaille **toutes** les données que Flexii peut traiter, les
          **finalités**, la **durée**, les **partages** et vos **droits**. Nous
          ne vendons pas vos données. Les accès sensibles (Photos/Camera, etc.)
          ne sont demandés **que** au moment où vous utilisez la fonctionnalité.
        </Lead>

        {/* 1. Coordonnées */}
        <Section title="Coordonnées (nom, e-mail, téléphone)">
          <Badges collected purpose shared />
          <Bullet title="Quand ?">À la création/gestion de compte, ou quand vous contactez le support.</Bullet>
          <Bullet title="Pourquoi ?">Créer votre compte, vous authentifier, envoyer des notifications liées à l’activité, vous répondre.</Bullet>
          <Bullet title="Partage">Prestataires techniques (hébergement/support e-mail) sous contrat ; aucune vente.</Bullet>
          <Bullet title="Durée">Le temps de l’utilisation du service, puis suppression ou anonymisation dans un délai raisonnable.</Bullet>
          <Controls />
        </Section>

        {/* 2. Contenus utilisateur */}
        <Section title="Contenus fournis (annonces, photos)">
          <Badges collected purpose shared />
          <Bullet title="Quand ?">Quand vous publiez un logement/véhicule/expérience ou ajoutez des photos depuis la photothèque/caméra.</Bullet>
          <Bullet title="Pourquoi ?">Afficher vos annonces, permettre la réservation, prévenir la fraude (ex : vérifs basiques).</Bullet>
          <Bullet title="Partage">Hébergement & stockage d’images (prestataires), jamais vendus. Visibles publiquement si l’annonce est publique.</Bullet>
          <Bullet title="Durée">Jusqu’à suppression de l’annonce ou de votre compte. Les caches/backup peuvent persister brièvement.</Bullet>
          <Controls photos camera />
        </Section>

        {/* 3. Identifiants & notifications */}
        <Section title="Identifiants techniques & Notifications (token push, session)">
          <Badges collected purpose shared />
          <Bullet title="Quand ?">À la connexion et lors de l’activation des notifications.</Bullet>
          <Bullet title="Pourquoi ?">Vous envoyer des alertes utiles (nouveau message, réservation), sécuriser l’accès.</Bullet>
          <Bullet title="Partage">Prestataires de push (ex. services de notifications). Pas de tracking cross-app.</Bullet>
          <Bullet title="Durée">Le temps de l’usage (token régénéré/invalidé au besoin).</Bullet>
          <Controls notifications />
        </Section>

        {/* 4. Données d’usage & diagnostics */}
        <Section title="Usage & Diagnostics (événements de base, crashs)">
          <Badges collected optional purpose shared />
          <Bullet title="Quand ?">Pendant l’utilisation ; crashs en cas d’erreur.</Bullet>
          <Bullet title="Pourquoi ?">Améliorer la stabilité, comprendre les pannes, corriger les bugs.</Bullet>
          <Bullet title="Partage">Outils de crash/diagnostic si activés. Jamais vendus.</Bullet>
          <Bullet title="Durée">Agrégées/anonymisées lorsque possible, sinon conservées le temps nécessaire au support.</Bullet>
          <Controls />
        </Section>

        {/* 5. Localisation */}
        <Section title="Localisation (désactivée par défaut)">
          <Badges optional purpose />
          <Bullet title="Quand ?">Seulement si vous activez une fonctionnalité qui en a besoin (ex. suggestions locales).</Bullet>
          <Bullet title="Pourquoi ?">Améliorer la pertinence (recherche par proximité). Pas de suivi en arrière-plan sans action explicite.</Bullet>
          <Bullet title="Partage">Non partagée à des tiers hors prestataires techniques (seulement pour servir la fonctionnalité).</Bullet>
          <Bullet title="Contrôle">Autorisation système iOS/Android. Vous pouvez la révoquer à tout moment dans les réglages.</Bullet>
          <Controls location />
        </Section>

        {/* 6. Paiements (futur) */}
        <Section title="Paiements (à venir)">
          <Badges purpose />
          <Bullet title="État">Aucun paiement in-app pour l’instant. Quand ce sera actif, nous documenterons : prestataire, données traitées (ex. token de paiement), réclamations/remboursements.</Bullet>
        </Section>

        {/* 7. Ce que nous NE collectons pas par défaut */}
        <Section title="Ce que nous ne collectons pas par défaut">
          <List items={[
            "Contacts / Carnet d’adresses",
            "Microphone (pas d’enregistrement)",
            "Santé, fitness, données sensibles",
            "Historique précis de localisation en arrière-plan"
          ]}/>
        </Section>

        {/* 8. Sécurité */}
        <Section title="Sécurité">
          <List items={[
            "Chiffrement en transit via HTTPS/TLS.",
            "Accès restreint côté serveur et stockage chez prestataires réputés.",
            "Principes de minimisation (seulement les données nécessaires)."
          ]}/>
        </Section>

        {/* 9. Vos droits */}
        <Section title="Vos droits">
          <List items={[
            "Accès / rectification / suppression de vos données.",
            "Portabilité / opposition / limitation conformément aux lois applicables.",
            "Retrait du consentement (ex. Photos/Notifications) via les réglages.",
          ]}/>
        
        </Section>

         <Section title="Suppression de donnée">
          <List items={[
            "pour supprimer vos données veuillez contacter Flexii@flexiihouse.com",
            "vos donnée seront supprimés en 24h",
            "Retrait du consentement (ex. Photos/Notifications) via les réglages.",
          ]}/>
        
        </Section>

        {/* 10. Résumé Apple (purpose strings) */}
        <Section title="Formulations affichées sur iOS (exigences Apple)">
          <List items={[
            "Accès Photos : « Flexii a besoin d’accéder à votre photothèque pour ajouter des photos à vos annonces (ex. photos du logement). »",
            "Ajouter dans Photos : « Flexii peut enregistrer des images générées (ex. reçus/export) dans votre photothèque. »",
            "Caméra : « Flexii utilise la caméra pour prendre des photos de votre logement ou véhicule à publier. »",
          ]}/>
          <Small>
            ⚙️ Assure-toi d’avoir ces textes dans app.json → ios.infoPlist (NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription, NSCameraUsageDescription).
          </Small>
          <ButtonRow>
            <Button icon="settings-outline" label="Ouvrir les réglages" onPress={openSettings} />
          </ButtonRow>
        </Section>

        <FooterNote />
      </ScrollView>
    </View>
  );
}

/* =================== Petits composants UI =================== */

function HeaderBack({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <SafeAreaView edges={["top"]} style={h.styles.headerContainer}>
      <View style={h.styles.headerInner}>
        <TouchableOpacity
          onPress={onBack}
          style={h.styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={h.styles.title} numberOfLines={1}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>
    </SafeAreaView>
  );
}

const h = {
  styles: StyleSheet.create({
    headerContainer: {
      backgroundColor: "#fff",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(0,0,0,0.07)",
    },
    headerInner: {
      height: 52,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: "center", justifyContent: "center", backgroundColor: "#f2f2f2",
    },
    title: { fontSize: 18, fontWeight: "900", color: "#111", flex: 1, textAlign: "center", marginHorizontal: 8 },
  })
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}
function Lead({ children }: { children: React.ReactNode }) {
  return <Text style={s.lead}>{children as any}</Text>;
}
function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletTitle}>• {title}</Text>
      <Text style={s.p}>{children as any}</Text>
    </View>
  );
}
function Badges(props: { collected?: boolean; optional?: boolean; purpose?: boolean; shared?: boolean }) {
  return (
    <View style={s.badges}>
      {props.collected && <Tag kind="ok" label="Collecté" />}
      {props.optional && <Tag kind="info" label="Optionnel / avec consentement" />}
      {props.purpose && <Tag kind="muted" label="Finalités explicites" />}
      {props.shared && <Tag kind="ok" label="Partagé (prestataires), jamais vendu" />}
    </View>
  );
}
function Tag({ kind, label }: { kind: "ok" | "info" | "muted"; label: string }) {
  const stylesBy = {
    ok: { bg: "#E8F9EE", txt: "#127C45" },
    info: { bg: "#E6F1FE", txt: "#0A50C2" },
    muted: { bg: "#F4F4F4", txt: "#555" },
  }[kind];
  return (
    <View style={[s.tag, { backgroundColor: stylesBy.bg }]}>
      <Text style={[s.tagTxt, { color: stylesBy.txt }]}>{label}</Text>
    </View>
  );
}
function List({ items }: { items: string[] }) {
  return (
    <View style={{ padding: 12, gap: 6 }}>
      {items.map((it, i) => (
        <Text key={i} style={s.p}>• {it}</Text>
      ))}
    </View>
  );
}
function Controls(props: { photos?: boolean; camera?: boolean; notifications?: boolean; location?: boolean }) {
  return (
    <View style={s.controls}>
      <Text style={s.controlsTitle}>Vos contrôles</Text>
      <View style={{ gap: 8 }}>
        {(props.photos || props.camera) && (
          <Text style={s.p}>• Autorisations système {Platform.OS === "ios" ? "iOS" : "Android"} (Photos/Camera) modifiables à tout moment dans Réglages.</Text>
        )}
        {props.notifications && <Text style={s.p}>• Activer/désactiver les notifications depuis les Réglages ou dans l’app (si préférence exposée).</Text>}
        {props.location && <Text style={s.p}>• Localisation désactivée par défaut. Si activée, vous pouvez choisir : jamais / pendant l’utilisation.</Text>}
      </View>
    </View>
  );
}
function Actions({
  onPrivacy, onDelete, onHelp, onMail,
}: { onPrivacy: () => void; onDelete: () => void; onHelp: () => void; onMail: () => void }) {
 
}
function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={s.rowBtns}>{children}</View>;
}
function Button({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.9}>
      <Ionicons name={icon} size={16} color="#111" />
      <Text style={s.btnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}
function Small({ children }: { children: React.ReactNode }) {
  return <Text style={s.small}>{children as any}</Text>;
}
function FooterNote() {
  return (
    <Text style={s.footer}>
      Remarque : certaines données sont traitées par nos prestataires uniquement pour fournir la fonctionnalité
      (hébergement, stockage d’images, envoi d’e-mails/push). Nous appliquons la minimisation des données et
      n’effectuons aucun profilage marketing basé sur vos contenus.
    </Text>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 16, paddingBottom: 40 },
  lead: { fontSize: 15, color: "#333", marginBottom: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontWeight: "900", color: "#111", marginBottom: 8, fontSize: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    paddingBottom: 8,
  },
  bullet: { paddingHorizontal: 12, paddingVertical: 8 },
  bulletTitle: { fontWeight: "800", color: "#111", marginBottom: 2 },
  p: { color: "#333", lineHeight: 20 },
  controls: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FCFCFC", borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.06)" },
  controlsTitle: { fontWeight: "800", color: "#111", marginBottom: 6 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tagTxt: { fontWeight: "800", fontSize: 12 },
  rowBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: "#F4F4F4",
  },
  btnTxt: { fontWeight: "800", color: "#111" },
  small: { color: "#666", fontSize: 12, paddingHorizontal: 12, paddingBottom: 10 },
  footer: { color: "#666", fontSize: 12, paddingHorizontal: 12, paddingVertical: 12 },
});
