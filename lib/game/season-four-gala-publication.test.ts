import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {gameNewsDocumentSchema} from './game-product-news';
import {galaRegistrationSchema} from './season-four-gala-registration';
const news=JSON.parse(readFileSync('Docs/gala-s4-announcement-20261023.json','utf8'));
const ids=Array.from({length:8},(_,index)=>`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`);
describe('public gala delivery',()=>{
 it('announces only the confirmed gala rules with a valid article document and deployed local artwork',()=>{
  expect(gameNewsDocumentSchema.safeParse(news).success).toBe(true);expect(news.link_url).toBe('/jeu/gala-saison-4');
  expect(news.body).toContain('jeudi 5 novembre à 23 h 59');expect(news.body).toContain('World Tour');expect(news.body).toContain('Continental');
  expect(JSON.stringify(news)).not.toMatch(/draft|2023|Roubaix 2026/i);
  expect(readFileSync('public'+news.image_path,'utf8')).toContain('<svg');
 });
 it.each([7,8])('accepts %s riders in each of exactly three matching profiles',count=>{
  for(const [program,third] of [['world-tour','cobbles'],['continental','sprint']]) expect(galaRegistrationSchema.safeParse({program,selections:{mountain:ids.slice(0,count),hills:ids.slice(0,count),[third]:ids.slice(0,count)}}).success).toBe(true);
 });
 it('does not pull the validator into the lineup client bundle',()=>{
  const component=readFileSync('components/game/season-four-gala-registration.tsx','utf8');
  expect(component).toContain('import type { GalaRegistrationState, SeasonFourGalaContext }');
  expect(component).not.toContain('initialGalaRegistrationState');
 });
});
