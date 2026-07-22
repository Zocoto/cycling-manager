begin;

-- La préparation de la saison suivante met à jour plusieurs étapes dans une
-- même instruction. Deux lignes peuvent temporairement échanger leur créneau
-- avant que l'état final soit cohérent. L'unicité reste obligatoire, mais elle
-- doit être contrôlée au commit plutôt qu'après chaque ligne de l'upsert.
alter table public.stages
  drop constraint if exists stages_day_slot_unique;

alter table public.stages
  add constraint stages_day_slot_unique
    unique (race_edition_id, season_day_id, day_slot)
    deferrable initially deferred;

comment on constraint stages_day_slot_unique on public.stages is
  'Une édition ne peut occuper qu’une fois chaque vague d’une journée ; contrôle différé pour permettre la reprovision de la saison suivante.';

commit;
