/** Matte, static details for the team's active construction sites. */
export function createCampusConstruction(THREE, level, existingModel = null) {
  const group = new THREE.Group();
  group.name = "campus-construction";
  group.userData.constructionPhase = level > 0 ? "upgrade" : "new";
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map();
  function box(x, y, z, width, height, depth, color) {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({
        color, roughness: 1, metalness: 0,
      }));
    }
    const mesh = new THREE.Mesh(geometry, materials.get(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = height > 0.12;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  const steel = "#919b91";
  const timber = "#baa886";
  const safety = "#bca05d";
  const pale = "#ece5cc";

  if (level === 0) {
    // Open structural bays and low masonry replace the transparent future model.
    box(0, 0.04, 0, 19.2, 0.12, 14.4, "#b9b49d");
    box(0, 0.17, 0, 16.4, 0.22, 11.8, "#d3d1c0");
    box(0, 2.3, 0, 14.4, 0.2, 10.2, "#d3d1c0");
    for (const x of [-6.6, -2.2, 2.2, 6.6]) {
      for (const z of [-4.6, 4.6]) box(x, 2.26, z, 0.3, 4.2, 0.3, steel);
    }
    for (const z of [-4.6, 4.6]) box(0, 4.36, z, 13.6, 0.23, 0.3, steel);
    for (const x of [-6.6, 6.6]) box(x, 4.36, 0, 0.3, 0.23, 9.5, steel);
    box(0, 0.9, -4.55, 13.5, 1.2, 0.3, "#c6c2ad");
    box(-6.55, 0.9, 0, 0.3, 1.2, 9.3, "#c6c2ad");

    // A single scaffold deck, stacks and a covered pallet suggest an active site.
    scaffold(-8.4, 8.4, -5.9, 5.9, 4.65);
    box(-5.6, 0.6, 4.8, 2.3, 0.8, 1.35, timber);
    box(-5.6, 1.08, 4.8, 2.1, 0.16, 1.2, "#c8b99c");
    box(4.7, 0.58, 4.6, 2.5, 0.9, 1.8, "#758f80");
    box(4.7, 1.07, 4.6, 2.65, 0.1, 1.95, "#819789");
    barriers(7.3, 9.3);
  } else if (existingModel) {
    const bounds = new THREE.Box3().setFromObject(existingModel);
    const left = bounds.min.x - 0.7;
    const right = bounds.max.x + 0.7;
    const back = bounds.min.z - 0.55;
    const front = bounds.max.z + 0.6;
    scaffold(left, right, back, front, bounds.max.y + 0.45);
    // A small canvas cover on the rear wing leaves the sponsor roof legible.
    box(left + 2.4, bounds.max.y + 0.12, back + 2.4, 3.6, 0.12, 2.6, "#7c9486");
    barriers(front + 0.75, Math.min(9.3, (right - left) / 2));
  }
  return group;

  function scaffold(left, right, back, front, height) {
    const width = right - left;
    const depth = front - back;
    const bays = Math.max(3, Math.ceil(width / 4.5));
    for (let bay = 0; bay <= bays; bay += 1) {
      const x = left + width * bay / bays;
      box(x, height / 2, front, 0.12, height, 0.12, steel);
      box(x, height / 2, back, 0.12, height, 0.12, steel);
    }
    for (const y of [2.15, height - 0.16]) {
      box((left + right) / 2, y, front, width + 0.25, 0.1, 0.12, steel);
      box((left + right) / 2, y, back, width + 0.25, 0.1, 0.12, steel);
      box(left, y, (front + back) / 2, 0.12, 0.1, depth, steel);
      box(right, y, (front + back) / 2, 0.12, 0.1, depth, steel);
    }
    const deckHeight = Math.min(3.55, height - 0.9);
    box((left + right) / 2, deckHeight, front, width + 0.3, 0.13, 0.7, timber);
    box(left, deckHeight, (front + back) / 2, 0.7, 0.13, depth, timber);
    for (const x of [left, right]) {
      const brace = box(x, height / 2, (front + back) / 2, 0.09, height * 0.96, 0.1, steel);
      brace.rotation.x = 0.55;
    }
  }

  function barriers(z, halfWidth) {
    for (const side of [-1, 1]) {
      const x = side * (halfWidth / 2 + 0.8);
      box(x, 0.84, z, halfWidth - 1.1, 1.12, 0.14, pale);
      box(x, 0.88, z + 0.08, halfWidth - 1.1, 0.3, 0.03, safety);
      for (const offset of [-1.1, 1.1]) {
        box(x + offset, 0.63, z, 0.12, 1.25, 0.15, steel);
        box(x + offset, 0.1, z, 0.6, 0.16, 0.6, "#8e9688");
      }
    }
  }
}
