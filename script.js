const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mapScreen = document.getElementById("mapScreen");
const gameScreen = document.getElementById("gameScreen");
const phaseButtons = Array.from(document.querySelectorAll(".phase-node"));
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const objectiveEl = document.getElementById("objective");
const currentLevelEl = document.getElementById("currentLevel");
const motivationMessageEl = document.getElementById("motivationMessage");
const audioBtn = document.getElementById("audioBtn");
const resumeBtn = document.getElementById("resumeBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const petShelfItemsEl = document.getElementById("petShelfItems");
const phaseStars = {
  1: document.getElementById("stars-1"),
  2: document.getElementById("stars-2"),
  3: document.getElementById("stars-3"),
};
const phaseRewards = {
  1: document.getElementById("reward-1"),
  2: document.getElementById("reward-2"),
  3: document.getElementById("reward-3"),
};
const phaseBadges = {
  1: document.getElementById("badge-1"),
  2: document.getElementById("badge-2"),
  3: document.getElementById("badge-3"),
};

const STORAGE_KEYS = {
  unlockedPhase: "coletorSorrisosUnlockedPhase",
  phaseHighScores: "coletorSorrisosPhaseHighScores",
  unlockedPets: "coletorSorrisosUnlockedPets",
  infiniteHighScores: "coletorSorrisosInfiniteHighScores",
  infiniteHasRecord: "coletorSorrisosInfiniteHasRecord",
};

const PHASES = {
  1: { name: "Jardim das Estrelinhas", objective: 30, speedMin: 1.05, speedMax: 1.9, sizeMin: 34, sizeMax: 42, spawnDelayMs: 850 },
  2: { name: "Lago dos Corações", objective: 40, speedMin: 1.45, speedMax: 2.45, sizeMin: 26, sizeMax: 40, spawnDelayMs: 720 },
  3: { name: "Céu dos Sorrisos", objective: 50, speedMin: 1.8, speedMax: 2.8, sizeMin: 22, sizeMax: 36, spawnDelayMs: 640, dynamicSpeed: true, infiniteAfterGoal: true },
};

const POSITIVE_ICONS = ["⭐", "💙", "😊", "💚", "✨", "😄"];
const MOTIVATIONAL_MESSAGES = ["Seu sorriso ilumina tudo por aqui!", "Você está indo muito bem!", "Cada estrelinha é uma vitória!", "Respira fundo... você consegue!"];
const PET_REWARDS = {
  1: { icon: "🐻", name: "Toto" },
  2: { icon: "🦊", name: "Luna" },
  3: { icon: "🐧", name: "Pingo" },
};

function getStoredPetsSafely() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.unlockedPets) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getStoredPhaseScoresSafely(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{"1":0,"2":0,"3":0}');
    return {
      1: Number(parsed["1"] ?? parsed[1] ?? 0) || 0,
      2: Number(parsed["2"] ?? parsed[2] ?? 0) || 0,
      3: Number(parsed["3"] ?? parsed[3] ?? 0) || 0,
    };
  } catch {
    return { 1: 0, 2: 0, 3: 0 };
  }
}

function getStoredInfiniteFlagsSafely() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.infiniteHasRecord) || '{"1":false,"2":false,"3":false}');
    return {
      1: Boolean(parsed["1"] ?? parsed[1] ?? false),
      2: Boolean(parsed["2"] ?? parsed[2] ?? false),
      3: Boolean(parsed["3"] ?? parsed[3] ?? false),
    };
  } catch {
    return { 1: false, 2: false, 3: false };
  }
}

