// src/lib/call-tracking.ts
// Suivi d'un appel initié depuis une fiche lead, pour proposer son enregistrement au retour.
// Stocké dans sessionStorage (survit à un rechargement Safari au retour d'appel).

const KEY = "talibcrm_pending_call";

export interface PendingCall {
  leadId: string;
  leadName: string;
  phone: string;
  startedAt: number; // timestamp ms
}

export function startCallTracking(lead: { id: string; name: string; phone: string }): void {
  if (typeof window === "undefined") return;
  try {
    var data: PendingCall = {
      leadId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      startedAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
}

export function getPendingCall(): PendingCall | null {
  if (typeof window === "undefined") return null;
  try {
    var raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCall;
  } catch {
    return null;
  }
}

export function clearPendingCall(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch (e) {}
}