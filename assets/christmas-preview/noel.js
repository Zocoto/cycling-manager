(() => {
  "use strict";
  const { items, advent } = window.noelCatalogue;
  const { milestones, settleFlight, rarity, silverTrade } = window.noelRules;
  const cards = window.noelAlbumS4;
  const cardByNumber = new Map(cards.map(card => [String(card.number), card]));
  const find = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const num = value => new Intl.NumberFormat("fr-FR").format(value);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const storeKey = "cyclostratege-pilote-noel-v2";
  const itemById = new Map(items.map(item => [item.id, item]));
  const views = all("[data-view]");
  const dialog = find("#pilot-dialog"), dialogBody = find("#dialog-body"), frame = find("#tournee-frame");
  const categories = { tout: "Tout", portrait: "Portrait", gestion: "Gestion", collection: "Collection" };
  const slots = { fond: "Fond", chapeau: "Chapeau", tenue: "Tenue", masque: "Masque", lunettes: "Lunettes", cadre: "Cadre" };
  const rarityLabels = { bronze: "Bronze", silver: "Argent", gold: "Or", holographic: "Hors Série" };
  const recoStages = ["Étape 1 · Vallons", "Étape 2 · Montagne", "Étape 3 · Chrono"];
  const previewRiders = [{ id: "rider-a", name: "Alex Martin", potential: 2 }, { id: "rider-b", name: "Camille Leroy", potential: 3 }];
  let state = load(), view = "noel", shopFilter = "tout", toastTimer, currentRunDay = state.day, activeFlight = null;
  function fresh() {
    return {
      day: 12, balance: 540, opened: [],
      quantities: { "booster-noel": 1, "boussole-polaire": 1, "carnet-eclaireur": 1, "grelot-repechage": 1, "vignette-renne": 1 },
      bought: {}, equipped: {}, runs: {}, retryDays: [], deliveries: 0,
      communityLights: 4200, participants: 42, milestones: [], log: [],
      stickers: { 6: 4, 7: 1 }, boosters: 0, scoutingUntil: null, reconnaissances: [], potential: {}, lastFlight: null,
    };
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return fresh();
      const restored = { ...fresh(), ...saved };
      // Already opened preview windows now contain their new Advent-exclusive
      // portrait. Preserve the rest of the tester's local inventory.
      restored.quantities = { ...restored.quantities };
      for (const day of restored.opened) {
        const gift = advent[day - 1];
        const item = gift?.kind === "item" ? itemById.get(gift.itemId) : null;
        if (item?.source === "avent") restored.quantities[item.id] = Math.max(1, restored.quantities[item.id] ?? 0);
      }
      return restored;
    } catch { return fresh(); }
  }
  function save() { try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch { /* Preview remains usable without storage. */ } }
  function quantity(id) { return state.quantities[id] ?? 0; }
  function owns(item) { return quantity(item.id) > 0; }
  function isUnique(item) { return item.category === "portrait"; }
  function price(item) { return num(item.price) + " Grelots"; }
  function dayLabel(day) { return day === 1 ? "1er décembre" : day + " décembre"; }
  function previewNow() { return Date.UTC(2026, 11, state.day, 12); }
  function totalLights() { return state.communityLights + state.deliveries; }
  function random() {
    if (window.crypto?.getRandomValues) return window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    return Math.random();
  }
  function gainItem(item) {
    if (!item) throw new Error("Objet de récompense inconnu");
    if (isUnique(item) && owns(item)) { state.balance += 20; return "20 Grelots pour ton doublon"; }
    state.quantities[item.id] = quantity(item.id) + 1;
    return item.name;
  }
  function record(message, day = state.day) { state.log.unshift({ message, day }); state.log = state.log.slice(0, 20); }
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
  function commit(message) { save(); render(); if (message) notify(message); }
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
    all("[data-balance]").forEach(el => { el.textContent = num(state.balance); });
    all("[data-advent-open]").forEach(el => { el.textContent = Math.min(state.day, 24) - state.opened.filter(day => day <= state.day).length; });
    find("#preview-day").value = String(state.day);
    find("#preview-community").value = String(state.communityLights);
    find("#preview-community-value").textContent = num(state.communityLights);
    if (view === "avent") {
      find("#advent-progress").textContent = state.opened.length + " sur 24 ouvertes";
      window.noelAdvent.render({ container: find("#advent-grid"), advent, day: state.day, opened: state.opened, itemById });
    }
    if (view === "boutique") renderShop();
    if (view === "sapin") window.noelTree.render({ art: find(".tree-art"), panel: find("#tree-progress"), total: totalLights(), personal: state.deliveries, participants: state.participants, claimed: state.milestones, milestones, itemById });
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
  function claimAdvent(day) {
    const entry = advent[day - 1];
    if (!entry || day > state.day || state.opened.includes(day)) return;
    state.opened.push(day);
    let reward;
    if (entry.kind === "grelots") { state.balance += entry.amount; reward = entry.amount + " Grelots"; }
    else reward = gainItem(itemById.get(entry.itemId));
    record("Avent · " + reward); commit("Cadeau récupéré · " + reward); showAdvent(day);
  }
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
  function buy(item) {
    if (!item || item.source || shopStatus(item)) return;
    state.balance -= item.price; state.bought[item.id] = (state.bought[item.id] ?? 0) + 1;
    gainItem(item); record("Boutique · " + item.name); dialog.close(); commit(item.name + " rejoint ton inventaire.");
  }
  function renderInventory() {
    find("#portrait-slots").innerHTML = Object.entries(slots).map(([slot, label]) => `<div><span>${label}</span><strong>${esc(itemById.get(state.equipped[slot])?.name ?? "—")}</strong></div>`).join("");
    const inventory = items.filter(owns).map(item => `<article class="inventory-card"><canvas width="128" height="128" data-art="${item.art}"></canvas><div><h3>${esc(item.name)}</h3>${item.source === "avent" ? '<span class="item-exclusive">Exclusivité de l’Avent</span>' : ""}<p>Quantité · ${quantity(item.id)}</p></div>
      <button class="button button-outline" data-action="inventory-item" data-id="${item.id}">${item.slot ? (state.equipped[item.slot] === item.id ? "Retirer" : "Équiper") : item.id === "booster-noel" || item.id === "vignette-renne" ? "Ouvrir" : "Utiliser"}</button></article>`).join("");
    const collection = Object.entries(state.stickers).filter(([, count]) => count > 0);
    const buff = state.scoutingUntil && Date.parse(state.scoutingUntil) > previewNow()
      ? `<div class="log"><h2>Boussole active · +20 % scouting</h2><p>Jusqu’au ${esc(new Date(state.scoutingUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }))} · chaque utilisation ajoute 7 jours.</p></div>` : "";
    find("#inventory-grid").innerHTML = (inventory || '<p class="empty-state">Ton inventaire est vide.</p>') + buff +
      (collection.length ? `<div class="log"><h2>Album S4 · vignettes de l’aperçu</h2>${collection.map(([number, count]) => {
        const card = cardByNumber.get(number);
        return `<div class="log-entry"><span>${esc(card ? card.name + " · " + rarityLabels[card.rarity] : "Vignette " + number)}</span><strong>×${count}</strong></div>`;
      }).join("")}</div>` : "");
    drawItems(find("#inventory-grid"));
    find("#activity-log").innerHTML = state.log.length ? `<div class="log"><h2>Dernières activités</h2>${state.log.slice(0, 8).map(entry => `<div class="log-entry"><span>${esc(entry.message)}</span><span>${esc(dayLabel(entry.day))}</span></div>`).join("")}</div>` : "";
  }
  function showUseDialog(item) {
    if (item.id === "carnet-eclaireur") {
      openDialog(`<p class="dialog-kicker">Préparation de reconnaissance · aperçu</p><h2 id="dialog-heading">Deux étapes, une sortie</h2><p>${esc(item.effect)}</p>
        <div class="reco-stages"><strong>Tour des Sapins · 3 étapes</strong><label class="target-field">Première étape<select id="reco-first">${recoStages.map((stage, i) => `<option value="${i}">${stage}</option>`).join("")}</select></label>
        <label class="reco-consumable"><input id="reco-notebook" type="checkbox" checked><span>Utiliser un Carnet de l’éclaireur (${quantity(item.id)} disponible) pour reconnaître une deuxième étape du même tour.</span></label>
        <label class="target-field" id="reco-second-field">Deuxième étape<select id="reco-second">${recoStages.map((stage, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${stage}</option>`).join("")}</select></label></div>
        <div class="dialog-actions"><button class="button button-dark" data-action="use-item" data-id="${item.id}">Valider la préparation</button></div>`);
      return;
    }
    let content = "";
    if (item.id === "potential-notebook") content = `<label class="target-field">Coureur<select id="item-target">${previewRiders.map(rider => `<option value="${rider.id}">${rider.name} · ${state.potential[rider.id] ?? rider.potential} étoiles</option>`).join("")}</select></label>`;
    if (item.id === "hotte-doublons") {
      const trade = silverTrade(state.stickers, cards, 0);
      content = `<p>${trade ? "Trois exemplaires Argent en double seront échangés. Tu conserveras au moins un exemplaire de chaque carte." : "Il faut trois exemplaires Argent en double et au moins une Argent manquante. La hotte reste dans ton inventaire si les conditions ne sont pas remplies."}</p>`;
    }
    openDialog(`<h2 id="dialog-heading">${esc(item.name)}</h2><p>${esc(item.effect)}</p>${content}<div class="dialog-actions"><button class="button button-dark" data-action="use-item" data-id="${item.id}">Utiliser</button></div>`);
  }
  function applyItem(item) {
    if (!item || quantity(item.id) < 1) return;
    let message;
    if (item.id === "boussole-polaire") {
      const startsAt = Math.max(previewNow(), Date.parse(state.scoutingUntil ?? "") || 0);
      state.scoutingUntil = new Date(startsAt + 7 * 86400000).toISOString();
      message = "7 jours ajoutés au bonus de scouting +20 %, pour les missions déjà en cours et les nouvelles. L’intensité reste à +20 %.";
    } else if (item.id === "carnet-eclaireur") {
      const first = Number(find("#reco-first")?.value), second = Number(find("#reco-second")?.value);
      const use = find("#reco-notebook")?.checked;
      if (!use) return notify("Choisis le carnet pour préparer deux étapes. L’objet est conservé.");
      if (!recoStages[first] || !recoStages[second] || first === second) return notify("Choisis deux étapes différentes du même tour.");
      state.reconnaissances.push({ first, second }); message = "Reconnaissance préparée · " + recoStages[first] + " et " + recoStages[second] + ".";
    } else if (item.id === "grelot-repechage") {
      if (!state.runs[state.day]) return notify("Termine d’abord ta tournée du jour. Le grelot est conservé.");
      if (state.retryDays.includes(state.day)) return notify("Ta seconde chance est déjà prête.");
      state.retryDays.push(state.day); message = "Seconde chance activée : seul le meilleur résultat et son amélioration seront comptés.";
    } else if (item.id === "hotte-doublons") {
      const trade = silverTrade(state.stickers, cards, random());
      if (!trade) return notify("Il faut trois doublons Argent et une Argent manquante. L’objet est conservé.");
      for (const number of trade.payment) state.stickers[number] -= 1;
      state.stickers[trade.card.number] = 1; message = "Hotte ouverte · " + trade.card.name + " (Argent S4) rejoint la collection.";
    } else if (item.id === "potential-notebook") {
      const rider = previewRiders.find(candidate => candidate.id === find("#item-target")?.value);
      if (!rider) return;
      const before = state.potential[rider.id] ?? rider.potential;
      if (before > 3) return notify("Le coureur doit avoir au plus 3 étoiles. Le carnet est conservé.");
      state.potential[rider.id] = before + 1; message = rider.name + " · " + before + " → " + (before + 1) + " étoiles de potentiel.";
    } else return;
    state.quantities[item.id] -= 1; record(message); dialog.close(); commit(message);
  }
  function drawCard(precious) {
    const drawnRarity = rarity(random(), precious);
    const pool = cards.filter(card => card.rarity === drawnRarity);
    if (!pool.length) throw new Error("Rareté absente de l’album S4");
    return pool[Math.floor(random() * pool.length)];
  }
  function inventoryAction(item) {
    if (!item || quantity(item.id) < 1) return;
    if (item.slot) {
      if (state.equipped[item.slot] === item.id) delete state.equipped[item.slot]; else state.equipped[item.slot] = item.id;
      commit("Portrait mis à jour."); return;
    }
    if (item.id === "booster-noel" || item.id === "vignette-renne") {
      const drawn = Array.from({ length: item.id === "booster-noel" ? 2 : 1 }, () => drawCard(item.id === "vignette-renne"));
      state.quantities[item.id] -= 1;
      for (const card of drawn) state.stickers[card.number] = (state.stickers[card.number] ?? 0) + 1;
      record("Album S4 · " + drawn.map(card => card.name).join(" et ")); commit();
      openDialog(`<p class="dialog-kicker">Cyclo-Stickers · Saison 4</p><h2 id="dialog-heading">${esc(item.name)}</h2><p>${drawn.length === 2 ? "Deux vignettes S4" : "Une vignette précieuse S4"} rejoignent ta collection dans cet aperçu.</p><div class="booster-cards">${drawn.map(card => `<strong class="sticker-rarity ${card.rarity}">${esc(card.name)}<br><small>${rarityLabels[card.rarity]} · n° ${card.number}</small></strong>`).join("")}</div>`);
    } else showUseDialog(item);
  }
  function renderFlight() {
    const run = state.runs[state.day];
    const container = find("#flight-result");
    if (activeFlight && !activeFlight.settled && activeFlight.day === state.day) {
      container.textContent = "Tournée en cours · tes gains en Grelots et en lumières apparaîtront ici à l’arrivée.";
      return;
    }
    const last = state.lastFlight?.day === state.day ? state.lastFlight : run ? {
      grelots: run.reward, lights: run.deliveries, deliveries: run.deliveries, previous: true,
    } : null;
    if (!last) {
      container.textContent = "Une tournée récompensée par jour. Chaque cadeau livré ajoute une lumière au sapin commun à tous les DS.";
      return;
    }
    const gainedGrelots = Math.max(0, Number(last.grelots) || 0);
    const gainedLights = Math.max(0, Number(last.lights) || 0);
    const delivered = Math.max(0, Math.min(14, Number(last.deliveries) || 0));
    const note = last.practice ? "Tournée d’entraînement : la récompense du jour a déjà été reçue. Aucun nouveau gain."
      : last.retry ? (last.improved ? "Seconde chance : seuls les gains supplémentaires sont crédités." : "Seconde chance : ton meilleur résultat est conservé. Aucun gain supplémentaire.")
        : last.previous ? "Bilan de ta tournée récompensée. Tu peux rejouer pour t’entraîner." : "Ces gains ont été crédités à ton inventaire et au sapin collectif de l’aperçu.";
    container.innerHTML = `<section class="run-summary"><h2>${last.practice ? "Tournée d’entraînement" : "Bilan de ta tournée"} · ${dayLabel(state.day)}</h2>
      <div class="run-summary-values"><div class="run-summary-value run-summary-grelots"><span class="bell" aria-hidden="true"></span><strong>${gainedGrelots > 0 ? "+" : ""}${num(gainedGrelots)}</strong><span>Grelots reçus</span></div>
      <div class="run-summary-value run-summary-lights"><span class="light-spark" aria-hidden="true"></span><strong>${gainedLights > 0 ? "+" : ""}${num(gainedLights)}</strong><span>Lumières pour le sapin</span></div></div>
      <p class="run-summary-note">${delivered}/14 cadeaux livrés. ${note}${state.retryDays.includes(state.day) ? " Ta seconde chance est prête pour la prochaine tournée." : ""}</p></section>`;
  }
  function receiveFlight(event) {
    if (event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
    const payload = event.data;
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "noel:tournee-hauteur" && Number.isFinite(payload.height)) frame.style.height = Math.max(310, Math.min(1000, payload.height + 3)) + "px";
    else if (payload.type === "noel:tournee-demarree") {
      currentRunDay = state.day;
      activeFlight = { day: state.day, runId: typeof payload.runId === "string" ? payload.runId : null, settled: false };
      renderFlight();
    }
    else if (payload.type === "noel:tournee-terminee") {
      if (!activeFlight || activeFlight.settled || (activeFlight.runId !== null && payload.runId !== activeFlight.runId)
        || !Number.isInteger(payload.score) || payload.score < 0 || payload.score > 7000
        || !Number.isInteger(payload.deliveries) || payload.deliveries < 0 || payload.deliveries > 14) return;
      const retry = state.retryDays.includes(currentRunDay);
      const result = settleFlight(state.runs[currentRunDay], payload.score, payload.deliveries, retry);
      activeFlight.settled = true;
      const practice = !result;
      const grelots = result?.grelots ?? 0;
      const lights = result?.lights ?? 0;
      if (result) {
        state.retryDays = state.retryDays.filter(day => day !== currentRunDay);
        state.runs[currentRunDay] = result.result; state.balance += grelots; state.deliveries += lights;
        record("Tournée · +" + grelots + " Grelots · +" + lights + " lumières", currentRunDay);
      }
      state.lastFlight = { day: currentRunDay, grelots, lights, deliveries: payload.deliveries, practice, retry, improved: result?.improved ?? false };
      commit();
      frame.contentWindow.postMessage({ type: "noel:tournee-bilan", runId: activeFlight.runId, grelots, lights, deliveries: payload.deliveries, practice, retry, improved: result?.improved ?? false }, window.location.origin);
    }
  }
  function openDialog(markup) { dialogBody.innerHTML = markup; drawItems(dialogBody); if (!dialog.open) dialog.showModal(); }
  function drawItems(root) { all("[data-art]", root).forEach(canvas => window.drawNoelItem(canvas, canvas.dataset.art)); }
  function onAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled) return;
    const { action, id } = button.dataset, item = itemById.get(id);
    switch (action) {
      case "filter": shopFilter = id; renderShop(); find(`[data-action="filter"][data-id="${id}"]`)?.focus(); break;
      case "advent": showAdvent(Number(id)); break;
      case "claim-advent": claimAdvent(Number(id)); break;
      case "shop-item": showShopItem(item); break;
      case "buy": buy(item); break;
      case "inventory-item": inventoryAction(item); break;
      case "use-item": applyItem(item); break;
      case "claim-tree": {
        const milestone = milestones.find(entry => entry.goal === Number(id));
        if (!milestone || state.milestones.includes(milestone.goal) || totalLights() < milestone.goal) return;
        state.milestones.push(milestone.goal); state.balance += milestone.grelots;
        for (const itemId of milestone.items) gainItem(itemById.get(itemId));
        const reward = window.noelTree.rewardLabel(milestone, itemById);
        record("Sapin · " + reward); commit("Récompense commune récupérée · " + reward); break;
      }
    }
  }
  const collectiveControl = document.createElement("label");
  collectiveControl.className = "pilot-collective";
  collectiveControl.innerHTML = 'Sapin (aperçu)<input id="preview-community" type="range" min="0" max="28000" step="100" aria-label="Lumières collectives de l’aperçu"><output id="preview-community-value"></output>';
  find(".pilot-controls").append(collectiveControl);
  find("#preview-community").addEventListener("input", event => { state.communityLights = Number(event.target.value); commit(); });
  const date = find("#preview-day");
  date.innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${dayLabel(i + 1)}</option>`).join("");
  date.addEventListener("change", () => { state.day = Number(date.value); commit(); });
  document.addEventListener("change", event => {
    if (event.target.id === "reco-notebook") find("#reco-second-field").hidden = !event.target.checked;
  });
  find("#reset-pilot").addEventListener("click", () => {
    if (!window.confirm("Réinitialiser l’inventaire et les récompenses du pilote ?")) return;
    state = fresh(); currentRunDay = state.day;
    activeFlight = null;
    if (frame.hasAttribute("src")) frame.src = frame.dataset.src;
    commit("Aperçu réinitialisé.");
  });
  document.addEventListener("click", onAction);
  window.addEventListener("hashchange", navigate);
  window.addEventListener("message", receiveFlight);
  navigate();
})();
