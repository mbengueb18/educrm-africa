"use client";

import { useState, useEffect } from "react";
import { cn, formatCFA } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Building2, MapPin, GraduationCap, Calendar, Plus,
  Pencil, Trash2, Check, X, Loader2, Globe, Phone, Mail,
  Save, Star, ToggleLeft, ToggleRight, Hash, CreditCard,
  Clock,
} from "lucide-react";
import {
  getOrganization, updateOrganization,
  createCampus, updateCampus, deleteCampus,
  createProgram, updateProgram, deleteProgram,
  createAcademicYear, setCurrentAcademicYear,
} from "./actions";

var SCHOOL_TYPES: Record<string, string> = {
  university: "Université",
  business_school: "École de commerce",
  engineering: "École d'ingénieurs",
  vocational: "Formation professionnelle",
  language: "École de langues",
  other: "Autre",
};

var PROGRAM_LEVELS = [
  { value: "BTS", label: "BTS" },
  { value: "LICENCE", label: "Licence" },
  { value: "MASTER", label: "Master" },
  { value: "DOCTORAT", label: "Doctorat" },
  { value: "CERTIFICATE", label: "Certificat" },
  { value: "PROFESSIONAL", label: "Formation professionnelle" },
];

export default function OrganizationSettingsPage() {
  var [org, setOrg] = useState<any>(null);
  var [loading, setLoading] = useState(true);
  var [activeSection, setActiveSection] = useState<"general" | "campuses" | "programs" | "years">("general");

  var loadOrg = function() {
    setLoading(true);
    getOrganization()
      .then(setOrg)
      .catch(function() { toast.error("Erreur chargement"); })
      .finally(function() { setLoading(false); });
  };

  useEffect(function() { loadOrg(); }, []);

  if (loading || !org) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  var sections = [
    { key: "general" as const, label: "Informations", icon: Building2, count: null },
    { key: "campuses" as const, label: "Campus", icon: MapPin, count: org._count.campuses },
    { key: "programs" as const, label: "Filières", icon: GraduationCap, count: org._count.programs },
    { key: "years" as const, label: "Années académiques", icon: Calendar, count: org.academicYears.length },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Organisation</h1>
          <p className="text-sm text-gray-500 mt-0.5">{org.name} — {org._count.users} utilisateurs, {org._count.leads} leads, {org._count.students} étudiants</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {sections.map(function(s) {
          var Icon = s.icon;
          return (
            <button key={s.key} onClick={function() { setActiveSection(s.key); }}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeSection === s.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}>
              <Icon size={15} /> {s.label}
              {s.count !== null && <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{s.count}</span>}
            </button>
          );
        })}
      </div>

      {activeSection === "general" && <GeneralSection org={org} onSaved={loadOrg} />}
      {activeSection === "campuses" && <CampusesSection campuses={org.campuses} onChanged={loadOrg} />}
      {activeSection === "programs" && <ProgramsSection programs={org.programs} campuses={org.campuses} onChanged={loadOrg} />}
      {activeSection === "years" && <AcademicYearsSection years={org.academicYears} onChanged={loadOrg} />}
    </div>
  );
}

