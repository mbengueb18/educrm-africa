import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — TalibCRM",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F1923", margin: "32px 0 10px" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "#374151", margin: "0 0 12px" }}>{children}</p>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#374151", margin: "0 0 6px" }}>
      <span style={{ color: "#64748B" }}>{k} : </span>
      <strong style={{ color: "#0F1923", fontWeight: 600 }}>{v}</strong>
    </p>
  );
}

export default function MentionsLegalesPage() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F1923", marginBottom: 6 }}>Mentions légales</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Dernière mise à jour : 10 juillet 2026</p>

      <H2>Éditeur du site</H2>
      <Row k="Dénomination commerciale" v="Performance Digital (TalibCRM)" />
      <Row k="Forme juridique" v="Entreprise individuelle" />
      <Row k="Exploitant / Gérant" v="Abdoul Aziz Mbengue" />
      <Row k="NINEA" v="008923220" />
      <Row k="RCCM" v="SN DKR 2024 A 32598" />
      <Row k="Siège social" v="Hann Maristes 1/C, Îlot H, Villa N°75, Dakar, Sénégal" />
      <Row k="Téléphone" v="+221 77 532 03 55" />
      <Row k="Email" v="contact@talibcrm.com" />

      <H2>Directeur de la publication</H2>
      <P>M. Abdoul Aziz Mbengue.</P>

      <H2>Hébergement</H2>
      <P>
        Le Service est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789,
        États-Unis (vercel.com). Les données applicatives et fichiers sont hébergés via <strong>Supabase</strong>
        au sein de l'Union européenne.
      </P>

      <H2>Propriété intellectuelle</H2>
      <P>
        La marque TalibCRM, le logiciel, sa charte graphique et l'ensemble des contenus de la plateforme
        (hors données saisies par les utilisateurs) sont la propriété exclusive de Performance Digital. Toute
        reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable est interdite.
      </P>

      <H2>Contact</H2>
      <P>
        Pour toute question, écrivez à contact@talibcrm.com. Les conditions d'utilisation et le traitement de
        vos données sont détaillés dans nos{" "}
        <a href="/legal/cgu" style={{ color: "#0E7C6B", fontWeight: 600, textDecoration: "none" }}>CGU</a> et notre{" "}
        <a href="/legal/confidentialite" style={{ color: "#0E7C6B", fontWeight: 600, textDecoration: "none" }}>
          Politique de confidentialité
        </a>.
      </P>
    </>
  );
}
