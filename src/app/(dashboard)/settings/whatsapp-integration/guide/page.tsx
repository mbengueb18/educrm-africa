import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ArrowLeft, ExternalLink, CheckCircle, AlertTriangle, Info,
  BookOpen, MessageCircle, Settings, Globe, Lock, Phone,
} from "lucide-react";

export const metadata: Metadata = { title: "Guide installation WhatsApp" };

export default async function WhatsAppGuidePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const webhookUrl = `https://app.talibcrm.com/api/webhooks/whatsapp/${session.user.organizationId}`;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link
          href="/settings/whatsapp-integration"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={20} className="text-emerald-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Guide : Connecter WhatsApp Business
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Tutoriel pas-à-pas pour configurer votre compte WhatsApp Business avec TalibCRM
          </p>
        </div>
      </div>

      {/* Intro */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-900 mb-1">
              Pourquoi cette configuration ?
            </p>
            <p className="text-xs text-emerald-800">
              Pour que vos campagnes WhatsApp partent depuis <strong>votre propre numéro</strong> et avec <strong>votre facturation Meta</strong>, vous devez connecter votre compte WhatsApp Business à TalibCRM. Cette configuration prend environ <strong>30 à 60 minutes</strong> selon votre expérience.
            </p>
          </div>
        </div>
      </div>

      {/* Help banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900">Vous préférez qu'on le fasse pour vous ?</p>
          <p className="text-xs text-amber-800 mt-1">
            Contactez notre support à <a href="mailto:support@talibcrm.com" className="font-semibold underline">support@talibcrm.com</a> et nous configurerons votre intégration WhatsApp à votre place (service inclus dans votre abonnement).
          </p>
        </div>
      </div>

      {/* Pré-requis */}
      <Section number="0" title="Pré-requis" icon={Info}>
        <p className="text-sm text-gray-600 mb-3">
          Avant de commencer, assurez-vous d'avoir :
        </p>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Un <strong>numéro de téléphone</strong> dédié au business (ne peut pas être déjà utilisé sur un compte WhatsApp personnel)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Un compte <strong>Meta Business Manager</strong> (gratuit, créé sur{" "}
              <a
                href="https://business.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline inline-flex items-center gap-0.5"
              >
                business.facebook.com <ExternalLink size={10} />
              </a>
              )
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Une <strong>carte bancaire</strong> pour la facturation Meta (les premiers messages sont gratuits chaque mois)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Une <strong>vérification du business</strong> Meta (peut prendre 1-7 jours)
            </span>
          </li>
        </ul>
      </Section>

      {/* Étape 1 */}
      <Section number="1" title="Créer un WhatsApp Business Account (WABA)" icon={MessageCircle}>
        <p className="text-sm text-gray-600 mb-3">
          Dans Meta Business Manager, vous allez créer un compte WhatsApp Business et y ajouter votre numéro.
        </p>

        <NumberedList>
          <li>
            Connectez-vous à{" "}
            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline inline-flex items-center gap-0.5"
            >
              business.facebook.com <ExternalLink size={10} />
            </a>
          </li>
          <li>
            Dans le menu <strong>Paramètres</strong> → <strong>Comptes WhatsApp Business</strong> → click <strong>Ajouter</strong>
          </li>
          <li>
            Créez un compte WABA avec un nom (ex : "BEM Africa - Communications")
          </li>
          <li>
            Cliquez sur <strong>"Ajouter un numéro de téléphone"</strong>
          </li>
          <li>
            Saisissez votre numéro pro et choisissez <strong>SMS</strong> ou <strong>appel vocal</strong> pour la vérification
          </li>
          <li>
            Entrez le code de vérification reçu
          </li>
        </NumberedList>

        <Callout type="warning">
          ⚠️ <strong>Important</strong> : Le numéro choisi doit être dédié à WhatsApp Business. Si vous l'utilisez déjà sur WhatsApp personnel ou WhatsApp Business app, vous devrez d'abord supprimer votre compte WhatsApp existant sur ce numéro.
        </Callout>
      </Section>

      {/* Étape 2 */}
      <Section number="2" title="Créer une App Meta" icon={Settings}>
        <p className="text-sm text-gray-600 mb-3">
          Maintenant on va créer une "app" Meta qui sera le pont entre votre WABA et TalibCRM.
        </p>

        <NumberedList>
          <li>
            Allez sur{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline inline-flex items-center gap-0.5"
            >
              developers.facebook.com/apps <ExternalLink size={10} />
            </a>
          </li>
          <li>
            Click <strong>"Create App"</strong>
          </li>
          <li>
            Choisissez le type <strong>"Other"</strong> puis <strong>"Business"</strong>
          </li>
          <li>
            Nom de l'app : ex. "TalibCRM - BEM Africa" (ce nom n'est pas visible publiquement)
          </li>
          <li>
            Sélectionnez votre <strong>Business Manager</strong> dans la liste
          </li>
          <li>
            Une fois l'app créée, dans le dashboard, click <strong>"Add Product"</strong> → ajouter <strong>WhatsApp</strong>
          </li>
        </NumberedList>
      </Section>

      {/* Étape 3 */}
      <Section number="3" title="Récupérer les identifiants" icon={Lock}>
        <p className="text-sm text-gray-600 mb-3">
          Vous allez maintenant récupérer 4 identifiants à coller dans TalibCRM.
        </p>

        <FieldGuide
          title="Phone Number ID"
          where="WhatsApp → API Setup → section 'Phone numbers'"
          example="123456789012345"
          help="Long nombre à côté de votre numéro de téléphone. Cliquez sur l'icône copier."
        />

        <FieldGuide
          title="WhatsApp Business Account ID"
          where="WhatsApp → API Setup → en haut, dans la section 'Send and receive messages'"
          example="987654321098765"
          help="Long nombre à côté de 'WhatsApp Business Account ID'."
        />

        <FieldGuide
          title="App Secret"
          where="App Settings → Basic → champ 'App Secret'"
          example="abc123def456abc123def456abc123def"
          help="Cliquez sur 'Show' pour le révéler. C'est ce qui sécurise les webhooks."
        />

        <FieldGuide
          title="Access Token (le plus important — et le plus complexe)"
          where="Voir étape 4 ci-dessous"
          example="EAAxxxxxxxxxxxxxxxxxxxxxx"
          help="Pour des raisons de sécurité, Meta exige de créer un 'System User' pour générer un token permanent. Suivez l'étape 4."
        />
      </Section>

      {/* Étape 4 */}
      <Section number="4" title="Générer un Access Token permanent" icon={Lock}>
        <Callout type="info">
          ℹ️ <strong>Pourquoi un token permanent ?</strong> Les tokens temporaires expirent après 24h. Pour que TalibCRM fonctionne en continu, il faut un token permanent généré via un "System User" dans Meta Business Manager.
        </Callout>

        <NumberedList>
          <li>
            Allez sur{" "}
            <a
              href="https://business.facebook.com/settings/system-users"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline inline-flex items-center gap-0.5"
            >
              business.facebook.com/settings/system-users <ExternalLink size={10} />
            </a>
          </li>
          <li>
            Click <strong>"Add"</strong> → créer un System User avec rôle <strong>"Admin"</strong>
          </li>
          <li>
            Nom : ex. "TalibCRM Integration"
          </li>
          <li>
            Une fois créé, sélectionnez-le → <strong>"Add Assets"</strong>
          </li>
          <li>
            Ajoutez votre <strong>WhatsApp Business Account</strong> avec <strong>contrôle total</strong>
          </li>
          <li>
            Ajoutez aussi votre <strong>App Meta</strong> avec contrôle total
          </li>
          <li>
            Maintenant cliquez sur <strong>"Generate New Token"</strong>
          </li>
          <li>
            Sélectionnez votre app Meta dans la liste
          </li>
          <li>
            Cochez les permissions suivantes :
            <PermissionsList />
          </li>
          <li>
            Choisissez <strong>"Never"</strong> pour la date d'expiration
          </li>
          <li>
            Cliquez sur <strong>"Generate Token"</strong> et <strong>copiez-le immédiatement</strong> (vous ne pourrez plus le voir après)
          </li>
        </NumberedList>

        <Callout type="warning">
          ⚠️ <strong>Stockez ce token en sécurité</strong>. Si vous le perdez, vous devrez en générer un nouveau et reconfigurer TalibCRM.
        </Callout>
      </Section>

      {/* Étape 5 */}
      <Section number="5" title="Configurer le webhook" icon={Globe}>
        <p className="text-sm text-gray-600 mb-3">
          Maintenant on indique à Meta où envoyer les notifications (messages reçus, statuts d'envoi).
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-blue-900 mb-2">Votre URL Webhook unique :</p>
          <code className="block bg-white border border-blue-200 rounded px-3 py-2 text-xs font-mono text-gray-700 break-all">
            {webhookUrl}
          </code>
        </div>

        <NumberedList>
          <li>
            Dans votre App Meta → <strong>WhatsApp</strong> → <strong>Configuration</strong> → section <strong>Webhook</strong>
          </li>
          <li>
            Click <strong>"Edit"</strong>
          </li>
          <li>
            <strong>Callback URL</strong> : collez l'URL ci-dessus
          </li>
          <li>
            <strong>Verify Token</strong> : créez un mot-clé secret de votre choix (ex : <code className="bg-gray-100 px-1 rounded">talibcrm_xyz123</code>). <strong>Notez-le bien</strong>, vous le saisirez aussi dans TalibCRM.
          </li>
          <li>
            Click <strong>"Verify and Save"</strong>
          </li>
          <li>
            Une fois vérifié, dans <strong>"Webhook fields"</strong>, abonnez-vous à <strong>messages</strong> (en cliquant sur "Subscribe")
          </li>
        </NumberedList>

        <Callout type="warning">
          ⚠️ <strong>Si la vérification échoue</strong> avec le message "The URL couldn't be validated", vérifiez que vous avez bien sauvegardé l'intégration dans TalibCRM <strong>avant</strong> de tenter la vérification côté Meta. C'est TalibCRM qui valide le Verify Token.
        </Callout>
      </Section>

      {/* Étape 6 */}
      <Section number="6" title="Saisir les identifiants dans TalibCRM" icon={CheckCircle}>
        <p className="text-sm text-gray-600 mb-3">
          La dernière étape ! Vous avez maintenant tous les éléments pour configurer TalibCRM.
        </p>

        <NumberedList>
          <li>
            Retournez sur{" "}
            <Link
              href="/settings/whatsapp-integration"
              className="text-emerald-600 hover:underline font-semibold"
            >
              la page Intégration WhatsApp
            </Link>
          </li>
          <li>
            Saisissez chaque champ :
            <ul className="ml-4 mt-1 space-y-1 text-xs">
              <li>• <strong>Phone Number ID</strong> (récupéré étape 3)</li>
              <li>• <strong>WhatsApp Business Account ID</strong> (étape 3)</li>
              <li>• <strong>Access Token</strong> (généré étape 4)</li>
              <li>• <strong>App Secret</strong> (étape 3)</li>
              <li>• <strong>Verify Token</strong> (le mot-clé que vous avez choisi étape 5)</li>
            </ul>
          </li>
          <li>
            Click <strong>"Configurer WhatsApp"</strong>
          </li>
          <li>
            <strong>Retournez ensuite côté Meta</strong> pour cliquer sur "Verify and Save" (étape 5)
          </li>
          <li>
            🎉 Vous pouvez maintenant créer des templates et lancer des campagnes WhatsApp !
          </li>
        </NumberedList>

        <Callout type="success">
          ✅ <strong>Votre intégration est prête.</strong> Pour tester, créez une campagne avec une audience contenant votre propre numéro et envoyez-vous un message de test.
        </Callout>
      </Section>

      {/* FAQ */}
      <div className="bg-gray-50 rounded-xl p-6 mt-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Questions fréquentes</h2>

        <Faq question="Combien coûtent les messages WhatsApp ?">
          <p>
            Meta facture par "conversation" (24h). Les tarifs varient selon le pays. Au Sénégal en 2026, comptez environ <strong>30-50 FCFA par conversation marketing</strong>. Les premiers 1000 messages par mois sont gratuits avec Meta.
          </p>
        </Faq>

        <Faq question="Mon numéro WhatsApp personnel actuel peut-il être utilisé ?">
          <p>
            Non. Vous devez utiliser un numéro <strong>distinct</strong>. Si vous voulez réutiliser votre numéro existant, il faudra d'abord supprimer le compte WhatsApp dessus (ce qui efface aussi votre historique).
          </p>
        </Faq>

        <Faq question="Combien de temps avant que l'App Review Meta soit acceptée ?">
          <p>
            Pour les Lead Ads et certaines fonctionnalités avancées, Meta demande une vérification. Cela prend <strong>1 à 3 semaines</strong> en moyenne. Pour les campagnes WhatsApp simples avec templates, pas besoin d'App Review.
          </p>
        </Faq>

        <Faq question="Que se passe-t-il si mon Access Token expire ?">
          <p>
            Si vous avez bien choisi <strong>"Never"</strong> à l'étape 4, il n'expire jamais. Si vous avez choisi une durée, vous devrez le régénérer dans Meta Business Manager et le mettre à jour dans TalibCRM.
          </p>
        </Faq>

        <Faq question="Puis-je connecter plusieurs numéros WhatsApp ?">
          <p>
            Actuellement, TalibCRM supporte <strong>un seul numéro par organisation</strong>. Si vous avez besoin de plusieurs numéros (ex : un par campus), créez plusieurs organisations dans TalibCRM.
          </p>
        </Faq>
      </div>

      {/* Footer */}
      <div className="mt-8 p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
        <p className="text-sm font-bold text-emerald-900 mb-2">
          Besoin d'aide pour finaliser ?
        </p>
        <p className="text-xs text-emerald-800 mb-4">
          Notre équipe support peut vous accompagner gratuitement.
        </p>
        <div className="flex items-center justify-center gap-2">
          <a
            href="mailto:support@talibcrm.com"
            className="btn-primary py-1.5 px-4 text-xs"
          >
            <MessageCircle size={12} /> Contacter le support
          </a>
          <Link
            href="/settings/whatsapp-integration"
            className="btn-secondary py-1.5 px-4 text-xs"
          >
            <Settings size={12} /> Aller à la configuration
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Section ───
function Section({
  number,
  title,
  icon: Icon,
  children,
}: {
  number: string;
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
          {number}
        </div>
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Numbered list ───
function NumberedList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside ml-2">{children}</ol>;
}

// ─── Callout ───
function Callout({
  type,
  children,
}: {
  type: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };
  return (
    <div className={`mt-4 p-3 rounded-lg border text-xs ${styles[type]}`}>
      {children}
    </div>
  );
}

// ─── Field guide ───
function FieldGuide({
  title,
  where,
  example,
  help,
}: {
  title: string;
  where: string;
  example: string;
  help: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      <p className="text-xs text-gray-600 mb-1">
        <strong>Où le trouver :</strong> {where}
      </p>
      <p className="text-xs text-gray-500 italic font-mono mb-1">
        Exemple : {example}
      </p>
      <p className="text-[11px] text-gray-500">{help}</p>
    </div>
  );
}

// ─── Permissions list ───
function PermissionsList() {
  const perms = [
    "whatsapp_business_management",
    "whatsapp_business_messaging",
    "business_management",
  ];
  return (
    <div className="mt-2 ml-4 space-y-1">
      {perms.map((p) => (
        <div key={p} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked readOnly className="text-emerald-600" />
          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{p}</code>
        </div>
      ))}
    </div>
  );
}

// ─── FAQ ───
function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="border-b border-gray-200 py-3 last:border-b-0">
      <summary className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-emerald-600">
        {question}
      </summary>
      <div className="mt-2 text-sm text-gray-600 pl-2">{children}</div>
    </details>
  );
}