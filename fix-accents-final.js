const fs = require("fs");
const path = require("path");

const REPLACEMENTS = [
  ["Etape", "Étape"], ["etape", "étape"],
  ["Etudiant", "Étudiant"], ["etudiant", "étudiant"],
  ["Etablissement", "Établissement"], ["etablissement", "établissement"],
  ["Ecole", "École"], ["ecole", "école"],
  ["Evenement", "Événement"], ["evenement", "événement"],
  ["selectionne\"", "sélectionné\""], ["selectionnes\"", "sélectionnés\""],
  ["selectionnes)", "sélectionnés)"], ["selectionnee", "sélectionnée"],
  ["Selectionner", "Sélectionner"], ["selectionner", "sélectionner"],
  ["Tout selectionner", "Tout sélectionner"],
  ["Tout deselectionner", "Tout désélectionner"],
  ["Deselectionner", "Désélectionner"], ["deselectionner", "désélectionner"],
  ["Desassigner", "Désassigner"], ["desassigner", "désassigner"],
  ["Selectionnez", "Sélectionnez"], ["selectionnez", "sélectionnez"],
  ["Telephone", "Téléphone"], ["telephone", "téléphone"],
  ["Filiere", "Filière"], ["filiere", "filière"],
  ["Date creation", "Date création"],
  ["Derniere", "Dernière"], ["derniere", "dernière"],
  ["Reinitialiser", "Réinitialiser"], ["reinitialiser", "réinitialiser"],
  ["Personnalises", "Personnalisés"], ["personnalises", "personnalisés"],
  ["Non assigne\"", "Non assigné\""], ["Non assigne)", "Non assigné)"],
  ["assigne(s)", "assigné(s)"], ["Lead assigne", "Lead assigné"],
  ["Lead desassigne", "Lead désassigné"],
  ["supprime(s)", "supprimé(s)"], ["Lead supprime", "Lead supprimé"],
  ["Gerez", "Gérez"], ["gerez", "gérez"],
  ["Cree le", "Créé le"], ["cree le", "créé le"],
  ["Leads crees", "Leads créés"], ["cree avec", "créé avec"],
  ["Verifiez", "Vérifiez"], ["verifiez", "vérifiez"],
  ["Apercu", "Aperçu"], ["apercu", "aperçu"],
  ["Separateur", "Séparateur"], ["separateur", "séparateur"],
  ["Auto-detecte", "Auto-détecté"], ["auto-detecte", "auto-détecté"],
  ["detecte\"", "détecté\""], ["detectes\"", "détectés\""],
  ["detectee", "détectée"], ["detectees", "détectées"],
  ["deja mappe", "déjà mappé"],
  ["colonnes mappees", "colonnes mappées"],
  ["Import termine", "Import terminé"],
  ["complementaires", "complémentaires"], ["Complementaires", "Complémentaires"],
  ["enregistree", "enregistrée"],
  ["Aucune activite", "Aucune activité"],
  ["echange\"", "échangé\""],
  ["Envoye\"", "Envoyé\""], ["envoye\"", "envoyé\""],
  ["Recu\"", "Reçu\""], ["recu\"", "reçu\""],
  ["Echoue\"", "Échoué\""], ["echoue\"", "échoué\""],
  ["mis a jour", "mis à jour"], ["Mis a jour", "Mis à jour"],
  ["mise a jour", "mise à jour"],
  ["Cle API", "Clé API"], ["cle API", "clé API"],
  ["donnees", "données"], ["Donnees", "Données"],
  ["reseau", "réseau"], ["Reseau", "Réseau"],
  [" a importer", " à importer"], [" a traiter", " à traiter"],
  [" a inclure", " à inclure"], ["leads a ", "leads à "],
  ["souhaitee", "souhaitée"], ["Souhaitee", "Souhaitée"],
  ["scolarite", "scolarité"], ["Scolarite", "Scolarité"],
  ["label: \"Prenom", "label: \"Prénom"],
  ["Non authentifie", "Non authentifié"],
  ["par defaut", "par défaut"],
  ["securite", "sécurité"],
  ["champs selectionnes", "champs sélectionnés"],
  ["champs exportes", "champs exportés"],
  ["leads importes", "leads importés"],
  ["lignes detectees", "lignes détectées"],
  ["Formulaire ignore", "Formulaire ignoré"],
  ["Lead capture", "Lead capturé"],
  ["Dossier recu", "Dossier reçu"],
  ["Aucun lead ne correspond", "Aucun lead ne correspond"],
  ["Informations du lead mises", "Informations du lead mises"],
];

function walkDir(dir, files) {
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var entry of entries) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git", "dist", "build"].includes(entry.name)) continue;
      walkDir(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

var root = process.cwd();
var srcDir = path.join(root, "src");
if (!fs.existsSync(srcDir)) {
  console.error("Dossier src/ introuvable. Lancez depuis la racine du projet.");
  process.exit(1);
}

var files = walkDir(srcDir, []);
var fixedFiles = 0;

for (var file of files) {
  var original = fs.readFileSync(file, "utf-8");
  var content = original;
  for (var [wrong, correct] of REPLACEMENTS) {
    if (wrong === correct) continue;
    content = content.split(wrong).join(correct);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, "utf-8");
    console.log("  ✓ " + path.relative(root, file));
    fixedFiles++;
  }
}

console.log("\n✅ " + fixedFiles + " fichiers corrigés");
