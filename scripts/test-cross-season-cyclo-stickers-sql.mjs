// Local PostgreSQL/WASM only. Reuse the existing isolated schema bootstrap;
// never load environment files, credentials, Supabase clients or network data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixtureUrl = new URL("./test-persistent-cyclo-stickers-sql.mjs", import.meta.url);
const fixture = await readFile(fixtureUrl, "utf8");
const boundary = "  eq(await scalar('select count(*)::int from cyclo_stickers_editions')";
assert.equal(fixture.split(boundary).length, 2, "The reviewed local schema bootstrap changed");
const rejectBoundary="const rejects=async(task,pattern,label)=>{await assert.rejects(task,pattern,label);checks++;};";
assert.equal(fixture.split(rejectBoundary).length,2,"The fixture error helper changed");
const bootstrap = fixture.slice(0, fixture.indexOf(boundary)).replaceAll("import.meta.url", JSON.stringify(fixtureUrl.href))
  .replace(rejectBoundary,"const rejects=async(task,pattern,label)=>{if(globalThis.__crossTestTx)await db.exec('savepoint expected_failure');try{await assert.rejects(task,pattern,label);checks++;}finally{if(globalThis.__crossTestTx)await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}};");
const exercise = String.raw`
  await db.exec(await read('20261114213000_notify_cyclo_stickers_trade_recipients'));
  await db.exec(await read('20261114220000_allow_concurrent_cyclo_stickers_offers'));
  await db.exec(
    "create function public.get_current_game_header_indicators_v3() returns table(current_sporting_director_id uuid,mailbox_unread_count int,direct_message_unread_count int,has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text) language sql stable as $$select id,0,0,false,false,'player'::text from public.sporting_directors where auth_user_id=auth.uid()$$;"+
    "create function public.get_current_game_header_indicators_v4() returns table(current_sporting_director_id uuid,mailbox_unread_count int,direct_message_unread_count int,has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean) language sql stable as $$select *,false from public.get_current_game_header_indicators_v3()$$;"+
    "create function public.get_current_game_header_indicators_v5() returns table(current_sporting_director_id uuid,mailbox_unread_count int,direct_message_unread_count int,has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean,collector_album_has_unopened_boosters boolean) language sql stable as $$select *,false from public.get_current_game_header_indicators_v4()$$;"+
    "create function public.get_current_game_header_indicators_v6() returns table(current_sporting_director_id uuid,mailbox_unread_count int,direct_message_unread_count int,has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean,collector_album_has_unopened_boosters boolean,has_unread_global_chat_quiz boolean,global_chat_quiz_unread_until timestamptz) language sql stable as $$select *,false,null::timestamptz from public.get_current_game_header_indicators_v5()$$;"
  );
  await db.exec(await read('20261114223000_show_pending_sticker_trades_in_header'));
  for(const [year,status] of [[4,'completed'],[5,'completed'],[6,'active'],[7,'planned']]) await db.query('insert into seasons values($1,$2,$3,1)',[id('s'+year),year,status]);
  for(const key of ['a','b','c','d','inactive']) await db.query('insert into sporting_directors(id,auth_user_id,status,display_name) values($1,$2,$3,$4)',[id(key),id('account-'+key),key==='inactive'?'inactive':'active','Synthetic '+key]);
  await service();await install({enabled:true,publicApproved:true});await admin();
  await seedCard('c',3,3,true);await seedCard('b',9,4,true);await seedCard('b',12,1,false);
  await as('c');const legacyBefore=await propose('pre-migration-legacy',[3],12);await admin();
  const beforeMigration={editions:await scalar('select count(*)::int from cyclo_stickers_editions'),inventory:await scalar('select sum(quantity)::int from cyclo_stickers_card_inventory'),rewards:await scalar('select count(*)::int from reward_events')};
  const legacyResponseBefore=await scalar("select pg_get_functiondef('public.respond_current_cyclo_stickers_trade(text,uuid,text,integer[])'::regprocedure)");
  await db.exec(await read('20261127150000_cross_season_cyclo_stickers_trades'));
  eq({editions:await scalar('select count(*)::int from cyclo_stickers_editions'),inventory:await scalar('select sum(quantity)::int from cyclo_stickers_card_inventory'),rewards:await scalar('select count(*)::int from reward_events')},beforeMigration,'migration changes no catalogue, sticker stock or rewards');
  eq(await scalar('select count(*)::int from cyclo_stickers_cross_trade_offers'),0,'migration creates no demonstration offers');
  eq(await scalar("select pg_get_functiondef('public.respond_current_cyclo_stickers_trade(text,uuid,text,integer[])'::regprocedure)"),legacyResponseBefore,'original legacy response function is preserved byte for byte');
  eq(await scalar('select reserved from cyclo_stickers_card_inventory where edition_id=$1 and sporting_director_id=$2 and card_number=3',[edition,id('c')]),1,'legacy pending reservation is unchanged');

  const next='cyclo-stickers-s6-s5-final-v1',future='cyclo-stickers-s7-s6-final-v1';
  for(const [editionId,source,collection,published] of [[next,5,6,true],[future,6,7,false]]){
    const futureSnapshot={...snapshot,edition:editionId,collectionSeason:collection,sourceSeason:source,ratingsFrozenFromSeason:source,presentationSeason:source,launchSeason:collection,sourceSeasonId:id('s'+source)};
    await db.query('insert into cyclo_stickers_editions(edition_id,source_season_id,collection_season_id,snapshot_sha256,snapshot,configuration) values($1,$2,$3,$4,$5,$6)',[editionId,id('s'+source),id('s'+collection),createHash('sha256').update(JSON.stringify(futureSnapshot)).digest('hex'),futureSnapshot,{...(await scalar('select private.cyclo_stickers_default_configuration()')),enabled:published,publicApproved:published}]);
    await db.query('insert into cyclo_stickers_cards(edition_id,card_number,card_id,rarity,profile_key,kind) select $1,card_number,card_id,rarity,profile_key,kind from cyclo_stickers_cards where edition_id=$2',[editionId,edition]);
  }
  const ref=(e,n)=>({editionId:e,cardNumber:n});
  const nextSeed=(owner,e,n,q,pasted=false)=>db.query('insert into cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity,pasted) values($1,$2,$3,$4,$5) on conflict(edition_id,sporting_director_id,card_number) do update set quantity=excluded.quantity,pasted=excluded.pasted',[e,id(owner),n,q,pasted]);
  const desk=()=>rpc('get_current_cyclo_stickers_trade_inventory');
  const library=()=>rpc('get_current_cyclo_stickers_library');
  const give=(key,to,g,r,view=edition,expected='a')=>rpc('propose_cyclo_stickers_cross_season_trade',[view,id(expected),id('cross-'+key),id(to),g,r]);
  const answer=(offer,response,g,r,view=edition,expected='b')=>rpc('respond_cyclo_stickers_cross_season_trade',[view,id(expected),offer,response,g,r]);
  const search=(g,w=[],query='',limit=20)=>rpc('search_cyclo_stickers_cross_season_matches',[g,w,query,limit]);
  const stock=(e,owner,n)=>rows('select quantity,reserved,pasted from cyclo_stickers_card_inventory where edition_id=$1 and sporting_director_id=$2 and card_number=$3',[e,id(owner),n]).then(r=>r[0]??{quantity:0,reserved:0,pasted:false});
  const scenario=async(label,test)=>{await admin();await db.exec('begin');globalThis.__crossTestTx=true;try{await test();}finally{globalThis.__crossTestTx=false;await db.exec('rollback');await admin();}console.log('PASS '+label);};
  const base=async()=>{await nextSeed('a',edition,1,3,true);await nextSeed('b',next,1,3,true);};

  await as('a');
  const shelves=await library();
  eq(shelves.map(e=>e.sourceSeason),[5,4],'only released, completed source collections are listed by source season');
  eq(shelves.map(e=>e.totalCards),[69,69],'library reports actual catalogue size, not a hardcoded future total');
  eq(shelves.every(e=>e.pastedCount===0&&e.ownedCount===0&&e.completionPercent===0),true,'library is scoped to the authenticated owner');
  eq(shelves.some(e=>'snapshot' in e||'cards' in e),false,'bookshelf does not download all snapshots');
  eq((await rpc('get_cyclo_stickers_catalogue',[next])).editionId,next,'exact-edition catalogue selection supports the next released album');
  eq(await rpc('get_cyclo_stickers_catalogue',[future]),null,'unpublished future catalogue is not exposed');
  await admin();eq(await scalar('select count(*)::int from cyclo_stickers_collections where sporting_director_id=$1',[id('a')]),0,'library/catalogue reads create no player collection');
  await db.exec('reset role;set role anon');await rejects(()=>library(),/permission denied/,'anonymous access is denied');
  await as('inactive');await rejects(()=>library(),/directeur actif/,'inactive director cannot read collections');
  await as('a');await rejects(()=>rows('select * from cyclo_stickers_cross_trade_offers'),/permission denied/,'offers table has no direct authenticated read grant');

  await scenario('real cross-season exchange with overlapping sticker numbers and idempotent receipts',async()=>{
    await base();await as('a');
    const candidate=(await search([ref(edition,1)],[ref(next,1)]))[0];
    eq(candidate.directorId,id('b'),'finder matches missing S4#1 against spare S5#1');
    eq(candidate.availableCards,[{...ref(next,1),sourceSeason:5,quantity:2}],'candidate surplus is assigned to its real season');
    eq(candidate.wantedOfferCards,[{...ref(edition,1),sourceSeason:4}],'candidate missing offer card has its own season');
    const offered=await give('same-number','b',[ref(edition,1)],[ref(next,1)]);
    eq(offered.state.edition.id,edition,'mutation state belongs to the page being viewed');
    eq(offered.tradeState.owned.find(c=>c.editionId===edition&&c.cardNumber===1).reserved,1,'reservation appears in global stock');
    eq((await state()).owned.find(c=>c.cardNumber===1).reserved,1,'legacy album state sees cross-season reservation');
    eq((await give('same-number','b',[ref(edition,1)],[ref(next,1)])).offerId,offered.offerId,'lost proposal response is safely replayed');
    await rejects(()=>give('same-number','b',[ref(edition,1)],[ref(next,2)]),/Identifiant/,'request ID cannot authorize another sticker');
    await rejects(()=>respond(offered.offerId,'accept'),/autorisée/,'old client cannot accept an invisible cross-season offer');
    await as('b');
    eq((await scalar('select row_to_json(i) from public.get_current_game_header_indicators_v7() i')).collector_album_pending_trade_count,2,'header badge includes legacy and new pending offers');
    const receipt=await answer(offered.offerId,'accept',[ref(edition,1)],[ref(next,1)],next);
    eq(receipt.state.edition.id,next,'receipt preserves the recipient current-view edition');
    eq(receipt.receivedItems,[{...ref(edition,1),sourceSeason:4}],'receipt identifies received S4 sticker independently of S5 view');
    eq(receipt.tradeState.incomingOffers.length,1,'only the preexisting legacy offer remains');
    eq(receipt.tradeState.editions.find(e=>e.editionId===edition).pastedCount,1,'receiving a loose historical card does not increase the preexisting pasted count');
    await admin();
    eq(await stock(edition,'a',1),{quantity:2,reserved:0,pasted:true},'giver keeps pasted S4 copy');
    eq(await stock(edition,'b',1),{quantity:1,reserved:0,pasted:false},'recipient receives exact S4 copy');
    eq(await stock(next,'b',1),{quantity:2,reserved:0,pasted:true},'recipient keeps pasted S5 copy');
    eq(await stock(next,'a',1),{quantity:1,reserved:0,pasted:false},'sender receives S5 despite same card number');
    eq(await scalar('select count(*)::int from cyclo_stickers_collections where sporting_director_id=any($1) and accepted_trade_count=1',[[id('a'),id('b')]]),4,'one accepted trade credited once per distinct participant/collection');
    const quantities=await rows('select edition_id,quantity,reserved,pasted from cyclo_stickers_card_inventory order by edition_id,sporting_director_id,card_number');
    await as('a');eq((await give('same-number','b',[ref(edition,1)],[ref(next,1)])).status,'accepted','proposal retry after acceptance reports its actual final status');
    await as('b');await answer(offered.offerId,'accept',[ref(edition,1)],[ref(next,1)],next);await admin();
    eq(await rows('select edition_id,quantity,reserved,pasted from cyclo_stickers_card_inventory order by edition_id,sporting_director_id,card_number'),quantities,'accept replay never transfers twice');
    eq(await scalar('select max(accepted_trade_count) from cyclo_stickers_collections'),1,'accept replay never increments achievements twice');
    eq(await scalar('select count(*)::int from sporting_director_messages where source_reference=$1',['cyclo-stickers:trade:'+offered.offerId+':proposed']),1,'proposal notification is created once');
    eq((await rows('select action_href from sporting_director_messages where source_reference=$1',['cyclo-stickers:trade:'+offered.offerId+':proposed']))[0].action_href,'/jeu/album?edition='+edition+'&onglet=echanges&vue=recues','notification has explicit valid edition and global inbox route');
    eq(await scalar('select count(*)::int from reward_events'),0,'trading does not auto-claim or invent rewards');
    await db.query("update cyclo_stickers_editions set configuration=jsonb_set(configuration,'{enabled}','false') where edition_id=$1",[next]);
    await as('a');eq((await desk()).history.some(o=>o.id===offered.offerId),false,'withdrawn edition history is not exposed by global desk');
    eq((await desk()).owned.some(c=>c.editionId===next),false,'withdrawn collection stock remains hidden');
    eq((await answer(offered.offerId,'cancel',null,null,edition,'a')).receivedItems,[],'an already accepted receipt does not re-expose a subsequently withdrawn collection');
  });

  await scenario('strict consent, actor identity and publication gates',async()=>{
    await base();await as('a');
    await rejects(()=>give('wrong-actor','b',[ref(edition,1)],[ref(next,1)],edition,'c'),/session a changé/,'switched account cannot spend a different page-owner stock');
    await rejects(()=>give('future','b',[ref(edition,1)],[ref(future,1)]),/pas encore disponible/,'future unpublished card is rejected');
    await rejects(()=>give('self','a',[ref(edition,1)],[ref(next,1)]),/invalide/,'self trade is rejected');
    await rejects(()=>give('wash','b',[ref(edition,1)],[ref(edition,1)]),/invalide/,'same full identity cannot be exchanged for itself');
    for(const malformed of [[],Array(4).fill(ref(edition,1)),[{editionId:edition,cardNumber:'1'}],[ref(edition,-1)],[null]]) await rejects(()=>give('bad-'+JSON.stringify(malformed),'b',malformed,[ref(next,1)]),/invalides/,'malformed refs fail before mutation');
    const offered=await give('consent','b',[ref(edition,1)],[ref(next,1)]);
    await as('d');await rejects(()=>answer(offered.offerId,'accept',[ref(edition,1)],[ref(next,1)],edition,'d'),/autorisée/,'unrelated director cannot accept');
    await as('b');
    await rejects(()=>answer(offered.offerId,'accept',[ref(edition,1)],[ref(edition,1)]),/Actualisez/,'same number from wrong edition fails consent');
    await rejects(()=>answer(offered.offerId,'accept',null,[ref(next,1)]),/invalides/,'missing visible offered side fails consent');
    await rejects(()=>answer(offered.offerId,'accept',[ref(edition,1)],[ref(next,1)],edition,'a'),/session a changé/,'actor check is repeated server-side for response');
    await admin();await db.query("update cyclo_stickers_editions set configuration=jsonb_set(configuration,'{enabled}','false') where edition_id=$1",[next]);
    await as('b');eq((await desk()).incomingOffers.some(o=>o.id===offered.offerId),false,'pending offer with withdrawn edition is not exposed');
    eq((await scalar('select row_to_json(i) from get_current_game_header_indicators_v7() i')).collector_album_pending_trade_count,1,'header omits withdrawn cross-season offer');
    await rejects(()=>answer(offered.offerId,'accept',[ref(edition,1)],[ref(next,1)]),/pas encore disponible/,'approval is rechecked at acceptance');
    eq((await answer(offered.offerId,'decline',null,null)).status,'declined','disabled-edition offer can still be declined from an available album');
    await admin();eq((await stock(edition,'a',1)).reserved,0,'decline after disable releases exact offered stock');
  });

  await scenario('manual search supports intentional swaps of already-owned cards',async()=>{
    await base();await nextSeed('d',edition,1,1,false);await nextSeed('d',next,1,3,true);await as('a');
    eq((await search([ref(edition,1)],[ref(next,1)])).map(c=>c.directorId),[id('b')],'automatic search keeps reciprocal missing-card matching');
    const manual=await search([ref(edition,1)],[ref(next,1)],'Synthetic d');
    eq(manual.map(c=>c.directorId),[id('d')],'named collector can already own offered card');
    eq(manual[0].wantedOfferCards,[],'manual candidate does not invent a missing offered card');
  });

  await scenario('first copies, repeated quantities and both client generations share reservations',async()=>{
    await nextSeed('a',edition,1,2,false);await nextSeed('b',next,1,2,false);await seedCard('b',9,4,true);await as('a');
    await rejects(()=>give('too-many','b',[ref(edition,1),ref(edition,1)],[ref(next,1)]),/indisponibles/,'first loose copy is retained');
    const offered=await give('only-spare','b',[ref(edition,1)],[ref(next,1)]);
    await rejects(()=>give('again','b',[ref(edition,1)],[ref(next,1)]),/indisponibles/,'live reservation cannot be proposed twice');
    const oldConcurrent=await propose('old-again',[1],9);
    await as('b');await rejects(()=>answer(offered.offerId,'accept',[ref(edition,1)],[ref(next,1)]),/réservées/,'new acceptance never spends the last copy even if an older client reserves a loose first copy');
    await rpc('respond_current_cyclo_stickers_trade',[edition,oldConcurrent.offerId,'decline']);
    await rejects(()=>give('receiver-spare-away','a',[ref(next,1)],[ref(edition,1)],next,'b'),/disponible/,'receiver cannot request giver reserved copy');
    await as('a');eq((await answer(offered.offerId,'cancel',null,null,edition,'a')).status,'cancelled','sender can cancel new offer');
    await admin();eq((await stock(edition,'a',1)).reserved,0,'cancel releases copy');
    await nextSeed('a',edition,1,4,true);await nextSeed('b',next,1,4,true);await as('a');
    const multi=await give('two-copies','b',[ref(edition,1),ref(edition,1)],[ref(next,1),ref(next,1)]);
    await as('b');await answer(multi.offerId,'accept',[ref(edition,1),ref(edition,1)],[ref(next,1),ref(next,1)]);
    await admin();eq((await stock(edition,'a',1)).quantity,2,'two actual copies debited from correct album');eq((await stock(next,'a',1)).quantity,2,'two copies received into other album');
  });

  await scenario('expiry releases every offered edition even through old client paths',async()=>{
    await base();await nextSeed('a',next,2,3,true);await as('a');
    const offered=await give('expires','b',[ref(edition,1),ref(next,2)],[ref(next,1)]);
    await admin();await db.query("update cyclo_stickers_cross_trade_offers set created_at=now()-interval '3 days',expires_at=now()-interval '1 day' where id=$1",[offered.offerId]);
    await as('a');eq((await desk()).owned.filter(i=>i.cardNumber===1||i.cardNumber===2).every(i=>i.reserved===0),true,'read-only view excludes expired reservations');
    await admin();eq((await stock(next,'a',2)).reserved,1,'read-only view never mutates inventory');
    await as('a');await propose('old-cleans-expiry',[1],9);await admin();
    eq((await stock(next,'a',2)).reserved,0,'old mutation expiry hook releases offered second-season reservation');
    eq((await stock(edition,'a',1)).reserved,1,'only the new legacy offer reservation remains in first season');
    eq(await scalar('select status from cyclo_stickers_cross_trade_offers where id=$1',[offered.offerId]),'expired','expired offer closes once');
    await as('b');eq((await answer(offered.offerId,'accept',[ref(edition,1),ref(next,2)],[ref(next,1)])).status,'expired','late acceptance cannot transfer expired offer');
    await admin();eq((await stock(next,'a',2)).reserved,0,'expiry replay never releases another copy');
  });

  await scenario('older search excludes the same cross-season reservations as current search',async()=>{
    await nextSeed('a',edition,3,2,true);await nextSeed('a',next,2,2,true);await nextSeed('b',edition,9,2,true);
    await as('b');const offered=await give('old-search','a',[ref(edition,9)],[ref(next,2)],edition,'b');
    await as('a');eq(await matches([3],[9],'Synthetic b'),[],'legacy finder does not suggest new-table reserved duplicate');
    await as('b');await answer(offered.offerId,'cancel',null,null,edition,'b');
    await as('a');eq((await matches([3],[9],'Synthetic b'))[0].availableCards,[{cardNumber:9,quantity:1}],'legacy finder regains stock after cross-season cancellation');
  });

  await scenario('legacy offers stay actionable with complete consent and selected-view state',async()=>{
    await as('b');const inbox=await desk();eq(inbox.incomingOffers[0].id,legacyBefore.offerId,'pre-migration offer remains in merged inbox');
    eq(inbox.incomingOffers[0].legacy,true,'legacy offers carry explicit format');
    await rejects(()=>answer(legacyBefore.offerId,'accept',[ref(next,3)],[ref(edition,12)],next),/Actualisez/,'legacy offer cannot be reinterpreted as new-season card');
    const receipt=await answer(legacyBefore.offerId,'accept',[ref(edition,3)],[ref(edition,12)],next);
    eq(receipt.status,'accepted','old offer is accepted transactionally');eq(receipt.state.edition.id,next,'legacy offer does not replace currently viewed collection');
    await admin();eq((await stock(edition,'b',3)).quantity,1,'actual historical offer card transferred');
    eq((await stock(edition,'b',12)).quantity,0,'pre-migration request for a final loose copy preserves its original acceptance rules');
    eq(await scalar('select count(*)::int from cyclo_stickers_collections where edition_id=$1 and accepted_trade_count>0',[next]),0,'unrelated view collection gets no trade achievement credit');
  });

  await scenario('quotas include legacy and new proposals and headers work without old album',async()=>{
    await base();await seedCard('c',3,4,true);await nextSeed('b',next,2,4,true);
    await db.exec("update cyclo_stickers_editions set configuration=jsonb_set(configuration,'{maxOffersPerDay}','2')");
    await as('c');await give('quota','b',[ref(edition,3)],[ref(next,2)],edition,'c');
    await rejects(()=>give('quota-next','b',[ref(edition,3)],[ref(next,2)],edition,'c'),/limite/,'new quota includes preexisting old proposal');
    await rejects(()=>propose('quota-old',[3],9),/limite/,'old quota includes new proposal');
    await admin();await db.query("update cyclo_stickers_editions set configuration=jsonb_set(configuration,'{enabled}','false') where edition_id=$1",[edition]);
    await as('a');eq((await library()).map(e=>e.editionId),[next],'new collection remains navigable when old album disabled');
    eq((await scalar('select row_to_json(i) from public.get_current_game_header_indicators_v4() i')).collector_album_available,true,'header availability no longer requires S4 edition');
    await admin();await nextSeed('a',next,3,2,true);await as('a');
    await give('only-next','b',[ref(next,3)],[ref(next,2)],next);
    await as('b');eq((await scalar('select row_to_json(i) from public.get_current_game_header_indicators_v7() i')).collector_album_pending_trade_count,1,'new-season-only pending offer remains visible when S4 is disabled');
    await admin();await db.query('insert into cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquisition_source,source_reference,awarded_on) values($1,$2,$3,$4,current_date)',[id('a'),id('s6'),'daily_login','new-season-test']);
    await as('a');eq((await scalar('select row_to_json(i) from public.get_current_game_header_indicators_v5() i')).collector_album_has_unopened_boosters,true,'header finds an unopened new-season booster');
  });

  await scenario('global history is bounded and ordered across both offer formats',async()=>{
    const expected=[];
    for(let index=0;index<32;index++){
      const offerId=id('history-'+index);expected.push(offerId);
      if(index%2===0) await db.query("insert into cyclo_stickers_trade_offers(id,edition_id,from_director_id,to_director_id,request_id,give_cards,receive_card,receive_cards,status,created_at,expires_at) values($1,$2,$3,$4,$1,array[1],9,array[9],'declined',now()-make_interval(mins=>$5),now()+interval '1 day')",[offerId,edition,id('a'),id('b'),index+1]);
      else await db.query("insert into cyclo_stickers_cross_trade_offers(id,from_director_id,to_director_id,request_id,give_items,receive_items,status,created_at,expires_at) values($1,$2,$3,$1,$4,$5,'declined',now()-make_interval(mins=>$6),now()+interval '1 day')",[offerId,id('a'),id('b'),[ref(edition,1)],[ref(next,1)],index+1]);
    }
    await as('a');const history=(await desk()).history;
    eq(history.map(o=>o.id),expected.slice(0,20),'only the latest twenty mixed-format exchanges are returned in stable chronological order');
    eq(history.filter(o=>o.legacy).length,10,'legacy and current formats share the same history page');
  });

  await scenario('an old unopened pack remains attached to its original album',async()=>{
    await db.query('insert into cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquisition_source,source_reference,awarded_on) values($1,$2,$3,$4,current_date-28)',[id('a'),id('s5'),'daily_login','old-season-only']);
    await as('a');const books=await library();
    eq(books.find(e=>e.editionId===edition).unopenedBoosterCount,1,'S4 booster remains discoverable on the S4 spine');
    eq(books.find(e=>e.editionId===next).unopenedBoosterCount,0,'newer S5 album cannot absorb the old unopened pack');
    eq((await scalar('select row_to_json(i) from public.get_current_game_header_indicators_v5() i')).collector_album_has_unopened_boosters,true,'shared header still advertises the old unclaimed pack');
  });

  await admin();
  const proposer=await scalar("select pg_get_functiondef('public.propose_current_cyclo_stickers_trade(text,uuid,uuid,integer[],integer[])'::regprocedure)");
  eq(proposer.indexOf('lock_cyclo_stickers_offer_quotas')<proposer.indexOf('lock_cyclo_stickers_collections'),true,'old quota lock precedes collection locks');
  const lockHelper=await scalar("select pg_get_functiondef('private.lock_cyclo_stickers_cross_collections(jsonb,uuid[],boolean)'::regprocedure)");
  eq(lockHelper.includes('order by 1,2'),true,'all edition/director pairs have stable lock order');
  eq(lockHelper.includes('for update nowait')&&lockHelper.includes('exception when lock_not_available then return false'),true,'old expiry can skip busy cross-edition locks without blocking cycle');
  eq(await scalar('select private.lock_cyclo_stickers_cross_collections($1,$2,true)',[[ref(next,1)],[id('d')]]),false,'nonblocking expiry skips missing collection without speculative insert');
  eq(await scalar("select has_function_privilege('authenticated','private.lock_cyclo_stickers_cross_collections(jsonb,uuid[],boolean)','EXECUTE')"),false,'player cannot call private locking/expiry helpers');
  console.log(JSON.stringify({isolatedPostgresChecks:checks,crossSeasonIdentity:true,legacyPendingPreserved:true,productionAccess:false,syntheticFixturesOnly:true}));
}finally{await db.close();}
`;

try {
  await import("data:text/javascript;base64," + Buffer.from(bootstrap + exercise).toString("base64"));
} catch (error) {
  const position=Number(error.position??0);
  console.error(JSON.stringify({message:error.message,actual:error.actual,expected:error.expected,
    detail:error.detail,position,query:position&&error.query?error.query.slice(Math.max(0,position-130),position+130):error.query?.slice(0,500)},null,2));
  process.exitCode=1;
}
