begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

-- Catalogue only: never rewrite past claims, balances or reward events.
create table private.objective_catalog_audit_20261016 (
 objective_key text primary key,before_definition jsonb not null,after_definition jsonb,
 recorded_at timestamptz not null default now()
);
revoke all on private.objective_catalog_audit_20261016 from public,anon,authenticated;
grant select on private.objective_catalog_audit_20261016 to service_role;
insert into private.objective_catalog_audit_20261016(objective_key,before_definition)
 select objective_key,to_jsonb(d) from public.game_objective_definitions d;

-- Raise introductory rewards modestly; preserve every item/cosmetic reward.
update public.game_objective_definitions set
 reward_cash=greatest(reward_cash,3000),reward_experience=greatest(reward_experience,20),updated_at=now()
 where is_active and objective_key not like 'journey\_%' escape '\';
with rewards(key,cash,xp,rep) as(values
 ('victory_1',10000,40,1),('victory_5',25000,100,3),('victory_10',50000,180,5),
 ('first_registration',5000,25,1),('equipment_1',4000,20,0),
 ('youth_signing_10',65000,200,6),('youth_promotion_10',200000,550,18),
 ('development_calendar_complete',35000,130,4),
 ('social_interview_1',5000,25,0),('social_interview_5',15000,60,1),
 ('social_interview_10',30000,100,2),('social_interview_100',120000,350,8),
 ('social_gazette_comment_1',3000,20,0),('social_gazette_comment_10',10000,40,0),
 ('social_gazette_comment_100',50000,150,3),('social_chat_messages_25',10000,40,0),
 ('social_chat_previews_5',10000,40,0),('social_gazette_likes_10',5000,25,0),
 ('journey_natural_progress_bronze',10000,75,1),('journey_natural_progress_silver',35000,160,3),('journey_natural_progress_gold',90000,350,8),
 ('journey_tailored_setup_bronze',10000,75,1),('journey_tailored_setup_silver',30000,160,3),('journey_tailored_setup_gold',80000,350,7),
 ('journey_panache_bronze',15000,90,2),('journey_panache_silver',50000,200,5),('journey_panache_gold',150000,450,12),
 ('journey_world_traveler_bronze',15000,90,1),('journey_world_traveler_silver',45000,200,4),('journey_world_traveler_gold',100000,400,9),
 ('journey_shopkeeper_bronze',10000,75,1),('journey_shopkeeper_silver',30000,160,3),('journey_shopkeeper_gold',75000,350,7),
 ('journey_mentor_bronze',20000,100,2),('journey_mentor_silver',50000,220,5),('journey_mentor_gold',125000,450,10),
 ('journey_research_podium_bronze',25000,120,3),('journey_research_podium_silver',75000,250,6),('journey_research_podium_gold',250000,600,18),
 ('journey_homegrown_bronze',30000,120,3),('journey_homegrown_silver',100000,300,8),('journey_homegrown_gold',350000,750,22),
 ('journey_three_tours_bronze',100000,300,10),('journey_three_tours_silver',250000,600,20),('journey_three_tours_gold',600000,1200,35),
 ('journey_family_photo_gold',75000,300,8),('journey_upset_gold',40000,250,6)
)
update public.game_objective_definitions d set reward_cash=r.cash,reward_experience=r.xp,reward_reputation=r.rep,updated_at=now()
 from rewards r where d.objective_key=r.key;

-- Correct every decreasing cash/XP/reputation ladder sharing the same metric.
with ladders as(select objective_key,
 max(reward_cash) over(partition by metric_key order by target_value range between unbounded preceding and current row) cash,
 max(reward_experience) over(partition by metric_key order by target_value range between unbounded preceding and current row) xp,
 max(reward_reputation) over(partition by metric_key order by target_value range between unbounded preceding and current row) rep
 from public.game_objective_definitions where is_active)
update public.game_objective_definitions d set reward_cash=l.cash,reward_experience=l.xp,reward_reputation=l.rep
 from ladders l where d.objective_key=l.objective_key;

-- Ordinary independent objectives, not a second career-journey subsystem.
update public.game_objective_definitions set title=title||' · '||case
 when metric_key='future_natural_progress' then target_value||' point(s)'
 when metric_key='future_world_traveler' then target_value||' pays'
 when metric_key='future_shopkeeper' then target_value||' jours'
 when metric_key='future_mentor' then 'niveau '||target_value
 when metric_key in('future_homegrown','future_research_podium') then
   case target_value when 1 then 'Podium' when 2 then 'Victoire' else 'Exploit majeur' end
 when metric_key='future_three_tours' then target_value||' Tour(s) différent(s)'
 else target_value||' réussite(s)' end
 where objective_key like 'journey\_%' escape '\' and metric_key not in('future_family_photo','future_upset');

