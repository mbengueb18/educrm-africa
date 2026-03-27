"use client";

import { useState, useTransition, useEffect } from "react";
import { generateApiKey, listApiKeys, deleteApiKey } from "@/lib/api-keys";
import { toast } from "sonner";
import {
  Key, Copy, Trash2, Plus, Code, Globe, FileText,
  CheckCircle, Loader2, ArrowLeft, Eye, EyeOff,
} from "lucide-react";
import Link from "next/link";

export default function IntegrationsPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"tracking" | "api" | "widget" | "docs">("tracking");
  const [orgSlug, setOrgSlug] = useState("ism-dakar");

  useEffect(() => {
    listApiKeys().then(setKeys).catch(() => {});
  }, []);

  const handleGenerate = () => {
    if (!newKeyName.trim()) {
      toast.error("Donnez un nom à la clé (ex: 'Site web principal')");
      return;
    }
    startTransition(async () => {
      try {
        const result = await generateApiKey(newKeyName.trim());
        setGeneratedKey(result.key);
        setNewKeyName("");
        const updated = await listApiKeys();
        setKeys(updated);
        toast.success("Clé API générée !");
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleDelete = (keyId: string) => {
    if (!confirm("Supprimer cette clé ? Les formulaires qui l'utilisent cesseront de fonctionner.")) return;
    startTransition(async () => {
      try {
        await deleteApiKey(keyId);
        const updated = await listApiKeys();
        setKeys(updated);
        toast.success("Clé supprimée");
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié !");
  };

  const widgetCode = `<!-- Formulaire EduCRM — Coller sur votre site -->
<div id="educrm-form"></div>
<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.educrm.africa'}/api/widget/form.js?org=${orgSlug}&key=${generatedKey || keys[0]?.prefix?.replace('...', 'VOTRE_CLE') || 'VOTRE_CLE_API'}&type=contact&color=%231B4F72"></script>`;

  const trackingCode = `<!-- Start of EduCRM Tracking Code -->
<script>
  window._ecrmConfig = { apiKey: "${generatedKey || keys[0]?.prefix?.replace('...', 'VOTRE_CLE') || 'VOTRE_CLE_API'}" };
</script>
<script async defer src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.educrm.africa'}/api/t/ecrm.js?id=${orgSlug}"></script>
<!-- End of EduCRM Tracking Code -->`;

  const gtmCode = `<!-- Pour GTM : Ajouter en tant que balise HTML personnalisée -->
<script>
  window._ecrmConfig = { apiKey: "${generatedKey || keys[0]?.prefix?.replace('...', 'VOTRE_CLE') || 'VOTRE_CLE_API'}" };
</script>
<script async defer src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.educrm.africa'}/api/t/ecrm.js?id=${orgSlug}"></script>`;

  const apiExample = `// Exemple d'intégration avec votre site
fetch("${typeof window !== 'undefined' ? window.location.origin : 'https://app.educrm.africa'}/api/leads/ingest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${generatedKey || 'VOTRE_CLE_API'}"
  },
  body: JSON.stringify({
    firstName: "Amadou",
    lastName: "Diallo",
    phone: "+221 77 123 45 67",
    email: "amadou@email.com",
    ville: "Dakar",
    filière: "BTS-CG",
    source: "website",
    formName: "Demande brochure"
  })
})`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Intégrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connectez votre site web pour capturer les leads automatiquement</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: "tracking" as const, label: "Code de suivi", icon: Code },
          { key: "widget" as const, label: "Formulaire embarquable", icon: Globe },
          { key: "api" as const, label: "API & Clés", icon: Key },
          { key: "docs" as const, label: "Documentation", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tracking tab */}
      {activeTab === "tracking" && (
        <div className="space-y-6">
          {/* Main tracking code */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Code size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Code de suivi EduCRM</h3>
                <p className="text-sm text-gray-500">Comme HubSpot — un seul script, capture automatique des formulaires</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 my-4">
              <p className="text-xs text-amber-800">
                Ce script détecte automatiquement toutes les soumissions de formulaire sur votre site et envoie les données vers EduCRM. Il mappe intelligemment les champs (prénom, nom, téléphone, email, filière...) quelle que soit la langue ou le nom du champ. Aucune modification de vos formulaires existants n&apos;est nécessaire.
              </p>
            </div>

            <h4 className="text-sm font-medium text-gray-700 mt-5 mb-2">Installation directe (HTML)</h4>
            <p className="text-xs text-gray-500 mb-2">Collez ce code avant la balise &lt;/head&gt; ou &lt;/body&gt; de votre site :</p>
            <div className="bg-gray-900 rounded-lg p-4 relative group">
              <button
                onClick={() => copyToClipboard(trackingCode)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy size={14} />
              </button>
              <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {trackingCode}
              </pre>
            </div>

            <h4 className="text-sm font-medium text-gray-700 mt-5 mb-2">Installation via Google Tag Manager (GTM)</h4>
            <p className="text-xs text-gray-500 mb-2">Créez une balise HTML personnalisée dans GTM avec ce code, déclenchée sur &quot;All Pages&quot; :</p>
            <div className="bg-gray-900 rounded-lg p-4 relative group">
              <button
                onClick={() => copyToClipboard(gtmCode)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy size={14} />
              </button>
              <pre className="text-sm text-blue-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {gtmCode}
              </pre>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comment ça fonctionne</h3>
            <div className="space-y-4">
              <StepItem number="1" title="Le script se charge sur votre site"
                desc="Il s'initialise silencieusement et écoute les soumissions de formulaires." />
              <StepItem number="2" title="Un visiteur remplit un formulaire"
                desc="Contact, brochure, inscription, peu importe — tout formulaire avec un nom, email ou téléphone est détecté." />
              <StepItem number="3" title="Les champs sont mappés automatiquement"
                desc="Le script reconnaît 'prénom', 'first_name', 'fname', 'your-name'... et les associe au bon champ EduCRM. Fonctionne en français et en anglais." />
              <StepItem number="4" title="Le lead arrive dans votre pipeline"
                desc="En temps réel, dans la colonne 'Nouveau'. Source, page d'origine et nom du formulaire sont enregistrés." />
            </div>
          </div>

          {/* Field mapping */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Mapping des champs</h3>
            <p className="text-sm text-gray-500 mb-4">Le script reconnaît automatiquement ces noms de champs sur vos formulaires :</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Champ EduCRM</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Noms reconnus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <FieldRow field="Prénom" names="firstName, first_name, prenom, prénom, fname, your-name" />
                  <FieldRow field="Nom" names="lastName, last_name, nom, lname, surname, nom_famille" />
                  <FieldRow field="Nom complet" names="name, fullname, full_name, nom_complet (auto-split)" />
                  <FieldRow field="Téléphone" names="phone, téléphone, tel, mobile, portable, your-phone" />
                  <FieldRow field="Email" names="email, e-mail, mail, courriel, your-email" />
                  <FieldRow field="Ville" names="city, ville, town, localite, adresse, address" />
                  <FieldRow field="Filière" names="formation, filière, filière, program, programme, diplome, specialite" />
                  <FieldRow field="Campus" names="campus, site, établissement" />
                  <FieldRow field="Message" names="message, commentaire, comments, question, demande, sujet" />
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">Le script utilise aussi le placeholder et le label associé pour détecter les champs, même si le name/id ne matche pas directement.</p>
          </div>

          {/* Advanced config */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Configuration avancée</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-blue-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{`<!-- Options avancées (avant le script de suivi) -->
<script>
  window._ecrmConfig = {
    apiKey: "ecrm_xxx",
    debug: true,           // Affiche les logs dans la console
    excludeForms: [        // IDs de formulaires à ignorer
      "search-form",
      "newsletter-form"
    ]
  };
</script>`}</pre>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600">Le script ignore automatiquement les formulaires de :</p>
              <div className="flex flex-wrap gap-2">
                {["Recherche", "Connexion", "Inscription compte", "Paiement", "Panier"].map((t) => (
                  <span key={t} className="badge badge-gray text-xs">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* GTM dataLayer */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Événement GTM / dataLayer</h3>
            <p className="text-sm text-gray-500 mb-3">À chaque lead capturé, le script pousse un événement dans le dataLayer :</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-amber-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{`// Événement poussé automatiquement
{
  event: "educrm_lead_captured",
  ecrmLeadId: "clx...",
  ecrmDuplicate: false
}

// Utilisable dans GTM pour déclencher :
// → Conversion Google Ads
// → Événement Facebook Pixel
// → Événement GA4`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Widget tab */}
      {activeTab === "widget" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <Code size={20} className="text-brand-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Formulaire embarquable</h3>
                <p className="text-sm text-gray-500">Copiez ce code et collez-le sur votre site web</p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 relative group">
              <button
                onClick={() => copyToClipboard(widgetCode)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy size={14} />
              </button>
              <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {widgetCode}
              </pre>
            </div>

            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Personnalisation</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Type de formulaire</label>
                  <select className="input text-sm mt-1">
                    <option value="contact">Demande de renseignements</option>
                    <option value="brochure">Téléchargement brochure</option>
                    <option value="rdv">Prise de rendez-vous</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Couleur principale</label>
                  <div className="flex gap-2 mt-1">
                    {["#1B4F72", "#2E86C1", "#27AE60", "#E67E22", "#8E44AD", "#E74C3C"].map((c) => (
                      <button
                        key={c}
                        className="w-8 h-8 rounded-lg border-2 border-transparent hover:border-gray-400 transition-colors"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Aperçu du formulaire</h3>
            <div className="bg-gray-50 rounded-xl p-8 flex items-center justify-center min-h-[400px]">
              <div className="bg-white rounded-xl p-7 border border-gray-200 shadow-sm w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Demande de renseignements</h3>
                <p className="text-sm text-gray-500 mb-5">Institut Supérieur de Management de Dakar</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prénom *</label>
                    <input className="input py-2 text-sm" placeholder="Amadou" disabled />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                    <input className="input py-2 text-sm" placeholder="Diallo" disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone *</label>
                    <input className="input py-2 text-sm" placeholder="+221 77 000 00 00" disabled />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input className="input py-2 text-sm" placeholder="email@exemple.com" disabled />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Filière souhaitée</label>
                  <select className="input py-2 text-sm" disabled>
                    <option>Sélectionner une filière...</option>
                  </select>
                </div>
                <button className="w-full py-2.5 rounded-lg text-white text-sm font-semibold"
                        style={{ backgroundColor: "#1B4F72" }} disabled>
                  Envoyer ma demande
                </button>
                <p className="text-center text-[10px] text-gray-400 mt-4">Propulsé par EduCRM Africa</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API tab */}
      {activeTab === "api" && (
        <div className="space-y-6">
          {/* Generate key */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Clés API</h3>

            {generatedKey && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Clé générée — copiez-la maintenant !</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono text-gray-900 border border-emerald-200 select-all">
                    {generatedKey}
                  </code>
                  <button onClick={() => copyToClipboard(generatedKey)} className="btn-secondary py-2 px-3 text-xs">
                    <Copy size={14} /> Copier
                  </button>
                </div>
                <p className="text-xs text-emerald-700 mt-2">
                  Cette clé ne sera plus affichée. Conservez-la dans un endroit sûr.
                </p>
              </div>
            )}

            <div className="flex gap-3 mb-6">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Nom de la clé (ex: Site web principal)"
                className="input flex-1"
              />
              <button onClick={handleGenerate} disabled={isPending} className="btn-primary whitespace-nowrap">
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Générer
              </button>
            </div>

            {/* Key list */}
            {keys.length > 0 ? (
              <div className="space-y-2">
                {keys.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Key size={16} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{k.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{k.prefix}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{new Date(k.createdAt).toLocaleDateString("fr-FR")}</span>
                      <button onClick={() => handleDelete(k.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Aucune clé API générée</p>
            )}
          </div>

          {/* API example */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Exemple d&apos;appel API</h3>
            <div className="bg-gray-900 rounded-lg p-4 relative group">
              <button
                onClick={() => copyToClipboard(apiExample)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy size={14} />
              </button>
              <pre className="text-sm text-blue-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {apiExample}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Docs tab */}
      {activeTab === "docs" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h3 className="font-semibold text-gray-900">Documentation API</h3>

          <div className="space-y-4">
            <DocSection title="Endpoint" content={`POST /api/leads/ingest`} />

            <DocSection title="Authentification" content={`Header: x-api-key: votre_cle_api
ou
Header: Authorization: Bearer votre_cle_api`} />

            <DocSection title="Format" content={`Content-Type: application/json
ou
Content-Type: application/x-www-form-urlencoded`} />

            <DocSection title="Champs acceptés" content={`Champs obligatoires :
• firstName (ou first_name, prenom) — Prénom
• lastName (ou last_name, nom) — Nom  
• phone (ou téléphone, tel) — Téléphone
  OU email — Au moins un moyen de contact

Champs optionnels :
• email — Adresse email
• whatsapp — Numéro WhatsApp
• city (ou ville) — Ville
• source — Source (website, facebook, instagram, salon, referral...)
• sourceDetail (ou source_detail) — Détail de la source
• filière (ou programCode) — Code filière (ex: BTS-CG)
• campus (ou campusCity) — Ville du campus
• message — Message du prospect
• formName (ou form_name) — Nom du formulaire`} />

            <DocSection title="Réponse succès (201)" content={`{
  "success": true,
  "leadId": "clx...",
  "message": "Lead Amadou Diallo créé avec succès"
}`} />

            <DocSection title="Détection de doublons" content={`Si un lead avec le même téléphone ou email a été créé dans les dernières 24h, l'API retourne un statut 200 avec duplicate: true au lieu de créer un doublon.`} />

            <DocSection title="WordPress" content={`Pour WordPress, ajoutez ce code dans le hook de soumission de votre formulaire Contact Form 7, Gravity Forms ou WPForms. Un plugin dédié sera disponible prochainement.`} />
          </div>
        </div>
      )}
    </div>
  );
}

function DocSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <pre className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100">
        {content}
      </pre>
    </div>
  );
}

function StepItem({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function FieldRow({ field, names }: { field: string; names: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-gray-900">{field}</td>
      <td className="px-3 py-2 text-gray-500"><code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">{names}</code></td>
    </tr>
  );
}