const gameState = {
  running: false,
  activePhase: null,
  score: 0,
  unlockedPhase: Math.max(1, Number(localStorage.getItem(STORAGE_KEYS.unlockedPhase) || 1) || 1),
  phaseHighScores: getStoredPhaseScoresSafely(STORAGE_KEYS.phaseHighScores),
  infiniteHighScores: getStoredPhaseScoresSafely(STORAGE_KEYS.infiniteHighScores),
  infiniteHasRecord: getStoredInfiniteFlagsSafely(),
  unlockedPets: getStoredPetsSafely(),
  audioEnabled: true,
  lastSpawnAt: 0,
  spawnDelayMs: 700,
  messageCooldown: 0,
  onBreak: false,
  breakEndAt: 0,
  prePhaseBreathDone: false,
  infiniteBreakStep: 100,
  phaseCompleteOverlay: false,
  phase3InfiniteUnlocked: false,
  bonusStarMode: false,
  overlayButtonLabel: "",
  overlayButtonRect: null,
  overlayTitle: "",
  overlaySubtitle: "",
  basket: { x: 0, y: 0, width: 110, height: 30, speed: 7.5 },
  keys: { ArrowLeft: false, ArrowRight: false },
  items: [],
  particles: [],
  floatTexts: [],
  lastMapStars: { 1: 0, 2: 0, 3: 0 },
  pausedBySettings: false,
  freePlayMode: false,
  rewardSequence: { active: false, step: 0, stepStartedAt: 0, pet: null, isNewPet: false },
  presentMusicTimer: null,
  presentMusicContext: null,
  lastWinSoundAt: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function getCurrentObjective() {
  return PHASES[gameState.activePhase].objective;
}

function getThreeStarTarget(phaseNumber) {
  return Math.ceil(PHASES[phaseNumber].objective * 1.8);
}

function hasAllMapsWithThreeStars() {
  return [1, 2, 3].every((phaseNumber) => calculatePhaseStars(phaseNumber) >= 3);
}

function resizeCanvas() {
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  gameState.basket.y = canvas.height - 42;
  gameState.basket.x = clamp(gameState.basket.x || canvas.width / 2 - gameState.basket.width / 2, 0, canvas.width - gameState.basket.width);
}

function updatePhaseRecord() {
  const key = String(gameState.activePhase);
  if (gameState.freePlayMode) {
    const hasInfiniteRecord = Boolean(gameState.infiniteHasRecord[key]);
    const currentInfinite = gameState.infiniteHighScores[key] || 0;
    if (!hasInfiniteRecord || gameState.score > currentInfinite) {
      gameState.infiniteHighScores[key] = gameState.score;
      gameState.infiniteHasRecord[key] = true;
      localStorage.setItem(STORAGE_KEYS.infiniteHighScores, JSON.stringify(gameState.infiniteHighScores));
      localStorage.setItem(STORAGE_KEYS.infiniteHasRecord, JSON.stringify(gameState.infiniteHasRecord));
    }
  }
  if (gameState.score > (gameState.phaseHighScores[key] || 0)) {
    gameState.phaseHighScores[key] = gameState.score;
    localStorage.setItem(STORAGE_KEYS.phaseHighScores, JSON.stringify(gameState.phaseHighScores));
  }
}

function updateHUD() {
  if (!gameState.activePhase) return;
  scoreEl.textContent = String(gameState.score);
  const key = String(gameState.activePhase);
  const infiniteScore = gameState.infiniteHasRecord[key] ? (gameState.infiniteHighScores[key] || 0) : 0;
  highScoreEl.textContent = String(gameState.freePlayMode ? infiniteScore : (gameState.phaseHighScores[key] || 0));
  currentLevelEl.textContent = PHASES[gameState.activePhase].name;
  if (gameState.freePlayMode) {
    objectiveEl.textContent = "Modo livre infinito";
  } else if (gameState.bonusStarMode) {
    const bonusTarget = getThreeStarTarget(gameState.activePhase);
    objectiveEl.textContent = `Bonus: ${gameState.score}/${bonusTarget}`;
  } else {
    const objective = getCurrentObjective();
    objectiveEl.textContent = `${gameState.score}/${objective}`;
  }
}

function updatePhaseButtons() {
  phaseButtons.forEach((button) => {
    const phase = Number(button.dataset.phase);
    button.disabled = phase > gameState.unlockedPhase;
  });
}

function calculatePhaseStars(phaseNumber) {
  const score = gameState.phaseHighScores[String(phaseNumber)] || 0;
  const baseGoal = PHASES[phaseNumber].objective;
  const oneStar = baseGoal;
  const twoStars = Math.ceil(baseGoal * 1.4);
  const threeStars = Math.ceil(baseGoal * 1.8);
  if (score >= threeStars) return 3;
  if (score >= twoStars) return 2;
  if (score >= oneStar) return 1;
  return 0;
}

function renderPetShelf() {
  const unlockedPhases = Object.keys(gameState.unlockedPets)
    .map(Number)
    .sort((a, b) => a - b);
  if (!unlockedPhases.length) {
    petShelfItemsEl.innerHTML = '<span class="pet-empty">Ganhe 3 estrelas para adotar seu primeiro pet.</span>';
    return;
  }
  petShelfItemsEl.innerHTML = unlockedPhases
    .map((phase) => {
      const pet = gameState.unlockedPets[String(phase)];
      return `<span class="pet-chip">${pet.icon} ${pet.name}</span>`;
    })
    .join("");
}

function unlockPetForPhase(phaseNumber) {
  const key = String(phaseNumber);
  const alreadyUnlocked = Boolean(gameState.unlockedPets[key]);
  if (!alreadyUnlocked && PET_REWARDS[phaseNumber]) {
    gameState.unlockedPets[key] = PET_REWARDS[phaseNumber];
    localStorage.setItem(STORAGE_KEYS.unlockedPets, JSON.stringify(gameState.unlockedPets));
    renderPetShelf();
  }
  return !alreadyUnlocked;
}

function updateMapProgressVisuals() {
  [1, 2, 3].forEach((phaseNumber) => {
    const starsCount = calculatePhaseStars(phaseNumber);
    const starsEl = phaseStars[phaseNumber];
    const rewardEl = phaseRewards[phaseNumber];
    const badgeEl = phaseBadges[phaseNumber];

    starsEl.innerHTML = `${'<span class="filled-star">★</span>'.repeat(starsCount)}${'<span class="empty-star">☆</span>'.repeat(3 - starsCount)}`;

    if (starsCount > gameState.lastMapStars[phaseNumber]) {
      starsEl.classList.remove("star-pop");
      void starsEl.offsetWidth;
      starsEl.classList.add("star-pop");
    }

    if (starsCount >= 3) {
      rewardEl.classList.add("unlocked");
      if (gameState.lastMapStars[phaseNumber] < 3) {
        rewardEl.classList.remove("reward-bounce");
        void rewardEl.offsetWidth;
        rewardEl.classList.add("reward-bounce");
      }
      badgeEl.textContent = phaseNumber === 1 ? "Guardião das Estrelinhas" : phaseNumber === 2 ? "Herói do Lago" : "Mestre do Céu";
    } else if (starsCount >= 1) {
      rewardEl.classList.remove("unlocked");
      badgeEl.textContent = "Quase lá";
    } else {
      rewardEl.classList.remove("unlocked");
      badgeEl.textContent = "Em progresso";
    }

    gameState.lastMapStars[phaseNumber] = starsCount;
  });
}

function showMapScreen() {
  stopPresentLoopMusic();
  mapScreen.hidden = false;
  gameScreen.hidden = true;
  settingsPanel.hidden = true;
  gameState.running = false;
  gameState.pausedBySettings = false;
  gameState.activePhase = null;
  updatePhaseButtons();
  updateMapProgressVisuals();
  renderPetShelf();
}

function showGameScreen() {
  mapScreen.hidden = true;
  gameScreen.hidden = false;
}

function createItem() {
  const phaseConfig = PHASES[gameState.activePhase];
  const size = randomBetween(phaseConfig.sizeMin, phaseConfig.sizeMax);
  let speedMin = phaseConfig.speedMin;
  let speedMax = phaseConfig.speedMax;
  if (phaseConfig.dynamicSpeed || gameState.freePlayMode) {
    const multiplier = 1 + gameState.score * 0.018;
    speedMin *= multiplier;
    speedMax *= multiplier;
  }
  gameState.items.push({
    x: randomBetween(8, canvas.width - size - 8),
    y: -size,
    size,
    speed: randomBetween(speedMin, speedMax),
    icon: POSITIVE_ICONS[Math.floor(Math.random() * POSITIVE_ICONS.length)],
  });
}

function spawnItem(now) {
  const delay = gameState.spawnDelayMs;
  if (now - gameState.lastSpawnAt >= delay) {
    createItem();
    gameState.lastSpawnAt = now;
  }
}

function createCollectionEffect(item) {
  for (let i = 0; i < 8; i += 1) {
    gameState.particles.push({ x: item.x + item.size / 2, y: item.y + item.size / 2, vx: randomBetween(-1.6, 1.6), vy: randomBetween(-2.2, -0.4), life: randomBetween(18, 32), maxLife: 32, radius: randomBetween(2, 4) });
  }
  gameState.floatTexts.push({ text: "+1", x: item.x + item.size / 2, y: item.y, life: 40 });
}

function maybeShowMotivationalMessage() {
  if (gameState.messageCooldown > 0) {
    gameState.messageCooldown -= 1;
    return;
  }
  if (gameState.score > 0 && gameState.score % 5 === 0) {
    const msg = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
    motivationMessageEl.textContent = msg;
    gameState.messageCooldown = 110;
  }
}

function playCollectSound() {
  if (!gameState.audioEnabled || typeof window.AudioContext === "undefined") return;
  const audioContext = new window.AudioContext();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(560, audioContext.currentTime);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.18);
}

