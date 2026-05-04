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



  // ─── Chatbot Module ───
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

    // Bubble button
    var bubble = document.createElement('div');
    bubble.id = '_ecrm_chat_bubble';
    bubble.style.cssText = 'position:fixed;bottom:24px;' + position + 'z-index:999998;width:60px;height:60px;border-radius:50%;background:' + primary + ';box-shadow:0 4px 16px rgba(0,0,0,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
    bubble.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    bubble.onmouseover = function() { bubble.style.transform = 'scale(1.1)'; };
    bubble.onmouseout = function() { bubble.style.transform = 'scale(1)'; };
    bubble.onclick = toggleChat;
    document.body.appendChild(bubble);

    // Chat window
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
        // Render option buttons
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
        // Send the lead
        var traffic = trafficData || {};
        try {
          var stored = JSON.parse(sessionStorage.getItem('_ecrm_traffic') || '{}');
          var k = Object.keys(stored);
          for (var i = 0; i < k.length; i++) { if (!traffic[k[i]]) traffic[k[i]] = stored[k[i]]; }
        } catch(e) {}

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
            traffic: traffic,
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}