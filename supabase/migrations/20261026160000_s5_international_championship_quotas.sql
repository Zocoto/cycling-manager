begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
set local application_name = 's5-championship-quota-migration';

-- S5 onward only. Ranking inputs, J8 freeze, consent and existing deadlines stay unchanged.
create or replace function public.get_international_championship_rider_quota(
  p_competition_code text, p_profile_label text, p_rank integer
)
returns integer language sql immutable strict set search_path = '' as $$
  select case
    when p_rank < 1 or p_competition_code not in ('world_championship','continental_championship')
      or p_profile_label not in ('Route','Chrono') then 0
    when p_competition_code = 'world_championship' and p_rank > 60 then 0
    when p_profile_label = 'Chrono' then case when p_rank <= 20 then 2 else 1 end
    when p_competition_code = 'world_championship' then
      case when p_rank <= 10 then 8 when p_rank <= 30 then 4 else 2 end
    else case when p_rank <= 5 then 8 when p_rank <= 10 then 6
      when p_rank <= 20 then 5 when p_rank <= 30 then 4 when p_rank <= 40 then 3 else 2 end
  end;
$$;
revoke all on function public.get_international_championship_rider_quota(text,text,integer) from public,anon,authenticated;
grant execute on function public.get_international_championship_rider_quota(text,text,integer) to service_role;

create or replace function public.get_federation_selection_rider_limit(p_country_id uuid,p_season_id uuid,p_slot_key text)
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when s.game_year >= 5 and slot.rider_category = 'professional'
      and slot.competition_code in ('world_championship','continental_championship') then
      case when qualification.is_qualified then
        public.get_international_championship_rider_quota(slot.competition_code,slot.profile_label,qualification.qualification_rank)
      when qualification.country_id is not null or exists (
        select 1 from public.international_nation_qualification_snapshots frozen
        where frozen.season_id = s.id and frozen.competition_code = slot.competition_code
      ) then 0
      -- J1-J7 drafts retain the maximum until J8 assigns the immutable quota.
      else slot.rider_limit end
    when s.game_year >= 4 and s.game_year % 4 = 0 and p_slot_key in ('nc-hills','nc-time-trial') then
      coalesce((select case p_slot_key when 'nc-time-trial' then q.time_trial_rider_quota else q.rider_quota end
        from public.national_federation_olympic_qualifications q where q.season_id=s.id and q.country_id=p_country_id),0)
    else slot.rider_limit end
  from public.seasons s cross join public.national_federation_selection_slots slot
  left join public.international_nation_qualification_snapshots qualification
    on s.game_year >= 5 and qualification.season_id=s.id and qualification.country_id=p_country_id
      and qualification.competition_code=slot.competition_code
  where s.id=p_season_id and slot.slot_key=p_slot_key;
$$;

