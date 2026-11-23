begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

create or replace function private.calculate_daily_auction_rating(
  p_seed text,
  p_stat text,
  p_minimum integer,
  p_base_maximum integer,
  p_bonus integer,
  p_bonus_cap integer
)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select case when p_bonus = 0 then base_rating
    else greatest(base_rating, least(
      p_bonus_cap,
      base_rating + p_bonus
        + public.calculate_market_random_stat(p_seed, 'experience:' || p_stat, -1, 1)
    ))
    end
  from (select public.calculate_market_random_stat(p_seed, p_stat, p_minimum, p_base_maximum)
    as base_rating) as baseline;
$function$;

revoke all on function private.calculate_daily_auction_rating(text, text, integer, integer, integer, integer)
  from public, anon, authenticated;

do $patch$
declare
  v_definition text;
  v_settings_anchor constant text := '  v_adjustment integer;';
  v_age_anchor constant text := '    v_age := public.calculate_market_random_stat(v_seed, ''age'', 18, 30);';
  v_stat text;
  v_stat_call text;
begin
  select replace(pg_get_functiondef('public.create_daily_transfer_market(date,jsonb,boolean)'::regprocedure),
    E'\r\n', E'\n') into v_definition;

  if position('private.calculate_daily_auction_rating(' in v_definition) > 0 then
    return;
  end if;

  if length(v_definition) - length(replace(v_definition, v_settings_anchor, '')) <> length(v_settings_anchor)
    or length(v_definition) - length(replace(v_definition, v_age_anchor, '')) <> length(v_age_anchor) then
    raise exception 'Daily auction generator settings or age roll not found exactly once.';
  end if;

  v_definition := replace(v_definition, v_settings_anchor, v_settings_anchor || $settings$
  v_experience_bonus integer;
  v_experience_cap integer;$settings$);
  v_definition := replace(v_definition, v_age_anchor, v_age_anchor || $age$

    v_experience_bonus := 0;
    v_experience_cap := v_stat_maximum;
    if v_age >= 26 and public.calculate_market_random_stat(v_seed, 'experience:roll', 0, 99)
      < (case when v_age >= 28 then 70 else 40 end) then
      v_experience_bonus := case when v_age >= 28 then
        public.calculate_market_random_stat(v_seed, 'experience:strength', 3, 5)
      else public.calculate_market_random_stat(v_seed, 'experience:strength', 2, 4) end;
      v_experience_cap := least(
        case when v_is_national_day_bonus then 74 else 73 end,
        public.get_rider_potential_stat_cap(public.calculate_initial_rider_potential_steps(
          v_rider_id, case when v_is_national_day_bonus then 'national_day_auction' else 'auction' end
        ))
      );
    end if;$age$);

  foreach v_stat in array array[
    'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint', 'acceleration',
    'downhill', 'endurance', 'resistance', 'recovery', 'breakaway', 'prologue'
  ] loop
    v_stat_call := format(
      'public.calculate_market_random_stat(v_seed, %L, v_stat_minimum, v_stat_maximum)', v_stat
    );
    if length(v_definition) - length(replace(v_definition, v_stat_call, '')) <> length(v_stat_call) then
      raise exception 'Expected exactly one rating roll for daily auction stat %.', v_stat;
    end if;
    v_definition := replace(v_definition, v_stat_call, format(
      'private.calculate_daily_auction_rating(v_seed, %L, v_stat_minimum, v_stat_maximum, v_experience_bonus, v_experience_cap)',
      v_stat
    ));
  end loop;

  execute v_definition;
end;
$patch$;

commit;
