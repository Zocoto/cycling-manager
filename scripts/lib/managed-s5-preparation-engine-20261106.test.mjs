import {describe,it,expect} from 'vitest';
import {createDemoSimulationInput} from '../../lib/game/race-simulation-demo.ts';
import {simulateRaceStage} from '../../lib/game/race-simulation.ts';
import {managedS5StagePreparation} from './managed-s5-preparation-planner-20261106.mjs';

describe('managed one-shot strategies against the real race engine',()=>{
  it.each(['sprint-littoral','collines-ardennes','haute-montagne','paves-zelande','chrono-algarve'])(
    'still produces a complete official classification for %s',scenario=>{
      const input=createDemoSimulationInput(scenario,20261106);
      const roleById=new Map(),strategies=[];
      for(const teamId of new Set(input.riders.map(r=>r.teamId))){
        const roster=input.riders.filter(r=>r.teamId===teamId).map(r=>({...r,...r.ratings,team_id:r.teamId,time_trial:r.ratings.timeTrial}));
        const preparation=managedS5StagePreparation({team:{team_id:teamId},riders:roster,
          race:{race_format:input.isStageRace?'stage_race':'one_day',profiles:[input.profileType]},
          stage:{profile:input.profileType},hasSponsorObjective:true});
        for(const row of preparation.roles)roleById.set(row.riderId,row.role);
        strategies.push({teamId,...preparation.strategy});
      }
      const result=simulateRaceStage({...input,riders:input.riders.map(r=>({...r,role:roleById.get(r.id)})),teamStrategies:strategies});
      expect(result.results).toHaveLength(input.riders.length);
      expect(new Set(result.results.map(r=>r.riderId)).size).toBe(input.riders.length);
      expect(result.results.some(r=>r.rank===1)).toBe(true);
      expect(strategies.every(s=>s.attackOrders.length===0)).toBe(true);
    },20000,
  );
});
