import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Sert le bouton flottant « Discuter sur WhatsApp » embarquable sur le site de l'école.
// Usage : <script src="https://app.talibcrm.com/api/widget/whatsapp.js?org=ism-dakar" async></script>
// Le bouton ouvre wa.me vers le numéro Cloud API de l'org, avec un message pré-rempli.

function emptyScript() {
  // Script no-op : rien ne s'affiche (widget désactivé ou numéro absent).
  return new NextResponse("/* TalibCRM WhatsApp widget: inactif */", {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("org") || "";
  if (!slug) return emptyScript();

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      whatsappWidgetConfig: true,
      whatsappIntegration: {
        select: { isActive: true, displayPhoneNumber: true },
      },
    },
  });

  const config = org?.whatsappWidgetConfig;
  const integration = org?.whatsappIntegration;

  // Conditions d'affichage : widget activé + numéro WhatsApp actif présent.
  if (!config?.enabled || !integration?.isActive || !integration.displayPhoneNumber) {
    return emptyScript();
  }

  // wa.me exige le numéro au format international sans + ni espaces.
  const waNumber = integration.displayPhoneNumber.replace(/\D/g, "");
  if (!waNumber) return emptyScript();

  // Valeurs injectées via JSON.stringify pour neutraliser toute injection.
  const CFG = {
    number: waNumber,
    title: config.title,
    welcome: config.welcomeMessage,
    replyTime: config.replyTimeText,
    prefill: config.prefilledMessage,
    color: config.primaryColor,
    position: config.position === "bottom-left" ? "bottom-left" : "bottom-right",
  };

  const js = `
(function() {
  'use strict';
  if (window.__tcrmWaWidget) return;
  window.__tcrmWaWidget = true;

  var C = ${JSON.stringify(CFG)};
  var side = C.position === 'bottom-left' ? 'left' : 'right';
  var waHref = 'https://wa.me/' + C.number + '?text=' + encodeURIComponent(C.prefill);

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var css = ''
    + '#tcrm-wa{position:fixed;bottom:24px;' + side + ':24px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
    + '#tcrm-wa *{box-sizing:border-box;margin:0;padding:0}'
    + '#tcrm-wa-btn{width:60px;height:60px;border-radius:50%;background:' + C.color + ';border:none;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s}'
    + '#tcrm-wa-btn:hover{transform:scale(1.06)}'
    + '#tcrm-wa-btn svg{width:32px;height:32px}'
    + '#tcrm-wa-card{position:absolute;bottom:76px;' + side + ':0;width:320px;max-width:calc(100vw - 48px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s,transform .18s}'
    + '#tcrm-wa.open #tcrm-wa-card{opacity:1;transform:translateY(0);pointer-events:auto}'
    + '#tcrm-wa-head{background:' + C.color + ';padding:16px 18px;display:flex;gap:12px;align-items:flex-start}'
    + '#tcrm-wa-head .ic{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '#tcrm-wa-head .ic svg{width:22px;height:22px}'
    + '#tcrm-wa-head h4{color:#fff;font-size:15px;font-weight:700;line-height:1.2}'
    + '#tcrm-wa-head p{color:rgba(255,255,255,.92);font-size:12px;margin-top:4px;line-height:1.35}'
    + '#tcrm-wa-body{padding:10px 14px 14px}'
    + '#tcrm-wa-body .rt{font-size:11px;color:#9ca3af;padding:6px 2px 10px}'
    + '#tcrm-wa-row{display:flex;align-items:center;gap:12px;border:1px solid #e5e7eb;border-radius:12px;padding:12px;text-decoration:none;transition:background .12s}'
    + '#tcrm-wa-row:hover{background:#f9fafb}'
    + '#tcrm-wa-row .av{width:36px;height:36px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '#tcrm-wa-row .av svg{width:20px;height:20px}'
    + '#tcrm-wa-row .nm{flex:1;font-size:14px;font-weight:600;color:#1f2937}'
    + '#tcrm-wa-row .go{color:#25D366}'
    + '#tcrm-wa-row .go svg{width:20px;height:20px}'
    + '#tcrm-wa-close{position:absolute;top:10px;' + (side === 'left' ? 'right' : 'left') + ':10px;width:22px;height:22px;border:none;background:rgba(255,255,255,.25);color:#fff;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center}';

  var waIcon = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 .9-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8.3 8.3 0 1 1 12 20.3z"/></svg>';
  var chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'tcrm-wa';
    root.innerHTML = ''
      + '<div id="tcrm-wa-card" role="dialog" aria-label="' + esc(C.title) + '">'
      +   '<button id="tcrm-wa-close" aria-label="Fermer">&times;</button>'
      +   '<div id="tcrm-wa-head"><div class="ic">' + waIcon + '</div>'
      +     '<div><h4>' + esc(C.title) + '</h4><p>' + esc(C.welcome) + '</p></div></div>'
      +   '<div id="tcrm-wa-body">'
      +     (C.replyTime ? '<div class="rt">' + esc(C.replyTime) + '</div>' : '')
      +     '<a id="tcrm-wa-row" href="' + waHref + '" target="_blank" rel="noopener">'
      +       '<span class="av">' + waIcon + '</span>'
      +       '<span class="nm">WhatsApp</span>'
      +       '<span class="go">' + chevron + '</span></a>'
      +   '</div>'
      + '</div>'
      + '<button id="tcrm-wa-btn" aria-label="' + esc(C.title) + '">' + waIcon + '</button>';
    document.body.appendChild(root);

    var btn = root.querySelector('#tcrm-wa-btn');
    var close = root.querySelector('#tcrm-wa-close');
    btn.addEventListener('click', function() { root.classList.toggle('open'); });
    close.addEventListener('click', function() { root.classList.remove('open'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300", // 5 min : réactivité aux changements de config
    },
  });
}
