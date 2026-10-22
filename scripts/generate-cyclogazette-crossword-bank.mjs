// Offline only: no network, database or application-time grid search.
// Emits an apply_patch payload so generated content is reviewed before saving.
// The issue-98 bank is immutable after publication. For a later expansion,
// create a NEW bank and cutoff; never reroll past answers or in-progress games.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const source = readFileSync("lib/game/cyclogazette-games.ts", "utf8");
const legacySection = source.split("const CONNECTED_CROSSWORD_TEMPLATES:")[1]?.split("const CONNECTED_CROSSWORD_CLUES:")[0];
if (!legacySection) throw Error("Legacy masks not found");
const legacy = [...legacySection.matchAll(/rows: \[([\s\S]*?)\]/g)].map(match => [...match[1].matchAll(/"([A-Z#]+)"/g)].map(row => row[1]));
const masks = [...new Set(legacy.map(rows => rows.map(row => row.replace(/[A-Z]/g,".")).join("\n")))].map(mask => mask.split("\n"));
const clues = {};
for (const match of source.matchAll(/\{ answer: "([A-Z]+)", clue: "([^"]+)" \}/g)) clues[match[1]] = match[2];
for (const match of source.matchAll(/^  ([A-Z]+): "([^"]+)",/gm)) clues[match[1]] = match[2];
const originalClues = {...clues};
delete clues.MUSSETTE; // Legacy spelling error: only MUSETTE is used in new fills.
const seen = new Set();
for (const line of readFileSync("lib/game/cyclogazette-crossword-vocabulary.txt", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const divider = line.indexOf("|");
  const answer = line.slice(0,divider), clue=line.slice(divider+1);
  if (divider < 0 || !/^[A-Z]+$/.test(answer) || clue.length < 8) throw Error(`Invalid vocabulary: ${line}`);
  if (seen.has(answer)) throw Error(`Duplicate vocabulary: ${answer}`);
  seen.add(answer);
  if (answer.length >= 2 && answer.length <= 9 && !(answer in clues)) clues[answer] = clue;
}
const byLength = Array.from({length:10},()=>[]);
for (const answer of Object.keys(clues)) if(answer.length<=9 && answer.length>=2) byLength[answer.length].push(answer);
for (const words of byLength) words.sort();
const usage = new Map(), templates = [], signatures = new Set();
const maskCounts=masks.map(()=>0);
const maskKey=rows=>rows.map(row=>row.replace(/[A-Z]/g,'.')).join('\n');
function randomFor(seed) {
  let state=seed>>>0;
  return () => { state=(Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; };
}
function slotsFor(rows) {
  const slots=[];
  for (const direction of [0,1]) for(let fixed=0;fixed<9;fixed++) {
    let moving=0;
    while(moving<9) {
      while(moving<9 && rows[direction?moving:fixed][direction?fixed:moving]==="#") moving++;
      const cells=[];
      while(moving<9 && rows[direction?moving:fixed][direction?fixed:moving]!=="#") {
        cells.push(direction?moving*9+fixed:fixed*9+moving); moving++;
      }
      if(cells.length>=2) slots.push({cells,crossings:[]});
    }
  }
  for(let a=0;a<slots.length;a++) for(let b=a+1;b<slots.length;b++) {
    slots[a].cells.forEach((cell,ai) => {
      const bi=slots[b].cells.indexOf(cell);
      if(bi>=0) {slots[a].crossings.push([b,ai,bi]);slots[b].crossings.push([a,bi,ai]);}
    });
  }
  return slots;
}
function fill(mask, seed) {
  const random=randomFor(seed), slots=slotsFor(mask);
  let nodes=0;
  function propagate(domains,queue) {
    while(queue.length) {
      const index=queue.pop();
      for(const [other,position,otherPosition]of slots[index].crossings) {
        const letters=new Set(domains[index].map(word=>word[position]));
        const next=domains[other].filter(word=>letters.has(word[otherPosition]));
        if(!next.length)return false;
        if(next.length<domains[other].length){domains[other]=next;queue.push(other);}
      }
    }
    return true;
  }
  function solve(domains) {
    if(++nodes>18000)return null;
    let selected=-1,best=Infinity;
    for(let i=0;i<domains.length;i++) if(domains[i].length>1) {
      const score=domains[i].length/(1+slots[i].crossings.length*0.1);
      if(score<best){best=score;selected=i;}
    }
    if(selected<0)return new Set(domains.map(words=>words[0])).size===slots.length?domains.map(words=>words[0]):null;
    const candidates=domains[selected].map(word=>({word,score:(usage.get(word)??0)+random()*8})).sort((a,b)=>a.score-b.score);
    for(const {word}of candidates) {
      const next=domains.slice();next[selected]=[word];const queue=[selected];let valid=true;
      for(let i=0;i<next.length;i++) if(i!==selected && slots[i].cells.length===word.length && next[i].includes(word)) {
        next[i]=next[i].filter(candidate=>candidate!==word);queue.push(i);
        if(!next[i].length){valid=false;break;}
      }
      if(valid && propagate(next,queue)){const result=solve(next);if(result)return result;}
    }
    return null;
  }
  const domains=slots.map(slot=>byLength[slot.cells.length]);
  const longIndex=slots.findIndex(slot=>slot.cells.length===9);
  if(longIndex>=0){
    const options=domains[longIndex].map(word=>({word,score:(usage.get(word)??0)+random()*6})).sort((a,b)=>a.score-b.score);
    // Explore ALL anchors: the least-used ones can be impossible on one mask.
    // Restricting this draw to them starves the more constrained masks forever.
    const chosen=options[Math.floor(random()*options.length)]?.word;
    if(chosen)domains[longIndex]=[chosen];
  }
  if(!propagate(domains,slots.map((_,i)=>i)))return null;
  const solution=solve(domains);if(!solution)return null;
  const cells=mask.join("").split("");
  slots.forEach((slot,i)=>slot.cells.forEach((cell,j)=>cells[cell]=solution[i][j]));
  if(cells.includes("."))throw Error("Unfilled cell");
  return {rows:Array.from({length:9},(_,row)=>cells.slice(row*9,row*9+9).join("")),answers:solution};
}
const target=Number(process.argv.find(arg=>arg.startsWith("--count="))?.split("=")[1]??320);
if(!Number.isInteger(target)||target<280||target>3200)throw Error("Expected 280 to 3200 grids");
if(target%masks.length!==0)throw Error("Grid count must divide evenly across the existing masks");
const perMask=target/masks.length;
if(existsSync('lib/game/cyclogazette-crossword-bank.json')) {
  const previous=JSON.parse(readFileSync('lib/game/cyclogazette-crossword-bank.json','utf8'));
  for(const template of previous.templates) {
    const answers=slotsFor(template.rows).map(slot=>slot.cells.map(cell=>template.rows[Math.floor(cell/9)][cell%9]).join(''));
    if(answers.some(answer=>!clues[answer]))continue;
    const index=masks.findIndex(mask=>mask.join('\n')===maskKey(template.rows));
    if(index<0 || maskCounts[index]>=perMask)continue;
    maskCounts[index]++;templates.push(template);signatures.add(template.rows.join(''));
    for(const word of answers) usage.set(word,(usage.get(word)??0)+1);
  }
}
console.error(JSON.stringify({masks:masks.length,legacyWords:Object.keys(originalClues).length,availableWords:Object.keys(clues).length,lengths:byLength.map(words=>words.length)}));
let attempts=0;
while(templates.length<target && attempts<target*150){
  const maskIndex=maskCounts.findIndex(count=>count<perMask);
  const result=fill(masks[maskIndex],123457+attempts*104729);attempts++;
  if(!result || signatures.has(result.rows.join("")))continue;
  signatures.add(result.rows.join(""));templates.push({rows:result.rows});maskCounts[maskIndex]++;
  for(const word of result.answers)usage.set(word,(usage.get(word)??0)+1);
  if(templates.length%16===0)console.error(JSON.stringify({grids:templates.length,usedWords:usage.size,attempts,maskCounts}));
}
if(templates.length<target)throw Error(`Only ${templates.length} of ${target} grids could be filled`);
const bank={firstIssue:98,templates,clues:Object.fromEntries([...usage.keys()].sort().map(word=>[word,clues[word]]))};
console.error(JSON.stringify({grids:templates.length,usedWords:usage.size,newWords:[...usage.keys()].filter(word=>!(word in originalClues)).length,masks:masks.length,attempts}));
const outputPath=path.resolve("lib/game/cyclogazette-crossword-bank.json").replaceAll("\\","/");
process.stdout.write("*** Begin Patch\n*** Add File: "+outputPath+"\n+"+JSON.stringify(bank,null,2).split("\n").join("\n+")+"\n*** End Patch");
