import type { FormSettings } from "@/lib/forms";

// CSS de base d'un formulaire rendu, piloté par les réglages (couleurs, rayon…).
// Toutes les classes sont préfixées .talib-form pour que le CSS personnalisé puisse cibler.
export function formBaseCss(s: FormSettings): string {
  const color = s.color || "#2471A3";
  const btn = s.buttonColor || color;
  const text = s.textColor || "#1A2229";
  const r = typeof s.radius === "number" ? s.radius : 12;
  const rad = r + "px";
  return `
.talib-form{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${text};max-width:480px;margin:0 auto;text-align:left}
.talib-form *{box-sizing:border-box}
.talib-form .tf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:440px){.talib-form .tf-row{grid-template-columns:1fr}}
.talib-form .tf-field{margin-bottom:14px}
.talib-form .tf-label{display:block;font-size:13px;font-weight:600;margin-bottom:5px}
.talib-form .tf-req{color:#ef4444}
.talib-form .tf-input,.talib-form .tf-field select,.talib-form .tf-field textarea{width:100%;padding:10px 12px;border:1px solid #d5dbe1;border-radius:${rad};font-size:14px;background:#fff;color:${text}}
.talib-form .tf-input:focus,.talib-form select:focus,.talib-form textarea:focus{outline:none;border-color:${color};box-shadow:0 0 0 3px ${color}22}
.talib-form textarea{min-height:90px;resize:vertical}
.talib-form .tf-help{font-size:11px;color:#8a939c;margin-top:3px}
.talib-form .tf-heading{font-size:17px;font-weight:800;margin:8px 0 4px}
.talib-form .tf-para{font-size:13px;color:#5b6670;margin:0 0 8px;line-height:1.5}
.talib-form hr.tf-div{border:none;border-top:1px solid #e5e9ed;margin:14px 0}
.talib-form .tf-opt{display:flex;align-items:center;gap:8px;font-size:14px;margin:6px 0;cursor:pointer}
.talib-form .tf-consent{display:flex;gap:8px;font-size:12.5px;color:#5b6670;line-height:1.4;margin:2px 0 12px}
.talib-form .tf-submit{width:100%;padding:12px;background:${btn};color:#fff;border:none;border-radius:${rad};font-size:15px;font-weight:700;cursor:pointer;margin-top:4px}
.talib-form .tf-submit:disabled{opacity:.6;cursor:not-allowed}
.talib-form .tf-powered{text-align:center;font-size:11px;color:#9ca3af;margin-top:14px}
.talib-form .tf-powered a{color:#6b7280;text-decoration:none}
${s.customCss || ""}
`;
}
