begin;

-- Les courses standard Continentales et Mondiales utilisent désormais
-- des seuils explicites. Les championnats et le circuit Elite conservent
-- leurs règles d'inscription spécifiques.
create or replace function public.configure_standard_race_reputation_threshold()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category_code text;
  v_competition_type text;
begin
  select
    category.code,
    race.competition_type
  into
    v_category_code,
    v_competition_type
  from public.race_categories as category
  join public.races as race
    on race.id = new.race_id
  where category.id = new.race_category_id;

  if v_competition_type = 'standard' then
    if v_category_code = 'continental' then
      new.minimum_reputation := 100;

      if new.registration_policy = 'criteria_pending' then
        new.registration_policy := 'open';
      end if;
    elsif v_category_code = 'world' then
      new.minimum_reputation := 200;

      if new.registration_policy = 'criteria_pending' then
        new.registration_policy := 'open';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists configure_standard_race_reputation_threshold_trigger
  on public.race_editions;

create trigger configure_standard_race_reputation_threshold_trigger
before insert or update of
  race_id,
  race_category_id,
  registration_policy,
  minimum_reputation
on public.race_editions
for each row
execute function public.configure_standard_race_reputation_threshold();

update public.race_editions as edition
set
  minimum_reputation = case category.code
    when 'continental' then 100
    when 'world' then 200
  end,
  registration_policy = case
    when edition.registration_policy = 'criteria_pending' then 'open'
    else edition.registration_policy
  end
from public.race_categories as category,
     public.races as race
where category.id = edition.race_category_id
  and race.id = edition.race_id
  and race.competition_type = 'standard'
  and category.code in ('continental', 'world');

comment on function
public.configure_standard_race_reputation_threshold() is
  'Applique durablement les seuils de 100 points aux courses Continentales et 200 points aux courses Mondiales standard.';

notify pgrst, 'reload schema';

commit;
