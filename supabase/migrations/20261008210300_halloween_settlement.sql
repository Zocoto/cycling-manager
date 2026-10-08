begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

insert into public.equipment_catalog_items(catalog_key,name,slot_type,supplier_key,supplier_name,description,price,rarity,status,image_path,effect_summary,effect_payload,acquisition_channel)
values('halloween-2026-headless-frame','Monture de l’équipier sans tête','frame','halloween','Halloween',
 'Cadre exclusif du vainqueur de Cycling Hollow 2026, jamais vendu ni tiré au sort.',0,'epic','active',
 '/images/equipment/products/headless-domestique-frame.webp','+3 REC / RES / END / DES · capacités Porteur de bidon et Locomotive ×2 · contribution à la protection +15 %',
 '{"ratingBonuses":{"recovery":3,"resistance":3,"endurance":3,"downhill":3},"specialAbilityMultipliers":{"bottle_carrier":2,"locomotive":2},"leaderProtectionContributionMultiplier":1.15}',
 'event_reward') on conflict(catalog_key) do nothing;

create function public.settle_halloween_event()
returns jsonb language plpgsql security definer set search_path=public,pg_temp set lock_timeout='2s' set statement_timeout='20s' as $$
declare v_edition public.halloween_editions%rowtype;v_day date;v_last date;v_rank integer;v_record record;v_curse record;
  v_team_season uuid;v_equipment uuid;v_days integer:=0;v_item text;v_coins integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('halloween-2026-settlement',0)) then return jsonb_build_object('busy',true); end if;
  select * into strict v_edition from public.halloween_editions where id='halloween-2026' for update;
  if now()<v_edition.starts_at then return jsonb_build_object('closed',true); end if;
  for v_curse in select user_id from public.halloween_curses where edition_id=v_edition.id and expires_at<=now() order by user_id limit 500 loop
    perform public.halloween_release_curse(v_edition.id,v_curse.user_id);
  end loop;
  if not v_edition.enabled then return jsonb_build_object('closed',true); end if;
  v_last:=least(((now()-interval '5 minutes') at time zone 'Europe/Paris')::date-1,(v_edition.ends_at at time zone 'Europe/Paris')::date-1);
  v_day:=coalesce(v_edition.settled_through,(v_edition.starts_at at time zone 'Europe/Paris')::date-1)+1;
  while v_day<=v_last and v_days<31 loop
    v_rank:=0;
    for v_record in select * from (
      select distinct on(user_id) user_id,score,distance,finished_at from public.halloween_runs where edition_id=v_edition.id and day=v_day and status='finished'
      order by user_id,score desc,distance desc,finished_at asc
    ) best order by score desc,distance desc,finished_at asc,user_id limit 3 loop
      v_rank:=v_rank+1;
      perform public.halloween_credit(v_edition.id,v_record.user_id,'podium:'||v_day,case v_rank when 1 then 15 when 2 then 10 else 5 end);
    end loop;
    update public.halloween_editions set settled_through=v_day where id=v_edition.id;
    v_days:=v_days+1;v_day:=v_day+1;
  end loop;
  if now()>=v_edition.ends_at+interval '5 minutes' and v_edition.final_settled_at is null then
    v_rank:=0;
    for v_record in select * from (
      select distinct on(user_id) user_id,score,distance,finished_at from public.halloween_runs where edition_id=v_edition.id and status='finished'
      order by user_id,score desc,distance desc,finished_at asc
    ) best order by score desc,distance desc,finished_at asc,user_id limit 5 loop
      v_rank:=v_rank+1;v_coins:=(array[500,300,200,120,80])[v_rank];
      perform public.halloween_credit(v_edition.id,v_record.user_id,'final:coins',v_coins);
      if v_rank=1 then
        update public.halloween_wallets set inventory=jsonb_set(inventory,'{headless-skin}','1'),obtained=jsonb_set(obtained,'{headless-skin}','1') where edition_id=v_edition.id and user_id=v_record.user_id;
        select ts.id into v_team_season from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id and a.status='active' and a.role='general_manager'
          join public.seasons s on s.status='active' join public.team_seasons ts on ts.season_id=s.id and ts.team_id=a.team_id where d.auth_user_id=v_record.user_id limit 1;
        select id into strict v_equipment from public.equipment_catalog_items where catalog_key='halloween-2026-headless-frame';
        if v_team_season is not null then
          insert into public.team_equipment_inventory(team_season_id,equipment_item_id,quantity,last_purchase_price) values(v_team_season,v_equipment,1,0)
            on conflict(team_season_id,equipment_item_id) do update set quantity=public.team_equipment_inventory.quantity+1,updated_at=now();
        else
          update public.halloween_wallets set inventory=jsonb_set(inventory,'{headless-frame-claim}','1') where edition_id=v_edition.id and user_id=v_record.user_id;
        end if;
      else
        v_item:=(array['mummy-resurrection','full-moon-elixir','lord-vlad','halloween-background'])[v_rank-1];
        perform public.halloween_gift(v_edition.id,v_record.user_id,'final:item',jsonb_build_object('item',v_item));
      end if;
    end loop;
    update public.halloween_editions set final_settled_at=now() where id=v_edition.id;
  end if;
  return jsonb_build_object('daysSettled',v_days,'finalSettled',(select final_settled_at is not null from public.halloween_editions where id=v_edition.id));
end $$;
revoke all on function public.settle_halloween_event() from public,anon,authenticated;
grant execute on function public.settle_halloween_event() to service_role;

create function public.notify_halloween_curse()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.sporting_director_messages(sporting_director_id,message_type,sender_name,subject,preview,body,action_href,action_label,source_reference)
  select id,'system','Le peloton de minuit',case when new.kind='vampire' then 'Le baiser du vampire vous a frappé !' else 'La momie a frappé !' end,
    'Un sort Halloween, limité à 24 h et levable gratuitement.',
    case when new.kind='vampire' then 'Votre prochaine poursuite garde son score complet. Le vampire retient 10 % des roues récoltées, arrondies à la roue inférieure, puis disparaît.' else 'Votre prochain cadeau est emballé dans cinq bandelettes. Déballez-les pour récupérer tout son contenu.' end || ' Vous pouvez lever le sort gratuitement avec le sel anti-malédiction. Expiration automatique après 24 h, au plus tard à la fin des jeux.',
    '/jeu/halloween','Voir mon sort','halloween-curse:'||new.id from public.sporting_directors where auth_user_id=new.user_id
  on conflict(sporting_director_id,source_reference) do nothing;
  return new;
end $$;
revoke all on function public.notify_halloween_curse() from public,anon,authenticated;
create trigger halloween_curse_mail after insert on public.halloween_curses for each row execute function public.notify_halloween_curse();
notify pgrst,'reload schema';
commit;
