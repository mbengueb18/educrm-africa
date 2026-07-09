import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — TalibCRM",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F1923", margin: "32px 0 10px" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "#374151", margin: "0 0 12px" }}>{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 14.5, lineHeight: 1.75, color: "#374151", marginBottom: 6 }}>{children}</li>;
}

export default function ConfidentialitePage() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F1923", marginBottom: 6 }}>Politique de confidentialité</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Dernière mise à jour : 9 juillet 2026</p>

      <P>
        Cette politique décrit comment TalibCRM collecte, utilise et protège les données personnelles dans le
        cadre de la fourniture du Service. Elle s'applique aux utilisateurs de la plateforme (personnel des
        établissements) ainsi qu'aux personnes dont les données sont traitées via le Service (prospects,
        étudiants).
      </P>

      <H2>1. Responsable de traitement</H2>
      <P>
        Pour les données de compte des utilisateurs, TalibCRM agit en tant que responsable de traitement. Pour
        les données que vous importez et gérez dans le Service (vos prospects et étudiants), vous êtes
        responsable de traitement et TalibCRM agit comme sous-traitant, pour votre compte et selon vos
        instructions.
      </P>

      <H2>2. Données collectées</H2>
      <ul style={{ paddingLeft: 20, margin: "0 0 12px" }}>
        <LI><strong>Données de compte</strong> : nom, adresse email, téléphone, établissement, mot de passe (stocké de façon chiffrée).</LI>
        <LI><strong>Données de vos contacts</strong> : informations que vous saisissez ou importez sur vos prospects et étudiants.</LI>
        <LI><strong>Données d'usage</strong> : journaux de connexion, actions dans l'application, à des fins de sécurité et d'amélioration du Service.</LI>
      </ul>

      <H2>3. Finalités et base légale</H2>
      <ul style={{ paddingLeft: 20, margin: "0 0 12px" }}>
        <LI>fournir et sécuriser le Service (exécution du contrat) ;</LI>
        <LI>vérifier votre adresse email et prévenir les abus (intérêt légitime) ;</LI>
        <LI>vous adresser des communications liées au Service ;</LI>
        <LI>respecter nos obligations légales.</LI>
      </ul>

      <H2>4. Partage des données</H2>
      <P>
        Nous ne vendons pas vos données. Elles peuvent être partagées avec des prestataires techniques
        strictement nécessaires au fonctionnement du Service, notamment l'hébergement et l'infrastructure
        (Vercel), la base de données et le stockage (Supabase) et l'acheminement des emails (Resend). Ces
        prestataires sont tenus à des obligations de confidentialité et de sécurité.
      </P>

      <H2>5. Conservation</H2>
      <P>
        Les données de compte sont conservées tant que le compte est actif. Les données de vos contacts sont
        conservées tant que vous les maintenez dans le Service. Après clôture du compte, les données sont
        supprimées ou anonymisées dans un délai raisonnable, sous réserve des obligations légales de
        conservation.
      </P>

      <H2>6. Sécurité</H2>
      <P>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées : chiffrement des mots
        de passe, transport sécurisé (HTTPS), cloisonnement des données par organisation et contrôle des accès.
      </P>

      <H2>7. Vos droits</H2>
      <P>
        Conformément à la réglementation applicable en matière de protection des données, vous disposez de
        droits d'accès, de rectification, d'effacement, de limitation et d'opposition. Pour les exercer,
        écrivez à contact@talibcrm.com. Si vous êtes un contact (prospect/étudiant) d'un établissement,
        adressez votre demande à cet établissement, responsable de vos données.
      </P>

      <H2>8. Cookies</H2>
      <P>
        Le Service utilise des cookies strictement nécessaires à l'authentification et au bon fonctionnement
        de la plateforme, ainsi que, le cas échéant, des mesures d'audience internes.
      </P>

      <H2>9. Contact</H2>
      <P>
        Pour toute question relative à cette politique ou au traitement de vos données, contactez-nous à
        l'adresse contact@talibcrm.com.
      </P>
    </>
  );
}
