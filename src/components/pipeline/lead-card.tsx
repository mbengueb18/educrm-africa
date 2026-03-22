"use client";

import { cn, formatRelative, getInitials, getScoreBg } from "@/lib/utils";
import {
  Phone,
  MessageCircle,
  Mail,
  MoreHorizontal,
  User as UserIcon,
  GraduationCap,
  Activity,
} from "lucide-react";
import type { LeadSource } from "@prisma/client";

interface LeadCardProps {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    whatsapp: string | null;
    email: string | null;
    score: number;
    source: LeadSource;
    city: string | null;
    createdAt: Date;
    updatedAt: Date;
    customFields?: any;
    assignedTo: { id: string; name: string; avatar: string | null } | null;
    program: { id: string; name: string; code: string | null } | null;
    _count: { messages: number; activities: number };
  };
  customFieldsConfig?: { key: string; label: string; showInCard: boolean }[];
  onOpen?: (leadId: string) => void;
}

const sourceLabels: Record<LeadSource, string> = {
  WEBSITE: "Site web",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  PHONE_CALL: "Appel",
  WALK_IN: "Visite",
  REFERRAL: "Parrainage",
  SALON: "Salon",
  RADIO: "Radio",
  TV: "TV",
  PARTNER: "Partenaire",
  IMPORT: "Import",
  OTHER: "Autre",
};

const sourceColors: Partial<Record<LeadSource, string>> = {
  FACEBOOK: "bg-blue-50 text-blue-600",
  INSTAGRAM: "bg-pink-50 text-pink-600",
  WHATSAPP: "bg-emerald-50 text-emerald-600",
  WEBSITE: "bg-brand-50 text-brand-600",
  REFERRAL: "bg-purple-50 text-purple-600",
  SALON: "bg-amber-50 text-amber-600",
};

export function LeadCard({ lead, customFieldsConfig = [], onOpen }: LeadCardProps) {
  return (
    <div
      className="kanban-card group"
      onClick={() => onOpen?.(lead.id)}
    >
      {/* Header: Name + Score */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {lead.firstName} {lead.lastName}
          </h4>
          {lead.city && (
            <p className="text-xs text-gray-500 mt-0.5">{lead.city}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full",
              getScoreBg(lead.score)
            )}
          >
            {lead.score}
          </span>
          <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all">
            <MoreHorizontal size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Program badge */}
      {lead.program && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <GraduationCap size={12} className="text-brand-500 shrink-0" />
          <span className="text-xs text-brand-600 font-medium truncate">
            {lead.program.code || lead.program.name}
          </span>
        </div>
      )}

      {/* Source badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "badge text-[11px]",
            sourceColors[lead.source] || "badge-gray"
          )}
        >
          {sourceLabels[lead.source]}
        </span>
        <span className="text-[11px] text-gray-400">
          {formatRelative(lead.createdAt)}
        </span>
      </div>

      {/* Custom fields */}
      {customFieldsConfig.length > 0 && lead.customFields && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {customFieldsConfig
            .filter((cf) => cf.showInCard && (lead.customFields as any)?.[cf.key])
            .map((cf) => (
              <span
                key={cf.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-[11px] text-gray-600 border border-gray-100"
              >
                <span className="text-gray-400">{cf.label}:</span>
                <span className="font-medium">{(lead.customFields as any)[cf.key]}</span>
              </span>
            ))}
        </div>
      )}

      {/* Footer: Contact + Assigned */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
        {/* Contact icons */}
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors"
            title={lead.phone}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={14} />
          </button>
          {lead.whatsapp && (
            <button
              className="p-1.5 rounded-md hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
              title="WhatsApp"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle size={14} />
            </button>
          )}
          {lead.email && (
            <button
              className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
              title={lead.email}
              onClick={(e) => e.stopPropagation()}
            >
              <Mail size={14} />
            </button>
          )}
          {lead._count.activities > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 ml-1">
              <Activity size={11} />
              {lead._count.activities}
            </span>
          )}
        </div>

        {/* Assigned user */}
        {lead.assignedTo ? (
          <div
            className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center"
            title={lead.assignedTo.name}
          >
            {getInitials(lead.assignedTo.name)}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center"
            title="Non assigné"
          >
            <UserIcon size={12} />
          </div>
        )}
      </div>
    </div>
  );
}
