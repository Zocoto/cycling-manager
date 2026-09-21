begin;

-- Keep exceptional rerolls explicit and auditable. The row is scoped to one
-- director and one game day, so it cannot alter another player's offers or a
-- later reward cycle.
create table if not exists public.daily_reward_offer_rerolls (
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  season_day_id uuid not null
    references public.season_days(id) on delete cascade,
  reroll_token text not null,
  reason text not null,
  previous_offer_keys text[] not null default '{}'::text[],
  replacement_offer_keys text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  primary key (sporting_director_id, season_day_id),
  constraint daily_reward_offer_rerolls_token_present
    check (btrim(reroll_token) <> ''),
  constraint daily_reward_offer_rerolls_reason_present
    check (btrim(reason) <> '')
);

alter table public.daily_reward_offer_rerolls enable row level security;

revoke all on table public.daily_reward_offer_rerolls
  from public, anon, authenticated;
grant select on table public.daily_reward_offer_rerolls to service_role;

comment on table public.daily_reward_offer_rerolls is
  'Rerolls exceptionnels des offres quotidiennes, limités à un DS et un jour de saison précis.';

create or replace function public.get_daily_reward_offer_sort_key(
  p_reward_key text,
  p_director_id uuid,
  p_season_day_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(
    p_reward_key
      || p_director_id::text
      || p_season_day_id::text
      || coalesce((
        select reroll.reroll_token
        from public.daily_reward_offer_rerolls as reroll
        where reroll.sporting_director_id = p_director_id
          and reroll.season_day_id = p_season_day_id
      ), '')
  );
$$;

revoke all on function public.get_daily_reward_offer_sort_key(text, uuid, uuid)
  from public, anon, authenticated;

comment on function public.get_daily_reward_offer_sort_key(text, uuid, uuid) is
  'Clé de tri déterministe des cadeaux quotidiens, avec un sel uniquement lorsqu’un reroll ciblé existe.';

-- Patch both the overview and claim validation from their live definitions.
-- The guarded replacement makes the migration fail instead of silently
-- diverging if either function has changed shape beforehand.
do $patch_daily_reward_functions$
declare
  v_definition text;
  v_pattern constant text :=
    'md5\(\s*catalog\.reward_key\s*\|\|\s*v_context\.director_id::text\s*\|\|\s*v_context\.season_day_id::text\s*\)';
  v_match_count integer;
begin
  select pg_get_functiondef(
    'public.get_current_daily_reward_overview()'::regprocedure
  )
  into v_definition;

  select count(*)
  into v_match_count
  from regexp_matches(v_definition, v_pattern, 'g');

  if v_match_count <> 1 then
    raise exception
      'Le patch du récapitulatif quotidien attend une expression de tri, % trouvée(s).',
      v_match_count;
  end if;

  v_definition := regexp_replace(
    v_definition,
    v_pattern,
    'public.get_daily_reward_offer_sort_key(catalog.reward_key, v_context.director_id, v_context.season_day_id)',
    'g'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.claim_current_daily_reward(text)'::regprocedure
  )
  into v_definition;

  select count(*)
  into v_match_count
  from regexp_matches(v_definition, v_pattern, 'g');

  if v_match_count <> 1 then
    raise exception
      'Le patch de validation du cadeau quotidien attend une expression de tri, % trouvée(s).',
      v_match_count;
  end if;

  v_definition := regexp_replace(
    v_definition,
    v_pattern,
    'public.get_daily_reward_offer_sort_key(catalog.reward_key, v_context.director_id, v_context.season_day_id)',
    'g'
  );
  execute v_definition;
end;
$patch_daily_reward_functions$;

do $reroll_rigobert_day_40$
declare
  v_director_id constant uuid := '68ac37d2-0f42-4601-b892-d6661bd26f1d';
  v_expected_previous constant text[] := array[
    'ultimate-prototype',
    'custom-staff-mandate',
    'staff-expertise-badge'
  ]::text[];
  v_expected_replacement constant text[] := array[
    'golden-ticket',
    'historic-training',
    'high-performance-cell'
  ]::text[];
  v_season_day_id uuid;
  v_current_day_number integer;
  v_cycle_day integer;
  v_previous text[];
  v_replacement text[];
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = v_director_id
      and director.status = 'active'
      and lower(director.display_name) = 'rigobert'
  ) then
    raise exception 'Le compte actif Rigobert attendu est introuvable.';
  end if;

  select day.id, season.current_day_number
  into strict v_season_day_id, v_current_day_number
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = season.current_day_number
  where season.status = 'active';

  select state.cycle_day
  into strict v_cycle_day
  from public.daily_reward_streak_states as state
  where state.sporting_director_id = v_director_id;

  if v_cycle_day <> 39
     or public.get_next_daily_reward_cycle_day(v_cycle_day) <> 40 then
    raise exception
      'Rigobert doit être à 39/40 avant le reroll, état actuel : %/40.',
      v_cycle_day;
  end if;

  if exists (
    select 1
    from public.daily_reward_claims as claim
    where claim.sporting_director_id = v_director_id
      and claim.season_day_id = v_season_day_id
  ) then
    raise exception 'Rigobert a déjà récupéré son cadeau du jour %.', v_current_day_number;
  end if;

  select array(
    select catalog.reward_key
    from public.daily_reward_catalog as catalog
    where catalog.is_active
      and catalog.importance = 10
    order by md5(
      catalog.reward_key || v_director_id::text || v_season_day_id::text
    )
    limit 3
  )
  into v_previous;

  if v_previous <> v_expected_previous then
    raise exception
      'Le tirage initial de Rigobert a changé : % au lieu de %.',
      v_previous,
      v_expected_previous;
  end if;

  insert into public.daily_reward_offer_rerolls (
    sporting_director_id,
    season_day_id,
    reroll_token,
    reason,
    previous_offer_keys
  ) values (
    v_director_id,
    v_season_day_id,
    'reroll-13',
    'Reroll manuel autorisé du cadeau 40/40 de Rigobert.',
    v_previous
  )
  on conflict (sporting_director_id, season_day_id) do update set
    reroll_token = excluded.reroll_token,
    reason = excluded.reason,
    previous_offer_keys = excluded.previous_offer_keys;

  select array(
    select catalog.reward_key
    from public.daily_reward_catalog as catalog
    where catalog.is_active
      and catalog.importance = 10
    order by public.get_daily_reward_offer_sort_key(
      catalog.reward_key,
      v_director_id,
      v_season_day_id
    )
    limit 3
  )
  into v_replacement;

  if v_replacement <> v_expected_replacement then
    raise exception
      'Le nouveau tirage de Rigobert est inattendu : % au lieu de %.',
      v_replacement,
      v_expected_replacement;
  end if;

  if v_previous && v_replacement then
    raise exception
      'Le reroll doit remplacer les trois choix, ancien %, nouveau %.',
      v_previous,
      v_replacement;
  end if;

  update public.daily_reward_offer_rerolls
  set replacement_offer_keys = v_replacement
  where sporting_director_id = v_director_id
    and season_day_id = v_season_day_id;
end;
$reroll_rigobert_day_40$;

notify pgrst, 'reload schema';

commit;
