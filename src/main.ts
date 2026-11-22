import './style.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { audio } from './audio';
import { RunwayGameEngine } from './game';
import { haptics } from './haptics';
import { UPGRADES } from './perks';
import { STAGES, buildDailyChallengeStage, getTodayDateKey } from './stages';
import { SaveStore } from './storage';
import type {
  DifficultyTier,
  HudSnapshot,
  RunSummary,
  StageDef,
  TacticalPerkDef,
} from './types';

function diffClass(diff: DifficultyTier): string {
  if (diff === 'SUPER COMPLEX') return 'diff-SUPER';
  if (diff === 'DAILY OPS') return 'diff-DAILY';
  return `diff-${diff}`;
}

function getFeatureBadges(stage: StageDef): string[] {
  const tags: string[] = [];
  if (stage.features.maydayEmergencies) tags.push('🔥 Mayday + Fire Crew');
  if (stage.features.rogueDrones) tags.push('🤖 Rogue Drones');
  if (stage.features.ufoEvents) tags.push('🛸 UFO Sightings');
  if (stage.features.storms) tags.push(`⛈️ ${stage.features.storms} Storms`);
  if (stage.features.windShifts) tags.push('💨 Wind Shifts');
  if (stage.features.outboundTakeoffs) tags.push('🛫 Outbound Takeoffs');
  if (stage.features.movingCarrier) tags.push('⚓ Moving Carrier');
  if (stage.features.dayToNight) tags.push('🌙 Nightfall');
  if (stage.features.heavyCargo) tags.push('✈️ Heavy Cargo');
  if (stage.features.lowFuel) tags.push('⛽ Low Fuel');
  if (stage.features.vipJets) tags.push('★ VIP Jets');
  if (tags.length === 0) tags.push('⟳ Double-Tap Orbit', '⏱️ Chrono Slow-Mo');
  return tags;
}