-- Separate epoch: never reset the progress accumulated since 15 October.
create table private.social_achievement_epoch(singleton boolean primary key default true check(singleton),activated_at timestamptz not null default clock_timestamp());
insert into private.social_achievement_epoch(singleton) values(true);
create table private.social_achievement_receipts(
 sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
 metric_key text not null,subject_key text not null,created_at timestamptz not null default now(),
 primary key(sporting_director_id,metric_key,subject_key)
);
revoke all on private.social_achievement_epoch,private.social_achievement_receipts from public,anon,authenticated;
grant select on private.social_achievement_epoch,private.social_achievement_receipts to service_role;

create function private.record_social_achievement(p_director uuid,p_metric text,p_subject text,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_start timestamptz;
begin
 select activated_at into v_start from private.social_achievement_epoch;
 if p_director is null or p_at is null or p_at<v_start or p_at>clock_timestamp()+interval '5 minutes'
  or p_metric not in('community_days','private_contacts','transfer_sent','transfer_received','interview_support_given',
    'interview_support_received','gazette_days','game_variety','first_deal','interview_regular') then return; end if;
 if not exists(select 1 from public.sporting_directors d where d.id=p_director and d.status='active' and d.auth_user_id is not null) then return; end if;
 insert into private.social_achievement_receipts(sporting_director_id,metric_key,subject_key)
 values(p_director,p_metric,p_subject) on conflict do nothing;
 if not found then return; end if;
 insert into public.career_achievement_progress(sporting_director_id,metric_key,subject_key,value,peak)
 values(p_director,'future_social_'||p_metric,'total',1,1)
 on conflict(sporting_director_id,metric_key,subject_key) do update set
 value=career_achievement_progress.value+1,peak=career_achievement_progress.peak+1,updated_at=now();
 delete from public.game_objective_summary_cache where sporting_director_id=p_director;
end;
$$;
revoke all on function private.record_social_achievement(uuid,text,text,timestamptz) from public,anon,authenticated;

create function private.capture_social_achievement() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_start timestamptz;v_other uuid;v_buyer uuid;v_seller uuid;
begin
 select activated_at into v_start from private.social_achievement_epoch;
 if tg_table_name='global_chat_messages' then
  if length(btrim(new.message))>=20 and new.created_at>=v_start then
   perform private.record_social_achievement(new.sporting_director_id,'community_days',(new.created_at at time zone 'Europe/Paris')::date::text,new.created_at);
  end if;
 elsif tg_table_name='cyclogazette_comments' then
  if length(btrim(new.message))>=30 and new.created_at>=v_start then
   perform private.record_social_achievement(new.sporting_director_id,'gazette_days',(new.created_at at time zone 'Europe/Paris')::date::text,new.created_at);
  end if;
 elsif tg_table_name='direct_messages' then
  if new.message_type='user' and length(btrim(new.body))>=5 and new.sender_id<>new.recipient_id and new.created_at>=v_start
   and exists(select 1 from public.direct_messages m where m.conversation_id=new.conversation_id
    and m.sender_id=new.recipient_id and m.recipient_id=new.sender_id and m.created_at>=v_start
    and m.message_type='user' and length(btrim(m.body))>=5 limit 1) then
   perform private.record_social_achievement(new.sender_id,'private_contacts',new.recipient_id::text,new.created_at);
   perform private.record_social_achievement(new.recipient_id,'private_contacts',new.sender_id::text,new.created_at);
  end if;
 elsif tg_table_name='direct_transfer_offers' then
  if new.created_at<v_start or new.offered_amount<500 or new.buyer_team_id=new.seller_team_id then return new; end if;
  select sporting_director_id into v_buyer from public.team_manager_assignments
   where team_id=new.buyer_team_id and status='active' and role='general_manager' order by created_at desc limit 1;
  select sporting_director_id into v_seller from public.team_manager_assignments
   where team_id=new.seller_team_id and status='active' and role='general_manager' order by created_at desc limit 1;
  if v_buyer is null or v_seller is null or v_buyer=v_seller then return new; end if;
  if tg_op='INSERT' and new.status='pending' then
   perform private.record_social_achievement(v_buyer,'transfer_sent',new.rider_id::text,new.created_at);
   perform private.record_social_achievement(v_seller,'transfer_received',v_buyer::text,new.created_at);
  elsif tg_op='UPDATE' and new.status='accepted' and old.status<>'accepted' then
   perform private.record_social_achievement(v_buyer,'first_deal',new.id::text,new.responded_at);
  end if;
 elsif tg_table_name='post_race_interviews' then
  if new.status='submitted' and new.submitted_at>=v_start and (tg_op='INSERT' or old.status<>'submitted') then
   perform private.record_social_achievement(new.sporting_director_id,'interview_regular',new.id::text,new.submitted_at);
  end if;
 elsif tg_table_name='post_race_interview_answer_reactions' then
  if new.created_at<v_start then return new; end if;
  select sporting_director_id into v_other from public.post_race_interviews where id=new.interview_id and status='submitted';
  if v_other is not null and v_other<>new.sporting_director_id then
   perform private.record_social_achievement(new.sporting_director_id,'interview_support_given',v_other::text,new.created_at);
   perform private.record_social_achievement(v_other,'interview_support_received',new.sporting_director_id::text,new.created_at);
  end if;
 elsif tg_table_name='cyclogazette_game_completions' then
  if new.game_type in('sudoku','crossword') and new.completed_at>=v_start then
   perform private.record_social_achievement(new.sporting_director_id,'game_variety',new.game_type,new.completed_at);
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.capture_social_achievement() from public,anon,authenticated;
create trigger capture_social_achievement after insert on public.global_chat_messages for each row execute function private.capture_social_achievement();
create trigger capture_social_achievement after insert on public.cyclogazette_comments for each row execute function private.capture_social_achievement();
create trigger capture_social_achievement after insert on public.direct_messages for each row execute function private.capture_social_achievement();
create trigger capture_social_achievement after insert or update of status on public.direct_transfer_offers for each row execute function private.capture_social_achievement();
create trigger capture_social_achievement after insert or update of status on public.post_race_interviews for each row execute function private.capture_social_achievement();
create trigger capture_social_achievement after insert on public.post_race_interview_answer_reactions for each row execute function private.capture_social_achievement();
create trigger capture_social_achievement after insert on public.cyclogazette_game_completions for each row execute function private.capture_social_achievement();

with families(code,grp,title,targets,description,cash,xp,rep) as(values
 ('community_days','social','Une voix dans le peloton',array[1,3,7],'Participer au chat général pendant %s jours distincts, avec un message d’au moins 20 caractères. Un seul crédit par jour.',array[5000,12000,25000],array[25,50,100],array[0,0,1]),
 ('private_contacts','social','Le carnet d’adresses',array[1,3,10],'Échanger des MP avec %s autres DS différents. Chaque personne doit avoir envoyé un message personnel d’au moins 5 caractères après activation ; les notifications automatiques ne comptent pas.',array[5000,10000,25000],array[25,50,100],array[0,0,1]),
 ('transfer_sent','transfers','Ouvrir les négociations',array[1,5,20],'Déposer une offre directe valide pour %s coureurs différents. Les relances pour un même coureur ne comptent pas deux fois.',array[5000,15000,40000],array[25,70,160],array[0,1,3]),
 ('transfer_received','transfers','Votre effectif intéresse',array[1,5],'Recevoir une offre directe valide de %s autres DS différents. Un seul crédit par acheteur.',array[5000,20000],array[25,80],array[0,1]),
 ('interview_support_given','social','Encourager les voix du peloton',array[1,5],'Apprécier une réponse d’interview de %s autres DS différents. Un seul crédit par auteur ; retirer puis remettre un émoji ne donne aucun crédit supplémentaire.',array[3000,10000],array[20,50],array[0,0]),
 ('interview_support_received','social','Des réponses qui font réagir',array[1,5],'Recevoir une appréciation sur vos interviews de %s autres DS différents. Les auto-appréciations et répétitions d’une personne ne comptent pas.',array[5000,20000],array[25,80],array[0,1]),
 ('gazette_days','social','Au rendez-vous de la Gazette',array[3,10],'Commenter la Cyclogazette pendant %s jours distincts, avec un commentaire d’au moins 30 caractères. Un seul crédit par jour.',array[10000,30000],array[40,100],array[0,2]),
 ('game_variety','social','La tête et les jambes',array[2],'Terminer %s jeux différents de la Cyclogazette : un sudoku et des mots croisés.',array[10000],array[50],array[1]),
 ('first_deal','transfers','Poignée de main',array[1],'Conclure %s achat par offre directe déposée et acceptée après activation. Une offre simplement envoyée ne suffit pas.',array[15000],array[60],array[1]),
 ('interview_regular','social','Habitué de la zone mixte',array[25,50],'Soumettre %s interviews d’après-course différentes. Modifier une interview déjà publiée ne compte pas de nouveau.',array[50000,85000],array[160,250],array[3,5])
), expanded as(select families.*,step.n,targets[step.n] target,case when step.n=cardinality(targets) then 'gold' when step.n=1 then 'bronze' else 'silver' end tier
 from families cross join lateral generate_subscripts(targets,1) as step(n))
insert into public.game_objective_definitions(objective_key,objective_type,objective_group,title,description,metric_key,target_value,
 reward_cash,reward_experience,reward_reputation,display_order,is_active)
select 'journey_'||code||'_'||tier,'secondary',grp,title||case when cardinality(targets)>1 then ' · '||target else '' end,
 format(description,target)||' Actions réalisées depuis le 16 octobre 2026 uniquement.',
 'future_social_'||code,target,cash[n],xp[n],rep[n],2300+row_number() over(order by code,n),true from expanded;

update private.objective_catalog_audit_20261016 a set after_definition=to_jsonb(d)
 from public.game_objective_definitions d where d.objective_key=a.objective_key;
-- Tiny cache only; no completion calculation or historic-action scan here.
delete from public.game_objective_summary_cache;
notify pgrst,'reload schema';
commit;
