begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.national_federation_elections
  add column is_presidency_claim boolean not null default false;

-- Match the existing inactivity lifecycle's 30-day threshold. The primary key
-- (auth_user_id, activity_on) makes each latest-presence lookup bounded.
-- This only decides automatic appointment in a vacant federation: an absent
-- human keeps their electoral rights, and an incumbent is never dismissed.
create or replace function private.is_active_federation_member(p_director_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sporting_directors director
    where director.id = p_director_id and director.status = 'active'
      and director.auth_user_id is not null
      and not exists (select 1 from public.alpha_bot_managers bot
        where bot.sporting_director_id = director.id or bot.auth_user_id = director.auth_user_id)
      and coalesce((
        select coalesce(activity.last_seen_at, activity.activity_on::timestamp at time zone 'Europe/Paris')
        from public.player_daily_activity activity
        where activity.auth_user_id = director.auth_user_id
        order by activity.activity_on desc limit 1
      ), director.created_at) > now() - interval '30 days'
  );
$$;
revoke all on function private.is_active_federation_member(uuid) from public, anon, authenticated;
grant execute on function private.is_active_federation_member(uuid) to service_role;

-- Preserve the installed affiliation/rollover safeguards rather than replacing
-- the initializer with a second, divergent implementation.
do $active_members$
declare v_definition text; v_marker constant text := 'and director.auth_user_id is not null';
begin
  select pg_get_functiondef('private.ensure_federation_presidency(uuid,uuid,boolean)'::regprocedure) into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker) <> 2 then
    raise exception 'Unexpected federation initializer; active-member patch aborted.';
  end if;
  execute replace(v_definition,v_marker,v_marker || ' and private.is_active_federation_member(director.id)');
  select pg_get_functiondef('public.initialize_due_federation_presidencies()'::regprocedure) into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker) <> 1 then
    raise exception 'Unexpected federation maintenance initializer; active-member patch aborted.';
  end if;
  execute replace(v_definition,v_marker,v_marker || ' and private.is_active_federation_member(director.id)');
end;
$active_members$;

create or replace function public.claim_national_federation_presidency(p_country_code text, p_manifesto text)
returns uuid language plpgsql volatile security definer set search_path = ''
set statement_timeout = '10s' set lock_timeout = '2s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_term public.national_federation_terms%rowtype;
  v_election_id uuid;
  v_manifesto text;
begin
  if (select auth.uid()) is null then raise exception 'Votre session a expiré.'; end if;
  v_manifesto := regexp_replace(btrim(coalesce(p_manifesto,'')), '\s+', ' ', 'g');
  if char_length(v_manifesto) not between 40 and 800 then
    raise exception 'La profession de foi doit contenir entre 40 et 800 caractères.';
  end if;
  select * into v_identity from public.get_current_federation_identity(upper(btrim(p_country_code)));
  select * into v_season from public.seasons where status='active' limit 1;
  if v_identity.country_id is null or v_identity.team_id is null or v_season.id is null or v_season.game_year < 3 then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;
  -- A currently authenticated human is active by this very action, even if
  -- presence tracking has not caught up after a long absence.
  if exists(select 1 from public.alpha_bot_managers bot
    where bot.sporting_director_id=v_identity.sporting_director_id or bot.auth_user_id=(select auth.uid())) then
    raise exception 'Cette action est réservée aux joueurs actifs de la fédération.';
  end if;

  -- Same term -> advisory lock order as affiliation and nationality handling.
  select * into v_term from public.national_federation_terms
  where country_id=v_identity.country_id and v_season.game_year between start_game_year and end_game_year
  order by start_game_year desc limit 1 for update;
  if v_term.id is null or v_term.governance_mode <> 'automatic' or v_term.president_director_id is not null then
    raise exception 'La présidence n’est pas vacante sous administration automatique.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_identity.country_id::text || ':exceptional-election',0));
  select id into v_election_id from public.national_federation_elections
  where country_id=v_identity.country_id and status in ('applications','voting')
    and v_season.game_year between term_start_game_year and term_end_game_year
  order by created_at desc limit 1;
  if v_election_id is not null then
    raise exception using errcode='P0002', message='Un scrutin est déjà ouvert : vous pouvez y déposer votre candidature pendant la phase de candidatures.';
  end if;
  -- A current automatic mandate proves that its original election is over.
  -- A three-day ballot must finish before that mandate itself expires.
  if v_season.game_year = v_term.end_game_year
    and now() + interval '72 hours' >= ((v_season.ends_on + 1)::timestamp at time zone 'Europe/Paris') then
    raise exception 'Le mandat se termine dans moins de trois jours. Participez à l’élection ordinaire.';
  end if;
  if exists (select 1 from generate_series(v_season.game_year,v_term.end_game_year) year(game_year)
    where public.get_projected_team_federation_country_id(v_identity.team_id,year.game_year) is distinct from v_identity.country_id) then
    raise exception 'Votre prochain sponsor principal rattache votre équipe à une autre fédération : vous ne pouvez pas vous présenter à cette présidence.';
  end if;
  insert into public.national_federation_elections(country_id,election_season_id,term_start_game_year,term_end_game_year,
    status,election_type,applications_open_at,applications_close_at,voting_close_at,is_presidency_claim)
  values(v_identity.country_id,v_season.id,v_term.start_game_year,v_term.end_game_year,
    'applications','exceptional',now(),now()+interval '24 hours',now()+interval '72 hours',true)
  returning id into v_election_id;
  insert into public.national_federation_electorate(election_id,team_season_id,team_id,sporting_director_id)
  select v_election_id,ts.id,ts.team_id,a.sporting_director_id
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id and t.status='active'
  join public.team_manager_assignments a on a.team_id=t.id and a.role='general_manager' and a.status='active'
  join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.auth_user_id is not null
  where ts.season_id=v_season.id and ts.registration_country_id=v_identity.country_id and ts.status in ('planned','active')
    and not exists(select 1 from public.alpha_bot_managers bot where bot.sporting_director_id=d.id or bot.auth_user_id=d.auth_user_id)
  on conflict do nothing;
  if not exists(select 1 from public.national_federation_electorate where election_id=v_election_id
    and team_id=v_identity.team_id and sporting_director_id=v_identity.sporting_director_id) then
    raise exception 'Votre équipe ne figure pas sur la liste électorale de ce scrutin.';
  end if;
  insert into public.national_federation_candidates(election_id,sporting_director_id,team_id,manifesto)
  values(v_election_id,v_identity.sporting_director_id,v_identity.team_id,v_manifesto);
  insert into public.national_federation_journal_entries(country_id,season_id,day_number,category,title,detail,source_reference,metadata)
  values(v_identity.country_id,v_season.id,v_season.current_day_number,'governance','Présidence revendiquée',
    v_identity.display_name || ' ouvre une élection accélérée : 24 heures de candidatures, puis 48 heures de vote.',
    'federation-election:' || v_election_id::text || ':applications',
    jsonb_build_object('electionType','exceptional','isPresidencyClaim',true,'claimantDirectorId',v_identity.sporting_director_id,
      'applicationsCloseAt',now()+interval '24 hours','votingCloseAt',now()+interval '72 hours'));
  insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,message_type,sender_name,
    subject,preview,body,action_href,action_label,source_reference,is_important)
  select e.sporting_director_id,v_season.id,e.team_season_id,'system','Gouvernance fédérale','Présidence revendiquée',
    'Une élection accélérée est ouverte dans votre fédération.',
    'Un membre souhaite reprendre la présidence gérée par l’IA. Vous disposez de 24 heures pour vous présenter, puis de 48 heures pour voter. Le président élu terminera le mandat en cours.',
    '/jeu/federations/' || lower(p_country_code) || '?onglet=governance','Voir l’élection',
    'federation-election:' || v_election_id::text || ':applications:' || e.sporting_director_id::text,true
  from public.national_federation_electorate e where e.election_id=v_election_id
  on conflict(sporting_director_id,source_reference) do nothing;
  return v_election_id;
