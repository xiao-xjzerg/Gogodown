(() => {
  const gameplay = Object.freeze({
    leaderboardKey: "gogodownFloorLeaderboard",
    worldWidth: 12.5,
    ceilingY: 5.55,
    bottomDeathY: -6.7,
    spawnLineY: -7.15,
    despawnLineY: 6.55,
    levelFloorInterval: 30,
    levelSpeedFactor: 1.2,
    floorDistance: 1.85,
    depthDriftFactor: 1.0,
    fallDepthBonus: 0.45,
    cameraShakeDecay: 4.8,
    player: Object.freeze({
      width: 0.5,
      height: 0.84,
      depth: 0.48,
      startX: 0,
      startY: 2.05,
      moveSpeed: 4.9,
      gravity: 18.5,
      maxFallSpeed: -12.5,
      jumpVelocity: 8.1,
      trampolineVelocity: 9.88
    }),
    platform: Object.freeze({
      height: 0.34,
      depth: 1.05,
      widthFractions: Object.freeze([1 / 3, 1 / 4]),
      minGapY: 1.77,
      maxGapY: 2.43,
      maxStepX: 3.25,
      baseScrollSpeed: 1.12,
      conveyorPush: 2.52,
      fragileBreakDelay: 0.62
    }),
    health: Object.freeze({
      max: 3,
      spikeDamage: 1,
      ceilingDamage: 1,
      invincibleDuration: 2,
      ceilingDamageInterval: 0.72
    }),
    typeWeightsByLevel: Object.freeze({
      1: Object.freeze({ normal: 1 }),
      2: Object.freeze({ normal: 0.58, conveyor: 0.24, trampoline: 0.18 }),
      3: Object.freeze({ normal: 0.48, conveyor: 0.19, trampoline: 0.15, spike: 0.18 }),
      4: Object.freeze({ normal: 0.38, conveyor: 0.18, trampoline: 0.14, spike: 0.16, fragile: 0.14 })
    })
  });

  const audio = Object.freeze({
    music: "assets/sounds/bgm-blackmoor-tides.mp3",
    jump: "assets/sounds/jump.wav",
    land: "assets/sounds/land.wav",
    hurt: "assets/sounds/hurt.wav",
    death: "assets/sounds/death.wav",
    levelUp: "assets/sounds/level-up.wav",
    fragileBreak: "assets/sounds/fragile-break.wav"
  });

  window.GOGODOWN_CONFIG = Object.freeze({ gameplay, audio });
})();