function playVictoryJingle() {
  if (!gameState.audioEnabled || typeof window.AudioContext === "undefined") return;
  const now = performance.now();
  if (now - gameState.lastWinSoundAt < 700) return;
  gameState.lastWinSoundAt = now;
  const audioContext = new window.AudioContext();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.12);
    gain.gain.setValueAtTime(0.001, audioContext.currentTime + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + index * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + index * 0.12 + 0.18);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(audioContext.currentTime + index * 0.12);
    osc.stop(audioContext.currentTime + index * 0.12 + 0.2);
  });
}

function playPresentLoopMusic() {
  if (!gameState.audioEnabled || typeof window.AudioContext === "undefined" || gameState.presentMusicTimer) return;
  const audioContext = new window.AudioContext();
  gameState.presentMusicContext = audioContext;
  const playPhrase = () => {
    if (!gameState.audioEnabled) return;
    const baseTime = audioContext.currentTime;
    const notes = [659, 784, 659, 880];
    notes.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, baseTime + index * 0.22);
      gain.gain.setValueAtTime(0.001, baseTime + index * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.05, baseTime + index * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, baseTime + index * 0.22 + 0.19);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(baseTime + index * 0.22);
      osc.stop(baseTime + index * 0.22 + 0.2);
    });
  };
  playPhrase();
  gameState.presentMusicTimer = setInterval(playPhrase, 1800);
}

