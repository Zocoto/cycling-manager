begin;

-- La progression de podium a été introduite après le Prix de la Relève.
-- Ce déclencheur temporaire rejoue exactement la même logique que celle
-- utilisée pour les futurs résultats, uniquement pour les récompenses absentes.
drop trigger if exists development_result_backfills_prix_releve_podium
on public.development_race_results;

create trigger development_result_backfills_prix_releve_podium
after update of rank
on public.development_race_results
for each row
execute function public.award_development_podium_progression();

do $$
declare
  v_awarded_count integer := 0;
  v_remaining_count integer := 0;
begin
  update public.development_race_results as result
  set rank = result.rank
  from public.development_race_editions as edition
  where edition.id = result.race_edition_id
    and edition.slug = 'prix-de-la-releve'
    and result.result_scope = 'general'
    and result.rank between 1 and 3
    and result.academy_rider_id is not null
    and not exists (
      select 1
      from public.development_race_podium_progression as progression
      where progression.race_edition_id = result.race_edition_id
        and progression.academy_rider_id = result.academy_rider_id
    );

  get diagnostics v_awarded_count = row_count;

  select count(*)
  into v_remaining_count
  from public.development_race_results as result
  join public.development_race_editions as edition
    on edition.id = result.race_edition_id
  where edition.slug = 'prix-de-la-releve'
    and result.result_scope = 'general'
    and result.rank between 1 and 3
    and result.academy_rider_id is not null
    and not exists (
      select 1
      from public.development_race_podium_progression as progression
      where progression.race_edition_id = result.race_edition_id
        and progression.academy_rider_id = result.academy_rider_id
    );

  if v_remaining_count <> 0 then
    raise exception
      'Le rattrapage du Prix de la Relève laisse % récompenses de podium absentes.',
      v_remaining_count;
  end if;

  raise notice
    'Rattrapage du Prix de la Relève appliqué à % coureurs.',
    v_awarded_count;
end;
$$;

drop trigger if exists development_result_backfills_prix_releve_podium
on public.development_race_results;

notify pgrst, 'reload schema';

commit;
