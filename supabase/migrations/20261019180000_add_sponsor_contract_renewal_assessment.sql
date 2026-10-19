begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

-- Small trusted catalogue, maintained by sponsors:sync. No player data changes.
create table public.sponsor_renewal_profiles (
  catalog_key text primary key,
  prestige smallint not null check (prestige between 1 and 5),
  minimum_reputation integer not null check (minimum_reputation >= 0)
);
alter table public.sponsor_renewal_profiles enable row level security;
revoke all on public.sponsor_renewal_profiles from public, anon, authenticated;
grant all on public.sponsor_renewal_profiles to service_role;
create policy sponsor_renewal_profiles_service on public.sponsor_renewal_profiles
  for all to service_role using (true) with check (true);

insert into public.sponsor_renewal_profiles (catalog_key, prestige, minimum_reputation) values
('khotso-lichelete', 2, 30),
('kopi-selat', 3, 75),
('kakao-bilong-sepik', 2, 30),
('rheinwerk-messtechnik', 4, 300),
('musel-waibau', 3, 75),
('jadranska-solana', 3, 75),
('lilangeni-ingilazi', 2, 30),
('bishkek-emal', 2, 50),
('ateliers-rail-thies', 3, 75),
('cafe-des-plateaux', 2, 30),
('montecristi-toquilla-house', 3, 75),
('quito-cable-transit', 2, 30),
('kigali-saferide', 2, 30),
('nyanza-imigongo-works', 3, 75),
('leman-chronometrie', 5, 750),
('sainte-croix-automata', 2, 30),
('alpenbore-systems', 4, 300),
('lodz-stagecraft', 2, 30),
('silesia-mine-rescue', 3, 75),
('gdansk-amber-exchange', 4, 300),
('cuenca-cobre-cocina', 2, 30),
('manta-tuna-exchange', 4, 300),
('musanze-lava-stoneworks', 2, 30),
('kigali-convention-seating', 3, 75),
('valais-avalanche-control', 3, 75),
('krakow-vitrail-works', 3, 75),
('talleres-pampeanos', 3, 75),
('bodega-alto-zonda', 4, 300),
('orbital-austral', 5, 750),
('moka-cane-works', 2, 30),
('mascareignes-textile', 3, 75),
('chamarel-horizon', 4, 300),
('bergkrone-seilbahnen', 5, 750),
('donau-resonanz', 4, 300),
('ennstal-praezision', 3, 75),
('paektu-spring', 3, 75),
('taedong-optical-works', 3, 75),
('moranbong-ceramics', 2, 30),
('arawak-cay-conch-kitchens', 1, 0),
('junkanoo-brass-feather', 2, 30),
('freeport-drydock-alliance', 4, 300),
('pennine-loom-co', 3, 75),
('stoke-kilnware', 2, 30),
('cambrian-slateworks', 3, 75),
('clyde-marine-pumps', 4, 300),
('fenland-maltings', 3, 75),
('veloria-mobilites', 2, 30),
('terroirs-unis', 1, 0),
('hexa-batiment', 1, 0),
('nova-assurances', 4, 300),
('caramels-de-keravel', 1, 0),
('maison-lannic', 2, 30),
('cidrerie-aulne', 3, 75),
('penn-kreiz-crepes', 2, 30),
('sardines-du-raz', 3, 75),
('ardennes-outillage', 2, 30),
('veloria-bank', 4, 300),
('nordika-glass', 3, 75),
('brassel-foods', 2, 30),
('lumen-energy', 5, 750),
('azur-logistics', 3, 75),
('abbaye-du-lion', 4, 300),
('deltaflow-engineering', 5, 750),
('tulipa-flora', 3, 75),
('orange-freight', 4, 300),
('urbanride-mobility', 3, 75),
('windmill-foods', 2, 30),
('armonia', 2, 30),
('pietraluna', 4, 300),
('nerofilo', 3, 75),
('avvolta', 4, 300),
('sorvolo', 5, 750),
('veloce-motori', 5, 750),
('aurelia-moda', 5, 750),
('adriatica-lines', 4, 300),
('ferrovia-nova', 4, 300),
('pietra-energia', 4, 300),
('granito-ceramiche', 3, 75),
('stella-caffe', 3, 75),
('dolci-bellini', 3, 75),
('oliva-verde', 2, 30),
('riviera-viva', 2, 30),
('riso-del-po', 1, 0),
('pomodoro-vesuvio', 2, 30),
('caseificio-delle-murge', 2, 30),
('vetro-laguna', 3, 75),
('dolomiti-arredo', 3, 75),
('emilia-automazione', 4, 300),
('ottica-bellagio', 4, 300),
('seta-lario', 4, 300),
('pelletteria-arno', 5, 750),
('cantieri-tirreno', 5, 750),
('kyklos-ferries', 5, 750),
('delphi-dynamics', 4, 300),
('kriti-gea', 3, 75),
('hephaistos-forge', 4, 300),
('nisos-energia', 2, 30),
('atlas-solaire', 5, 750),
('teranga-ocean', 4, 300),
('ivoire-cacao', 4, 300),
('naija-pulse', 5, 750),
('mboa-horizon', 3, 75),
('rift-motion', 4, 300),
('kaffa-origins', 4, 300),
('mille-collines-tech', 4, 300),
('ubuntu-rail', 5, 750),
('zebu-routes', 2, 30),
('koit-systems', 5, 750),
('saare-windworks', 3, 75),
('daugava-transit', 4, 300),
('amber-rye-foods', 2, 30),
('nemunas-photonics', 5, 750),
('sol-del-sur', 3, 75),
('atlantica-naval-systems', 5, 750),
('cortica-nova', 3, 75),
('azulejo-vivo', 4, 300),
('tejo-telecom', 4, 300),
('serra-dourada-foods', 2, 30),
('great-lakes-foundry', 4, 300),
('redwood-circuits', 5, 750),
('canyon-volt', 3, 75),
('harborline-logistics', 5, 750),
('prairie-biofoods', 2, 30),
('bluecrest-mutual', 5, 750),
('high-desert-aerospace', 4, 300),
('westlight-studios', 4, 300),
('milepost-diner', 2, 30),
('county-line-wholesale', 3, 75),
('hinode-transit', 5, 750),
('setouchi-marine', 4, 300),
('tsubame-precision', 5, 750),
('uji-midori', 2, 30),
('yukikaze-outdoor', 3, 75),
('pamir-zafaran', 2, 30),
('aures-solaire', 3, 75),
('baia-nova-telecom', 4, 300),
('najd-hydrogen', 5, 750),
('red-gum-renewables', 5, 750),
('exuma-blue-resorts', 3, 75),
('pearl-gate-fintech', 4, 300),
('bajan-cane-works', 2, 30),
('reef-cacao-belize', 1, 0),
('cotonou-weave', 2, 30),
('neman-optics', 3, 75),
('neretva-cableworks', 2, 30),
('borneo-helix', 5, 750),
('rose-valley-botanics', 3, 75),
('tanganyika-ember', 1, 0),
('tonle-loom', 2, 30),
('morna-atlantic', 2, 30),
('sangha-timber-lab', 2, 30),
('congo-volt-systems', 4, 300),
('myohyang-ginseng', 2, 30),
('habana-biolab', 4, 300),
('tadjoura-transit', 3, 75),
('delta-looms', 3, 75),
('falaj-water-systems', 5, 750),
('esmeraldas-cacao', 2, 30),
('massawa-saltworks', 1, 0),
('lusutfu-cane', 2, 30),
('ogooue-manganese', 4, 300),
('niumi-groundnut', 1, 0),
('kentepay', 5, 750),
('boke-alumina', 3, 75),
('ceiba-subsea', 4, 300),
('bijagos-caju', 1, 0),
('demerara-geomarine', 5, 750),
('jacmel-vetiver', 2, 30),
('cortes-frio', 3, 75),
('pannon-thermal', 4, 300),
('marovo-sunline', 2, 30),
('tigris-ceramics', 3, 75),
('caspian-turbine', 5, 750),
('shannon-aeroworks', 4, 300),
('negev-drip-systems', 4, 300),
('al-zour-pearl-lines', 5, 750),
('maloti-mohair', 1, 0),
('mesurado-rubber', 2, 30),
('cyrene-solar-glass', 3, 75),
('eislek-orbital', 5, 750),
('vardar-copperworks', 2, 30),
('selat-microtech', 3, 75),
('shire-tea', 1, 0),
('djoliba-mobile', 2, 30),
('grand-harbour-robotics', 4, 300),
('tiris-ore-logistics', 4, 300),
('codru-cellars', 2, 30),
('boka-adriatic-yards', 3, 75),
('cabo-graphite', 4, 300),
('ayeyarwady-riceworks', 2, 30),
('masaya-cacao', 1, 0),
('air-solar-works', 3, 75),
('vesterfjord-hydrogen', 5, 750),
('miraflores-canal-systems', 4, 300),
('guarani-mate-cooperative', 2, 30),
('ras-laffan-cryogenics', 5, 750),
('lobaye-timber-cooperative', 1, 0),
('cibao-medtech', 3, 75),
('carpathia-rail-dynamics', 4, 300),
('taiga-photonics', 4, 300),
('ilamatepec-coffee-lab', 2, 30),
('freetown-marine-cable', 2, 30),
('tatra-precision-bearings', 3, 75),
('banaadir-link', 3, 75),
('gezira-cotton-works', 2, 30),
('sudd-solar-water', 1, 0),
('serendib-tea-spice', 4, 300),
('kiruna-grid-storage', 5, 750),
('paramaribo-bioresins', 3, 75),
('damascene-glassworks', 2, 30),
('pamir-hydro-control', 3, 75),
('chari-gum-arabic', 1, 0),
('jericho-medjool-cooperative', 2, 30),
('dili-rhythm-house', 1, 0),
('lome-frame-studios', 2, 30),
('calypso-carnival-group', 4, 300),
('carthage-mosaic-house', 3, 75),
('ashgabat-grand-hotels', 4, 300),
('kyiv-broadcast-union', 5, 750),
('port-vila-ferry-lines', 2, 30),
('saigon-street-kitchens', 5, 750),
('aden-maritime-exchange', 3, 75),
('copperbelt-cola-company', 4, 300),
('harare-vault-auction', 3, 75),
('thimphu-talking-stamps', 2, 30),
('la-paz-cable-media', 4, 300),
('nomad-dome-acoustics', 3, 75),
('marsa-water-tank-studios', 5, 750),
('paramaribo-river-screens', 2, 30),
('makola-superstores', 4, 300),
('amman-generics', 5, 750),
('bucharest-square-properties', 4, 300),
('ljubljana-colorworks', 3, 75),
('asuncion-ledger-partners', 2, 30),
('tirana-vertikal', 4, 300),
('manama-linenworks', 3, 75),
('padma-home-appliances', 5, 750),
('ludica-del-plata', 2, 30),
('tunis-panorama-cinemas', 3, 75),
('suva-hyperbaric-systems', 3, 75),
('kingston-sound-foundry', 4, 300),
('vardar-fire-systems', 3, 75),
('darussalam-metrology', 4, 300),
('doha-canopy-engineering', 5, 750),
('boardwalk-taffy', 4, 300),
('jade-lantern-candy', 5, 750),
('baobab-bonbons', 2, 30),
('indus-mithai', 3, 75),
('doce-brisa', 4, 300),
('nordlys-lakrids', 3, 75),
('petrolove', 5, 750),
('steppe-current', 4, 300),
('himal-hydro', 2, 30),
('kalahari-helio', 5, 750),
('kartli-grid', 3, 75),
('viti-tideworks', 3, 75),
('cumbre-coca-rush', 4, 300),
('abyssinia-coffee-pulse', 4, 300),
('silk-road-tea-volt', 4, 300),
('robusta-saigon-boost', 4, 300),
('uhuru-baobab-charge', 3, 75),
('karkade-nile-energy', 3, 75),
('atoll-coco-surge', 3, 75),
('pampa-mate-fuego', 3, 75),
('kola-lome-impact', 3, 75),
('mokka-cardamom-drive', 3, 75),
('montbrun-private', 5, 750),
('straits-ledger', 5, 750),
('rio-sur-credito', 2, 30),
('dodo-blue-finance', 3, 75),
('han-river-credit', 4, 300),
('boreal-mutual', 3, 75),
('nomad-vault', 4, 300),
('lakbay-credit', 2, 30),
('fugazza-sprint', 3, 75),
('okavango-stack', 2, 30),
('bosphore-ember', 4, 300),
('siam-wokline', 5, 750),
('lima-maki', 4, 300),
('cedar-mezze', 3, 75),
('adria-pasta-bar', 3, 75),
('island-ember', 5, 750),
('maiz-rapido', 4, 300),
('cook-strait-fry', 2, 30),
('glen-durnach', 5, 750),
('dhoni-reef', 4, 300),
('vistula-no9', 4, 300),
('cobre-agave', 5, 750),
('cape-fynbos', 3, 75),
('apricot-crown', 3, 75),
('serra-de-fogo', 4, 300),
('jade-kiln', 5, 750),
('cedar-moon', 2, 30),
('atacama-condor', 2, 30),
('aerovia-turbines', 5, 750),
('erebuni-grand-instruments', 5, 750),
('dalmatia-superyacht-works', 5, 750),
('sialkot-apex-sports', 5, 750),
('andean-meridian-bank', 5, 750),
('gaborone-diamond-exchange', 4, 300),
('kotor-adriatic-insurance', 4, 300),
('nistru-crystal-works', 4, 300),
('atacama-observatory-optics', 3, 75),
('herat-loom-house', 3, 75),
('montevideo-leatherworks', 3, 75),
('vektor-balkan-sport', 3, 75),
('arcstride-athletics', 4, 300),
('kavango-form', 3, 75),
('trazo-sport', 4, 300),
('kraftlinje-sport', 4, 300),
('moris-apex', 3, 75),
('linje-nio-athletics', 4, 300),
('sibaya-athletics', 3, 75),
('werkspur-athletics', 5, 750),
('mosa-athletic-works', 4, 300),
('aurora-racing-team', 5, 750),
('pura-cadencia-test-team', 4, 300),
('bohemia-velocity-project', 3, 75),
('atlas-racing-lab', 4, 300),
('koru-racing-collective', 3, 75),
('danube-test-team', 5, 750),
('savana-racing-project', 2, 30),
('orion-cycling-lab', 4, 300),
('quebec-nord-racing', 3, 75),
('garuda-test-team', 4, 300),
('nordhavn-post', 4, 300),
('qhapaq-mail', 2, 30),
('kapuluan-post', 3, 75),
('sahel-colis', 2, 30),
('triglav-parcel', 3, 75),
('stupina-rautului', 2, 30),
('covoare-basarabene', 3, 75),
('mecanica-balti', 4, 300),
('lana-sibiului', 2, 30),
('portelan-de-alba', 3, 75),
('gom-lam-viet', 1, 0),
('dong-duong-phanh', 2, 30),
('hai-au-dong-tau', 3, 75),
('eichenrad-automobil', 5, 750),
('soramei-motors', 4, 300),
('mesa-forge-automotive', 4, 300),
('hanul-vector-motors', 4, 300),
('jade-meridian-motors', 5, 750),
('fulmine-rosso-automobili', 5, 750),
('mistralys-automobiles', 3, 75),
('calder-wren-motorworks', 3, 75),
('suryavaan-motors', 2, 30),
('vereda-nova-automoveis', 3, 75),
('savonnerie-calanque', 4, 300),
('savana-karite', 2, 30),
('atlas-ghassoul', 4, 300),
('yuzu-sento', 4, 300),
('hanbyeol-care', 5, 750),
('eldur-moss', 3, 75),
('sauna-sisu', 3, 75),
('kakheti-botanica', 2, 30),
('neem-nadi', 4, 300),
('nalu-noni', 1, 0),
('mongolian-steppes', 3, 75),
('himalayan-mountains', 4, 300),
('visit-samarkand', 4, 300),
('kyrgyz-highlands', 3, 75),
('visit-albanian-riviera', 2, 30),
('wadi-rum-horizons', 3, 75),
('guatemala-volcano-routes', 3, 75),
('pearl-of-africa-trails', 3, 75),
('mekong-discovery-laos', 2, 30),
('visit-icelandic-highlands', 4, 300),
('druk-horizon-air', 4, 300),
('caspian-kite-airways', 4, 300),
('kilimanjaro-skylink', 3, 75),
('altiplano-condor', 3, 75),
('bengal-monsoon-air', 3, 75),
('coral-bird-airways', 3, 75),
('frankincense-air', 5, 750),
('amber-sky-aviation', 4, 300),
('pura-vida-wings', 3, 75),
('balkan-star-air', 4, 300),
('frio-kwanza', 1, 0),
('orloj', 2, 30),
('droichead', 3, 75),
('via-brava', 4, 300),
('laurentide', 5, 750),
('almyra', 1, 0),
('korona', 2, 30),
('quisqueya-bate', 3, 75),
('koval', 4, 300),
('tuas-gantry', 5, 750),
('prakai', 1, 0),
('talas', 2, 30),
('nervia', 3, 75),
('lintas-laut', 4, 300),
('madar', 5, 750),
('clave', 1, 0),
('nedjma-verre', 2, 30),
('adire', 3, 75),
('bakir', 4, 300),
('sahm', 5, 750),
('wend-moto', 1, 0),
('comal', 2, 30),
('masline', 2, 30),
('tulpar', 3, 75),
('kovac-mostar', 3, 75),
('esclusa', 4, 300),
('caroni', 5, 750),
('ubumba', 1, 0),
('mwezi-pumps', 1, 0),
('odlar-emal', 2, 30),
('ganvie-marine', 2, 30),
('sokha-tuk', 2, 30),
('caye-signal', 3, 75),
('matonge-pressage', 3, 75),
('woro-woro-mobilite', 3, 75),
('fale-malosi', 4, 300),
('kensington-willow', 5, 750),
('futs-de-bangui', 1, 0),
('khao-sen-vientiane', 1, 0),
('salinas-da-morabeza', 2, 30),
('biyo-djibouti', 2, 30),
('al-rafidain-cables', 2, 30),
('palessie-mash', 3, 75),
('demerara-golden-cane', 3, 75),
('forja-de-maputo', 3, 75),
('lakdiva-mediglove', 4, 300),
('casa-copan', 5, 750),
('mboa-ciments', 2, 30),
('equateur-assurances', 4, 300),
('kassa-banque', 5, 750),
('lakou-mobile', 2, 30),
('monrovia-market', 1, 0),
('thiri-motors', 3, 75),
('volcan-energia', 3, 75),
('dunaj-telekom', 3, 75),
('farmacias-izalco', 2, 30),
('nile-dairy', 1, 0),
('assurances-du-fleuve', 4, 300),
('hidri-works', 1, 0),
('kairaba-homes', 2, 30),
('no-energia', 3, 75),
('mosi-hardware', 3, 75),
('keshet-snacks', 4, 300),
('diwaniya-coffee', 3, 75),
('nizwa-ceramics', 4, 300),
('nakamal-kava', 2, 30),
('mbira-audio', 3, 75),
('bamako-batiment', 3, 75),
('chinguetti-lait', 2, 30),
('lion-coast-insurance', 3, 75),
('honiara-ferries', 2, 30),
('zarafshon-air', 4, 300);

