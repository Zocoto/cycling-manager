begin;

-- Les courses standard des deux catégories d'accès ont besoin d'un peloton
-- plus fourni. Les championnats nationaux et internationaux conservent leurs
-- capacités spécifiques, car ils utilisent des sélections et non des équipes.
update public.race_editions as edition
set field_limit = 30
from public.race_categories as category,
     public.races as race
where category.id = edition.race_category_id
  and race.id = edition.race_id
  and category.code in ('national', 'continental')
  and race.competition_type = 'standard'
  and edition.field_limit is distinct from 30;

create or replace function public.enforce_standard_race_field_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_code text;
  v_competition_type text;
begin
  select category.code
  into v_category_code
  from public.race_categories as category
  where category.id = new.race_category_id;

  select race.competition_type
  into v_competition_type
  from public.races as race
  where race.id = new.race_id;

  if v_category_code in ('national', 'continental')
     and v_competition_type = 'standard' then
    new.field_limit := 30;
  end if;

  return new;
end;
$$;

drop trigger if exists race_editions_standard_field_limit
  on public.race_editions;

create trigger race_editions_standard_field_limit
before insert or update of race_id, race_category_id, field_limit
on public.race_editions
for each row execute function public.enforce_standard_race_field_limit();

-- La fonction d'inscription historique utilisait bien field_limit pour le
-- contrôle, mais son message mentionnait encore explicitement 24 équipes.
do $$
declare
  v_function_signature regprocedure := to_regprocedure(
    'public.save_current_team_race_roster(uuid,uuid[])'
  );
  v_function_definition text;
  v_old_message constant text :=
    'Le nombre maximal de 24 équipes inscrites est atteint.';
  v_new_message constant text :=
    'Le nombre maximal d''équipes inscrites pour cette course est atteint.';
begin
  if v_function_signature is null then
    raise exception 'La fonction save_current_team_race_roster est introuvable.';
  end if;

  select pg_get_functiondef(v_function_signature)
  into v_function_definition;

  if position(v_old_message in v_function_definition) > 0 then
    execute replace(
      v_function_definition,
      v_old_message,
      v_new_message
    );
  elsif position(v_new_message in v_function_definition) = 0 then
    raise exception
      'Le message historique de capacité est introuvable dans save_current_team_race_roster.';
  end if;
end;
$$;

comment on function public.enforce_standard_race_field_limit() is
  'Fixe à 30 équipes la capacité des courses standard nationales et continentales, y compris les futures éditions.';

commit;