end;
$$;
revoke all on function public.claim_national_federation_presidency(text,text) from public, anon;
grant execute on function public.claim_national_federation_presidency(text,text) to authenticated, service_role;

-- Explicit owner-requested appointment. Historical election results remain
-- intact; this nomination cannot replace an incumbent or interrupt a ballot.
do $appoint_max$
declare v_season public.seasons%rowtype; v_term public.national_federation_terms%rowtype; v_team_season_id uuid;
begin
  select * into v_season from public.seasons where game_year=4 and status='active';
  if v_season.id is null then return; end if;
  select * into v_term from public.national_federation_terms
  where id='97c5eb75-7129-423e-b6c0-d54fc3971e9b' and country_id='88c77a8f-f889-4d47-ba12-d6bcfa70a344'
    and start_game_year=3 and end_game_year=4 for update;
  if v_term.id is null or v_term.president_director_id='96fb299f-20bc-438c-a229-f9f7a421fe0e' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_term.country_id::text || ':exceptional-election',0));
  if v_term.governance_mode <> 'automatic' or v_term.president_director_id is not null or exists(select 1 from public.national_federation_elections
    where country_id=v_term.country_id and status in ('applications','voting')
      and 4 between term_start_game_year and term_end_game_year) then
    raise exception 'La présidence du Botswana a changé ; nomination administrative interrompue.';
  end if;
  select ts.id into strict v_team_season_id from public.team_seasons ts
  join public.teams t on t.id=ts.team_id and t.status='active'
  join public.team_manager_assignments a on a.team_id=t.id and a.status='active' and a.role='general_manager'
  join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.auth_user_id is not null
  where ts.season_id=v_season.id and ts.registration_country_id=v_term.country_id and ts.status='active'
    and d.id='96fb299f-20bc-438c-a229-f9f7a421fe0e';
  update public.national_federation_terms set governance_mode='elected',president_director_id='96fb299f-20bc-438c-a229-f9f7a421fe0e'
  where id=v_term.id;
  insert into public.national_federation_journal_entries(country_id,season_id,day_number,category,title,detail,source_reference,metadata)
  values(v_term.country_id,v_season.id,v_season.current_day_number,'governance','Président nommé',
    'Max Lamenace prend la présidence de la fédération du Botswana pour terminer le mandat S3–S4.',
    'federation-term:' || v_term.id::text || ':admin-max-20261020',
    jsonb_build_object('presidentDirectorId','96fb299f-20bc-438c-a229-f9f7a421fe0e','appointmentType','administrative'))
  on conflict(source_reference) do nothing;
end;
$appoint_max$;

notify pgrst, 'reload schema';
commit;
