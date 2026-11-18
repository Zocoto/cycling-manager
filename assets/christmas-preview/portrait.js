(() => {
  "use strict";

  const ink = "#101c22";
  const brass = "#e2bd7c";
  const ivory = "#f7ead2";
  const cranberry = "#a93848";
  const pine = "#23564d";
  const frost = "#9ed9df";

  function path(context, points, color) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }

  function stroke(context, points, color, width) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.stroke();
  }

  function ellipse(context, x, y, radiusX, radiusY, color, rotation = 0) {
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  function rounded(context, x, y, width, height, radius, color) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = color;
    context.fill();
  }

  function star(context, x, y, size, color) {
    path(context, [[x, y - size], [x + size * .25, y - size * .24], [x + size * .74, y],
      [x + size * .25, y + size * .23], [x, y + size], [x - size * .25, y + size * .23],
      [x - size * .74, y], [x - size * .25, y - size * .24]], color);
  }

  function branch(context, x, y, length, rotation, color) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    stroke(context, [[0, 0], [0, length]], color, 2.3);
    for (let index = 1; index < 8; index++) {
      const height = index * length / 8;
      const reach = 10 + Math.sin(index * .42) * 9;
      stroke(context, [[-reach, height + 9], [0, height], [reach, height + 10]], color, 2);
    }
    context.restore();
  }

  function background(context, winter) {
    const sky = context.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, winter ? "#0c2036" : "#132a30");
    sky.addColorStop(.64, winter ? "#29445d" : "#245047");
    sky.addColorStop(1, winter ? "#697f92" : "#5d7561");
    context.fillStyle = sky;
    context.fillRect(0, 0, 360, 360);
    if (!winter) {
      context.beginPath();
      context.arc(180, 163, 117, 0, Math.PI * 2);
      context.strokeStyle = "#bdaf7859";
      context.lineWidth = 1;
      context.stroke();
      return;
    }
    for (let index = 0; index < 31; index++) {
      ellipse(context, (index * 71 + 13) % 360, 14 + (index * 43) % 185,
        1 + index % 3 / 3, 1 + index % 3 / 3, "#f4f0d990");
    }
    star(context, 267, 58, 11, brass);
    path(context, [[0, 230], [43, 212], [112, 234], [192, 211], [293, 233], [360, 202], [360, 360], [0, 360]], "#577284");
    path(context, [[0, 278], [81, 255], [216, 271], [360, 248], [360, 360], [0, 360]], "#aec5cb");
    context.beginPath();
    context.ellipse(177, 290, 190, 46, -.05, 0, Math.PI * 2);
    context.lineWidth = 6;
    context.strokeStyle = "#e1edf0ac";
    context.stroke();
    for (const x of [39, 318]) {
      const glow = context.createRadialGradient(x, 184, 2, x, 184, 41);
      glow.addColorStop(0, "#ffe3a5a0");
      glow.addColorStop(1, "#ffe3a500");
      context.fillStyle = glow;
      context.fillRect(x - 41, 143, 82, 82);
      stroke(context, [[x, 268], [x, 186], [x - 9, 182], [x + 8, 182]], ink, 3);
      rounded(context, x - 6, 184, 12, 9, 2, ivory);
    }
  }

  function drawBody(context, festive) {
    context.beginPath();
    context.moveTo(53, 360);
    context.bezierCurveTo(61, 306, 89, 276, 129, 266);
    context.lineTo(161, 254);
    context.lineTo(199, 254);
    context.lineTo(232, 266);
    context.bezierCurveTo(269, 275, 299, 309, 309, 360);
    context.closePath();
    context.fillStyle = festive ? "#8e293a" : "#203d42";
    context.fill();
    path(context, [[140, 269], [180, 301], [219, 269], [243, 280], [236, 360], [122, 360], [117, 280]], festive ? cranberry : "#2d5e59");
    if (festive) {
      stroke(context, [[113, 282], [133, 305], [121, 360]], "#d67b6c", 3);
      stroke(context, [[246, 282], [226, 305], [239, 360]], "#d67b6c", 3);
      stroke(context, [[142, 270], [163, 289], [180, 296], [198, 288], [219, 270]], ivory, 9);
      star(context, 213, 326, 13, brass);
      rounded(context, 192, 343, 35, 5, 2, "#c76665");
    } else {
      stroke(context, [[140, 272], [163, 289], [180, 296], [197, 289], [220, 272]], "#6e9a81", 5);
      stroke(context, [[103, 305], [121, 320]], "#416f64", 3);
      stroke(context, [[257, 305], [240, 320]], "#416f64", 3);
    }
    stroke(context, [[180, 298], [180, 360]], festive ? "#f2c28f" : "#9bb7a0", 2);
  }

  function drawFace(context) {
    rounded(context, 155, 225, 50, 58, 14, "#ac684e");
    ellipse(context, 127, 189, 11, 17, "#b9775b");
    ellipse(context, 233, 189, 11, 17, "#b9775b");
    const skin = context.createLinearGradient(125, 125, 235, 221);
    skin.addColorStop(0, "#f0bd91");
    skin.addColorStop(.58, "#e3a278");
    skin.addColorStop(1, "#c48362");
    context.beginPath();
    context.moveTo(127, 144);
    context.bezierCurveTo(133, 119, 150, 108, 180, 109);
    context.bezierCurveTo(211, 109, 228, 127, 232, 147);
    context.lineTo(230, 198);
    context.bezierCurveTo(227, 230, 201, 252, 180, 254);
    context.bezierCurveTo(158, 252, 134, 229, 130, 199);
    context.closePath();
    context.fillStyle = skin;
    context.fill();
    ellipse(context, 151, 210, 12, 5, "#ce725b55");
    ellipse(context, 210, 210, 12, 5, "#ce725b55");
    stroke(context, [[143, 173], [152, 170], [163, 173]], "#5c382d", 3);
    stroke(context, [[197, 173], [207, 170], [218, 173]], "#5c382d", 3);
    ellipse(context, 154, 186, 4, 4.5, "#2b2725");
    ellipse(context, 207, 186, 4, 4.5, "#2b2725");
    stroke(context, [[180, 181], [176, 198], [184, 200]], "#a05a48", 2.1);
    stroke(context, [[164, 221], [175, 225], [188, 224], [197, 220]], "#854e40", 2.6);
  }

  function drawHat(context, festive) {
    if (festive) {
      context.beginPath();
      context.moveTo(116, 146);
      context.bezierCurveTo(118, 100, 134, 66, 168, 65);
      context.bezierCurveTo(186, 65, 218, 82, 231, 109);
      context.lineTo(240, 148);
      context.closePath();
      context.fillStyle = cranberry;
      context.fill();
      for (let x = 132; x < 232; x += 10) {
        stroke(context, [[x, 138], [180 + (x - 180) * .72, 99]], "#d277725f", 1.7);
      }
      ellipse(context, 166, 64, 16, 14, ivory, .14);
      ellipse(context, 160, 61, 6, 4, "#ffffff87", -.4);
      rounded(context, 114, 133, 130, 22, 7, "#7e2634");
      stroke(context, [[119, 136], [239, 136]], "#efc384", 3);
      stroke(context, [[119, 148], [240, 148]], "#efc384", 2);
      star(context, 182, 142, 8, ivory);
      return;
    }
    context.beginPath();
    context.moveTo(117, 154);
    context.bezierCurveTo(117, 115, 142, 97, 176, 97);
    context.bezierCurveTo(215, 95, 240, 114, 241, 154);
    context.lineTo(219, 160);
    context.lineTo(143, 159);
    context.closePath();
    context.fillStyle = "#192c33";
    context.fill();
    stroke(context, [[129, 144], [151, 120], [180, 112], [205, 121], [229, 144]], "#4b6563", 5);
    path(context, [[117, 151], [166, 152], [191, 163], [132, 163]], "#334e50");
    stroke(context, [[127, 158], [178, 160]], "#77928a", 2);
  }

  function drawNeckwear(context) {
    path(context, [[126, 202], [153, 208], [179, 211], [204, 208], [232, 201],
      [229, 226], [213, 251], [199, 268], [161, 267], [142, 247], [130, 226]], "#164c46");
    stroke(context, [[133, 209], [156, 216], [179, 220], [202, 216], [226, 209]], "#87b18e", 2);
    stroke(context, [[153, 231], [162, 238], [170, 232]], ivory, 2);
    stroke(context, [[190, 232], [198, 238], [207, 231]], ivory, 2);
    ellipse(context, 180, 239, 6, 4.5, "#e78376");
    stroke(context, [[140, 227], [138, 219], [133, 216]], brass, 1.9);
    stroke(context, [[220, 226], [222, 219], [227, 216]], brass, 1.9);
  }

  function drawGlasses(context) {
    stroke(context, [[127, 179], [233, 179]], "#36515e", 6);
    path(context, [[130, 176], [175, 176], [174, 194], [167, 202], [144, 202], [136, 195]], "#385866");
    path(context, [[185, 176], [231, 176], [225, 195], [217, 202], [195, 202], [187, 194]], "#385866");
    path(context, [[135, 180], [170, 180], [168, 193], [162, 198], [146, 198], [140, 193]], frost);
    path(context, [[190, 180], [225, 180], [220, 193], [214, 198], [197, 198], [192, 193]], "#72afbc");
    stroke(context, [[140, 189], [151, 182]], "#e9f9ea", 2);
    stroke(context, [[195, 189], [206, 182]], "#d8f5ee", 2);
  }

  function drawFrame(context) {
    context.beginPath();
    context.roundRect(11, 11, 338, 338, 20);
    context.lineWidth = 4;
    context.strokeStyle = brass;
    context.stroke();
    for (const [x, y, angle] of [[30, 13, -.56], [330, 13, .56], [20, 287, -.22], [340, 287, .22]]) {
      branch(context, x, y, 47, angle, "#528d69");
      ellipse(context, x, y + 32, 4, 4, "#ca6261");
      ellipse(context, x + 7, y + 36, 3, 3, "#d9786e");
    }
    for (const x of [26, 334]) star(context, x, 340, 9, ivory);
  }

  window.drawNoelPortrait = (canvas, equipped = {}) => {
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return;
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width, canvas.height) / 360;
    context.fillStyle = "#132a30";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate((canvas.width - scale * 360) / 2, (canvas.height - scale * 360) / 2);
    context.scale(scale, scale);
    background(context, equipped.fond === "lueurs-velodrome");
    drawBody(context, equipped.tenue === "tenue-facteur");
    drawFace(context);
    drawHat(context, equipped.chapeau === "bonnet-relais");
    if (equipped.masque === "cache-cou-renne") drawNeckwear(context);
    if (equipped.lunettes === "lunettes-givre") drawGlasses(context);
    if (equipped.cadre === "couronne-rayons") drawFrame(context);
    context.restore();
  };

  function cardObject(context, color, accent, decoration) {
    rounded(context, 42, 30, 92, 114, 10, "#0b1a2c72");
    rounded(context, 40, 26, 92, 113, 9, color);
    stroke(context, [[51, 35], [121, 35]], accent, 2);
    stroke(context, [[51, 130], [121, 130]], accent, 2);
    decoration();
  }

  window.drawNoelItem = (canvas, itemId) => {
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return;
    const slots = {
      "lueurs-velodrome": "fond", "bonnet-relais": "chapeau", "tenue-facteur": "tenue",
      "cache-cou-renne": "masque", "lunettes-givre": "lunettes", "couronne-rayons": "cadre",
    };
    if (slots[itemId]) {
      window.drawNoelPortrait(canvas, { [slots[itemId]]: itemId });
      return;
    }
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width, canvas.height) / 172;
    context.translate((canvas.width - scale * 172) / 2, (canvas.height - scale * 172) / 2);
    context.scale(scale, scale);
    ellipse(context, 85, 87, 66, 65, "#123841");
    star(context, 36, 47, 9, "#e9b87d");
    star(context, 139, 116, 7, "#e9b87d");
    switch (itemId) {
      case "billet-neige":
        context.translate(86, 85);
        context.rotate(-.18);
        rounded(context, -58, -27, 116, 54, 8, "#ecd7a4");
        rounded(context, -51, -21, 102, 42, 4, "#b36357");
        for (const x of [-30, -18, -6, 6, 18]) stroke(context, [[x, -12], [x, 12]], "#d9957c", 1.5);
        star(context, 35, 0, 12, ivory);
        break;
      case "boussole-polaire":
        ellipse(context, 86, 86, 42, 42, "#a67643");
        ellipse(context, 86, 84, 39, 39, brass);
        ellipse(context, 86, 84, 34, 34, "#dfd2a6");
        for (let index = 0; index < 8; index++) {
          const angle = index * Math.PI / 4;
          stroke(context, [[86 + Math.cos(angle) * 26, 84 + Math.sin(angle) * 26],
            [86 + Math.cos(angle) * 31, 84 + Math.sin(angle) * 31]], pine, 2);
        }
        path(context, [[101, 58], [95, 88], [71, 110], [76, 81]], cranberry);
        path(context, [[76, 81], [95, 88], [71, 110]], pine);
        ellipse(context, 86, 84, 3, 3, ivory);
        break;
      case "carnet-eclaireur":
        cardObject(context, "#387269", brass, () => {
          rounded(context, 42, 34, 10, 96, 3, "#286358");
          stroke(context, [[59, 104], [70, 71], [92, 80], [107, 56], [116, 65]], ivory, 2.5);
          for (const [x, y] of [[59, 104], [70, 71], [92, 80], [107, 56], [116, 65]]) {
            ellipse(context, x, y, 3.3, 3.3, brass);
          }
        });
        break;
      case "lettre-relais":
        rounded(context, 32, 52, 108, 67, 8, "#d8b68b");
        path(context, [[36, 57], [86, 95], [136, 57]], ivory);
        stroke(context, [[40, 111], [70, 86]], "#b88561", 1.8);
        stroke(context, [[130, 111], [102, 86]], "#b88561", 1.8);
        ellipse(context, 86, 90, 13, 12, cranberry);
        star(context, 86, 90, 7, brass);
        break;
      case "booster-noel":
        cardObject(context, "#9e3e4b", brass, () => {
          for (let x = 49; x < 127; x += 9) {
            stroke(context, [[x, 35], [x + 3, 44]], "#de8d79", 2);
            stroke(context, [[x, 121], [x + 3, 130]], "#de8d79", 2);
          }
          star(context, 86, 80, 30, "#f6d593");
          ellipse(context, 86, 80, 12, 12, "#ad4a51");
          star(context, 86, 80, 10, ivory);
        });
        break;
      case "vignette-renne":
        cardObject(context, "#bd9864", ivory, () => {
          rounded(context, 51, 44, 70, 69, 5, "#22494f");
          ellipse(context, 86, 88, 18, 21, "#c48d68");
          stroke(context, [[76, 78], [67, 62], [69, 52]], ivory, 2.5);
          stroke(context, [[97, 78], [105, 62], [103, 52]], ivory, 2.5);
          stroke(context, [[68, 63], [59, 57]], ivory, 2);
          stroke(context, [[105, 63], [113, 58]], ivory, 2);
          ellipse(context, 80, 86, 2.5, 2.5, ink);
          ellipse(context, 93, 86, 2.5, 2.5, ink);
          ellipse(context, 86, 100, 6, 4, cranberry);
        });
        break;
      default:
        rounded(context, 49, 72, 74, 52, 5, cranberry);
        rounded(context, 45, 62, 82, 15, 4, "#bb4d57");
        stroke(context, [[86, 62], [86, 123]], brass, 7);
        ellipse(context, 77, 58, 12, 5, brass, .38);
        ellipse(context, 95, 58, 12, 5, brass, -.38);
    }
    context.restore();
  };
})();