async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.hide();
    } catch {
      // Ignore on unsupported devices
    }
  }

  const store = new SaveStore();
  await store.load();
  audio.enabled = store.data.soundEnabled;
  haptics.enabled = store.data.hapticsEnabled;

  const $ = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing DOM element #${id}`);
    return el as T;
  };

  const dom = {
    stageWrap: $<HTMLElement>('stage-wrap'),
    canvas: $<HTMLCanvasElement>('gameCanvas'),
    stageLabel: $<HTMLElement>('stage-label'),
    landingsVal: $<HTMLElement>('landings-val'),
    launchesWrap: $<HTMLElement>('launches-wrap'),
    launchesVal: $<HTMLElement>('launches-val'),
    scoreVal: $<HTMLElement>('score-val'),
    comboPill: $<HTMLElement>('combo-pill'),
    creditsVal: $<HTMLElement>('credits-val'),
    tcasPill: $<HTMLElement>('tcas-pill'),
    tcasVal: $<HTMLElement>('tcas-val'),
    livesBox: $<HTMLElement>('lives-box'),
    atcMessage: $<HTMLElement>('atc-message'),
    activeCount: $<HTMLElement>('active-count'),
    bestVal: $<HTMLElement>('best-val'),
    eventBanner: $<HTMLElement>('event-banner'),

    btnStages: $<HTMLButtonElement>('btn-stages'),
    btnHangar: $<HTMLButtonElement>('btn-hangar'),
    btnSpeed: $<HTMLButtonElement>('btn-speed'),
    btnSound: $<HTMLButtonElement>('btn-sound'),
    btnPause: $<HTMLButtonElement>('btn-pause'),
    btnSlowmo: $<HTMLButtonElement>('btn-slowmo'),
    slowmoFill: $<HTMLElement>('slowmo-fill'),
    slowmoLabel: $<HTMLElement>('slowmo-label'),
    btnOrbit: $<HTMLButtonElement>('btn-orbit'),
    orbitLabel: $<HTMLElement>('orbit-label'),
    empChip: $<HTMLElement>('emp-chip'),
    empLabel: $<HTMLElement>('emp-label'),

    introModal: $<HTMLElement>('intro-modal'),
    introBadge: $<HTMLElement>('intro-badge'),
    introCredits: $<HTMLElement>('intro-credits'),
    introTitle: $<HTMLElement>('intro-title'),
    introSub: $<HTMLElement>('intro-sub'),
    introTags: $<HTMLElement>('intro-tags'),
    introTip: $<HTMLElement>('intro-tip'),
    btnStartStage: $<HTMLButtonElement>('btn-start-stage'),
    btnOpenMap: $<HTMLButtonElement>('btn-open-map'),
    btnOpenUpgrades: $<HTMLButtonElement>('btn-open-upgrades'),

    hubModal: $<HTMLElement>('hub-modal'),
    totalStarsLabel: $<HTMLElement>('total-stars-label'),
    btnCloseHub: $<HTMLButtonElement>('btn-close-hub'),
    tabStages: $<HTMLButtonElement>('tab-stages'),
    tabUpgrades: $<HTMLButtonElement>('tab-upgrades'),
    tabStats: $<HTMLButtonElement>('tab-stats'),
    panelStages: $<HTMLElement>('panel-stages'),
    panelUpgrades: $<HTMLElement>('panel-upgrades'),
    panelStats: $<HTMLElement>('panel-stats'),
    dailyTitle: $<HTMLElement>('daily-title'),
    dailyMutators: $<HTMLElement>('daily-mutators'),
    btnPlayDaily: $<HTMLButtonElement>('btn-play-daily'),
    btnUnlockAll: $<HTMLButtonElement>('btn-unlock-all'),
    stageGrid: $<HTMLElement>('stage-grid'),
    upgradeCreditsVal: $<HTMLElement>('upgrade-credits-val'),
    upgradesList: $<HTMLElement>('upgrades-list'),
    statsGrid: $<HTMLElement>('stats-grid'),
    btnToggleHaptics: $<HTMLButtonElement>('btn-toggle-haptics'),

    perkModal: $<HTMLElement>('perk-modal'),
    perkGrid: $<HTMLElement>('perk-grid'),

    clearModal: $<HTMLElement>('clear-modal'),
    clearStars: $<HTMLElement>('clear-stars'),
    clearTitle: $<HTMLElement>('clear-title'),
    clearSub: $<HTMLElement>('clear-sub'),
    clearScore: $<HTMLElement>('clear-score'),
    clearLandings: $<HTMLElement>('clear-landings'),
    clearCredits: $<HTMLElement>('clear-credits'),
    clearSpecial: $<HTMLElement>('clear-special'),
    btnNextStage: $<HTMLButtonElement>('btn-next-stage'),
    btnEndless: $<HTMLButtonElement>('btn-endless'),
    btnClearUpgrades: $<HTMLButtonElement>('btn-clear-upgrades'),
    btnReplayClear: $<HTMLButtonElement>('btn-replay-clear'),

    gameoverModal: $<HTMLElement>('gameover-modal'),
    overReason: $<HTMLElement>('over-reason'),
    overScore: $<HTMLElement>('over-score'),
    overLandings: $<HTMLElement>('over-landings'),
    overCredits: $<HTMLElement>('over-credits'),
    overStreak: $<HTMLElement>('over-streak'),
    btnRetry: $<HTMLButtonElement>('btn-retry'),
    btnOverUpgrades: $<HTMLButtonElement>('btn-over-upgrades'),
    btnOverMap: $<HTMLButtonElement>('btn-over-map'),
  };

  dom.btnSound.textContent = audio.enabled ? '🔊' : '🔇';

  const closeAllModals = () => {
    dom.introModal.classList.remove('active');
    dom.hubModal.classList.remove('active');
    dom.perkModal.classList.remove('active');
    dom.clearModal.classList.remove('active');
    dom.gameoverModal.classList.remove('active');
  };

  const showIntro = (stage: StageDef) => {
    closeAllModals();
    dom.introBadge.className = `diff-badge ${diffClass(stage.difficulty)}`;
    dom.introBadge.textContent = stage.isDaily
      ? `DAILY OPS • ${stage.dailyDateKey}`
      : `STAGE ${stage.id} • ${stage.difficulty}`;
    dom.introCredits.textContent = `🪙 ${store.data.credits}`;
    dom.introTitle.textContent = stage.name;
    const goalText = stage.targetLaunches
      ? `Goal: ${stage.targetLandings} Land + ${stage.targetLaunches} Launch`
      : `Goal: ${stage.targetLandings} Landings`;
    dom.introSub.textContent = `${stage.subtitle} • ${goalText}`;
    dom.introTags.innerHTML = getFeatureBadges(stage)
      .map((t) => `<span class="ftag">${t}</span>`)
      .join('');
    dom.introTip.textContent = stage.tip;
    dom.btnStartStage.textContent = stage.isDaily
      ? 'Launch Daily Ops (2x Credits)'
      : `Take Control — Stage ${stage.id}`;
    dom.introModal.classList.add('active');
  };

  const setHubTab = (tab: 'stages' | 'upgrades' | 'stats') => {
    dom.tabStages.classList.toggle('active', tab === 'stages');
    dom.tabUpgrades.classList.toggle('active', tab === 'upgrades');
    dom.tabStats.classList.toggle('active', tab === 'stats');
    dom.panelStages.classList.toggle('active', tab === 'stages');
    dom.panelUpgrades.classList.toggle('active', tab === 'upgrades');
    dom.panelStats.classList.toggle('active', tab === 'stats');
  };

  const renderHub = () => {
    dom.totalStarsLabel.textContent = `★ ${store.totalStars()} / ${STAGES.length * 3} Stars • 🪙 ${store.data.credits} Credits`;
    dom.upgradeCreditsVal.textContent = `🪙 ${store.data.credits}`;
    dom.btnUnlockAll.textContent = store.data.unlockAllDev ? '🔒 Lock Progress' : '🔓 Unlock All';

    // Daily Ops card
    const todayKey = getTodayDateKey();
    const dailyStage = buildDailyChallengeStage(todayKey);
    const clearedToday = store.isDailyCleared(todayKey);
    const dailyBest = store.getDailyBest(todayKey);
    dom.dailyTitle.textContent = `${dailyStage.name}${clearedToday ? ' ✓' : ''}`;
    dom.dailyMutators.textContent = `${dailyStage.dailyMutators?.join(' • ') ?? ''}${
      dailyBest > 0 ? ` • Best ${dailyBest}` : ''
    }`;
    dom.btnPlayDaily.textContent = clearedToday ? 'Replay Daily' : 'Play Daily';

    // 12 Stages Grid
    dom.stageGrid.innerHTML = '';
    for (const st of STAGES) {
      const unlocked = store.isStageUnlocked(st.id);
      const rec = store.getRecord(st.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `stage-tile${unlocked ? '' : ' locked'}${
        !engine.stage.isDaily && engine.stage.id === st.id ? ' active-stage' : ''
      }`;
      const starsStr = rec.stars > 0 ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '☆☆☆';
      btn.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span style="font-size:11.5px;font-weight:900;">${unlocked ? '' : '🔒 '}${st.id}. ${st.name}</span>
          <span style="font-size:11px;color:${rec.stars > 0 ? '#d97706' : '#94a3b8'};">${starsStr}</span>
        </div>
        <div style="font-size:10.5px;color:#475569;">${st.subtitle}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <span class="diff-badge ${diffClass(st.difficulty)}">${st.difficulty}</span>
          <span style="font-size:9.5px;font-family:monospace;color:#64748b;">${
            rec.bestScore > 0 ? `Best ${rec.bestScore}` : `${st.targetLandings} flights`
          }</span>
        </div>
      `;
      if (unlocked) {
        btn.addEventListener('click', () => {
          engine.loadStage(st.id, false);
          showIntro(st);
        });
      }
      dom.stageGrid.appendChild(btn);
    }

    // Tower Upgrades List
    dom.upgradesList.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = store.getUpgradeLevel(u.id);
      const isMax = lvl >= u.maxLevel;
      const cost = isMax ? 0 : u.costs[lvl];
      const canBuy = !isMax && store.data.credits >= cost;

      const row = document.createElement('div');
      row.className = 'upgrade-row';
      const pips = Array.from({ length: u.maxLevel })
        .map((_, idx) => `<span class="pip${idx < lvl ? ' filled' : ''}"></span>`)
        .join('');

      row.innerHTML = `
        <div class="upg-info">
          <div class="upg-title-row">
            <span>${u.icon}</span>
            <span>${u.name}</span>
            <span class="upg-pips">${pips}</span>
          </div>
          <div class="upg-desc">${isMax ? u.summary(lvl) : u.nextBenefit(lvl + 1)}</div>
        </div>
      `;

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = `upg-buy-btn${isMax ? ' maxed' : ''}`;
      buyBtn.disabled = !canBuy && !isMax;
      buyBtn.textContent = isMax ? 'MAXED' : `🪙 ${cost}`;
      if (!isMax) {
        buyBtn.addEventListener('click', () => {
          audio.init();
          if (store.buyUpgrade(u.id)) {
            audio.playUpgradeBuy();
            haptics.lock();
            engine.rebuildZones();
            engine.pushHud();
            renderHub();
          } else {
            audio.playMismatch();
          }
        });
      }
      row.appendChild(buyBtn);
      dom.upgradesList.appendChild(row);
    }

    // Career Flight Log Stats
    const s = store.data.stats;
    dom.statsGrid.innerHTML = `
      <div class="stat-card"><div class="stat-card-k">TOTAL LANDINGS</div><div class="stat-card-v">${s.totalLandings}</div></div>
      <div class="stat-card"><div class="stat-card-k">MAYDAYS SAVED</div><div class="stat-card-v">${s.maydaysSaved}</div></div>
      <div class="stat-card"><div class="stat-card-k">DRONES / UFOS EMP'D</div><div class="stat-card-v">${s.hazardsJammed}</div></div>
      <div class="stat-card"><div class="stat-card-k">BEST LANDING STREAK</div><div class="stat-card-v">${s.bestStreak}</div></div>
      <div class="stat-card"><div class="stat-card-k">DAILY OPS CLEARED</div><div class="stat-card-v">${s.dailyCompletedDates.length}</div></div>
      <div class="stat-card"><div class="stat-card-k">ATC CREDITS</div><div class="stat-card-v">🪙 ${store.data.credits}</div></div>
    `;
    dom.btnToggleHaptics.textContent = store.data.hapticsEnabled ? 'ON' : 'OFF';
  };

  const openHub = (tab: 'stages' | 'upgrades' | 'stats' = 'stages') => {
    engine.isPaused = true;
    dom.btnPause.textContent = '▶';
    closeAllModals();
    setHubTab(tab);
    renderHub();
    dom.hubModal.classList.add('active');
  };

  const updateHud = (hud: HudSnapshot) => {
    dom.stageLabel.textContent = hud.stage.isDaily
      ? hud.endlessMode
        ? 'Daily ∞'
        : 'Daily Ops'
      : hud.endlessMode
        ? `S${hud.stage.id} ∞`
        : `Stage ${hud.stage.id}`;
    dom.landingsVal.textContent = hud.endlessMode
      ? `${hud.landings}`
      : `${hud.landings}/${hud.stage.targetLandings}`;
    if (hud.stage.targetLaunches) {
      dom.launchesWrap.style.display = 'inline-flex';
      dom.launchesVal.textContent = `${hud.launches}/${hud.stage.targetLaunches}`;
    } else {
      dom.launchesWrap.style.display = 'none';
    }
    dom.scoreVal.textContent = String(hud.score);
    dom.bestVal.textContent = String(hud.bestScore);
    dom.creditsVal.textContent = String(hud.credits + hud.runCredits);
    dom.activeCount.textContent = `${hud.activeFlights} active${
      hud.orbitingCount > 0 ? ` (${hud.orbitingCount} orbit)` : ''
    }`;
    dom.atcMessage.textContent = hud.atcMessage;

    if (hud.multiplier > 1) {
      dom.comboPill.style.display = 'inline-block';
      dom.comboPill.textContent = `${hud.multiplier}x`;
    } else {
      dom.comboPill.style.display = 'none';
    }

    if (hud.tcasShields > 0) {
      dom.tcasPill.style.display = 'inline-flex';
      dom.tcasVal.textContent = String(hud.tcasShields);
    } else {
      dom.tcasPill.style.display = 'none';
    }

    dom.livesBox.querySelectorAll('.life-heart').forEach((heart, idx) => {
      heart.classList.toggle('lost', idx >= hud.lives);
    });

    if (hud.eventBanner) {
      dom.eventBanner.textContent = hud.eventBanner;
      dom.eventBanner.className = `event-banner visible tone-${hud.eventBannerTone}`;
    } else {
      dom.eventBanner.classList.remove('visible');
    }

    // Slow-Mo button charge
    dom.slowmoFill.style.width = `${Math.round(hud.slowMoCharge * 100)}%`;
    dom.btnSlowmo.classList.toggle('active', hud.slowMoActive);
    dom.slowmoLabel.textContent = hud.slowMoActive
      ? '0.35x'
      : `${Math.round(hud.slowMoCharge * 100)}%`;

    // Orbit button state
    dom.btnOrbit.classList.toggle('active', hud.selectedPlaneOrbiting);
    dom.orbitLabel.textContent = hud.selectedPlaneOrbiting ? 'RESUME' : 'ORBIT';

    // EMP chip state
    if (hud.empCooldownRatio > 0.01) {
      dom.empChip.className = 'emp-chip cooling';
      dom.empLabel.textContent = `EMP ${Math.round((1 - hud.empCooldownRatio) * 100)}%`;
    } else if (hud.activeHazards > 0) {
      dom.empChip.className = 'emp-chip alert';
      dom.empLabel.textContent = `TAP INTRUDER (${hud.activeHazards})`;
    } else {
      dom.empChip.className = 'emp-chip';
      dom.empLabel.textContent = 'EMP READY';
    }
  };

  const showPerkDraft = (perks: TacticalPerkDef[]) => {
    closeAllModals();
    dom.perkGrid.innerHTML = '';
    for (const p of perks) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'perk-card';
      card.innerHTML = `
        <div class="perk-top">
          <span class="perk-ico">${p.icon}</span>
          <span class="perk-tag">${p.tag}</span>
        </div>
        <div class="perk-name">${p.name}</div>
        <div class="perk-desc">${p.description}</div>
      `;
      card.addEventListener('click', () => {
        closeAllModals();
        engine.applyTacticalPerk(p.id);
      });
      dom.perkGrid.appendChild(card);
    }
    dom.perkModal.classList.add('active');
  };

  const showStageClear = (sum: RunSummary) => {
    closeAllModals();
    dom.clearStars.textContent = '★'.repeat(sum.stars) + '☆'.repeat(3 - sum.stars);
    dom.clearTitle.textContent = sum.stage.isDaily
      ? 'DAILY OPS CLEARED!'
      : `STAGE ${sum.stage.id} CLEARED!`;
    dom.clearSub.textContent = `${sum.stage.name} complete with ${sum.stars}/3 stars.`;
    dom.clearScore.textContent = String(sum.score);
    dom.clearLandings.textContent = String(sum.landings);
    dom.clearCredits.textContent = `+${sum.creditsEarned} 🪙`;
    dom.clearSpecial.textContent = `${sum.maydaysSaved} / ${sum.hazardsJammed}`;

    const hasNext = !sum.stage.isDaily && sum.stage.id < STAGES.length;
    dom.btnNextStage.style.display = hasNext ? 'block' : 'none';
    if (hasNext) {
      const next = STAGES[sum.stage.id];
      dom.btnNextStage.textContent = `Next: Stage ${next.id} — ${next.name} →`;
    }
    dom.clearModal.classList.add('active');
  };

  const showGameOver = (sum: RunSummary) => {
    closeAllModals();
    dom.overReason.textContent = sum.reason ?? 'Airspace closed';
    dom.overScore.textContent = String(sum.score);
    dom.overLandings.textContent = String(sum.landings);
    dom.overCredits.textContent = `+${sum.creditsEarned} 🪙`;
    dom.overStreak.textContent = String(sum.maxStreak);
    dom.gameoverModal.classList.add('active');
  };

  const engine = new RunwayGameEngine(dom.stageWrap, dom.canvas, store, {
    onHudUpdate: updateHud,
    onStageClear: showStageClear,
    onGameOver: showGameOver,
    onPerkDraft: showPerkDraft,
  });

  // Button bindings
  dom.btnStartStage.addEventListener('click', () => {
    closeAllModals();
    dom.btnPause.textContent = '⏸';
    engine.startCurrentStage();
  });

  dom.btnOpenMap.addEventListener('click', () => openHub('stages'));
  dom.btnOpenUpgrades.addEventListener('click', () => openHub('upgrades'));
  dom.btnStages.addEventListener('click', () => openHub('stages'));
  dom.btnHangar.addEventListener('click', () => openHub('upgrades'));
  dom.btnOverMap.addEventListener('click', () => openHub('stages'));
  dom.btnOverUpgrades.addEventListener('click', () => openHub('upgrades'));
  dom.btnClearUpgrades.addEventListener('click', () => openHub('upgrades'));

  dom.tabStages.addEventListener('click', () => setHubTab('stages'));
  dom.tabUpgrades.addEventListener('click', () => setHubTab('upgrades'));
  dom.tabStats.addEventListener('click', () => setHubTab('stats'));

  dom.btnPlayDaily.addEventListener('click', () => {
    const daily = buildDailyChallengeStage(getTodayDateKey());
    engine.loadStage(daily, false);
    showIntro(daily);
  });

  dom.btnCloseHub.addEventListener('click', () => {
    dom.hubModal.classList.remove('active');
    if (engine.hasStarted && !engine.isGameOver && !engine.isStageCleared && !engine.isPerkDraftOpen) {
      engine.isPaused = false;
      dom.btnPause.textContent = '⏸';
    } else if (!engine.hasStarted) {
      showIntro(engine.stage);
    }
  });

  dom.btnUnlockAll.addEventListener('click', () => {
    store.toggleUnlockAll();
    renderHub();
  });

  dom.btnToggleHaptics.addEventListener('click', () => {
    const next = !store.data.hapticsEnabled;
    haptics.enabled = next;
    store.setHapticsEnabled(next);
    if (next) haptics.light();
    renderHub();
  });

  dom.btnNextStage.addEventListener('click', () => {
    const nextId = Math.min(STAGES.length, engine.stage.id + 1);
    engine.loadStage(nextId, false);
    showIntro(engine.stage);
  });

  dom.btnEndless.addEventListener('click', () => {
    closeAllModals();
    dom.btnPause.textContent = '⏸';
    engine.continueEndless();
  });

  dom.btnReplayClear.addEventListener('click', () => {
    closeAllModals();
    dom.btnPause.textContent = '⏸';
    engine.resetRunState(true);
  });

  dom.btnRetry.addEventListener('click', () => {
    closeAllModals();
    dom.btnPause.textContent = '⏸';
    engine.resetRunState(true);
  });

  dom.btnSpeed.addEventListener('click', () => {
    const spd = engine.toggleSpeed();
    dom.btnSpeed.textContent = `${spd}x`;
  });

  dom.btnSound.addEventListener('click', () => {
    audio.init();
    audio.enabled = !audio.enabled;
    store.setSoundEnabled(audio.enabled);
    dom.btnSound.textContent = audio.enabled ? '🔊' : '🔇';
  });

  dom.btnPause.addEventListener('click', () => {
    const paused = engine.togglePause();
    dom.btnPause.textContent = paused ? '▶' : '⏸';
  });

  dom.btnSlowmo.addEventListener('click', () => {
    engine.toggleSlowMo();
  });

  dom.btnOrbit.addEventListener('click', () => {
    engine.orbitSelectedOrNearest();
  });

  // Desktop keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      engine.toggleSlowMo();
    } else if (e.key === 'o' || e.key === 'O') {
      engine.orbitSelectedOrNearest();
    } else if (e.key === 'p' || e.key === 'P') {
      const paused = engine.togglePause();
      dom.btnPause.textContent = paused ? '▶' : '⏸';
    } else if (e.key === 's' || e.key === 'S') {
      const spd = engine.toggleSpeed();
      dom.btnSpeed.textContent = `${spd}x`;
    }
  });

  // Native Android hardware Back button & background auto-pause (Play Store UX compliance)
  if (Capacitor.isNativePlatform()) {
    let lastBackPress = 0;

    void App.addListener('appStateChange', ({ isActive }) => {
      if (
        !isActive &&
        engine.hasStarted &&
        !engine.isPaused &&
        !engine.isGameOver &&
        !engine.isStageCleared &&
        !engine.isPerkDraftOpen
      ) {
        engine.isPaused = true;
        dom.btnPause.textContent = '▶';
        engine.showBanner('⏸ SHIFT PAUSED', 'info');
      }
    });

    void App.addListener('backButton', () => {
      if (dom.hubModal.classList.contains('active')) {
        dom.btnCloseHub.click();
        return;
      }
      if (dom.clearModal.classList.contains('active') || dom.gameoverModal.classList.contains('active')) {
        openHub('stages');
        return;
      }
      if (dom.perkModal.classList.contains('active')) {
        return;
      }
      if (engine.hasStarted && !engine.isPaused && !engine.isGameOver && !engine.isStageCleared) {
        engine.isPaused = true;
        dom.btnPause.textContent = '▶';
        openHub('stages');
        return;
      }
      const now = Date.now();
      if (now - lastBackPress < 1800) {
        void App.exitApp();
      } else {
        lastBackPress = now;
        engine.showBanner('Press Back again to exit Runway Control', 'info');
      }
    });
  }

  // Load initial unlocked stage or Stage 1
  engine.loadStage(1, false);
  showIntro(STAGES[0]);
}

void bootstrap();
