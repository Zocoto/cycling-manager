// Mechanical terminology cleanup; editorial overrides live in reviewed-fr-en.json.
import fs from 'node:fs';
const file='lib/i18n/generated-fr-en.json';
const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
let changed=0;
for(const [source,original] of Object.entries(catalog)) {
  let text=original.replaceAll('▁',' ').replace(/\s+/g,' ').trim();
  const replace=(pattern,target)=>{text=text.replace(pattern,target);};
  replace(/\bSports Director(s?)\b/g,'Sporting Director$1');
  replace(/\b[Cc]yclostrategist\b|\bCyclo Strategist\b/g,'Cyclo Stratège');
  if(/coureurs?/i.test(source)) {replace(/\brunners\b/gi,'riders');replace(/\brunner\b/gi,'rider');}
  if(/peloton/i.test(source)) replace(/\bplatoons?\b/gi,'peloton');
  if(/effectif/i.test(source)&&! /\bstaff\b/i.test(source)) replace(/\b(?:staff|workforce|strength)\b/gi,'roster');
  if(/parrain|filleul/i.test(source)&&! /sponsor/i.test(source)) {
    replace(/\bsponsorship\b/gi,'referral');replace(/\bsponsors\b/gi,'referrers');replace(/\bsponsor\b/gi,'referrer');
  }
  if(/rouleurs?/i.test(source)) replace(/\brollers?\b/gi,'rouleur');
  if(/puncheurs?/i.test(source)) replace(/\bpunchers?\b/gi,'puncheur');
  if(/baroudeurs?/i.test(source)) replace(/\badventurers?\b/gi,'breakaway specialist');
  if(/patato[iï]de/i.test(source)) replace(/\bpatatoids?\b/gi,'radar chart');
  if(/maillots?/i.test(source)) {replace(/\bswimsuits?\b/gi,'jersey');replace(/\bshirts\b/gi,'jerseys');replace(/\bshirt\b/gi,'jersey');}
  if(/grand tour/i.test(source)) replace(/\bbig towers?\b/gi,'Grand Tour');
  if(/tour par étapes/i.test(source)) replace(/\bstepwise tours?\b/gi,'stage race');
  if(/étapes?/i.test(source)&&/course|tour|classement|victoire|prime/i.test(source)) replace(/\bsteps?\b/gi,'stage');
  if(/cadre/i.test(source)&&/matériel|équipement|roue|prototype|bonus|réserve/i.test(source)) replace(/\bframework\b/gi,'frame');
  if(/forme/i.test(source)&&/point|[+−%]|seuil|niveau|coût|insuffisant|manque/i.test(source)) replace(/\bshape\b/gi,'form');
  if(/notes?/i.test(source)&&/stat|profil|globale|bonus|primaire|secondaire|principale|progress|plafond/i.test(source)) {
    replace(/\bfootnotes?\b/gi,'rating');replace(/\bgrades\b/gi,'ratings');replace(/\bnotes\b/gi,'ratings');
  }
  if(source!==original&&text!==original) {catalog[source]=text;changed++;}
}
if(process.argv.includes('--write')) fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({entries:Object.keys(catalog).length,normalised:changed,written:process.argv.includes('--write')}));