function stopPresentLoopMusic() {
  if (gameState.presentMusicTimer) {
    clearInterval(gameState.presentMusicTimer);
    gameState.presentMusicTimer = null;
  }
  if (gameState.presentMusicContext) {
    gameState.presentMusicContext.close();
    gameState.presentMusicContext = null;
  }
}

function collectItem(index) {
  const [item] = gameState.items.splice(index, 1);
  gameState.score += 1;
  updatePhaseRecord();
  createCollectionEffect(item);
  playCollectSound();
  maybeShowMotivationalMessage();
  // Atualiza a HUD imediatamente para evitar ficar 1 ponto atras no frame de conclusao.
  updateHUD();
  if (maybeTriggerThreeStarReward()) return;
  maybeStartBreathingBreak();
}

function maybeStartBreathingBreak() {
  if (!gameState.running || gameState.onBreak || gameState.phaseCompleteOverlay) return;
  if (gameState.freePlayMode) return;
  // Regra nova:
  // - Fases 1 e 2: pausa apenas no comeco (feita em startPhase).
  // - Fase 3 infinita: pausa a cada 100 coletas (100, 200, 300...).
  if (!(gameState.activePhase === 3 && gameState.phase3InfiniteUnlocked)) return;
  if (gameState.score > 0 && gameState.score % gameState.infiniteBreakStep === 0) {
    gameState.onBreak = true;
    gameState.breakEndAt = performance.now() + 4200;
    const msg = `Uau! ${gameState.score} coletas! Hora de respirar um pouquinho.`;
    motivationMessageEl.textContent = msg;
  }
}

function hasCollision(item, basket) {
  // Colisao AABB: compara os limites dos retangulos para detectar sobreposicao.
  return item.x < basket.x + basket.width && item.x + item.size > basket.x && item.y < basket.y + basket.height && item.y + item.size > basket.y;
}

function updateBasketFromKeys() {
  if (gameState.keys.ArrowLeft) gameState.basket.x -= gameState.basket.speed;
  if (gameState.keys.ArrowRight) gameState.basket.x += gameState.basket.speed;
  gameState.basket.x = clamp(gameState.basket.x, 0, canvas.width - gameState.basket.width);
}

function updateItems() {
  for (let i = gameState.items.length - 1; i >= 0; i -= 1) {
    const item = gameState.items[i];
    item.y += item.speed;
    if (hasCollision(item, gameState.basket)) {
      collectItem(i);
      continue;
    }
    if (item.y > canvas.height + item.size) gameState.items.splice(i, 1);
  }
}

function updateEffects() {
  for (let i = gameState.particles.length - 1; i >= 0; i -= 1) {
    const p = gameState.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= 1;
    if (p.life <= 0) gameState.particles.splice(i, 1);
  }
  for (let i = gameState.floatTexts.length - 1; i >= 0; i -= 1) {
    const t = gameState.floatTexts[i];
    t.y -= 0.9;
    t.life -= 1;
    if (t.life <= 0) gameState.floatTexts.splice(i, 1);
  }
}

function startRewardSequence() {
  if (gameState.rewardSequence.active) return;
  playVictoryJingle();
  const phase = gameState.activePhase;
  gameState.phaseCompleteOverlay = true;
  gameState.overlayButtonRect = null;
  gameState.rewardSequence.active = true;
  gameState.rewardSequence.step = 0;
  gameState.rewardSequence.stepStartedAt = performance.now();
  gameState.rewardSequence.pet = PET_REWARDS[phase] || { icon: "🐾", name: "Amigo" };
  gameState.rewardSequence.isNewPet = unlockPetForPhase(phase);
  motivationMessageEl.textContent = "Uhuu! Voce brilhou muito e ganhou 3 estrelinhas!";
}

