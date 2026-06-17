// src/lib/analytics.ts
// Helper de tracking : pousse des events dans le dataLayer pour GTM → GA4.
// RÈGLE ABSOLUE : jamais de PII (nom, téléphone, email, ville d'un lead/user).

declare global {
  interface Window {
    dataLayer?: any[];
  }
}

type EventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(eventName: string, params?: EventParams): void {
  if (typeof window === "undefined") return;
  if (!window.dataLayer) window.dataLayer = [];
  window.dataLayer.push({ event: eventName, ...(params || {}) });
}

// page_view enrichi : appelé au montage + à chaque navigation
export function pushPageView(params: {
  page_type: string;
  page_name: string;
  org_id?: string;
  user_id?: string;
  user_role?: string;
  plan?: string;
}): void {
  if (typeof window === "undefined") return;
  if (!window.dataLayer) window.dataLayer = [];
  window.dataLayer.push({
    event: "page_view",
    ...params,
  });
}