-- Limited welcome gift, additional to existing career rewards. No backfill.
begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';

create table if not exists private.welcome_coach_campaigns (
  code text primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  coach_level smallint not null check(coach_level=3),
  check(ends_at=starts_at+interval '10 days')
);
insert into private.welcome_coach_campaigns(code,starts_at,ends_at,coach_level)
select 'welcome_s5_november_2026',started_at,started_at+interval '10 days',3
from(select clock_timestamp() started_at) activation
on conflict(code) do nothing;

-- Retain the account receipt even if a career is reset. Normal account deletion
-- remains possible; no client can insert, remove or replay a receipt.
create table if not exists private.welcome_coach_grants (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  campaign_code text not null references private.welcome_coach_campaigns(code),
  generation_id uuid unique references public.initial_career_generations(id) on delete set null,
  sporting_director_id uuid references public.sporting_directors(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  staff_member_id uuid unique references public.staff_members(id) on delete set null,
  staff_contract_id uuid unique references public.staff_contracts(id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function private.grant_welcome_coach(p_generation_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_campaign private.welcome_coach_campaigns%rowtype;
  v_context record; v_first text; v_last text; v_specialty text; v_talent text;
  v_member uuid; v_contract uuid; v_claimed uuid;
begin
  select * into strict v_campaign from private.welcome_coach_campaigns
  where code='welcome_s5_november_2026';
  select g.id,g.team_id,g.season_id,g.sporting_director_id,d.auth_user_id,
    coalesce(ts.country_id,t.home_country_id) country_id,ts.id team_season_id,ts.currency_code,
    a.created_at registered_at
  into v_context
  from public.initial_career_generations g
  join public.sporting_directors d on d.id=g.sporting_director_id and d.status='active'
  join auth.users a on a.id=d.auth_user_id
  join public.teams t on t.id=g.team_id
  join public.team_seasons ts on ts.team_id=g.team_id and ts.season_id=g.season_id
  where g.id=p_generation_id;
  -- Eligibility uses the server's registration date, never a client clock.
  -- A qualifying account may finish founding its team after the offer closes.
  if not found or v_context.registered_at<v_campaign.starts_at
    or v_context.registered_at>=v_campaign.ends_at then return false; end if;
  if exists(select 1 from public.alpha_bot_managers where sporting_director_id=v_context.sporting_director_id) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('welcome-coach:'||v_context.auth_user_id::text,0));
  insert into private.welcome_coach_grants(auth_user_id,campaign_code,generation_id,sporting_director_id,team_id,season_id)
  values(v_context.auth_user_id,v_campaign.code,v_context.id,v_context.sporting_director_id,v_context.team_id,v_context.season_id)
  on conflict(auth_user_id) do nothing returning auth_user_id into v_claimed;
  if v_claimed is null then return false; end if;

  -- The starter riders are already present at this lifecycle point. No retired
  -- relational name catalog or additional external service is needed.
  select r.first_name,r.last_name into v_first,v_last
  from public.rider_contracts c join public.riders r on r.id=c.rider_id
  where c.team_id=v_context.team_id and c.start_season_id=v_context.season_id
  order by random() limit 1;
  v_first:=coalesce(nullif(btrim(v_first),''),'Alex');
  v_last:=coalesce(nullif(btrim(v_last),''),'Martin');
  v_specialty:=(array['mountain','hills','flat','sprint','time_trial','cobbles','endurance'])[1+floor(random()*7)::integer];
  select code into strict v_talent from public.staff_talent_catalog
  where role='trainer' and is_active and minimum_level<=v_campaign.coach_level
    and code<>'trainer_'||v_specialty order by random() limit 1;
  insert into public.staff_members(country_id,first_name,last_name,role,level,trainer_specialty)
  values(v_context.country_id,v_first,v_last,'trainer',v_campaign.coach_level,v_specialty)
  returning id into v_member;
  insert into public.staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by)
  values(v_member,1,v_talent,'generation');
  insert into public.staff_contracts(staff_member_id,team_id,start_season_id,salary_per_season,
    currency_code,signing_fee,status,salary_waived_season_id)
  values(v_member,v_context.team_id,v_context.season_id,public.calculate_staff_salary('trainer',v_campaign.coach_level),
    v_context.currency_code,0,'active',v_context.season_id) returning id into v_contract;
  update private.welcome_coach_grants set staff_member_id=v_member,staff_contract_id=v_contract
  where auth_user_id=v_context.auth_user_id;
  insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,
    message_type,sender_name,subject,preview,body,action_href,action_label,source_reference,is_important)
  values(v_context.sporting_director_id,v_context.season_id,v_context.team_season_id,
    'system','Direction de Cyclo Stratège','Votre cadeau de bienvenue',
    'Un entraîneur de niveau 3 rejoint votre équipe.',
    E'Bienvenue dans le peloton ! Pour célébrer le passage à la saison 5, un entraîneur de niveau 3, de la nationalité de votre équipe, vous est offert en plus des aides habituelles.\n\nIl est déjà recruté et disponible dans votre staff. Sa spécialité et sa compétence complémentaire sont indiquées sur sa fiche. Vous pouvez lui confier des coureurs depuis les entraînements.\n\nLe recrutement et le salaire sont offerts pour votre saison d’arrivée. Son salaire normal s’appliquera à partir de la saison suivante. Ce cadeau de bienvenue est attribué une seule fois par compte.',
    '/jeu/staff?onglet=equipe','Voir mon entraîneur',
    'welcome-coach:'||v_campaign.code||':'||v_context.auth_user_id::text,true)
  on conflict(sporting_director_id,source_reference) do nothing;
  return true;
end;
$$;

create or replace function private.grant_welcome_coach_after_career()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  begin
    perform private.grant_welcome_coach(new.id);
  exception when others then
    -- Optional campaign failures never roll back registration or starter riders.
    -- The function is idempotent and can retry a real failed grant afterwards.
    raise warning 'Welcome coach deferred for career % [%]: %',new.id,sqlstate,sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists initial_career_welcome_s5_coach on public.initial_career_generations;
create trigger initial_career_welcome_s5_coach after insert on public.initial_career_generations
for each row execute function private.grant_welcome_coach_after_career();

revoke all on table private.welcome_coach_campaigns,private.welcome_coach_grants from public,anon,authenticated;
revoke all on function private.grant_welcome_coach(uuid),private.grant_welcome_coach_after_career() from public,anon,authenticated;
commit;