function maybeTriggerThreeStarReward() {
  if (!gameState.activePhase || gameState.phaseCompleteOverlay || gameState.rewardSequence.active) return false;
  if (gameState.freePlayMode) return false;
  const currentStars = calculatePhaseStars(gameState.activePhase);
  if (gameState.score >= getCurrentObjective() && currentStars >= 3) {
    gameState.running = false;
    updateHUD();
    startRewardSequence();
    return true;
  }
  return false;
}

function updateRewardSequence(now) {
  if (!gameState.rewardSequence.active) return;
  const elapsed = now - gameState.rewardSequence.stepStartedAt;
  if (gameState.rewardSequence.step === 0 && elapsed >= 1500) {
    gameState.rewardSequence.step = 1;
    gameState.rewardSequence.stepStartedAt = now;
    playPresentLoopMusic();
    return;
  }
  if (gameState.rewardSequence.step === 1 && elapsed >= 1600) {
    gameState.rewardSequence.step = 2;
    gameState.rewardSequence.stepStartedAt = now;
    const petName = gameState.rewardSequence.pet.name;
    motivationMessageEl.textContent = gameState.rewardSequence.isNewPet
      ? `Surpresa fofinha! Seu novo amiguinho ${petName} vai te esperar la no cantinho dos pets!`
      : `Olha quem chegou para brincar de novo: ${petName}! Ele esta te esperando no cantinho dos pets.`;
  }
}

function openCompletionOverlay() {
  playVictoryJingle();
  const phaseName = PHASES[gameState.activePhase].name;
  gameState.phaseCompleteOverlay = true;
  gameState.overlayTitle = "Fase concluída!";
  if (!gameState.bonusStarMode) {
    gameState.overlaySubtitle = `${phaseName} completo! Quer buscar 3 estrelas e abrir o presente?`;
    gameState.overlayButtonLabel = "Buscar 3 estrelas";
  } else {
    gameState.overlaySubtitle = `Você concluiu ${phaseName}!`;
    gameState.overlayButtonLabel = "Voltar ao mapa";
  }
  motivationMessageEl.textContent = `Que alegria! ${gameState.overlaySubtitle}`;
}

function checkPhaseCompletion() {
  if (gameState.phaseCompleteOverlay || gameState.rewardSequence.active) return;
  if (gameState.freePlayMode) return;
  const objective = getCurrentObjective();
  const currentStars = calculatePhaseStars(gameState.activePhase);
  const bonusTarget = getThreeStarTarget(gameState.activePhase);

  // Em modo bonus, a meta vira a pontuacao necessaria para 3 estrelas.
  if (gameState.bonusStarMode) {
    if (gameState.score >= bonusTarget || currentStars >= 3) {
      gameState.running = false;
      startRewardSequence();
    }
    return;
  }

  if (gameState.score < objective) return;
  gameState.running = false;
  if (gameState.activePhase < 3 && gameState.unlockedPhase < gameState.activePhase + 1) {
    gameState.unlockedPhase = gameState.activePhase + 1;
    localStorage.setItem(STORAGE_KEYS.unlockedPhase, String(gameState.unlockedPhase));
    updatePhaseButtons();
    updateMapProgressVisuals();
  }
  if (currentStars >= 3) {
    startRewardSequence();
  } else {
    openCompletionOverlay();
  }
}

