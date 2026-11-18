begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Count the selectable roster for each J+1 race inside the existing summary.
do $migration$
declare
  definition text := replace(pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ), E'\r\n', E'\n');
  previous_filter constant text := replace($previous$        where (
          edition.competition_type not in ('national_road', 'national_time_trial')
          or exists (
            select 1
            from public.youth_academy_riders as rider
            join public.countries as country on country.id = rider.country_id
            where rider.team_id = context.team_id
              and rider.status in ('active', 'recruited')
              and country.iso_alpha2 = edition.country_code
          )
        )$previous$, E'\r\n', E'\n');
  eligible_filter constant text := replace($eligible$        where edition.selection_minimum <= (
          select count(*)
          from public.development_team_roster as roster
          join public.youth_academy_riders as rider on rider.id = roster.academy_rider_id
          where roster.development_team_id = development_team.id
            and rider.team_id = context.team_id
            and rider.status in ('active', 'recruited')
            and (
              edition.competition_type not in ('national_road', 'national_time_trial')
              or (
                context.game_year - rider.birth_game_year >= 16
                and exists (
                  select 1
                  from public.countries as country
                  where country.id = rider.country_id
                    and country.iso_alpha2 = edition.country_code
                )
              )
            )
        )$eligible$, E'\r\n', E'\n');
begin
  if length(definition) - length(replace(definition, previous_filter, '')) <> length(previous_filter) then
    raise exception 'Unexpected DevTeam registration reminder filter.';
  end if;

  execute replace(definition, previous_filter, eligible_filter);
end;
$migration$;

commit;
