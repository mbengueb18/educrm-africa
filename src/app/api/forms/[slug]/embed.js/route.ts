import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formBaseCss } from "@/lib/form-styles";
import { groupIntoRows, type FormField, type FormSettings } from "@/lib/forms";

export const runtime = "nodejs";

const DIAL = [
  ["+221", "🇸🇳"], ["+225", "🇨🇮"], ["+223", "🇲🇱"], ["+226", "🇧🇫"], ["+229", "🇧🇯"], ["+228", "🇹🇬"],
  ["+227", "🇳🇪"], ["+224", "🇬🇳"], ["+237", "🇨🇲"], ["+241", "🇬🇦"], ["+242", "🇨🇬"], ["+243", "🇨🇩"],
  ["+235", "🇹🇩"], ["+222", "🇲🇷"], ["+212", "🇲🇦"], ["+213", "🇩🇿"], ["+216", "🇹🇳"], ["+33", "🇫🇷"], ["+32", "🇧🇪"], ["+1", "🇨🇦"],
];
const DIAL_OPTS = DIAL.map(([c, f]) => '<option value="' + c + '">' + f + " " + c + "</option>").join("");

function esc(s: any): string {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fieldHtml(f: FormField): string {
  const req = f.required ? ' <span class="tf-req">*</span>' : "";
  const label = '<label class="tf-label">' + esc(f.label) + req + "</label>";
  const help = f.help ? '<div class="tf-help">' + esc(f.help) + "</div>" : "";
  const name = esc(f.name);
  switch (f.type) {
    case "heading": return '<div class="tf-heading">' + esc(f.content || f.label) + "</div>";
    case "paragraph": return '<p class="tf-para">' + esc(f.content || f.label) + "</p>";
    case "divider": return '<hr class="tf-div">';
    case "hidden": return '<input type="hidden" name="' + name + '" value="' + esc(f.defaultValue || "") + '">';
    case "consent": return '<label class="tf-consent"><input type="checkbox" data-consent="' + name + '"> <span>' + esc(f.content || f.label) + req + "</span></label>";
    case "textarea": return '<div class="tf-field">' + label + '<textarea name="' + name + '" placeholder="' + esc(f.placeholder || "") + '"></textarea>' + help + "</div>";
    case "select": return '<div class="tf-field">' + label + '<select name="' + name + '"><option value="">' + esc(f.placeholder || "Sélectionner…") + "</option>" + (f.options || []).map((o) => "<option>" + esc(o) + "</option>").join("") + "</select>" + help + "</div>";
    case "radio": return '<div class="tf-field">' + label + "<div>" + (f.options || []).map((o) => '<label class="tf-opt"><input type="radio" name="' + name + '" value="' + esc(o) + '"> ' + esc(o) + "</label>").join("") + "</div>" + help + "</div>";
    case "checkboxes": return '<div class="tf-field">' + label + "<div>" + (f.options || []).map((o) => '<label class="tf-opt"><input type="checkbox" data-cb="' + name + '" value="' + esc(o) + '"> ' + esc(o) + "</label>").join("") + "</div>" + help + "</div>";
    case "boolean": return '<div class="tf-field">' + label + '<div><label class="tf-opt"><input type="radio" name="' + name + '" value="Oui"> Oui</label><label class="tf-opt"><input type="radio" name="' + name + '" value="Non"> Non</label></div>' + help + "</div>";
    case "file": return '<div class="tf-field">' + label + '<button type="button" class="tf-input" data-file="' + name + '" style="text-align:left;cursor:pointer;background:#fafbfc;border-style:dashed">📎 Choisir un fichier…</button><input type="file" data-fileinput="' + name + '" style="display:none"><input type="hidden" name="' + name + '">' + help + "</div>";
    case "tel": case "whatsapp": return '<div class="tf-field">' + label + '<div style="display:flex;gap:6px"><select class="tf-input" data-dial="' + name + '" style="width:auto;min-width:92px">' + DIAL_OPTS + '</select><input class="tf-input" data-phone="' + name + '" type="tel" placeholder="77 000 00 00" style="flex:1"></div>' + help + "</div>";
    default: {
      const t = ({ text: "text", email: "email", number: "number", url: "url", date: "date", time: "time" } as any)[f.type] || "text";
      return '<div class="tf-field">' + label + '<input class="tf-input" name="' + name + '" type="' + t + '" placeholder="' + esc(f.placeholder || "") + '">' + help + "</div>";
    }
  }
}

// Runtime injecté (concaténation, sans ${} pour ne pas interférer avec le template).
const RUNTIME = `
function mount(){
  var target=document.getElementById('talib-form')||document.querySelector('[data-talib-form]');
  if(!target||target.getAttribute('data-mounted'))return; target.setAttribute('data-mounted','1');
  var wrap=document.createElement('div'); wrap.innerHTML='<style>'+CSS+'</style>'+HTML; target.appendChild(wrap);
  var form=wrap.querySelector('form'); var mountTs=Date.now();
  wrap.querySelectorAll('[data-file]').forEach(function(btn){
    var nm=btn.getAttribute('data-file'); var input=wrap.querySelector('[data-fileinput="'+nm+'"]'); var hidden=form.querySelector('input[name="'+nm+'"][type=hidden]');
    btn.addEventListener('click',function(){input.click();});
    input.addEventListener('change',function(){ var file=input.files[0]; if(!file)return; btn.textContent='Envoi…'; btn.disabled=true; var fd=new FormData(); fd.append('file',file);
      fetch(CFG.base+'/api/forms/'+CFG.slug+'/upload',{method:'POST',body:fd}).then(function(r){return r.json();}).then(function(d){ if(d.success){hidden.value=d.url;btn.textContent='✓ '+file.name;}else{btn.textContent='📎 Choisir un fichier…';alert(d.error||'Erreur');} btn.disabled=false; }).catch(function(){btn.textContent='📎 Choisir un fichier…';btn.disabled=false;alert('Erreur');}); });
  });
  form.addEventListener('submit',function(e){ e.preventDefault(); var errEl=form.querySelector('.tf-err'); var values={};
    CFG.fields.forEach(function(f){ if(f.type==='heading'||f.type==='paragraph'||f.type==='divider')return;
      if(f.type==='consent'){var c=form.querySelector('[data-consent="'+f.name+'"]');values[f.name]=c&&c.checked?true:'';return;}
      if(f.type==='checkboxes'){var arr=[];form.querySelectorAll('[data-cb="'+f.name+'"]:checked').forEach(function(x){arr.push(x.value);});values[f.name]=arr;return;}
      if(f.type==='tel'||f.type==='whatsapp'){var dl=form.querySelector('[data-dial="'+f.name+'"]');var ph=form.querySelector('[data-phone="'+f.name+'"]');var num=((ph&&ph.value)||'').trim();values[f.name]=num?(dl.value+' '+num):'';return;}
      if(f.type==='radio'||f.type==='boolean'){var r=form.querySelector('input[name="'+f.name+'"]:checked');values[f.name]=r?r.value:'';return;}
      var el=form.querySelector('[name="'+f.name+'"]');values[f.name]=el?el.value:''; });
    for(var i=0;i<CFG.fields.length;i++){var f=CFG.fields[i];if(f.required&&f.type!=='heading'&&f.type!=='paragraph'&&f.type!=='divider'){var v=values[f.name];if(v==null||v===''||(Array.isArray(v)&&!v.length)||(f.type==='consent'&&!v)){errEl.textContent='Merci de remplir tous les champs obligatoires.';errEl.style.display='block';return;}}}
    errEl.style.display='none'; var hpEl=form.querySelector('[data-hp]'); var hp=hpEl?hpEl.value:'';
    var btn=form.querySelector('.tf-submit');btn.disabled=true;var old=btn.textContent;btn.textContent='Envoi…';
    var params=new URLSearchParams(location.search);var utm={};['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){var val=params.get(k);if(val)utm[k]=val;});
    fetch(CFG.base+'/api/forms/'+CFG.slug+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:values,hp:hp,utm:utm,referrer:document.referrer||'',_t:Date.now()-mountTs})}).then(function(r){return r.json();}).then(function(d){
      if(d&&d.success){ if(CFG.success.mode==='redirect'&&CFG.success.redirect){location.href=CFG.success.redirect;return;} form.innerHTML='<div style="text-align:center;padding:24px 8px"><div style="width:56px;height:56px;border-radius:50%;background:#ecfdf5;display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div><p style="font-size:15px;color:#374151">'+CFG.success.message+'</p></div>'; }
      else{btn.disabled=false;btn.textContent=old;alert((d&&d.error)||'Erreur');} }).catch(function(){btn.disabled=false;btn.textContent=old;alert('Erreur');});
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baseUrl = request.nextUrl.origin;

  const form = await prisma.form.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { name: true, description: true, fields: true, settings: true, organizationId: true },
  });
  if (!form) {
    return new NextResponse("/* Formulaire introuvable */", { status: 404, headers: { "Content-Type": "application/javascript" } });
  }
  const org = await prisma.organization.findUnique({ where: { id: form.organizationId }, select: { logo: true } });

  const fields = (form.fields as FormField[]) || [];
  const settings = (form.settings as FormSettings) || {};
  const logo = settings.showLogo !== false ? (settings.logo || org?.logo || "") : "";

  const inner = groupIntoRows(fields).map((row) => row.length === 2 ? '<div class="tf-row">' + row.map(fieldHtml).join("") + "</div>" : fieldHtml(row[0])).join("");
  const formHtml =
    '<form class="talib-form" style="max-width:480px">' +
    (logo ? '<img src="' + esc(logo) + '" style="height:42px;margin-bottom:12px">' : "") +
    '<div class="tf-heading" style="margin-top:0">' + esc(form.name) + "</div>" +
    (form.description ? '<p class="tf-para">' + esc(form.description) + "</p>" : "") +
    inner +
    '<input type="text" data-hp="1" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0;width:0">' +
    '<div class="tf-err" style="color:#ef4444;font-size:12px;margin-bottom:8px;display:none"></div>' +
    '<button type="submit" class="tf-submit">' + esc(settings.submitLabel || "Envoyer") + "</button>" +
    '<div class="tf-powered">Propulsé par <a href="https://talibcrm.com" target="_blank" rel="noopener">TalibCRM</a></div>' +
    "</form>";

  const slim = fields.map((f) => ({ name: f.name, type: f.type, required: !!f.required }));
  const cfg = { slug, base: baseUrl, fields: slim, success: { mode: settings.successMode || "message", message: settings.successMessage || "Merci !", redirect: settings.redirectUrl || "" } };

  const js =
    "(function(){\n" +
    "var CFG=" + JSON.stringify(cfg) + ";\n" +
    "var CSS=" + JSON.stringify(formBaseCss(settings)) + ";\n" +
    "var HTML=" + JSON.stringify(formHtml) + ";\n" +
    RUNTIME +
    "})();";

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
