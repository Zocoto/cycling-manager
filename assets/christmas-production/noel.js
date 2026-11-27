(() => {
  "use strict";
  const { items, advent } = window.noelCatalogue;
  const { milestones, normalizeFlightDay, settleFlight, rarity, silverTrade, throwQualities, normalizeThrowQualities } = window.noelRules;
  const find = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const num = value => new Intl.NumberFormat("fr-FR").format(value);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  const itemById = new Map(items.map(item => [item.id, item]));
  const sniperItemId = "lunette-sniper-cadeaux";
  const views = all("[data-view]");
  const dialog = find("#pilot-dialog"), dialogBody = find("#dialog-body"), frame = find("#tournee-frame");
  const categories = { tout: "Tout", portrait: "Portrait", gestion: "Consommables", collection: "Collection" };
  const slots = { fond: "Fond", chapeau: "Chapeau", tenue: "Tenue", masque: "Masque", lunettes: "Lunettes", cadre: "Cadre" };
  const rarityLabels = { bronze: "Bronze", silver: "Argent", gold: "Or", holographic: "Hors Série" };
  let state = load(), view = "noel", shopFilter = "tout", toastTimer, currentRunDay = state.day, activeFlight = null;
  function fresh() { return {state:"loading",day:1,balance:0,quantities:{},obtained:{},bought:{},equipped:{},runs:{},retryDays:[],deliveries:0,communityLights:0,participants:0,ranking:[],milestones:[],opened:[],log:[],sniperPrepared:false,lastFlight:null}; }

  function load() { return fresh(); }

  function save() { /* All balances and rewards are authoritative on the server. */ }

  function quantity(id) { return state.quantities[id] ?? 0; }
  function owns(item) { return quantity(item.id) > 0; }
  function isUnique(item) { return item.category === "portrait"; }
  function price(item) { return num(item.price) + " Grelots"; }
  function dayLabel(day) { return day === 1 ? "1er décembre" : day + " décembre"; }
  function previewNow() { return Date.UTC(2026, 11, state.day, 12); }
  // The legacy persisted "deliveries" field is the already-credited personal
  // light balance. Run histories keep physical deliveries and lights separate.
  function totalLights() { return state.communityLights + state.deliveries; }
  function contributors() {
    const rows=(state.ranking??[]).map(entry=>({...entry,id:entry.userId}));
    if(state.rank && !rows.some(entry=>entry.isCurrent)) rows.push({id:"current",name:"Toi",lights:state.deliveries,rank:state.rank,isCurrent:true});
    return rows;
  }




  function notify(message) {
    if (dialog.open) {
      let feedback = find("#dialog-feedback");
      if (!feedback) {
        feedback = document.createElement("p");
        feedback.id = "dialog-feedback";
        feedback.className = "dialog-feedback";
        feedback.setAttribute("role", "status");
        dialogBody.append(feedback);
      }
      feedback.textContent = message;
      return;
    }
    const toast = find("#toast");
    clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
  }
  function sniperStock() {
    const available = quantity(sniperItemId);
    return Number.isSafeInteger(available) && available > 0 ? available : 0;
  }
  function sendSniperState(overrides = {}) {
    if (!frame.contentWindow) return;
    const running = activeFlight && !activeFlight.settled ? { runId: activeFlight.runId, active: activeFlight.sniper === true } : {};
    frame.contentWindow.postMessage({ type: "noel:tournee-lunette", available: sniperStock(), prepared: state.sniperPrepared === true && sniperStock() > 0, ...running, ...overrides }, window.location.origin);
  }
  function commit(message) { render(); sendSniperState(); if(message) notify(message); }

  function navigate() {
    const requested = window.location.hash.slice(1);
    if (requested === "contenu") return;
    view = views.some(section => section.dataset.view === requested) ? requested : "noel";
    views.forEach(section => { section.hidden = section.dataset.view !== view; });
    find("#season-hero").hidden = view !== "noel";
    find("#event-nav").hidden = view === "bureau" || view === "gazette";
    if (view === "tournee" && !frame.hasAttribute("src")) frame.src = frame.dataset.src;
    all("[data-route]").forEach(link => {
      const active = link.classList.contains("event-link") ? view !== "bureau" && view !== "gazette" : link.dataset.route === view;
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    render(); window.scrollTo(0, 0);
  }
  function render() {
    const status=find("#event-status"); status.textContent=state.state==="scheduled"?"Le village ouvre le 1er décembre à minuit, heure de Paris.":state.state==="archived"?"Les festivités sont terminées. Tes cadeaux restent acquis.":state.state==="paused"?"Le village est momentanément fermé.":state.state==="loading"?"Chargement du village…":"";
    all("[data-balance]").forEach(el => { el.textContent = num(state.balance); });
    all("[data-advent-open]").forEach(el => { el.textContent = Math.min(state.day, 24) - state.opened.filter(day => day <= state.day).length; });
    if (view === "avent") {
      find("#advent-progress").textContent = state.opened.length + " sur 24 ouvertes";
      window.noelAdvent.render({ container: find("#advent-grid"), advent, day: state.day, opened: state.opened, itemById });
    }
    if (view === "boutique") renderShop();
    if (view === "sapin") window.noelTree.render({ art: find(".tree-art"), panel: find("#tree-progress"), total: totalLights(), personal: state.deliveries, participants: state.participants, contributors: contributors(), claimed: state.milestones, milestones, itemById });
    if (view === "inventaire") renderInventory();
    if (view === "tournee") renderFlight();
    all("[data-profile]").forEach(canvas => window.drawNoelPortrait(canvas, state.equipped));
  }
  function showAdvent(day) {
    const entry = advent[day - 1];
    if (!entry || (day > state.day && !state.opened.includes(day))) return;
    const item = entry.kind === "item" ? itemById.get(entry.itemId) : null;
    const claimed = state.opened.includes(day);
    openDialog(`<p class="dialog-kicker">${dayLabel(day)}</p><h2 id="dialog-heading">${esc(entry.title)}</h2>
      ${item ? `<canvas class="reward-art" width="300" height="150" data-art="${item.art}"></canvas>` : ""}
      <p>${esc(entry.description)}</p><p><strong>${esc(item?.name ?? entry.amount + " Grelots")}</strong></p>
      <div class="dialog-actions">${claimed ? "<span>Déjà récupéré</span>" : `<button class="button button-dark" data-action="claim-advent" data-id="${day}">Récupérer le cadeau</button>`}</div>`);
  }
  async function claimAdvent(day) { const reply=await action("advent",{day});if(reply){showAdvent(day);notify(reply.message??"Cadeau de l’Avent récupéré.");} }

  function shopStatus(item) {
    if (isUnique(item) && (owns(item) || (state.bought[item.id] ?? 0) >= 1)) return "Déjà obtenu";
    return state.balance < item.price ? "Grelots insuffisants" : "";
  }
  function shopAvailability(item) { return isUnique(item) ? "Un seul exemplaire" : "Achats sans limite"; }
  function renderShop() {
    find("#shop-filters").innerHTML = Object.entries(categories).map(([id, name]) => `<button class="filter-button" data-action="filter" data-id="${id}" aria-pressed="${shopFilter === id}">${name}</button>`).join("");
    const visible = items.filter(item => !item.source && (shopFilter === "tout" || shopFilter === item.category));
    find("#shop-grid").innerHTML = visible.map(item => `<article class="shop-card">
      <div class="item-art ${item.category}"><canvas width="340" height="190" data-art="${item.art}"></canvas></div>
      <div class="item-body"><p class="item-category">${esc(slots[item.slot] ?? categories[item.category])}</p>
      <h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><div class="item-meta"><strong>${price(item)}</strong><span>${esc(shopStatus(item) || shopAvailability(item))}</span></div>
      <div class="item-actions"><button class="button button-outline" data-action="shop-item" data-id="${item.id}">${item.category === "portrait" ? "Essayer" : "Voir l’effet"}</button></div></div></article>`).join("");
    drawItems(find("#shop-grid"));
  }
  function showShopItem(item) {
    if (!item || item.source) return;
    const status = shopStatus(item);
    const body = item.slot ? '<canvas class="try-on" width="420" height="420" id="try-on" role="img" aria-label="Aperçu sur ton portrait"></canvas>' : `<canvas class="reward-art" width="340" height="190" data-art="${item.art}"></canvas>`;
    openDialog(`<p class="dialog-kicker">${esc(slots[item.slot] ?? categories[item.category])}</p><h2 id="dialog-heading">${esc(item.name)}</h2>${body}<p>${esc(item.effect)}</p>
      <div class="dialog-actions"><span>${esc(status || shopAvailability(item))}</span><button class="button button-dark" data-action="buy" data-id="${item.id}" ${status ? "disabled" : ""}>Acheter · ${price(item)}</button></div>`);
    if (item.slot) window.drawNoelPortrait(find("#try-on"), { ...state.equipped, [item.slot]: item.id });
  }
  async function buy(item) {
    if(!item||item.source||shopStatus(item))return;
    const reply=await action("buy",{item:item.id,quantity:1});
    if(reply){dialog.close();notify(reply.message??"Achat enregistré.");}
  }

  function renderInventory() {
    find("#portrait-slots").innerHTML=Object.entries(slots).map(([slot,label])=>'<div><span>'+label+'</span><strong>'+esc(itemById.get(state.equipped[slot])?.name??"—")+'</strong></div>').join("");
    find("#inventory-grid").innerHTML=items.filter(owns).map(item=>'<article class="inventory-card"><canvas width="128" height="128" data-art="'+item.art+'"></canvas><div><h3>'+esc(item.name)+'</h3><p>Quantité · '+quantity(item.id)+'</p>'+(item.id===sniperItemId&&state.sniperPrepared?'<p>Lunette prête pour la prochaine tournée.</p>':'')+'</div><button class="button button-outline" data-action="inventory-item" data-id="'+item.id+'">'+(item.slot?(state.equipped[item.slot]===item.id?"Retirer":"Équiper"):item.id==="vignette-renne"?"Ouvrir":"Utiliser")+'</button></article>').join("")||'<p class="empty-state">Ton inventaire de Noël est vide.</p>';
    find("#activity-log").innerHTML='<div class="log"><h2>Les cadeaux de ton équipe</h2><p>Les boosters, équipements et consommables habituels sont livrés directement dans l’inventaire de ton équipe. Les cosmétiques sont aussi disponibles dans ton éditeur d’avatar.</p><a class="button button-dark" href="/jeu/inventaire" target="_top">Ouvrir l’inventaire de l’équipe</a></div>';
    drawItems(find("#inventory-grid"));
  }

  async function showUseDialog(item) {
    if(item.id==="carnet-eclaireur"){await showReconnaissance(item);return;}
    if(!["lunette-sniper-cadeaux","grelot-repechage","hotte-doublons","vignette-renne"].includes(item.id)){
      openDialog('<h2 id="dialog-heading">'+esc(item.name)+'</h2><p>'+esc(item.effect)+'</p><p>Cet objet est livré dans l’inventaire de ton équipe.</p><a class="button button-dark" href="/jeu/inventaire" target="_top">Ouvrir l’inventaire de l’équipe</a>');return;
    }
    openDialog('<h2 id="dialog-heading">'+esc(item.name)+'</h2><canvas class="reward-art" width="340" height="190" data-art="'+item.art+'"></canvas><p>'+esc(item.effect)+'</p>'+(item.id===sniperItemId||item.id==="grelot-repechage"?'<p>Un exemplaire sera consommé au décollage. Un départ abandonné ne rend pas cet objet.</p>':'')+'<div class="dialog-actions"><button class="button button-dark" data-action="use-item" data-id="'+item.id+'">'+(item.id===sniperItemId||item.id==="grelot-repechage"?"Préparer ma prochaine tournée":"Utiliser")+'</button></div>');
  }

  async function applyItem(item) {
    if(!item||quantity(item.id)<1)return;
    let kind="use",payload={item:item.id};
    if(item.id===sniperItemId||item.id==="grelot-repechage"){kind="prepare";payload.prepared=true;}
    if(item.id==="carnet-eclaireur"){
      const riderIds=all("#reco-riders input:checked").map(input=>input.value);
      payload={...payload,stageIds:[find("#reco-first")?.value,find("#reco-second")?.value],riderIds,startDayNumber:Number(find("#reco-day")?.value),preparerContractId:find("#reco-preparer")?.value||null};
      if(!riderIds.length||!payload.stageIds[0]||payload.stageIds[0]===payload.stageIds[1])return notify("Choisis deux étapes différentes et au moins un coureur.");
    }
    const reply=await action(kind,payload);
    if(reply){dialog.close();notify(reply.message??"Objet utilisé.");if(kind==="prepare")window.location.hash="#tournee";}
  }


  async function inventoryAction(item) {
    if(!item||quantity(item.id)<1)return;
    if(item.slot){await action("equip",{slot:item.slot,item:state.equipped[item.slot]===item.id?"none":item.id});return;}
    await showUseDialog(item);
  }

  function renderFlight() {
    const run = state.runs[state.day];
    const container = find("#flight-result");
    if (activeFlight && !activeFlight.settled && activeFlight.day === state.day) {
      container.textContent = "Tournée en cours · tes gains en Grelots et en lumières apparaîtront ici à l’arrivée.";
      return;
    }
    const previousRun = run?.history.at(-1);
    const last = state.lastFlight?.day === state.day ? state.lastFlight : previousRun ? {
      grelots: previousRun.reward, lights: previousRun.lights, deliveries: previousRun.deliveries, qualities: previousRun.qualities, previous: true,
    } : null;
    if (!last) {
      container.textContent = "Une première tournée récompensée chaque jour. Un Second tour ajoute une tournée et tous ses gains. Un lancer réussi, super ou parfait apporte 1, 2 ou 3 lumières au sapin commun à tous les DS.";
      return;
    }
    const gainedGrelots = Math.max(0, Number(last.grelots) || 0);
    const gainedLights = Math.max(0, Number(last.lights) || 0);
    const delivered = Math.max(0, Math.min(14, Number(last.deliveries) || 0));
    const qualities = normalizeThrowQualities(last.qualities, delivered);
    const qualityKeys = Object.keys(throwQualities);
    const qualitySummary = qualities
      ? qualityKeys.map(key => `${esc(throwQualities[key].label)} : ${num(qualities[key])}`).join(" · ") : "";
    const note = last.practice ? "Tournée d’entraînement : la récompense du jour a déjà été reçue. Aucun nouveau gain."
      : last.retry ? "Second tour : tous les gains de cette nouvelle tournée s’ajoutent aux précédents, quel que soit le résultat."
        : last.previous ? "Bilan de ta tournée récompensée. Tu peux rejouer pour t’entraîner." : "Ces gains ont été crédités à ton inventaire et au sapin collectif.";
    container.innerHTML = `<section class="run-summary"><h2>${last.practice ? "Tournée d’entraînement" : "Bilan de ta tournée"} · ${dayLabel(state.day)}</h2>
      <div class="run-summary-values"><div class="run-summary-value run-summary-grelots"><span class="bell" aria-hidden="true"></span><strong>${gainedGrelots > 0 ? "+" : ""}${num(gainedGrelots)}</strong><span>Grelots reçus</span></div>
      <div class="run-summary-value run-summary-lights"><span class="light-spark" aria-hidden="true"></span><strong>${gainedLights > 0 ? "+" : ""}${num(gainedLights)}</strong><span>Lumières pour le sapin</span></div></div>
      <p class="run-summary-note">${delivered}/14 cadeaux livrés. ${note}${state.retryDays.includes(state.day) ? " Ton Second tour est prêt pour la prochaine tournée." : ""}</p>
      ${qualitySummary ? `<p class="run-summary-note">${qualitySummary}</p>` : ""}
      ${run ? `<p class="run-summary-note">Cumul du jour · ${run.count} tournée${run.count > 1 ? "s" : ""} récompensée${run.count > 1 ? "s" : ""} · ${num(run.reward)} Grelots · ${num(run.lights)} lumières.</p>` : ""}</section>`;
  }
  async function receiveFlight(event) {
    if(event.source!==frame.contentWindow||event.origin!==window.location.origin)return;
    const payload=event.data;if(!payload||typeof payload!=="object")return;
    if(payload.type==="noel:tournee-hauteur"&&Number.isFinite(payload.height)){frame.style.height=Math.max(310,Math.min(1000,payload.height+3))+"px";return;}
    if(payload.type==="noel:tournee-prete"){sendSniperState();return;}
    if(payload.type==="noel:tournee-lunette-choix"){
      if(typeof payload.prepared!=="boolean"||activeFlight&&!activeFlight.settled)return;
      await action("prepare",{item:sniperItemId,prepared:payload.prepared});sendSniperState();return;
    }
    if(payload.type==="noel:tournee-demarree"){
      if(typeof payload.runId!=="string"||payload.runId.length>120)return;
      if(busy)return tellFlight("noel:tournee-refusee",{runId:payload.runId,message:"Une action est en cours. Réessaie dans un instant."});
      if(activeFlight&&!activeFlight.settled)return tellFlight("noel:tournee-refusee",{runId:payload.runId,message:"Termine la tournée en cours."});
      if(state.activeRun){
        const agreed=window.confirm("Une tournée a été interrompue. Repartir abandonne cette tournée ; les objets déjà utilisés ne sont pas rendus.");
        if(!agreed)return tellFlight("noel:tournee-refusee",{runId:payload.runId,message:"Départ annulé."});
        if(!await action("abandon",{runId:state.activeRun.id}))return tellFlight("noel:tournee-refusee",{runId:payload.runId,message:"Départ indisponible."});
      }
      const reply=await action("start",{practice:false,retry:state.retryDays.includes(state.day),sniper:payload.sniper===true});
      if(!reply?.run)return tellFlight("noel:tournee-refusee",{runId:payload.runId,message:"Le départ n’a pas pu être confirmé. Réessaie."});
      currentRunDay=reply.run.day;activeFlight={...reply.run,runId:payload.runId,serverId:reply.run.id,settled:false};
      renderFlight();tellFlight("noel:tournee-autorisee",{runId:payload.runId,sniper:reply.run.sniper});sendSniperState();return;
    }
    if(payload.type==="noel:tournee-terminee"){
      if(!activeFlight||activeFlight.settled||payload.runId!==activeFlight.runId||!payload.proof)return;
      activeFlight.proof=payload.proof;
      await finishFlight();
    }
  }

  function openDialog(markup) { dialogBody.innerHTML = markup; drawItems(dialogBody); if (!dialog.open) dialog.showModal(); }
  function drawItems(root) { all("[data-art]", root).forEach(canvas => window.drawNoelItem(canvas, canvas.dataset.art)); }
  async function onAction(event) {
    const button=event.target.closest("button[data-action]");if(!button||button.disabled||busy)return;
    const {action:kind,id}=button.dataset,item=itemById.get(id);
    switch(kind){
      case "filter":shopFilter=id;renderShop();find('[data-action="filter"][data-id="'+id+'"]')?.focus();break;
      case "advent":showAdvent(Number(id));break;
      case "claim-advent":await claimAdvent(Number(id));break;
      case "shop-item":showShopItem(item);break;
      case "buy":await buy(item);break;
      case "inventory-item":await inventoryAction(item);break;
      case "use-item":await applyItem(item);break;
      case "claim-tree":await action("tree",{goal:Number(id)});break;
      case "retry-finish":await finishFlight();break;
      case "reload-state":await refresh();break;
    }
  }

  let busy=false, context=null;
  function tellFlight(type,payload){frame.contentWindow?.postMessage({type,...payload},window.location.origin);}
  function adopt(snapshot){
    if(!snapshot)return;
    const last=state.lastFlight;
    state={...fresh(),...snapshot,bought:snapshot.purchases??{},lastFlight:last};
  }
  async function refresh(){
    try{const response=await fetch("/api/christmas",{credentials:"same-origin",cache:"no-store"});const body=await response.json();if(!response.ok)throw Error(body.error??"Chargement indisponible.");adopt(body.state);commit();return true;}
    catch(error){notify(error.message);return false;}
  }
  async function action(kind,payload){
    if(busy)return null;
    if(state.state!=="open"&&!["use","equip","abandon","finish"].includes(kind)){notify("Le village ouvre le 1er décembre à minuit, heure de Paris.");return null;}
    busy=true;document.body.setAttribute("aria-busy","true");
    const id=crypto.randomUUID();
    try{
      let response,body;
      // A network retry reuses this transaction id; a committed action never charges twice.
      for(let attempt=0;attempt<2;attempt++){
        try{response=await fetch("/api/christmas",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,kind,payload})});body=await response.json();break;}
        catch(error){if(attempt)throw error;}
      }
      if(!response.ok)throw Error(body.error??"Action indisponible.");
      if(body.state)adopt(body.state);else await refresh();
      commit();return body.result??{};
    }catch(error){notify(error.message??"Connexion interrompue. Réessaie.");return null;}
    finally{busy=false;document.body.removeAttribute("aria-busy");}
  }
  async function finishFlight(){
    if(!activeFlight?.proof||activeFlight.settled)return;
    const result=await action("finish",{runId:activeFlight.serverId,proof:activeFlight.proof});
    if(!result){find("#flight-result").innerHTML='<p>Le résultat attend sa confirmation. Ne ferme pas cette page.</p><button class="button button-dark" data-action="retry-finish">Réessayer l’enregistrement</button>';return;}
    activeFlight.settled=true;
    state.lastFlight={...result,day:currentRunDay};
    commit();tellFlight("noel:tournee-bilan",{...result,runId:activeFlight.runId,improved:false});
  }
  async function showReconnaissance(item){
    openDialog('<h2 id="dialog-heading">Deux étapes, une sortie</h2><p>Chargement des étapes éligibles…</p>');
    try{
      const response=await fetch("/api/christmas?context=reconnaissance",{credentials:"same-origin",cache:"no-store"});
      const body=await response.json();if(!response.ok)throw Error(body.error??"Préparation indisponible.");
      context=body.context;
      const races=(context.races??[]).filter(race=>race.stages.length>=2);
      if(!races.length){openDialog('<h2 id="dialog-heading">Deux étapes, une sortie</h2><p>Aucun tour inscrit ne propose actuellement deux étapes à reconnaître. Le carnet est conservé.</p>');return;}
      openDialog('<h2 id="dialog-heading">Deux étapes, une sortie</h2><p>'+esc(item.effect)+'</p><p>Les tarifs, la durée, la forme et la capacité du préparateur habituels s’appliquent. Le carnet ajoute la reconnaissance d’une seconde étape du même tour.</p><label class="target-field">Tour<select id="reco-race">'+races.map(race=>'<option value="'+race.id+'">'+esc(race.name)+'</option>').join("")+'</select></label><label class="target-field">Première étape<select id="reco-first"></select></label><label class="target-field">Deuxième étape<select id="reco-second"></select></label><label class="target-field">Jour de départ<input id="reco-day" type="number" min="'+context.currentDayNumber+'" max="366" value="'+context.currentDayNumber+'"></label><label class="target-field">Préparateur<select id="reco-preparer"><option value="">Sans préparateur</option>'+(context.preparers??[]).map(preparer=>'<option value="'+preparer.id+'">'+esc(preparer.name)+'</option>').join("")+'</select></label><fieldset id="reco-riders"><legend>Coureurs</legend></fieldset><p id="reco-cost"></p><div class="dialog-actions"><button class="button button-dark" data-action="use-item" data-id="'+item.id+'">Valider la préparation</button></div>');
      updateReconnaissance();
    }catch(error){notify(error.message);}
  }
  function updateReconnaissance(){
    const race=context?.races?.find(entry=>entry.id===find("#reco-race")?.value);if(!race)return;
    for(const [index,selector] of ["#reco-first","#reco-second"].entries())find(selector).innerHTML=race.stages.map((stage,i)=>'<option value="'+stage.id+'" '+(i===index?"selected":"")+'>'+esc(stage.label)+'</option>').join("");
    const eligible=race.riderIds?new Set(race.riderIds):null;
    find("#reco-riders").innerHTML='<legend>Coureurs</legend>'+(context.riders??[]).filter(rider=>!eligible||eligible.has(rider.id)).map(rider=>'<label><input type="checkbox" value="'+rider.id+'"><span translate="no">'+esc(rider.name)+'</span></label>').join("");
    find("#reco-cost").textContent=race.price?"Tarif indicatif : "+num(race.price)+" €":"Le coût sera vérifié avant la réservation ; aucune consommation si la préparation est impossible.";
  }
  const height=()=>window.parent.postMessage({type:"noel:height",height:Math.ceil(document.body.getBoundingClientRect().height)},window.location.origin);
  new ResizeObserver(height).observe(document.body);
  document.addEventListener("change",event=>{if(event.target.id==="reco-race")updateReconnaissance();});
  document.addEventListener("click",onAction);
  window.addEventListener("hashchange",navigate);
  window.addEventListener("message",receiveFlight);
  frame.addEventListener("load",()=>sendSniperState());
  refresh().then(()=>navigate());

})();
