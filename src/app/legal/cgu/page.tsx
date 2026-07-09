import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — TalibCRM",
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

export default function CGUPage() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F1923", marginBottom: 6 }}>Conditions Générales d'Utilisation</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Dernière mise à jour : 9 juillet 2026</p>

      <H2>1. Objet</H2>
      <P>
        Les présentes Conditions Générales d'Utilisation (« CGU ») encadrent l'accès et l'utilisation de la
        plateforme TalibCRM (« le Service »), un logiciel de gestion de la relation prospects et étudiants
        destiné aux établissements d'enseignement et de formation. En créant un compte, vous acceptez sans
        réserve les présentes CGU.
      </P>

      <H2>2. Éditeur du Service</H2>
      <P>
        Le Service est édité par TalibCRM, [raison sociale et forme juridique], immatriculée sous le
        [numéro RCCM / registre], dont le siège est situé à [adresse]. Contact : contact@talibcrm.com.
      </P>

      <H2>3. Création de compte</H2>
      <P>
        L'accès au Service nécessite la création d'un compte. Vous vous engagez à fournir des informations
        exactes et à maintenir la confidentialité de vos identifiants. Une adresse email valide est requise ;
        elle doit être confirmée pour activer l'envoi d'emails et de campagnes. Vous êtes responsable de toute
        activité effectuée depuis votre compte.
      </P>

      <H2>4. Utilisation du Service</H2>
      <P>Vous vous engagez à utiliser le Service dans le respect des lois applicables et à ne pas :</P>
      <ul style={{ paddingLeft: 20, margin: "0 0 12px" }}>
        <LI>envoyer des messages non sollicités (spam) ou frauduleux ;</LI>
        <LI>importer ou traiter des données personnelles sans base légale ni consentement approprié ;</LI>
        <LI>tenter de compromettre la sécurité ou l'intégrité de la plateforme ;</LI>
        <LI>utiliser le Service à des fins illégales ou portant atteinte aux droits de tiers.</LI>
      </ul>
      <P>
        Tout manquement peut entraîner la suspension ou la résiliation du compte, sans préavis en cas d'abus
        avéré (notamment l'envoi massif de messages non sollicités).
      </P>

      <H2>5. Offres et facturation</H2>
      <P>
        Le Service est proposé selon plusieurs offres, dont une offre gratuite (« Essentiel ») et des offres
        payantes. Les caractéristiques et tarifs de chaque offre sont présentés sur la plateforme. Les
        modalités de paiement et de changement d'offre sont convenues au moment de la souscription.
      </P>

      <H2>6. Données et contenus</H2>
      <P>
        Vous conservez la propriété des données que vous importez dans le Service (prospects, étudiants,
        contenus). Vous nous accordez le droit de les héberger et de les traiter dans le seul but de fournir
        le Service. Le traitement des données personnelles est décrit dans notre{" "}
        <a href="/legal/confidentialite" style={{ color: "#0E7C6B", fontWeight: 600, textDecoration: "none" }}>
          Politique de confidentialité
        </a>.
      </P>

      <H2>7. Disponibilité et responsabilité</H2>
      <P>
        Nous mettons en œuvre les moyens raisonnables pour assurer la disponibilité du Service, sans garantie
        d'absence totale d'interruption. Notre responsabilité ne saurait être engagée pour les dommages
        indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le Service.
      </P>

      <H2>8. Résiliation</H2>
      <P>
        Vous pouvez cesser d'utiliser le Service et demander la suppression de votre compte à tout moment.
        Nous nous réservons le droit de suspendre un compte en cas de violation des présentes CGU.
      </P>

      <H2>9. Modifications</H2>
      <P>
        Les présentes CGU peuvent être mises à jour. En cas de modification substantielle, vous en serez
        informé. La poursuite de l'utilisation du Service vaut acceptation de la version en vigueur.
      </P>

      <H2>10. Droit applicable</H2>
      <P>
        Les présentes CGU sont régies par le droit applicable au siège de l'éditeur. Tout litige relève des
        juridictions compétentes de ce ressort, sous réserve des dispositions légales impératives.
      </P>
    </>
  );
}
