begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Academy competition identities are merged into the signed professional
-- identity by updating race_rosters.rider_id. Every composite child FK must
-- follow that same identity change. Keep roster UUIDs, results and tactics;
-- never delete historical racing data to make a promotion succeed.
alter table public.race_roster_stage_roles
  drop constraint race_roster_stage_roles_roster_fkey,
  add constraint race_roster_stage_roles_roster_fkey
    foreign key (race_registration_id, rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on update cascade on delete cascade;
alter table public.race_time_trial_rider_plans
  drop constraint race_time_trial_rider_plans_roster_fkey,
  add constraint race_time_trial_rider_plans_roster_fkey
    foreign key (race_registration_id, rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on update cascade on delete cascade;
alter table public.race_stage_strategies
  drop constraint race_stage_strategies_lieutenant_roster_fkey,
  add constraint race_stage_strategies_lieutenant_roster_fkey
    foreign key (race_registration_id, lieutenant_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on update cascade on delete cascade,
  drop constraint race_stage_strategies_danger_pacer_roster_fkey,
  add constraint race_stage_strategies_danger_pacer_roster_fkey
    foreign key (race_registration_id, danger_pacer_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on update cascade on delete cascade,
  drop constraint race_stage_strategies_protector_roster_fkey,
  add constraint race_stage_strategies_protector_roster_fkey
    foreign key (race_registration_id, protector_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on update cascade on delete cascade,
  drop constraint race_stage_strategies_breakaway_rider_roster_fkey,
  add constraint race_stage_strategies_breakaway_rider_roster_fkey
    foreign key (race_registration_id, breakaway_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on update cascade on delete cascade;
commit;
