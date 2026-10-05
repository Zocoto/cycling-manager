begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

-- Isolated from the feed: no trigger, realtime subscription or player mutation.
alter table public.global_chat_message_translations drop constraint if exists global_chat_message_translations_target_locale;
alter table public.global_chat_message_translations add constraint global_chat_message_translations_target_locale
  check (target_locale in ('fr','en','es','de','it','pt','nl','pl','ja','ko','zh','ar')) not valid;
alter table public.global_chat_message_translations validate constraint global_chat_message_translations_target_locale;
alter table public.global_chat_translation_requests drop constraint if exists global_chat_translation_requests_target_locale;
alter table public.global_chat_translation_requests add constraint global_chat_translation_requests_target_locale
  check (target_locale in ('fr','en','es','de','it','pt','nl','pl','ja','ko','zh','ar')) not valid;
alter table public.global_chat_translation_requests validate constraint global_chat_translation_requests_target_locale;

create table public.global_chat_translation_daily_budget (
  budget_date date primary key,
  reserved_characters integer not null default 0 check (reserved_characters between 0 and 15000),
  reserved_generations integer not null default 0 check (reserved_generations between 0 and 200),
  pause_until timestamptz
);
create table public.global_chat_translation_jobs (
  message_id uuid not null references public.global_chat_messages(id) on delete cascade,
  target_locale text not null,
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  ticket uuid not null,
  retry_after timestamptz not null,
  primary key (message_id, target_locale)
);
create index global_chat_translation_jobs_ticket_idx on public.global_chat_translation_jobs(ticket);
alter table public.global_chat_translation_daily_budget enable row level security;
alter table public.global_chat_translation_jobs enable row level security;
revoke all on table public.global_chat_translation_daily_budget, public.global_chat_translation_jobs from public, anon, authenticated;
grant all on table public.global_chat_translation_daily_budget, public.global_chat_translation_jobs to service_role;

-- Cache hits do not write, count towards quotas, or call the provider. Reserve
-- BEFORE network IO: short row locks coalesce misses across all Vercel instances.
create function public.claim_global_chat_translation_batch(p_sporting_director_id uuid, p_target_locale text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '500ms' as $$
declare
  v_item jsonb; v_id uuid; v_fingerprint text; v_characters integer;
  v_cached public.global_chat_message_translations%rowtype;
  v_job public.global_chat_translation_jobs%rowtype;
  v_budget public.global_chat_translation_daily_budget%rowtype;
  v_day date := (pg_catalog.now() at time zone 'UTC')::date;
  v_ticket uuid := pg_catalog.gen_random_uuid();
  v_locked boolean := false; v_used integer := 0; v_status text;
  v_result jsonb := '[]'::jsonb;
begin
  if p_target_locale is null or p_target_locale not in ('fr','en','es','de','it','pt','nl','pl','ja','ko','zh','ar')
    or p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) not between 1 and 5 then
    raise exception 'Invalid translation batch';
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    v_id := (v_item->>'message_id')::uuid;
    v_fingerprint := v_item->>'source_fingerprint';
    v_characters := (v_item->>'characters')::integer;
    if v_id is null or v_fingerprint is null or v_fingerprint !~ '^[0-9a-f]{64}$' or v_characters is null or v_characters not between 0 and 500 then
      raise exception 'Invalid translation source';
    end if;
    select * into v_cached from public.global_chat_message_translations
      where message_id = v_id and target_locale = p_target_locale and source_fingerprint = v_fingerprint;
    if found then
      v_result := v_result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('messageId',v_id,'status','cached',
        'translatedText',v_cached.translated_message,'detectedSourceLocale',v_cached.detected_source_locale));
      continue;
    end if;
    if not v_locked then
      insert into public.global_chat_translation_daily_budget(budget_date) values(v_day) on conflict do nothing;
      select * into v_budget from public.global_chat_translation_daily_budget where budget_date = v_day for update;
      select pg_catalog.count(*)::integer into v_used from (
        select 1 from public.global_chat_translation_requests where sporting_director_id = p_sporting_director_id
          and created_at >= pg_catalog.now() - interval '1 hour' limit 30
      ) as recent;
      v_locked := true;
    end if;
    select * into v_cached from public.global_chat_message_translations
      where message_id = v_id and target_locale = p_target_locale and source_fingerprint = v_fingerprint;
    if found then
      v_result := v_result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('messageId',v_id,'status','cached',
        'translatedText',v_cached.translated_message,'detectedSourceLocale',v_cached.detected_source_locale));
      continue;
    end if;
    select * into v_job from public.global_chat_translation_jobs where message_id = v_id and target_locale = p_target_locale;
    v_status := case
      when found and v_job.source_fingerprint = v_fingerprint and v_job.retry_after > pg_catalog.now() then 'busy'
      when v_budget.pause_until > pg_catalog.now() then 'unavailable'
      when v_used >= 30 then 'quota'
      when v_budget.reserved_generations >= 200 or v_budget.reserved_characters + v_characters > 15000 then 'budget'
      else 'claimed' end;
    if v_status = 'claimed' then
      insert into public.global_chat_translation_jobs(message_id,target_locale,source_fingerprint,ticket,retry_after)
        values(v_id,p_target_locale,v_fingerprint,v_ticket,pg_catalog.now() + interval '60 seconds')
        on conflict(message_id,target_locale) do update set source_fingerprint=excluded.source_fingerprint,
          ticket=excluded.ticket,retry_after=excluded.retry_after;
      insert into public.global_chat_translation_requests(sporting_director_id,message_id,target_locale)
        values(p_sporting_director_id,v_id,p_target_locale);
      v_used := v_used + 1;
      v_budget.reserved_characters := v_budget.reserved_characters + v_characters;
      v_budget.reserved_generations := v_budget.reserved_generations + 1;
    end if;
    v_result := v_result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('messageId',v_id,'status',v_status,'ticket',
      case when v_status = 'claimed' then v_ticket else null end));
  end loop;
  if v_locked then
    update public.global_chat_translation_daily_budget set reserved_characters=v_budget.reserved_characters,
      reserved_generations=v_budget.reserved_generations where budget_date=v_day;
  end if;
  return v_result;
