import { NextRequest, NextResponse } from "next/server";

// EduCRM Tracking Script
// Usage (like HubSpot):
//   <script src="https://app.educrm.africa/api/t/ecrm.js?id=ism-dakar" async defer></script>
//   OR via GTM: same URL as a Custom HTML tag
//
// What it does:
// 1. Listens to ALL form submissions on the page
// 2. Extracts field values and maps them intelligently
// 3. Sends to EduCRM API automatically
// 4. No modification needed on existing forms

export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get("id") || "";
  const baseUrl = request.nextUrl.origin;

  const js = `
(function(){
  'use strict';

  var ECRM = window.ECRM || {};
  window.ECRM = ECRM;

  ECRM.orgSlug = '${orgSlug}';
  ECRM.endpoint = '${baseUrl}/api/leads/ingest';
  ECRM.apiKey = null;
  ECRM.debug = false;
  ECRM.excludeForms = [];
  ECRM.capturedForms = [];

  // ─── Config (can be overridden before script loads) ───
  // <script>
  //   window.ECRM = { apiKey: 'ecrm_xxx', debug: true, excludeForms: ['search-form'] };
  // </script>
  if (window._ecrmConfig) {
    Object.keys(window._ecrmConfig).forEach(function(k) { ECRM[k] = window._ecrmConfig[k]; });
  }

  // ─── Fetch API key from org config if not set ───
  function init() {
    if (ECRM.apiKey) {
      attachListeners();
      return;
    }
    // Try to get key from a meta tag
    var meta = document.querySelector('meta[name="educrm-key"]');
    if (meta) {
      ECRM.apiKey = meta.getAttribute('content');
      attachListeners();
      return;
    }
    // Try from data attribute on the script tag
    var scripts = document.querySelectorAll('script[src*="ecrm.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var key = scripts[i].getAttribute('data-key');
      if (key) {
        ECRM.apiKey = key;
        attachListeners();
        return;
      }
    }
    log('warn', 'Clé API manquante. Ajoutez data-key="ecrm_xxx" au script ou window._ecrmConfig = { apiKey: "ecrm_xxx" }');
  }

  // ─── Field name mapping ───
  // Maps common HTML field names/ids to EduCRM fields
  var FIELD_MAP = {
    // First name
    firstName: 'firstName', first_name: 'firstName', prenom: 'firstName', prénom: 'firstName',
    'first-name': 'firstName', fname: 'firstName', given_name: 'firstName', givenname: 'firstName',
    'your-name': 'firstName', firstname: 'firstName', prenom_etudiant: 'firstName',

    // Last name
    lastName: 'lastName', last_name: 'lastName', nom: 'lastName', 'last-name': 'lastName',
    lname: 'lastName', family_name: 'lastName', familyname: 'lastName', surname: 'lastName',
    lastname: 'lastName', nom_famille: 'lastName', nom_etudiant: 'lastName',

    // Full name (will be split)
    name: '_fullName', fullname: '_fullName', full_name: '_fullName',
    'your-name': '_fullName', nom_complet: '_fullName', nom_prenom: '_fullName',

    // Phone
    phone: 'phone', telephone: 'phone', tel: 'phone', mobile: 'phone',
    'your-phone': 'phone', 'phone-number': 'phone', phone_number: 'phone',
    portable: 'phone', cellulaire: 'phone', numero: 'phone', whatsapp: 'whatsapp',

    // Email
    email: 'email', 'e-mail': 'email', mail: 'email', courriel: 'email',
    'your-email': 'email', email_address: 'email', emailaddress: 'email',

    // City
    city: 'city', ville: 'city', town: 'city', localite: 'city', localité: 'city',
    adresse: 'city', address: 'city', location: 'city',

    // Program / Formation
    formation: 'filiere', filiere: 'filiere', filière: 'filiere', program: 'filiere',
    programme: 'filiere', cursus: 'filiere', diplome: 'filiere', diplôme: 'filiere',
    niveau: 'niveau', level: 'niveau', cycle: 'niveau',
    specialite: 'filiere', spécialité: 'filiere',

    // Campus
    campus: 'campus', site: 'campus', etablissement: 'campus',

    // Message
    message: 'message', msg: 'message', commentaire: 'message', commentaires: 'message',
    comments: 'message', comment: 'message', 'your-message': 'message',
    question: 'message', demande: 'message', objet: 'message', sujet: 'message',
    subject: 'message', motif: 'message',
  };

  // ─── Extract form data intelligently ───
  function extractFormData(form) {
    var data = {};
    var raw = {};
    var elements = form.elements;

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name && !el.id) continue;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden' && !el.name) continue;
      if (el.type === 'password' || el.type === 'file') continue;
      if (el.type === 'checkbox' && !el.checked) continue;
      if (el.type === 'radio' && !el.checked) continue;

      var key = (el.name || el.id || '').toLowerCase().trim();
      var value = (el.value || '').trim();
      if (!key || !value) continue;

      raw[key] = value;

      // Try to match by field name
      var mapped = FIELD_MAP[key];
      if (mapped) {
        data[mapped] = value;
        continue;
      }

      // Try to match by partial name (e.g. "contact_phone" contains "phone")
      var partialMatch = findPartialMatch(key);
      if (partialMatch) {
        data[partialMatch] = value;
        continue;
      }

      // Try to match by placeholder or label
      var placeholder = (el.placeholder || '').toLowerCase();
      var labelText = getLabelText(el);
      var hintMatch = findPartialMatch(placeholder) || findPartialMatch(labelText);
      if (hintMatch) {
        data[hintMatch] = value;
        continue;
      }

      // Detect by value pattern
      if (!data.email && isEmail(value)) { data.email = value; continue; }
      if (!data.phone && isPhone(value)) { data.phone = value; continue; }
    }

    // Handle full name → split into first/last
    if (data._fullName && (!data.firstName || !data.lastName)) {
      var parts = data._fullName.trim().split(/\\s+/);
      if (!data.firstName) data.firstName = parts[0] || '';
      if (!data.lastName) data.lastName = parts.slice(1).join(' ') || parts[0] || '';
      delete data._fullName;
    }

    // Store unmapped fields as metadata
    data._raw = raw;
    data._formId = form.id || form.getAttribute('name') || form.action || '';
    data._pageUrl = window.location.href;
    data._pageTitle = document.title;

    return data;
  }

  function findPartialMatch(text) {
    if (!text) return null;
    text = text.toLowerCase();
    // Priority order matters — check specific terms first
    var priorities = [
      ['whatsapp', 'whatsapp'],
      ['prénom', 'firstName'], ['prenom', 'firstName'], ['first', 'firstName'], ['fname', 'firstName'],
      ['nom_famille', 'lastName'], ['nom de famille', 'lastName'], ['last', 'lastName'], ['lname', 'lastName'], ['surname', 'lastName'],
      ['nom_complet', '_fullName'], ['full', '_fullName'],
      ['téléphone', 'phone'], ['telephone', 'phone'], ['phone', 'phone'], ['mobile', 'phone'], ['portable', 'phone'], ['tel', 'phone'],
      ['e-mail', 'email'], ['email', 'email'], ['mail', 'email'], ['courriel', 'email'],
      ['ville', 'city'], ['city', 'city'],
      ['formation', 'filiere'], ['filière', 'filiere'], ['filiere', 'filiere'], ['programme', 'filiere'], ['diplôme', 'filiere'],
      ['campus', 'campus'],
      ['message', 'message'], ['commentaire', 'message'], ['question', 'message'],
      ['nom', 'lastName'], // "nom" alone = lastName (after checking nom_complet, nom_famille)
    ];
    for (var i = 0; i < priorities.length; i++) {
      if (text.indexOf(priorities[i][0]) !== -1) return priorities[i][1];
    }
    return null;
  }

  function getLabelText(el) {
    if (el.id) {
      var label = document.querySelector('label[for="' + el.id + '"]');
      if (label) return label.textContent.toLowerCase().trim();
    }
    var parent = el.closest('label');
    if (parent) return parent.textContent.toLowerCase().trim();
    return '';
  }

  function isEmail(v) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v); }
  function isPhone(v) { return /^[+]?[\\d\\s\\-().]{8,}$/.test(v.replace(/\\s/g, '')); }

  // ─── Should we capture this form? ───
  function shouldCapture(form) {
    // Skip search forms
    if (form.role === 'search') return false;
    if (form.id && /search|login|signin|register|signup|password|reset|checkout|payment|cart/i.test(form.id)) return false;
    if (form.action && /search|login|signin|register|signup|password|reset|checkout|payment|cart/i.test(form.action)) return false;
    if (form.className && /search/i.test(form.className)) return false;

    // Skip excluded forms
    if (ECRM.excludeForms.indexOf(form.id) !== -1) return false;
    if (ECRM.excludeForms.indexOf(form.getAttribute('name')) !== -1) return false;

    // Must have at least one contact field (name, email, or phone)
    var elements = form.elements;
    var hasContact = false;
    for (var i = 0; i < elements.length; i++) {
      var key = ((elements[i].name || elements[i].id || '') + ' ' + (elements[i].placeholder || '')).toLowerCase();
      if (/email|mail|phone|tel|nom|name|prenom|prénom/.test(key)) {
        hasContact = true;
        break;
      }
    }
    return hasContact;
  }

  // ─── Send to EduCRM ───
  function sendLead(data) {
    var payload = {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    phone: data.phone || '',
    email: data.email || '',
    whatsapp: data.whatsapp || '',
    city: data.city || '',
    filiere: data.filiere || '',
    campus: data.campus || '',
    source: 'WEBSITE',
    sourceDetail: data._pageTitle || data._formId || '',
    formName: data._formId || 'Auto-captured',
    message: data.message || '',
    niveau: data.niveau || '',
    _capturedBy: 'ecrm-tracker',
    _pageUrl: data._pageUrl || '',
  };

  // Add all raw form fields so the API can capture custom fields
  if (data._raw) {
    Object.keys(data._raw).forEach(function(key) {
      if (!payload[key]) {
        payload[key] = data._raw[key];
      }
    });
  }

    // Don't send if no name AND no contact
    if (!payload.firstName && !payload.lastName && !payload.email && !payload.phone) {
      log('info', 'Formulaire ignoré: aucun champ identifiant détecté', data._raw);
      return;
    }

    // If only lastName and no firstName, try to split
    if (payload.lastName && !payload.firstName) {
      var parts = payload.lastName.split(/\\s+/);
      if (parts.length > 1) {
        payload.firstName = parts[0];
        payload.lastName = parts.slice(1).join(' ');
      }
    }

    log('info', 'Lead capturé:', payload);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', ECRM.endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-key', ECRM.apiKey);
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        var result = JSON.parse(xhr.responseText);
        log('info', 'Lead envoyé:', result);
        ECRM.capturedForms.push({ timestamp: new Date().toISOString(), data: payload, result: result });
        // Push to dataLayer for GTM
        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'educrm_lead_captured',
            ecrmLeadId: result.leadId,
            ecrmDuplicate: result.duplicate || false,
          });
        }
      } else {
        log('warn', 'Erreur envoi lead:', xhr.status, xhr.responseText);
      }
    };
    xhr.onerror = function() { log('warn', 'Erreur réseau envoi lead'); };
    xhr.send(JSON.stringify(payload));
  }

  // ─── Attach form listeners ───
  function attachListeners() {
    log('info', 'EduCRM Tracker initialisé (org: ' + ECRM.orgSlug + ')');

    // Listen to all form submissions
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      if (!shouldCapture(form)) {
        log('info', 'Formulaire ignoré:', form.id || form.action);
        return;
      }
      var data = extractFormData(form);
      sendLead(data);
    }, true); // useCapture = true to fire before other handlers

    // Also intercept AJAX form submissions (React, Vue, etc.)
    interceptFetch();
    interceptXHR();

    // Track page view
    trackPageView();
  }

  // ─── Intercept fetch() for SPA forms ───
  function interceptFetch() {
    if (!window.fetch || ECRM._fetchPatched) return;
    ECRM._fetchPatched = true;
    var originalFetch = window.fetch;
    window.fetch = function() {
      // We don't intercept fetch — just let it through
      // Form capture via submit event is sufficient for most cases
      return originalFetch.apply(this, arguments);
    };
  }

  // ─── Intercept XHR (for jQuery.ajax forms) ───
  function interceptXHR() {
    // Not needed for MVP — submit event capture handles 95% of cases
  }

  // ─── Track page view (for lead journey) ───
  function trackPageView() {
    // Future: track which pages leads visit before converting
  }

  // ─── Logging ───
  function log(level) {
    if (!ECRM.debug && level === 'info') return;
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift('[EduCRM]');
    if (level === 'warn') console.warn.apply(console, args);
    else console.log.apply(console, args);
  }

  // ─── Public API ───
  ECRM.track = function(data) { sendLead(data); };
  ECRM.identify = function(data) { sendLead(data); };

  // ─── Init ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
