import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(request: NextRequest) {
  var orgSlug = request.nextUrl.searchParams.get("id") || "";
  var baseUrl = request.nextUrl.origin;

  // Vérifier si le tracking pageview est activé pour cette org
  let pageviewTrackingEnabled = false;
  if (orgSlug) {
    try {
      const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { webTrackingEnabled: true },
      });
      pageviewTrackingEnabled = org?.webTrackingEnabled || false;
    } catch (e) {
      // En cas d'erreur, on laisse désactivé pour ne pas casser le tracker
    }
  }

  var js = `
(function(){
  'use strict';

  var ECRM = window.ECRM || {};
  window.ECRM = ECRM;

  ECRM.orgSlug = '${orgSlug}';
  ECRM.endpoint = '${baseUrl}/api/leads/ingest';
  ECRM.pageviewEndpoint = '${baseUrl}/api/t/pageview';
  ECRM.apiKey = null;
  ECRM.siteId = null;
  ECRM.debug = false;
  ECRM.excludeForms = [];
  ECRM.capturedForms = [];
  ECRM.visitorId = null;
  ECRM.sessionId = null;

  // Lecture config : _talibConfig (nouveau) ou _ecrmConfig (rétrocompat)
  var _cfg = window._talibConfig || window._ecrmConfig;
  if (_cfg) {
    Object.keys(_cfg).forEach(function(k) { ECRM[k] = _cfg[k]; });
  }

  // siteId est le nouveau nom public ; apiKey reste accepté pour rétrocompat
  ECRM.siteId = ECRM.siteId || ECRM.apiKey;
  ECRM.apiKey = ECRM.siteId;

  // ─── Constants ───
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle
  var HEARTBEAT_INTERVAL_MS = 15 * 1000;   // ping every 15s when visible
  var SESSION_KEY = '_ecrm_session';
  var VISITOR_KEY = '_ecrm_vid';

  // ─── Visitor ID (cookie permanent) ───
  function getVisitorId() {
    try {
      var vid = localStorage.getItem(VISITOR_KEY);
      if (!vid) {
        vid = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        localStorage.setItem(VISITOR_KEY, vid);
      }
      return vid;
    } catch(e) {
      return 'v_anon_' + Math.random().toString(36).slice(2, 15);
    }
  }
  ECRM.visitorId = getVisitorId();

  // ─── Session management (GA4-style) ───
  function generateSessionId() {
    return 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
  }

  function getStoredSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  function saveSession(session) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch(e) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
  }

  function captureCurrentSource() {
    var source = { referrer: document.referrer || '' };
    try {
      var params = new URLSearchParams(window.location.search);
      var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
      for (var i = 0; i < keys.length; i++) {
        var v = params.get(keys[i]);
        if (v) source[keys[i]] = v;
      }
    } catch(e) {}
    return source;
  }

  function shouldStartNewSession(stored, currentSource) {
    if (!stored || !stored.sessionId) return true;
    var idle = Date.now() - (stored.lastActivityAt || 0);
    if (idle > SESSION_TIMEOUT_MS) return true;
    // Nouveau UTM source = nouvelle session (comportement GA4)
    if (currentSource.utm_source && currentSource.utm_source !== stored.utm_source) return true;
    if (currentSource.gclid && currentSource.gclid !== stored.gclid) return true;
    if (currentSource.fbclid && currentSource.fbclid !== stored.fbclid) return true;
    return false;
  }

  function getOrCreateSession() {
    var currentSource = captureCurrentSource();
    var stored = getStoredSession();

    if (shouldStartNewSession(stored, currentSource)) {
      var newSession = {
        sessionId: generateSessionId(),
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        referrer: currentSource.referrer,
        utm_source: currentSource.utm_source || (stored && stored.utm_source) || null,
        utm_medium: currentSource.utm_medium || null,
        utm_campaign: currentSource.utm_campaign || null,
        utm_content: currentSource.utm_content || null,
        utm_term: currentSource.utm_term || null,
        gclid: currentSource.gclid || null,
        fbclid: currentSource.fbclid || null,
      };
      saveSession(newSession);
      return newSession;
    }

    // Update lastActivityAt on existing session
    stored.lastActivityAt = Date.now();
    saveSession(stored);
    return stored;
  }

  // ─── Engagement tracking (Page Visibility API) ───
  var lastEngagedTime = null;
  var pageStartTime = null;

  function isPageVisible() {
    return !document.hidden;
  }

  function startEngagementTracking() {
    if (isPageVisible()) {
      lastEngagedTime = Date.now();
      pageStartTime = Date.now();
    }
  }

  function getEngagedDeltaMs() {
    if (!lastEngagedTime || !isPageVisible()) return 0;
    var now = Date.now();
    var delta = now - lastEngagedTime;
    lastEngagedTime = now;
    return delta;
  }

  // ─── Visibility handlers ───
  document.addEventListener('visibilitychange', function() {
    if (isPageVisible()) {
      lastEngagedTime = Date.now();
      ECRM.sessionData = getOrCreateSession();
      ECRM.sessionId = ECRM.sessionData.sessionId;
    } else {
      // Tab became hidden — flush engaged time
      var delta = getEngagedDeltaMs();
      if (delta > 0 && delta < 60000) {
        sendHeartbeat(delta);
      }
      lastEngagedTime = null;
    }
  });

  // ─── Init ───
  function init() {
    if (ECRM.apiKey) {
      attachListeners();
      return;
    }
    var meta = document.querySelector('meta[name="educrm-key"]');
    if (meta) { ECRM.apiKey = meta.getAttribute('content'); attachListeners(); return; }
    var scripts = document.querySelectorAll('script[src*="ecrm"]');
    for (var i = 0; i < scripts.length; i++) {
      var key = scripts[i].getAttribute('data-key');
      if (key) { ECRM.apiKey = key; attachListeners(); return; }
    }
    log('warn', 'Identifiant de suivi manquant. Vérifiez votre code de suivi TalibCRM.');
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
    var mappedKeys = {}; // clés brutes déjà mappées vers un champ principal
    var elements = form.elements;

    // Clés principales connues (si une valeur atterrit là, la clé brute est "consommée")
    var CORE_KEYS = ['firstName','lastName','phone','email','whatsapp','city','filière','campus','niveau','message','_fullName'];

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

      // Ignorer les champs techniques internes de Gravity Forms
      if (/^(gform_|is_submit_|state_|gform_target|gform_source|gform_field_values|gform_unique_id|gform_resume|gform_save)/.test(key)) continue;
      // Ignorer les conteneurs fieldset et pseudo-champs de structure Gravity

      raw[key] = value;

      var mapped = FIELD_MAP[key];
      if (mapped) { if (!data[mapped]) { data[mapped] = value; mappedKeys[key] = true; } continue; }

      var partialMatch = findPartialMatch(key);
      if (partialMatch) { if (!data[partialMatch]) { data[partialMatch] = value; mappedKeys[key] = true; } continue; }

      var placeholder = (el.placeholder || '').toLowerCase();
      var labelText = getLabelText(el);
      var hintMatch = findPartialMatch(placeholder) || findPartialMatch(labelText);
      if (hintMatch) { if (!data[hintMatch]) { data[hintMatch] = value; mappedKeys[key] = true; } continue; }

      if (!data.email && isEmail(value)) { data.email = value; mappedKeys[key] = true; continue; }
      if (!data.phone && isPhone(value)) { data.phone = value; mappedKeys[key] = true; continue; }
    }

    if (data._fullName && (!data.firstName || !data.lastName)) {
      var parts = data._fullName.trim().split(/\\s+/);
      if (!data.firstName) data.firstName = parts[0] || '';
      if (!data.lastName) data.lastName = parts.slice(1).join(' ') || parts[0] || '';
      delete data._fullName;
    }

    // Ne garder dans _raw que les champs NON mappés vers un champ principal
    var cleanRaw = {};
    Object.keys(raw).forEach(function(k) {
      if (!mappedKeys[k]) cleanRaw[k] = raw[k];
    });

    data._raw = cleanRaw;
    data._formId = form.id || form.getAttribute('name') || form.action || '';
    data._pageUrl = window.location.href;
    data._pageTitle = document.title;

    return data;
  }

  function findPartialMatch(text) {
    if (!text) return null;
    text = text.toLowerCase();
    // Retirer les accents : "prénom" → "prenom", "téléphone" → "telephone"
    text = text.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    var priorities = [
      ['whatsapp', 'whatsapp'],
      ['prenom', 'firstName'], ['first', 'firstName'], ['fname', 'firstName'],
      ['nom_famille', 'lastName'], ['nom de famille', 'lastName'], ['last', 'lastName'], ['lname', 'lastName'], ['surname', 'lastName'],
      ['nom_complet', '_fullName'], ['full', '_fullName'],
      ['telephone', 'phone'], ['phone', 'phone'], ['mobile', 'phone'], ['portable', 'phone'], ['tel', 'phone'],
      ['e-mail', 'email'], ['email', 'email'], ['mail', 'email'], ['courriel', 'email'],
      ['ville', 'city'], ['city', 'city'],
      ['formation', 'filiere'], ['filiere', 'filière'], ['programme', 'filière'],
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

  // ─── Send pageview ───
  function trackPageView() {
    if (!ECRM.apiKey) return;
    ECRM.sessionData = getOrCreateSession();
    ECRM.sessionId = ECRM.sessionData.sessionId;
    pageStartTime = Date.now();
    lastEngagedTime = isPageVisible() ? Date.now() : null;

    var s = ECRM.sessionData;
    var payload = {
      eventType: 'pageview',
      visitorId: ECRM.visitorId,
      sessionId: s.sessionId,
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: s.referrer || null,
      utm_source: s.utm_source || null,
      utm_medium: s.utm_medium || null,
      utm_campaign: s.utm_campaign || null,
      utm_content: s.utm_content || null,
      utm_term: s.utm_term || null,
      gclid: s.gclid || null,
      fbclid: s.fbclid || null,
      userAgent: navigator.userAgent || '',
      language: navigator.language || '',
      screenSize: window.screen.width + 'x' + window.screen.height,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
    };

    var xhr = new XMLHttpRequest();
    xhr.open('POST', ECRM.pageviewEndpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-key', ECRM.apiKey);
    xhr.onload = function() {
      if (xhr.status === 409) {
        // Session expired server-side, regenerate locally
        clearSession();
        ECRM.sessionData = getOrCreateSession();
        ECRM.sessionId = ECRM.sessionData.sessionId;
      }
      log('info', 'Pageview tracked:', payload.path);
    };
    xhr.send(JSON.stringify(payload));
  }

  // ─── Send heartbeat ───
  function sendHeartbeat(deltaMs) {
    if (!ECRM.apiKey || !ECRM.sessionId) return;
    var payload = {
      eventType: 'heartbeat',
      visitorId: ECRM.visitorId,
      sessionId: ECRM.sessionId,
      engagedDeltaMs: deltaMs,
    };
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ECRM.pageviewEndpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('x-api-key', ECRM.apiKey);
      xhr.send(JSON.stringify(payload));
    } catch(e) {}
  }

  // ─── Heartbeat loop ───
  function startHeartbeat() {
    setInterval(function() {
      if (!isPageVisible()) return;
      var delta = getEngagedDeltaMs();
      if (delta > 0 && delta < 60000) sendHeartbeat(delta);
    }, HEARTBEAT_INTERVAL_MS);
  }

  // ─── beforeunload : flush remaining engagement ───
  window.addEventListener('beforeunload', function() {
    if (!ECRM.sessionId || !isPageVisible()) return;
    var delta = getEngagedDeltaMs();
    if (delta > 0 && delta < 60000) {
      try {
        var blob = new Blob([JSON.stringify({
          eventType: 'heartbeat',
          visitorId: ECRM.visitorId,
          sessionId: ECRM.sessionId,
          engagedDeltaMs: delta,
        })], { type: 'application/json' });
        navigator.sendBeacon(ECRM.pageviewEndpoint + '?key=' + ECRM.apiKey, blob);
      } catch(e) {}
    }
  });

  // ─── SPA tracking ───
  function setupSpaTracking() {
    var pushState = history.pushState;
    var replaceState = history.replaceState;
    history.pushState = function() {
      pushState.apply(history, arguments);
      setTimeout(trackPageView, 0);
    };
    history.replaceState = function() {
      replaceState.apply(history, arguments);
      setTimeout(trackPageView, 0);
    };
    window.addEventListener('popstate', function() { setTimeout(trackPageView, 0); });
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
      _visitorId: ECRM.visitorId,
    };

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

    log('info', 'Lead capturé:', payload.firstName + ' ' + payload.lastName);

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
          });
        }
      } else {
        log('warn', 'Erreur envoi lead:', xhr.status, xhr.responseText);
      }
    };
    xhr.onerror = function() { log('warn', 'Erreur réseau envoi lead'); };
    xhr.send(JSON.stringify(payload));
  }

  // ─── Gravity Forms support (AJAX) ───
  // Gravity intercepte la soumission : l'événement submit natif ne remonte pas.
  // Stratégie : on mémorise les valeurs en continu (input/change) par formulaire,
  // puis on envoie le lead quand Gravity confirme le succès (gform_confirmation_loaded).
  var _gravityData = {};

  function readGravityForm(form) {
    if (!form) return null;
    return extractFormData(form);
  }

  function setupGravityForms() {
    if (typeof window.jQuery === 'undefined') return;
    var $ = window.jQuery;

    // 1. Mémoriser les valeurs à chaque saisie dans un formulaire Gravity
    document.addEventListener('input', function(e) {
      var form = e.target && e.target.form;
      if (!form || !form.id || form.id.indexOf('gform_') !== 0) return;
      var formId = form.id.replace('gform_', '');
      _gravityData[formId] = readGravityForm(form);
    }, true);

    document.addEventListener('change', function(e) {
      var form = e.target && e.target.form;
      if (!form || !form.id || form.id.indexOf('gform_') !== 0) return;
      var formId = form.id.replace('gform_', '');
      _gravityData[formId] = readGravityForm(form);
    }, true);

    // 2. Envoyer quand Gravity confirme le succès de la soumission AJAX
    $(document).on('gform_confirmation_loaded', function(event, formId) {
      var key = String(formId);
      var data = _gravityData[key];
      if (!data) {
        log('info', 'Gravity: confirmation reçue mais aucune donnée capturée pour', formId);
        return;
      }
      log('info', 'Gravity: soumission confirmée, envoi du lead pour le formulaire', formId);
      sendLead(data);
      delete _gravityData[key];
    });

    log('info', 'Gravity Forms support activé');
  }

  // ─── Form schema capture (pour la page Gestion des formulaires du CRM) ───
  // Envoie la STRUCTURE des formulaires (pas les valeurs), seulement si elle a changé.
  ECRM.formSchemaEndpoint = '${baseUrl}/api/t/form-schema';
  var SCHEMA_HASH_KEY = '_ecrm_schema_hash';

  // Filtre pour la capture de SCHÉMA : plus permissif que shouldCapture (lead).
  // On exclut les formulaires techniques mais on n'exige PAS de champ contact
  // détectable par name (les champs Gravity input_X ont leurs mots dans les labels).
  function shouldCaptureSchema(form) {
    if (form.role === 'search') return false;
    var idStr = (form.id || '') + ' ' + (form.getAttribute('name') || '') + ' ' + (form.action || '') + ' ' + (form.className || '');
    if (/search|login|signin|register|signup|password|reset|checkout|payment|cart|wp-link|comment/i.test(idStr)) return false;
    if (ECRM.excludeForms.indexOf(form.id) !== -1) return false;
    // Doit avoir au moins 2 champs utiles (sinon c'est un form de recherche/newsletter à 1 champ)
    var usefulCount = 0;
    var els = form.elements;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var nm = (el.name || el.id || '').trim();
      if (!nm) continue;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden') continue;
      if (/^(gform_|is_submit_|state_)/i.test(nm)) continue;
      usefulCount++;
    }
    return usefulCount >= 2;
  }

  function buildFormSchemas() {
    var forms = document.querySelectorAll('form');
    var result = [];
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      if (!shouldCaptureSchema(form)) continue;
      // Ne capturer que les formulaires visibles (ignorer popups fermées, forms cachés)
      if (form.offsetParent === null) continue;
    

      var formId = form.id || form.getAttribute('name') || ('form_' + i);
      var fields = [];
      var seen = {};
      var els = form.elements;
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        var nm = (el.name || el.id || '').trim();
        if (!nm) continue;
        if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden' || el.type === 'password' || el.type === 'file') continue;
        // Ignorer les champs techniques Gravity
        if (/^(gform_|is_submit_|state_|gform_target|gform_source|gform_field_values|gform_unique_id|gform_resume|gform_save)/i.test(nm)) continue;
        if (seen[nm]) continue;
        seen[nm] = true;
        fields.push({
          name: nm,
          type: el.type || el.tagName.toLowerCase(),
          label: getLabelTextRaw(el),
        });
        // Ignorer les conteneurs (fieldset) et pseudo-champs de structure Gravity
        if (el.type === 'fieldset' || el.tagName.toLowerCase() === 'fieldset') continue;
        if (/^field_/i.test(nm)) continue;
      }
      if (fields.length > 0) {
        result.push({
          formId: formId,
          name: getFormName(form, formId),
          fields: fields,
          pageUrl: window.location.href,
          pageTitle: document.title,
        });
      }
    }
    return result;
  }

  // Label en conservant la casse d'origine (getLabelText met en minuscule, ici on veut l'affichage)
  function getLabelTextRaw(el) {
    if (el.id) {
      var label = document.querySelector('label[for="' + el.id + '"]');
      if (label) return label.textContent.trim();
    }
    var parent = el.closest ? el.closest('label') : null;
    if (parent) return parent.textContent.trim();
    return '';
  }

  function getFormName(form, fallback) {
    // 1. aria-label explicite
    if (form.getAttribute('aria-label')) return form.getAttribute('aria-label').trim();
    // 2. Titre Gravity : .gform_title est généralement à côté/au-dessus du <form>
    var wrapper = form.closest('.gform_wrapper') || form.parentElement;
    if (wrapper) {
      var gtitle = wrapper.querySelector('.gform_title, .gform_heading h3, .gform_heading h2');
      if (gtitle && gtitle.textContent.trim()) return gtitle.textContent.trim().slice(0, 100);
    }
    // 3. Fallback neutre basé sur l'ID : "gform_7" → "Formulaire 7"
    if (fallback && /^gform_(\\d+)$/.test(fallback)) {
      return 'Formulaire ' + fallback.replace('gform_', '');
    }
    return fallback;
  }

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  function sendFormSchemas() {
    if (!ECRM.apiKey) return;
    try {
      var schemas = buildFormSchemas();
      if (!schemas.length) return;
      var payload = JSON.stringify({ forms: schemas });
      var hash = simpleHash(payload);
      // N'envoyer que si le schéma a changé depuis la dernière fois
      var lastHash = null;
      try { lastHash = localStorage.getItem(SCHEMA_HASH_KEY); } catch(e) {}
      if (lastHash === hash) {
        log('info', 'Schéma des formulaires inchangé, envoi ignoré');
        return;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ECRM.formSchemaEndpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('x-api-key', ECRM.apiKey);
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { localStorage.setItem(SCHEMA_HASH_KEY, hash); } catch(e) {}
          log('info', 'Schéma des formulaires envoyé:', schemas.length, 'formulaire(s)');
        }
      };
      xhr.send(payload);
    } catch(e) {
      log('warn', 'Erreur envoi schéma formulaires:', e);
    }
  }

  // ─── Attach form listeners ───
  function attachListeners() {
    log('info', 'EduCRM Tracker initialise (org: ' + ECRM.orgSlug + ', visitor: ' + ECRM.visitorId + ', pageviewTracking: ${pageviewTrackingEnabled})');

    ${pageviewTrackingEnabled ? `
    // Pageview tracking activé pour cette organisation
    startEngagementTracking();
    trackPageView();
    setupSpaTracking();
    startHeartbeat();
    ` : `
    // Pageview tracking désactivé pour cette organisation
    log('info', 'Tracking de pages vues désactivé (activable depuis les paramètres TalibCRM)');
    `}

    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      // Les formulaires Gravity sont gérés par setupGravityForms (AJAX) → on les ignore ici
      if (form.id && form.id.indexOf('gform_') === 0) return;
      if (!shouldCapture(form)) { log('info', 'Formulaire ignoré:', form.id || form.action); return; }
      var data = extractFormData(form);
      sendLead(data);
    }, true);

    // Support des formulaires Gravity Forms (soumission AJAX)
    setupGravityForms();
    // Remonter le schéma des formulaires au CRM (différé pour ne pas gêner le chargement)
    setTimeout(sendFormSchemas, 1500);
    setTimeout(sendFormSchemas, 4000);
    if (typeof window.jQuery !== 'undefined') {
      window.jQuery(document).on('gform_post_render', function() {
        setTimeout(sendFormSchemas, 300);
      });
    }
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
  ECRM.getSession = function() { return ECRM.sessionData; };

  // ─── Chatbot Module (inchangé) ───
  function initChatbot() {
    fetch('${baseUrl}/api/chatbot/config?id=' + ECRM.orgSlug)
      .then(function(r) { return r.json(); })
      .catch(function() { return { enabled: false }; })
      .then(function(config) {
        if (!config.enabled) return;
        renderChatbot(config);
      });
  }

  function renderChatbot(config) {
    var scenario = config.scenario;
    var currentStepId = scenario[0].id;
    var collected = {};
    var history = [];
    var open = false;

    var primary = config.primaryColor || '#1B4F72';
    var position = config.position === 'bottom-left' ? 'left:24px;' : 'right:24px;';

    var bubble = document.createElement('div');
    bubble.id = '_ecrm_chat_bubble';
    bubble.style.cssText = 'position:fixed;bottom:24px;' + position + 'z-index:999998;width:60px;height:60px;border-radius:50%;background:' + primary + ';box-shadow:0 4px 16px rgba(0,0,0,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
    bubble.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    bubble.onmouseover = function() { bubble.style.transform = 'scale(1.1)'; };
    bubble.onmouseout = function() { bubble.style.transform = 'scale(1)'; };
    bubble.onclick = toggleChat;
    document.body.appendChild(bubble);

    var chat = document.createElement('div');
    chat.id = '_ecrm_chat';
    chat.style.cssText = 'position:fixed;bottom:96px;' + position + 'z-index:999999;width:360px;max-width:calc(100vw - 48px);height:520px;max-height:calc(100vh - 120px);background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.16);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    chat.innerHTML =
      '<div style="background:' + primary + ';padding:16px;color:white;display:flex;align-items:center;gap:10px;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;">' + (config.agentName || 'A')[0].toUpperCase() + '</div>' +
        '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">' + (config.agentName || 'Conseiller') + '</div>' +
        '<div style="font-size:11px;opacity:0.8;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>En ligne</div></div>' +
        '<button id="_ecrm_close" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;line-height:1;padding:4px;">×</button>' +
      '</div>' +
      '<div id="_ecrm_messages" style="flex:1;overflow-y:auto;padding:16px;background:#f9fafb;"></div>' +
      '<div id="_ecrm_input_zone" style="border-top:1px solid #e5e7eb;padding:12px;background:white;"></div>';
    document.body.appendChild(chat);

    document.getElementById('_ecrm_close').onclick = toggleChat;

    function toggleChat() {
      open = !open;
      chat.style.display = open ? 'flex' : 'none';
      if (open && history.length === 0) {
        addBotMessage(config.welcomeMessage || 'Bonjour !');
        setTimeout(function() { goToStep(currentStepId); }, 600);
      }
    }

    function addBotMessage(text) {
      var div = document.createElement('div');
      div.style.cssText = 'margin-bottom:12px;display:flex;gap:8px;';
      div.innerHTML =
        '<div style="width:28px;height:28px;border-radius:50%;background:' + primary + ';color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;flex-shrink:0;">' + (config.agentName || 'A')[0].toUpperCase() + '</div>' +
        '<div style="background:white;padding:10px 14px;border-radius:12px;border-top-left-radius:4px;max-width:240px;font-size:13px;color:#1f2937;line-height:1.5;border:1px solid #e5e7eb;">' + escapeHtml(text) + '</div>';
      document.getElementById('_ecrm_messages').appendChild(div);
      scrollToBottom();
      history.push({ from: 'bot', text: text });
    }

    function addUserMessage(text) {
      var div = document.createElement('div');
      div.style.cssText = 'margin-bottom:12px;display:flex;gap:8px;justify-content:flex-end;';
      div.innerHTML =
        '<div style="background:' + primary + ';color:white;padding:10px 14px;border-radius:12px;border-top-right-radius:4px;max-width:240px;font-size:13px;line-height:1.5;">' + escapeHtml(text) + '</div>';
      document.getElementById('_ecrm_messages').appendChild(div);
      scrollToBottom();
      history.push({ from: 'user', text: text });
    }

    function scrollToBottom() {
      var msgs = document.getElementById('_ecrm_messages');
      msgs.scrollTop = msgs.scrollHeight;
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function goToStep(stepId) {
      var step = scenario.find(function(s) { return s.id === stepId; });
      if (!step) return;
      currentStepId = stepId;
      addBotMessage(step.message);
      var inputZone = document.getElementById('_ecrm_input_zone');
      inputZone.innerHTML = '';

      if (step.type === 'bot' && step.options) {
        step.options.forEach(function(opt) {
          var btn = document.createElement('button');
          btn.style.cssText = 'display:block;width:100%;margin:0 0 6px 0;padding:10px;background:white;border:1px solid ' + primary + ';color:' + primary + ';border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;transition:background 0.15s;';
          btn.textContent = opt.label;
          btn.onmouseover = function() { btn.style.background = primary + '15'; };
          btn.onmouseout = function() { btn.style.background = 'white'; };
          btn.onclick = function() {
            addUserMessage(opt.label);
            if (opt.context) collected.programLevel = opt.context;
            inputZone.innerHTML = '';
            setTimeout(function() { goToStep(opt.next); }, 400);
          };
          inputZone.appendChild(btn);
        });
      } else if (step.type === 'input') {
        var input = document.createElement('input');
        input.type = step.field === 'email' ? 'email' : (step.field === 'phone' ? 'tel' : 'text');
        input.placeholder = 'Votre réponse...';
        input.style.cssText = 'flex:1;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;outline:none;';
        var sendBtn = document.createElement('button');
        sendBtn.style.cssText = 'padding:10px 14px;background:' + primary + ';color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;';
        sendBtn.textContent = '→';
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:6px;';
        wrap.appendChild(input);
        wrap.appendChild(sendBtn);
        inputZone.appendChild(wrap);
        var handleSend = function() {
          var val = input.value.trim();
          if (!val) return;
          addUserMessage(val);
          collected[step.field] = val;
          inputZone.innerHTML = '';
          setTimeout(function() { goToStep(step.next); }, 400);
        };
        sendBtn.onclick = handleSend;
        input.addEventListener('keypress', function(e) { if (e.key === 'Enter') handleSend(); });
        setTimeout(function() { input.focus(); }, 100);
      } else if (step.type === 'submit') {
        fetch('${baseUrl}/api/chatbot/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: ECRM.orgSlug,
            firstName: collected.firstName || '',
            lastName: collected.lastName || '',
            phone: collected.phone || '',
            email: collected.email || '',
            message: collected.message || '',
            programLevel: collected.programLevel || '',
            history: history,
          }),
        }).then(function(r) { return r.json(); })
          .then(function(result) { log('info', 'Chatbot lead submitted:', result); })
          .catch(function(e) { log('warn', 'Chatbot submit error:', e); });
      }
    }
  }

  // ─── Init ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); initChatbot(); });
  } else {
    init();
    initChatbot();
  }
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      // Cache court : 60s pour que les changements ON/OFF se propagent rapidement
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}