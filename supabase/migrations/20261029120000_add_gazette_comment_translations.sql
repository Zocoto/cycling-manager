begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- A separate bounded cache/budget: Gazette reading cannot consume chat quotas.
-- Public, frozen quotations only. No trigger on editions, interviews or races.
create table public.gazette_comment_translations (
  source_fingerprint text not null check(source_fingerprint ~ '^[0-9a-f]{64}$'),
  target_locale text not null check(target_locale in ('fr','en')),
  translated_message text not null check(length(translated_message) between 1 and 3200),
  detected_source_locale text,
  provider text not null check(provider in ('deepl','vercel-ai-gateway')),
  updated_at timestamptz not null default now(),
  primary key(source_fingerprint,target_locale)
);
create table public.gazette_comment_translation_jobs (
  source_fingerprint text not null,
  target_locale text not null check(target_locale in ('fr','en')),
  message_id text not null check(length(message_id) between 1 and 300),
  ticket uuid not null,
  retry_after timestamptz not null,
  primary key(source_fingerprint,target_locale)
);
create index gazette_comment_translation_jobs_ticket_idx on public.gazette_comment_translation_jobs(ticket);
create table public.gazette_comment_translation_requests (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index gazette_comment_translation_requests_director_idx
  on public.gazette_comment_translation_requests(sporting_director_id,created_at desc);
create table public.gazette_comment_translation_daily_budget (
  budget_date date primary key,
  reserved_characters integer not null default 0 check(reserved_characters between 0 and 15000),
  reserved_generations integer not null default 0 check(reserved_generations between 0 and 200),
  pause_until timestamptz
);
alter table public.gazette_comment_translations enable row level security;
alter table public.gazette_comment_translation_jobs enable row level security;
alter table public.gazette_comment_translation_requests enable row level security;
alter table public.gazette_comment_translation_daily_budget enable row level security;
revoke all on public.gazette_comment_translations,public.gazette_comment_translation_jobs,
  public.gazette_comment_translation_requests,public.gazette_comment_translation_daily_budget from public,anon,authenticated;
grant all on public.gazette_comment_translations,public.gazette_comment_translation_jobs,
  public.gazette_comment_translation_requests,public.gazette_comment_translation_daily_budget to service_role;

create function public.claim_gazette_comment_translation_batch(p_sporting_director_id uuid,p_target_locale text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='500ms' as $$
declare
  v_item jsonb; v_id text; v_fingerprint text; v_characters integer;
  v_cached public.gazette_comment_translations%rowtype;
  v_job public.gazette_comment_translation_jobs%rowtype;
  v_budget public.gazette_comment_translation_daily_budget%rowtype;
  v_day date := (now() at time zone 'UTC')::date;
  v_ticket uuid := gen_random_uuid();
  v_locked boolean := false; v_used integer := 0; v_status text;
  v_result jsonb := '[]'::jsonb;
begin
  if p_sporting_director_id is null or p_target_locale is null or p_target_locale not in ('fr','en') or
    p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 5 then
    raise exception 'Invalid translation batch';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id := v_item->>'message_id'; v_fingerprint := v_item->>'source_fingerprint';
    v_characters := (v_item->>'characters')::integer;
    if v_id is null or length(v_id) not between 1 and 300 or v_fingerprint is null or
      v_fingerprint !~ '^[0-9a-f]{64}$' or v_characters is null or v_characters not between 1 and 600 then
      raise exception 'Invalid translation source';
    end if;
    select * into v_cached from public.gazette_comment_translations
      where source_fingerprint=v_fingerprint and target_locale=p_target_locale;
    if found then
      v_result := v_result || jsonb_build_array(jsonb_build_object('messageId',v_id,'status','cached',
        'translatedText',v_cached.translated_message,'detectedSourceLocale',v_cached.detected_source_locale));
      continue;
    end if;
    if not v_locked then
      insert into public.gazette_comment_translation_daily_budget(budget_date) values(v_day) on conflict do nothing;
      select * into v_budget from public.gazette_comment_translation_daily_budget where budget_date=v_day for update;
      select count(*)::integer into v_used from (
        select 1 from public.gazette_comment_translation_requests where sporting_director_id=p_sporting_director_id
          and created_at>=now()-interval '1 hour' limit 30
      ) as recent;
      v_locked := true;
    end if;
    -- Recheck after the short reservation lock; cache hits never spend quota.
    select * into v_cached from public.gazette_comment_translations
      where source_fingerprint=v_fingerprint and target_locale=p_target_locale;
    if found then
      v_result := v_result || jsonb_build_array(jsonb_build_object('messageId',v_id,'status','cached',
        'translatedText',v_cached.translated_message,'detectedSourceLocale',v_cached.detected_source_locale));
      continue;
    end if;
    select * into v_job from public.gazette_comment_translation_jobs
      where source_fingerprint=v_fingerprint and target_locale=p_target_locale;
    v_status := case
      when found and v_job.retry_after>now() then 'busy'
      when v_budget.pause_until>now() then 'unavailable'
      when v_used>=30 then 'quota'
      when v_budget.reserved_generations>=200 or v_budget.reserved_characters+v_characters>15000 then 'budget'
      else 'claimed' end;
    if v_status='claimed' then
      insert into public.gazette_comment_translation_jobs(source_fingerprint,target_locale,message_id,ticket,retry_after)
        values(v_fingerprint,p_target_locale,v_id,v_ticket,now()+interval '60 seconds')
        on conflict(source_fingerprint,target_locale) do update set
          message_id=excluded.message_id,ticket=excluded.ticket,retry_after=excluded.retry_after;
      insert into public.gazette_comment_translation_requests(sporting_director_id) values(p_sporting_director_id);
      v_used:=v_used+1;
      v_budget.reserved_characters:=v_budget.reserved_characters+v_characters;
      v_budget.reserved_generations:=v_budget.reserved_generations+1;
    end if;
    v_result := v_result || jsonb_build_array(jsonb_build_object('messageId',v_id,'status',v_status,
      'ticket',case when v_status='claimed' then v_ticket else null end));
  end loop;
  if v_locked then
    update public.gazette_comment_translation_daily_budget set reserved_characters=v_budget.reserved_characters,
      reserved_generations=v_budget.reserved_generations where budget_date=v_day;
  end if;
  return v_result;
end;
$$;

create function public.complete_gazette_comment_translation_batch(p_ticket uuid,p_results jsonb,p_success boolean)
returns void language plpgsql security definer set search_path='' set lock_timeout='500ms' as $$
declare v_job public.gazette_comment_translation_jobs%rowtype; v_result jsonb;
begin
  if p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>5 then
    raise exception 'Invalid translation results';
  end if;
  -- Preserve the claim lock order: budget before jobs, including failures.
  perform 1 from public.gazette_comment_translation_daily_budget
    where budget_date=(now() at time zone 'UTC')::date for update;
  if not p_success then
    update public.gazette_comment_translation_daily_budget set pause_until=now()+interval '2 minutes'
      where budget_date=(now() at time zone 'UTC')::date;
  end if;
  for v_job in select * from public.gazette_comment_translation_jobs where ticket=p_ticket for update loop
    select value into v_result from jsonb_array_elements(p_results) where value->>'messageId'=v_job.message_id limit 1;
    if p_success and v_result is not null and length(v_result->>'translatedText') between 1 and 3200
      and v_result->>'provider' in ('deepl','vercel-ai-gateway') then
      insert into public.gazette_comment_translations(source_fingerprint,target_locale,translated_message,detected_source_locale,provider)
        values(v_job.source_fingerprint,v_job.target_locale,v_result->>'translatedText',v_result->>'detectedSourceLocale',v_result->>'provider')
        on conflict(source_fingerprint,target_locale) do update set translated_message=excluded.translated_message,
          detected_source_locale=excluded.detected_source_locale,provider=excluded.provider,updated_at=now();
      delete from public.gazette_comment_translation_jobs where source_fingerprint=v_job.source_fingerprint
        and target_locale=v_job.target_locale and ticket=p_ticket;
    else
      update public.gazette_comment_translation_jobs set retry_after=now()+interval '10 minutes'
        where source_fingerprint=v_job.source_fingerprint and target_locale=v_job.target_locale and ticket=p_ticket;
    end if;
  end loop;
end;
$$;
revoke all on function public.claim_gazette_comment_translation_batch(uuid,text,jsonb),
  public.complete_gazette_comment_translation_batch(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.claim_gazette_comment_translation_batch(uuid,text,jsonb),
  public.complete_gazette_comment_translation_batch(uuid,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
commit;
