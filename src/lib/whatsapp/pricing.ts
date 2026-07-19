// ═══════════════════════════════════════════════════════════════
// Tarification Meta WhatsApp Cloud API — par message (modèle en
// vigueur depuis le 1er juillet 2025 : fini les conversations).
//
// Le tarif dépend de la CATÉGORIE du template (Marketing / Utility /
// Authentication) et du PAYS du destinataire (indicatif téléphonique).
// Meta ne publie pas de grille via API : les taux ci-dessous viennent
// de la rate card officielle (business.whatsapp.com/products/
// platform-pricing) — à rafraîchir manuellement si Meta les révise.
// Dernière vérification : juillet 2026.
//
// Facturation Meta : un message template est facturé à la LIVRAISON.
// Les échecs ne sont pas facturés ; les templates Utility envoyés dans
// une fenêtre de service client (24 h) ouverte sont gratuits. Les
// montants calculés ici restent donc des ESTIMATIONS.
// ═══════════════════════════════════════════════════════════════

export type WhatsAppPricingCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

interface MarketRates {
  label: string;
  marketing: number; // USD / message
  utility: number;
  authentication: number;
}

// Taux USD par message (tier de volume de base)
const MARKET_RATES: Record<string, MarketRates> = {
  REST_OF_AFRICA: { label: "Afrique", marketing: 0.0225, utility: 0.004, authentication: 0.004 },
  EGYPT: { label: "Égypte", marketing: 0.0644, utility: 0.0036, authentication: 0.0036 },
  NIGERIA: { label: "Nigeria", marketing: 0.0516, utility: 0.0067, authentication: 0.0067 },
  SOUTH_AFRICA: { label: "Afrique du Sud", marketing: 0.0379, utility: 0.0076, authentication: 0.0076 },
  FRANCE: { label: "France", marketing: 0.0859, utility: 0.03, authentication: 0.03 },
  NORTH_AMERICA: { label: "Amérique du Nord", marketing: 0.025, utility: 0.0034, authentication: 0.0034 },
  OTHER: { label: "Autres pays", marketing: 0.0604, utility: 0.0077, authentication: 0.0077 },
};

// Indicatif téléphonique → marché Meta.
// La région « Rest of Africa » de Meta couvre toute l'Afrique SAUF
// l'Égypte (20), le Nigeria (234) et l'Afrique du Sud (27).
const AFRICA_CALLING_CODES = [
  "212", "213", "216", "218", // Maghreb + Libye
  "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", // Afrique de l'Ouest
  "230", "231", "232", "233", "235", "236", "237", "238", "239", // Ghana, Cameroun, Tchad...
  "240", "241", "242", "243", "244", "245", "248", "249", "250", "251", "252", "253", // Afrique centrale + Corne
  "254", "255", "256", "257", "258", // Afrique de l'Est
  "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", // Afrique australe + océan Indien
  "291", "297",
];

const CODE_TO_MARKET: Record<string, string> = {
  "20": "EGYPT",
  "234": "NIGERIA",
  "27": "SOUTH_AFRICA",
  "33": "FRANCE",
  "1": "NORTH_AMERICA",
  ...Object.fromEntries(AFRICA_CALLING_CODES.map((c) => [c, "REST_OF_AFRICA"])),
};

// Indicatifs triés par longueur décroissante pour un matching
// « préfixe le plus long d'abord » (ex. 234 avant 23, 27 avant 2).
const SORTED_CODES = Object.keys(CODE_TO_MARKET).sort((a, b) => b.length - a.length);

/** Détecte le marché Meta d'un numéro (ex. "+221 77 532 03 55" → REST_OF_AFRICA). */
export function detectMarket(whatsappNumber: string): string {
  const digits = (whatsappNumber || "").replace(/\D/g, "").replace(/^00/, "");
  for (const code of SORTED_CODES) {
    if (digits.startsWith(code)) return CODE_TO_MARKET[code];
  }
  return "OTHER";
}

function rateFor(market: string, category: WhatsAppPricingCategory): number {
  const rates = MARKET_RATES[market] || MARKET_RATES.OTHER;
  if (category === "UTILITY") return rates.utility;
  if (category === "AUTHENTICATION") return rates.authentication;
  return rates.marketing;
}

// Conversion indicative USD → FCFA (XOF) pour l'affichage.
// Le XOF est arrimé à l'euro ; face au dollar il oscille autour de 600.
export const USD_TO_XOF = 600;

export interface WhatsAppCostBreakdownLine {
  market: string;
  marketLabel: string;
  count: number;
  rateUsd: number;
  totalUsd: number;
}

export interface WhatsAppCostEstimate {
  category: WhatsAppPricingCategory;
  messageCount: number;
  totalUsd: number;
  totalXof: number;
  breakdown: WhatsAppCostBreakdownLine[];
}

/**
 * Estime le coût Meta d'un lot de messages template.
 * `numbers` : numéros WhatsApp des destinataires (format libre).
 */
export function estimateWhatsAppCost(
  numbers: string[],
  category: WhatsAppPricingCategory
): WhatsAppCostEstimate {
  const counts: Record<string, number> = {};
  for (const n of numbers) {
    const market = detectMarket(n);
    counts[market] = (counts[market] || 0) + 1;
  }

  const breakdown: WhatsAppCostBreakdownLine[] = Object.entries(counts)
    .map(([market, count]) => {
      const rateUsd = rateFor(market, category);
      return {
        market,
        marketLabel: (MARKET_RATES[market] || MARKET_RATES.OTHER).label,
        count,
        rateUsd,
        totalUsd: count * rateUsd,
      };
    })
    .sort((a, b) => b.totalUsd - a.totalUsd);

  const totalUsd = breakdown.reduce((sum, l) => sum + l.totalUsd, 0);

  return {
    category,
    messageCount: numbers.length,
    totalUsd,
    totalXof: totalUsd * USD_TO_XOF,
    breakdown,
  };
}

/** "2,45 $" — montant USD formaté à la française. */
export function formatUsd(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

/** "≈ 1 470 FCFA" — arrondi entier, formaté à la française. */
export function formatXof(amount: number): string {
  return Math.round(amount).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " FCFA";
}
