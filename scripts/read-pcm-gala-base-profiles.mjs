// Read four individually extracted vanilla CDS metadata files. Never edits PCM,
// distributes its assets or imports Workshop stages. Output is derived points.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const directory=process.argv[2];
if(!directory||!path.isAbsolute(directory))throw Error('Absolute directory of the four extracted CDS files required');
const files={mountain:'top_tdf_18_2022.cds',hills:'topclas_maastricht_2018.cds',cobbles:'topclas_roubaix_2018.cds',sprint:'c0_schelde_2015.cds'};
const profiles={};
for(const [profile,file] of Object.entries(files)) {
  const bytes=readFileSync(path.join(directory,file));
  if(![134,135].includes(bytes.readUInt32LE(0))||bytes.subarray(16,27).toString()!=='CTStageData')throw Error('Unexpected CDS metadata version/class');
  let points;
  for(let offset=4;offset<bytes.length-32;offset++) {
    if(bytes.readFloatLE(offset)!==0||bytes.readFloatLE(offset+8)!==20||bytes.readFloatLE(offset+16)!==40||bytes.readFloatLE(offset+24)!==60)continue;
    const count=bytes.readUInt32LE(offset-4);
    if(count<100||count>10000||offset+count*8>bytes.length)continue;
    const candidate=Array.from({length:count},(_,i)=>[bytes.readFloatLE(offset+i*8),bytes.readFloatLE(offset+i*8+4)]);
    if(!candidate.every(([x,y],i)=>Number.isFinite(x)&&Number.isFinite(y)&&y>=0&&y<5000&&(!i||x>candidate[i-1][0])))continue;
    if(Math.abs(candidate.at(-1)[0]*10-bytes.readFloatLE(43))>1)continue;
    points=candidate;break; // first curve is altitude, not the later effort curve
  }
  if(!points)throw Error('Verified altitude curve missing: '+file);
  // Preserve each distance bucket's peak AND valley, with original x positions.
  // This retains short Amstel hills without shipping thousands of game points.
  const indices=new Set([0,points.length-1]);
  for(let bucket=0;bucket<96;bucket++) {
    const start=Math.floor(bucket*points.length/96),end=Math.floor((bucket+1)*points.length/96);
    let low=start,high=start;
    for(let i=start+1;i<end;i++){if(points[i][1]<points[low][1])low=i;if(points[i][1]>points[high][1])high=i;}
    indices.add(low);indices.add(high);
  }
  const length=points.at(-1)[0],altitudes=points.map(point=>point[1]);
  profiles[profile]={file,source:'PCM26 base · pakchunk1-Windows.pak · Content/CM_Stages',sha256:createHash('sha256').update(bytes).digest('hex'),
    route:bytes.subarray(75,75+bytes.readUInt32LE(71)).toString('utf8').replace(/\0$/,''),
    sourcePointCount:points.length,minimum:Math.min(...altitudes),maximum:Math.max(...altitudes),
    points:[...indices].sort((a,b)=>a-b).map(i=>[Number((points[i][0]/length).toFixed(6)),Number(points[i][1].toFixed(5))])};
}
console.log(JSON.stringify(profiles,null,2));
