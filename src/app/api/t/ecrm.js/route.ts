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

  // ─── First-touch attribution (persistant, self-referral exclu) ───
  var FIRST_TOUCH_KEY = '_ecrm_ft';

  function currentHost() {
    try { return (window.location.hostname || '').replace(/^www\\./, ''); } catch(e) { return ''; }
  }

  // Referrer uniquement s'il est EXTERNE (ignore les navigations internes = self-referral).
  function referrerIfExternal() {
    var r = document.referrer || '';
    if (!r) return '';
    try {
      var h = new URL(r).hostname.replace(/^www\\./, '');
      if (h && h === currentHost()) return '';
      return r;
    } catch(e) { return ''; }
  }

  // Capture l'attribution d'ENTRÉE une seule fois (localStorage), indépendamment du tracking
  // de pages vues. Une campagne (utm/gclid/fbclid) écrase (dernière campagne = acquisition) ;
  // sinon on ne fixe le referrer externe qu'à la première visite. Les self-referrals sont exclus.
  function captureFirstTouch() {
    var cur = captureCurrentSource();
    var extRef = referrerIfExternal();
    var hasCampaign = !!(cur.utm_source || cur.gclid || cur.fbclid);
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || 'null'); } catch(e) {}

    if (hasCampaign) {
      var ft = {
        referrer: extRef || '',
        utm_source: cur.utm_source || '', utm_medium: cur.utm_medium || '',
        utm_campaign: cur.utm_campaign || '', utm_content: cur.utm_content || '',
        utm_term: cur.utm_term || '', gclid: cur.gclid || '', fbclid: cur.fbclid || '',
      };
      try { localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(ft)); } catch(e) {}
      return ft;
    }
    if (!stored && extRef) {
      var ft2 = { referrer: extRef, utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '', gclid: '', fbclid: '' };
      try { localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(ft2)); } catch(e) {}
      return ft2;
    }
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
    demande: 'message',
    subject: 'subject', sujet: 'subject', objet: 'subject', motif: 'subject',
  };

