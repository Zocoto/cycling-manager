(() => {
  "use strict";
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const num = value => new Intl.NumberFormat("fr-FR").format(value);
  const colours = ["#ffe5a4", "#ff8f91", "#9de0bb", "#9ebef5", "#d6a7ef"];
  const contributionRewards = Object.freeze([
    { from: 1, to: 1, place: "1er", id: "cuissard-quatre-saisons", name: "Cuissard Quatre Saisons", type: "Cuissard", slot: "bib_shorts", effect: "Ignore les malus de notes liés à la météo", bonuses: {}, effects: { ignoreWeatherPenalties: true } },
    { from: 2, to: 3, place: "2e–3e", id: "cadre-traineau-renne", name: "Traîneau du renne en danseuse", type: "Cadre", slot: "frame", effect: "+3 END / RES / REC · +2 MON", bonuses: { endurance: 3, resistance: 3, recovery: 3, mountain: 2 } },
    { from: 4, to: 6, place: "4e–6e", id: "bonnet-course-noel", name: "Bonnet de course de Noël", type: "Casque", slot: "helmet", effect: "+2 MON · +2 RES", bonuses: { mountain: 2, resistance: 2 } },
    { from: 7, to: 10, place: "7e–10e", id: "gants-dernier-relais", name: "Gants du dernier relais", type: "Gants", slot: "gloves", effect: "+1 END · +1 REC", bonuses: { endurance: 1, recovery: 1 } },
  ]);
  function rankContributors(contributors) { return contributors.filter(entry=>entry&&typeof entry.id==="string"&&typeof entry.name==="string"&&Number.isSafeInteger(entry.lights)&&entry.lights>0&&Number.isSafeInteger(entry.rank)&&entry.rank>0).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id)); }
  function contributionPrize(rank) {
    return contributionRewards.find(reward => rank >= reward.from && rank <= reward.to) ?? null;
  }
  function renderContributors(contributors) {
    const ranked = rankContributors(contributors);
    const leaders = ranked.filter(entry => entry.rank <= 10);
    const current = ranked.find(entry => entry.isCurrent);
    const row = entry => `<tr${entry.isCurrent ? ' class="contributor-current" aria-current="true"' : ""}>
      <td class="contributor-rank">${entry.rank}</td><th scope="row"><span translate="no">${esc(entry.name)}</span>${entry.isCurrent ? '<span class="contributor-you">Toi</span>' : ""}</th><td class="contributor-lights">${num(entry.lights)}</td></tr>`;
    return `<section class="contribution-board" aria-labelledby="contributors-heading">
      <p class="contribution-eyebrow">Les éclaireurs du Peloton</p>
      <h2 id="contributors-heading">Top 10 des contributeurs</h2>
      <p class="contribution-explainer">Le cumul de toutes les lumières apportées depuis le 1er décembre et jusqu’à la clôture de l’événement, toutes tes tournées récompensées et tous tes Seconds tours compris. Les entraînements sans gains et le score du mini-jeu ne comptent pas. Les ex æquo du top 10 sont tous affichés.</p>

      ${leaders.length ? `<table class="contributor-table"><thead><tr><th scope="col">Rang</th><th scope="col">Directeur sportif</th><th scope="col">Lumières</th></tr></thead><tbody>${leaders.map(row).join("")}</tbody>
        ${current && !leaders.some(entry => entry.id === current.id) ? `<table class="contributor-table contributor-personal" aria-label="Ta contribution hors du top 10"><tbody>${row(current)}</tbody></table>` : ""}` : '<p class="contribution-empty">Le sapin attend ses premiers éclaireurs. Livre ton premier cadeau pour rejoindre le classement.</p>'}
      ${!current ? '<a class="contribution-join" href="#tournee">Apporter mes premières lumières →</a>' : ""}
      <details class="contribution-prizes" open><summary>Les cadeaux du top 10</summary>
        <p>Classement final du 31 décembre : un équipement exclusif de Noël par DS, conservé après l’événement. À égalité de lumières, même rang et même cadeau.</p>
        <ol>${contributionRewards.map(reward => `<li><span class="contribution-place">${reward.place}</span><div><strong>${esc(reward.name)}</strong><span>${reward.type} · ${reward.effect}</span></div></li>`).join("")}</ol>
        <p>Le Cuissard Quatre Saisons protège les notes de son porteur contre les malus météo ; les effets favorables restent actifs. Le bonnet-casque est réservé aux 4e–6e contributeurs : il ne fait plus partie des cadeaux communs du sapin.</p>
        <p>Les cadeaux sont attribués automatiquement après la clôture du classement.</p>
      </details>
    </section>`;
  }
  function point(t) {
    const y = 626 - t * 550;
    const x = 280 + Math.sin(t * Math.PI * 6) * (180 * (1 - t) + 3);
    return { x, y };
  }
  function garlandProgress(total, milestones) {
    const index = milestones.findIndex(milestone => total < milestone.goal);
    if (index < 0) return 1;
    const before = index ? milestones[index - 1].goal : 0;
    const after = milestones[index].goal;
    return (index + Math.max(0, (total - before) / (after - before))) / milestones.length;
  }
  function rewardLabel(milestone, itemById) {
    const pieces = milestone.grelots ? [`${milestone.grelots} Grelots`] : [];
    const counts = new Map();
    for (const item of milestone.items) counts.set(item, (counts.get(item) ?? 0) + 1);
    for (const [id, count] of counts) {
      const item = itemById.get(id);
      const name = id === "potential-notebook" ? "+1 étoile de potentiel · Carnet de progression" : item?.name ?? id;
      const stats = { mountain: "MON", hills: "VAL", flat: "PLA", timeTrial: "CLM", cobbles: "PAV", sprint: "SPR", acceleration: "ACC", descending: "DES", endurance: "END", resistance: "RES", recovery: "REC", prologue: "PRO", breakaway: "BAR" };
      const bonuses = item?.category === "equipment" ? Object.entries(item.bonuses ?? {})
        .filter(([stat, value]) => stats[stat] && Number.isFinite(value) && value !== 0)
        .map(([stat, value]) => `${value > 0 ? "+" : ""}${num(value)} ${stats[stat]}`) : [];
      pieces.push((count > 1 ? count + " × " : "") + name + (bonuses.length ? " · " + bonuses.join(" · ") : ""));
    }
    return pieces.join(" + ");
  }
  function draw({ total, milestones }) {
    const progress = garlandProgress(total, milestones);
    const path = Array.from({ length: 181 }, (_, i) => {
      const p = point(i / 180);
      return `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");
    const bulbs = Array.from({ length: 102 }, (_, i) => {
      const t = i / 101;
      const p = point(t);
      const lit = t <= progress && total > 0;
      return `<circle class="sapin-bulb${lit ? " is-lit" : ""}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${lit ? 4 : 3}" style="--bulb:${colours[i % colours.length]};--twinkle:${(i % 7) * .37}s"/>`;
    }).join("");
    const markers = milestones.map((milestone, i) => {
      const p = point((i + 1) / milestones.length);
      const unlocked = total >= milestone.goal;
      if (i === milestones.length - 1) return "";
      return `<g class="sapin-marker${unlocked ? " is-unlocked" : ""}"><circle cx="${p.x}" cy="${p.y}" r="13"/><text x="${p.x}" y="${p.y + 4}">${i + 1}</text><title>Palier ${i + 1} · ${num(milestone.goal)} lumières</title></g>`;
    }).join("");
    const starOn = progress === 1;
    return `<svg class="collective-sapin" viewBox="0 0 560 744" role="img" aria-labelledby="sapin-title sapin-description">
      <title id="sapin-title">Le sapin de tous les Directeurs Sportifs</title>
      <desc id="sapin-description">${num(total)} lumières communes. ${milestones.filter(m => total >= m.goal).length} paliers atteints sur ${milestones.length}. La guirlande s’allume du pied jusqu’à l’étoile. Rudolphe traverse le ciel à vélo, sa lanterne rouge au bout du nez.</desc>
      <defs><linearGradient id="sapin-night" x2="0" y2="1"><stop stop-color="#102c29"/><stop offset="1" stop-color="#20493e"/></linearGradient><linearGradient id="sapin-leaf" x2="1" y2="1"><stop stop-color="#468465"/><stop offset=".48" stop-color="#2f664c"/><stop offset="1" stop-color="#173e31"/></linearGradient></defs>
      <rect width="560" height="744" rx="18" fill="url(#sapin-night)"/>
      ${Array.from({ length: 35 }, (_, i) => `<circle cx="${(i * 107 + 17) % 560}" cy="${(i * 71 + 27) % 640}" r="${i % 3 ? 1 : 1.8}" fill="#f4e9cb" opacity=".35"/>`).join("")}
      <g class="sapin-rudolphe" aria-hidden="true" pointer-events="none">
        <path d="M26 210Q104 155 190 173T408 139" fill="none" stroke="#e6c788" stroke-width="1.5" stroke-dasharray="2 10" stroke-linecap="round" opacity=".4"/>
        <image href="rudolphe-lanterne-rouge.webp" x="355" y="42" width="195" height="176" preserveAspectRatio="xMidYMid meet"/>
      </g>
      <path d="M0 620L85 516L146 583L223 490L346 606L450 510L560 600V744H0Z" fill="#365c4d" opacity=".6"/>
      <path d="M0 693Q100 658 217 681T560 677V744H0Z" fill="#e8e8ce"/>
      <ellipse cx="280" cy="690" rx="175" ry="19" fill="#bbcbbc"/>
      <path d="M265 599H296V682H265Z" fill="#77533a"/>
      <path d="M280 70L212 215L241 210L170 342L209 330L119 469L158 456L69 633Q280 692 491 633L403 456L442 469L352 330L391 342L319 210L348 215Z" fill="url(#sapin-leaf)" stroke="#709c70" stroke-width="1.4"/>
      <g fill="none" stroke="#a2b88b" stroke-opacity=".23" stroke-width="2"><path d="M212 215Q280 248 348 215M170 342Q280 385 391 342M119 469Q280 529 442 469M69 633Q280 693 491 633"/><path d="M280 93V642"/></g>
      <path d="${path}" fill="none" stroke="#102f28" stroke-width="6"/>
      <path d="${path}" fill="none" stroke="#f1c66d" stroke-width="2" pathLength="100" stroke-dasharray="${progress * 100} 100"/>
      <g>${bulbs}${markers}</g>
      <g class="sapin-star${starOn ? " is-lit" : ""}"><path d="M280 45L290 65L313 69L296 85L301 108L280 96L259 108L264 85L247 69L270 65Z"/><text x="280" y="84">9</text><title>L’étoile · ${num(milestones[milestones.length - 1].goal)} lumières · +1 étoile de potentiel pour chaque DS</title></g>
      <g transform="translate(130 660)"><rect width="45" height="37" rx="3" fill="#8b3948"/><path d="M22 0V37M0 12H45" stroke="#efcf8b" stroke-width="5"/></g>
      <g transform="translate(369 658)"><rect width="53" height="43" rx="3" fill="#d8b566"/><path d="M26 0V43M0 12H53" stroke="#7b3744" stroke-width="6"/></g>
      <text x="280" y="725" fill="#e4d8bb" font-family="system-ui,sans-serif" font-size="12" text-anchor="middle">UN SEUL SAPIN · TOUT LE PELOTON</text>
    </svg>`;
  }
  function render({ art, panel, total, personal, participants, claimed, milestones, itemById, contributors = [] }) {
    const ceiling = milestones[milestones.length - 1].goal;
    const next = milestones.find(milestone => total < milestone.goal);
    art.innerHTML = draw({ total, milestones });
    panel.innerHTML = `<div class="collective-label"><span class="collective-dot"></span>Progression commune à tous les joueurs</div>
      <div class="tree-metric"><strong>${num(total)}</strong><span> / ${num(ceiling)} lumières</span></div>
      <p class="collective-caption">${num(participants)} DS réunis autour du même sapin. <strong>Chaque palier débloque sa récompense pour chaque participant au sapin.</strong></p>
      <div class="tree-how-it-works"><strong>Réussi : 1 lumière · Super : 2 · Parfait : 3</strong><p>C’est la qualité des cadeaux livrés, validée à la fin de ta tournée, qui allume la guirlande. Les lumières de chaque Second tour s’ajoutent elles aussi et restent acquises.</p><a href="#tournee">Faire grandir la guirlande →</a></div>
      <p class="personal-contribution">Ta contribution · <strong>${num(personal)} lumière${personal > 1 ? "s" : ""}</strong> apportée${personal > 1 ? "s" : ""} au sapin</p>
      <div class="tree-track" role="progressbar" aria-valuemax="${ceiling}" aria-valuemin="0" aria-valuenow="${Math.min(total, ceiling)}" aria-label="Lumières de tout le peloton"><span style="width:${Math.min(100, total / ceiling * 100)}%"></span></div>
      <p class="next-tree-goal">${next ? `${num(next.goal - total)} lumière${next.goal - total > 1 ? "s" : ""} avant le prochain palier` : "L’étoile brille pour tout le peloton !"}</p>
      <ol class="collective-milestones">${milestones.map((milestone, i) => {
        const unlocked = total >= milestone.goal;
        const collected = claimed.includes(milestone.goal);
        return `<li class="collective-milestone${unlocked ? " is-unlocked" : ""}${i === milestones.length - 1 ? " final-star" : ""}">
          <span class="milestone-index">${i === milestones.length - 1 ? "★" : i + 1}</span>
          <div><span class="milestone-goal">${num(milestone.goal)} lumières · pour chaque DS</span><h2>${esc(milestone.name)}</h2><p>${esc(rewardLabel(milestone, itemById))}</p></div>
          <button class="button button-outline" data-action="claim-tree" data-id="${milestone.goal}" ${collected || !unlocked ? "disabled" : ""}>${collected ? "Récupéré" : unlocked ? "Récupérer" : "À débloquer"}</button>
        </li>`;
      }).join("")}</ol><p class="tree-challenge">L’étoile est le défi ultime de décembre. Elle donne le Carnet de progression existant (+1 étoile entière, plafond 4 étoiles).</p>${renderContributors(contributors)}`;
  }
  globalThis.noelTree = Object.freeze({ render, rewardLabel, garlandProgress, rankContributors, contributionPrize, contributionRewards });
})();
