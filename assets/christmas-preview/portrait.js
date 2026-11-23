(() => {
  "use strict";

  const ivory = "#fff7e8";
  const brass = "#e4bd74";
  const pine = "#1b5f48";
  const cranberry = "#ad3446";
  const portraitRequests = new WeakMap();
  const avatarImages = new Map();

  // Exact geometry rendered by SportingDirectorAvatar, director_m_01.
  // Its background is separated so the winter scenery can sit behind it.
  const gameAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="360" height="360">
    <g data-avatar-hair-back="side"></g>
    <path d="M11 121C14 93 31 78 60 78C89 78 106 93 109 121Z" fill="JACKET"/>
    <path d="M40 84L60 105L80 84C74 79 68 77 60 77C52 77 46 79 40 84Z" fill="SHIRT"/>
    <path d="M51 67H69V85C66 91 54 91 51 85Z" fill="#BC7953"/>
    <ellipse cx="37" cy="51" rx="5.5" ry="8" fill="#D9A174"/>
    <ellipse cx="83" cy="51" rx="5.5" ry="8" fill="#D9A174"/>
    <path d="M35 49C39 47 40 52 37 56" fill="none" stroke="#BC7953" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M85 49C81 47 80 52 83 56" fill="none" stroke="#BC7953" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="60" cy="49" rx="24" ry="30" fill="#D9A174"/>
    <ellipse cx="45" cy="59" rx="6" ry="3.4" fill="#CF7E75" opacity="0.22"/>
    <ellipse cx="75" cy="59" rx="6" ry="3.4" fill="#CF7E75" opacity="0.22"/>
    <g data-avatar-hair-front="side"><path d="M35 42C36 23 47 15 64 17C77 18 84 27 84 42C76 34 69 30 58 30C49 30 42 35 35 42Z" fill="#3B2821"/></g>
    <path d="M43 43C47 41 51 41 55 43" fill="none" stroke="#3B2821" stroke-width="2" stroke-linecap="round"/>
    <path d="M65 43C69 41 73 41 77 43" fill="none" stroke="#3B2821" stroke-width="2" stroke-linecap="round"/>
    <g transform="translate(50 49)"><path d="M-5 0C-2-3 2-3 5 0C2 3-2 3-5 0Z" fill="#FFFDF8"/><circle r="2.25" fill="#70452F"/><circle r="1" fill="#17211E"/><circle cx="-0.6" cy="-0.7" r="0.45" fill="#FFFFFF" opacity="0.9"/></g>
    <g transform="translate(70 49) scale(-1 1)"><path d="M-5 0C-2-3 2-3 5 0C2 3-2 3-5 0Z" fill="#FFFDF8"/><circle r="2.25" fill="#70452F"/><circle r="1" fill="#17211E"/><circle cx="-0.6" cy="-0.7" r="0.45" fill="#FFFFFF" opacity="0.9"/></g>
    <path d="M59 51L57 60C59 61 61 61 63 60" fill="none" stroke="#BC7953" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
    <path d="M52 66C56 71 64 71 68 66" fill="none" stroke="#8B4E4D" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"/>
  </svg>`;

  const cosmeticSlots = {
    "lueurs-velodrome": "fond", "fond-neige": "fond",
    "bonnet-relais": "chapeau", "couronne-noel": "chapeau", "bois-renne": "chapeau",
    "tenue-facteur": "tenue", "tenue-pere-noel": "tenue", "tenue-lutin": "tenue", "tenue-aurore": "tenue",
    "cache-cou-renne": "masque", "barbe-pere-noel": "masque", "lunettes-givre": "lunettes",
    "couronne-rayons": "cadre", "halo-etoiles": "cadre", "cadre-grand-sapin": "cadre",
    "avent-bonnet-constellation": "chapeau", "avent-nuit-lanternes": "fond",
    "avent-echarpe-pain-epices": "masque", "avent-manteau-casse-noisette": "tenue",
    "avent-cadre-givre": "cadre",
  };

  function fillPath(context, data, color) {
    context.fillStyle = color;
    context.fill(new Path2D(data));
  }

  function line(context, data, color, width = 1) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke(new Path2D(data));
  }

  function ellipse(context, x, y, radiusX, radiusY, color, rotation = 0) {
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  function rounded(context, x, y, width, height, radius, color) {
    context.beginPath();
    if (typeof context.roundRect === "function") {
      context.roundRect(x, y, width, height, radius);
    } else {
      const corner = Math.max(0, Math.min(radius, width / 2, height / 2));
      context.moveTo(x + corner, y);
      context.lineTo(x + width - corner, y);
      context.arcTo(x + width, y, x + width, y + corner, corner);
      context.lineTo(x + width, y + height - corner);
      context.arcTo(x + width, y + height, x + width - corner, y + height, corner);
      context.lineTo(x + corner, y + height);
      context.arcTo(x, y + height, x, y + height - corner, corner);
      context.lineTo(x, y + corner);
      context.arcTo(x, y, x + corner, y, corner);
      context.closePath();
    }
    context.fillStyle = color;
    context.fill();
  }

  function star(context, x, y, radius, color) {
    context.beginPath();
    for (let point = 0; point < 10; point++) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const distance = point % 2 === 0 ? radius : radius * 0.44;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }

  function grelot(context, x, y, radius) {
    context.save();
    context.translate(x, y);
    context.beginPath();
    context.ellipse(0, -radius, radius * .28, radius * .38, 0, 0, Math.PI * 2);
    context.strokeStyle = "#a97b43";
    context.lineWidth = Math.max(.3, radius * .15);
    context.stroke();
    const metal = context.createRadialGradient(-radius * .35, -radius * .4, radius * .03, 0, 0, radius);
    metal.addColorStop(0, "#fff2bb");
    metal.addColorStop(.35, "#e8c57d");
    metal.addColorStop(1, "#a6783d");
    ellipse(context, 0, 0, radius, radius, metal);
    line(context, `M${-radius * .92} 0Q0 ${radius * .2} ${radius * .92} 0`, "#b38952", Math.max(.2, radius * .06));
    line(context, `M${-radius * .4} ${radius * .35}Q0 ${radius * .68} ${radius * .4} ${radius * .35}`, "#614525", Math.max(.3, radius * .13));
    for (const side of [-1, 1]) {
      ellipse(context, side * radius * .4, radius * .35, radius * .13, radius * .13, "#614525");
    }
    line(context, `M${-radius * .5} ${-radius * .39}Q${-radius * .3} ${-radius * .62} ${-radius * .08} ${-radius * .63}`, "#fff6d3", Math.max(.3, radius * .08));
    context.restore();
  }

  function snowflake(context, x, y, radius, color) {
    context.save();
    context.translate(x, y);
    for (let arm = 0; arm < 6; arm++) {
      context.save();
      context.rotate(arm * Math.PI / 3);
      line(context, `M0 0V${-radius}M${-radius * .24} ${-radius * .67}L0 ${-radius * .45}L${radius * .24} ${-radius * .67}`, color, Math.max(.4, radius * .12));
      context.restore();
    }
    context.restore();
  }

  function fir(context, x, y, height, color) {
    rounded(context, x - height * .04, y - height * .15, height * .08, height * .2, .5, "#62483a");
    for (let tier = 0; tier < 3; tier++) {
      const bottom = y - tier * height * .2;
      const width = height * (.32 - tier * .06);
      fillPath(context, `M${x} ${y - height}L${x + width} ${bottom}L${x - width} ${bottom}Z`, color);
    }
  }

  function snow(context) {
    for (let index = 0; index < 39; index++) {
      const x = (index * 37 + 7) % 120;
      const y = (index * 19 + 9) % 93;
      ellipse(context, x, y, .5 + index % 3 * .16, .5 + index % 3 * .16, "#fff9ecbb");
    }
  }

  function drawBackground(context, id) {
    if (!id) {
      ellipse(context, 60, 60, 60, 60, "#DDF3EC");
      context.globalAlpha = .28;
      fillPath(context, "M-8 89C19 64 33 70 53 50C75 28 90 31 128 7V-5H-8Z", "#8ACBB7");
      context.globalAlpha = .15;
      ellipse(context, 99, 28, 20, 20, "#FFFFFF");
      context.globalAlpha = 1;
      return;
    }
    if (id === "avent-nuit-lanternes") {
      const sky = context.createLinearGradient(0, 0, 0, 120);
      sky.addColorStop(0, "#35223f");
      sky.addColorStop(.6, "#9d7384");
      sky.addColorStop(1, "#f3d8ca");
      context.fillStyle = sky;
      context.fillRect(0, 0, 120, 120);
      ellipse(context, 96, 19, 8, 8, "#f8dfb0");
      fillPath(context, "M0 74L15 56L32 70L49 43L74 69L92 50L120 71V120H0Z", "#69546e");
      fillPath(context, "M0 87Q32 78 60 90T120 87V120H0Z", "#eddbd6");
      for (const [x, y] of [[7, 67], [96, 74]]) {
        rounded(context, x, y, 18, 18, 1, "#69494b");
        fillPath(context, `M${x - 3} ${y}L${x + 9} ${y - 10}L${x + 21} ${y}Z`, "#fff0df");
        rounded(context, x + 6, y + 4, 6, 7, .5, "#ffd596");
      }
      line(context, "M0 28Q60 52 120 28", "#e2b483", .6);
      for (const [x, y] of [[18, 34], [37, 40], [84, 40], [104, 32]]) {
        line(context, `M${x} ${y - 4}V${y + 1}`, "#e2b483", .7);
        context.shadowColor = "#ffc97d";
        context.shadowBlur = 8;
        ellipse(context, x, y + 5, 3.6, 4.8, "#ffd79c");
        context.shadowBlur = 0;
        line(context, `M${x - 2.5} ${y + 2}H${x + 2.5}M${x - 2.5} ${y + 8}H${x + 2.5}`, "#b77752", .7);
      }
      snow(context);
      return;
    }
    const sky = context.createLinearGradient(0, 0, 0, 120);
    sky.addColorStop(0, "#172c44");
    sky.addColorStop(.65, id === "fond-neige" ? "#668e9c" : "#285549");
    sky.addColorStop(1, "#d7e7df");
    context.fillStyle = sky;
    context.fillRect(0, 0, 120, 120);
    ellipse(context, 94, 23, 10, 10, "#fbedd0");
    fillPath(context, "M0 65L20 39L42 62L65 33L92 59L120 46V120H0Z", "#88aab6");
    fillPath(context, "M9 54L20 39L33 53L24 50L19 52L16 48Z M50 47L65 33L79 46L66 43L62 46L59 42Z", "#f5faf5");
    for (const [x, y, height] of [[8, 85, 32], [109, 92, 43], [22, 84, 23], [97, 85, 27]]) {
      fir(context, x, y, height, "#1f534f");
      line(context, `M${x - height * .12} ${y - height * .56}L${x} ${y - height * .75}L${x + height * .12} ${y - height * .56}`, "#dcebe3", 1.7);
    }
    fillPath(context, "M0 86Q29 77 59 89Q92 77 120 86V120H0Z", "#e5eeea");
    if (id === "lueurs-velodrome") {
      line(context, "M-10 107Q60 65 130 107 M-10 113Q60 73 130 113", "#b9ceca", 1.5);
      line(context, "M0 28Q60 48 120 28", "#b8af85", .5);
      for (let index = 0; index < 11; index++) {
        const x = index * 12;
        const y = 28 + Math.sin(index / 10 * Math.PI) * 10;
        context.shadowColor = brass;
        context.shadowBlur = 6;
        ellipse(context, x, y, 1.2, 1.6, index % 2 ? ivory : brass);
      }
      context.shadowBlur = 0;
    } else {
      for (const x of [17, 88]) {
        rounded(context, x, 65, 17, 17, 1, "#6c5450");
        fillPath(context, `M${x - 3} 66L${x + 8.5} 56L${x + 20} 66Z`, ivory);
        rounded(context, x + 6, 69, 5, 6, .5, "#efcf89");
      }
    }
    snow(context);
  }

  function avatarImage(outfit) {
    if (avatarImages.has(outfit)) return avatarImages.get(outfit);
    const palette = {
      "tenue-facteur": ["#913745", "#efe4ce"],
      "tenue-pere-noel": ["#b23446", "#fff3df"],
      "tenue-lutin": ["#15573f", "#ddbc73"],
      "tenue-aurore": ["#213b56", "#bdede0"],
      "avent-manteau-casse-noisette": ["#225b70", "#f4e0b0"],
    }[outfit] ?? ["#176951", "#FFFDF4"];
    const image = new Image();
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      gameAvatarSvg.replace("JACKET", palette[0]).replace("SHIRT", palette[1]),
    );
    avatarImages.set(outfit, image);
    return image;
  }

  function drawOutfit(context, id) {
    if (!id) return;
    if (id === "tenue-pere-noel") {
      line(context, "M40 84Q60 103 80 84 M60 101V121", ivory, 4.5);
      line(context, "M20 111Q60 119 100 111", "#273331", 6);
      rounded(context, 54, 110, 12, 9, 1.4, brass);
      rounded(context, 57, 112, 6, 5, .4, "#273331");
    } else if (id === "tenue-lutin") {
      fillPath(context, "M40 84L47 96L53 89L60 100L67 89L73 96L80 84L70 88L60 91L50 88Z", "#e1bd6c");
      line(context, "M60 100V120", "#a5bf7d", 1);
      for (const y of [104, 110, 116]) ellipse(context, 64, y, 1.4, 1.4, brass);
    } else if (id === "tenue-aurore") {
      line(context, "M21 115Q40 85 60 111T102 106", "#54bca3", 3);
      line(context, "M19 119Q42 93 62 117T104 112", "#b1a2e0", 2);
      for (const [x, y] of [[34, 100], [82, 98], [74, 113]]) star(context, x, y, 2.1, ivory);
    } else if (id === "avent-manteau-casse-noisette") {
      fillPath(context, "M42 83L51 92L60 95L69 92L78 83L73 95L60 101L47 95Z", "#ead09a");
      line(context, "M60 101V120", "#e7c781", 1.3);
      for (const y of [102, 109, 116]) {
        line(context, `M47 ${y}Q53 ${y - 4} 60 ${y}Q67 ${y - 4} 73 ${y}`, brass, 1.1);
        for (const x of [47, 73]) ellipse(context, x, y, 1.4, 1.4, "#f4dba3");
      }
      for (const [x, angle] of [[32, -.45], [88, .45]]) {
        ellipse(context, x, 92, 8, 3.2, "#85394a", angle);
        line(context, `M${x - 5} 94L${x - 4} 98M${x - 1} 95V99M${x + 3} 94L${x + 4} 98`, brass, 1);
      }
    } else {
      line(context, "M40 85L60 104L80 85 M60 105V120", brass, 1.1);
      rounded(context, 77, 106, 14, 7, 1.3, "#d38572");
      star(context, 84, 109, 2.6, brass);
    }
  }

  function drawHat(context, id) {
    if (id === "bonnet-relais") {
      fillPath(context, "M33 31Q36 9 57 6Q78 2 88 17L96 29L85 26Q75 12 66 18L83 33Z", cranberry);
      fillPath(context, "M37 28Q47 12 60 10Q48 21 49 30Z", "#d75d64");
      ellipse(context, 95, 29, 6, 6, ivory);
      line(context, "M34 31Q60 22 86 31", ivory, 7.5);
      line(context, "M36 32Q60 26 84 32", "#eee0cb", .8);
    } else if (id === "avent-bonnet-constellation") {
      fillPath(context, "M33 30Q33 16 44 10Q60 0 72 12L84 29Z", "#375481");
      fillPath(context, "M35 28Q41 13 56 8Q46 18 47 28Z", "#5c75a0");
      ellipse(context, 57, 7, 4.9, 4.8, "#dbe7ec");
      line(context, "M34 31Q60 23 85 31", "#dce7e9", 6);
      line(context, "M36 32Q60 27 83 32", "#9fb8c8", .9);
      for (const [x, y, radius] of [[48, 18, 2.4], [62, 16, 2], [73, 23, 2.1]]) star(context, x, y, radius, "#f6d98b");
    } else if (id === "couronne-noel") {
      line(context, "M30 33Q60 10 90 33", "#164b37", 6);
      for (let index = 0; index < 13; index++) {
        const angle = Math.PI + index / 12 * Math.PI;
        const x = 60 + Math.cos(angle) * 28;
        const y = 33 + Math.sin(angle) * 13;
        ellipse(context, x, y, 5.5, 2, index % 2 ? "#2e8756" : "#63a66c", angle + .6);
        if (index % 3 === 0) ellipse(context, x + 1, y + 1, 1.8, 1.8, "#cf4556");
      }
      star(context, 60, 18, 4.2, brass);
    } else if (id === "bois-renne") {
      line(context, "M34 31Q60 21 86 31", cranberry, 3.5);
      line(context, "M36 29L29 19L29 7M29 17L20 10M29 12L36 4 M84 29L91 19L91 7M91 17L100 10M91 12L84 4", "#b78954", 3);
      for (const x of [34, 86]) {
        grelot(context, x, 32, 2.6);
      }
    }
  }

  function drawMask(context, id) {
    if (id === "barbe-pere-noel") {
      fillPath(context, "M37 60Q38 71 44 74Q58 67 76 61L83 61Q84 83 72 91L60 100Q42 88 37 74Z", "#e9e7dc");
      fillPath(context, "M41 65Q47 74 60 72Q72 73 79 65Q78 85 60 95Q44 84 41 65Z", "#fffaf0");
      fillPath(context, "M60 64Q49 58 43 67Q48 72 60 67Q72 73 78 66Q70 58 60 64Z", "#fffdf5");
      line(context, "M46 76Q48 85 55 88 M65 78Q69 85 62 91", "#d5d9cf", .9);
    } else if (id === "avent-echarpe-pain-epices") {
      fillPath(context, "M37 66Q60 77 83 66L80 80Q61 92 40 81Z", "#b87548");
      fillPath(context, "M74 80L85 77L84 102L73 106Z", "#a76240");
      line(context, "M39 71Q60 82 81 71M41 78Q60 88 79 79", "#f5dfb7", 1.3);
      line(context, "M74 101L74 107M77 102V108M80 101V107M83 100V106", "#edc798", .9);
      for (const x of [46, 55, 64, 73]) {
        line(context, `M${x - 2} 75L${x} 77L${x + 2} 75`, "#fff0d1", .8);
      }
      ellipse(context, 79, 88, 1.7, 1.7, "#f9dfad");
      line(context, "M79 90V96M76 91L82 91M79 95L76 98M79 95L82 98", "#f9dfad", 1.6);
    } else if (id === "cache-cou-renne") {
      fillPath(context, "M36 64Q60 73 84 64L80 81Q60 94 40 81Z", "#175447");
      line(context, "M39 69Q60 78 81 69 M41 79Q60 88 79 79", "#71aa87", 1);
      ellipse(context, 60, 79, 3.5, 2.7, "#d55757");
      line(context, "M53 76L49 71M67 76L71 71", brass, 1.1);
    }
  }

  function drawGlasses(context) {
    line(context, "M36 46H84", "#274c57", 2.3);
    fillPath(context, "M39 44H57L56 53Q47 59 41 52Z M63 44H81L79 52Q73 59 64 53Z", "#8ccfd7");
    line(context, "M39 44H57L56 53Q47 59 41 52Z M63 44H81L79 52Q73 59 64 53Z", "#f5dd9a", .9);
    line(context, "M44 48L50 45M68 48L74 45", "#f4fffa", 1);
  }

  function drawFrame(context, id) {
    if (!id) return;
    if (id === "avent-cadre-givre") {
      context.beginPath();
      context.arc(60, 60, 56, 0, Math.PI * 2);
      context.strokeStyle = "#acc7d7";
      context.lineWidth = 3;
      context.stroke();
      context.beginPath();
      context.arc(60, 60, 57.2, 0, Math.PI * 2);
      context.strokeStyle = "#f5ffff";
      context.lineWidth = .8;
      context.stroke();
      for (let index = 0; index < 12; index++) {
        const angle = index / 12 * Math.PI * 2;
        const x = 60 + Math.cos(angle) * 55;
        const y = 60 + Math.sin(angle) * 55;
        snowflake(context, x, y, index % 3 === 0 ? 4.9 : 3.4, "#f5ffff");
        if (index % 3 === 0) ellipse(context, x, y, 1.2, 1.2, "#a5d9ec");
      }
      return;
    }
    const grand = id === "cadre-grand-sapin";
    const radius = grand ? 55 : 57;
    context.beginPath();
    context.arc(60, 60, radius, 0, Math.PI * 2);
    context.lineWidth = grand ? 4 : 1.1;
    context.strokeStyle = grand ? "#27694c" : brass;
    context.stroke();
    const count = id === "halo-etoiles" ? 16 : grand ? 34 : 22;
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2;
      const x = 60 + Math.cos(angle) * radius;
      const y = 60 + Math.sin(angle) * radius;
      if (id === "halo-etoiles") {
        context.shadowColor = brass;
        context.shadowBlur = 5;
        star(context, x, y, index % 2 ? 1.8 : 2.6, index % 2 ? ivory : brass);
      } else {
        ellipse(context, x, y, grand ? 4.8 : 3.1, 1.8, index % 2 ? "#75a884" : "#27694c", angle + .7);
        if (index % 4 === 0) ellipse(context, x + 1, y, 1.5, 1.5, cranberry);
      }
    }
    context.shadowBlur = 0;
    if (grand) {
      fillPath(context, "M59 108Q40 96 41 107Q42 118 59 112 M61 108Q80 96 79 107Q78 118 61 112Z", cranberry);
      ellipse(context, 60, 110, 3.2, 3.2, "#d25760");
      star(context, 60, 6, 4.8, brass);
    }
  }

  window.drawNoelPortrait = (canvas, equipped = {}) => {
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return;
    portraitRequests.set(canvas, { ...equipped });
    const avatar = avatarImage(equipped.tenue);
    if (!avatar.complete) {
      avatar.addEventListener("load", () => {
        window.drawNoelPortrait(canvas, portraitRequests.get(canvas));
      }, { once: true });
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    const size = Math.min(canvas.width, canvas.height);
    context.translate((canvas.width - size) / 2, (canvas.height - size) / 2);
    context.scale(size / 120, size / 120);
    context.beginPath();
    context.arc(60, 60, 59, 0, Math.PI * 2);
    context.clip();
    drawBackground(context, equipped.fond);
    if (avatar.complete && avatar.naturalWidth) context.drawImage(avatar, 0, 0, 120, 120);
    drawOutfit(context, equipped.tenue);
    drawHat(context, equipped.chapeau);
    drawMask(context, equipped.masque);
    if (equipped.lunettes === "lunettes-givre") drawGlasses(context);
    context.restore();
    context.save();
    context.translate((canvas.width - size) / 2, (canvas.height - size) / 2);
    context.scale(size / 120, size / 120);
    drawFrame(context, equipped.cadre);
    context.restore();
  };

  function card(context, color, accent) {
    rounded(context, 37, 22, 55, 80, 5, "#081c2780");
    rounded(context, 34, 18, 55, 80, 5, color);
    line(context, "M40 25H83M40 91H83", accent, 1.1);
  }

  function gift(context) {
    rounded(context, 30, 57, 62, 39, 3, cranberry);
    rounded(context, 27, 50, 68, 12, 3, "#c75360");
    rounded(context, 56, 50, 9, 46, 0, brass);
    ellipse(context, 52, 47, 10, 4, brass, .4);
    ellipse(context, 70, 47, 10, 4, brass, -.4);
  }

  window.drawNoelItem = (canvas, itemId) => {
    if (cosmeticSlots[itemId]) {
      window.drawNoelPortrait(canvas, { [cosmeticSlots[itemId]]: itemId });
      return;
    }
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    const size = Math.min(canvas.width, canvas.height);
    context.translate((canvas.width - size) / 2, (canvas.height - size) / 2);
    context.scale(size / 120, size / 120);
    ellipse(context, 60, 60, 49, 49, "#193c43");
    star(context, 22, 32, 3.5, brass);
    star(context, 101, 81, 2.5, brass);
    switch (itemId) {
      case "lunette-sniper-cadeaux":
        // A festive optical sight, matching the other drawn Christmas objects.
        line(context, "M49 72L39 94M65 73L79 94M55 75V96", brass, 3);
        context.save();
        context.translate(60, 53);
        context.rotate(-.28);
        rounded(context, -36, -11, 66, 23, 6, "#ab7f4f");
        rounded(context, -29, -9, 48, 19, 4, pine);
        rounded(context, -39, -12, 10, 26, 3, brass);
        rounded(context, 14, -17, 19, 35, 4, brass);
        ellipse(context, 29, .5, 10, 16, "#283c42");
        ellipse(context, 30, .5, 6.5, 12, "#a7d8df");
        line(context, "M30-7V8M26 .5H34", "#f7f2da", 1.1);
        rounded(context, -8, -11, 8, 23, 1, cranberry);
        fillPath(context, "M-4-11Q-20-26-17-12Q-12-4-4-11M-4-11Q10-27 11-14Q8-6-4-11Z", cranberry);
        ellipse(context, -4, -12, 3, 3, "#d87876");
        line(context, "M-4-12L-12-3M-4-12L3-2", cranberry, 3);
        context.restore();
        break;
      case "bonnet-course-noel":
        // Vented cycling shell, wool brim and pompom: equipment, not a portrait hat.
        fillPath(context, "M25 71Q22 40 44 29Q66 18 88 36Q101 48 96 71L84 76H34Z", "#a63b49");
        fillPath(context, "M44 29Q63 16 78 26L92 41L82 48L74 34Z", "#c4535c");
        fillPath(context, "M76 27Q91 21 99 36Q104 46 97 51L90 45Q93 36 83 34Z", "#a63b49");
        ellipse(context, 97, 52, 8, 8, ivory);
        line(context, "M43 39L36 57M57 34L52 55M72 36L69 55M84 44L83 57", "#4e2634", 4);
        rounded(context, 22, 64, 77, 14, 6, ivory);
        line(context, "M32 68L35 74M43 68L46 74M54 68L57 74M65 68L68 74M76 68L79 74M87 68L90 74", "#dbd3b9", 1.4);
        line(context, "M36 78L46 91H69L85 78", "#cab172", 3);
        rounded(context, 52, 87, 12, 7, 2, "#715947");
        star(context, 61, 62, 4, brass);
        break;
      case "boussole-polaire":
        ellipse(context, 60, 61, 31, 31, "#ab7f4f");
        ellipse(context, 60, 59, 28, 28, brass);
        ellipse(context, 60, 59, 24, 24, "#e6ddbd");
        for (let index = 0; index < 8; index++) {
          const angle = index * Math.PI / 4;
          line(context, `M${60 + Math.cos(angle) * 18} ${59 + Math.sin(angle) * 18}L${60 + Math.cos(angle) * 22} ${59 + Math.sin(angle) * 22}`, pine, 1);
        }
        fillPath(context, "M72 36L65 64L47 82L54 55Z", cranberry);
        fillPath(context, "M54 55L65 64L47 82Z", pine);
        ellipse(context, 60, 59, 2.3, 2.3, ivory);
        break;
      case "carnet-eclaireur":
        card(context, "#387269", brass);
        rounded(context, 36, 23, 6, 69, 2, "#214f4c");
        line(context, "M48 72L57 45L67 54L77 37 M49 83L60 66L74 76L82 56", ivory, 1.7);
        for (const [x, y] of [[57, 45], [77, 37], [60, 66], [82, 56]]) ellipse(context, x, y, 2.4, 2.4, brass);
        break;
      case "booster-noel":
        card(context, "#a33e4c", brass);
        for (let x = 42; x < 86; x += 6) {
          line(context, `M${x} 25L${x + 2} 31M${x} 85L${x + 2} 91`, "#d88879", 1.2);
        }
        star(context, 61, 59, 22, brass);
        ellipse(context, 61, 59, 8, 8, "#ad4a51");
        star(context, 61, 59, 6, ivory);
        break;
      case "vignette-renne":
        card(context, "#ceb374", ivory);
        rounded(context, 42, 31, 39, 47, 3, "#29605e");
        fillPath(context, "M48 77L54 61H70L77 77Z", "#c79071");
        ellipse(context, 62, 48, 9, 11, "#e8bc91");
        fillPath(context, "M52 44Q52 33 62 34Q72 35 72 44L62 40Z", "#45372f");
        star(context, 61, 85, 4.1, "#fcf5c3");
        line(context, "M88 32L97 23M91 45H101M87 54L96 62", brass, 1.4);
        break;
      case "grelot-repechage":
        grelot(context, 60, 64, 26);
        line(context, "M35 33Q58 15 82 32L86 43M86 43L76 39M86 43L89 33", "#e5efe0", 2.2);
        star(context, 94, 67, 4, ivory);
        break;
      case "hotte-doublons":
        fillPath(context, "M40 43Q30 58 29 83Q60 106 93 84Q92 57 80 43Z", cranberry);
        line(context, "M40 45Q61 51 80 45", brass, 3);
        for (const [x, y, color] of [[44, 30, "#c8d4d3"], [60, 24, "#e8eddf"], [74, 32, "#b1c8ce"]]) {
          rounded(context, x - 7, y, 13, 23, 2, color);
          star(context, x, y + 10, 3, "#588382");
        }
        line(context, "M43 72H76M76 72L69 66M76 72L69 78", brass, 2);
        break;
      case "potential-notebook":
        card(context, "#6a466f", brass);
        rounded(context, 36, 23, 6, 69, 2, "#473753");
        star(context, 62, 54, 17, brass);
        line(context, "M49 81H76M53 86H72", "#d7bade", 1.5);
        break;
      case "personality-reroll":
        card(context, "#387269", brass);
        rounded(context, 36, 23, 6, 69, 2, "#214f4c");
        ellipse(context, 62, 48, 9, 10, "#e8bc91");
        fillPath(context, "M47 76Q48 61 62 61Q76 61 78 76Z", ivory);
        line(context, "M44 40Q61 23 79 41L81 49M81 49L73 45M81 49L84 41", brass, 2.2);
        star(context, 85, 78, 4, brass);
        break;
      case "talent-revealed":
        card(context, "#8b3948", brass);
        rounded(context, 36, 23, 6, 69, 2, "#622c3d");
        star(context, 62, 54, 17, brass);
        line(context, "M47 76L57 82L79 68", ivory, 2.8);
        line(context, "M85 35L93 28M88 46H98M85 58L94 65", brass, 1.6);
        break;
      default:
        gift(context);
    }
    context.restore();
  };
})();
