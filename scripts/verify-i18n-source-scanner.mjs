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
console.log('I18n scanner: 12 checks passed (component lists, labels, templates and technical exclusions).');