function drawBackground() {
  const phase = gameState.activePhase || 1;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (phase === 1) {
    gradient.addColorStop(0, "#dff7ea");
    gradient.addColorStop(1, "#baf0d1");
  } else if (phase === 2) {
    gradient.addColorStop(0, "#daf3ff");
    gradient.addColorStop(1, "#ffe8b8");
  } else {
    gradient.addColorStop(0, "#e6f2ff");
    gradient.addColorStop(1, "#cde2ff");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPhaseScene() {
  const phase = gameState.activePhase || 1;
  if (phase === 1) {
    // Floresta: arvores desenhadas simples.
    ctx.fillStyle = "#4ca879";
    ctx.fillRect(0, canvas.height - 58, canvas.width, 58);
    for (let x = 40; x < canvas.width; x += 130) {
      ctx.fillStyle = "#86694f";
      ctx.fillRect(x, canvas.height - 118, 14, 60);
      ctx.fillStyle = "#2f9b68";
      ctx.beginPath();
      ctx.arc(x + 7, canvas.height - 126, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (phase === 2) {
    // Praia: faixa de areia + mar.
    ctx.fillStyle = "#89d7f0";
    ctx.fillRect(0, canvas.height - 110, canvas.width, 60);
    ctx.fillStyle = "#f3dca0";
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    ctx.font = "20px Segoe UI";
    ctx.fillText("🐚", 20, canvas.height - 20);
    ctx.fillText("🌴", canvas.width - 42, canvas.height - 20);
  } else {
    // Gelo: montanhas e neve.
    ctx.fillStyle = "#d6ebff";
    ctx.fillRect(0, canvas.height - 58, canvas.width, 58);
    ctx.fillStyle = "#9dc4f2";
    ctx.beginPath();
    ctx.moveTo(40, canvas.height - 58);
    ctx.lineTo(120, canvas.height - 150);
    ctx.lineTo(200, canvas.height - 58);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(canvas.width - 220, canvas.height - 58);
    ctx.lineTo(canvas.width - 140, canvas.height - 170);
    ctx.lineTo(canvas.width - 60, canvas.height - 58);
    ctx.fill();
  }
}

function drawBasket() {
  ctx.fillStyle = "#4f97b7";
  ctx.beginPath();
  ctx.roundRect(gameState.basket.x, gameState.basket.y, gameState.basket.width, gameState.basket.height, 12);
  ctx.fill();
  ctx.fillStyle = "#fff8df";
  ctx.font = "bold 18px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("🧺", gameState.basket.x + gameState.basket.width / 2, gameState.basket.y + 21);
}

function drawItems() {
  gameState.items.forEach((item) => {
    ctx.font = `${item.size}px Arial`;
    ctx.fillText(item.icon, item.x, item.y + item.size);
  });
}

function drawEffects() {
  gameState.particles.forEach((p) => {
    ctx.fillStyle = `rgba(255, 230, 100, ${p.life / p.maxLife})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  gameState.floatTexts.forEach((t) => {
    ctx.fillStyle = `rgba(45, 75, 90, ${t.life / 40})`;
    ctx.font = "bold 18px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(t.text, t.x, t.y);
  });
}

function drawTopHint() {
  ctx.fillStyle = "rgba(45, 75, 90, 0.75)";
  ctx.font = "16px Segoe UI";
  ctx.textAlign = "center";
  if (gameState.freePlayMode) {
    ctx.fillText(`Modo livre: ${gameState.score} coletas`, canvas.width / 2, 24);
  } else if (gameState.bonusStarMode) {
    const bonusTarget = getThreeStarTarget(gameState.activePhase);
    ctx.fillText(`Meta bonus: ${bonusTarget} (${gameState.score}/${bonusTarget})`, canvas.width / 2, 24);
  } else {
    const objective = getCurrentObjective();
    ctx.fillText(`Meta: ${objective} (${gameState.score}/${objective})`, canvas.width / 2, 24);
  }
}

function drawOverlay() {
  if (gameState.onBreak) {
    ctx.fillStyle = "rgba(248,253,255,0.86)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2d4b5a";
    ctx.font = "bold 30px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("Pausa do respiro", canvas.width / 2, canvas.height / 2);
    ctx.font = "20px Segoe UI";
    ctx.fillText("Inspire pelo nariz, solte pela boca", canvas.width / 2, canvas.height / 2 + 36);
  }
  if (!gameState.phaseCompleteOverlay) return;
  if (gameState.rewardSequence.active) {
    const sequence = gameState.rewardSequence;
    const phaseName = PHASES[gameState.activePhase].name;
    ctx.fillStyle = "rgba(248,253,255,0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2d4b5a";
    ctx.textAlign = "center";
    if (sequence.step === 0) {
      ctx.font = "bold 34px Segoe UI";
      ctx.fillText("★★★", canvas.width / 2, canvas.height / 2 - 24);
      ctx.font = "bold 24px Segoe UI";
      ctx.fillText("Ebaaa! 3 estrelinhas brilhando!", canvas.width / 2, canvas.height / 2 + 18);
      ctx.font = "18px Segoe UI";
      ctx.fillText(phaseName, canvas.width / 2, canvas.height / 2 + 52);
      return;
    }
    if (sequence.step === 1) {
      const pulse = 1 + Math.sin(performance.now() / 120) * 0.06;
      ctx.font = `bold ${Math.round(82 * pulse)}px Segoe UI`;
      ctx.fillText("🎁", canvas.width / 2, canvas.height / 2 + 16);
      ctx.font = "bold 23px Segoe UI";
      ctx.fillText("Uma caixinha surpresa apareceu!", canvas.width / 2, canvas.height / 2 + 82);
      return;
    }
    ctx.font = "bold 26px Segoe UI";
    ctx.fillText("Um novo amiguinho chegou!", canvas.width / 2, canvas.height / 2 - 80);
    ctx.font = "88px Segoe UI";
    ctx.fillText(sequence.pet.icon, canvas.width / 2, canvas.height / 2 + 8);
    ctx.font = "bold 28px Segoe UI";
    ctx.fillText(sequence.pet.name, canvas.width / 2, canvas.height / 2 + 62);
    ctx.font = "18px Segoe UI";
    const subtitle = sequence.isNewPet
      ? "Ele vai ficar te esperando no cantinho dos pets da tela inicial!"
      : "Esse amiguinho ja mora no seu cantinho dos pets.";
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 94);
    const buttonWidth = Math.min(320, canvas.width * 0.62);
    const buttonHeight = 52;
    const buttonX = canvas.width / 2 - buttonWidth / 2;
    const buttonY = canvas.height / 2 + 124;
    gameState.overlayButtonRect = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
    ctx.fillStyle = "#66a7c5";
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 14);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 21px Segoe UI";
    ctx.fillText("Continuar", canvas.width / 2, buttonY + 33);
    return;
  }
  ctx.fillStyle = "rgba(248,253,255,0.94)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2d4b5a";
  ctx.font = "bold 32px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(gameState.overlayTitle, canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = "20px Segoe UI";
  ctx.fillText(gameState.overlaySubtitle, canvas.width / 2, canvas.height / 2 + 8);
  const buttonWidth = Math.min(300, canvas.width * 0.58);
  const buttonHeight = 52;
  const buttonX = canvas.width / 2 - buttonWidth / 2;
  const buttonY = canvas.height / 2 + 48;
  gameState.overlayButtonRect = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
  ctx.fillStyle = "#66a7c5";
  ctx.beginPath();
  ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 14);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Segoe UI";
  ctx.fillText(gameState.overlayButtonLabel, canvas.width / 2, buttonY + 33);
}

function render() {
  drawBackground();
  drawPhaseScene();
  drawTopHint();
  drawBasket();
  drawItems();
  drawEffects();
  drawOverlay();
}

function resetRoundState() {
  gameState.score = 0;
  gameState.items = [];
  gameState.particles = [];
  gameState.floatTexts = [];
  gameState.lastSpawnAt = 0;
  gameState.prePhaseBreathDone = false;
  gameState.onBreak = false;
  gameState.phaseCompleteOverlay = false;
  gameState.phase3InfiniteUnlocked = false;
  gameState.bonusStarMode = false;
  gameState.freePlayMode = false;
  gameState.overlayButtonRect = null;
  gameState.rewardSequence.active = false;
  gameState.rewardSequence.step = 0;
  gameState.rewardSequence.pet = null;
}

function startPhase(phaseNumber) {
  stopPresentLoopMusic();
  gameState.activePhase = phaseNumber;
  gameState.running = true;
  settingsPanel.hidden = true;
  gameState.pausedBySettings = false;
  gameState.spawnDelayMs = PHASES[phaseNumber].spawnDelayMs;
  gameState.basket.speed = 7.5;
  resetRoundState();
  gameState.freePlayMode = hasAllMapsWithThreeStars();
  showGameScreen();
  // Pausa guiada antes de iniciar qualquer fase.
  gameState.onBreak = true;
  gameState.prePhaseBreathDone = true;
  gameState.breakEndAt = performance.now() + 4200;
  const startBreathMessage = gameState.freePlayMode
    ? "Modo livre infinito ativado! Voce pode brincar sem fim nessa fase."
    : "Antes de comecar: inspire fundo... expire devagar...";
  motivationMessageEl.textContent = startBreathMessage;
  updateHUD();
}

function handleOverlayContinue() {
  if (!gameState.phaseCompleteOverlay) return;
  if (gameState.rewardSequence.active) {
    stopPresentLoopMusic();
    gameState.rewardSequence.active = false;
    gameState.rewardSequence.step = 0;
    gameState.rewardSequence.pet = null;
    gameState.overlayButtonRect = null;
    openCompletionOverlay();
    return;
  }
  if (!gameState.bonusStarMode) {
    gameState.bonusStarMode = true;
    gameState.phaseCompleteOverlay = false;
    gameState.running = true;
    gameState.overlayButtonRect = null;
    const bonusTarget = getThreeStarTarget(gameState.activePhase);
    motivationMessageEl.textContent = `Modo bonus ativado! Agora a meta e ${bonusTarget} para conquistar 3 estrelas e o presente.`;
    updateHUD();
    return;
  }
  showMapScreen();
}

function tryOverlayClick(clientX, clientY) {
  if (!gameState.phaseCompleteOverlay || !gameState.overlayButtonRect) return false;
  if (gameState.rewardSequence.active && gameState.rewardSequence.step < 2) return false;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const b = gameState.overlayButtonRect;
  const hit = x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  if (hit) handleOverlayContinue();
  return hit;
}

function gameLoop(timestamp) {
  // Game Loop: atualiza estado -> renderiza -> agenda proximo frame.
  resizeCanvas();
  updateRewardSequence(timestamp);
  if (!gameScreen.hidden && gameState.running) {
    if (gameState.onBreak) {
      updateEffects();
      if (timestamp >= gameState.breakEndAt) {
        gameState.onBreak = false;
        if (gameState.prePhaseBreathDone) {
          gameState.prePhaseBreathDone = false;
          const resumeMsg = `Muito bem! Comecou ${PHASES[gameState.activePhase].name}.`;
          motivationMessageEl.textContent = resumeMsg;
        }
      }
    } else {
      updateBasketFromKeys();
      spawnItem(timestamp);
      updateItems();
      updateEffects();
      checkPhaseCompletion();
    }
  }
  if (!gameScreen.hidden) render();
  requestAnimationFrame(gameLoop);
}

function setupInput() {
  window.addEventListener("keydown", (event) => {
    if (event.key in gameState.keys) gameState.keys[event.key] = true;
  });
  window.addEventListener("keyup", (event) => {
    if (event.key in gameState.keys) gameState.keys[event.key] = false;
  });
  function moveBasketTo(clientX) {
    if (!gameState.running || gameState.phaseCompleteOverlay || gameState.onBreak) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - gameState.basket.width / 2;
    gameState.basket.x = clamp(x, 0, canvas.width - gameState.basket.width);
  }
  canvas.addEventListener("mousemove", (event) => {
    if (event.buttons === 1) moveBasketTo(event.clientX);
  });
  canvas.addEventListener("click", (event) => {
    tryOverlayClick(event.clientX, event.clientY);
  });
  canvas.addEventListener("touchmove", (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) moveBasketTo(touch.clientX);
  });
  canvas.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    if (touch) tryOverlayClick(touch.clientX, touch.clientY);
  });
}

function setupPhaseButtons() {
  phaseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const phase = Number(button.dataset.phase);
      if (phase <= gameState.unlockedPhase) startPhase(phase);
    });
  });
}

function setupSettings() {
  function openSettingsPanel() {
    settingsPanel.hidden = false;
    if (!gameScreen.hidden && gameState.running) {
      gameState.running = false;
      gameState.pausedBySettings = true;
    }
  }

  function closeSettingsPanel() {
    settingsPanel.hidden = true;
  }

  function resumeFromSettings() {
    closeSettingsPanel();
    if (gameState.pausedBySettings && !gameScreen.hidden && !gameState.phaseCompleteOverlay && gameState.activePhase) {
      // Retoma exatamente o estado atual da fase (pontuacao, itens, progresso e recorde).
      gameState.running = true;
      motivationMessageEl.textContent = "Continuando de onde voce parou!";
    }
    gameState.pausedBySettings = false;
  }

  settingsBtn.addEventListener("click", () => {
    if (settingsPanel.hidden) {
      openSettingsPanel();
    } else {
      // Ao clicar novamente na engrenagem, age como "Continuar".
      resumeFromSettings();
    }
  });
  audioBtn.addEventListener("click", () => {
    gameState.audioEnabled = !gameState.audioEnabled;
    audioBtn.textContent = gameState.audioEnabled ? "Som: ligado" : "Som: desligado";
    if (!gameState.audioEnabled) {
      stopPresentLoopMusic();
    } else if (gameState.rewardSequence.active && gameState.rewardSequence.step >= 1) {
      playPresentLoopMusic();
    }
  });
  resumeBtn.addEventListener("click", () => {
    resumeFromSettings();
  });

  backToMenuBtn.addEventListener("click", () => {
    closeSettingsPanel();
    // Volta para a tela do caminho das fases e encerra a pausa.
    showMapScreen();
  });
}

function resetAppProgressOnLaunch() {
  localStorage.removeItem(STORAGE_KEYS.unlockedPhase);
  localStorage.removeItem(STORAGE_KEYS.phaseHighScores);
  localStorage.removeItem(STORAGE_KEYS.unlockedPets);
  gameState.unlockedPhase = 1;
  gameState.phaseHighScores = { 1: 0, 2: 0, 3: 0 };
  gameState.infiniteHighScores = getStoredPhaseScoresSafely(STORAGE_KEYS.infiniteHighScores);
  gameState.infiniteHasRecord = getStoredInfiniteFlagsSafely();
  gameState.unlockedPets = {};
  gameState.lastMapStars = { 1: 0, 2: 0, 3: 0 };
}

function init() {
  // Sempre que o app inicia, recomeca o progresso do zero.
  resetAppProgressOnLaunch();
  settingsPanel.hidden = true;
  setupInput();
  setupPhaseButtons();
  setupSettings();
  renderPetShelf();
  updatePhaseButtons();
  updateMapProgressVisuals();
  showMapScreen();
  requestAnimationFrame(gameLoop);
}

init();
