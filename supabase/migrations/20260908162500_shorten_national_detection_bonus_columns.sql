begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'youth_scouting_missions'
      and column_name = 'federation_detection_specialization_report_precision_bonus_perc'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'youth_scouting_missions'
      and column_name = 'federation_detection_spec_report_bonus_percentage'
  ) then
    alter table public.youth_scouting_missions
      rename column federation_detection_specialization_report_precision_bonus_perc
      to federation_detection_spec_report_bonus_percentage;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'youth_scouting_missions'
      and column_name = 'federation_detection_specialization_potential_precision_bonus_p'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'youth_scouting_missions'
      and column_name = 'federation_detection_spec_potential_bonus_percentage'
  ) then
    alter table public.youth_scouting_missions
      rename column federation_detection_specialization_potential_precision_bonus_p
      to federation_detection_spec_potential_bonus_percentage;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
