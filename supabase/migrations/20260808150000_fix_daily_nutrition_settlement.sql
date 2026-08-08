begin;

-- The initial nutrition migration tried to insert this call by replacing an
-- exact rendering of pg_get_functiondef(). PostgreSQL may render the function
-- body differently, in which case replace() silently leaves it unchanged.
-- Patch the distinctive final return instead and fail loudly if it cannot be
-- found, so daily nutrition can no longer be disconnected unnoticed.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.settle_current_health_and_form()'::regprocedure
  ) into v_definition;

  if position(
    'perform public.settle_due_daily_nutrition_recovery();'
    in v_definition
  ) = 0 then
    v_definition := regexp_replace(
      v_definition,
      '([[:space:]]+return[[:space:]]+query[[:space:]]+select[[:space:]]+v_daily_count,)',
      chr(10) ||
        '  perform public.settle_due_daily_nutrition_recovery();' ||
        chr(10) ||
        E'\\1'
    );
  end if;

  if position(
    'perform public.settle_due_daily_nutrition_recovery();'
    in v_definition
  ) = 0 then
    raise exception
      'Impossible de brancher le règlement nutritionnel quotidien.';
  end if;

  execute v_definition;

  select pg_get_functiondef(
    'public.settle_current_health_and_form()'::regprocedure
  ) into v_definition;

  if position(
    'perform public.settle_due_daily_nutrition_recovery();'
    in v_definition
  ) = 0 then
    raise exception
      'Le règlement nutritionnel quotidien reste absent après le correctif.';
  end if;
end;
$migration$;

-- Idempotent catch-up: the unique (rider_id, season_day_id) constraint makes
-- this safe on databases where part or all of the history already exists.
select public.settle_due_daily_nutrition_recovery();

notify pgrst, 'reload schema';

commit;
