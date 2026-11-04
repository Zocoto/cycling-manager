/** Small, deliberately placed sponsor installations for the team's district. */
export function createCampusSponsorBranding(THREE, sponsor, onUpdate = () => {}) {
  const colors = sponsor?.colors ?? {};
  const primary = colors.primary ?? "#173c2e";
  const secondary = colors.secondary ?? "#718a7c";
  const accent = colors.accent ?? "#cfb36c";
  const stone = "#e7e4d7";
  const entrance = new THREE.Group();
  entrance.name = "campus-sponsor-entrance";
  entrance.userData.sponsorName = sponsor?.name ?? "Quartier de l’équipe";

  const resources = new Set();
  const textures = new Set();
  const installations = new Set([entrance]);
  let disposed = false;
  let logoImage = null;

  function own(resource) {
    resources.add(resource);
    return resource;
  }

  function surface(color) {
    return own(new THREE.MeshStandardMaterial({
      color, roughness: 1, metalness: 0,
    }));
  }

  const primaryMaterial = surface(primary);
  const secondaryMaterial = surface(secondary);
  const accentMaterial = surface(accent);
  const stoneMaterial = surface(stone);

  function block(parent, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(own(new THREE.BoxGeometry(width, height, depth)), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function canvasTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    textures.add(texture);
    return texture;
  }

  function plane(parent, width, height, x, y, z, material) {
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(width, height)), material);
    mesh.position.set(x, y, z);
    mesh.userData.sponsorSignage = true;
    parent.add(mesh);
    return mesh;
  }

  function contrastingText(hex) {
    const color = new THREE.Color(hex);
    return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722 > 0.4
      ? "#172d29" : "#fffdf4";
  }

  // This is text on a physical sign, not an invented or generated logo.
  const nameCanvas = document.createElement("canvas");
  nameCanvas.width = 1536;
  nameCanvas.height = 192;
  const nameContext = nameCanvas.getContext("2d");
  if (!nameContext) throw new Error("Sponsor sign canvas unavailable");
  nameContext.fillStyle = primary;
  nameContext.fillRect(0, 0, nameCanvas.width, nameCanvas.height);
  nameContext.fillStyle = accent;
  nameContext.fillRect(28, 168, nameCanvas.width - 56, 6);
  nameContext.fillStyle = contrastingText(primary);
  nameContext.textAlign = "center";
  nameContext.textBaseline = "middle";
  const name = sponsor?.name ?? "Quartier de l’équipe";
  let fontSize = 112;
  do {
    nameContext.font = `700 ${fontSize}px Arial, sans-serif`;
    if (nameContext.measureText(name).width <= 1430) break;
    fontSize -= 4;
  } while (fontSize > 40);
  nameContext.fillText(name, 768, 91, 1430);
  const nameMaterial = own(new THREE.MeshBasicMaterial({
    map: canvasTexture(nameCanvas), toneMapped: false,
  }));

  // One square logo texture is shared by every approved plaque and entrance badge.
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = 512;
  logoCanvas.height = 512;
  const logoContext = logoCanvas.getContext("2d");
  if (!logoContext) throw new Error("Sponsor logo canvas unavailable");
  const logoTexture = canvasTexture(logoCanvas);
  const logoMaterial = own(new THREE.MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    toneMapped: false,
  }));

  // A neutral stone structure with colored metalwork keeps it architectural.
  for (const side of [-1, 1]) {
    const x = side * 11.3;
    block(entrance, 2.5, 0.4, 2.5, x, 0.2, 0, stoneMaterial);
    block(entrance, 1.8, 6.1, 1.65, x, 3.45, 0, stoneMaterial);
    block(entrance, 0.42, 6.35, 1.85, x - side * 0.67, 3.52, 0, primaryMaterial);
    block(entrance, 2.05, 0.22, 1.95, x, 6.6, 0, accentMaterial);
    block(entrance, 2.22, 2.22, 0.16, x, 4.55, 0.93, stoneMaterial);
    plane(entrance, 2.02, 2.02, x, 4.55, 1.025, logoMaterial);
  }
  block(entrance, 25.6, 2.65, 1.15, 0, 7.26, 0, primaryMaterial);
  block(entrance, 26.0, 0.18, 1.42, 0, 8.67, 0, stoneMaterial);
  block(entrance, 25.7, 0.16, 1.22, 0, 5.88, 0, secondaryMaterial);
  plane(entrance, 24.65, 2.46, 0, 7.28, 0.593, nameMaterial);

  // Two low flags welcome visitors without adding animated or noisy decorations.
  for (const side of [-1, 1]) {
    const x = side * 15.0;
    block(entrance, 0.85, 0.25, 0.85, x, 0.125, 1.0, stoneMaterial);
    const pole = new THREE.Mesh(
      own(new THREE.CylinderGeometry(0.07, 0.07, 5.4, 10)), secondaryMaterial,
    );
    pole.position.set(x, 2.9, 1);
    pole.castShadow = true;
    entrance.add(pole);
    block(entrance, 2.1, 1.25, 0.06, x + side * 1.08, 4.8, 1, primaryMaterial);
    block(entrance, 0.19, 1.25, 0.075, x + side * 2.0, 4.8, 1, accentMaterial);
  }

  function roofBadge(model, size, x, y, z) {
    const group = new THREE.Group();
    group.name = "campus-sponsor-roof-plaque";
    group.userData.sponsorSignage = true;
    block(group, size + 0.24, 0.13, size + 0.24, 0, 0, 0, stoneMaterial);
    const logo = plane(group, size, size, 0, 0.071, 0, logoMaterial);
    logo.rotation.x = -Math.PI / 2;
    group.position.set(x, y, z);
    model.add(group);
    installations.add(group);
  }

  function decorateBuilding(model, variant, level) {
    if (disposed || !model || level <= 0 || model.userData.sponsorBadged) return;
    if (variant === "training") {
      roofBadge(model, 4.25, 6.2, 4.13, 1.1);
    } else if (variant === "office") {
      roofBadge(model, 3.4, -6.8, 8.61, -0.4);
    } else if (variant === "club") {
      const badge = new THREE.Group();
      badge.name = "campus-sponsor-gable-plaque";
      badge.userData.sponsorSignage = true;
      block(badge, 2.42, 2.12, 0.11, 0, 0, 0, stoneMaterial);
      plane(badge, 2.18, 2.0, 0, 0, 0.061, logoMaterial);
      badge.position.set(0, 4.85, 4.5);
      model.add(badge);
      installations.add(badge);
    } else {
      return;
    }
    model.userData.sponsorBadged = true;
  }

  if (sponsor?.logoPath && typeof Image !== "undefined") {
    logoImage = new Image();
    logoImage.decoding = "async";
    logoImage.onload = () => {
      if (disposed) return;
      logoContext.clearRect(0, 0, 512, 512);
      const imageWidth = logoImage.naturalWidth || logoImage.width;
      const imageHeight = logoImage.naturalHeight || logoImage.height;
      const scale = Math.min(464 / imageWidth, 464 / imageHeight);
      const width = imageWidth * scale;
      const height = imageHeight * scale;
      logoContext.drawImage(logoImage, (512 - width) / 2, (512 - height) / 2, width, height);
      logoTexture.needsUpdate = true;
      onUpdate();
    };
    logoImage.onerror = () => {
      // The gate name is already present even if a catalogue image is missing.
      if (!disposed) onUpdate();
    };
    logoImage.src = sponsor.logoPath;
  }

  return {
    entrance,
    decorateBuilding,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (logoImage) {
        logoImage.onload = null;
        logoImage.onerror = null;
        logoImage = null;
      }
      installations.forEach((installation) => installation.removeFromParent());
      installations.clear();
      textures.forEach((texture) => texture.dispose());
      resources.forEach((resource) => resource.dispose());
      textures.clear();
      resources.clear();
    },
  };
}
