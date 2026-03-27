import { NextRequest, NextResponse } from "next/server";

// Serves the embeddable form widget JavaScript
// Usage on école's website:
// <script src="https://app.educrm.africa/api/widget/form.js?org=ism-dakar&key=ecrm_xxx"></script>
// <div id="educrm-form"></div>

export async function GET(request: NextRequest) {
  const org = request.nextUrl.searchParams.get("org") || "";
  const key = request.nextUrl.searchParams.get("key") || "";
  const formType = request.nextUrl.searchParams.get("type") || "contact"; // contact, brochure, rdv
  const lang = request.nextUrl.searchParams.get("lang") || "fr";
  const color = request.nextUrl.searchParams.get("color") || "#1B4F72";
  const baseUrl = request.nextUrl.origin;

  const js = `
(function() {
  'use strict';
  
  var CONFIG = {
    org: '${org}',
    apiKey: '${key}',
    formType: '${formType}',
    lang: '${lang}',
    color: '${color}',
    baseUrl: '${baseUrl}'
  };

  var LABELS = {
    fr: {
      title: { contact: 'Demande de renseignements', brochure: 'Télécharger la brochure', rdv: 'Prendre rendez-vous' },
      firstName: 'Prénom',
      lastName: 'Nom',
      phone: 'Téléphone',
      email: 'Email',
      city: 'Ville',
      program: 'Filière souhaitée',
      campus: 'Campus',
      message: 'Message',
      selectProgram: 'Sélectionner une filière...',
      selectCampus: 'Sélectionner un campus...',
      submit: { contact: 'Envoyer ma demande', brochure: 'Recevoir la brochure', rdv: 'Demander un rendez-vous' },
      success: 'Merci ! Nous vous recontacterons très bientôt.',
      error: 'Une erreur est survenue. Veuillez réessayer.',
      required: 'Ce champ est requis',
      invalidEmail: 'Email invalide',
      invalidPhone: 'Numéro invalide'
    }
  };

  var L = LABELS[CONFIG.lang] || LABELS.fr;

  // ─── Fetch config ───
  function loadConfig(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CONFIG.baseUrl + '/api/widget/config?org=' + CONFIG.org);
    xhr.onload = function() {
      if (xhr.status === 200) {
        callback(JSON.parse(xhr.responseText));
      } else {
        callback({ programs: [], campuses: [] });
      }
    };
    xhr.onerror = function() { callback({ programs: [], campuses: [] }); };
    xhr.send();
  }

  // ─── Build form ───
  function buildForm(config) {
    var container = document.getElementById('educrm-form');
    if (!container) {
      var containers = document.querySelectorAll('[data-educrm-form]');
      container = containers.length ? containers[0] : null;
    }
    if (!container) return;

    var formTitle = (L.title[CONFIG.formType] || L.title.contact);

    container.innerHTML = '<div id="ecrm-widget">' +
      '<style>' +
        '#ecrm-widget{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:480px;margin:0 auto}' +
        '#ecrm-widget *{box-sizing:border-box;margin:0;padding:0}' +
        '#ecrm-widget .ecrm-card{background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.06)}' +
        '#ecrm-widget h3{font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:4px}' +
        '#ecrm-widget .ecrm-sub{font-size:13px;color:#6b7280;margin-bottom:20px}' +
        '#ecrm-widget .ecrm-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}' +
        '#ecrm-widget .ecrm-field{margin-bottom:12px}' +
        '#ecrm-widget label{display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px}' +
        '#ecrm-widget label .req{color:#ef4444}' +
        '#ecrm-widget input,#ecrm-widget select,#ecrm-widget textarea{width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#1a1a1a;background:#fff;transition:border-color .15s}' +
        '#ecrm-widget input:focus,#ecrm-widget select:focus,#ecrm-widget textarea:focus{outline:none;border-color:' + CONFIG.color + ';box-shadow:0 0 0 3px ' + CONFIG.color + '20}' +
        '#ecrm-widget textarea{resize:vertical;min-height:80px}' +
        '#ecrm-widget .ecrm-btn{width:100%;padding:11px;background:' + CONFIG.color + ';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s;margin-top:8px}' +
        '#ecrm-widget .ecrm-btn:hover{opacity:.9}' +
        '#ecrm-widget .ecrm-btn:disabled{opacity:.5;cursor:not-allowed}' +
        '#ecrm-widget .ecrm-success{text-align:center;padding:32px 16px}' +
        '#ecrm-widget .ecrm-success .ecrm-check{width:56px;height:56px;border-radius:50%;background:#ecfdf5;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}' +
        '#ecrm-widget .ecrm-success .ecrm-check svg{width:28px;height:28px;color:#10b981}' +
        '#ecrm-widget .ecrm-success p{font-size:15px;color:#374151;line-height:1.5}' +
        '#ecrm-widget .ecrm-error{font-size:12px;color:#ef4444;margin-top:4px}' +
        '#ecrm-widget .ecrm-powered{text-align:center;margin-top:16px;font-size:11px;color:#9ca3af}' +
        '#ecrm-widget .ecrm-powered a{color:#6b7280;text-decoration:none}' +
      '</style>' +
      '<div class="ecrm-card">' +
        '<h3>' + formTitle + '</h3>' +
        '<p class="ecrm-sub">' + (config.organization || '') + '</p>' +
        '<form id="ecrm-form-el">' +
          '<div class="ecrm-row">' +
            '<div class="ecrm-field"><label>' + L.firstName + ' <span class="req">*</span></label><input name="firstName" required></div>' +
            '<div class="ecrm-field"><label>' + L.lastName + ' <span class="req">*</span></label><input name="lastName" required></div>' +
          '</div>' +
          '<div class="ecrm-row">' +
            '<div class="ecrm-field"><label>' + L.phone + ' <span class="req">*</span></label><input name="phone" type="tel" required placeholder="+221 77 000 00 00"></div>' +
            '<div class="ecrm-field"><label>' + L.email + '</label><input name="email" type="email" placeholder="email@exemple.com"></div>' +
          '</div>' +
          '<div class="ecrm-field"><label>' + L.city + '</label><input name="city" placeholder="Dakar, Abidjan..."></div>' +
          buildProgramSelect(config.programs) +
          buildCampusSelect(config.campuses) +
          (CONFIG.formType !== 'brochure' ? '<div class="ecrm-field"><label>' + L.message + '</label><textarea name="message" rows="3"></textarea></div>' : '') +
          '<input type="hidden" name="source" value="WEBSITE">' +
          '<input type="hidden" name="formName" value="' + CONFIG.formType + '">' +
          '<button type="submit" class="ecrm-btn">' + (L.submit[CONFIG.formType] || L.submit.contact) + '</button>' +
        '</form>' +
      '</div>' +
      '<div class="ecrm-powered">Propulsé par <a href="https://educrm.africa" target="_blank">EduCRM Africa</a></div>' +
    '</div>';

    // ─── Form submit handler ───
    document.getElementById('ecrm-form-el').addEventListener('submit', function(e) {
      e.preventDefault();
      var form = e.target;
      var btn = form.querySelector('.ecrm-btn');
      var data = {};
      var formData = new FormData(form);
      formData.forEach(function(val, key) { data[key] = val; });

      btn.disabled = true;
      btn.textContent = 'Envoi...';

      fetch(CONFIG.baseUrl + '/api/leads/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.apiKey },
        body: JSON.stringify(data)
      })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.success) {
          var card = container.querySelector('.ecrm-card');
          card.innerHTML = '<div class="ecrm-success">' +
            '<div class="ecrm-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>' +
            '<p>' + L.success + '</p>' +
          '</div>';
          if (window.dataLayer) { window.dataLayer.push({ event: 'educrm_lead_captured', formType: CONFIG.formType }); }
        } else {
          btn.disabled = false;
          btn.textContent = (L.submit[CONFIG.formType] || L.submit.contact);
          alert(result.error || L.error);
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = (L.submit[CONFIG.formType] || L.submit.contact);
        alert(L.error);
      });
    });
  }

  function buildProgramSelect(programs) {
    if (!programs || !programs.length) return '';
    var opts = '<option value="">' + L.selectProgram + '</option>';
    programs.forEach(function(p) {
      opts += '<option value="' + (p.code || p.name) + '">' + (p.code ? p.code + ' — ' : '') + p.name + '</option>';
    });
    return '<div class="ecrm-field"><label>' + L.program + '</label><select name="filière">' + opts + '</select></div>';
  }

  function buildCampusSelect(campuses) {
    if (!campuses || campuses.length <= 1) return '';
    var opts = '<option value="">' + L.selectCampus + '</option>';
    campuses.forEach(function(c) {
      opts += '<option value="' + c.city + '">' + c.name + ' — ' + c.city + '</option>';
    });
    return '<div class="ecrm-field"><label>' + L.campus + '</label><select name="campus">' + opts + '</select></div>';
  }

  // ─── Init ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { loadConfig(buildForm); });
  } else {
    loadConfig(buildForm);
  }
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600", // 1h cache
    },
  });
}
