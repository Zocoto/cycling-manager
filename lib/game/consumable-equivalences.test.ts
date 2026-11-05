import {describe, expect, it} from "vitest";
import {findConsumableEquivalence} from "./consumable-equivalences";
import {dailyRewardsToInventoryItems, groupTeamInventoryItems, summarizeInventory, type TeamInventoryItem} from "./inventory";
import {groupDailyRewardInventoryItems, type DailyRewardInventoryItem} from "./daily-rewards";
import definitions from "./consumable-equivalences.json";

const gift = (overrides: Partial<DailyRewardInventoryItem> = {}): DailyRewardInventoryItem => ({
  id:"gift",key:"secondary-technique",name:"Technique",description:"",effectSummary:"+1 secondaire",
  importance:5,effectKind:"rating_boost",iconKey:"rating",payload:{amount:1,statScope:"secondary"},
  quantity:1,acquiredAt:"2026-11-01",expiresAfterGameYear:5,...overrides,
});
const stock = (overrides: Partial<TeamInventoryItem> = {}): TeamInventoryItem => ({
  id:"stock",sourceId:"catalog-notebook",catalogKey:"potential-notebook",source:"item",
  category:"potential_boost",name:"Carnet",description:"",effectSummary:"+1 étoile",effectPayload:{potentialBonus:1},
  rarity:"epic",quantity:2,availableQuantity:2,equippedQuantity:0,pendingQuantity:0,
  equippedRiderIds:[],pendingRiderIds:[],iconKey:"potential",imagePath:null,supplierName:null,
  equipmentSlot:null,isConsumable:true,resalePrice:null,acquiredAt:"2026-11-01",...overrides,
});

describe("ordinary consumable equivalences",()=>{
  it("recognizes every audited reference, independent of JSON property order",()=>{
    for(const group of definitions) for(const member of group.members) {
      expect(findConsumableEquivalence({...member,payload:Object.fromEntries(Object.entries(member.payload).reverse())})?.key).toBe(group.key);
    }
  });
  it("fails closed for an event, an unknown object or any changed restriction",()=>{
    const member=definitions[0].members[0];
    for(const change of [{key:"halloween-technique"},{source:"halloween"},
      {payload:{...member.payload,maximumRating:80}}, {payload:{...member.payload,amount:2}}]) {
      expect(findConsumableEquivalence({...member,...change})).toBeNull();
    }
  });
  it("combines old secondary-stat names and spends the earliest-expiring reference",()=>{
    const rows=[gift({quantity:2}),gift({id:"older",key:"secondary-specialization",importance:6,
      acquiredAt:"2026-10-01",expiresAfterGameYear:4,quantity:3})];
    const [group]=groupDailyRewardInventoryItems(rows);
    expect(group).toMatchObject({id:"older",key:"secondary-technique",quantity:5,
      name:"Perfectionnement technique",importance:5,expiresAfterGameYear:4});
    expect(groupDailyRewardInventoryItems([group])).toEqual([group]);
    expect(rows[0].quantity).toBe(2);
  });
  it("keeps different scope, amount and cap separate, including event lookalikes",()=>{
    expect(groupDailyRewardInventoryItems([gift(),gift({key:"primary-breakthrough",payload:{amount:1,statScope:"primary"}}),
      gift({key:"high-performance-cell",payload:{amount:2,statScope:"primary",maximumRating:80}}),
      gift({key:"halloween-secondary"})])).toHaveLength(4);
  });
  it("keeps unique tile IDs if a canonical reference later gains a restriction",()=>{
    const items=groupTeamInventoryItems(dailyRewardsToInventoryItems([
      gift({key:'secondary-specialization'}),
      gift({id:'capped',payload:{amount:1,statScope:'secondary',maximumRating:80}}),
    ]));
    expect(items).toHaveLength(2);
    expect(new Set(items.map(i=>i.id)).size).toBe(2);
  });
  it("combines the two full-star stocks without merging a half-star",()=>{
    const items=groupTeamInventoryItems([stock(),stock({id:"dossier",sourceId:"catalog-dossier",
      catalogKey:"classified-talent-dossier",quantity:3,availableQuantity:3}),
      stock({id:"half",catalogKey:"potential-spark",effectPayload:{potentialBonus:0.5}})]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({name:"Carnet de progression",quantity:5,availableQuantity:5,sourceId:"catalog-notebook"});
    expect(summarizeInventory(items).totalUnits).toBe(7);
  });
  it("unifies each daily/generic management or care stock and keeps a usable source ID",()=>{
    for(const group of definitions.filter(d=>d.members.some(m=>m.source==='item')&&d.members.some(m=>m.source==='daily_reward'))) {
      const generic=group.members.find(m=>m.source==='item')!;
      const daily=group.members.find(m=>m.source==='daily_reward')!;
      const giftItem=dailyRewardsToInventoryItems([gift({key:daily.key,effectKind:daily.kind as DailyRewardInventoryItem['effectKind'],payload:daily.payload})])[0];
      const regular=stock({category:generic.kind as TeamInventoryItem['category'],catalogKey:generic.key,effectPayload:generic.payload});
      for(const items of [[regular,giftItem],[giftItem,regular]]) {
        const combined=groupTeamInventoryItems(items);
        expect(combined).toHaveLength(1);
        expect(combined[0]).toMatchObject({source:'daily_reward',sourceId:'gift',quantity:3,availableQuantity:3,dailyReward:{id:'gift',quantity:3}});
      }
    }
  });
  it("never combines physical equipment, medallions for different abilities or Halloween items",()=>{
    const rows=[stock({id:'equipment-1',source:'equipment'}),stock({id:'equipment-2',source:'equipment'}),
      stock({id:'halloween',source:'halloween'}),stock({id:'ability-1',catalogKey:'medallion-panache',category:'special_ability',effectPayload:{abilityCode:'panache'}}),
      stock({id:'ability-2',catalogKey:'medallion-metronome',category:'special_ability',effectPayload:{abilityCode:'metronome'}})];
    expect(groupTeamInventoryItems(rows)).toEqual(rows);
  });
});