-- Preserve the reviewed production implementations and fail closed on drift.
do $patch$
declare definition text; before_text text; after_text text;
begin
  definition := replace(pg_get_functiondef('public.freeze_due_international_nation_qualifications(timestamptz)'::regprocedure),chr(13),'');
  if position('ranked.world_rank <= 30 as is_qualified' in definition)=0
    or position('ranked.continental_rank <= 20' in definition)=0 then
    raise exception 'Unexpected qualification freeze definition; S5 quota migration aborted.';
  end if;
  definition := replace(definition,'ranked.world_rank <= 30 as is_qualified',
    'ranked.world_rank <= case when v_season.game_year >= 5 then 60 else 30 end as is_qualified');
  definition := replace(definition,'ranked.continental_rank <= 20',
    '(v_season.game_year >= 5 or ranked.continental_rank <= 20)');
  execute definition;

  -- The existing parent-row lock serializes approvals, including concurrent DS responses.
  definition := replace(pg_get_functiondef('public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure),chr(13),'');
  before_text := E'  update public.national_federation_selection_members\n  set\n    response_status = case when p_accept then ''confirmed'' else ''declined'' end,';
  if position(before_text in definition)=0 or position('for update of selection_list' in definition)=0 then
    raise exception 'Unexpected callup response definition; S5 quota migration aborted.';
  end if;
  after_text := $guard$  -- s5_championship_quotas: never confirm beyond the frozen national quota.
  if p_accept and v_season.game_year >= 5 and v_slot.rider_category='professional'
    and v_slot.competition_code in ('world_championship','continental_championship')
    and (select count(*) from public.national_federation_selection_members
      where selection_list_id=v_list.id and response_status='confirmed')
      >= coalesce(public.get_federation_selection_rider_limit(v_list.country_id,v_list.season_id,v_list.slot_key),0) then
    raise exception 'Le quota de cette épreuve est atteint.';
  end if;
$guard$ || before_text;
  execute replace(definition,before_text,after_text);
end;
$patch$;

-- Versioned read RPC: no breaking return-type change and no extra page query.
create or replace function public.get_national_federation_preselection_schedule_v2(p_country_id uuid,p_season_id uuid)
returns table(slot_key text,label text,rider_category text,race_edition_id uuid,race_href text,
  departure_at timestamptz,closes_at timestamptz,is_open boolean,can_prepare boolean,
  qualification_status text,qualification_day_number integer,rider_limit integer,qualification_rank integer)
language sql stable security definer set search_path = '' as $$
  select schedule.*,public.get_federation_selection_rider_limit(p_country_id,p_season_id,schedule.slot_key),
    qualification.qualification_rank
  from public.get_national_federation_preselection_schedule(p_country_id,p_season_id) schedule
  join public.national_federation_selection_slots slot on slot.slot_key=schedule.slot_key
  left join public.international_nation_qualification_snapshots qualification
    on qualification.season_id=p_season_id and qualification.country_id=p_country_id
      and qualification.competition_code=slot.competition_code;
$$;
revoke all on function public.get_national_federation_preselection_schedule_v2(uuid,uuid) from public,anon;
grant execute on function public.get_national_federation_preselection_schedule_v2(uuid,uuid) to authenticated,service_role;

-- Future generated editions must not keep the old 20/30-nation field capacity.
-- Only edition writes pay this cost, never page views, callups or race simulation.
create or replace function public.set_s5_championship_field_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare competition text; continent text; profile text; nation_count integer;
begin
  select race.competition_type,race.championship_continent_code,
    case when race.slug like '%contre-la-montre%' then 'Chrono' else 'Route' end
    into competition,continent,profile
  from public.races race join public.seasons season on season.id=new.season_id and season.game_year>=5
  where race.id=new.race_id and race.competition_type in ('world_championship','continental_championship');
  if competition is null or new.status in ('completed','cancelled') then return new; end if;
  if competition='world_championship' then nation_count:=60;
  else select count(*)::integer into nation_count from public.countries where is_active and continent_code=continent;
  end if;
  select coalesce(sum(public.get_international_championship_rider_quota(competition,profile,position)),0)::integer
    into new.field_limit from generate_series(1,nation_count) position;
  return new;
end;
$$;
revoke all on function public.set_s5_championship_field_limit() from public,anon,authenticated;
create trigger set_s5_championship_field_limit before insert or update of field_limit,race_id,season_id
on public.race_editions for each row execute function public.set_s5_championship_field_limit();

-- If a future calendar was already generated, refresh only its unstarted championships.
update public.race_editions edition set field_limit=edition.field_limit
from public.seasons season,public.races race
where season.id=edition.season_id and season.game_year>=5 and race.id=edition.race_id
  and race.competition_type in ('world_championship','continental_championship')
  and edition.status not in ('completed','cancelled')
  and not exists (select 1 from public.stages stage where stage.race_edition_id=edition.id and stage.status not in ('planned','scheduled'));

comment on function public.freeze_due_international_nation_qualifications(timestamptz) is
  'Qualification figée à J8 : S3-S4 top 30 CM/top 20 CC ; dès S5 top 60 CM/toutes nations CC. Même classement et report de 25 %.';
notify pgrst,'reload schema';
commit;
