begin;

alter table public.youth_scouting_missions
  add column if not exists federation_detection_spec_report_bonus_percentage numeric(5, 2)
    not null default 0
    check (
      federation_detection_spec_report_bonus_percentage
        between 0 and 4
    ),
  add column if not exists federation_detection_spec_potential_bonus_percentage numeric(5, 2)
    not null default 0
    check (
      federation_detection_spec_potential_bonus_percentage
        between 0 and 5
    );

comment on column public.youth_scouting_missions.federation_detection_spec_report_bonus_percentage is
  'Bonus de précision générale figé à la finalisation par la spécialisation Maillage territorial.';

comment on column public.youth_scouting_missions.federation_detection_spec_potential_bonus_percentage is
  'Bonus de précision du potentiel figé à la finalisation par la spécialisation Détection élite.';

notify pgrst, 'reload schema';

commit;
