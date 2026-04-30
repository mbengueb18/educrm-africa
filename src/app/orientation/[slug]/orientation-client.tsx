"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles, Send, Loader2, CheckCircle2, GraduationCap,
  Trophy, Mail, Phone, User as UserIcon, ArrowRight,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  logo: string | null;
}

interface Recommendation {
  programId: string;
  matchScore: number;
  reasons: string[];
  program: {
    id: string;
    name: string;
    code: string | null;
    level: string;
    durationMonths: number;
    tuitionAmount: number;
    currency: string;
  };
}

interface AIResponse {
  type: "question" | "recommendation";
  message: string;
  options?: string[];
  recommendations?: Recommendation[];
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
  data?: AIResponse;
}

export function OrientationClient({ slug, organization }: { slug: string; organization: Organization }) {
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState<AIResponse | null>(null);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Lead form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [traffic, setTraffic] = useState({ utm_source: "", utm_medium: "", utm_campaign: "", _referrer: "" });

  useEffect(function() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setTraffic({
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      _referrer: document.referrer || "",
    });
  }, []);

  useEffect(function() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, currentResponse]);

  const callApi = async (newHistory: ChatMessage[], action?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/orientation/" + slug, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: newHistory.map((h) => ({ role: h.role, content: h.content })),
          action,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");

      const aiResponse: AIResponse = data.data;
      const aiMessage: ChatMessage = {
        role: "model",
        content: typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse),
        data: aiResponse,
      };

      setHistory(function(prev) { return [...prev, aiMessage]; });
      setCurrentResponse(aiResponse);

      if (aiResponse.type === "recommendation" && aiResponse.recommendations && aiResponse.recommendations.length > 0) {
        setSelectedProgramId(aiResponse.recommendations[0].programId);
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setLoading(false);
  };

  const handleStart = () => {
    setStarted(true);
    callApi([], "start");
  };

  const handleSendUserMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setCurrentResponse(null);
    setUserInput("");
    callApi(newHistory);
  };

  const handleSubmitLead = async () => {
    if (!firstName.trim()) { toast.error("Prénom requis"); return; }
    if (!phone.trim() && !email.trim()) { toast.error("Téléphone ou email requis"); return; }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orientation/" + slug + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, phone, email,
          recommendedProgramId: selectedProgramId,
          conversation: history,
          traffic,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");

      setSubmitted(true);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSubmitting(false);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " " + currency;
  };

  // Welcome screen
  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
          {organization.logo ? (
            <img src={organization.logo} alt={organization.name} className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Sparkles size={32} className="text-violet-600" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Trouvez votre filière idéale 🎯</h1>
          <p className="text-sm text-gray-500 mb-1">{organization.name}</p>
          <p className="text-sm text-gray-600 mb-6 mt-3">
            Notre conseillère IA vous aide à choisir la formation qui correspond le mieux à votre profil
            en quelques minutes seulement.
          </p>
          <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-violet-700 mb-2"><strong>Comment ça marche :</strong></p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>✨ 5 à 7 questions personnalisées</li>
              <li>🎯 Recommandations adaptées à votre profil</li>
              <li>📋 Détails sur les filières (durée, frais, débouchés)</li>
              <li>📞 Contact direct avec un conseiller si besoin</li>
            </ul>
          </div>
          <button onClick={handleStart} className="btn-primary w-full py-3 text-sm justify-center">
            <Sparkles size={16} /> Démarrer le test d'orientation
          </button>
          <p className="text-[10px] text-gray-400 mt-3">100% gratuit, sans engagement</p>
        </div>
      </div>
    );
  }

  // Submitted (thank you screen)
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Merci {firstName} !</h1>
          <p className="text-sm text-gray-600 mb-4">
            Votre profil a été enregistré. Un conseiller de <strong>{organization.name}</strong> vous contactera très prochainement pour vous accompagner.
          </p>
          <p className="text-xs text-gray-400">À très vite ! 👋</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Conseillère IA</p>
            <p className="text-xs text-gray-500">{organization.name}</p>
          </div>
        </div>

        {/* Chat */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <div className="p-5 space-y-3 min-h-[400px] max-h-[500px] overflow-y-auto">
            {history.map((msg, idx) => {
              if (msg.role === "user") {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              const data = msg.data as AIResponse;
              return (
                <div key={idx} className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                      <p className="text-sm text-gray-700">{data?.message || msg.content}</p>
                    </div>

                    {/* Recommendations */}
                    {data?.type === "recommendation" && data.recommendations && data.recommendations.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {data.recommendations.map((rec, ri) => {
                          const isSelected = selectedProgramId === rec.programId;
                          return (
                            <div
                              key={rec.programId}
                              onClick={() => setSelectedProgramId(rec.programId)}
                              className={cn(
                                "border rounded-xl p-3 cursor-pointer transition-all",
                                isSelected ? "border-brand-400 bg-brand-50 shadow-sm" : "border-gray-200 bg-white hover:border-brand-200"
                              )}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                  ri === 0 ? "bg-amber-100 text-amber-700" : ri === 1 ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"
                                )}>
                                  {ri === 0 ? "🥇" : ri === 1 ? "🥈" : "🥉"}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-sm font-bold text-gray-900">{rec.program.name}</p>
                                    <span className="text-xs font-bold text-emerald-600">⭐ {rec.matchScore}%</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500">
                                    {rec.program.level} • {rec.program.durationMonths} mois • {formatCurrency(rec.program.tuitionAmount, rec.program.currency)}
                                  </p>
                                </div>
                              </div>
                              <ul className="text-xs text-gray-600 space-y-0.5 ml-9">
                                {rec.reasons.slice(0, 3).map((r, i) => (
                                  <li key={i}>✓ {r}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}

                        {!showLeadForm && (
                          <button
                            onClick={() => setShowLeadForm(true)}
                            className="w-full btn-primary py-2.5 text-sm justify-center mt-2"
                          >
                            <Mail size={14} /> Recevoir plus d'informations
                          </button>
                        )}
                      </div>
                    )}

                    {/* Question with options */}
                    {data?.type === "question" && data.options && data.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {data.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => handleSendUserMessage(opt)}
                            disabled={loading}
                            className="px-3 py-1.5 text-xs bg-white border border-brand-200 text-brand-700 rounded-full hover:bg-brand-50 transition-colors"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 size={14} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Free input */}
          {currentResponse?.type === "question" && !loading && (
            <div className="border-t border-gray-100 p-3 flex items-center gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendUserMessage(userInput); }}
                placeholder="Tapez votre réponse..."
                className="input text-sm flex-1"
              />
              <button
                onClick={() => handleSendUserMessage(userInput)}
                disabled={!userInput.trim()}
                className="btn-primary py-2 px-3 text-xs"
              >
                <Send size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Lead form (shown after recommendation) */}
        {showLeadForm && !submitted && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-scale-in">
            <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <UserIcon size={18} className="text-brand-500" /> Vos informations
            </h3>
            <p className="text-xs text-gray-500 mb-4">Pour qu'un conseiller vous recontacte rapidement</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom *" className="input text-sm" />
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="input text-sm" />
              </div>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone WhatsApp *" type="tel" className="input text-sm" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="input text-sm" />
              <button
                onClick={handleSubmitLead}
                disabled={submitting || !firstName.trim() || (!phone.trim() && !email.trim())}
                className="w-full btn-primary py-2.5 text-sm justify-center"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Envoyer ma demande
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Test propulsé par IA • <a href="https://talibcrm.com" className="text-brand-600 hover:underline">TalibCRM</a>
        </p>
      </div>
    </div>
  );
}