end;
$$;

create function public.complete_global_chat_translation_batch(p_ticket uuid, p_results jsonb, p_success boolean)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '500ms' as $$
declare v_job public.global_chat_translation_jobs%rowtype; v_result jsonb;
begin
  if p_results is null or pg_catalog.jsonb_typeof(p_results) <> 'array' or pg_catalog.jsonb_array_length(p_results) > 5 then
    raise exception 'Invalid translation results';
  end if;
  -- Same lock order as claim (budget, then jobs), including provider failures.
  if not p_success then
    update public.global_chat_translation_daily_budget set pause_until=pg_catalog.now()+interval '2 minutes'
      where budget_date=(pg_catalog.now() at time zone 'UTC')::date;
  end if;
  for v_job in select * from public.global_chat_translation_jobs where ticket=p_ticket for update loop
    select value into v_result from pg_catalog.jsonb_array_elements(p_results) where value->>'messageId'=v_job.message_id::text limit 1;
    if p_success and v_result is not null and pg_catalog.length(v_result->>'translatedText') between 1 and 3200
      and v_result->>'provider' in ('deepl','vercel-ai-gateway') then
      insert into public.global_chat_message_translations(message_id,target_locale,source_fingerprint,translated_message,detected_source_locale,provider)
        values(v_job.message_id,v_job.target_locale,v_job.source_fingerprint,v_result->>'translatedText',v_result->>'detectedSourceLocale',v_result->>'provider')
        on conflict(message_id,target_locale) do update set source_fingerprint=excluded.source_fingerprint,
          translated_message=excluded.translated_message,detected_source_locale=excluded.detected_source_locale,
          provider=excluded.provider,updated_at=pg_catalog.now();
      delete from public.global_chat_translation_jobs where message_id=v_job.message_id and target_locale=v_job.target_locale and ticket=p_ticket;
    else
      update public.global_chat_translation_jobs set retry_after=pg_catalog.now()+interval '10 minutes'
        where message_id=v_job.message_id and target_locale=v_job.target_locale and ticket=p_ticket;
    end if;
  end loop;
end;
$$;
revoke all on function public.claim_global_chat_translation_batch(uuid,text,jsonb), public.complete_global_chat_translation_batch(uuid,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_global_chat_translation_batch(uuid,text,jsonb), public.complete_global_chat_translation_batch(uuid,jsonb,boolean) to service_role;
notify pgrst, 'reload schema';
commit;
