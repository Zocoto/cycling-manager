-- Presentation metadata only: retain every rider for other consumables and
-- leave redemption, nationality changes, rewards and history untouched.
begin;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

do $passport_targets$
declare
  v_definition text;
  v_anchor constant text := $anchor$'countryName', country.name,$anchor$;
begin
  v_definition := pg_get_functiondef('public.get_current_team_item_target_values()'::regprocedure);
  if position('canNaturalizeWithPassport' in v_definition) > 0 then
    raise exception 'Sporting passport target metadata already exists; review schema drift.';
  end if;
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('from current_context as context' in v_definition) = 0 then
    raise exception 'Unexpected item-target function; passport update cancelled.';
  end if;
  v_definition := replace(v_definition, v_anchor, $replacement$'countryName', country.name,
        'canNaturalizeWithPassport', coalesce(
          rider.country_id <> (
            select team_season.registration_country_id
            from public.team_seasons as team_season
            where team_season.team_id = context.team_id
              and team_season.season_id = context.season_id
              and team_season.status in ('planned', 'active')
          )
          and not exists (
            select 1
            from public.rider_national_championship_titles as title
            where title.rider_id = rider.id
              and title.championship_type in ('road', 'time_trial')
          ), false
        ),$replacement$);
  execute v_definition;
end;
$passport_targets$;

notify pgrst, 'reload schema';
commit;
