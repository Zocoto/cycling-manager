begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='cyclostratege-future-draft-performance';

-- S5 keeps its original formula, including any append to its frozen pool.
-- Only the S6 and later reservations use performance without an age penalty.
create function public.calculate_season_draft_score_for_edition(
  p_rating jsonb,p_potential integer,p_age integer,p_game_year integer
) returns numeric language sql immutable set search_path='' as $$
  select case when p_game_year>=6 then (
    with r as (
      select coalesce((p_rating->>'mountain')::numeric,0) mo,
        coalesce((p_rating->>'hills')::numeric,0) val,
        coalesce((p_rating->>'time_trial')::numeric,0) clm,
        coalesce((p_rating->>'cobbles')::numeric,0) pav,
        coalesce((p_rating->>'sprint')::numeric,0) spr,
        coalesce((p_rating->>'acceleration')::numeric,0) acc,
        coalesce((p_rating->>'downhill')::numeric,0) des,
        coalesce((p_rating->>'endurance')::numeric,0) endurance,
        coalesce((p_rating->>'resistance')::numeric,0) res,
        coalesce((p_rating->>'recovery')::numeric,0) rec,
        coalesce((p_rating->>'breakaway')::numeric,0) bar,
        coalesce((p_rating->>'prologue')::numeric,0) pro
    )
    select round(.90*greatest(mo,val,clm,pav,spr)
      +.10*((mo+val+clm+pav+spr+acc+des+endurance+res+rec+bar+pro)/12),3)
    from r
  ) else public.calculate_season_draft_score(p_rating,p_potential,p_age) end;
$$;
revoke all on function public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer) to service_role;

-- Preserve locks, guards, eligibility, snapshots, existing ranks and all draft
-- workers. Change only the score call and the two age tie-breakers for S6+.
do $future_score$
declare v_definition text; v_old text; v_new text;
begin
  v_definition:=replace(pg_get_functiondef('public.reserve_season_draft_pool(uuid,integer)'::regprocedure),chr(13),'');
  if md5(v_definition)<>'8db4ed7b934e4899bc64249da273e809' then
    raise exception 'Draft reservation source changed; review before applying the S6 scoring rule.';
  end if;
  v_old:='public.calculate_season_draft_score(to_jsonb(rt),r.potential_steps,rt.age) score';
  v_new:='public.calculate_season_draft_score_for_edition(to_jsonb(rt),r.potential_steps,rt.age,v_edition.game_year) score';
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then
    raise exception 'Expected exactly one draft score call.';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  v_old:='order by score desc,r.potential_steps desc,rt.age,r.id';
  v_new:='order by score desc,r.potential_steps desc,case when v_edition.game_year<6 then rt.age end,r.id';
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then
    raise exception 'Expected exactly one candidate age tie-breaker.';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  v_old:='order by candidate.score desc,candidate.potential_steps desc,candidate.age,candidate.id';
  v_new:='order by candidate.score desc,candidate.potential_steps desc,case when v_edition.game_year<6 then candidate.age end,candidate.id';
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then
    raise exception 'Expected exactly one pool rank age tie-breaker.';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$future_score$;

comment on function public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer) is
  'S6+ : 90 % meilleure primaire MON/VAL/CLM/PAV/SPR, 10 % moyenne des 12 notes hors PLA. Potentiel au départage ; âge sans effet. S5 conserve sa formule historique.';

commit;