// ─── General Section ───
function GeneralSection({ org, onSaved }: { org: any; onSaved: () => void }) {
  var settings = (org.settings || {}) as Record<string, any>;
  var [name, setName] = useState(org.name);
  var [schoolType, setSchoolType] = useState(settings.schoolType || "");
  var [country, setCountry] = useState(settings.country || "");
  var [currency, setCurrency] = useState(settings.currency || "XOF");
  var [timezone, setTimezone] = useState(settings.timezone || "Africa/Dakar");
  var [contactEmail, setContactEmail] = useState(settings.contactEmail || "");
  var [contactPhone, setContactPhone] = useState(settings.contactPhone || "");
  var [website, setWebsite] = useState(settings.website || "");
  var [address, setAddress] = useState(settings.address || "");
  var [saving, setSaving] = useState(false);

  var handleSave = async function() {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      await updateOrganization({
        name: name.trim(),
        settings: { schoolType, country, currency, timezone, contactEmail, contactPhone, website, address },
      });
      toast.success("Organisation mise à jour");
      onSaved();
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><Building2 size={16} /> Informations générales</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de l'établissement *</label>
            <input type="text" value={name} onChange={function(e) { setName(e.target.value); }} className="input text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
            <select value={schoolType} onChange={function(e) { setSchoolType(e.target.value); }} className="input text-sm">
              <option value="">Non spécifié</option>
              {Object.entries(SCHOOL_TYPES).map(function(e) { return <option key={e[0]} value={e[0]}>{e[1]}</option>; })}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Pays</label>
            <input type="text" value={country} onChange={function(e) { setCountry(e.target.value); }} className="input text-sm" placeholder="SN" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Devise</label>
            <select value={currency} onChange={function(e) { setCurrency(e.target.value); }} className="input text-sm">
              <option value="XOF">FCFA (XOF)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">Dollar (USD)</option>
              <option value="XAF">FCFA (XAF)</option>
              <option value="MAD">Dirham (MAD)</option>
              <option value="TND">Dinar (TND)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Fuseau horaire</label>
            <select value={timezone} onChange={function(e) { setTimezone(e.target.value); }} className="input text-sm">
              <option value="Africa/Dakar">Africa/Dakar (GMT+0)</option>
              <option value="Africa/Abidjan">Africa/Abidjan (GMT+0)</option>
              <option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
              <option value="Africa/Douala">Africa/Douala (GMT+1)</option>
              <option value="Africa/Casablanca">Africa/Casablanca (GMT+1)</option>
              <option value="Africa/Tunis">Africa/Tunis (GMT+1)</option>
              <option value="Europe/Paris">Europe/Paris (GMT+1/2)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Slug</label>
            <input type="text" value={org.slug} disabled className="input text-sm bg-gray-50 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><Phone size={16} /> Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email de contact</label>
            <input type="email" value={contactEmail} onChange={function(e) { setContactEmail(e.target.value); }} className="input text-sm" placeholder="contact@ecole.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
            <input type="tel" value={contactPhone} onChange={function(e) { setContactPhone(e.target.value); }} className="input text-sm" placeholder="+221 33 XXX XX XX" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Site web</label>
            <input type="url" value={website} onChange={function(e) { setWebsite(e.target.value); }} className="input text-sm" placeholder="https://www.ecole.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Adresse</label>
            <input type="text" value={address} onChange={function(e) { setAddress(e.target.value); }} className="input text-sm" placeholder="Rue X, Dakar" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary py-2.5 px-6 text-sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </button>
      </div>
    </div>
  );
}

