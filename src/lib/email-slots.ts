// Marqueur inséré par le rendu des blocs (blocksToPreviewHtml) juste avant le
// bloc "footer". Au moment de l'envoi / de l'aperçu, on le remplace par la
// signature de l'expéditeur → la signature apparaît AVANT le footer.
// Si aucun footer n'existe, le marqueur est absent et la signature est
// ajoutée en fin de corps (comportement historique).
export const SIGNATURE_SLOT = "<!--talib-signature-slot-->";

// Marqueurs autour du bloc footer (infos de l'établissement). Quand une signature
// est ajoutée, ce bloc est SUPPRIMÉ pour éviter la redondance (la signature porte
// déjà les coordonnées). Sans signature, on garde le footer et on retire juste les
// marqueurs. Les réseaux sociaux (bloc distinct) sont conservés dans tous les cas.
export const FOOTER_BLOCK_START = "<!--talib-footer-start-->";
export const FOOTER_BLOCK_END = "<!--talib-footer-end-->";

// Index où insérer la signature : juste avant la SECTION de bas d'email
// (1er bloc "social" ou "footer"), pour que la signature soit au-dessus des
// réseaux sociaux et du footer, pas coincée entre eux. -1 s'il n'y en a pas.
export function signatureSlotIndex(blocks: { type: string }[]): number {
  return blocks.findIndex((b) => b.type === "social" || b.type === "footer");
}

function stripFooterMarkers(s: string): string {
  return s.split(FOOTER_BLOCK_START).join("").split(FOOTER_BLOCK_END).join("");
}
function removeFooterBlock(s: string): string {
  var i = s.indexOf(FOOTER_BLOCK_START);
  while (i !== -1) {
    var j = s.indexOf(FOOTER_BLOCK_END, i);
    if (j === -1) return s.slice(0, i);
    s = s.slice(0, i) + s.slice(j + FOOTER_BLOCK_END.length);
    i = s.indexOf(FOOTER_BLOCK_START);
  }
  return s;
}

// Injecte la signature au bon endroit (marqueur SIGNATURE_SLOT, sinon fin de corps).
// Quand une signature est présente, retire le bloc footer (infos école) pour éviter
// la redondance ; sinon garde le footer. Les réseaux sociaux sont toujours conservés.
export function injectSignature(body: string, signatureHtml: string): string {
  var hasSig = !!(signatureHtml && signatureHtml.trim());
  body = hasSig ? removeFooterBlock(body) : stripFooterMarkers(body);
  if (body.includes(SIGNATURE_SLOT)) {
    return body.split(SIGNATURE_SLOT).join(hasSig ? signatureHtml : "");
  }
  return hasSig ? body + signatureHtml : body;
}

// Rend absolues les URLs d'assets servis par l'app (ex: icônes sociales PNG via
// /api/social-icon) — obligatoire pour les emails (Gmail/Outlook exigent des URLs
// absolues et joignables). `base` = URL publique de l'app (NEXTAUTH_URL).
export function absolutizeEmailAssets(html: string, base: string): string {
  if (!base) return html;
  var b = base.replace(/\/$/, "");
  return html
    .split('src="/api/').join('src="' + b + '/api/')
    .split("src='/api/").join("src='" + b + "/api/");
}
