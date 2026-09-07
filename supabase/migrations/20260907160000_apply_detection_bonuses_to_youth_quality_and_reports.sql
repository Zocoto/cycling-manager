begin;

alter table public.youth_scouting_missions
  add column if not exists scouting_supervision_bonus_percentage numeric(5, 2)
  not null default 0;

alter table public.youth_scouting_missions
  drop constraint if exists youth_scouting_missions_supervision_bonus_range;

alter table public.youth_scouting_missions
  add constraint youth_scouting_missions_supervision_bonus_range
  check (scouting_supervision_bonus_percentage between 0 and 100);

comment on column public.youth_scouting_missions.scouting_supervision_bonus_percentage is
  'Bonus du cadeau de supervision figé à la fin de la mission et appliqué à la qualité réelle des juniors comme à la précision du rapport.';

notify pgrst, 'reload schema';

commit;
