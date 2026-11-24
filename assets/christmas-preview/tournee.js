(() => {
      const root = document.getElementById("cyclo-winter-flight");
      const canvas = root.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const physics = globalThis.ChristmasFlightPhysics;
      const rules = globalThis.noelRules;
      if (!physics || !rules) return;

      const parentOrigin = window.location.origin === "null" ? "*" : window.location.origin;
      function notifyPilot(type, details = {}) {
        if (window.parent === window) return;
        window.parent.postMessage({ type, ...details }, parentOrigin);
      }

      const shell = document.querySelector("[data-flight-shell]");
      let markerScale = 1;
      const reportHeight = () => {
        const displayWidth = canvas.getBoundingClientRect().width;
        markerScale = Math.max(1, Math.min(3, 800 / (displayWidth || 800)));
        notifyPilot("noel:tournee-hauteur", { height: Math.ceil(shell.getBoundingClientRect().height) });
        if (game.mode !== "playing") draw();
      };
      if (typeof ResizeObserver === "function") new ResizeObserver(reportHeight).observe(shell);
      window.addEventListener("load", reportHeight, { once: true });

      const width = 800;
      const height = 400;
      const routeEnd = 6540;
      const courseSpeed = 236;
      const step = 1 / 120;
      const controlSpeed = 320;
      const dragThreshold = 7;
      const flightBounds = { left: 190, right: 708, top: 72, bottom: 211 };
      const parcelRadius = 5;
      const openingTolerance = 4;
      const dropLockDuration = 1.2;
      const releaseCooldown = .35;
      const route = [
        [625, 315, 58], [1010, 290, 49], [1430, 320, 40],
        [1820, 280, 54], [2240, 312, 33], [2640, 297, 46],
        [3040, 283, 28], [3470, 320, 41], [3900, 291, 31],
        [4320, 314, 52], [4730, 278, 26], [5150, 313, 32],
        [5550, 295, 40], [5990, 276, 24],
      ];
      const obstacles = [
        { kind: "geese", start: 2.4, y: 175, speed: 307, swing: 14 },
        { kind: "snowball", start: 4.25, y: 92, speed: 270, swing: 12, drift: 13 },
        { kind: "balloon", start: 6.2, y: 113, speed: 188, swing: 29 },
        { kind: "geese", start: 8.4, y: 148, speed: 324, swing: 16 },
        { kind: "snowball", start: 10.4, y: 200, speed: 285, swing: 10, drift: -35 },
        { kind: "balloon", start: 12.4, y: 220, speed: 195, swing: 25 },
        { kind: "geese", start: 14.4, y: 85, speed: 316, swing: 14 },
        { kind: "snowball", start: 16.3, y: 105, speed: 278, swing: 14, drift: 14 },
        { kind: "balloon", start: 18.1, y: 144, speed: 194, swing: 33 },
        { kind: "geese", start: 20.1, y: 184, speed: 332, swing: 14 },
        { kind: "snowball", start: 22.2, y: 194, speed: 290, swing: 10, drift: -16 },
        { kind: "geese", start: 24.2, y: 105, speed: 320, swing: 16 },
      ];
      const flock = [[0, 0], [23, -16], [39, 9]];
      const balloonOutline = Array.from({ length: 10 }, (_, i) => {
        const angle = i * Math.PI / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? 21 : 10;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius];
      });
      const primary = root.querySelector("[data-drop]");
      const status = root.querySelector("[data-status]");
      const gifts = root.querySelector("[data-gifts]");
      const streak = root.querySelector("[data-streak]");
      const scoreLabel = root.querySelector("[data-score]");
      const windLabel = root.querySelector("[data-wind]");
      const sleighLabel = root.querySelector("[data-sleigh]");
      const targetLabel = root.querySelector("[data-target]");
      const autoDrop = root.querySelector("[data-auto-drop]");
      const sniperControl = root.querySelector("[data-sniper-control]");
      const sniperStatus = root.querySelector("[data-sniper-status]");
      const progress = root.querySelector("[data-progress]");
      const progressBar = progress.firstElementChild;
      const summary = root.querySelector("[data-flight-summary]");
      const summaryTitle = root.querySelector("[data-summary-title]");
      const summaryDeliveries = root.querySelector("[data-summary-deliveries]");
      const summaryQualities = root.querySelector("[data-summary-qualities]");
      const summaryValues = root.querySelector("[data-summary-values]");
      const summaryGrelots = root.querySelector("[data-summary-grelots]");
      const summaryLights = root.querySelector("[data-summary-lights]");
      const summaryNote = root.querySelector("[data-summary-note]");
      const darkMode = matchMedia("(prefers-color-scheme: dark)");
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      function setTouchControls(isTouch) {
        shell.classList.toggle("is-touch", isTouch);
      }
      setTouchControls(matchMedia("(pointer: coarse)").matches);
      const keys = new Set();
      const direction = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1],
        KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
      };
      const stars = Array.from({ length: 75 }, (_, i) => ({
        x: (i * 97.43 + 28) % width,
        y: 11 + (i * 33.73) % 245,
        r: i % 13 === 0 ? 1.65 : .5 + (i % 5) * .15,
      }));
      const snow = Array.from({ length: 50 }, (_, i) => ({
        x: (i * 113.43 + 53) % width,
        y: (i * 47.3) % height,
        speed: 13 + (i % 7) * 3,
      }));
      let runSerial = 0;
      let sniperAvailable = 0;
      let game = newFlight();
      let pointer = null;
      let previousFrame = 0;
      let accumulator = 0;

      function newFlight() {
        const player = { x: 295, y: 143, vx: 0, vy: 0 };
        return {
          mode: "ready", time: 0, distance: 0,
          runId: "tournee-" + Date.now().toString(36) + "-" + (++runSerial).toString(36),
          summaryReceived: false,
          sniperRequested: false, sniperGranted: false,
          player,
          sleigh: physics.createSleigh(player),
          chimneys: route.map(([x, y, size]) => ({ x, y, size, outcome: "open" })),
          parcel: null, available: route.length, score: 0, streak: 0,
          deliveries: 0, flash: null, progress: -1,
          qualities: { successful: 0, super: 0, perfect: 0 },
          dropLockedUntil: 0, contactedObstacles: new Set(),
          nextReleaseAt: 0,
        };
      }

      function syncSniperControls() {
        const active = game.mode === "playing" && game.sniperGranted;
        sniperControl.hidden = !active && sniperAvailable === 0;
        autoDrop.disabled = game.mode === "playing" ? !active : sniperAvailable === 0;
        if (autoDrop.disabled) autoDrop.checked = false;
        sniperStatus.textContent = active
          ? "Lunette de sniper de cadeaux active pour cette tournée uniquement."
          : game.mode === "playing" ? "Lancer manuel pour cette tournée. Prépare ta lunette avant le prochain départ."
            : sniperAvailable > 0
              ? `${sniperAvailable} lunette${sniperAvailable > 1 ? "s" : ""} disponible${sniperAvailable > 1 ? "s" : ""} · coche l’option avant de décoller. Une lunette sera utilisée au départ.`
              : "Lancer manuel · la Lunette de sniper de cadeaux débloque le lancer automatique pour une tournée. Disponible à la boutique de Noël pour 10 Grelots.";
      }

      function readyForSniper() {
        autoDrop.checked = false;
        syncSniperControls();
        notifyPilot("noel:tournee-prete", { runId: game.runId });
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function windAt(distance) {
        return physics.getCourseWind(distance);
      }

      function syncHud() {
        if (gifts.textContent !== String(game.available)) gifts.textContent = String(game.available);
        if (streak.textContent !== String(game.streak)) streak.textContent = String(game.streak);
        if (scoreLabel && scoreLabel.textContent !== String(game.score)) scoreLabel.textContent = String(game.score);
        const wind = windAt(game.distance);
        const strength = Math.abs(wind);
        const breeze = strength < 85 ? "Brise variable" : strength < 170 ? "Vent variable" : "Rafale";
        const label = strength < 8 ? "Vent calme"
          : wind < 0 ? "← " + breeze : breeze + " →";
        if (windLabel.textContent !== label) windLabel.textContent = label;
        const stable = Math.hypot(game.sleigh.vx, game.sleigh.vy) < 65
          && Math.abs(game.sleigh.angle) < .065
          && Math.abs(game.sleigh.angularVelocity) < .2;
        const sleighState = stable ? "Traîneau stable" : "Traîneau en mouvement";
        if (sleighLabel.textContent !== sleighState) sleighLabel.textContent = sleighState;
        const lock = clamp(game.dropLockedUntil - game.time, 0, dropLockDuration);
        const reloading = game.nextReleaseAt > game.time;
        if (game.mode === "playing") {
          const action = lock > 0
            ? "Lancer bloqué · " + (Math.ceil(lock * 10) / 10).toFixed(1).replace(".", ",") + " s"
            : game.parcel ? "Cadeau en vol" : reloading ? "Préparation du cadeau…" : "Lâcher un cadeau";
          if (primary.textContent !== action) primary.textContent = action;
        }
        if ((lock > 0 || reloading || game.parcel) && game.mode === "playing") {
          if (!primary.hasAttribute("aria-disabled")) primary.setAttribute("aria-disabled", "true");
        } else if (primary.hasAttribute("aria-disabled")) {
          primary.removeAttribute("aria-disabled");
        }
        const completion = Math.floor(clamp(game.distance / routeEnd, 0, 1) * 100);
        if (completion !== game.progress) {
          game.progress = completion;
          progress.setAttribute("aria-valuenow", String(completion));
          progressBar.style.width = completion + "%";
        }
      }

      function launchState() {
        return physics.createParcel(game.sleigh, {
          distance: game.distance,
          courseSpeed,
          wind: windAt(game.distance),
        });
      }

      function parcelAt(parcel, time) {
        return physics.parcelAt(parcel, time);
      }

      function fallTime(parcel, targetY) {
        return physics.fallTime(parcel, targetY);
      }

      function findLanding(parcel) {
        let landing = null;
        for (const chimney of game.chimneys) {
          if (chimney.outcome !== "open" || chimney.y <= parcel.y) continue;
          const time = fallTime(parcel, chimney.y);
          if (landing && landing.time <= time) continue;
          const error = Math.abs(parcelAt(parcel, time).x - chimney.x);
          if (error <= chimney.size / 2 + openingTolerance) landing = { chimney, time, error };
        }
        return landing;
      }

      function precisionTargetX(chimney, time = game.time) {
        return chimney.x + rules.throwPrecisionOffset(time, chimney.size, chimney.x * .013);
      }

      function deliver(landing) {
        const { chimney, quality } = landing;
        for (const previous of game.chimneys) {
          if (previous === chimney) break;
          if (previous.outcome === "open") {
            previous.outcome = "missed";
            game.streak = 0;
          }
        }
        const base = chimney.size <= 33 ? 230 : chimney.size <= 46 ? 160 : 100;
        const grade = rules.throwQualities[quality];
        const earned = base + grade.bonus + Math.min(game.streak, 5) * 20;
        chimney.outcome = "delivered";
        game.score += earned;
        game.streak += 1;
        game.deliveries += 1;
        game.qualities[quality] += 1;
        game.flash = { x: chimney.x, y: chimney.y, at: game.time, quality, earned };
        game.parcel = null;
        status.textContent = `${grade.label} · +${earned} points · +${grade.lights} lumière${grade.lights > 1 ? "s" : ""}`;
      }

      function updateParcel() {
        const parcel = game.parcel;
        if (!parcel) return;
        parcel.age += step;
        const landing = parcel.landing;
        if (landing && parcel.age >= landing.time) {
          deliver(landing);
          return;
        }
        if (parcelAt(parcel, parcel.age).y > height + 8) {
          game.parcel = null;
          game.streak = 0;
          status.textContent = "Cadeau manqué · série interrompue";
        }
      }

      function updatePlayer() {
        const { player } = game;
        let x = 0;
        let y = 0;
        for (const key of keys) {
          x += direction[key][0];
          y += direction[key][1];
        }
        if (pointer) {
          const dx = pointer.x - player.x;
          const dy = pointer.y - player.y;
          x = dx * 14 / controlSpeed;
          y = dy * 14 / controlSpeed;
        }
        const norm = Math.max(1, Math.hypot(x, y));
        const nextX = clamp(player.x + x / norm * controlSpeed * step, flightBounds.left, flightBounds.right);
        const nextY = clamp(player.y + y / norm * controlSpeed * step, flightBounds.top, flightBounds.bottom);
        player.vx = (nextX - player.x) / step;
        player.vy = (nextY - player.y) / step;
        player.x = nextX;
        player.y = nextY;
      }

      function obstacleAt(obstacle, time) {
        const age = time - obstacle.start;
        const x = width + 165 - age * obstacle.speed;
        if (age < 0 || x < -85) return null;
        const phase = obstacle.kind === "geese" ? 3.1 : 2.15;
        const drift = obstacle.kind === "balloon" ? -age * 3 : age * (obstacle.drift ?? 0);
        return { x, y: obstacle.y + Math.sin(age * phase) * obstacle.swing + drift, age };
      }

      function updateObstacleHits() {
        const { player, sleigh, time } = game;
        const convoy = [
          { x: player.x + 49, y: player.y - 9 },
          { x: player.x + 3, y: player.y + 1 },
          { x: player.x - 43, y: player.y - 7 },
          { x: sleigh.x, y: sleigh.y },
        ];
        obstacles.forEach((obstacle, index) => {
          if (game.contactedObstacles.has(index)) return;
          const location = obstacleAt(obstacle, time);
          if (!location) return;
          const members = obstacle.kind === "geese" ? flock : [[0, 0]];
          const contact = members.some(([dx, dy]) => convoy.some((member) => (
            ((location.x + dx - member.x) / (obstacle.kind === "geese" ? 27 : obstacle.kind === "snowball" ? 24 : 32)) ** 2
            + ((location.y + dy - (member.y - 12)) / (obstacle.kind === "geese" ? 22 : obstacle.kind === "snowball" ? 22 : 26)) ** 2
          ) <= 1));
          if (!contact) return;
          game.contactedObstacles.add(index);
          if (game.dropLockedUntil > time) return;
          game.dropLockedUntil = time + dropLockDuration;
          status.textContent = obstacle.kind === "geese"
            ? "Oie heurtée · lancer suspendu"
            : obstacle.kind === "snowball" ? "Boule de neige heurtée · lancer suspendu"
              : "Ballon heurté · lancer suspendu";
        });
      }

      function tick() {
        const wasLocked = game.dropLockedUntil > game.time;
        game.time += step;
        game.distance += courseSpeed * step;
        if (wasLocked && game.dropLockedUntil <= game.time) status.textContent = "Lancer de nouveau disponible";
        updatePlayer();
        physics.updateSleigh(game.sleigh, game.player, step);
        updateObstacleHits();
        if (game.sniperGranted && autoDrop.checked && canRelease()) {
          const parcel = launchState();
          const landing = findLanding(parcel);
          // Use the same ballistic landing and opening as a manual throw.
          // Wait for a centred opening rather than spending a gift on its edge.
          if (landing && landing.error <= Math.max(2, (landing.chimney.size / 2 - parcelRadius) / 2)) {
            releaseParcel(parcel, landing);
          }
        }
        updateParcel();
        for (const chimney of game.chimneys) {
          if (chimney.outcome === "open" && chimney.x < game.distance + 12
            && game.parcel?.landing?.chimney !== chimney) {
            chimney.outcome = "missed";
            game.streak = 0;
          }
        }
        if (game.distance < routeEnd) return;
        game.mode = "finished";
        game.sniperGranted = false;
        keys.clear();
        pointer = null;
        primary.textContent = "Rejouer";
        status.textContent = game.deliveries + "/14 cadeaux livrés";
        summary.hidden = false;
        summary.scrollTop = 0;
        summaryTitle.textContent = "Tournée terminée";
        summaryDeliveries.textContent = game.deliveries + "/14 cadeaux livrés · " + game.score + " points";
        if (summaryQualities) summaryQualities.textContent = Object.entries(game.qualities)
          .map(([quality, count]) => `${rules.throwQualities[quality].label} : ${count}`).join(" · ");
        summaryValues.hidden = true;
        summaryNote.textContent = "Bilan en cours…";
        notifyPilot("noel:tournee-terminee", { runId: game.runId, score: game.score, deliveries: game.deliveries, qualities: { ...game.qualities } });
        readyForSniper();
      }

      function line(points, color, size) {
        ctx.beginPath();
        points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }

      function shape(points, color) {
        ctx.beginPath();
        points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      function ellipse(x, y, rx, ry, color, angle = 0) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      function drawSky(dark) {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, dark ? "#112743" : "#214265");
        sky.addColorStop(.64, dark ? "#234b62" : "#4e7490");
        sky.addColorStop(1, dark ? "#567c85" : "#8fafbc");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(636, 100, 3, 636, 100, 67);
        glow.addColorStop(0, "#fff0b735");
        glow.addColorStop(1, "#fff0b700");
        ctx.fillStyle = glow;
        ctx.fillRect(569, 33, 134, 134);
        for (const star of stars) ellipse(star.x, star.y, star.r, star.r, "#ecf5f3ad");
        shape([[636, 82], [639, 97], [650, 100], [639, 103], [636, 118],
          [633, 103], [622, 100], [633, 97]], "#ffe8b5");
        const drift = game.distance * .10 % 330;
        for (let x = -175 - drift; x < width + 160; x += 330) {
          ellipse(x + 58, 204, 79, 10, "#b4d3e21a", -.03);
          ellipse(x + 24, 214, 91, 6, "#b4d3e220", -.04);
          ellipse(x + 144, 150, 53, 4, "#dceef321", -.025);
        }
        const wind = windAt(game.distance);
        const extension = Math.min(1, Math.abs(wind) / 235);
        const direction = wind < 0 ? -1 : 1;
        const flutter = Math.sin(game.time * 3) * extension * 3;
        line([[750, 31], [750, 64]], "#e5d6b3", 2);
        const tip = 750 + direction * (9 + extension * 28);
        shape([[750, 32], [tip, 37 + flutter], [tip, 43 + flutter], [750, 46]], "#e9b78b");
        line([[750 + (tip - 750) * .4, 34], [750 + (tip - 750) * .4, 45]], "#fff1d4", 3);
      }

      function drawLantern(x, y) {
        const glow = ctx.createRadialGradient(x, y + 8, 2, x, y + 8, 49);
        glow.addColorStop(0, "#ffdc8e71");
        glow.addColorStop(.35, "#ffc56c42");
        glow.addColorStop(1, "#ffbc6100");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 49, y - 41, 98, 98);
        line([[x, height + 4], [x, y + 16]], "#28404d", 4);
        shape([[x - 8, y], [x + 8, y], [x + 5, y + 15], [x - 5, y + 15]], "#ffda8b");
        line([[x - 8, y + 1], [x - 5, y + 16], [x + 5, y + 16], [x + 8, y + 1]], "#384552", 2.4);
        line([[x - 10, y + 1], [x, y - 6], [x + 10, y + 1], [x - 10, y + 1]], "#344654", 2.7);
        line([[x - 7, y - 1], [x, y - 6], [x + 6, y - 2]], "#e9f3f5", 2);
      }

      function drawVillageBehind() {
        const roofDistance = game.distance * .84;
        const firstRoof = Math.floor((roofDistance - 168) / 172);
        for (let index = firstRoof; index < firstRoof + 8; index++) {
          const x = 23 + index * 172 - roofDistance;
          if (x < -135 || x > width + 70) continue;
          const peak = 345 + Math.sin(index * 1.83) * 8;
          drawHouseRoof(x, peak, 387, index, false);
        }
        const firstLamp = Math.floor((game.distance - 145) / 218);
        for (let index = firstLamp; index < firstLamp + 7; index++) {
          const x = 102 + index * 218 - game.distance;
          if (x > -49 && x < width + 49) drawLantern(x, 373 + Math.cos(index * 1.37) * 4);
        }
      }

      function drawRoofLights(left, right, y) {
        const lights = ["#ffce86", "#f3a097", "#a4dfba", "#ffe7aa"];
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.quadraticCurveTo((left + right) / 2, y + 10, right, y);
        ctx.strokeStyle = "#344347";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let i = 1; i < 10; i++) {
          const fraction = i / 10;
          const x = left + (right - left) * fraction;
          const bulbY = y + 20 * fraction * (1 - fraction);
          ellipse(x, bulbY + 2, 5, 5, "#ffd58832");
          ellipse(x, bulbY + 2, 2.2, 2.7, lights[i % lights.length]);
        }
      }

      function drawHouseRoof(x, peak, eave, index, foreground) {
        const span = foreground ? 78 : 57;
        const left = x - span;
        const right = x + span;
        const facades = ["#52646c", "#765c60", "#4f6c68", "#59606e"];
        const tiles = ["#354d5e", "#524653", "#364c55", "#465269"];
        const variant = (index % tiles.length + tiles.length) % tiles.length;
        const ridge = span * [.44, .53, .40, .49][variant];
        const slope = eave - peak;

        ctx.fillStyle = foreground ? facades[variant] : "#526e79";
        ctx.fillRect(left + 7, eave, right - left - 14, height - eave + 2);
        const windowWidth = foreground ? 15 : 10;
        for (const offset of [-span * .46, span * .46]) {
          const windowX = x + offset - windowWidth / 2;
          const windowY = eave + 5;
          ctx.fillStyle = "#384c56";
          ctx.fillRect(windowX - 2, windowY - 2, windowWidth + 4, 14);
          ctx.fillStyle = foreground ? "#f6d599" : "#dbbf8b";
          ctx.fillRect(windowX, windowY, windowWidth, 10);
          line([[x + offset, windowY], [x + offset, windowY + 10]], "#6d6d66", 1.3);
        }

        shape([[left, eave], [x - ridge, peak], [x + ridge, peak], [right, eave]],
          foreground ? tiles[variant] : "#3a5667");
        const rows = foreground ? 6 : 4;
        for (let row = 1; row <= rows; row++) {
          const fraction = row / (rows + 1);
          const half = ridge + (span - ridge) * fraction - 2;
          const y = peak + slope * fraction;
          line([[x - half, y], [x + half, y]], "#b1cbd258", 1.1);
          for (let joint = x + (row % 2 ? 9 : 0) - 72; joint < x + half; joint += 18) {
            if (joint > x - half) {
              line([[joint, y], [joint, y + slope / (rows + 1)]], "#162c3f62", .8);
            }
          }
        }
        const snowEdge = ridge + (span - ridge) * .33;
        shape([[x - snowEdge, peak + slope * .34], [x - ridge - 2, peak - 3],
          [x - ridge * .45, peak - 5], [x + ridge * .48, peak - 4], [x + ridge + 2, peak - 3],
          [x + snowEdge, peak + slope * .34], [x + ridge * .78, peak + slope * .21],
          [x + ridge * .42, peak + slope * .28], [x - ridge * .12, peak + slope * .18],
          [x - ridge * .59, peak + slope * .26]], foreground ? "#e8f2f2" : "#c6dce3");
        line([[left - 2, eave - 1], [x - ridge, peak - 2], [x + ridge, peak - 2],
          [right + 2, eave - 1]], "#c6dce2", foreground ? 3.8 : 2.5);
        line([[left - 5, eave + 1], [right + 5, eave + 1]], "#293e4d", foreground ? 4 : 2.8);
        if (foreground) drawRoofLights(left + 6, right - 6, eave - 4);
      }

      function drawRoof(chimney, index) {
        const x = chimney.x - game.distance;
        if (x < -160 || x > width + 135) return;
        const peak = chimney.y + 20 + index % 3 * 4;
        const roofX = x + (index % 2 === 0 ? -8 : 8);
        drawHouseRoof(roofX, peak, 382, index, true);
        const half = chimney.size / 2;
        const body = half + 4;
        ctx.fillStyle = index % 2 ? "#89566a" : "#a76b69";
        ctx.fillRect(x - body, chimney.y, body * 2, peak - chimney.y + 15);
        ctx.fillStyle = "#442e5073";
        ctx.fillRect(x + half - 4, chimney.y, 8, peak - chimney.y + 15);
        for (let row = chimney.y + 10; row < peak + 15; row += 9) {
          line([[x - body, row], [x + body, row]], "#e4a39f5f", 1);
          line([[x + (row % 2 ? -8 : 8), row - 7], [x + (row % 2 ? -8 : 8), row]], "#e4a39f5f", 1);
        }
        const target = chimney.outcome === "delivered" ? "#f1c879" : "#e5dce5";
        ctx.fillStyle = target;
        ctx.fillRect(x - half - 5, chimney.y - 4, chimney.size + 10, 8);
        ctx.fillStyle = "#272333";
        ctx.fillRect(x - half, chimney.y - 4, chimney.size, 6);
        line([[x - half, chimney.y + 1], [x + half, chimney.y + 1]], target, 2);
        if (chimney.outcome === "delivered") {
          ellipse(x, chimney.y - 2, half + 13, 9, "#ffdc8c24");
          line([[x - 7, chimney.y - 15], [x - 2, chimney.y - 10], [x + 8, chimney.y - 21]], "#ffe1a3", 3);
        }
      }

      function drawGoose(x, y, age) {
        const wing = Math.sin(age * 24) * 11;
        ctx.save();
        ctx.translate(x, y);
        ellipse(2, 2, 14, 7, "#c6d8dd", .12);
        ellipse(1, 0, 12, 5, "#f0efdf", .12);
        shape([[11, -1], [22, -3], [17, 4], [9, 5]], "#c7dadc");
        shape([[-3, 0], [2, wing - 5], [19, wing - 10], [14, wing - 2], [5, 4]], "#e6ebde");
        line([[8, wing - 4], [15, wing - 7]], "#9bb6c0", 1.3);
        line([[-8, 2], [-14, -3], [-19, -3]], "#efefdb", 5);
        ellipse(-21, -3, 4.1, 3.5, "#e8edde");
        shape([[-23, -5], [-30, -3], [-23, -1]], "#f3b872");
        ellipse(-22, -4, 1.1, 1.1, "#253e4c");
        ctx.restore();
      }

      function drawBalloon(x, y, age) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(age * 3) * .19);
        line([[0, 11], [4, 25], [-2, 38], [4, 47]], "#f8ddb0", 1.6);
        line([[2, 18], [12, 25], [6, 34], [13, 40]], "#f5afaa", 2);
        shape(balloonOutline, "#e19088");
        shape([[0, -16], [4, -5], [15, -5], [7, 1], [10, 12], [0, 6],
          [-10, 12], [-7, 1], [-15, -5], [-4, -5]], "#eead93");
        line([[-9, -4], [-4, -4], [-1, -12]], "#ffe1b1", 2);
        ctx.restore();
      }

      function drawSnowball(x, y, age) {
        ctx.save();
        ctx.translate(x, y);
        line([[19, -3], [37, -7]], "#d8eff67d", 2);
        line([[22, 4], [32, 6]], "#d8eff650", 1.5);
        ellipse(0, 0, 16, 16, "#afc9dc");
        ellipse(-2, -3, 14, 13, "#edf7f5");
        ellipse(-5, -7, 6, 3, "#fffdf0", -.4);
        ctx.rotate(age * 2);
        for (const [dx, dy] of [[5, -6], [-7, 3], [5, 7]]) {
          ellipse(dx, dy, 1.5, 1.5, "#90afc7");
        }
        ctx.restore();
      }

      function drawObstacles() {
        for (const obstacle of obstacles) {
          const location = obstacleAt(obstacle, game.time);
          if (!location) continue;
          const { x, y, age } = location;
          if (x > width + 38) {
            line([[width - 15, y - 7], [width - 23, y], [width - 15, y + 7]], "#ffe0a6", 2.5);
          } else if (obstacle.kind === "geese") {
            flock.forEach(([dx, dy], i) => drawGoose(x + dx, y + dy, age - i * .05));
          } else if (obstacle.kind === "snowball") {
            drawSnowball(x, y, age);
          } else {
            drawBalloon(x, y, age);
          }
        }
      }

      function drawBike(x, y, index) {
        const { player, time } = game;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(.79, .79);
        ctx.rotate(clamp(player.vy / 1900, -.12, .12));
        if (game.dropLockedUntil > time) {
          ellipse(0, -12, 43, 41, "#ffdb9223");
          line([[-38, -30], [-34, -35], [-33, -42]], "#ffe1a7", 2);
          line([[37, -37], [42, -40], [45, -46]], "#ffe1a7", 2);
        }
        for (const x of [-23, 25]) {
          ellipse(x, 10, 13, 13, "#172744");
          ellipse(x, 10, 10, 10, "#c4d5eb");
          ellipse(x, 10, 8.5, 8.5, "#34415d");
          const turn = time * 9 + index * 1.4;
          for (let spoke = 0; spoke < 6; spoke++) {
            const angle = spoke * Math.PI / 3 + turn;
            line([[x, 10], [x + Math.cos(angle) * 8, 10 + Math.sin(angle) * 8]], "#a4bcd5", .8);
          }
        }
        line([[-23, 10], [-13, -9], [-1, 11], [-23, 10], [-13, -9], [15, -8], [-1, 11]], "#f29479", 2.5);
        line([[25, 10], [15, -8], [18, -14], [23, -14]], "#f3c18f", 2.4);
        line([[-18, -10], [-10, -10]], "#252c41", 3);
        const pedal = [Math.cos(time * 9 + index * 1.4) * 4 - 1, Math.sin(time * 9 + index * 1.4) * 4 + 10];
        line([[-12, -13], [1, -3], pedal], "#9a5d51", 5);
        line([pedal, [pedal[0] + 4, pedal[1]]], "#33283b", 4);
        ellipse(-7, -19, 13, 8, "#a87560", -.38);
        ellipse(2, -23, 11, 5, "#d19b71", -.35);
        line([[3, -23], [11, -16], [19, -14]], "#aa775f", 4);
        shape([[2, -25], [-18, -29], [-30, -23], [-13, -24], [3, -21]], ["#f3857c", "#79aa9c", "#e3bd75"][index]);
        ellipse(10, -30, 9, 9, "#c28e69", -.24);
        ellipse(17, -29, 6, 4, "#f0ba83");
        ellipse(22, -30, 2.8, 2.5, "#f68b7a");
        ellipse(14, -34, 1.4, 1.6, "#2f253b");
        ellipse(4, -35, 4.5, 2.2, "#e8b487", .5);
        line([[8, -37], [4, -46], [7, -54]], "#f6c592", 2);
        line([[4, -46], [0, -48], [-2, -52]], "#f6c592", 1.6);
        line([[13, -37], [13, -46], [16, -52]], "#f6c592", 2);
        line([[13, -46], [18, -46], [21, -49]], "#f6c592", 1.6);
        ellipse(-22, -17, 7, 6, "#457d76", -.2);
        line([[-26, -19], [-18, -15]], "#cbd9ad", 1.8);
        ctx.restore();
      }

      function drawRudolphe() {
        // Rudolphe rides inside the sleigh's rotating coordinate frame.
        // His taller antlers and lantern are decorative: the cargo hatch,
        // parcel outlet and all convoy collision points remain unchanged.
        ellipse(17, -16, 13, 17, "#a43745", -.12);
        ellipse(14, -20, 10, 12, "#cc4e53", -.12);
        line([[9, -8], [28, -8]], "#f0d18d", 3);
        line([[11, -24], [21, -24]], "#f7e6c7", 4);
        line([[24, -26], [29, -21], [37, -21]], "#b64048", 6);
        ellipse(37, -21, 4, 3, "#754a38");
        line([[38, -21], [49, -9]], "#dfc18a", 1.2);

        // Two branching antlers and oversized ears keep the reindeer
        // silhouette readable when the canvas is reduced on a phone.
        line([[9, -51], [3, -61], [5, -76]], "#e5bd82", 3.4);
        line([[3, -61], [-5, -66], [-8, -74]], "#e5bd82", 2.5);
        line([[5, -69], [12, -73], [14, -79]], "#e5bd82", 2.3);
        line([[19, -52], [23, -64], [21, -77]], "#d6a972", 3.4);
        line([[23, -64], [31, -69], [33, -76]], "#d6a972", 2.5);
        line([[22, -70], [16, -73]], "#d6a972", 2.3);
        ellipse(1, -49, 8, 4.2, "#a66d47", .5);
        ellipse(1, -49, 5.4, 2.2, "#e5b47c", .5);
        ellipse(27, -49, 7.6, 3.8, "#a66d47", -.55);
        ellipse(27, -49, 5, 2, "#e5b47c", -.55);
        ellipse(15, -42, 12, 13, "#a97049", -.12);
        ellipse(19, -37, 11, 8, "#d6a36f", -.15);
        ellipse(26, -36, 10, 6.5, "#efd1a0", -.08);

        // A jaunty cycle helmet, raised eyebrow and smile give him the
        // game's familiar illustrated rider expression rather than a beard.
        shape([[3, -51], [7, -58], [20, -59], [27, -53], [24, -49], [7, -49]], "#a83242");
        line([[10, -56], [16, -57]], "#efce82", 2);
        line([[19, -56], [23, -53]], "#efce82", 2);
        line([[5, -50], [25, -50]], "#f3dfb9", 2);
        ellipse(20, -44, 3, 3.5, "#fff3d8");
        ellipse(21, -44, 1.6, 2.1, "#302a37");
        ellipse(21.5, -45, .55, .7, "#fff8e9");
        line([[17, -49], [22, -50]], "#69422f", 1.8);
        line([[20, -32], [25, -30], [29, -32]], "#7a4634", 1.5);
        ellipse(14, -33, 3, 1.8, "#c37a59", -.15);

        // A little red cycling lantern really is his nose, with a gold
        // cage and handle; the broad soft halo also reads at mobile size.
        ellipse(36, -39, 13, 11, "#ed65552b");
        ellipse(36, -39, 8.5, 7.5, "#fb8b6c30");
        line([[33, -45], [33, -49], [39, -49], [39, -45]], "#e6be78", 1.5);
        shape([[31, -45], [41, -45], [42, -34], [30, -34]], "#873540");
        shape([[33, -43], [39, -43], [40, -36], [32, -36]], "#f86460");
        line([[36, -43], [36, -36]], "#ffc194", 1);
        line([[31, -45], [41, -45]], "#edca88", 2);
        line([[30, -34], [42, -34]], "#edca88", 2);
        ellipse(34, -41, 1.2, 1.8, "#ffe2a6", .2);
      }

      function drawConvoy() {
        const { player, sleigh, time } = game;
        const bikes = [
          { x: player.x + 49, y: player.y - 9 },
          { x: player.x + 3, y: player.y + 1 },
          { x: player.x - 43, y: player.y - 7 },
        ];
        const noseX = sleigh.x + Math.cos(sleigh.angle) * 31;
        const noseY = sleigh.y + Math.sin(sleigh.angle) * 31 - 4;
        ctx.beginPath();
        ctx.moveTo(noseX, noseY);
        ctx.quadraticCurveTo((noseX + bikes[2].x) / 2, noseY + 8, bikes[2].x - 18, bikes[2].y - 3);
        ctx.strokeStyle = "#d5b576";
        ctx.lineWidth = 1.7;
        ctx.stroke();
        for (let index = 0; index < bikes.length - 1; index++) {
          line([[bikes[index + 1].x + 19, bikes[index + 1].y - 5],
            [bikes[index].x - 19, bikes[index].y - 3]], "#d5b576", 1.7);
        }
        // The cargo and its hatch rotate together. The outlet used for physics
        // is the same point as the visible gold opening under the gift pile.
        ctx.save();
        ctx.translate(sleigh.x, sleigh.y);
        ctx.rotate(sleigh.angle);
        ellipse(-4, 18, 42, 4, "#f8de9e22");
        line([[-34, 15], [-27, 20], [29, 20], [38, 15], [41, 7]], "#e9c783", 3);
        line([[-22, 8], [-21, 17]], "#d1a965", 3);
        line([[19, 7], [21, 17]], "#d1a965", 3);
        shape([[-35, -9], [-29, -15], [-21, -14], [-17, -7], [22, -7],
          [29, -17], [35, -18], [32, 4], [25, 11], [-23, 11], [-30, 6]], "#9f4651");
        line([[-30, -12], [-24, -10], [-19, -3], [25, -3], [32, -14]], "#f3d190", 2.3);
        line([[-21, 9], [24, 9]], "#d9b373", 1.7);
        for (const gift of [
          { x: -21, y: -26, color: "#779c88", ribbon: "#f4d392" },
          { x: -8, y: -32, color: "#d48a71", ribbon: "#fff0bb" },
          { x: 6, y: -23, color: "#71919e", ribbon: "#efd49b" },
        ]) {
          ctx.fillStyle = gift.color;
          ctx.fillRect(gift.x, gift.y, 15, 18);
          line([[gift.x + 7, gift.y], [gift.x + 7, gift.y + 17]], gift.ribbon, 2);
          line([[gift.x, gift.y + 5], [gift.x + 15, gift.y + 5]], gift.ribbon, 1.7);
          ellipse(gift.x + 4, gift.y - 1, 4, 2, gift.ribbon, .3);
          ellipse(gift.x + 10, gift.y - 1, 4, 2, gift.ribbon, -.3);
        }
        drawRudolphe();
        ctx.fillStyle = "#472a37";
        ctx.fillRect(-2, 3, 14, 7);
        line([[-3, 3], [13, 3]], "#f0cd86", 2);
        if (!game.parcel && game.available > 0) {
          ctx.fillStyle = "#e58280";
          ctx.fillRect(1, 4, 8, 5);
          line([[5, 4], [5, 9]], "#ffe7a6", 1.3);
        }
        ellipse(-29, -9, 3.5, 3.5, "#f1d58e");
        ellipse(-29, -9, 7 + Math.sin(time * 2) * .6, 7, "#f1d58e20");
        ctx.restore();
        bikes.forEach((bike, index) => drawBike(bike.x, bike.y, index));
      }

      function drawParcel() {
        const parcel = game.parcel;
        if (!parcel) return;
        const point = parcelAt(parcel, parcel.age);
        ctx.save();
        ctx.translate(point.x - game.distance, point.y);
        ctx.rotate(.35 + parcel.age * 3);
        ctx.fillStyle = "#e58280";
        ctx.fillRect(-6, -6, 12, 12);
        line([[-6, -1], [6, -1]], "#ffe7a6", 2);
        line([[0, -6], [0, 6]], "#ffe7a6", 2);
        ctx.restore();
      }

      function drawTargetGuide() {
        if (game.mode === "finished") {
          if (targetLabel) {
            targetLabel.textContent = "Tournée terminée";
            targetLabel.classList.toggle("is-aligned", false);
          }
          return;
        }
        const parcel = game.parcel || launchState();
        const landing = game.parcel ? parcel.landing : findLanding(parcel);
        let target = null;
        for (const chimney of game.chimneys) {
          const x = chimney.x - game.distance;
          if (chimney.outcome !== "open" || chimney.y <= parcel.y || x < 8 || x > width - 8) continue;
          const time = fallTime(parcel, chimney.y);
          if (time < (parcel.age || 0)) continue;
          const point = parcelAt(parcel, time);
          const error = Math.abs(point.x - chimney.x);
          if (!target || error < target.error) target = { chimney, point, time, error };
        }
        if (!target) return;
        const aligned = landing?.chimney === target.chimney;
        const precisionX = game.parcel && aligned ? landing.precisionX : precisionTargetX(target.chimney);
        const quality = aligned
          ? game.parcel ? landing.quality : rules.classifyThrow(Math.abs(target.point.x - precisionX), target.chimney.size)
          : null;
        const locked = game.dropLockedUntil > game.time || game.nextReleaseAt > game.time;
        const colour = locked ? "#f0b3b5" : quality === "perfect" ? "#ffe18d" : aligned ? "#b5ffd0" : "#a9e4ff";
        const s = markerScale;
        const x = target.point.x - game.distance;
        const y = target.chimney.y;
        const chimneyX = target.chimney.x - game.distance;
        const precisionMarkerX = precisionX - game.distance;
        ctx.save();
        // One shared ballistic guide: it displays the actual throw and never
        // changes its direction or the collision tolerance on either device.
        const age = parcel.age || 0;
        for (let index = 1; index <= 9; index++) {
          const t = age + (target.time - age) * index / 10;
          const point = parcelAt(parcel, t);
          ellipse(point.x - game.distance, point.y, 1.8 * s, 1.8 * s, colour + "99");
        }
        line([[chimneyX - target.chimney.size / 2, y - 2], [chimneyX + target.chimney.size / 2, y - 2]], aligned ? "#b5ffd0" : "#ffe6a3", 3 * s);
        // The gold marker moves inside the opening; the crosshair and dotted
        // trajectory still show the real ballistic landing, without assistance.
        shape([[precisionMarkerX - 5 * s, y - 24 * s], [precisionMarkerX + 5 * s, y - 24 * s], [precisionMarkerX, y - 17 * s]], "#ffe6a3");
        shape([[precisionMarkerX - 4 * s, y], [precisionMarkerX, y - 4 * s], [precisionMarkerX + 4 * s, y], [precisionMarkerX, y + 4 * s]], "#ffe6a3");
        if (x > -30 && x < width + 30) {
          ctx.beginPath();
          ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
          ctx.strokeStyle = "#102a3f"; ctx.lineWidth = 6 * s; ctx.stroke();
          ctx.strokeStyle = colour; ctx.lineWidth = 2 * s; ctx.stroke();
          line([[x - 18 * s, y], [x - 5 * s, y]], colour, 2 * s);
          line([[x + 5 * s, y], [x + 18 * s, y]], colour, 2 * s);
          line([[x, y - 18 * s], [x, y - 5 * s]], colour, 2 * s);
          line([[x, y + 5 * s], [x, y + 18 * s]], colour, 2 * s);
          ellipse(x, y, 2.8 * s, 2.8 * s, colour);
        }
        ctx.restore();
        const label = game.parcel ? "Cadeau en vol" : locked ? "Lancer suspendu"
          : aligned ? rules.throwQualities[quality].label + (game.sniperGranted && autoDrop.checked ? " · envoi automatique" : " · lance !")
            : x < chimneyX ? "Le viseur est à gauche de la cheminée" : "Le viseur est à droite de la cheminée";
        if (targetLabel && targetLabel.textContent !== label) targetLabel.textContent = label;
        if (targetLabel) targetLabel.classList.toggle("is-aligned", aligned && !locked && !game.parcel);
      }

      function draw() {
        const scheme = getComputedStyle(root).colorScheme;
        drawSky(scheme === "dark" || (scheme !== "light" && darkMode.matches));
        drawVillageBehind();
        game.chimneys.forEach(drawRoof);
        if (!reducedMotion.matches) {
          const breeze = windAt(game.distance);
          for (const flake of snow) {
            const x = (flake.x + width * 4 + game.time * (breeze * .12 - 18)) % width;
            const y = (flake.y + game.time * flake.speed) % height;
            ellipse(x, y, flake.speed > 22 ? 1.8 : 1.1, 1.15, "#f1eafa83");
          }
        }
        drawTargetGuide();
        drawObstacles();
        drawConvoy();
        drawParcel();
        if (game.flash) {
          const age = game.time - game.flash.at;
          if (age < .85) {
            ctx.globalAlpha = 1 - age / 1.2;
            ctx.fillStyle = "#ffe6a6";
            ctx.font = "500 28px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${rules.throwQualities[game.flash.quality].label} +${game.flash.earned}`, game.flash.x - game.distance, game.flash.y - 26 - age * 30);
            ctx.globalAlpha = 1;
          }
        }
      }

      function frame(now) {
        if (game.mode !== "playing") return;
        accumulator += Math.min(.08, (now - previousFrame) / 1000);
        previousFrame = now;
        while (accumulator >= step && game.mode === "playing") {
          tick();
          accumulator -= step;
        }
        draw();
        syncHud();
        if (game.mode === "playing") requestAnimationFrame(frame);
      }

      function act() {
        if (game.mode !== "playing") {
          const requestedSniper = autoDrop.checked && sniperAvailable > 0;
          game = newFlight();
          game.mode = "playing";
          game.sniperRequested = requestedSniper;
          summary.hidden = true;
          // Automatic throwing starts only after the parent confirms consuming
          // one owned consumable for this exact run. Manual play never waits.
          syncSniperControls();
          notifyPilot("noel:tournee-demarree", { runId: game.runId, sniper: requestedSniper });
          previousFrame = performance.now();
          accumulator = 0;
          status.textContent = game.sniperGranted && autoDrop.checked
            ? "Dirige le traîneau : les cadeaux partent quand le viseur est aligné"
            : "Stabilise le traîneau, puis livre les 14 cheminées";
          primary.textContent = "Lâcher un cadeau";
          primary.focus({ preventScroll: true });
          draw();
          syncHud();
          requestAnimationFrame(frame);
          return;
        }
        if (!canRelease()) return;
        releaseParcel(launchState());
        syncHud();
      }

      function canRelease() {
        return game.mode === "playing" && !game.parcel && game.available > 0
          && game.dropLockedUntil <= game.time && game.nextReleaseAt <= game.time;
      }

      function releaseParcel(parcel, landing = findLanding(parcel)) {
        // Precision is decided at release, never by a later movement of the
        // marker while the gift is in flight. Physical hit detection is intact.
        const precisionX = landing ? precisionTargetX(landing.chimney) : null;
        const precisionError = landing ? Math.abs(parcelAt(parcel, landing.time).x - precisionX) : null;
        parcel.landing = landing ? {
          ...landing, precisionX, precisionError,
          quality: rules.classifyThrow(precisionError, landing.chimney.size),
        } : null;
        game.available -= 1;
        game.parcel = parcel;
        game.nextReleaseAt = game.time + releaseCooldown;
      }

      function drag(event) {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        if (!pointer.dragging) {
          if (Math.hypot(event.clientX - pointer.clientX, event.clientY - pointer.clientY) < dragThreshold) return;
          pointer.dragging = true;
        }
        pointer.x = clamp(
          pointer.x + (event.clientX - pointer.clientX) * width / bounds.width,
          flightBounds.left, flightBounds.right,
        );
        pointer.y = clamp(
          pointer.y + (event.clientY - pointer.clientY) * height / bounds.height,
          flightBounds.top, flightBounds.bottom,
        );
        pointer.clientX = event.clientX;
        pointer.clientY = event.clientY;
      }

      primary.addEventListener("click", act);
      autoDrop.addEventListener("change", () => {
        if (game.mode === "playing" ? !game.sniperGranted : sniperAvailable === 0) {
          autoDrop.checked = false;
          return;
        }
        status.textContent = autoDrop.checked && game.sniperGranted
          ? "Lancer automatique activé : concentre-toi sur le pilotage"
          : autoDrop.checked ? "Une lunette sera utilisée pour la prochaine tournée"
            : "Lancer manuel : bouton ou Espace quand le viseur est vert";
        if (game.mode !== "playing") notifyPilot("noel:tournee-lunette-choix", { prepared: autoDrop.checked });
      });
      canvas.addEventListener("pointerdown", event => {
        if (game.mode !== "playing" || event.button !== 0) return;
        if (pointer?.id != null) return;
        event.preventDefault();
        setTouchControls(event.pointerType === "touch");
        primary.focus({ preventScroll: true });
        const { x, y } = game.player;
        pointer = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y, dragging: false };
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", event => {
        if (game.mode !== "playing") return;
        if (pointer?.id === event.pointerId) drag(event);
      });
      canvas.addEventListener("pointerup", event => {
        if (pointer?.id !== event.pointerId) return;
        pointer = null;
      });
      for (const type of ["pointercancel", "lostpointercapture"]) {
        canvas.addEventListener(type, event => {
          if (pointer?.id === event.pointerId) pointer = null;
        });
      }
      root.addEventListener("keydown", event => {
        if (event.code === "Space") {
          if (event.target === autoDrop) return;
          event.preventDefault();
          if (!event.repeat) act();
          return;
        }
        if (game.mode !== "playing") return;
        if (Object.prototype.hasOwnProperty.call(direction, event.code)) {
          event.preventDefault();
          setTouchControls(false);
          pointer = null;
          keys.add(event.code);
        }
      });
      root.addEventListener("focusout", event => {
        if (!root.contains(event.relatedTarget)) keys.clear();
      });
      window.addEventListener("keyup", event => keys.delete(event.code));
      window.addEventListener("message", event => {
        if (window.parent === window || event.source !== window.parent || event.origin !== parentOrigin) return;
        const result = event.data;
        if (result?.type === "noel:tournee-lunette") {
          if (!Number.isSafeInteger(result.available) || result.available < 0) return;
          if (result.active !== undefined) {
            if (result.runId !== game.runId || game.mode !== "playing" || typeof result.active !== "boolean") return;
            sniperAvailable = result.available;
            const alreadyGranted = game.sniperGranted;
            game.sniperGranted = game.sniperRequested && result.active;
            if (!alreadyGranted || !game.sniperGranted) autoDrop.checked = game.sniperGranted;
          } else {
            sniperAvailable = result.available;
            if (game.mode !== "playing") autoDrop.checked = result.prepared === true && sniperAvailable > 0;
          }
          syncSniperControls();
          reportHeight();
          return;
        }
        if (!result || result.type !== "noel:tournee-bilan" || game.mode !== "finished" || game.summaryReceived) return;
        if (result.runId !== undefined && result.runId !== game.runId) return;
        if (!Number.isSafeInteger(result.grelots) || result.grelots < 0
          || !Number.isSafeInteger(result.lights) || result.lights < 0
          || typeof result.practice !== "boolean" || typeof result.improved !== "boolean") return;
        game.summaryReceived = true;
        summaryTitle.textContent = result.practice ? "Tournée d’entraînement" : "Tournée terminée";
        summaryGrelots.textContent = String(result.grelots);
        summaryLights.textContent = String(result.lights);
        summaryValues.hidden = false;
        summaryNote.textContent = result.practice
          ? "La tournée du jour a déjà été récompensée : aucun nouveau gain."
          : result.retry === true
            ? "Second tour : les gains de cette nouvelle tournée s’ajoutent aux précédents."
            : "Ces Grelots et lumières ont été crédités dans l’aperçu.";
      });
      window.addEventListener("blur", () => { keys.clear(); pointer = null; });
      const redrawTheme = () => { if (game.mode !== "playing") draw(); };
      if (typeof darkMode.addEventListener === "function") {
        darkMode.addEventListener("change", redrawTheme);
      } else if (typeof darkMode.addListener === "function") {
        darkMode.addListener(redrawTheme);
      }
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      readyForSniper();
      draw();
    })();
