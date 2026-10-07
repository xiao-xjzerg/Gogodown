(() => {
  if (
    !window.THREE ||
    !window.GOGODOWN_CONFIG ||
    !window.GogoAudio ||
    !window.GogoUtils ||
    !window.GogoLeaderboard
  ) {
    document.body.innerHTML = '<div class="runtime-error"><div><h1>游戏模块未加载</h1><p>请检查 Three.js CDN 以及 js/ 目录中的脚本文件。</p></div></div>';
    return;
  }

  const { gameplay } = window.GOGODOWN_CONFIG;
  const { randomRange, clamp, lerp, boxesOverlap, pickWeighted } = window.GogoUtils;

  const WORLD_WIDTH = gameplay.worldWidth;
  const HALF_WORLD_WIDTH = WORLD_WIDTH / 2;
  const CEILING_Y = gameplay.ceilingY;
  const BOTTOM_DEATH_Y = gameplay.bottomDeathY;
  const SPAWN_LINE_Y = gameplay.spawnLineY;
  const DESPAWN_LINE_Y = gameplay.despawnLineY;
  const VIEW_CENTER_Y = -0.55;
  const VIEW_HEIGHT = 13.2;
  const PLAYER = gameplay.player;
  const PLATFORM = gameplay.platform;
  const HEALTH = gameplay.health;

  const dom = {
    root: document.getElementById("gameRoot"),
    floor: document.getElementById("floorValue"),
    health: document.getElementById("healthValue"),
    level: document.getElementById("levelValue"),
    statusBanner: document.getElementById("statusBanner"),
    startOverlay: document.getElementById("startOverlay"),
    gameOverOverlay: document.getElementById("gameOverOverlay"),
    finalStats: document.getElementById("finalStats"),
    bestStats: document.getElementById("bestStats"),
    leaderboardForm: document.getElementById("leaderboardForm"),
    leaderboardList: document.getElementById("leaderboardList"),
    playerName: document.getElementById("playerName"),
    saveScoreBtn: document.getElementById("saveScoreBtn"),
    startBtn: document.getElementById("startBtn"),
    restartBtn: document.getElementById("restartBtn")
  };

  const leaderboardStore = window.GogoLeaderboard.createStore(gameplay.leaderboardKey);
  const portal = window.createGameHubBridge({
    gameId: "gogodown",
    isPlaying: () => state.running,
    onBoard: (entries) => renderLeaderboard(entries.map((entry) => ({
      name: entry.nickname,
      floor: entry.metrics.floor,
      level: entry.metrics.level,
      duration: entry.metrics.duration,
      createdAt: entry.acceptedAt
    })))
  });

  let scene;
  let camera;
  let renderer;
  let clock;
  let materials;
  let audio;
  let player;
  let playerVisual;
  let ceiling;

  const platforms = [];
  const backgroundItems = [];
  const particles = [];
  const playerParts = [];
  const keys = { left: false, right: false };
  const touch = { left: false, right: false };

  let sessionBestFloor = 0;

  const state = {
    mode: "ready",
    running: false,
    elapsed: 0,
    depth: 0,
    floor: 0,
    level: 1,
    health: HEALTH.max,
    scrollSpeed: PLATFORM.baseScrollSpeed,
    verticalVelocity: 0,
    grounded: false,
    groundedPlatform: null,
    nextPlatformX: 0,
    spawnCount: 0,
    lastType: "normal",
    invincibleTimer: 0,
    ceilingDamageTimer: 0,
    trampolineCooldown: 0,
    squashTimer: 0,
    cameraShake: 0,
    bannerTimer: 0,
    scoreSubmitted: false
  };

  initScene();
  audio = window.GogoAudio.createController();
  bindEvents();
  prepareRun();
  showStartOverlay();
  animate();

  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffcf96);
    scene.fog = new THREE.Fog(0xffcf96, 12, 30);

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
    updateCameraProjection();
    camera.position.set(0, VIEW_CENTER_Y, 13.6);
    camera.lookAt(0, VIEW_CENTER_Y, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    dom.root.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    materials = createMaterials();
    addLights();
    createBackground();
    ceiling = createCeiling();
    scene.add(ceiling);
    player = createPlayer();
    scene.add(player);
  }

  function createMaterials() {
    return {
      wall: new THREE.MeshPhongMaterial({ color: 0xffd7a3, shininess: 18 }),
      sideWall: new THREE.MeshToonMaterial({ color: 0xb45309 }),
      particle: new THREE.MeshToonMaterial({ color: 0xfff7ed }),
      metal: new THREE.MeshPhongMaterial({ color: 0x3b2416, shininess: 80 }),
      platformBorder: new THREE.MeshToonMaterial({ color: 0x2f1708 }),
      platformCore: new THREE.MeshToonMaterial({ color: 0x8b2d0c }),
      ceilingSpike: new THREE.MeshToonMaterial({ color: 0xff1f1f }),
      playerBody: new THREE.MeshToonMaterial({ color: 0x00b4d8 }),
      playerHead: new THREE.MeshToonMaterial({ color: 0xffd000 }),
      playerFace: new THREE.MeshToonMaterial({ color: 0x1f1307 }),
      playerLimb: new THREE.MeshToonMaterial({ color: 0xff6d00 }),
      normalA: new THREE.MeshToonMaterial({ color: 0x00c853 }),
      normalB: new THREE.MeshToonMaterial({ color: 0x00c853 }),
      normalCore: new THREE.MeshToonMaterial({ color: 0x008c3a }),
      spike: new THREE.MeshToonMaterial({ color: 0xff1744 }),
      spikeCore: new THREE.MeshToonMaterial({ color: 0xb00020 }),
      spikeTip: new THREE.MeshToonMaterial({ color: 0x9f1239 }),
      conveyor: new THREE.MeshToonMaterial({ color: 0xffb300 }),
      conveyorCore: new THREE.MeshToonMaterial({ color: 0xf97316 }),
      conveyorArrow: new THREE.MeshToonMaterial({ color: 0x3b2416 }),
      trampoline: new THREE.MeshToonMaterial({ color: 0xd500f9 }),
      trampolineCore: new THREE.MeshToonMaterial({ color: 0x9d00cc }),
      trampolinePad: new THREE.MeshToonMaterial({ color: 0xff80ff }),
      fragile: new THREE.MeshPhongMaterial({
        color: 0xfff1cc,
        transparent: true,
        opacity: 0.88,
        shininess: 16
      }),
      crack: new THREE.MeshBasicMaterial({ color: 0x7c2d12 }),
      damage: new THREE.MeshToonMaterial({ color: 0xff3333 })
    };
  }

  function addLights() {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b5563, 0.78));

    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-5.2, 8.4, 9.2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    scene.add(sun);
  }

  function createBackground() {
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_WIDTH + 2.4, 15.4), materials.wall);
    backWall.position.set(0, -0.55, -1.35);
    backWall.receiveShadow = true;
    scene.add(backWall);

    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 15.2, 0.72), materials.sideWall);
      wall.position.set(side * (HALF_WORLD_WIDTH + 0.26), -0.48, -0.05);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
    });

    for (let i = 0; i < 42; i += 1) {
      const item = createBackgroundParticle();
      item.position.y = randomRange(BOTTOM_DEATH_Y - 0.5, CEILING_Y + 0.8);
      backgroundItems.push(item);
      scene.add(item);
    }
  }

  function createBackgroundParticle() {
    const geometry = new THREE.BoxGeometry(randomRange(0.06, 0.18), randomRange(0.22, 0.82), 0.035);
    const material = materials.particle.clone();
    material.opacity = randomRange(0.24, 0.58);
    material.transparent = true;
    const item = new THREE.Mesh(geometry, material);
    item.position.set(randomRange(-HALF_WORLD_WIDTH + 0.4, HALF_WORLD_WIDTH - 0.4), 0, randomRange(-1.18, -0.82));
    item.userData.speed = randomRange(0.18, 0.48);
    return item;
  }

  function createCeiling() {
    const group = new THREE.Group();
    group.position.y = CEILING_Y;

    const bar = new THREE.Mesh(new THREE.BoxGeometry(WORLD_WIDTH + 0.95, 0.42, 1.18), materials.metal);
    bar.position.y = 0.32;
    bar.castShadow = true;
    bar.receiveShadow = true;
    group.add(bar);

    const spikeCount = 17;
    for (let i = 0; i < spikeCount; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.62, 4), materials.ceilingSpike);
      const x = -HALF_WORLD_WIDTH + (i + 0.5) * (WORLD_WIDTH / spikeCount);
      spike.position.set(x, -0.18, 0.02);
      spike.rotation.x = Math.PI;
      spike.castShadow = true;
      group.add(spike);
    }

    return group;
  }

  function createPlayer() {
    const group = new THREE.Group();
    group.position.set(PLAYER.startX, PLAYER.startY, 0.24);

    playerVisual = new THREE.Group();
    group.add(playerVisual);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(PLAYER.width * 0.8, PLAYER.height * 0.6, PLAYER.depth * 0.74),
      materials.playerBody
    );
    body.position.y = -PLAYER.height * 0.1;
    addPlayerPart(body);
    playerVisual.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(PLAYER.width * 0.43, 18, 16), materials.playerHead);
    head.position.y = PLAYER.height * 0.34;
    addPlayerPart(head);
    playerVisual.add(head);

    [-0.18, 0.18].forEach((ratio) => {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(PLAYER.width * 0.1, PLAYER.height * 0.06, PLAYER.depth * 0.04),
        materials.playerFace
      );
      eye.position.set(PLAYER.width * ratio, PLAYER.height * 0.38, PLAYER.depth * 0.46);
      playerVisual.add(eye);
    });

    [-0.31, 0.31].forEach((ratio) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(PLAYER.width * 0.22, PLAYER.height * 0.28, PLAYER.depth * 0.26),
        materials.playerLimb
      );
      leg.position.set(PLAYER.width * ratio, -PLAYER.height * 0.49, 0);
      addPlayerPart(leg);
      playerVisual.add(leg);
    });

    [-0.58, 0.58].forEach((ratio) => {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(PLAYER.width * 0.18, PLAYER.height * 0.4, PLAYER.depth * 0.22),
        materials.playerLimb
      );
      arm.position.set(PLAYER.width * ratio, -PLAYER.height * 0.08, 0);
      arm.rotation.z = -Math.sign(ratio) * 0.16;
      addPlayerPart(arm);
      playerVisual.add(arm);
    });

    group.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
      }
    });

    return group;
  }

  function addPlayerPart(mesh) {
    playerParts.push({ mesh, color: mesh.material.color.getHex() });
  }

  function bindEvents() {
    window.addEventListener("resize", handleResize);

    document.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "a" || event.key === "ArrowLeft") {
        keys.left = true;
        event.preventDefault();
      } else if (key === "d" || event.key === "ArrowRight") {
        keys.right = true;
        event.preventDefault();
      } else if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        if (state.mode === "ready") {
          startGame();
        } else if (state.mode === "playing") {
          jumpPlayer();
        }
      } else if (event.key === "Enter") {
        if (state.mode === "ready") {
          startGame();
        } else if (state.mode === "gameover") {
          startGame();
        }
      }
    });

    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key === "a" || event.key === "ArrowLeft") {
        keys.left = false;
      } else if (key === "d" || event.key === "ArrowRight") {
        keys.right = false;
      }
    });

    document.querySelectorAll(".touch-btn").forEach((button) => {
      const action = button.dataset.action;
      button.addEventListener("pointerdown", (event) => {
        touch[action] = true;
        button.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
        button.addEventListener(name, (event) => {
          touch[action] = false;
          event.preventDefault();
        });
      });
    });

    dom.startBtn.addEventListener("click", startGame);
    dom.restartBtn.addEventListener("click", startGame);

    dom.leaderboardForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.scoreSubmitted) {
        return;
      }

      const entry = {
        name: leaderboardStore.normalizeName(dom.playerName.value),
        floor: state.floor,
        level: state.level,
        duration: state.elapsed,
        createdAt: Date.now()
      };

      state.scoreSubmitted = true;
      dom.saveScoreBtn.disabled = true;
      dom.saveScoreBtn.textContent = "已保存";
      renderLeaderboard(leaderboardStore.saveEntry(entry));
      portal.submitScore(entry.name);
    });
  }

  function isTypingTarget(target) {
    return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
  }

  function updateCameraProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    const minViewWidth = WORLD_WIDTH + 1.6;
    let viewHeight = VIEW_HEIGHT;
    let viewWidth = viewHeight * aspect;

    if (viewWidth < minViewWidth) {
      viewWidth = minViewWidth;
      viewHeight = viewWidth / aspect;
    }

    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }

  function handleResize() {
    updateCameraProjection();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function jumpPlayer() {
    if (!state.running || !state.grounded) {
      return;
    }

    state.verticalVelocity = PLAYER.jumpVelocity;
    state.grounded = false;
    state.groundedPlatform = null;
    state.squashTimer = 0.12;
    audio.play("jump");
  }

  function showStartOverlay() {
    dom.startOverlay.classList.remove("is-hidden");
    dom.gameOverOverlay.classList.add("is-hidden");
  }

  function startGame() {
    prepareRun();
    state.mode = "playing";
    state.running = true;
    dom.startOverlay.classList.add("is-hidden");
    dom.gameOverOverlay.classList.add("is-hidden");
    audio.playMusic();
    portal.start();
  }

  function prepareRun() {
    removeAll(platforms);
    removeAll(particles);

    state.running = false;
    state.elapsed = 0;
    state.depth = 0;
    state.floor = 0;
    state.level = 1;
    state.health = HEALTH.max;
    state.scrollSpeed = PLATFORM.baseScrollSpeed;
    state.verticalVelocity = 0;
    state.grounded = false;
    state.groundedPlatform = null;
    state.nextPlatformX = 0;
    state.spawnCount = 0;
    state.lastType = "normal";
    state.invincibleTimer = 0;
    state.ceilingDamageTimer = 0;
    state.trampolineCooldown = 0;
    state.squashTimer = 0;
    state.cameraShake = 0;
    state.bannerTimer = 0;
    state.scoreSubmitted = false;

    player.position.set(PLAYER.startX, PLAYER.startY, 0.24);
    player.visible = true;
    playerVisual.rotation.set(0, 0, 0);
    playerVisual.scale.set(1, 1, 1);
    restorePlayerColors();

    createInitialPlatforms();
    updateHud();
    renderLeaderboard();
    dom.playerName.value = "";
    dom.saveScoreBtn.disabled = false;
    dom.saveScoreBtn.textContent = "保存排名";
    hideBanner();
  }

  function removeAll(collection) {
    while (collection.length > 0) {
      const object = collection.pop();
      scene.remove(object);
    }
  }

  function createInitialPlatforms() {
    const start = createPlatform({
      x: 0,
      y: 0.35,
      width: choosePlatformWidth(true),
      type: "normal",
      safe: true
    });

    state.grounded = true;
    state.groundedPlatform = start;
    player.position.y = getPlatformTop(start) + PLAYER.height / 2;
    state.nextPlatformX = 0;

    let y = -1.05;
    for (let i = 0; i < 7; i += 1) {
      spawnPlatformAt(y, i < 2 ? "normal" : null);
      y -= randomRange(PLATFORM.minGapY, PLATFORM.maxGapY);
    }

    ensureBottomPlatforms();
  }

  function spawnPlatformAt(y, forcedType) {
    const width = choosePlatformWidth(false);
    const x = chooseReachableX(state.nextPlatformX, width);
    const type = forcedType || choosePlatformType();
    const direction = Math.random() < 0.5 ? -1 : 1;
    state.nextPlatformX = x;
    state.spawnCount += 1;
    state.lastType = type;
    return createPlatform({ x, y, width, type, direction });
  }

  function choosePlatformWidth(preferLarge) {
    const fractions = PLATFORM.widthFractions;
    const fraction = preferLarge ? fractions[0] : fractions[Math.random() < 0.5 ? 0 : 1];
    return WORLD_WIDTH * fraction;
  }

  function chooseReachableX(previousX, width) {
    const margin = width / 2 + 0.32;
    const minX = -HALF_WORLD_WIDTH + margin;
    const maxX = HALF_WORLD_WIDTH - margin;
    let nextX = previousX + randomRange(-PLATFORM.maxStepX, PLATFORM.maxStepX);

    if (Math.abs(nextX - previousX) < 0.42) {
      nextX += Math.random() < 0.5 ? -0.9 : 0.9;
    }

    return clamp(nextX, minX, maxX);
  }

  function choosePlatformType() {
    if (state.spawnCount < 4) {
      return "normal";
    }

    const weightLevel = Math.min(4, Math.max(1, state.level));
    const weights = { ...gameplay.typeWeightsByLevel[weightLevel] };
    if (state.lastType === "spike" && weights.spike) {
      weights.spike *= 0.25;
    }

    return pickWeighted(weights);
  }

  function createPlatform({ x, y, width, type, direction = 1, safe = false }) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    group.userData = {
      type,
      width,
      height: PLATFORM.height,
      depth: PLATFORM.depth,
      direction,
      prevY: y,
      fragileTimer: 0,
      breakAge: 0,
      broken: false,
      safe
    };

    const baseMaterial = getPlatformMaterial(type, safe);
    const base = new THREE.Mesh(new THREE.BoxGeometry(width, PLATFORM.height, PLATFORM.depth), baseMaterial);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    group.userData.base = base;
    addPlatformFrame(group, width);

    if (type !== "fragile") {
      addPlatformCore(group, width, type);
    }

    if (type === "spike") {
      addSpikeDecor(group, width);
    } else if (type === "conveyor") {
      addConveyorDecor(group, width, direction);
    } else if (type === "trampoline") {
      addTrampolineDecor(group, width);
    } else if (type === "fragile") {
      addFragileDecor(group, width);
    }

    platforms.push(group);
    scene.add(group);
    return group;
  }

  function getPlatformMaterial(type, safe) {
    if (type === "normal") {
      return materials.normalA;
    }
    if (type === "fragile") {
      return materials.fragile.clone();
    }
    return materials[type] || materials.normalA;
  }

  function addPlatformFrame(group, width) {
    const z = PLATFORM.depth / 2 + 0.026;
    const borderThickness = 0.08;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(width + borderThickness, borderThickness, 0.055),
      materials.platformBorder
    );
    top.position.set(0, PLATFORM.height / 2 + borderThickness / 2, z);

    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(width + borderThickness, borderThickness, 0.055),
      materials.platformBorder
    );
    bottom.position.set(0, -PLATFORM.height / 2 - borderThickness / 2, z);

    const left = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, PLATFORM.height + borderThickness * 2, 0.055),
      materials.platformBorder
    );
    left.position.set(-width / 2 - borderThickness / 2, 0, z);

    const right = left.clone();
    right.position.x = width / 2 + borderThickness / 2;

    [top, bottom, left, right].forEach((edge) => {
      edge.castShadow = true;
      group.add(edge);
    });
  }

  function addPlatformCore(group, width, type) {
    const material = getPlatformCoreMaterial(type);
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.72, PLATFORM.height * 0.46, 0.065),
      material
    );
    core.position.set(0, -0.01, PLATFORM.depth / 2 + 0.065);
    core.castShadow = true;
    group.add(core);
  }

  function getPlatformCoreMaterial(type) {
    if (type === "spike") {
      return materials.spikeCore;
    }
    if (type === "conveyor") {
      return materials.conveyorCore;
    }
    if (type === "trampoline") {
      return materials.trampolineCore;
    }
    return materials.normalCore;
  }

  function addSpikeDecor(group, width) {
    const count = Math.max(3, Math.floor(width / 0.46));
    for (let i = 0; i < count; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), materials.spikeTip);
      spike.position.set(-width / 2 + (i + 0.5) * (width / count), PLATFORM.height / 2 + 0.2, 0.02);
      spike.castShadow = true;
      group.add(spike);
    }
  }

  function addConveyorDecor(group, width, direction) {
    [-0.22, 0.22].forEach((z) => {
      const beltLine = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.86, 0.045, 0.055),
        materials.conveyorArrow
      );
      beltLine.position.set(0, PLATFORM.height / 2 + 0.115, z);
      beltLine.castShadow = true;
      group.add(beltLine);
    });

    const stripeCount = Math.max(3, Math.floor(width / 0.58));
    for (let i = 0; i < stripeCount; i += 1) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.44, 3), materials.conveyorArrow);
      arrow.position.set(-width / 2 + (i + 0.5) * (width / stripeCount), PLATFORM.height / 2 + 0.18, 0.05);
      arrow.rotation.z = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      arrow.userData.isConveyorArrow = true;
      group.add(arrow);
    }
  }

  function addTrampolineDecor(group, width) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.68, 0.08, PLATFORM.depth + 0.1),
      materials.trampolinePad
    );
    pad.position.y = PLATFORM.height / 2 + 0.08;
    pad.castShadow = true;
    group.add(pad);

    [-0.24, 0.24].forEach((x) => {
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 18), materials.trampolinePad);
      spring.position.set(x, PLATFORM.height / 2 + 0.18, 0.18);
      spring.rotation.x = Math.PI / 2;
      group.add(spring);
    });
  }

  function addFragileDecor(group, width) {
    const crackA = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.035, 0.025), materials.crack);
    crackA.position.set(-width * 0.05, 0.045, PLATFORM.depth / 2 + 0.018);
    crackA.rotation.z = 0.18;
    group.add(crackA);

    const crackB = new THREE.Mesh(new THREE.BoxGeometry(width * 0.44, 0.035, 0.025), materials.crack);
    crackB.position.set(width * 0.13, -0.035, PLATFORM.depth / 2 + 0.02);
    crackB.rotation.z = -0.22;
    group.add(crackB);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);

    if (state.running) {
      updateGame(dt);
    } else {
      updateIdle(dt);
    }

    updateCamera(dt);
    renderer.render(scene, camera);
  }

  function updateGame(dt) {
    state.elapsed += dt;
    updateDifficulty();
    updateTimers(dt);
    updateBackground(dt, state.scrollSpeed);
    updatePlatforms(dt);
    updatePlayer(dt);
    updateParticles(dt);
    ensureBottomPlatforms();
    updateHud();
  }

  function updateIdle(dt) {
    updateBackground(dt, PLATFORM.baseScrollSpeed * 0.34);
    playerVisual.rotation.z = Math.sin(performance.now() * 0.0018) * 0.035;
    updateParticles(dt);
  }

  function updateDifficulty() {
    const previousLevel = state.level;
    state.level = Math.floor(state.floor / gameplay.levelFloorInterval) + 1;
    state.scrollSpeed = PLATFORM.baseScrollSpeed * Math.pow(gameplay.levelSpeedFactor, state.level - 1);

    if (state.level > previousLevel) {
      showBanner(`LEVEL ${state.level}`, false, 1.35);
      audio.play("levelUp");
    }
  }

  function updateTimers(dt) {
    state.invincibleTimer = Math.max(0, state.invincibleTimer - dt);
    state.ceilingDamageTimer = Math.max(0, state.ceilingDamageTimer - dt);
    state.trampolineCooldown = Math.max(0, state.trampolineCooldown - dt);
    state.squashTimer = Math.max(0, state.squashTimer - dt);
    state.cameraShake = Math.max(0, state.cameraShake - dt * gameplay.cameraShakeDecay);

    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        hideBanner();
      }
    }
  }

  function updateBackground(dt, speed) {
    backgroundItems.forEach((item) => {
      item.position.y += speed * item.userData.speed * dt;
      if (item.position.y > CEILING_Y + 0.9) {
        item.position.y = BOTTOM_DEATH_Y - randomRange(0.3, 1.4);
        item.position.x = randomRange(-HALF_WORLD_WIDTH + 0.45, HALF_WORLD_WIDTH - 0.45);
      }
    });
  }

  function updatePlatforms(dt) {
    for (let i = platforms.length - 1; i >= 0; i -= 1) {
      const platform = platforms[i];
      const data = platform.userData;
      data.prevY = platform.position.y;
      platform.position.y += state.scrollSpeed * dt;

      if (data.type === "conveyor") {
        animateConveyor(platform, dt);
      } else if (data.type === "fragile") {
        updateFragilePlatform(platform, dt);
      }

      if (data.broken) {
        data.breakAge += dt;
        platform.scale.y = lerp(platform.scale.y, 0.08, 0.24);
        platform.rotation.z = lerp(platform.rotation.z, data.direction * 0.12, 0.18);
      }

      if (platform.position.y > DESPAWN_LINE_Y || data.breakAge > 0.36) {
        if (state.groundedPlatform === platform) {
          state.groundedPlatform = null;
          state.grounded = false;
        }
        platforms.splice(i, 1);
        scene.remove(platform);
      }
    }
  }

  function animateConveyor(platform, dt) {
    const direction = platform.userData.direction;
    const width = platform.userData.width;
    platform.children.forEach((child) => {
      if (!child.userData.isConveyorArrow) {
        return;
      }

      child.position.x += direction * dt * 1.0;
      if (direction > 0 && child.position.x > width / 2 - 0.15) {
        child.position.x = -width / 2 + 0.15;
      } else if (direction < 0 && child.position.x < -width / 2 + 0.15) {
        child.position.x = width / 2 - 0.15;
      }
    });
  }

  function updateFragilePlatform(platform, dt) {
    const data = platform.userData;
    const isStanding = state.groundedPlatform === platform && state.grounded;

    if (isStanding) {
      data.fragileTimer += dt;
    } else {
      data.fragileTimer = Math.max(0, data.fragileTimer - dt * 0.45);
    }

    const stress = clamp(data.fragileTimer / PLATFORM.fragileBreakDelay, 0, 1);
    if (data.base.material.opacity !== undefined) {
      data.base.material.opacity = 0.88 - stress * 0.36;
    }
    platform.rotation.z = Math.sin(data.fragileTimer * 42) * stress * 0.025;

    if (!data.broken && data.fragileTimer >= PLATFORM.fragileBreakDelay) {
      data.broken = true;
      spawnBreakParticles(platform);
      showBanner("FRAGILE!", true, 0.58);
      audio.play("fragileBreak");
      if (state.groundedPlatform === platform) {
        state.groundedPlatform = null;
        state.grounded = false;
      }
    }
  }

  function updatePlayer(dt) {
    const previousY = player.position.y;
    const previousBottom = previousY - PLAYER.height / 2;
    const previousVelocity = state.verticalVelocity;
    const axis = getInputAxis();
    let horizontalVelocity = axis * PLAYER.moveSpeed;

    if (state.grounded && state.groundedPlatform && state.groundedPlatform.userData.type === "conveyor") {
      horizontalVelocity += state.groundedPlatform.userData.direction * PLATFORM.conveyorPush;
    }

    player.position.x = clamp(
      player.position.x + horizontalVelocity * dt,
      -HALF_WORLD_WIDTH + PLAYER.width / 2 + 0.08,
      HALF_WORLD_WIDTH - PLAYER.width / 2 - 0.08
    );

    state.verticalVelocity = Math.max(
      PLAYER.maxFallSpeed,
      state.verticalVelocity - PLAYER.gravity * dt
    );
    player.position.y += state.verticalVelocity * dt;

    state.grounded = false;
    state.groundedPlatform = null;

    resolvePlatformLanding(previousBottom, previousVelocity);
    applyPlatformContactDamage();
    handleCeiling();
    handleBottomDeath();

    const downwardMovement = Math.max(0, previousY - player.position.y);
    state.depth += state.scrollSpeed * gameplay.depthDriftFactor * dt;
    state.depth += downwardMovement * gameplay.fallDepthBonus;
    state.floor = Math.max(state.floor, Math.floor(state.depth / gameplay.floorDistance));

    updatePlayerVisual(dt, axis, horizontalVelocity);
  }

  function getInputAxis() {
    const left = keys.left || touch.left;
    const right = keys.right || touch.right;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  function resolvePlatformLanding(previousBottom, previousVelocity) {
    if (state.verticalVelocity > 2.2) {
      return;
    }

    const currentBottom = player.position.y - PLAYER.height / 2;
    let landed = null;
    let landedTop = -Infinity;

    platforms.forEach((platform) => {
      if (platform.userData.broken) {
        return;
      }

      const top = getPlatformTop(platform);
      const previousTop = platform.userData.prevY + PLATFORM.height / 2;
      const playerLeft = player.position.x - PLAYER.width / 2;
      const playerRight = player.position.x + PLAYER.width / 2;
      const platformLeft = platform.position.x - platform.userData.width / 2;
      const platformRight = platform.position.x + platform.userData.width / 2;
      const horizontalOverlap = playerRight > platformLeft + 0.08 && playerLeft < platformRight - 0.08;
      const crossedTop = previousBottom >= previousTop - 0.1 && currentBottom <= top + 0.18;

      if (horizontalOverlap && crossedTop && top > landedTop) {
        landed = platform;
        landedTop = top;
      }
    });

    if (!landed) {
      return;
    }

    player.position.y = landedTop + PLAYER.height / 2;
    state.verticalVelocity = 0;
    state.grounded = true;
    state.groundedPlatform = landed;

    if (previousVelocity < -2.1) {
      state.squashTimer = 0.16;
      audio.play("land");
    }

    applyLandingEffect(landed, previousVelocity);
  }

  function applyLandingEffect(platform, previousVelocity) {
    const type = platform.userData.type;

    if (type === "spike") {
      damagePlayer("spike");
    } else if (type === "trampoline" && state.trampolineCooldown <= 0 && previousVelocity <= 0.8) {
      state.verticalVelocity = PLAYER.trampolineVelocity;
      state.grounded = false;
      state.groundedPlatform = null;
      state.trampolineCooldown = 0.22;
      state.squashTimer = 0.12;
      showBanner("BOUNCE", false, 0.48);
    }
  }

  function applyPlatformContactDamage() {
    if (state.invincibleTimer > 0) {
      return;
    }

    const playerBox = getPlayerBox();
    platforms.forEach((platform) => {
      if (platform.userData.type !== "spike" || platform.userData.broken) {
        return;
      }

      if (isPlayerInSpikeDangerZone(playerBox, platform)) {
        damagePlayer("spike");
      }
    });
  }

  function isPlayerInSpikeDangerZone(playerBox, platform) {
    const platformTop = getPlatformTop(platform);
    const playerBottom = player.position.y - PLAYER.height / 2;
    const isAbovePlatformSurface = playerBottom >= platformTop - 0.12;

    return isAbovePlatformSurface && boxesOverlap(playerBox, getSpikeBox(platform));
  }

  function handleCeiling() {
    const playerTop = player.position.y + PLAYER.height / 2;
    const dangerLine = CEILING_Y - 0.18;
    if (playerTop < dangerLine) {
      return;
    }

    player.position.y = dangerLine - PLAYER.height / 2;
    state.verticalVelocity = Math.min(state.verticalVelocity, -2.6);
    damagePlayer("ceiling");
  }

  function handleBottomDeath() {
    if (player.position.y + PLAYER.height / 2 < BOTTOM_DEATH_Y) {
      endGame();
    }
  }

  function damagePlayer(reason) {
    if (!state.running) {
      return;
    }

    if (reason === "ceiling") {
      if (state.ceilingDamageTimer > 0) {
        return;
      }
      state.ceilingDamageTimer = HEALTH.ceilingDamageInterval;
      state.health -= HEALTH.ceilingDamage;
    } else {
      if (state.invincibleTimer > 0) {
        return;
      }
      state.health -= HEALTH.spikeDamage;
    }

    state.health = Math.max(0, state.health);
    state.invincibleTimer = HEALTH.invincibleDuration;
    state.cameraShake = 0.28;
    showBanner(reason === "ceiling" ? "CEILING!" : "SPIKES!", true, 0.62);
    flashPlayerDamage();
    updateHud();

    if (state.health <= 0) {
      endGame();
    } else {
      audio.play("hurt");
    }
  }

  function flashPlayerDamage() {
    playerParts.forEach(({ mesh }) => {
      mesh.material.color.setHex(0xff3333);
    });
  }

  function restorePlayerColors() {
    playerParts.forEach(({ mesh, color }) => {
      mesh.material.color.setHex(color);
    });
  }

  function updatePlayerVisual(dt, axis, horizontalVelocity) {
    if (state.invincibleTimer > 0) {
      player.visible = Math.floor(state.invincibleTimer * 14) % 2 === 0;
      if (state.invincibleTimer < HEALTH.invincibleDuration - 0.16) {
        restorePlayerColors();
      }
    } else {
      player.visible = true;
      restorePlayerColors();
    }

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    if (state.squashTimer > 0) {
      const pulse = Math.sin((state.squashTimer / 0.16) * Math.PI);
      scaleX = 1 + pulse * 0.14;
      scaleY = 1 - pulse * 0.16;
      scaleZ = 1 + pulse * 0.08;
    } else if (!state.grounded && state.verticalVelocity < -2) {
      const stretch = clamp(Math.abs(state.verticalVelocity) / Math.abs(PLAYER.maxFallSpeed), 0, 1);
      scaleX = 1 - stretch * 0.08;
      scaleY = 1 + stretch * 0.16;
    }

    playerVisual.scale.set(
      lerp(playerVisual.scale.x, scaleX, 0.25),
      lerp(playerVisual.scale.y, scaleY, 0.25),
      lerp(playerVisual.scale.z, scaleZ, 0.25)
    );

    let targetLean = -axis * 0.18;
    if (state.groundedPlatform && state.groundedPlatform.userData.type === "conveyor") {
      targetLean += -state.groundedPlatform.userData.direction * 0.12;
    } else if (Math.abs(horizontalVelocity) > 0.1) {
      targetLean += -Math.sign(horizontalVelocity) * 0.04;
    }
    playerVisual.rotation.z = lerp(playerVisual.rotation.z, targetLean, 0.16);

  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.userData.life -= dt;
      particle.position.x += particle.userData.vx * dt;
      particle.position.y += particle.userData.vy * dt;
      particle.position.z += particle.userData.vz * dt;
      particle.userData.vy -= 4.6 * dt;
      particle.rotation.x += particle.userData.spin * dt;
      particle.rotation.z += particle.userData.spin * 0.6 * dt;

      if (particle.material.opacity !== undefined) {
        particle.material.opacity = Math.max(0, particle.userData.life / particle.userData.maxLife);
      }

      if (particle.userData.life <= 0) {
        particles.splice(i, 1);
        scene.remove(particle);
      }
    }
  }

  function spawnBreakParticles(platform) {
    for (let i = 0; i < 10; i += 1) {
      const material = materials.fragile.clone();
      material.opacity = 0.68;
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), material);
      shard.position.set(
        platform.position.x + randomRange(-platform.userData.width / 2, platform.userData.width / 2),
        platform.position.y + randomRange(-0.05, 0.16),
        randomRange(-0.2, 0.32)
      );
      shard.userData = {
        vx: randomRange(-1.4, 1.4),
        vy: randomRange(0.5, 2.4),
        vz: randomRange(-0.25, 0.45),
        spin: randomRange(-6, 6),
        life: randomRange(0.45, 0.75),
        maxLife: 0.75
      };
      particles.push(shard);
      scene.add(shard);
    }
  }

  function ensureBottomPlatforms() {
    let guard = 0;
    while ((platforms.length === 0 || getLowestPlatformY() > SPAWN_LINE_Y) && guard < 8) {
      const lowestY = platforms.length === 0 ? PLAYER.startY - 1.4 : getLowestPlatformY();
      const y = lowestY - randomRange(PLATFORM.minGapY, PLATFORM.maxGapY);
      spawnPlatformAt(y, null);
      guard += 1;
    }
  }

  function getLowestPlatformY() {
    return platforms.reduce((lowest, platform) => Math.min(lowest, platform.position.y), Infinity);
  }

  function getPlatformTop(platform) {
    return platform.position.y + PLATFORM.height / 2;
  }

  function getPlayerBox() {
    return {
      min: {
        x: player.position.x - PLAYER.width / 2,
        y: player.position.y - PLAYER.height / 2,
        z: player.position.z - PLAYER.depth / 2
      },
      max: {
        x: player.position.x + PLAYER.width / 2,
        y: player.position.y + PLAYER.height / 2,
        z: player.position.z + PLAYER.depth / 2
      }
    };
  }

  function getSpikeBox(platform) {
    return {
      min: {
        x: platform.position.x - platform.userData.width / 2,
        y: platform.position.y - PLATFORM.height / 2,
        z: platform.position.z - PLATFORM.depth / 2
      },
      max: {
        x: platform.position.x + platform.userData.width / 2,
        y: platform.position.y + PLATFORM.height / 2 + 0.46,
        z: platform.position.z + PLATFORM.depth / 2
      }
    };
  }

  function showBanner(text, danger, duration) {
    dom.statusBanner.textContent = text;
    dom.statusBanner.classList.toggle("is-danger", Boolean(danger));
    dom.statusBanner.classList.add("is-visible");
    state.bannerTimer = duration;
  }

  function hideBanner() {
    dom.statusBanner.classList.remove("is-visible", "is-danger");
    state.bannerTimer = 0;
  }

  function updateHud() {
    dom.floor.textContent = String(state.floor);
    dom.level.textContent = String(state.level);
    dom.health.textContent = `${"♥ ".repeat(state.health)}${"♡ ".repeat(HEALTH.max - state.health)}`.trim();
    dom.health.setAttribute("aria-label", `${state.health} 生命`);
  }

  function endGame() {
    if (!state.running) {
      return;
    }

    state.running = false;
    state.mode = "gameover";
    audio.stopMusic();
    audio.play("death");
    player.visible = true;
    restorePlayerColors();
    sessionBestFloor = Math.max(sessionBestFloor, state.floor);
    dom.finalStats.textContent = `You reached Floor ${state.floor}!`;
    dom.bestStats.textContent = `Best Floor ${sessionBestFloor} · Level ${state.level}`;
    dom.gameOverOverlay.classList.remove("is-hidden");
    renderLeaderboard();
    portal.finish("completed", { floor: state.floor, level: state.level, duration: Number(state.elapsed.toFixed(3)) });
  }

  function formatLeaderboardDate(value) {
    if (!Number.isFinite(value) || value <= 0) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderLeaderboard(entries = leaderboardStore.getEntries()) {
    dom.leaderboardList.innerHTML = "";

    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "leaderboard-empty";
      empty.textContent = "暂无记录";
      dom.leaderboardList.appendChild(empty);
      return;
    }

    entries.slice(0, 10).forEach((entry, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = entry.name;
      const result = document.createElement("span");
      result.className = "leaderboard-result";
      result.textContent = `${entry.floor} 层 · Lv.${entry.level} · ${entry.duration.toFixed(3)} 秒`;
      const date = document.createElement("span");
      date.className = "leaderboard-date";
      date.textContent = formatLeaderboardDate(entry.createdAt);
      item.append(rank, name, result, date);
      dom.leaderboardList.appendChild(item);
    });
  }

  function updateCamera() {
    const shake = state.cameraShake > 0 ? state.cameraShake : 0;
    const shakeX = shake ? randomRange(-shake, shake) * 0.08 : 0;
    const shakeY = shake ? randomRange(-shake, shake) * 0.08 : 0;
    camera.position.x = shakeX;
    camera.position.y = VIEW_CENTER_Y + shakeY;
    camera.position.z = 13.6;
    camera.lookAt(camera.position.x, camera.position.y, 0);
  }
})();
