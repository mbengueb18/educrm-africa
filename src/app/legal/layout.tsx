import Link from "next/link";
import { School } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC" }}>
      <header style={{ borderBottom: "1px solid #e6eaee", background: "#fff" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#0E7C6B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><School size={18} /></div>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#0F1923" }}>TalibCRM</span>
          </Link>
          <nav style={{ display: "flex", gap: 20, fontSize: 13.5, flexWrap: "wrap" }}>
            <Link href="/legal/mentions-legales" style={{ color: "#475569", textDecoration: "none" }}>Mentions légales</Link>
            <Link href="/legal/cgu" style={{ color: "#475569", textDecoration: "none" }}>CGU</Link>
            <Link href="/legal/confidentialite" style={{ color: "#475569", textDecoration: "none" }}>Confidentialité</Link>
            <Link href="/login" style={{ color: "#0E7C6B", textDecoration: "none", fontWeight: 600 }}>Se connecter</Link>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
        <article style={{ background: "#fff", border: "1px solid #e6eaee", borderRadius: 16, padding: "40px 44px" }}>
          {children}
        </article>
      </main>
    </div>
  );
}