// ─── Campuses Section ───
function CampusesSection({ campuses, onChanged }: { campuses: any[]; onChanged: () => void }) {
  var [showAdd, setShowAdd] = useState(false);
  var [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{campuses.length} campus configuré{campuses.length > 1 ? "s" : ""}</p>
        <button onClick={function() { setShowAdd(true); }} className="btn-primary py-2 text-xs"><Plus size={14} /> Ajouter un campus</button>
      </div>

      {showAdd && <CampusForm mode="create" onClose={function(s) { setShowAdd(false); if (s) onChanged(); }} />}

      <div className="space-y-3">
        {campuses.map(function(campus) {
          if (editingId === campus.id) {
            return <CampusForm key={campus.id} mode="edit" campus={campus} onClose={function(s) { setEditingId(null); if (s) onChanged(); }} />;
          }
          return (
            <div key={campus.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 group hover:border-brand-200 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{campus.name}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  <span>{campus.city}{campus.country ? ", " + campus.country : ""}</span>
                  {campus.phone && <span className="flex items-center gap-1"><Phone size={10} /> {campus.phone}</span>}
                  {campus.email && <span className="flex items-center gap-1"><Mail size={10} /> {campus.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={function() { setEditingId(campus.id); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil size={14} /></button>
                <button onClick={async function() {
                  if (!confirm("Supprimer " + campus.name + " ?")) return;
                  try { await deleteCampus(campus.id); toast.success("Campus supprimé"); onChanged(); }
                  catch (err: any) { toast.error(err.message || "Erreur"); }
                }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {campuses.length === 0 && !showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <MapPin size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucun campus</p>
        </div>
      )}
    </div>
  );
}

function CampusForm({ mode, campus, onClose }: { mode: "create" | "edit"; campus?: any; onClose: (saved?: boolean) => void }) {
  var [name, setName] = useState(campus?.name || "");
  var [city, setCity] = useState(campus?.city || "");
  var [country, setCountry] = useState(campus?.country || "");
  var [address, setAddress] = useState(campus?.address || "");
  var [phone, setPhone] = useState(campus?.phone || "");
  var [email, setEmail] = useState(campus?.email || "");
  var [saving, setSaving] = useState(false);

  var handleSave = async function() {
    if (!name.trim() || !city.trim()) { toast.error("Nom et ville requis"); return; }
    setSaving(true);
    try {
      if (mode === "create") { await createCampus({ name, city, country, address, phone, email }); toast.success("Campus créé"); }
      else if (campus) { await updateCampus(campus.id, { name, city, country, address, phone, email }); toast.success("Campus mis à jour"); }
      onClose(true);
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 mb-3 animate-scale-in">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
          <input type="text" value={name} onChange={function(e) { setName(e.target.value); }} className="input text-sm" placeholder="Campus Dakar" autoFocus /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Ville *</label>
          <input type="text" value={city} onChange={function(e) { setCity(e.target.value); }} className="input text-sm" placeholder="Dakar" /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Pays</label>
          <input type="text" value={country} onChange={function(e) { setCountry(e.target.value); }} className="input text-sm" placeholder="Sénégal" /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Adresse</label>
          <input type="text" value={address} onChange={function(e) { setAddress(e.target.value); }} className="input text-sm" /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
          <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }} className="input text-sm" /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
          <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} className="input text-sm" /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={function() { onClose(); }} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
        <button onClick={handleSave} disabled={saving || !name.trim() || !city.trim()} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {mode === "create" ? "Créer" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ─── Programs Section ───
function ProgramsSection({ programs, campuses, onChanged }: { programs: any[]; campuses: any[]; onChanged: () => void }) {
  var [showAdd, setShowAdd] = useState(false);
  var [editingId, setEditingId] = useState<string | null>(null);

  var active = programs.filter(function(p) { return p.isActive; });
  var inactive = programs.filter(function(p) { return !p.isActive; });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{active.length} filière{active.length > 1 ? "s" : ""} active{active.length > 1 ? "s" : ""}</p>
        <button onClick={function() { setShowAdd(true); }} className="btn-primary py-2 text-xs"><Plus size={14} /> Ajouter une filière</button>
      </div>

      {showAdd && <ProgramForm mode="create" campuses={campuses} onClose={function(s) { setShowAdd(false); if (s) onChanged(); }} />}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {programs.length === 0 ? (
          <div className="py-12 text-center">
            <GraduationCap size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucune filière</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {programs.map(function(prog) {
              if (editingId === prog.id) {
                return <div key={prog.id} className="p-4"><ProgramForm mode="edit" program={prog} campuses={campuses} onClose={function(s) { setEditingId(null); if (s) onChanged(); }} /></div>;
              }
              return (
                <div key={prog.id} className={cn("flex items-center gap-4 px-5 py-3 group hover:bg-gray-50/50", !prog.isActive && "opacity-50")}>
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <GraduationCap size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{prog.name}</p>
                      {prog.code && <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{prog.code}</span>}
                      <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full font-medium">{prog.level}</span>
                      {!prog.isActive && <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full font-medium">Inactive</span>}
                    </div>
                    {prog.tuitionAmount && (
                      <span className="text-xs text-gray-500 mt-0.5">{formatCFA(prog.tuitionAmount)} {prog.currency || "XOF"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={async function() {
                      try { await updateProgram(prog.id, { isActive: !prog.isActive }); toast.success(prog.isActive ? "Désactivée" : "Activée"); onChanged(); }
                      catch (err: any) { toast.error(err.message); }
                    }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title={prog.isActive ? "Désactiver" : "Activer"}>
                      {prog.isActive ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={function() { setEditingId(prog.id); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil size={14} /></button>
                    <button onClick={async function() {
                      if (!confirm("Supprimer " + prog.name + " ?")) return;
                      try { await deleteProgram(prog.id); toast.success("Filière supprimée"); onChanged(); }
                      catch (err: any) { toast.error(err.message); }
                    }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgramForm({ mode, program, campuses, onClose }: { mode: "create" | "edit"; program?: any; campuses: any[]; onClose: (saved?: boolean) => void }) {
  var [name, setName] = useState(program?.name || "");
  var [code, setCode] = useState(program?.code || "");
  var [level, setLevel] = useState(program?.level || "LICENCE");
  var [tuition, setTuition] = useState(program?.tuitionAmount ? String(program.tuitionAmount) : "");
  var [campusId, setCampusId] = useState(program?.campusId || (campuses.length > 0 ? campuses[0].id : ""));
  var [saving, setSaving] = useState(false);

  var handleSave = async function() {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    if (!campusId) { toast.error("Le campus est requis"); return; }
    setSaving(true);
    try {
      if (mode === "create") { await createProgram({ name, code, level, tuitionAmount: tuition ? parseInt(tuition) : undefined, campusId }); toast.success("Filière créée"); }
      else if (program) { await updateProgram(program.id, { name, code, level, tuitionAmount: tuition ? parseInt(tuition) : undefined }); toast.success("Filière mise à jour"); }
      onClose(true);
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    setSaving(false);
  };

  return (
    <div className={cn(mode === "create" && "bg-white rounded-xl border border-brand-200 p-4 mb-3 animate-scale-in")}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
          <input type="text" value={name} onChange={function(e) { setName(e.target.value); }} className="input text-sm" placeholder="Marketing Digital" autoFocus /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code</label>
          <input type="text" value={code} onChange={function(e) { setCode(e.target.value); }} className="input text-sm" placeholder="MKT-DIG" /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Niveau</label>
          <select value={level} onChange={function(e) { setLevel(e.target.value); }} className="input text-sm">
            {PROGRAM_LEVELS.map(function(l) { return <option key={l.value} value={l.value}>{l.label}</option>; })}
          </select></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Campus *</label>
          <select value={campusId} onChange={function(e) { setCampusId(e.target.value); }} className="input text-sm">
            {campuses.map(function(c) { return <option key={c.id} value={c.id}>{c.name} — {c.city}</option>; })}
          </select></div>
        <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-1 block">Frais de scolarité (FCFA)</label>
          <input type="number" value={tuition} onChange={function(e) { setTuition(e.target.value); }} className="input text-sm" placeholder="1500000" /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={function() { onClose(); }} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
        <button onClick={handleSave} disabled={saving || !name.trim() || !campusId} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {mode === "create" ? "Créer" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ─── Academic Years Section ───
function AcademicYearsSection({ years, onChanged }: { years: any[]; onChanged: () => void }) {
  var [showAdd, setShowAdd] = useState(false);
  var [label, setLabel] = useState("");
  var [startDate, setStartDate] = useState("");
  var [endDate, setEndDate] = useState("");
  var [isCurrent, setIsCurrent] = useState(false);
  var [saving, setSaving] = useState(false);

  var handleAdd = async function() {
    if (!label.trim() || !startDate || !endDate) { toast.error("Tous les champs sont requis"); return; }
    setSaving(true);
    try {
      await createAcademicYear({ label: label.trim(), startDate, endDate, isCurrent });
      toast.success("Année académique créée");
      setShowAdd(false); setLabel(""); setStartDate(""); setEndDate(""); setIsCurrent(false);
      onChanged();
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{years.length} année{years.length > 1 ? "s" : ""} académique{years.length > 1 ? "s" : ""}</p>
        <button onClick={function() { setShowAdd(true); }} className="btn-primary py-2 text-xs"><Plus size={14} /> Ajouter</button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-brand-200 p-4 mb-3 animate-scale-in">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Label *</label>
              <input type="text" value={label} onChange={function(e) { setLabel(e.target.value); }} className="input text-sm" placeholder="2025-2026" autoFocus /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Début *</label>
              <input type="date" value={startDate} onChange={function(e) { setStartDate(e.target.value); }} className="input text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Fin *</label>
              <input type="date" value={endDate} onChange={function(e) { setEndDate(e.target.value); }} className="input text-sm" /></div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isCurrent} onChange={function(e) { setIsCurrent(e.target.checked); }} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
              Définir comme année en cours
            </label>
            <div className="flex gap-2">
              <button onClick={function() { setShowAdd(false); }} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
              <button onClick={handleAdd} disabled={saving || !label.trim()} className="btn-primary py-1.5 px-3 text-xs">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Créer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {years.map(function(year) {
          return (
            <div key={year.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 group hover:border-brand-200 transition-colors">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                year.isCurrent ? "bg-brand-50" : "bg-gray-50"
              )}>
                <Calendar size={18} className={year.isCurrent ? "text-brand-600" : "text-gray-400"} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{year.label}</p>
                  {year.isCurrent && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 flex items-center gap-1">
                      <Star size={9} /> En cours
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(year.startDate).toLocaleDateString("fr-FR")} → {new Date(year.endDate).toLocaleDateString("fr-FR")}
                </p>
              </div>
              {!year.isCurrent && (
                <button onClick={async function() {
                  try { await setCurrentAcademicYear(year.id); toast.success("Année en cours mise à jour"); onChanged(); }
                  catch (err: any) { toast.error(err.message); }
                }} className="btn-secondary py-1.5 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star size={12} /> Définir en cours
                </button>
              )}
            </div>
          );
        })}
      </div>

      {years.length === 0 && !showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucune année académique</p>
        </div>
      )}
    </div>
  );
}