import * as THREE from "three";

import { createCampusBuilding } from "./campus-models.js";
import { createCampusConstruction } from "./campus-construction.js";
import { createCampusSponsorBranding } from "./campus-sponsor-branding.js";

/** Static city-builder scene with matte materials and the team's sponsor identity. */
export function createCampusScene(canvas, buildings, onLayout, sponsor = null) {
  let disposed = false;
  let sceneReady = false;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9e2d3");
  const camera = new THREE.OrthographicCamera(-110, 110, 75, -75, 0.1, 650);
  camera.position.set(80, 165, 210);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();

  scene.add(new THREE.HemisphereLight("#f2f7f5", "#b3c2a5", 1.15));
  const daylight = new THREE.DirectionalLight("#ffffff", 2.15);
  daylight.position.set(-60, 105, 55);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.camera.left = -112;
  daylight.shadow.camera.right = 112;
  daylight.shadow.camera.top = 125;
  daylight.shadow.camera.bottom = -125;
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 250;
  daylight.shadow.bias = -0.00015;
  daylight.shadow.normalBias = 0.08;
  scene.add(daylight);

  const materials = new Map();
  function material(color, extra = {}) {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        metalness: 0,
        ...extra,
      }));
    }
    return materials.get(key);
  }

  function block(parent, x, y, z, width, height, depth, color) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = height > 0.1;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function disc(parent, x, z, radius, color, y = 0.035) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), material(color));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const district = new THREE.Group();
  scene.add(district);
  block(district, 0, -0.25, 0, 1000, 0.45, 1000, "#b6c59f");
  const branding = sponsor ? createCampusSponsorBranding(THREE, sponsor, () => {
    if (!disposed && sceneReady) render();
  }) : null;
  if (branding) {
    branding.entrance.position.set(15, 0.1, 100);
    district.add(branding.entrance);
  }

  // Through avenues with proper raised pavements, rather than isolated pads.
  const roadColor = "#78857f";
  const pavement = "#e6e2d3";
  const marking = "#eeeede";
  const streetRows = [-49, -19, 13, 46, 78];
  streetRows.forEach((z) => {
    block(district, 0, 0.005, z, 168, 0.09, 10.2, pavement);
    block(district, 0, 0.072, z, 166, 0.055, 6.6, roadColor);
    block(district, 0, 0.11, z + 2.5, 166, 0.018, 0.1, "#c7d4b9");
    block(district, 0, 0.11, z - 2.5, 166, 0.018, 0.1, "#c7d4b9");
    for (let x = -78; x < 80; x += 5.3) {
      block(district, x, 0.115, z, 2.5, 0.018, 0.11, marking);
    }
  });
  [-79, 79].forEach((x) => {
    block(district, x, 0.015, 14.5, 9.6, 0.1, 131, pavement);
    block(district, x, 0.085, 14.5, 6, 0.05, 130, roadColor);
    for (let z = -44; z < 77; z += 5.3) {
      block(district, x, 0.125, z, 0.11, 0.018, 2.5, marking);
    }
  });

  if (branding) {
    // The sponsor entrance crosses a real access road into the district.
    block(district, 15, 0.025, 94, 10.4, 0.1, 33, pavement);
    block(district, 15, 0.095, 94, 7, 0.05, 32.8, roadColor);
    for (const z of [84, 89, 94, 99, 104, 109]) {
      block(district, 15, 0.135, z, 0.11, 0.018, 2.1, marking);
    }
  }

  // Crossings at the junctions make the road network read as a small town.
  [-68, 3, 67].forEach((x) => {
    [-19, 13, 46, 78].forEach((z) => {
      for (let stripe = -2.4; stripe <= 2.4; stripe += 0.8) {
        block(district, x + stripe, 0.125, z, 0.46, 0.02, 5.8, marking);
      }
    });
  });

  const lotGroups = [];
  const treePositions = [];
  buildings.forEach((building) => {
    const x = (building.x / 1536 - 0.5) * 142;
    const z = (building.y / 1024 - 0.5) * 98;
    const lot = new THREE.Group();
    lot.position.set(x, 0, z);
    district.add(lot);

    const plotWidth = building.variant === "track" ? 26 : 24;
    const plotDepth = building.variant === "track" ? 20 : 18.6;
    block(lot, 0, 0.025, 0, plotWidth, 0.08, plotDepth,
      building.construction ? "#c9c4af" : building.level ? "#dce0ce" : "#d2d7c8");
    // A front forecourt and access path physically connect the lot to its avenue.
    block(lot, 0, 0.07, plotDepth / 2 + 1, 7, 0.05, 3, pavement);
    if (building.level) {
      block(lot, -plotWidth / 2 + 0.5, 0.17, 0, 0.45, 0.25, plotDepth - 1, "#78916b");
      block(lot, plotWidth / 2 - 0.5, 0.17, -2.2, 0.45, 0.25, plotDepth - 5.4, "#78916b");
    }

    const model = building.construction && building.level === 0
      ? createCampusConstruction(THREE, 0)
      : createCampusBuilding(THREE, building.variant, building.level, sponsor?.colors);
    if (building.construction && building.level > 0) {
      model.add(createCampusConstruction(THREE, building.level, model));
      model.userData.constructionPhase = "upgrade";
    }
    branding?.decorateBuilding(model, building.variant, building.level);
    model.scale.set(1.18, 1.18, 1.12);
    model.position.y = 0.11;
    lot.add(model);
    lot.updateMatrixWorld(true);
    const modelBounds = new THREE.Box3().setFromObject(model);

    const ring = new THREE.Group();
    ring.visible = false;
    const ringColor = "#d2b66d";
    const halfWidth = plotWidth / 2 + 0.15;
    const halfDepth = plotDepth / 2 + 0.15;
    block(ring, 0, 0.14, -halfDepth, plotWidth + 0.5, 0.055, 0.13, ringColor);
    block(ring, 0, 0.14, halfDepth, plotWidth + 0.5, 0.055, 0.13, ringColor);
    block(ring, -halfWidth, 0.14, 0, 0.13, 0.055, plotDepth + 0.4, ringColor);
    block(ring, halfWidth, 0.14, 0, 0.13, 0.055, plotDepth + 0.4, ringColor);
    lot.add(ring);
    lotGroups.push({ code: building.code, level: building.level, modelBounds, ring });

    // Two restrained planted strips per built plot. Trees sit beside, not on roofs.
    if (building.level) {
      treePositions.push([x - plotWidth / 2 + 1.2, z + plotDepth / 2 - 1.5, 0.68]);
      treePositions.push([x + plotWidth / 2 - 1.6, z - plotDepth / 2 + 1.1, 0.74]);
    }
  });

  // A planted square with a cycle sculpture between the middle and front rows.
  const plaza = new THREE.Group();
  plaza.position.set(2, 0, 1.2);
  district.add(plaza);
  disc(plaza, 0, 0, 7.4, pavement, 0.05);
  disc(plaza, 0, 0, 3.5, "#a9bd8a", 0.09);
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.45, 40), material("#d5d3bd"));
  planter.position.y = 0.3;
  planter.receiveShadow = true;
  plaza.add(planter);
  treePositions.push([2, 1.2, 0.9]);
  [-1, 1].forEach((side) => {
    block(plaza, side * 5.1, 0.7, 0, 0.9, 0.16, 2.3, "#b5a588");
    [-0.7, 0.7].forEach((z) => block(plaza, side * 5.1, 0.37, z, 0.28, 0.6, 0.22, "#485f54"));
  });

  // Quiet border planting frames the neighborhood without noisy leaf textures.
  for (let x = -84; x <= 84; x += 5.6) {
    treePositions.push([x, -57 + Math.sin(x) * 1.3, 0.8 + (Math.abs(x) % 3) * 0.09]);
    if (!branding || Math.abs(x + 1.6 - 15) > 19) {
      treePositions.push([x + 1.6, 88 + Math.cos(x) * 1.4, 0.76 + (Math.abs(x) % 4) * 0.05]);
    }
  }
  [-87, 87].forEach((x) => {
    for (let z = -48; z < 81; z += 6.6) treePositions.push([x, z, 0.75 + Math.abs(z % 3) * 0.07]);
  });
  [-25, 19].forEach((z) => {
    [-66, -40, -9, 21, 49, 68].forEach((x, index) => {
      treePositions.push([x, z, 0.58 + (index % 3) * 0.09]);
    });
  });

  addTrees(treePositions);

  function addTrees(positions) {
    const trunkGeometry = new THREE.CylinderGeometry(0.13, 0.2, 2.5, 7);
    const trunk = new THREE.InstancedMesh(trunkGeometry, material("#8b8068"), positions.length);
    const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
    const leafMaterials = ["#658367", "#75936e", "#8ca17b"].map((color) => material(color, { flatShading: true }));
    const canopies = leafMaterials.map((leafMaterial) => new THREE.InstancedMesh(leafGeometry, leafMaterial, positions.length));
    const pineGeometry = new THREE.ConeGeometry(1, 1, 9);
    const pines = [0, 1].map(() => new THREE.InstancedMesh(pineGeometry, material("#56715e", { flatShading: true }), positions.length));
    const transform = new THREE.Object3D();
    positions.forEach(([x, z, scale], index) => {
      transform.position.set(x, scale * 1.25, z);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(scale, scale, scale);
      transform.updateMatrix();
      trunk.setMatrixAt(index, transform.matrix);
      for (let layer = 0; layer < 3; layer += 1) {
        const isPine = index % 6 === 0;
        transform.position.set(
          x + Math.sin(index * 1.8 + layer * 2.1) * scale * 0.7,
          (3.05 + layer * 0.7) * scale,
          z + Math.cos(index * 1.4 + layer * 2.3) * scale * 0.6,
        );
        transform.rotation.set(index * 0.16, index * 0.79 + layer, 0.13 * layer);
        transform.scale.set(scale * (1.65 - layer * 0.17), scale * (1.65 - layer * 0.12), scale * (1.5 - layer * 0.1));
        if (isPine) transform.scale.set(0, 0, 0);
        transform.updateMatrix();
        canopies[layer].setMatrixAt(index, transform.matrix);
      }
      pines.forEach((pine, layer) => {
        transform.position.set(x, (3.1 + layer * 1.25) * scale, z);
        transform.rotation.set(0, index * 0.7, 0);
        transform.scale.set(scale * (1.55 - layer * 0.4), scale * 3.5, scale * (1.55 - layer * 0.4));
        if (index % 6 !== 0) transform.scale.set(0, 0, 0);
        transform.updateMatrix();
        pine.setMatrixAt(index, transform.matrix);
      });
    });
    [trunk, ...canopies, ...pines].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      district.add(mesh);
    });
  }

  // Street lights are intentionally sparse and scaled to the buildings.
  function streetLight(x, z, direction = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0.08, z);
    block(group, 0, 2.2, 0, 0.12, 4.4, 0.12, "#53665c");
    block(group, direction * 0.45, 4.37, 0, 1.1, 0.13, 0.19, "#53665c");
    block(group, direction * 0.84, 4.3, 0, 0.4, 0.08, 0.3, "#e4e7d9");
    district.add(group);
  }
  [-64, -30, 7, 43, 70].forEach((x) => {
    streetLight(x, -14.6);
    streetLight(x + 3, 17.6, -1);
  });
  [-61, -8, 56].forEach((x) => streetLight(x, 73.4));

  block(district, -22, 0.08, 5.3, 13, 0.07, 4.8, "#929d91");
  for (let parkingX = -27; parkingX <= -16; parkingX += 2.7) {
    block(district, parkingX, 0.13, 5.3, 0.09, 0.02, 4.4, "#e8e8d8");
  }

  function vehicle(x, z, rotation, bus = false, color = "#e1e3d6") {
    const group = new THREE.Group();
    group.position.set(x, 0.12, z);
    group.rotation.y = rotation;
    const length = bus ? 6.9 : 3.2;
    const width = bus ? 2.05 : 1.55;
    const height = bus ? 2 : 0.95;
    block(group, 0, height / 2 + 0.35, 0, width, height, length, color);
    block(group, 0, height + 0.39, 0, width - 0.16, 0.1, length - 0.12, "#f0f0e5");
    block(group, 0, height * 0.77 + 0.4, length / 2 + 0.01, width - 0.19, height * 0.4, 0.03, "#4e6a68");
    [-1, 1].forEach((side) => {
      block(group, side * (width / 2 + 0.01), height * 0.79 + 0.4, 0, 0.035, height * 0.42, length - 0.55, "#4e6a68");
      [-(length / 2 - 0.65), length / 2 - 0.65].forEach((wheelZ) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 12), material("#394c43"));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * width / 2, 0.34, wheelZ);
        wheel.castShadow = true;
        group.add(wheel);
      });
    });
    district.add(group);
  }
  vehicle(63, 8.3, Math.PI / 2, true, "#254c3c");
  vehicle(-65, 46, Math.PI / 2, true, "#dfe4d7");
  vehicle(-38, -19, Math.PI / 2, false, "#e8e5d8");
  vehicle(31, 13, -Math.PI / 2, false, "#426455");
  vehicle(77.5, 27, 0, false, "#b8c7be");
  vehicle(-23.6, 5.3, 0, false, "#dce2d4");
  vehicle(-18.2, 5.3, 0, false, "#6b8275");

  // A few readable bicycle racks at the performance campus and public square.
  function cycle(x, z, angle = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0.1, z);
    group.rotation.y = angle;
    const tubeMaterial = material("#31564b");
    const tireMaterial = material("#465a51");
    const tireGeometry = new THREE.TorusGeometry(0.42, 0.04, 5, 16);
    [-0.66, 0.66].forEach((wheelX) => {
      const wheel = new THREE.Mesh(tireGeometry, tireMaterial);
      wheel.position.set(wheelX, 0.45, 0);
      group.add(wheel);
    });
    function tube(a, b) {
      const start = new THREE.Vector3(...a);
      const end = new THREE.Vector3(...b);
      const vector = end.clone().sub(start);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, vector.length(), 5), tubeMaterial);
      mesh.position.copy(start.add(end).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
      group.add(mesh);
    }
    const rear = [-0.66, 0.45, 0];
    const front = [0.66, 0.45, 0];
    const crank = [-0.09, 0.43, 0];
    const seat = [-0.29, 1.04, 0];
    const handle = [0.41, 1.07, 0];
    [[rear, seat], [seat, crank], [crank, rear], [seat, handle], [handle, crank], [handle, front]].forEach(([a, b]) => tube(a, b));
    block(group, -0.3, 1.11, 0, 0.35, 0.08, 0.17, "#53645a");
    district.add(group);
  }
  [[-4, -25], [-1.5, -25], [1, -25], [38, 38], [40.5, 38]].forEach(([x, z]) => cycle(x, z, 0.2));

  let viewportWidth = 1;
  let viewportHeight = 1;
  const framingPoints = boxCorners(new THREE.Box3(
    new THREE.Vector3(-77, 0, -46), new THREE.Vector3(77, 5.5, 79),
  ));
  lotGroups.forEach(({ modelBounds }) => framingPoints.push(...boxCorners(modelBounds)));
  if (branding) {
    district.updateMatrixWorld(true);
    framingPoints.push(...boxCorners(new THREE.Box3().setFromObject(branding.entrance)));
    framingPoints.push(new THREE.Vector3(15, 0, 111));
  }

  function fitCamera(width, height) {
    camera.updateMatrixWorld(true);
    const aspect = width / height;
    const corners = framingPoints.map((point) => point.clone().applyMatrix4(camera.matrixWorldInverse));
    const minX = Math.min(...corners.map((point) => point.x));
    const maxX = Math.max(...corners.map((point) => point.x));
    const minY = Math.min(...corners.map((point) => point.y));
    const maxY = Math.max(...corners.map((point) => point.y));
    const frustumHeight = Math.max(maxY - minY, (maxX - minX) / aspect) * 1.015;
    const frustumWidth = frustumHeight * aspect;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    camera.left = centerX - frustumWidth / 2;
    camera.right = centerX + frustumWidth / 2;
    camera.top = centerY + frustumHeight / 2;
    camera.bottom = centerY - frustumHeight / 2;
    camera.updateProjectionMatrix();
  }

  function updateLayout() {
    const anchors = lotGroups.map(({ code, modelBounds }) => {
      const corners = boxCorners(modelBounds).map((point) => point.project(camera));
      const minX = Math.min(...corners.map((point) => (point.x + 1) * 50));
      const maxX = Math.max(...corners.map((point) => (point.x + 1) * 50));
      const minY = Math.min(...corners.map((point) => (1 - point.y) * 50));
      const maxY = Math.max(...corners.map((point) => (1 - point.y) * 50));
      return {
        code,
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        width: maxX - minX + 0.8,
        height: maxY - minY + 1.1,
      };
    });
    onLayout(anchors);
  }

  function render() {
    if (disposed) return;
    renderer.render(scene, camera);
  }

  return {
    resize(width, height) {
      if (disposed || width < 1 || height < 1) return;
      viewportWidth = width;
      viewportHeight = height;
      renderer.setSize(viewportWidth, viewportHeight, false);
      fitCamera(viewportWidth, viewportHeight);
      sceneReady = true;
      render();
      updateLayout();
    },
    setState(selectedCode, filter) {
      if (disposed) return;
      let changed = false;
      lotGroups.forEach((lot) => {
        const matches = filter === "all" || (filter === "built" ? lot.level > 0 : lot.level === 0);
        const visible = selectedCode === lot.code && matches;
        if (lot.ring.visible !== visible) {
          lot.ring.visible = visible;
          changed = true;
        }
      });
      if (changed) render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      branding?.dispose();
      const geometries = new Set();
      const meshMaterials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          const values = Array.isArray(object.material) ? object.material : [object.material];
          values.forEach((value) => meshMaterials.add(value));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      meshMaterials.forEach((meshMaterial) => meshMaterial.dispose());
      daylight.shadow.map?.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      // React Strict Mode reuses connected canvases during effect rehearsal.
      if (!canvas.isConnected) renderer.forceContextLoss();
      scene.clear();
    },
  };
}

function boxCorners(box) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}
