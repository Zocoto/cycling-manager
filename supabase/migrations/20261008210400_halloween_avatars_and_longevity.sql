begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

-- Keep the immutable native portrait before the separator. Only this trigger
-- can select decorations: user-supplied suffixes are discarded, never trusted.
do $$ declare v_constraint text;begin
  select pg_get_constraintdef(oid) into strict v_constraint from pg_constraint where conrelid='public.sporting_directors'::regclass and conname='sporting_directors_avatar_key_check';
  v_constraint:=replace(v_constraint,'avatar_key','split_part(avatar_key, ''~halloween~'', 1)');
  alter table public.sporting_directors drop constraint sporting_directors_avatar_key_check;
  execute 'alter table public.sporting_directors add constraint sporting_directors_avatar_key_check '||v_constraint;
end $$;

create function public.apply_halloween_avatar()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cosmetics jsonb;v_art text;v_arts text[]:=array[]::text[];v_item text;v_curse text;
begin
  new.avatar_key:=split_part(new.avatar_key,'~halloween~',1);
  if new.avatar_key is null then return new; end if;
  select cosmetics into v_cosmetics from public.halloween_wallets where edition_id='halloween-2026' and user_id=new.auth_user_id;
  for v_item in select value from jsonb_each_text(coalesce(v_cosmetics,'{}')) order by key loop
    v_art:=case v_item when 'lord-vlad' then 'vlad' when 'halloween-background' then 'moon' when 'devil-trident' then 'trident' when 'pumpkin-cap' then 'cap' when 'pocket-bat' then 'bat' when 'spectral-wheel' then 'wheel' when 'cobweb-frame' then 'web' when 'ghost-scarf' then 'scarf' when 'headless-skin' then 'headless' end;
    if v_art is not null then v_arts:=array_append(v_arts,v_art); end if;
  end loop;
  select kind into v_curse from public.halloween_curses where edition_id='halloween-2026' and user_id=new.auth_user_id and expires_at>now();
  if v_curse is not null then v_arts:=array_remove(array_remove(v_arts,'vlad'),'headless');v_arts:=array_append(v_arts,v_curse); end if;
  if cardinality(v_arts)>0 then new.avatar_key:=new.avatar_key||'~halloween~'||array_to_string(v_arts,','); end if;
  return new;
end $$;
create trigger apply_halloween_avatar_before_update before insert or update of avatar_key on public.sporting_directors for each row execute function public.apply_halloween_avatar();

create function public.sync_halloween_avatar()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.sporting_directors set avatar_key=split_part(avatar_key,'~halloween~',1) where auth_user_id=coalesce(new.user_id,old.user_id);
  return coalesce(new,old);
end $$;
create trigger sync_halloween_cosmetics after update of cosmetics on public.halloween_wallets for each row when(old.cosmetics is distinct from new.cosmetics) execute function public.sync_halloween_avatar();
create trigger sync_halloween_curse after insert or delete on public.halloween_curses for each row execute function public.sync_halloween_avatar();
revoke all on function public.apply_halloween_avatar(),public.sync_halloween_avatar() from public,anon,authenticated;

-- Patch the current training implementation, not a historical replacement.
-- Fail closed if its expected anchor changed. Ordinary riders are unchanged.
do $$ declare v_def text;v_anchor text:='        v_balance := v_progress.balance_milli + v_training_milli - v_decline_milli;';begin
  select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) into v_def;
  if position(v_anchor in v_def)=0 then raise exception 'Training anchor changed: Halloween longevity cannot be enabled safely.';end if;
  v_def:=replace(v_def,v_anchor,$hook$
        if exists(select 1 from public.halloween_rider_effects effect
          where effect.rider_id=v_rider.id and effect.item_id='immortality-pact'
            and ((v_day.calendar_date::timestamp+time '08:00') at time zone 'Europe/Paris')<effect.protection_expires_at
            and ((v_day.calendar_date::timestamp+time '08:00') at time zone 'Europe/Paris')>=effect.used_at) then
          v_decline_milli:=0;
        end if;
$hook$||v_anchor);
  execute v_def;
end $$;
notify pgrst,'reload schema';
commit;
