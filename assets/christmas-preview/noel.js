(() => {
  "use strict";

  const { items, advent } = window.noelCatalogue;
  const find = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const format = new Intl.NumberFormat("fr-FR");
  const storeKey = "cyclostratege-pilote-noel-v1";
  const views = all("[data-view]");
  const itemById = new Map(items.map(item => [item.id, item]));
  const dialog = find("#pilot-dialog");
  const dialogBody = find("#dialog-body");
  const frame = find("#tournee-frame");
  const categories = { tout: "Tout", portrait: "Portrait", gestion: "Gestion", collection: "Collection" };
  const slots = { fond: "Fond", chapeau: "Chapeau", tenue: "Tenue", masque: "Masque", lunettes: "Lunettes", cadre: "Cadre" };
  const recipients = [
    { name: "Camille", team: "Vélo Boréal", wish: "bonnet-relais" },
    { name: "Alex", team: "Pignon des Alpes", wish: "couronne-rayons" },
    { name: "Morgan", team: "Échappée du Nord", wish: "lunettes-givre" },
  ];
  const milestones = [{ goal: 120, reward: 35 }, { goal: 160, reward: 50 }, { goal: 210, reward: 85 }];
  const stickerDeck = ["Col sous la neige", "Dernier relais", "Vélodrome de nuit", "Échappée du réveillon"];
  const options = {
    "billet-neige": ["Col des Aiguilles · 18 000 €", "Boucle des Sapins · 30 000 €"],
    "boussole-polaire": ["Grimpeur", "Puncheur", "Rouleur", "Sprinteur", "Coureur de classiques"],
    "carnet-eclaireur": ["Final du col des Aiguilles", "Crête exposée de la Boucle des Sapins"],
  };
  let state = load();
  let view = "noel";
  let shopFilter = "tout";
  let toastTimer;
  let currentRunDay = state.day;

  function fresh() {
    return {
      day: 12, balance: 540, opened: [], quantities: { "booster-noel": 1 }, bought: {},
      equipped: {}, runs: {}, deliveries: 0, milestones: [],
      gifts: [], log: [], stickers: { "Dernier relais": 2 }, boosters: 0, keepsake: false,
    };
  }

  function load() {
    try {
      return { ...fresh(), ...JSON.parse(localStorage.getItem(storeKey) ?? "{}") };
    } catch {
      return fresh();
    }
  }

  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch {}
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function num(value) { return format.format(value); }
  function quantity(id) { return state.quantities[id] ?? 0; }
  function isUnique(item) { return item.category === "portrait" || item.id === "vignette-renne"; }
  function owns(item) { return quantity(item.id) > 0 || (item.id === "vignette-renne" && state.keepsake); }
  function price(item) { return num(item.price) + " Grelots"; }
  function dayLabel(day) { return day === 1 ? "1er décembre" : day + " décembre"; }

  function gainItem(item) {
    if (isUnique(item) && owns(item)) {
      state.balance += 20;
      return "20 Grelots pour ton doublon";
    }
    state.quantities[item.id] = quantity(item.id) + 1;
    return item.name;
  }

  function record(message, day = state.day) {
    state.log.unshift({ message, day });
    state.log = state.log.slice(0, 14);
  }

  function notify(message) {
    const toast = find("#toast");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function commit(message) {
    save();
    render();
    if (message) notify(message);
  }

  function navigate() {
    const requested = window.location.hash.slice(1);
    if (requested === "contenu") return;
    view = views.some(section => section.dataset.view === requested) ? requested : "noel";
    views.forEach(section => { section.hidden = section.dataset.view !== view; });
    find("#season-hero").hidden = view !== "noel";
    find("#event-nav").hidden = view === "bureau" || view === "gazette";
    if (view === "tournee" && !frame.hasAttribute("src")) frame.src = frame.dataset.src;
    all("[data-route]").forEach(link => {
      const eventHome = link.classList.contains("event-link");
      const active = eventHome ? view !== "bureau" && view !== "gazette" : link.dataset.route === view;
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    all("[data-balance]").forEach(el => { el.textContent = num(state.balance); });
    all("[data-advent-open]").forEach(el => { el.textContent = Math.min(state.day, 24) - state.opened.filter(day => day <= state.day).length; });
    find("#preview-day").value = String(state.day);
    if (view === "avent") renderAdvent();
    if (view === "boutique") renderShop();
    if (view === "sapin") renderTree();
    if (view === "inventaire") renderInventory();
    if (view === "cadeaux") renderGifts();
    if (view === "tournee") renderFlight();
    all("[data-profile]").forEach(canvas => window.drawNoelPortrait(canvas, state.equipped));
  }

  function renderAdvent() {
    find("#advent-progress").textContent = state.opened.length + " sur 24 ouvertes";
    find("#advent-grid").innerHTML = advent.map((entry, i) => {
      const day = i + 1;
      const opened = state.opened.includes(day);
      const ready = day <= state.day;
      const reward = entry.kind === "grelots" ? entry.amount + " Grelots" : itemById.get(entry.itemId).name;
      const caption = opened ? reward : ready ? "À ouvrir" : "Bientôt";
      return `<button class="advent-door ${opened ? "claimed" : ready ? "available" : "locked"}"
        type="button" data-action="advent" data-id="${day}" ${ready || opened ? "" : "disabled"} aria-label="${esc(dayLabel(day))} · ${esc(caption)}">
        <span class="advent-day">${day}</span><span class="advent-caption">${esc(caption)}</span></button>`;
    }).join("");
  }

  function showAdvent(day) {
    const entry = advent[day - 1];
    if (!entry || day > state.day && !state.opened.includes(day)) return;
    const item = entry.kind === "item" ? itemById.get(entry.itemId) : null;
    const reward = item?.name ?? entry.amount + " Grelots";
    const claimed = state.opened.includes(day);
    openDialog(`<p class="dialog-kicker">${dayLabel(day)}</p><h2 id="dialog-heading">${esc(entry.title)}</h2>
      ${item ? `<canvas class="reward-art" width="300" height="150" data-art="${item.art}"></canvas>` : ""}
      <p>${esc(entry.description)}</p><p><strong>${esc(reward)}</strong></p>
      <div class="dialog-actions">${claimed ? "<span>Déjà récupéré</span>"
      : `<button class="button button-dark" data-action="claim-advent" data-id="${day}">Récupérer le cadeau</button>`}</div>`);
  }

  function claimAdvent(day) {
    const entry = advent[day - 1];
    if (!entry || day > state.day || state.opened.includes(day)) return;
    state.opened.push(day);
    let reward;
    if (entry.kind === "grelots") {
      state.balance += entry.amount;
      reward = entry.amount + " Grelots";
    } else {
      reward = gainItem(itemById.get(entry.itemId));
    }
    record("Avent · " + reward);
    commit("Cadeau récupéré · " + reward);
    showAdvent(day);
  }

  function shopStatus(item) {
    if (isUnique(item) && owns(item)) return "Dans ton inventaire";
    if ((state.bought[item.id] ?? 0) >= item.limit) return "Limite atteinte";
    if (state.balance < item.price) return "Grelots insuffisants";
    return "";
  }

  function renderShop() {
    find("#shop-filters").innerHTML = Object.entries(categories).map(([id, name]) =>
      `<button class="filter-button" data-action="filter" data-id="${id}" aria-pressed="${shopFilter === id}">${name}</button>`).join("");
    const visible = items.filter(item => shopFilter === "tout" || shopFilter === item.category);
    find("#shop-grid").innerHTML = visible.map(item => `<article class="shop-card">
      <div class="item-art ${item.category}"><canvas width="340" height="190" data-art="${item.art}"></canvas></div>
      <div class="item-body"><p class="item-category">${esc(slots[item.slot] ?? categories[item.category])}</p>
        <h2>${esc(item.name)}</h2><p>${esc(item.description)}</p>
        <div class="item-meta"><strong>${price(item)}</strong><span>${esc(shopStatus(item) || "Limite · " + item.limit)}</span></div>
        <div class="item-actions"><button class="button button-outline" data-action="shop-item" data-id="${item.id}">
        ${item.category === "portrait" ? "Essayer" : "Voir l’effet"}</button></div>
      </div></article>`).join("");
    drawItems(find("#shop-grid"));
  }

  function showShopItem(item) {
    if (!item) return;
    const status = shopStatus(item);
    const body = item.category === "portrait"
      ? '<canvas class="try-on" width="420" height="420" id="try-on" role="img" aria-label="Aperçu sur ton portrait"></canvas>'
      : `<canvas class="reward-art" width="340" height="190" data-art="${item.art}"></canvas>`;
    openDialog(`<p class="dialog-kicker">${esc(slots[item.slot] ?? categories[item.category])}</p>
      <h2 id="dialog-heading">${esc(item.name)}</h2>${body}<p>${esc(item.effect)}</p>
      <div class="dialog-actions"><span>${esc(status || "Limite · " + item.limit)}</span>
      <button class="button button-dark" data-action="buy" data-id="${item.id}" ${status ? "disabled" : ""}>Acheter · ${price(item)}</button></div>`);
    if (item.slot) window.drawNoelPortrait(find("#try-on"), { ...state.equipped, [item.slot]: item.id });
  }

  function buy(item) {
    if (!item || shopStatus(item)) return;
    state.balance -= item.price;
    state.bought[item.id] = (state.bought[item.id] ?? 0) + 1;
    gainItem(item);
    record("Boutique · " + item.name);
    dialog.close();
    commit(item.name + " rejoint ton inventaire.");
  }

  function renderTree() {
    const total = 112 + state.deliveries;
    const ceiling = milestones.at(-1).goal;
    find("#tree-progress").innerHTML = `<div class="tree-metric"><strong>${num(total)}</strong><span> / ${ceiling} lumières</span></div>
      <p>Tes livraisons ont ajouté <strong>${state.deliveries}</strong> ${state.deliveries === 1 ? "lumière" : "lumières"} au sapin.</p>
      <div class="tree-track" role="progressbar" aria-valuemax="${ceiling}" aria-valuemin="0" aria-valuenow="${Math.min(total, ceiling)}" aria-label="Lumières du sapin"><span style="width:${Math.min(100, total / ceiling * 100)}%"></span></div>
      <div class="tree-milestones">${milestones.map(({ goal, reward }) => {
        const claimed = state.milestones.includes(goal);
        return `<div class="milestone"><div><strong>${goal} lumières</strong><span>${reward} Grelots</span></div>
          <button class="button button-outline" data-action="claim-tree" data-id="${goal}" ${claimed || total < goal ? "disabled" : ""}>
          ${claimed ? "Récupéré" : total >= goal ? "Récupérer" : "À venir"}</button></div>`;
      }).join("")}</div>`;
    drawTree(find("#tree-canvas"), Math.min(1, total / ceiling));
  }

  function drawTree(canvas, lit) {
    const ctx = canvas.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, "#102b2a");
    sky.addColorStop(1, "#244744");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 560, 440);
    for (let i = 0; i < 75; i++) {
      ctx.fillStyle = i % 7 === 0 ? "#f3cf8995" : "#edf7ec60";
      ctx.beginPath();
      ctx.arc((i * 91.7 + 12) % 560, (i * 63.8 + 21) % 380, 1 + i % 3 / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ccd7cb";
    ctx.beginPath();
    ctx.ellipse(280, 441, 380, 61, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#684638";
    ctx.fillRect(266, 346, 28, 45);
    const treeLayers = [
      { top: 156, bottom: 366, half: 149, color: "#275749" },
      { top: 114, bottom: 310, half: 119, color: "#346754" },
      { top: 68, bottom: 242, half: 91, color: "#40745b" },
      { top: 48, bottom: 178, half: 67, color: "#538465" },
    ];
    for (const layer of treeLayers) {
      ctx.beginPath();
      ctx.moveTo(280, layer.top);
      ctx.lineTo(280 - layer.half, layer.bottom);
      ctx.quadraticCurveTo(280, layer.bottom + 29, 280 + layer.half, layer.bottom);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    }
    for (let i = 0; i < 64; i++) {
      const y = 117 + i * 3.85;
      const half = 21 + (y - 110) * .40;
      const x = 280 + Math.sin(i * 1.72) * half;
      const on = i < lit * 64;
      ctx.shadowBlur = on ? 16 : 0;
      ctx.shadowColor = "#ffe4a6";
      ctx.fillStyle = on ? ["#ffdb99", "#e5a5a4", "#deefb3"][i % 3] : "#142e2a";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffe2a0";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 25 : 11;
      const x = 280 + Math.cos(angle) * radius;
      const y = 58 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function renderInventory() {
    find("#portrait-slots").innerHTML = Object.entries(slots).map(([slot, label]) => {
      const item = itemById.get(state.equipped[slot]);
      return `<div><span>${label}</span><strong>${esc(item?.name ?? "—")}</strong></div>`;
    }).join("");
    const owned = items.filter(owns);
    const cards = owned.map(item => {
      const equipped = state.equipped[item.slot] === item.id;
      const used = item.id === "vignette-renne" && state.keepsake;
      const action = item.slot ? (equipped ? "Retirer" : "Équiper")
        : item.id === "booster-noel" ? "Ouvrir" : item.id === "vignette-renne" ? "Ajouter à la vitrine" : "Utiliser";
      return `<article class="inventory-card"><canvas width="128" height="128" data-art="${item.art}"></canvas><div>
        <h3>${esc(item.name)}</h3><p>${used ? "Dans ta vitrine" : "Quantité · " + quantity(item.id)}</p></div>
        <button class="button button-outline" data-action="inventory-item" data-id="${item.id}" ${used ? "disabled" : ""}>${action}</button></article>`;
    }).join("");
    const collection = Object.entries(state.stickers).filter(([, count]) => count > 0);
    find("#inventory-grid").innerHTML = (cards || '<p class="empty-state">Ton inventaire est vide.</p>') +
      (collection.length ? `<div class="log"><h2>Cyclo-Stickers</h2>
      ${collection.map(([name, count]) => `<div class="log-entry"><span>${esc(name)}</span><strong>×${count}</strong></div>`).join("")}</div>` : "");
    drawItems(find("#inventory-grid"));
    find("#activity-log").innerHTML = state.log.length ? `<div class="log"><h2>Dernières activités</h2>
      ${state.log.slice(0, 6).map(entry => `<div class="log-entry"><span>${esc(entry.message)}</span><span>${esc(dayLabel(entry.day))}</span></div>`).join("")}</div>` : "";
  }

  function useDialog(item) {
    const targets = item.id === "lettre-relais"
      ? recipients.flatMap(person => Object.entries(state.stickers).filter(([, count]) => count > 1)
        .filter(([sticker]) => !state.gifts.some(gift => gift.to === person.name && gift.name === sticker))
        .map(([sticker]) => person.name + " · " + sticker))
      : options[item.id] ?? [];
    openDialog(`<h2 id="dialog-heading">${esc(item.name)}</h2><p>${esc(item.effect)}</p>
      ${targets.length ? `<label class="target-field">Choisir la cible<select id="item-target">${targets.map(value =>
        `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label>`
      : "<p>Il te faut une vignette en double à offrir.</p>"}
      <div class="dialog-actions"><button class="button button-dark" data-action="use-item" data-id="${item.id}" ${targets.length ? "" : "disabled"}>Utiliser dans le pilote</button></div>`);
  }

  function applyItem(item) {
    const target = find("#item-target")?.value;
    if (!item || !target || quantity(item.id) === 0) return;
    let message;
    if (item.id === "billet-neige") {
      const amount = target.startsWith("Col") ? 4500 : 6000;
      message = "Remise réservée · " + num(amount) + " € sur " + target.split(" · ")[0];
    } else if (item.id === "boussole-polaire") {
      message = "Mission de scouting · au moins un profil " + target.toLowerCase() + " dans le prochain rapport";
    } else if (item.id === "carnet-eclaireur") {
      message = "Deuxième secteur ajouté · " + target;
    } else if (item.id === "lettre-relais") {
      const [to, sticker] = target.split(" · ");
      if ((state.stickers[sticker] ?? 0) < 2) return;
      state.stickers[sticker] -= 1;
      state.gifts.unshift({ to, name: sticker });
      message = to + " a accepté la vignette « " + sticker + " » dans le pilote.";
    } else return;
    state.quantities[item.id] -= 1;
    record(message);
    dialog.close();
    commit(message);
  }

  function inventoryAction(item) {
    if (!item || quantity(item.id) === 0) return;
    if (item.slot) {
      if (state.equipped[item.slot] === item.id) {
        delete state.equipped[item.slot];
        commit(item.name + " retiré du portrait.");
      } else {
        state.equipped[item.slot] = item.id;
        commit(item.name + " équipé.");
      }
    } else if (item.id === "booster-noel") {
      const start = state.boosters % stickerDeck.length;
      const cards = [stickerDeck[start], stickerDeck[(start + 1) % stickerDeck.length]];
      state.boosters += 1;
      state.quantities[item.id] -= 1;
      for (const card of cards) state.stickers[card] = (state.stickers[card] ?? 0) + 1;
      record("Booster ouvert · " + cards.join(" et "));
      commit();
      openDialog(`<h2 id="dialog-heading">Booster du réveillon</h2><canvas class="reward-art" width="340" height="190" data-art="booster-noel"></canvas>
        <p>Deux cartes rejoignent ton album de démonstration.</p><div class="booster-cards">${cards.map(card => `<strong>${esc(card)}</strong>`).join("")}</div>`);
    } else if (item.id === "vignette-renne") {
      state.keepsake = true;
      state.quantities[item.id] -= 1;
      record("Vignette du renne ajoutée à ta vitrine.");
      commit("La vignette du renne est dans ta vitrine.");
    } else {
      useDialog(item);
    }
  }

  function giftStatus(person, item) {
    if (state.gifts.some(gift => gift.to === person.name && gift.name === item.name)) return "Déjà offert";
    if (state.balance < item.price) return "Grelots insuffisants";
    return "";
  }

  function renderGifts() {
    find("#gifts-grid").innerHTML = recipients.map((person, index) => {
      const item = itemById.get(person.wish);
      const status = giftStatus(person, item);
      return `<article class="shop-card"><div class="item-art portrait"><canvas width="340" height="190" data-art="${item.art}"></canvas></div>
        <div class="item-body"><p class="item-category">${esc(person.team)}</p><h2>${esc(person.name)}</h2><p>Souhait · ${esc(item.name)}</p>
        <button class="button button-dark" data-action="gift" data-id="${index}" ${status ? "disabled" : ""}>${esc(status || "Offrir · " + price(item))}</button></div></article>`;
    }).join("");
    drawItems(find("#gifts-grid"));
    find("#gift-history").innerHTML = state.gifts.length ? `<div class="log"><h2>Cadeaux envoyés</h2>
      ${state.gifts.map(gift => `<div class="log-entry"><span>${esc(gift.name)}</span><strong>${esc(gift.to)}</strong></div>`).join("")}</div>` : "";
  }

  function renderFlight() {
    const run = state.runs[state.day];
    find("#flight-result").textContent = run
      ? `Tournée du ${dayLabel(state.day)} · ${run.deliveries}/14 livraisons · ${run.reward} Grelots crédités. Tu peux rejouer pour t’entraîner.`
      : "Une tournée récompensée par jour. Les livraisons de cette tournée comptent pour le sapin.";
  }

  function receiveFlight(event) {
    if (event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
    const payload = event.data;
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "noel:tournee-hauteur" && Number.isFinite(payload.height)) {
      frame.style.height = Math.max(310, Math.min(1000, payload.height + 3)) + "px";
    } else if (payload.type === "noel:tournee-demarree") {
      currentRunDay = state.day;
    } else if (payload.type === "noel:tournee-terminee") {
      const { score, deliveries } = payload;
      if (!Number.isInteger(score) || score < 0 || score > 7000 || !Number.isInteger(deliveries)
        || deliveries < 0 || deliveries > 14 || state.runs[currentRunDay]) return;
      const reward = Math.min(45, 8 + Math.floor(score / 110));
      state.runs[currentRunDay] = { score, deliveries, reward };
      state.balance += reward;
      state.deliveries += deliveries;
      record("Tournée · +" + reward + " Grelots", currentRunDay);
      const lights = deliveries === 1 ? "lumière ajoutée" : "lumières ajoutées";
      commit(`${reward} Grelots crédités · ${deliveries} ${lights} au sapin`);
    }
  }

  function openDialog(markup) {
    dialogBody.innerHTML = markup;
    drawItems(dialogBody);
    if (!dialog.open) dialog.showModal();
  }

  function drawItems(root) {
    all("[data-art]", root).forEach(canvas => window.drawNoelItem(canvas, canvas.dataset.art));
  }

  function onAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled) return;
    const { action, id } = button.dataset;
    const item = itemById.get(id);
    switch (action) {
      case "filter":
        shopFilter = id;
        renderShop();
        find(`[data-action="filter"][data-id="${id}"]`)?.focus();
        break;
      case "advent": showAdvent(Number(id)); break;
      case "claim-advent": claimAdvent(Number(id)); break;
      case "shop-item": showShopItem(item); break;
      case "buy": buy(item); break;
      case "inventory-item": inventoryAction(item); break;
      case "use-item": applyItem(item); break;
      case "claim-tree": {
        const milestone = milestones.find(entry => entry.goal === Number(id));
        if (!milestone || state.milestones.includes(milestone.goal) || 112 + state.deliveries < milestone.goal) return;
        state.milestones.push(milestone.goal);
        state.balance += milestone.reward;
        record("Sapin · +" + milestone.reward + " Grelots");
        commit("Palier du sapin récupéré · " + milestone.reward + " Grelots");
        break;
      }
      case "gift": {
        const person = recipients[Number(id)];
        if (!person) return;
        const gift = itemById.get(person.wish);
        if (giftStatus(person, gift)) return;
        state.balance -= gift.price;
        state.gifts.unshift({ to: person.name, name: gift.name });
        record("Atelier · " + gift.name + " offert à " + person.name);
        commit("Paquet envoyé à " + person.name + " dans le pilote.");
        break;
      }
    }
  }

  const date = find("#preview-day");
  date.innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${dayLabel(i + 1)}</option>`).join("");
  date.addEventListener("change", () => {
    state.day = Number(date.value);
    commit();
  });
  find("#reset-pilot").addEventListener("click", () => {
    if (!window.confirm("Réinitialiser l’inventaire et les récompenses du pilote ?")) return;
    state = fresh();
    currentRunDay = state.day;
    if (frame.hasAttribute("src")) frame.src = frame.dataset.src;
    commit("Pilote réinitialisé.");
  });
  document.addEventListener("click", onAction);
  window.addEventListener("hashchange", navigate);
  window.addEventListener("message", receiveFlight);
  navigate();
})();