create function public.get_sponsor_renewal_assessment(
  p_contract_id uuid, p_sporting_director_id uuid, p_target_season_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_contract record;
  v_profile public.sponsor_renewal_profiles%rowtype;
  v_reputation integer;
  v_active_year integer;
  v_target_year integer;
  v_current_score integer;
  v_average numeric;
  v_count integer;
  v_discount integer;
  v_minimum integer;
begin
  select director.reputation_points into v_reputation
  from public.sporting_directors director
  where director.id = p_sporting_director_id and director.status = 'active';
  if not found then raise exception 'Le profil du Directeur Sportif est indisponible.'; end if;

  select contract.id, contract.team_id, contract.sponsor_id,
    coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,
    start_season.game_year as start_year,
    start_season.game_year + contract.contract_duration_seasons - 1 as end_year,
    objective_season.game_year as objective_year, sponsor.catalog_key
  into v_contract
  from public.team_sponsor_contracts contract
  join public.seasons start_season on start_season.id = contract.start_season_id
  join public.seasons objective_season
    on objective_season.id = coalesce(contract.objective_season_id, contract.start_season_id)
  join public.sponsors sponsor on sponsor.id = contract.sponsor_id
  where contract.id = p_contract_id and contract.role = 'principal' and contract.status = 'active';
  if not found then return null; end if;
  if not exists (
    select 1 from public.team_manager_assignments assignment
    where assignment.team_id = v_contract.team_id
      and assignment.sporting_director_id = p_sporting_director_id
      and assignment.role = 'general_manager' and assignment.status = 'active'
  ) then raise exception 'Ce contrat ne vous appartient pas.'; end if;

  select game_year into v_active_year from public.seasons where status = 'active';
  select game_year into v_target_year from public.seasons
    where id = p_target_season_id and status = 'planned';
  if v_target_year is distinct from v_active_year + 1
    or v_contract.end_year is distinct from v_active_year then return null; end if;
  -- Do not treat a stale annual rollover as a failed year, or count it twice.
  if v_contract.objective_year is distinct from v_active_year then
    raise exception 'Le bilan annuel du sponsor doit être actualisé avant sa reconduction.';
  end if;

  select * into v_profile from public.sponsor_renewal_profiles
    where catalog_key = v_contract.catalog_key;
  if not found then raise exception 'Le profil de reconduction du sponsor est indisponible.'; end if;

  v_current_score := greatest(0, least(100,
    coalesce(public.get_sponsor_objective_satisfaction_score(p_contract_id), 0)
    + coalesce(public.get_sponsor_performance_satisfaction_score(p_contract_id), 0)));
  -- PK(contract, season) bounds this to the few archived years of this contract.
  select avg(score), count(*)::integer into v_average, v_count from (
    select v_current_score::numeric as score
    union all
    select greatest(0, least(100, history.satisfaction_score))::numeric
    from public.sponsor_annual_objective_history history
    join public.seasons season on season.id = history.season_id
    where history.team_sponsor_contract_id = p_contract_id
      and season.game_year >= v_contract.start_year
      and season.game_year < v_active_year
  ) scores;
  v_discount := case
    when v_reputation >= 4::bigint * greatest(30, v_profile.minimum_reputation) then 10
    when v_reputation >= 2::bigint * greatest(30, v_profile.minimum_reputation) then 5
    else 0 end;
  v_minimum := 20 + 5 * v_profile.prestige - v_discount;
  return jsonb_build_object(
    'contractId', p_contract_id, 'sponsorId', v_contract.sponsor_id,
    'averageSatisfaction', round(v_average, 2), 'minimumSatisfaction', v_minimum,
    'seasonsEvaluated', v_count, 'reputationDiscount', v_discount,
    'refused', v_average < v_minimum
  );
end;
$$;
revoke all on function public.get_sponsor_renewal_assessment(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_sponsor_renewal_assessment(uuid, uuid, uuid) to service_role;

-- Guard only NEW unsigned renewals. Existing contracts, annual budget updates,
-- idempotent signing retries, first sponsors and replacement sponsors stay intact.
create function public.enforce_sponsor_renewal_assessment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_current_id uuid;
  v_director_id uuid;
  v_assessment jsonb;
begin
  select contract.id into v_current_id
  from public.team_sponsor_contracts contract
  join public.seasons start_season on start_season.id = contract.start_season_id
  join public.seasons active_season on active_season.status = 'active'
  join public.seasons target_season on target_season.id = new.start_season_id
  where contract.team_id = new.team_id and contract.sponsor_id = new.sponsor_id
    and contract.role = 'principal' and contract.status = 'active'
    and target_season.status = 'planned'
    and target_season.game_year = active_season.game_year + 1
    and start_season.game_year + contract.contract_duration_seasons - 1 = active_season.game_year
  order by contract.created_at desc limit 1;
  if v_current_id is null then return new; end if;
  select sporting_director_id into v_director_id from public.sponsor_offers
    where id = new.sponsor_offer_id;
  if v_director_id is null then
    raise exception 'L’offre de reconduction du sponsor est introuvable.';
  end if;
  v_assessment := public.get_sponsor_renewal_assessment(
    v_current_id, v_director_id, new.start_season_id);
  if v_assessment is null then
    raise exception 'Le bilan de reconduction du sponsor est indisponible.';
  end if;
  if (v_assessment ->> 'refused')::boolean then
    raise exception 'Ce sponsor refuse la reconduction : bilan du contrat % %%, minimum requis % %%. Choisissez une autre offre ou améliorez ce bilan.',
      v_assessment ->> 'averageSatisfaction', v_assessment ->> 'minimumSatisfaction';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_sponsor_renewal_assessment() from public, anon, authenticated;
create trigger enforce_sponsor_renewal_assessment
  before insert on public.team_sponsor_contracts
  for each row when (new.role = 'principal' and new.status = 'planned')
  execute function public.enforce_sponsor_renewal_assessment();

notify pgrst, 'reload schema';
commit;
