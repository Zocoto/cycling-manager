import assert from 'node:assert/strict';
import { extractUiStrings } from './build-i18n-catalog.mjs';

const text = extractUiStrings(`
  import { Staff } from '@/lib/equipe';
  const view = <section className="coureur" id="equipe">
    <h1>Mes coureurs</h1>
    <Card label="Informations importantes" title="Sélection nationale" />
    <BulletList items={["Un seul changement par coureur", "Informations importantes"]} />
    <Table rows={[{label: "Équipe inscrite"}]} />
    <input placeholder="Chercher un coureur" value="Mon équipe" />
    <a href={\`/jeu/equipe?nom=\${name}\`}>Voir l’équipe</a>
  </section>;
`);
for (const value of ['Mes coureurs', 'Informations importantes', 'Sélection nationale',
  'Un seul changement par coureur', 'Équipe inscrite', 'Chercher un coureur', 'Voir l’équipe']) {
  assert.ok(text.has(value), `Missing component copy: ${value}`);
}
for (const value of ['@/lib/equipe', 'coureur', 'equipe', 'Mon équipe']) assert.ok(!text.has(value));
const templates = extractUiStrings('const label = `${count} coureur${count > 1 ? "s" : ""} engagé${count > 1 ? "s" : ""} par votre équipe`;');
assert.ok(templates.has('{{0}} coureur{{grammar1}} engagé{{grammar2}} par votre équipe'));
const artifactFixture = 'function createInstallationGuide() { return `Guide d’installation de la base`; } const message = "Votre export a échoué.";';
const externalGuide = extractUiStrings(artifactFixture, 'services/pcm-export-package.ts');
assert.ok(!externalGuide.has('Guide d’installation de la base'));
assert.ok(externalGuide.has('Votre export a échoué.'));
assert.ok(extractUiStrings(artifactFixture, 'components/ordinary-component.ts').has('Guide d’installation de la base'));
const powershell = extractUiStrings('function createPcmGraphicsInstaller() { return `Installer les fichiers dans le dossier`; } const error = "Installation impossible.";', 'lib/game/pcm-export/graphics-installer.ts');
assert.ok(!powershell.has('Installer les fichiers dans le dossier'));
assert.ok(powershell.has('Installation impossible.'));
const filenames = extractUiStrings('const files = [{name:"PCMAssets_cyclostratege-local_P.pak"},{name:"Installer-graphismes.ps1"}]; const label="Installer les graphismes";');
assert.ok(!filenames.has('PCMAssets_cyclostratege-local_P.pak'));
assert.ok(!filenames.has('Installer-graphismes.ps1'));
assert.ok(filenames.has('Installer les graphismes'));
assert.equal(extractUiStrings('const rider = {name: "Coureur de recette"};', 'lib/game/album.fixture.ts').size, 0);
assert.equal(extractUiStrings('const view = <h1>Équipe de recette</h1>;', 'components/game/album.fixture.tsx').size, 0);
const rpc = extractUiStrings('const action = {rpcName: "open_current_cyclo_stickers_booster", label: "Ouvrir le sachet"};');
assert.ok(!rpc.has('open_current_cyclo_stickers_booster'));
assert.ok(rpc.has('Ouvrir le sachet'));
console.log('I18n scanner: 24 checks passed (component copy, templates, technical identifiers, test fixtures and exact external artifact functions).');