// ─── Extract form data ───
  function extractFormData(form) {
    var data = {};
    var raw = {};
    var mappedKeys = {}; // clés brutes déjà mappées vers un champ principal
    var elements = form.elements;

    // Clés principales connues (si une valeur atterrit là, la clé brute est "consommée")
    var CORE_KEYS = ['firstName','lastName','phone','email','whatsapp','city','filière','campus','niveau','message','subject','_fullName'];

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name && !el.id) continue;
      if (el.type === 'submit' || el.type === 'button') continue;
      if (el.type === 'hidden' && !el.name) continue;
      if (el.type === 'password' || el.type === 'file') continue;
      if (el.type === 'checkbox' && !el.checked) continue;
      if (el.type === 'radio' && !el.checked) continue;
      // Ignorer les champs cachés : selects conditionnels Gravity non affichés
      // (ils ont une valeur par défaut résiduelle qui pollue la capture)
      if (el.offsetParent === null && el.type !== 'hidden') continue;

      var key = (el.name || el.id || '').toLowerCase().trim();
      var value = getFieldValue(el); // ignore les placeholders de <select>
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
      ['sujet', 'subject'], ['objet', 'subject'], ['subject', 'subject'], ['motif', 'subject'],
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

  // Placeholder d'un <select> ("Sélectionnez...", "Choisir...", option désactivée) → valeur vide.
  // Évite de capturer le texte du placeholder (ex. Gravity "Sélectionnez le diplôme recherché").
  var PLACEHOLDER_RE = /^\\s*(s[ée]lectionn|choisi|choisir|choisissez|s[ée]lect|veuillez|please|--|—|\\.\\.\\.)/i;
  function getFieldValue(el) {
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'select') return (el.value || '').trim();
    var v = (el.value || '').trim();
    if (!v) return '';
    var opt = (el.options && el.selectedIndex >= 0) ? el.options[el.selectedIndex] : null;
    if (opt && opt.disabled) return '';
    var txt = (opt && opt.text ? opt.text : v).trim();
    if (PLACEHOLDER_RE.test(v) || PLACEHOLDER_RE.test(txt)) return '';
    return v;
  }

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
    // Attribution : first-touch persistant (self-referral exclu) en priorité, session en secours.
    var _ft = captureFirstTouch();
    var _src = ECRM.sessionData || getOrCreateSession();
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
      subject: data.subject || '',
      niveau: data.niveau || '',
      _capturedBy: 'ecrm-tracker',
      _pageUrl: data._pageUrl || '',
      _visitorId: ECRM.visitorId,
      // ── Attribution : first-touch (persistant) prioritaire, session en secours ──
      _referrer:    (_ft && _ft.referrer)    || referrerIfExternal() || '',
      utm_source:   (_ft && _ft.utm_source)  || (_src && _src.utm_source)   || '',
      utm_medium:   (_ft && _ft.utm_medium)  || (_src && _src.utm_medium)   || '',
      utm_campaign: (_ft && _ft.utm_campaign)|| (_src && _src.utm_campaign) || '',
      utm_content:  (_ft && _ft.utm_content) || (_src && _src.utm_content)  || '',
      utm_term:     (_ft && _ft.utm_term)    || (_src && _src.utm_term)     || '',
      gclid:        (_ft && _ft.gclid)       || (_src && _src.gclid)        || '',
      fbclid:       (_ft && _ft.fbclid)      || (_src && _src.fbclid)       || '',
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
  // Stratégie : on ACCUMULE les valeurs des champs que l'utilisateur modifie
  // (input/change), sans jamais effacer une valeur déjà saisie. Cela résout :
  //   - les champs conditionnels cachés (un champ rempli reste, même s'il est masqué ensuite)
  //   - les valeurs résiduelles des selects jamais touchés (ils ne déclenchent pas de change)
  // On mémorise aussi le LABEL de chaque champ (pour mapper input_1.3 → "Prénom").
  // Puis on envoie le lead quand Gravity confirme le succès (gform_confirmation_loaded).
  var _gravityRaw = {};         // _gravityRaw[formId] = { "input_37": "Ingénierie Électrique", ... }
  var _gravityCheckbox = {};    // _gravityCheckbox[formId] = { "input_31": { "Sciences": true, ... } }
  var _gravityLabels = {};      // _gravityLabels[formId] = { "input_1.3": "prénom", ... }

  function isGravityForm(form) {
    return form && form.id && form.id.indexOf('gform_') === 0;
  }

  function accumulateField(form, el) {
    var formId = form.id.replace('gform_', '');
    var key = (el.name || el.id || '').trim();
    if (!key) return;
    // Ignorer les champs techniques Gravity et les conteneurs fieldset
    if (/^(gform_|is_submit_|state_|gform_target|gform_source|gform_field_values|gform_unique_id|gform_resume|gform_save|field_)/i.test(key)) return;
    if (el.type === 'submit' || el.type === 'button' || el.type === 'password' || el.type === 'file') return;

    if (!_gravityRaw[formId]) _gravityRaw[formId] = {};
    if (!_gravityLabels[formId]) _gravityLabels[formId] = {};

    // ── Checkboxes : regrouper par champ parent (input_31.1, input_31.2 → input_31) ──
    if (el.type === 'checkbox') {
      var parentKey = key.indexOf('.') !== -1 ? key.substring(0, key.lastIndexOf('.')) : key;
      if (!_gravityCheckbox[formId]) _gravityCheckbox[formId] = {};
      if (!_gravityCheckbox[formId][parentKey]) _gravityCheckbox[formId][parentKey] = {};
      if (el.checked && el.value) {
        _gravityCheckbox[formId][parentKey][el.value] = true;
      } else {
        delete _gravityCheckbox[formId][parentKey][el.value];
      }
      var vals = Object.keys(_gravityCheckbox[formId][parentKey]);
      if (vals.length > 0) {
        _gravityRaw[formId][parentKey] = vals.join(', ');
      } else {
        delete _gravityRaw[formId][parentKey];
      }
      return;
    }

    // ── Radio : on prend la valeur cochée ──
    if (el.type === 'radio') {
      if (el.checked && el.value) {
        _gravityRaw[formId][key] = el.value.trim();
        var rlbl = getLabelText(el);
        if (rlbl) _gravityLabels[formId][key] = rlbl;
      }
      return;
    }

    // ── Texte, select, email, tel, textarea... ──
    // getFieldValue ignore les placeholders de <select> ("Sélectionnez...").
    var value = getFieldValue(el);
    // On ne stocke QUE les valeurs non vides → un champ rempli n'est jamais effacé par du vide.
    if (value) {
      _gravityRaw[formId][key] = value;
      var lbl = getLabelText(el);
      if (lbl) _gravityLabels[formId][key] = lbl;
    }
  }

  // Un champ Gravity est "actif" si son conteneur .gfield est VISIBLE — même si
  // l'élément natif est masqué par un widget "amélioré" (select2/chosen/thème) qui
  // affiche un faux contrôle et cache le vrai <select>. En se basant sur le conteneur
  // plutôt que sur l'élément natif, on : (a) rattrape ces selects améliorés (cause
  // probable des selects conditionnels ratés sur le trafic payant), (b) continue
  // d'ignorer les champs conditionnels réellement masqués (wrapper caché) → aucune
  // valeur résiduelle des branches non choisies.
  function gravityFieldActive(el) {
    var wrap = el.closest ? el.closest('.gfield') : null;
    if (wrap) return wrap.offsetParent !== null;
    // Pas de conteneur .gfield : repli sur l'ancien critère (élément visible, ou textarea).
    return el.offsetParent !== null || el.tagName === 'TEXTAREA';
  }

  // Passe de capture : accumule tous les champs actifs du formulaire. Utilisée au clic
  // du bouton ET à la soumission. N'ENVOIE rien — l'envoi reste géré par
  // gform_confirmation_loaded.
  function gravityCapturePass(form) {
    // TinyMCE (éditeur riche WordPress) : recopier le contenu vers les textarea.
    try { if (window.tinymce && window.tinymce.triggerSave) window.tinymce.triggerSave(); } catch(e) {}
    var els = form.elements;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;
      if (!gravityFieldActive(el)) continue;
      accumulateField(form, el);
    }
  }

  // Construit l'objet lead à partir des valeurs brutes accumulées,
  // en réutilisant la logique de mapping (clé → label → contenu).
  function buildLeadFromRaw(formId) {
    var raw = _gravityRaw[formId] || {};
    var labels = _gravityLabels[formId] || {};
    var data = {};
    var mappedKeys = {};

    Object.keys(raw).forEach(function(key) {
      var value = raw[key];
      if (!value) return;
      var keyLower = key.toLowerCase();

      // 1. Mapping direct par nom de champ
      var mapped = FIELD_MAP[keyLower];
      if (mapped) { if (!data[mapped]) { data[mapped] = value; mappedKeys[key] = true; } return; }

      // 2. Correspondance partielle sur le nom
      var partialMatch = findPartialMatch(keyLower);
      if (partialMatch) { if (!data[partialMatch]) { data[partialMatch] = value; mappedKeys[key] = true; } return; }

      // 3. Correspondance via le LABEL — UNIQUEMENT pour les champs d'identité
      // (prénom/nom composites Gravity). Les champs métier (programme, formation...)
      // doivent passer en brut pour être mappés côté serveur via les customFields.
      var labelMatch = findPartialMatch(labels[key] || '');
      if (labelMatch === 'firstName' || labelMatch === 'lastName' || labelMatch === '_fullName' ||
          labelMatch === 'email' || labelMatch === 'phone') {
        if (!data[labelMatch]) { data[labelMatch] = value; mappedKeys[key] = true; }
        return;
      }

      // 4. Détection par contenu (email / téléphone)
      if (!data.email && isEmail(value)) { data.email = value; mappedKeys[key] = true; return; }
      if (!data.phone && isPhone(value)) { data.phone = value; mappedKeys[key] = true; return; }
    });

    if (data._fullName && (!data.firstName || !data.lastName)) {
      var parts = data._fullName.trim().split(/\s+/);
      if (!data.firstName) data.firstName = parts[0] || '';
      if (!data.lastName) data.lastName = parts.slice(1).join(' ') || parts[0] || '';
      delete data._fullName;
    }

    // _raw = uniquement les clés non mappées vers un champ principal
    var cleanRaw = {};
    Object.keys(raw).forEach(function(k) {
      if (!mappedKeys[k]) cleanRaw[k] = raw[k];
    });

    data._raw = cleanRaw;
    data._formId = 'gform_' + formId;
    data._pageUrl = window.location.href;
    data._pageTitle = document.title;
    return data;
  }

  function setupGravityForms() {
    if (typeof window.jQuery === 'undefined') return;
    var $ = window.jQuery;

    // 1. Accumuler la valeur du champ modifié (sans effacer les autres)
    function onFieldEvent(e) {
      var el = e.target;
      var form = el && el.form;
      if (!isGravityForm(form)) return;
      accumulateField(form, el);
    }
    document.addEventListener('input', onFieldEvent, true);
    document.addEventListener('change', onFieldEvent, true);

    // 1bis. Passe de capture au CLIC du bouton d'envoi.
    // Gravity AJAX ne déclenche PAS d'événement 'submit' natif, mais le clic sur le
    // bouton "Envoyer" se produit toujours, AVANT la soumission AJAX (formulaire encore
    // présent et visible). On rattrape ici les selects conditionnels auto-remplis.
    document.addEventListener('click', function(e) {
      var btn = e.target;
      if (!btn) return;
      var realBtn = (btn.tagName === 'BUTTON' || btn.tagName === 'INPUT') ? btn
                    : (btn.closest ? btn.closest('button, input[type="submit"]') : null);
      if (!realBtn) return;
      var form = realBtn.form || (realBtn.closest && realBtn.closest('form'));
      if (!isGravityForm(form)) return;
      var isSubmit = realBtn.type === 'submit' || /gform_button|gform-button|gform_next_button/i.test(realBtn.className || '');
      if (!isSubmit) return;
      gravityCapturePass(form);
      log('info', 'Gravity: capture au clic du bouton pour', form.id);
    }, true);

    // 2. Envoyer quand Gravity confirme le succès de la soumission AJAX
    $(document).on('gform_confirmation_loaded', function(event, formId) {
      var key = String(formId);

      // ── Passe finale : capturer les champs VISIBLES non encore accumulés ──
      // Rattrape les selects conditionnels auto-remplis ou laissés sur leur valeur
      // par défaut (aucun event 'change' déclenché). On ne lit QUE les champs visibles
      // (offsetParent !== null) → les selects cachés des branches non choisies sont ignorés,
      // ce qui évite les valeurs résiduelles.

      var raw = _gravityRaw[key];
      if (!raw || Object.keys(raw).length === 0) {
        log('info', 'Gravity: confirmation reçue mais aucune donnée capturée pour', formId);
        return;
      }
      var data = buildLeadFromRaw(key);
      log('info', 'Gravity: soumission confirmée, envoi du lead pour le formulaire', formId);
      sendLead(data);
      delete _gravityRaw[key];
      delete _gravityCheckbox[key];
      delete _gravityLabels[key];
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
        // Ignorer les conteneurs (fieldset) et pseudo-champs de structure Gravity
        if (el.type === 'fieldset' || el.tagName.toLowerCase() === 'fieldset') continue;
        if (/^field_/i.test(nm)) continue;
        // Pour les checkboxes Gravity (input_14.1, input_31.2...), utiliser le name PARENT
        // (input_14, input_31) — cohérent avec ce que le tracker envoie à la soumission.
        var effectiveName = nm;
        if (el.type === 'checkbox' && nm.indexOf('.') !== -1) {
          effectiveName = nm.substring(0, nm.lastIndexOf('.'));
        }
        if (seen[effectiveName]) continue;
        seen[effectiveName] = true;
        fields.push({
          name: effectiveName,
          type: el.type || el.tagName.toLowerCase(),
          label: getLabelTextRaw(el),
        });
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

    // Attribution first-touch : enregistrée dès le chargement, même si le tracking de pages vues est off.
    captureFirstTouch();

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
      // Gravity : passe de capture finale au submit (couvre la soumission au clavier /
      // programmatique) ; l'ENVOI reste géré par gform_confirmation_loaded (AJAX).
      if (form.id && form.id.indexOf('gform_') === 0) { gravityCapturePass(form); return; }
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
        // Chatbot IA actif → conversation d'emblée (champ + raccourcis) ; sinon menu scripté.
        if (config.knowledgeEnabled) {
          setTimeout(function() { enterAiHome(); }, 600);
        } else {
          setTimeout(function() { goToStep(currentStepId); }, 600);
        }
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

    // ─── Mode IA : le chatbot répond à partir des documents de l'école ───
    // Activé quand config.knowledgeEnabled : la saisie libre devient une vraie
    // conversation (POST /api/chatbot/ask) au lieu d'une simple capture.
    var aiCaptureNext = 'ask_name';

    function showCaptureButton() {
      var inputZone = document.getElementById('_ecrm_input_zone');
      if (!inputZone || document.getElementById('_ecrm_capture_btn')) return;
      var b = document.createElement('button');
      b.id = '_ecrm_capture_btn';
      b.textContent = 'Laisser mes coordonnées';
      b.style.cssText = 'display:block;width:100%;margin:0 0 8px 0;padding:10px;background:' + primary + ';color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;';
      b.onclick = function() { goToStep(aiCaptureNext); };
      inputZone.insertBefore(b, inputZone.firstChild);
    }

    function askAI(question, inputEl, sendEl) {
      if (!question) return;
      addUserMessage(question);
      if (inputEl) inputEl.value = '';
      var typing = document.createElement('div');
      typing.id = '_ecrm_typing';
      typing.style.cssText = 'margin-bottom:12px;font-size:12px;color:#9ca3af;padding-left:36px;';
      typing.textContent = (config.agentName || 'Assistant') + ' écrit…';
      document.getElementById('_ecrm_messages').appendChild(typing);
      scrollToBottom();
      if (inputEl) inputEl.disabled = true;
      if (sendEl) sendEl.disabled = true;
      var reenable = function() { if (inputEl) { inputEl.disabled = false; inputEl.focus(); } if (sendEl) sendEl.disabled = false; };
      fetch('${baseUrl}/api/chatbot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: ECRM.orgSlug, question: question, history: history.slice(-10) }),
      }).then(function(r) { return r.json(); })
        .then(function(res) {
          var t = document.getElementById('_ecrm_typing'); if (t) t.remove();
          addBotMessage((res && res.reply) ? res.reply : "Je préfère laisser un conseiller vous répondre.");
          if (res && res.shouldCaptureLead) showCaptureButton();
          reenable();
        })
        .catch(function() {
          var t = document.getElementById('_ecrm_typing'); if (t) t.remove();
          addBotMessage("Je rencontre un souci technique. Laissez-moi vos coordonnées.");
          showCaptureButton();
          reenable();
        });
    }

    function enterAiMode(captureNext, suggestions) {
      aiCaptureNext = captureNext || 'ask_name';
      var inputZone = document.getElementById('_ecrm_input_zone');
      inputZone.innerHTML = '';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Posez votre question...';
      input.style.cssText = 'flex:1;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;outline:none;';
      var sendBtn = document.createElement('button');
      sendBtn.style.cssText = 'padding:10px 14px;background:' + primary + ';color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;';
      sendBtn.textContent = '→';
      var send = function() { var v = input.value.trim(); if (v) askAI(v, input, sendBtn); };
      // Raccourcis : chaque bouton envoie une question à l'IA (ou bascule en capture pour le RDV).
      (suggestions || []).forEach(function(sug) {
        var b = document.createElement('button');
        b.style.cssText = 'display:block;width:100%;margin:0 0 6px 0;padding:9px 10px;background:white;border:1px solid ' + primary + ';color:' + primary + ';border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;';
        b.textContent = sug.label;
        b.onclick = function() { sug.onClick(input, sendBtn); };
        inputZone.appendChild(b);
      });
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:6px;';
      wrap.appendChild(input);
      wrap.appendChild(sendBtn);
      inputZone.appendChild(wrap);
      var talk = document.createElement('button');
      talk.textContent = 'Parler à un conseiller';
      talk.style.cssText = 'display:block;width:100%;margin-top:8px;padding:8px;background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;text-decoration:underline;';
      talk.onclick = function() { goToStep(aiCaptureNext); };
      inputZone.appendChild(talk);
      // Transparence : mention que les réponses sont générées par IA.
      var aiNote = document.createElement('div');
      aiNote.textContent = '✨ Réponses générées par IA — peuvent contenir des erreurs.';
      aiNote.style.cssText = 'margin-top:6px;font-size:10px;color:#9ca3af;text-align:center;line-height:1.4;';
      inputZone.appendChild(aiNote);
      sendBtn.onclick = send;
      input.addEventListener('keypress', function(e) { if (e.key === 'Enter') send(); });
      setTimeout(function() { input.focus(); }, 100);
    }

    // Entrée « IA d'emblée » : dès l'ouverture, champ de saisie + raccourcis.
    // Priorité aux suggestions dynamiques generées par l'IA depuis les documents ;
    // sinon repli sur les options du scénario. La prise de RDV reste un raccourci de capture.
    function enterAiHome() {
      var suggestions = [];
      var dyn = config.suggestedQuestions;
      if (dyn && dyn.length) {
        dyn.forEach(function(q) {
          suggestions.push({ label: q, onClick: function(inputEl, sendEl) { askAI(q, inputEl, sendEl); } });
        });
      } else {
        var start = scenario[0];
        var opts = (start && start.options) ? start.options : [];
        opts.forEach(function(opt) {
          var target = scenario.find(function(s) { return s.id === opt.next; });
          if (target && target.type === 'input' && target.field === 'message') return; // saisie libre = champ
          if (/rdv|rendez.?vous/i.test(opt.label)) return; // RDV ajouté à part ci-dessous
          suggestions.push({ label: opt.label, onClick: function(inputEl, sendEl) { askAI(opt.label, inputEl, sendEl); } });
        });
      }
      // Toujours proposer la prise de RDV (capture de lead) si le scénario la prévoit.
      var startOpts = (scenario[0] && scenario[0].options) ? scenario[0].options : [];
      var rdvOpt = startOpts.filter(function(o) { return /rdv|rendez.?vous/i.test(o.label); })[0];
      if (rdvOpt) suggestions.push({ label: rdvOpt.label, onClick: function() { goToStep(rdvOpt.next); } });
      enterAiMode('ask_name', suggestions);
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
        // Question libre + mode IA activé → conversation avec les documents de l'école.
        if (config.knowledgeEnabled && step.field === 'message') { enterAiMode(step.next); return; }
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

  // ─── WhatsApp Widget Module ───
  // Bouton flottant qui ouvre wa.me vers le numéro Cloud API de l'org.
  // Activable/désactivable depuis Paramètres → Widget WhatsApp (comme le chatbot).
  function initWhatsAppWidget() {
    fetch('${baseUrl}/api/widget/whatsapp-config?org=' + ECRM.orgSlug)
      .then(function(r) { return r.json(); })
      .catch(function() { return { enabled: false }; })
      .then(function(config) {
        if (!config || !config.enabled) return;
        renderWhatsAppWidget(config);
      });
  }

  function renderWhatsAppWidget(config) {
    // Anti-doublon : si le script autonome /api/widget/whatsapp.js est aussi présent,
    // le premier qui rend gagne (même flag partagé).
    if (window.__tcrmWaWidget) return;
    window.__tcrmWaWidget = true;

    var color = config.color || '#25D366';
    var isLeft = config.position === 'bottom-left';
    var side = isLeft ? 'left:24px;' : 'right:24px;';
    var closeSide = isLeft ? 'right:10px;' : 'left:10px;';
    var waHref = 'https://wa.me/' + config.number + '?text=' + encodeURIComponent(config.prefill || '');
    var open = false;

    function esc(text) {
      var d = document.createElement('div');
      d.textContent = (text == null ? '' : text);
      return d.innerHTML;
    }

    var waIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 .9-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8.3 8.3 0 1 1 12 20.3z"/></svg>';

    // Si un chatbot occupe déjà le même coin, on remonte le bouton WhatsApp pour éviter le chevauchement.
    var chatbotSameSide = !!document.getElementById('_ecrm_chat_bubble');
    var bubbleBottom = chatbotSameSide ? '96px' : '24px';
    var cardBottom = chatbotSameSide ? '168px' : '96px';

    var bubble = document.createElement('div');
    bubble.id = '_tcrm_wa_bubble';
    bubble.style.cssText = 'position:fixed;bottom:' + bubbleBottom + ';' + side + 'z-index:999996;width:60px;height:60px;border-radius:50%;background:' + color + ';box-shadow:0 6px 20px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
    bubble.innerHTML = waIcon;
    bubble.onmouseover = function() { bubble.style.transform = 'scale(1.08)'; };
    bubble.onmouseout = function() { bubble.style.transform = 'scale(1)'; };
    document.body.appendChild(bubble);

    var card = document.createElement('div');
    card.id = '_tcrm_wa_card';
    card.style.cssText = 'position:fixed;bottom:' + cardBottom + ';' + side + 'z-index:999997;width:320px;max-width:calc(100vw - 48px);background:white;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.18);display:none;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    card.innerHTML =
      '<div style="position:relative;background:' + color + ';padding:16px 18px;display:flex;gap:12px;align-items:flex-start;">' +
        '<button id="_tcrm_wa_close" style="position:absolute;top:10px;' + closeSide + 'width:22px;height:22px;border:none;background:rgba(255,255,255,0.25);color:#fff;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;">&times;</button>' +
        '<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + waIcon + '</div>' +
        '<div><div style="color:#fff;font-size:15px;font-weight:700;line-height:1.2;">' + esc(config.title) + '</div>' +
        '<div style="color:rgba(255,255,255,0.92);font-size:12px;margin-top:4px;line-height:1.35;">' + esc(config.welcome) + '</div></div>' +
      '</div>' +
      '<div style="padding:10px 14px 14px;">' +
        (config.replyTime ? '<div style="font-size:11px;color:#9ca3af;padding:6px 2px 10px;">' + esc(config.replyTime) + '</div>' : '') +
        '<a href="' + waHref + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;border:1px solid #e5e7eb;border-radius:12px;padding:12px;text-decoration:none;">' +
          '<span style="width:36px;height:36px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + waIcon + '</span>' +
          '<span style="flex:1;font-size:14px;font-weight:600;color:#1f2937;">WhatsApp</span>' +
          '<span style="color:#25D366;font-size:20px;line-height:1;">&rsaquo;</span>' +
        '</a>' +
      '</div>';
    document.body.appendChild(card);

    function toggle() { open = !open; card.style.display = open ? 'block' : 'none'; }
    bubble.onclick = toggle;
    document.getElementById('_tcrm_wa_close').onclick = function(e) { e.stopPropagation(); toggle(); };
  }

  // ─── Init ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); initChatbot(); initWhatsAppWidget(); });
  } else {
    init();
    initChatbot();
    initWhatsAppWidget();
  }
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      // Cache court : 60s pour que les changements ON/OFF se propagent rapidement
      // 1h de cache CDN + revalidation en arrière-plan : le script est quasi statique
      // (seul le flag webTrackingEnabled varie, tolérant à 1h de délai) — évite une
      // lambda + une requête DB à CHAQUE page vue des sites clients.
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}