/** Clean architectural miniatures for the team's infrastructure district. */
export function createCampusBuilding(THREE, variant, level, sponsorColors) {
  const group = new THREE.Group();
  group.name = `campus-${variant}`;
  const colors = {
    stone: 0xe7e4d7,
    roof: 0x294d43,
    trim: 0xf3f0e5,
    glass: 0x6f9697,
    darkGlass: 0x34575b,
    frame: 0x26483f,
    timber: 0xb5a184,
    metal: 0x9daaa7,
    lawn: 0x799278,
    track: 0xbca784,
    gravel: 0xc8cbc0,
  };
  const hasSponsor = level > 0 && /^#[0-9a-f]{6}$/i.test(sponsorColors?.primary ?? "");
  function sponsorTint(neutral, sponsorColor, strength) {
    if (!/^#[0-9a-f]{6}$/i.test(sponsorColor ?? "")) return neutral;
    return new THREE.Color(neutral).lerp(new THREE.Color(sponsorColor), strength).getHex();
  }
  // Keep stone, glazing, timber and planting local to the architecture. The
  // sponsor owns the painted roof metal, selected facade panels and fascias.
  colors.roofTrim = colors.trim;
  colors.sponsorSecondary = colors.trim;
  colors.sponsorAccent = colors.trim;
  if (hasSponsor) {
    colors.roof = sponsorTint(0x46545b, sponsorColors.primary, 0.86);
    colors.frame = sponsorTint(colors.frame, sponsorColors.primary, 0.64);
    colors.roofTrim = sponsorTint(colors.trim, sponsorColors.secondary, 0.55);
    colors.sponsorSecondary = sponsorTint(colors.trim, sponsorColors.secondary, 0.78);
    colors.sponsorAccent = sponsorTint(colors.trim, sponsorColors.accent, 0.78);
  }
  const materials = new Map();
  function material(color) {
    const value = typeof color === "string" ? colors[color] : color;
    const role = typeof color === "string" ? color : "custom";
    const key = `${role}:${value}`;
    if (!materials.has(key)) {
      const finish = new THREE.MeshStandardMaterial({
        color: value,
        roughness: 0.95,
        metalness: 0,
      });
      finish.userData.campusRole = role;
      materials.set(key, finish);
    }
    return materials.get(key);
  }
  function mesh(geometry, color, x, y, z, detail = false) {
    const object = new THREE.Mesh(geometry, material(color));
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.detail = detail;
    group.add(object);
    return object;
  }
  function box(w, h, d, x, y, z, color, detail = false) {
    return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, detail);
  }
  function cylinder(r, h, x, y, z, color, detail = false, segments = 32) {
    return mesh(new THREE.CylinderGeometry(r, r, h, segments), color, x, y, z, detail);
  }
  function slab(w, d, x, y, z, color = "trim", detail = false) {
    return box(w, 0.2, d, x, y, z, color, detail);
  }
  function volume(w, h, d, x, bottom, z, color = "stone") {
    box(w, h, d, x, bottom + h / 2, z, color);
    slab(w + 0.45, d + 0.45, x, bottom + h + 0.1, z, "roofTrim");
    return { w, h, d, x, bottom, z };
  }
  function windows(block, floors = 2, columns = 4, front = true, sides = true) {
    const { w, h, d, x, bottom, z } = block;
    const floorH = h / floors;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = bottom + (floor + 0.5) * floorH;
      if (front) {
        for (let col = 0; col < columns; col += 1) {
          box(w / columns - 0.3, floorH - 0.48, 0.075,
            x - w / 2 + (col + 0.5) * w / columns, y, z + d / 2 + 0.05,
            floor % 2 ? "glass" : "darkGlass", true);
        }
        box(w - 0.3, 0.14, 0.11, x, bottom + floor * floorH + 0.1, z + d / 2 + 0.08, "frame", true);
      }
      if (sides) {
        const sideCols = Math.max(2, Math.round(d / 2.7));
        for (let col = 0; col < sideCols; col += 1) {
          box(0.075, floorH - 0.48, d / sideCols - 0.3,
            x + w / 2 + 0.05, y, z - d / 2 + (col + 0.5) * d / sideCols,
            "glass", true);
        }
      }
    }
  }
  function roofInset(w, d, x, y, z, color = "roof") {
    slab(w - 0.45, d - 0.45, x, y + 0.19, z, color);
  }
  function entrance(x, z, width = 2.3, height = 2.2) {
    box(width, height, 0.12, x, height / 2 + 0.12, z, "darkGlass", true);
    box(0.06, height, 0.16, x, height / 2 + 0.12, z + 0.03, "trim", true);
    slab(width + 1.2, 1.5, x, 0.09, z + 0.45, "stone", true);
  }
  function planter(w, d, x, y, z) {
    box(w, 0.38, d, x, y + 0.19, z, "stone", true);
    box(w - 0.2, 0.28, d - 0.2, x, y + 0.51, z, "lawn", true);
  }
  function solar(w, d, x, y, z) {
    const panel = box(w, 0.12, d, x, y, z, "darkGlass", true);
    panel.rotation.x = -0.12;
    for (let index = 1; index < 4; index += 1) {
      box(0.045, 0.15, d, x - w / 2 + index * w / 4, y + 0.02, z, "metal", true);
    }
  }
  function courtyardTree(x, z) {
    cylinder(1.5, 0.23, x, 0.12, z, "stone", true);
    cylinder(1.25, 0.24, x, 0.25, z, "lawn", true);
    cylinder(0.16, 2.6, x, 1.6, z, "timber", true, 10);
    const crown = mesh(new THREE.IcosahedronGeometry(1.5, 1), "lawn", x, 3.15, z, true);
    crown.scale.set(1.0, 1.15, 0.95);
  }
  function ellipseRing(rx, rz, innerX, innerZ, height, y, color) {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, innerX, innerZ, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: false, curveSegments: 48,
    });
    geometry.rotateX(-Math.PI / 2);
    return mesh(geometry, color, 0, y, 0);
  }

  if (variant === "data") {
    const tower = volume(13.5, 7.6, 8.8, 0, 0.15, -0.4, "frame");
    windows(tower, 3, 5);
    box(0.65, 7.65, 8.95, -6.3, 3.95, -0.4, "timber");
    box(0.65, 7.65, 8.95, 6.3, 3.95, -0.4, "timber");
    roofInset(13.5, 8.8, 0, 7.85, -0.4);
    solar(8, 4.3, -0.4, 8.3, -1.0);
    const canopy = slab(5.8, 2.5, 0, 2.7, 4.8, hasSponsor ? "sponsorAccent" : "trim");
    canopy.userData.detail = true;
    entrance(0, 4.06, 2.8);
  } else if (variant === "academy") {
    const left = volume(4, 5.3, 12.4, -6.3, 0.15, 0, "stone");
    const right = volume(4, 5.3, 12.4, 6.3, 0.15, 0, "timber");
    const rear = volume(9, 5.3, 3.6, 0, 0.15, -4.4, "frame");
    windows(left, 2, 2);
    windows(right, 2, 2);
    windows(rear, 2, 4);
    roofInset(4, 12.4, -6.3, 5.55, 0);
    roofInset(4, 12.4, 6.3, 5.55, 0);
    roofInset(9, 3.6, 0, 5.55, -4.4);
    slab(8.5, 8, 0, 0.05, 1.4, "gravel", true);
    courtyardTree(0, 0.5);
    entrance(0, -2.52, 2.2);
  } else if (variant === "training") {
    const gym = volume(13.2, 4.7, 9.2, -3, 0.15, -1.3, "frame");
    const wing = volume(7, 3.5, 7.4, 6.2, 0.15, 1.1, "stone");
    windows(gym, 1, 5);
    windows(wing, 1, 2);
    roofInset(13.2, 9.2, -3, 4.95, -1.3);
    roofInset(7, 7.4, 6.2, 3.75, 1.1);
    box(5.8, 1.15, 3.4, -3.5, 5.55, -2.3, "timber");
    slab(5.8, 3.4, -3.5, 6.18, -2.3, "roof");
    slab(18.5, 1.4, 0, 3.9, 5.2, hasSponsor ? "sponsorSecondary" : "trim", true);
    for (const x of [-7.5, -2.5, 3.1, 8.5]) {
      box(0.13, 3.8, 0.13, x, 2, 5.2, "frame", true);
    }
    entrance(4.5, 4.87, 2.4);
  } else if (variant === "classics") {
    const hall = volume(17.6, 3.9, 5.5, 0, 0.15, -2.8, "stone");
    windows(hall, 1, 6);
    roofInset(17.6, 5.5, 0, 4.15, -2.8);
    for (const x of [-5.1, 1]) {
      box(3.8, 0.8, 2.9, x, 4.65, -2.7, "glass");
      slab(4, 3.1, x, 5.13, -2.7, "roof");
    }
    const tower = volume(3.3, 5.5, 4.4, 6.7, 0.15, -2.6, "frame");
    windows(tower, 2, 1);
    roofInset(3.3, 4.4, 6.7, 5.75, -2.6);
    entrance(-1.7, 0.01, 2.3);
    // A flat cobbled practice loop sits against the technical hall.
    const loop = ellipseRing(9, 2.65, 7.4, 1.35, 0.14, 0.12, "track");
    loop.position.z = 3.9;
    for (let index = 0; index < 16; index += 1) {
      const angle = Math.PI * 2 * index / 16;
      const sector = box(0.55, 0.1, 0.95,
        Math.cos(angle) * 8.2, 0.3, 3.9 + Math.sin(angle) * 2,
        index % 2 ? "gravel" : "stone", true);
      sector.rotation.y = -angle;
    }
    planter(2.8, 1.4, -5.5, 0.03, 3.8);
    planter(2.8, 1.4, 4.9, 0.03, 3.8);
  } else if (variant === "hills") {
    const pavilion = volume(7.6, 3.2, 5.3, -1.6, 0.15, -0.7, "timber");
    windows(pavilion, 1, 3);
    const roof = slab(8.2, 5.9, -1.6, 3.9, -0.7, "roof");
    roof.rotation.z = -0.1;
    entrance(-1.4, 2.01, 2.1);
    // The loop itself rises and falls, with a low planted embankment below it.
    const segments = 48;
    function rollingRibbon(rx, rz, width, elevation, color, groundSides) {
      const vertices = [];
      const indices = [];
      for (let index = 0; index <= segments; index += 1) {
        const angle = index * Math.PI * 2 / segments;
        const y = 0.25 + 1.1 * Math.pow((1 + Math.cos(angle - 0.35)) / 2, 2) + elevation;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        vertices.push((rx - width / 2) * cosine, y, (rz - width / 2) * sine);
        vertices.push((rx + width / 2) * cosine, y, (rz + width / 2) * sine);
        if (groundSides) {
          vertices.push((rx - width / 2) * cosine, 0.08, (rz - width / 2) * sine);
          vertices.push((rx + width / 2) * cosine, 0.08, (rz + width / 2) * sine);
        }
        if (index < segments) {
          const stride = groundSides ? 4 : 2;
          const a = index * stride;
          const b = a + stride;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
          if (groundSides) {
            indices.push(a + 2, b + 2, a, a, b + 2, b);
            indices.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return mesh(geometry, color, 0, 0, 0.55);
    }
    rollingRibbon(8.05, 5.1, 2.4, -0.04, "lawn", true);
    rollingRibbon(8.05, 5.1, 1.1, 0.02, "gravel", false);
    for (const x of [-0.6, 1, 2.6]) {
      box(0.7, 0.09, 0.08, x, 0.2, 3.35, "trim", true);
    }
  } else if (variant === "mountain") {
    const lodge = volume(11.5, 4.5, 7.8, -2, 0.15, -1.4, "timber");
    const annex = volume(6.2, 2.8, 6.1, 5.6, 0.15, 1, "stone");
    windows(lodge, 2, 4);
    windows(annex, 1, 2);
    box(11.5, 1, 0.13, -2, 0.65, 2.56, "stone");
    function pitchedRoof(width, depth, x, eave, rise, z) {
      const profile = new THREE.Shape();
      profile.moveTo(-width / 2, eave);
      profile.lineTo(0, eave + rise);
      profile.lineTo(width / 2, eave);
      profile.closePath();
      return mesh(new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false }),
        "roof", x, 0, z - depth / 2);
    }
    pitchedRoof(12.3, 8.6, -2, 4.95, 2.45, -1.4);
    pitchedRoof(6.8, 6.7, 5.6, 3.25, 1.5, 1);
    slab(8.8, 1.1, -2, 2.5, 2.85, "timber", true);
    box(8.8, 0.12, 0.12, -2, 3.15, 3.36, "timber", true);
    for (const x of [-6.1, -3.4, -0.6, 2.1]) box(0.1, 0.65, 0.1, x, 2.82, 3.36, "timber", true);
    entrance(5.5, 4.11, 2.1);
    // A short graded test ramp, rather than a decorative mountain, identifies the base.
    const rampProfile = new THREE.Shape();
    rampProfile.moveTo(-7.7, 0.1);
    rampProfile.lineTo(0.8, 0.1);
    rampProfile.lineTo(0.8, 1.35);
    rampProfile.closePath();
    mesh(new THREE.ExtrudeGeometry(rampProfile, { depth: 2.1, bevelEnabled: false }),
      "gravel", 0, 0, 4.4);
    const handrail = box(8.7, 0.09, 0.09, -3.4, 1.42, 6.45, "metal", true);
    handrail.rotation.z = 0.146;
    for (const x of [-7.3, -3.5, 0.4]) {
      const height = 0.75 + (x + 7.7) * 1.25 / 8.5;
      box(0.08, 0.72, 0.08, x, height - 0.36, 6.45, "metal", true);
    }
  } else if (variant === "track") {
    ellipseRing(10.2, 6.3, 9.7, 5.8, 3.25, 0.15, "darkGlass");
    ellipseRing(10.7, 6.8, 8.8, 4.9, 0.35, 3.4, "roof");
    ellipseRing(10.76, 6.86, 10.48, 6.58, 0.12, 3.77, "trim");
    ellipseRing(8.7, 4.8, 6.4, 2.8, 0.15, 0.18, "track");
    const field = cylinder(1, 0.12, 0, 0.2, 0, "lawn");
    field.scale.set(6.3, 1, 2.7);
    for (let index = 0; index < 28; index += 1) {
      const angle = index * Math.PI * 2 / 28;
      box(0.13, 3.1, 0.13, Math.cos(angle) * 10.2, 1.75,
        Math.sin(angle) * 6.3, "frame", true);
    }
    const foyer = volume(6.6, 2.5, 2.4, 0, 0.15, 5.7, "stone");
    windows(foyer, 1, 3);
    entrance(0, 6.96, 2.5);
  } else if (variant === "office") {
    const left = volume(4.5, 7.9, 11.6, -6.8, 0.15, -0.4, "frame");
    const right = volume(4.5, 7.9, 11.6, 6.8, 0.15, -0.4, "frame");
    const rear = volume(10, 7.9, 3.8, 0, 0.15, -4.3, "stone");
    windows(left, 3, 2);
    windows(right, 3, 2);
    windows(rear, 3, 4);
    roofInset(4.5, 11.6, -6.8, 8.15, -0.4);
    roofInset(4.5, 11.6, 6.8, 8.15, -0.4);
    roofInset(10, 3.8, 0, 8.15, -4.3, "lawn");
    slab(8.8, 3.2, 0, 3.15, 4.7, hasSponsor ? "sponsorAccent" : "trim", true);
    for (const x of [-3.8, 3.8]) box(0.17, 3.05, 0.17, x, 1.65, 5.4, "frame", true);
    slab(8.7, 6.5, 0, 0.04, 1.8, "gravel", true);
    courtyardTree(0, 0.5);
  } else if (variant === "tube") {
    const hall = volume(17, 5.6, 7.3, 0, 0.15, -2.4, "frame");
    windows(hall, 2, 6);
    roofInset(17, 7.3, 0, 5.85, -2.4);
    const tube = cylinder(2.28, 6.1, -4.2, 2.6, 3.05, "stone");
    tube.rotation.x = Math.PI / 2;
    const face = cylinder(2.03, 0.12, -4.2, 2.6, 6.16, "darkGlass");
    face.rotation.x = Math.PI / 2;
    for (const z of [0.2, 3, 5.85]) {
      const ring = mesh(new THREE.TorusGeometry(2.29, 0.055, 6, 48), "metal", -4.2, 2.6, z, true);
      ring.rotation.z = 0;
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      const blade = box(0.3, 1.65, 0.08,
        -4.2 + Math.sin(angle) * 1.02, 2.6 + Math.cos(angle) * 1.02,
        6.25, "metal", true);
      blade.rotation.z = -angle;
    }
    const hub = cylinder(0.35, 0.18, -4.2, 2.6, 6.3, "frame", true);
    hub.rotation.x = Math.PI / 2;
    for (const z of [0.9, 4.8]) box(2.9, 0.5, 0.8, -4.2, 0.38, z, "stone");
    entrance(5.5, 1.32, 2.3);
  } else if (variant === "weather") {
    cylinder(3.1, 3.5, -3.2, 1.9, -1.3, "stone");
    cylinder(3.25, 0.22, -3.2, 3.78, -1.3, "trim");
    mesh(new THREE.SphereGeometry(3.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      "trim", -3.2, 3.85, -1.3);
    const lab = volume(8.2, 2.8, 6.5, 4.1, 0.15, 1.6, "stone");
    windows(lab, 1, 3);
    roofInset(8.2, 6.5, 4.1, 3.05, 1.6);
    cylinder(0.1, 7.7, 5.5, 4, -3.2, "metal", true, 10);
    for (const y of [4.4, 5.7, 7.1]) {
      box(2.9, 0.1, 0.1, 5.5, y, -3.2, "trim", true);
      for (const x of [4.1, 6.9]) cylinder(0.17, 0.2, x, y + 0.17, -3.2, "metal", true, 12);
    }
    box(0.8, 0.75, 0.8, -0.1, 0.5, 4.9, "trim", true);
    entrance(4, 4.91, 1.7);
  } else if (variant === "welcome") {
    const lower = volume(19, 2.8, 11.4, 0, 0.15, 0.4, "stone");
    const middle = volume(14.8, 2.55, 8.3, 0.8, 3.15, -1.15, "stone");
    const upper = volume(9.2, 2.4, 5.3, 1.8, 5.9, -2.65, "frame");
    windows(lower, 1, 6);
    windows(middle, 1, 5);
    windows(upper, 1, 3);
    roofInset(9.2, 5.3, 1.8, 8.4, -2.65);
    for (const x of [-6.8, -2.5, 1.8, 6]) planter(3.2, 0.7, x, 3.18, 5.4);
    for (const x of [-4.2, 0, 4.2]) planter(3.2, 0.7, x, 5.93, 2.55);
    entrance(0, 6.16, 2.3);
  } else if (variant === "club") {
    const hall = volume(15.5, 3.6, 9, 0, 0.15, -0.8, "timber");
    windows(hall, 1, 5);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-8.2, 3.8);
    roofShape.lineTo(0, 6.3);
    roofShape.lineTo(8.2, 3.8);
    roofShape.closePath();
    const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 10.2, bevelEnabled: false });
    mesh(roof, "roof", 0, 0, -5.9);
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-6.7, 3.9);
    gableShape.lineTo(0, 5.96);
    gableShape.lineTo(6.7, 3.9);
    gableShape.closePath();
    mesh(new THREE.ShapeGeometry(gableShape), "glass", 0, 0, 4.32, true);
    box(0.12, 2.15, 0.1, 0, 4.9, 4.4, "timber", true);
    entrance(0, 3.76, 2.1);
    for (const x of [-5.6, 0, 5.6]) {
      cylinder(0.95, 0.12, x, 0.9, 6.1, "timber", true, 24);
      cylinder(0.1, 0.85, x, 0.45, 6.1, "frame", true, 8);
      cylinder(0.055, 2.45, x, 1.3, 6.1, "frame", true, 8);
      mesh(new THREE.ConeGeometry(1.45, 0.55, 16), "roof", x, 2.52, 6.1, true);
      for (const delta of [-1.3, 1.3]) box(0.7, 0.58, 0.65, x + delta, 0.4, 6.1, "timber", true);
    }
  } else if (variant === "cryo") {
    const clinic = volume(11.8, 3.8, 8.4, -1.8, 0.15, 0, "stone");
    windows(clinic, 1, 4);
    cylinder(3.6, 3.8, 4.1, 2.05, 0, "stone");
    cylinder(3.85, 0.25, 4.1, 4.1, 0, "roof");
    roofInset(11.8, 8.4, -1.8, 4.05, 0);
    slab(6.8, 2.2, -1.5, 2.9, 4.7, "trim", true);
    entrance(-1.5, 4.26, 2.2);
  } else if (variant === "lab") {
    const west = volume(10.5, 4.5, 8.2, -4, 0.15, -1.3, "stone");
    const east = volume(8.5, 5.6, 9.8, 5.2, 0.15, 0.1, "frame");
    windows(west, 2, 4);
    windows(east, 2, 3);
    roofInset(10.5, 8.2, -4, 4.75, -1.3);
    roofInset(8.5, 9.8, 5.2, 5.85, 0.1);
    for (const x of [-7, -3.8, -0.6]) box(1.7, 0.45, 3.2, x, 5.15, -1.5, "glass", true);
    const connector = volume(5.7, 2.4, 3.1, -0.4, 0.15, 4.6, "glass");
    windows(connector, 1, 2);
    entrance(-0.4, 6.21, 2.1);
  } else if (variant === "media") {
    const studio = volume(13.4, 3.1, 9.2, 1.2, 0.15, -0.6, "stone");
    windows(studio, 1, 4);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-6.9, 3.3);
    roofShape.lineTo(6.9, 3.3);
    roofShape.bezierCurveTo(6.5, 6.5, -6.5, 6.5, -6.9, 3.3);
    roofShape.closePath();
    const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 9.7, bevelEnabled: false, curveSegments: 24 });
    mesh(roof, "roof", 1.2, 0, -5.5);
    const annex = volume(5.4, 4.1, 5.5, -6.7, 0.15, 2.6, "timber");
    windows(annex, 2, 2);
    cylinder(0.16, 1.6, 4.1, 5.2, -0.5, "metal", true);
    const dish = mesh(new THREE.SphereGeometry(1.65, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      "trim", 4.1, 5.9, -0.5, true);
    dish.rotation.x = Math.PI * 0.73;
    entrance(1.5, 4.06, 2.3);
  } else if (variant === "shop") {
    const shop = volume(16.8, 3.5, 8.4, 0, 0.15, -0.5, "stone");
    windows(shop, 1, 6);
    roofInset(16.8, 8.4, 0, 3.75, -0.5);
    slab(17.4, 2.2, 0, 3.05, 4.4, "roof", true);
    box(7, 0.65, 0.15, 0, 3.15, 3.78, "timber", true);
    for (const x of [-7.9, 7.9]) box(0.15, 2.8, 0.15, x, 1.5, 5.1, "frame", true);
    entrance(0, 3.77, 2.1);
  } else {
    const office = volume(14.5, 5.8, 9.5, 0, 0.15, -0.5, "stone");
    windows(office, 2, 5);
    roofInset(14.5, 9.5, 0, 6.05, -0.5);
    entrance(0, 4.31, 2.4);
  }

  if (level === 0) {
    const edges = [];
    const ghostMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7e4df,
      transparent: true,
      opacity: 0.22,
      roughness: 1,
      depthWrite: false,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x94b4a7,
      transparent: true,
      opacity: 0.75,
    });
    group.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;
      if (object.userData.detail) {
        object.visible = false;
        return;
      }
      object.material = ghostMaterial;
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 35), edgeMaterial);
      line.position.copy(object.position);
      line.rotation.copy(object.rotation);
      line.scale.copy(object.scale);
      edges.push(line);
    });
    group.add(...edges);
  }
  group.userData.variant = variant;
  group.userData.level = level;
  return group;
}
