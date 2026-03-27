import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  var orgSlug = request.nextUrl.searchParams.get("id") || "";
  var baseUrl = request.nextUrl.origin;

  var js = `
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

  if (window._ecrmConfig) {
    Object.keys(window._ecrmConfig).forEach(function(k) { ECRM[k] = window._ecrmConfig[k]; });
  }

  // ─── Capture traffic source data on page load ───
  var trafficData = {};

  function captureTrafficSource() {
    // Referrer
    trafficData._referrer = document.referrer || '';

    // URL parameters (UTMs + click IDs)
    try {
      var params = new URLSearchParams(window.location.search);
      var trackParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'gclid', 'fbclid', 'msclkid', 'ttclid', 'dclid', 'li_fat_id',
      ];
      for (var i = 0; i < trackParams.length; i++) {
        var val = params.get(trackParams[i]);
        if (val) {
          trafficData[trackParams[i]] = val;
        }
      }
    } catch(e) {}

    // Store in sessionStorage so it persists across pages (SPA or multi-page)
    try {
      var existing = JSON.parse(sessionStorage.getItem('_ecrm_traffic') || '{}');
      // Only overwrite if we have new data (first page with params wins)
      if (!existing._referrer && trafficData._referrer) {
        existing._referrer = trafficData._referrer;
      }
      // UTMs and click IDs: first touch wins (don't overwrite)
      var keys = Object.keys(trafficData);
      for (var j = 0; j < keys.length; j++) {
        if (!existing[keys[j]]) {
          existing[keys[j]] = trafficData[keys[j]];
        }
      }
      sessionStorage.setItem('_ecrm_traffic', JSON.stringify(existing));
      trafficData = existing;
    } catch(e) {}

    log('info', 'Traffic source captured:', trafficData);
  }

  // ─── Fetch API key ───
  function init() {
    captureTrafficSource();

    if (ECRM.apiKey) { attachListeners(); return; }
    var meta = document.querySelector('meta[name="educrm-key"]');
    if (meta) { ECRM.apiKey = meta.getAttribute('content'); attachListeners(); return; }
    var scripts = document.querySelectorAll('script[src*="ecrm"]');
    for (var i = 0; i < scripts.length; i++) {
      var key = scripts[i].getAttribute('data-key');
      if (key) { ECRM.apiKey = key; attachListeners(); return; }
    }
    log('warn', 'Clé API manquante. Ajoutez data-key="ecrm_xxx" au script.');
  }

  // ─── Field name mapping ───
  var FIELD_MAP = {
    firstName: 'firstName', first_name: 'firstName', prenom: 'firstName', 'first-name': 'firstName',
    fname: 'firstName', given_name: 'firstName', firstname: 'firstName', prenom_étudiant: 'firstName',
    lastName: 'lastName', last_name: 'lastName', nom: 'lastName', 'last-name': 'lastName',
    lname: 'lastName', family_name: 'lastName', surname: 'lastName', lastname: 'lastName',
    nom_famille: 'lastName', nom_étudiant: 'lastName',
    name: '_fullName', fullname: '_fullName', full_name: '_fullName',
    nom_complet: '_fullName', nom_prenom: '_fullName',
    phone: 'phone', téléphone: 'phone', tel: 'phone', mobile: 'phone',
    'phone-number': 'phone', phone_number: 'phone', portable: 'phone',
    cellulaire: 'phone', numero: 'phone', whatsapp: 'whatsapp',
    email: 'email', 'e-mail': 'email', mail: 'email', courriel: 'email',
    'your-email': 'email', email_address: 'email',
    city: 'city', ville: 'city', town: 'city', localite: 'city',
    adresse: 'city', address: 'city', location: 'city',
    formation: 'filière', filière: 'filière', program: 'filière',
    programme: 'filière', cursus: 'filière', diplome: 'filière',
    niveau: 'niveau', level: 'niveau', cycle: 'niveau',
    specialite: 'filière', campus: 'campus', site: 'campus',
    message: 'message', msg: 'message', commentaire: 'message',
    comments: 'message', comment: 'message', question: 'message',
    demande: 'message', objet: 'message', sujet: 'message', subject: 'message',
  };

  // ─── Extract form data ───
  function extractFormData(form) {
    var data = {};
    var raw = {};
    var elements = form.elements;

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name && !el.id) continue;
      if (el.type === 'submit' || el.type === 'button') continue;
      if (el.type === 'hidden' && !el.name) continue;
      if (el.type === 'password' || el.type === 'file') continue;
      if (el.type === 'checkbox' && !el.checked) continue;
      if (el.type === 'radio' && !el.checked) continue;

      var key = (el.name || el.id || '').toLowerCase().trim();
      var value = (el.value || '').trim();
      if (!key || !value) continue;

      raw[key] = value;

      var mapped = FIELD_MAP[key];
      if (mapped) { data[mapped] = value; continue; }

      var partialMatch = findPartialMatch(key);
      if (partialMatch) { data[partialMatch] = value; continue; }

      var placeholder = (el.placeholder || '').toLowerCase();
      var labelText = getLabelText(el);
      var hintMatch = findPartialMatch(placeholder) || findPartialMatch(labelText);
      if (hintMatch) { data[hintMatch] = value; continue; }

      if (!data.email && isEmail(value)) { data.email = value; continue; }
      if (!data.phone && isPhone(value)) { data.phone = value; continue; }
    }

    if (data._fullName && (!data.firstName || !data.lastName)) {
      var parts = data._fullName.trim().split(/\\s+/);
      if (!data.firstName) data.firstName = parts[0] || '';
      if (!data.lastName) data.lastName = parts.slice(1).join(' ') || parts[0] || '';
      delete data._fullName;
    }

    data._raw = raw;
    data._formId = form.id || form.getAttribute('name') || form.action || '';
    data._pageUrl = window.location.href;
    data._pageTitle = document.title;

    return data;
  }

  function findPartialMatch(text) {
    if (!text) return null;
    text = text.toLowerCase();
    var priorities = [
      ['whatsapp', 'whatsapp'],
      ['prenom', 'firstName'], ['first', 'firstName'], ['fname', 'firstName'],
      ['nom_famille', 'lastName'], ['nom de famille', 'lastName'], ['last', 'lastName'], ['lname', 'lastName'], ['surname', 'lastName'],
      ['nom_complet', '_fullName'], ['full', '_fullName'],
      ['téléphone', 'phone'], ['phone', 'phone'], ['mobile', 'phone'], ['portable', 'phone'], ['tel', 'phone'],
      ['e-mail', 'email'], ['email', 'email'], ['mail', 'email'], ['courriel', 'email'],
      ['ville', 'city'], ['city', 'city'],
      ['formation', 'filière'], ['filière', 'filière'], ['programme', 'filière'],
      ['campus', 'campus'],
      ['message', 'message'], ['commentaire', 'message'], ['question', 'message'],
      ['nom', 'lastName'],
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
    if (form.role === 'search') return false;
    if (form.id && /search|login|signin|register|signup|password|reset|checkout|payment|cart/i.test(form.id)) return false;
    if (form.action && /search|login|signin|register|signup|password|reset|checkout|payment|cart/i.test(form.action)) return false;
    if (form.className && /search/i.test(form.className)) return false;
    if (ECRM.excludeForms.indexOf(form.id) !== -1) return false;
    if (ECRM.excludeForms.indexOf(form.getAttribute('name')) !== -1) return false;

    var elements = form.elements;
    var hasContact = false;
    for (var i = 0; i < elements.length; i++) {
      var key = ((elements[i].name || elements[i].id || '') + ' ' + (elements[i].placeholder || '')).toLowerCase();
      if (/email|mail|phone|tel|nom|name|prenom/.test(key)) { hasContact = true; break; }
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
      filière: data.filière || '',
      campus: data.campus || '',
      source: 'WEBSITE',
      sourceDetail: data._pageTitle || data._formId || '',
      formName: data._formId || 'Auto-captured',
      message: data.message || '',
      niveau: data.niveau || '',
      _capturedBy: 'ecrm-tracker',
      _pageUrl: data._pageUrl || '',
    };

    // ─── Inject traffic source data ───
    var traffic = trafficData || {};
    try {
      var stored = JSON.parse(sessionStorage.getItem('_ecrm_traffic') || '{}');
      // Merge: stored data takes priority (first touch)
      var tKeys = Object.keys(stored);
      for (var t = 0; t < tKeys.length; t++) {
        if (!traffic[tKeys[t]]) traffic[tKeys[t]] = stored[tKeys[t]];
      }
    } catch(e) {}

    // Add traffic data to payload
    if (traffic._referrer) payload._referrer = traffic._referrer;
    if (traffic.utm_source) payload.utm_source = traffic.utm_source;
    if (traffic.utm_medium) payload.utm_medium = traffic.utm_medium;
    if (traffic.utm_campaign) payload.utm_campaign = traffic.utm_campaign;
    if (traffic.utm_content) payload.utm_content = traffic.utm_content;
    if (traffic.utm_term) payload.utm_term = traffic.utm_term;
    if (traffic.gclid) payload.gclid = traffic.gclid;
    if (traffic.fbclid) payload.fbclid = traffic.fbclid;
    if (traffic.msclkid) payload.msclkid = traffic.msclkid;
    if (traffic.ttclid) payload.ttclid = traffic.ttclid;

    // Add raw form fields for custom field capture
    if (data._raw) {
      Object.keys(data._raw).forEach(function(key) {
        if (!payload[key]) payload[key] = data._raw[key];
      });
    }

    if (!payload.firstName && !payload.lastName && !payload.email && !payload.phone) {
      log('info', 'Formulaire ignoré: aucun champ identifiant detecte', data._raw);
      return;
    }

    if (payload.lastName && !payload.firstName) {
      var parts = payload.lastName.split(/\\s+/);
      if (parts.length > 1) {
        payload.firstName = parts[0];
        payload.lastName = parts.slice(1).join(' ');
      }
    }

    log('info', 'Lead capturé avec source:', {
      lead: payload.firstName + ' ' + payload.lastName,
      referrer: payload._referrer || 'direct',
      utm_source: payload.utm_source || 'none',
      utm_medium: payload.utm_medium || 'none',
      gclid: payload.gclid ? 'present' : 'none',
      fbclid: payload.fbclid ? 'present' : 'none',
    });

    var xhr = new XMLHttpRequest();
    xhr.open('POST', ECRM.endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-key', ECRM.apiKey);
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        var result = JSON.parse(xhr.responseText);
        log('info', 'Lead envoye:', result);
        ECRM.capturedForms.push({ timestamp: new Date().toISOString(), data: payload, result: result });
        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'educrm_lead_captured',
            ecrmLeadId: result.leadId,
            ecrmDuplicate: result.duplicate || false,
            ecrmTrafficChannel: result.trafficSource ? result.trafficSource.channel : 'unknown',
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
    log('info', 'EduCRM Tracker initialise (org: ' + ECRM.orgSlug + ', traffic: ' + (trafficData.utm_source || trafficData._referrer || 'direct') + ')');

    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      if (!shouldCapture(form)) { log('info', 'Formulaire ignoré:', form.id || form.action); return; }
      var data = extractFormData(form);
      sendLead(data);
    }, true);
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
  ECRM.getTrafficSource = function() { return trafficData; };

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