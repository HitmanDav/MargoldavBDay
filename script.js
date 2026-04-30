(function() {
  "use strict";

  const storage = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
      catch(e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
    }
  };

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const UA = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(UA);
  const isLow = isMobile && (navigator.deviceMemory || 4) < 4;
  const enableFX = !isLow;

  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const dogVideo = $('dogVideo'), bubble = $('speechBubble');
  const sleepInd = $('sleepIndicator'), dogBed = $('dogBed');
  const menuPanel = $('menuPanel'), menuBtn = $('menuButton');
  const sleepToggle = $('sleepToggleButton'), guestBtn = $('guestButton');
  const sizeSlider = $('sizeSlider'), volumeSlider = $('volumeSlider');
  const showPrintsCheck = $('showPrintsCheck'), darkThemeCheck = $('darkThemeCheck');
  const collarSelect = $('collarSelect'), bgSelect = $('bgSelect');
  const rainBtn = $('rainBtn'), snowBtn = $('snowBtn'), clearWeatherBtn = $('clearWeatherBtn');
  const textInput = $('textInputMenu'), voiceBtn = $('voiceBtnMenu');
  const diaryBtn = $('diaryBtn'), photoBtn = $('photoBtn'), weatherBtn = $('weatherBtn');
  const stepCheck = $('stepCounterCheck');
  const tttBoard = $('ticTacToeBoard'), tttMsg = $('tttMessage');
  const treatBowls = $('treatBowls'), treatMsg = $('treatMessage');
  const tugRope = $('tugRope'), tugMarker = $('tugMarker'), tugMsg = $('tugMessage');
  const photoCanvas = $('photoCanvas'), photoFrame = $('photoFrame');
  const downloadLink = $('downloadLink'), weatherInfo = $('weatherInfo');
  const diaryEntries = $('diaryEntries');
  const sizeValue = $('sizeValue'), volumeValue = $('volumeValue');
  const moodIcon = $('moodStateIcon'), moodText = $('moodStateText');
  const sleepText = $('sleepStateText'), actionCountEl = $('actionStateCount');
  const levelEl = $('levelDisplay'), xpEl = $('xpDisplay');

  let W, H, mouseX = 0, mouseY = 0, actionCount = 0;
  let weatherParticles = [], diary = [], totalSteps = 0, stepWatchId = null, stepHandler = null;
  let settings = { size:100, opacity:100, showPrints:true, volume:50, darkTheme:false, bg:'default', weather:'none' };
  const pet = {
    x:0, y:0, vx:0, vy:0, mood:'happy', sleep:false, dragged:false, dx:0, dy:0,
    facing:true, anim:'idle',
    targetX:null, targetY:null, moveStart:0, moveDur:0, startX:0, startY:0, moving:false,
    prints:[], lastPrintTime:0, bedX:0, bedY:0, bedDrag:false, bedOffX:0, bedOffY:0,
    ball:{x:0, y:0, active:false, r:20}, emotion:'happy', bond:0.6,
    memory:{pet:0, play:0, ignore:Date.now()}, xp:0, level:1, collar:'none'
  };
  let stateLock = false, lastDec = 0;
  const needs = {energy:0.8, fun:0.7, social:0.6};
  const STATE = {IDLE:'IDLE', WANDER:'WANDER', FOLLOW:'FOLLOW', FETCH:'FETCH', SLEEP:'SLEEP'};
  let currState = STATE.IDLE;
  const CONFIG = { apiKeys:[], models:[], systemPrompt:'' };
  let keyIdx = 0, videoReady = false;
  const posterImg = new Image(); posterImg.src = 'animations/start.png';
  let animReadyHandler = null, audioCtx = null, userInteracted = false;

  let ballDrag = false, ballDragOffX = 0, ballDragOffY = 0;

  const ANIM = {
    idle:   {src:null, type:'poster'},
    walk:   {src:'animations/walk.webm', type:'video', rate:1},
    run:    {src:'animations/run.webm',  type:'video', rate:1},
    sleep:  {src:'animations/sleep.webm', type:'video', rate:1, loop:true},
    sitting:{src:'animations/sitting.webm', type:'video', rate:1, loop:true},
    look:   {src:'animations/looking_back.webm', type:'video', rate:1, once:true},
    sneeze: {src:'animations/sneeze.webm', type:'video', rate:2, once:true}
  };
  const phrases = {
    angryWake: ["КТО МЕНЯ ТРЯСЁТ?!","НЕ ТРОГАЙ СПЯЩЕГО ПСА!","Я ТЕБЕ СЕЙЧАС ПОКАЖУ ГРОМКИЙ ЗВУК!","ТЫ ЧТО, С УМА СОШЁЛ?!","ГАВ-ГАВ-ГАВ!!!","МАЙБАХ НЕ ДОВОЛЕН!!!"],
    softWake:  ["Ты чего? Я так сладко спал...","Зачем разбудили?","Ладно, давай играть.","Я ещё немного уставший...","Ну что там у тебя?"],
    owner:     ["Соня — самая лучшая хозяйка в мире! Гав!","Обожаю Соню, она меня чешет за ушком.","Соня приносит мне игрушки и вкусняшки.","Моя Соня всегда со мной играет, я её защищаю!","Если кто-то обидит Соню, я зарычу! Р-р-р!","Соня для меня как солнышко. Гав!"]
  };

  const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const showBubble = (txt, d=4000) => {
    if (!bubble) return;
    bubble.style.opacity = '1';
    bubble.textContent = txt;
    bubble.style.left = (pet.x - 40) + 'px';
    bubble.style.top = (pet.y - 110) + 'px';
    clearTimeout(window.bt);
    window.bt = setTimeout(() => { if(bubble) bubble.style.opacity = '0'; }, d);
  };
  const speak = (txt) => {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'ru-RU'; u.rate = 1.1;
    speechSynthesis.speak(u);
  };
  const getAudioCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };
  const playSound = (type) => {
    if (!enableFX || (isMobile && !userInteracted)) return;
    const vol = settings.volume / 100;
    try {
      const ac = getAudioCtx();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = vol * 0.3;
      if (type === 'snore') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.5);
        g.gain.setValueAtTime(0.1 * vol, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.8);
        osc.start(); osc.stop(ac.currentTime + 0.8);
      } else if (type === 'bark') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(700, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.15);
        osc.start(); osc.stop(ac.currentTime + 0.2);
      } else if (type === 'angry') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ac.currentTime + 0.3);
        osc.start(); osc.stop(ac.currentTime + 0.4);
      }
      osc.connect(g); g.connect(ac.destination);
    } catch(e) {}
  };

  const savePet = () => storage.set('spitz_data', {xp:pet.xp, level:pet.level, collar:pet.collar});
  const loadPet = () => {
    const data = storage.get('spitz_data');
    if (data) {
      pet.xp = data.xp || 0;
      pet.level = data.level || 1;
      pet.collar = data.collar || 'none';
    }
    if (levelEl) levelEl.textContent = pet.level;
    if (xpEl) xpEl.textContent = pet.xp;
    if (collarSelect) collarSelect.value = pet.collar;
  };
  const saveSettings = () => storage.set('spitz_settings', settings);
  const loadSettings = () => {
    const saved = storage.get('spitz_settings');
    if (saved) Object.assign(settings, saved);
    if (isLow) settings.showPrints = false;
    if (sizeSlider) sizeSlider.value = settings.size;
    if (volumeSlider) volumeSlider.value = settings.volume;
    if (showPrintsCheck) showPrintsCheck.checked = settings.showPrints;
    if (darkThemeCheck) darkThemeCheck.checked = settings.darkTheme;
    if (bgSelect) bgSelect.value = settings.bg;
    document.body.classList.toggle('dark-theme', settings.darkTheme);
    updateBg();
    updateWeatherFx();
  };
  const saveSteps = () => storage.set('spitz_steps', totalSteps);
  const loadSteps = () => { totalSteps = storage.get('spitz_steps', 0); };
  const saveDiary = () => storage.set('spitz_diary', diary);
  const loadDiary = () => { diary = storage.get('spitz_diary', []); };

  const updateMood = () => {
    const moods = {calm:'😌 Спокойный', happy:'😊 Счастливый', tired:'😴 Уставший', angry:'😠 Злой'};
    const [icon, ...text] = (moods[pet.mood] || moods.calm).split(' ');
    if (moodIcon) moodIcon.textContent = icon;
    if (moodText) moodText.textContent = text.join(' ');
  };
  const updateSleepDisp = () => {
    if (sleepText) sleepText.textContent = pet.sleep ? 'Да (😴)' : 'Нет (бодрствует)';
    if (isMobile && sleepToggle) sleepToggle.textContent = pet.sleep ? '😴' : '🐕';
  };
  const incAction = () => {
    actionCount++;
    if (actionCountEl) actionCountEl.textContent = actionCount;
  };
  const addXP = (amt) => {
    pet.xp = Math.max(0, pet.xp + amt);
    const need = pet.level * 100;
    while (pet.xp >= need) {
      pet.xp -= need;
      pet.level++;
      showBubble(`Уровень ${pet.level}! Гав!`, 3000);
    }
    if (levelEl) levelEl.textContent = pet.level;
    if (xpEl) xpEl.textContent = pet.xp;
    savePet();
  };
  const updateBg = () => {
    const b = document.body;
    if (settings.bg === 'park') b.style.background = 'linear-gradient(180deg, #87CEEB 0%, #98FB98 100%)';
    else if (settings.bg === 'beach') b.style.background = 'linear-gradient(180deg, #FFDAB9 0%, #FFE4B5 100%)';
    else b.style.background = '';
  };
  const updateWeatherFx = () => {
    weatherParticles = [];
    if (settings.weather === 'rain') {
      for (let i=0; i<80; i++) weatherParticles.push({x:Math.random()*W, y:Math.random()*H, s:4+Math.random()*8});
    } else if (settings.weather === 'snow') {
      for (let i=0; i<60; i++) weatherParticles.push({x:Math.random()*W, y:Math.random()*H, s:1+Math.random()*3, r:2+Math.random()*4});
    }
  };

  const initVideoPlayback = () => {
    if (videoReady) return;
    dogVideo.muted = true;
    dogVideo.playsInline = true;
    dogVideo.play().then(() => { videoReady = true; dogVideo.pause(); }).catch(() => { videoReady = false; });
  };
  const setAnim = (name) => {
    if (pet.anim === name && name !== 'sneeze' && name !== 'look') return;
    const anim = ANIM[name];
    if (!anim) return;
    pet.anim = name;
    if (anim.type === 'poster') {
      dogVideo.pause();
      dogVideo.currentTime = 0;
    } else if (videoReady) {
      if (animReadyHandler) dogVideo.removeEventListener('canplay', animReadyHandler);
      dogVideo.src = anim.src;
      dogVideo.playbackRate = anim.rate || 1;
      dogVideo.loop = anim.loop || false;
      if (dogVideo.readyState >= 2) {
        dogVideo.currentTime = 0;
        dogVideo.play().catch(()=>{});
      } else {
        animReadyHandler = () => {
          dogVideo.currentTime = 0;
          dogVideo.play().catch(()=>{});
          dogVideo.removeEventListener('canplay', animReadyHandler);
          animReadyHandler = null;
        };
        dogVideo.addEventListener('canplay', animReadyHandler);
      }
    }
  };
  const updateAnimByState = () => {
    if (pet.sleep) { setAnim('sleep'); return; }
    const spd = Math.hypot(pet.vx, pet.vy);
    if (pet.dragged || pet.moving) setAnim(spd > 4 ? 'run' : 'walk');
    else if (spd < 0.3) setAnim('idle');
    else if (spd < 2.5) setAnim('walk');
    else setAnim('run');
  };

  const drawDog = () => {
    const baseW = posterImg.complete && posterImg.naturalWidth ? posterImg.naturalWidth : 130;
    const baseH = posterImg.complete && posterImg.naturalHeight ? posterImg.naturalHeight : 130;
    const w = baseW, h = baseH;
    const scale = settings.size / 100;
    const dw = w * scale, dh = h * scale;
    const x = pet.x - dw/2, y = pet.y - dh/2;
    if (pet.collar !== 'none') {
      ctx.save();
      ctx.strokeStyle = pet.collar; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(pet.x, pet.y - dh*0.35, dw*0.25, 8, 0, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    if (pet.anim === 'idle' || !videoReady || dogVideo.readyState < 2 || dogVideo.ended) {
      if (posterImg.complete) ctx.drawImage(posterImg, x, y, dw, dh);
      return;
    }
    ctx.save();
    if (!pet.facing) { ctx.translate(pet.x, pet.y); ctx.scale(-1,1); ctx.drawImage(dogVideo, -dw/2, -dh/2, dw, dh); }
    else ctx.drawImage(dogVideo, x, y, dw, dh);
    ctx.restore();
  };
  const drawWeather = () => {
    if (settings.weather === 'rain') {
      ctx.fillStyle = 'rgba(200,200,255,0.5)';
      weatherParticles.forEach(p => { ctx.fillRect(p.x, p.y, 2, 10); p.y += p.s; if (p.y > H) { p.y = -10; p.x = Math.random()*W; } });
    } else if (settings.weather === 'snow') {
      ctx.fillStyle = 'white';
      weatherParticles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); p.y += p.s; if (p.y > H) { p.y = -10; p.x = Math.random()*W; } });
    }
  };
  const drawBall = () => {
    if (!pet.ball.active) return;
    ctx.beginPath(); ctx.arc(pet.ball.x, pet.ball.y, pet.ball.r, 0, Math.PI*2);
    ctx.fillStyle = '#FF4500'; ctx.fill(); ctx.strokeStyle = '#B22222'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(pet.ball.x-6, pet.ball.y-6, 5, 0, Math.PI*2); ctx.fillStyle = 'white'; ctx.fill();
  };
  const spawnBall = () => {
    pet.ball.x = 150 + Math.random() * (W - 300);
    pet.ball.y = 150 + Math.random() * (H - 300);
    pet.ball.active = true;
  };
  const addPrint = () => {
    if (!settings.showPrints || !enableFX) return;
    const now = Date.now();
    if (now - pet.lastPrintTime < 300) return;
    pet.lastPrintTime = now;
    if (pet.y < H - 100) return;
    pet.prints.push({x:pet.x, y:pet.y+20, time:now});
    if (pet.prints.length > 40) pet.prints.shift();
  };

  const moveToSleep = () => {
    if (pet.sleep) return;
    const bx = pet.bedX + 80, by = pet.bedY + 50;
    Object.assign(pet, {
      moving: true, targetX: bx, targetY: by-20,
      moveStart: performance.now(), moveDur: 2000,
      startX: pet.x, startY: pet.y,
      onMoveEnd: () => {
        pet.sleep = true; updateSleepDisp();
        pet.vx = pet.vy = 0; sleepInd.style.opacity = '1';
        setAnim('sleep'); showBubble('😴 Хррр...', 2000); playSound('snore');
        pet.facing = true; pet.x = bx; pet.y = by-20;
        pet.targetX = pet.targetY = null;
      }
    });
    setAnim('run');
  };
  const softWake = () => {
    if (!pet.sleep) return;
    pet.sleep = false; updateSleepDisp(); sleepInd.style.opacity = '0';
    pet.mood = 'tired'; updateMood();
    showBubble(pick(phrases.softWake), 3000); speak(pick(phrases.softWake));
    setAnim('idle'); stateLock = false;
  };
  const goTo = (tx, ty, dur, next) => {
    if (pet.dragged || pet.sleep) { stateLock = false; return; }
    Object.assign(pet, {
      moving: true, targetX: tx, targetY: ty,
      moveStart: performance.now(), moveDur: dur,
      startX: pet.x, startY: pet.y,
      onMoveEnd: () => { pet.moving = false; pet.targetX = pet.targetY = null; if (next) setState(next); else stateLock = false; }
    });
  };
  const setState = (st) => {
    currState = st;
    if (st === STATE.IDLE) setTimeout(() => { stateLock = false; }, 1000+Math.random()*2000);
    else if (st === STATE.WANDER) {
      const a = Math.random()*Math.PI*2, d = 150+Math.random()*200;
      goTo(clamp(pet.x+Math.cos(a)*d,60,W-60), clamp(pet.y+Math.sin(a)*d,80,H-80), 2000, STATE.IDLE);
    } else if (st === STATE.FOLLOW) goTo(mouseX, mouseY, 2000, STATE.IDLE);
    else if (st === STATE.FETCH) {
      if (!pet.ball.active) { stateLock = false; return; }
      goTo(pet.ball.x, pet.ball.y, 1500, null);
      pet.onMoveEnd = () => {
        if (!pet.ball.active) { stateLock = false; return; }
        pet.ball.active = false; goTo(mouseX, mouseY, 2000, null);
        pet.onMoveEnd = () => {
          pet.ball.x = mouseX; pet.ball.y = mouseY; pet.ball.active = true;
          showBubble('Апорт!', 1500); needs.fun = Math.min(1, needs.fun+0.2);
          pet.memory.play = Date.now(); stateLock = false;
        };
      };
    } else if (st === STATE.SLEEP) {
      moveToSleep();
      setTimeout(() => { needs.energy = 1; stateLock = false; setState(STATE.IDLE); }, 8000);
    }
  };
  const decideState = () => {
    if (stateLock || Date.now()-lastDec < 1500) return;
    lastDec = Date.now(); stateLock = true;
    const now = Date.now();
    if (pet.sleep) pet.emotion = 'sleepy';
    else if (now-pet.memory.pet < 5000) pet.emotion = 'happy';
    else if (now-pet.memory.play < 8000) pet.emotion = 'excited';
    else if (now-pet.memory.ignore > 15000) pet.emotion = 'bored';
    if (needs.energy < 0.2 || pet.emotion === 'sleepy') setState(STATE.SLEEP);
    else if (pet.emotion === 'bored' && Math.random()<0.6) setState(STATE.FOLLOW);
    else if (pet.emotion === 'excited' && pet.ball.active) setState(STATE.FETCH);
    else if (Math.random() < pet.bond) setState(STATE.FOLLOW);
    else setState(STATE.WANDER);
  };

  let lastFrameTime = 0;
  const gameLoop = (t) => {
    const dt = t - (lastFrameTime || t);
    lastFrameTime = t;
    const gameModalOpen = document.querySelector('.game-modal.active');
    if (!gameModalOpen) {
      needs.energy = clamp(needs.energy - dt*0.00002, 0, 1);
      needs.fun   = clamp(needs.fun   - dt*0.000015, 0, 1);
      needs.social= clamp(needs.social- dt*0.00001, 0, 1);
      decideState();
      if (!pet.dragged && !pet.sleep && pet.moving && pet.targetX !== null) {
        const elapsed = performance.now() - pet.moveStart;
        const progress = Math.min(1, elapsed / pet.moveDur);
        const ease = progress<0.5 ? 2*progress*progress : 1-Math.pow(-2*progress+2,2)/2;
        pet.x = pet.startX + (pet.targetX-pet.startX)*ease;
        pet.y = pet.startY + (pet.targetY-pet.startY)*ease;
        if (progress >= 1) {
          pet.x = pet.targetX; pet.y = pet.targetY; pet.moving = false; pet.targetX = pet.targetY = null;
          if (pet.onMoveEnd) { const cb = pet.onMoveEnd; pet.onMoveEnd = null; cb(); }
        }
      }
      updateAnimByState();
      if (pet.vx > 0.1 || (pet.moving && pet.targetX && pet.targetX > pet.x)) pet.facing = true;
      else if (pet.vx < -0.1 || (pet.moving && pet.targetX && pet.targetX < pet.x)) pet.facing = false;
      if (settings.showPrints && enableFX && (Math.abs(pet.vx)>0.5 || pet.moving) && pet.y >= H-100) addPrint();
    }
    pet.vx = pet.targetX ? (pet.targetX-pet.x)*0.05 : 0;
    pet.vy = pet.targetY ? (pet.targetY-pet.y)*0.05 : 0;
    ctx.clearRect(0, 0, W, H);
    drawWeather(); drawBall(); drawDog();
    if (bubble) {
      bubble.style.left = (pet.x-40) + 'px';
      bubble.style.top = (pet.y-110) + 'px';
    }
    requestAnimationFrame(gameLoop);
  };

  const resize = () => {
    const dpr = isLow ? Math.min(window.devicePixelRatio,2) : window.devicePixelRatio||1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*dpr; canvas.height = H*dpr;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr,dpr);
    pet.x = clamp(pet.x, 60, W-60); pet.y = clamp(pet.y, 80, H-80);
    if (pet.targetX !== null) {
      pet.targetX = clamp(pet.targetX, 60, W-60);
      pet.targetY = clamp(pet.targetY, 80, H-80);
    }
    pet.ball.x = clamp(pet.ball.x, 100, W-100);
    pet.ball.y = clamp(pet.ball.y, 100, H-100);
    updateWeatherFx();
  };
  window.addEventListener('resize', resize);

  const loadConfig = () => {
    fetch('config.json', { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(d => {
        if (d.apiKeys) CONFIG.apiKeys = d.apiKeys;
        if (d.models) CONFIG.models = d.models;
        if (d.systemPrompt) CONFIG.systemPrompt = d.systemPrompt;
        Object.freeze(CONFIG);
      }).catch(() => {});
  };
  const getApiKey = () => CONFIG.apiKeys.length ? CONFIG.apiKeys[keyIdx] : null;
  const rotateKey = () => { keyIdx = (keyIdx+1) % CONFIG.apiKeys.length; return CONFIG.apiKeys[keyIdx]; };
  const askAI = async (msg) => {
    const key = getApiKey();
    if (!key) { showBubble('Нет ключа API', 3000); return; }
    const model = CONFIG.models[0] || 'google/gemma-4-31b-it:free';
    let retries = 0;
    const attempt = async () => {
      if (retries++ > 5) { showBubble('ИИ устал', 3000); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method:'POST',
          headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json','HTTP-Referer':location.origin},
          body: JSON.stringify({model, messages:[{role:'system',content:CONFIG.systemPrompt},{role:'user',content:msg}], max_tokens:120, temperature:0.9}),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) { if (res.status===429||res.status===401||res.status===403) { rotateKey(); return attempt(); } throw new Error(`HTTP ${res.status}`); }
        const data = await res.json();
        let reply = data.choices?.[0]?.message?.content || 'Гав?';
        reply = reply.replace(/р/g, () => Math.random()<0.1?'р-р-р':'р');
        showBubble(reply, 5000); speak(reply); incAction();
      } catch(e) { clearTimeout(timeout); showBubble('Ошибка связи', 3000); }
    };
    attempt();
  };
  const handleMsg = (msg) => {
    if (pet.sleep) { showBubble('Я сплю...', 1000); return; }
    pet.memory.ignore = Date.now(); pet.bond = Math.min(1, pet.bond+0.01);
    if (/соня|хозяйка|хозяин|хозяйку|хозяйке|соню|соне|соней/i.test(msg)) {
      showBubble(pick(phrases.owner), 5000); speak(pick(phrases.owner)); incAction(); return;
    }
    askAI(msg);
  };

  let tttBoardData, tttActive, tttPlayer, tttOver, tttTimer;
  const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const cleanupTTT = () => { if (tttTimer) clearTimeout(tttTimer); tttActive = false; };
  const renderTTT = () => {
    tttBoard.innerHTML = '';
    tttBoardData.forEach((c,i) => {
      const div = document.createElement('div'); div.className = 'ttt-cell'; if (c) div.classList.add(c);
      div.textContent = c; div.addEventListener('click', ()=>tttClick(i)); tttBoard.appendChild(div);
    });
  };
  const tttClick = (i) => {
    if (!tttActive || tttOver || tttBoardData[i] || tttPlayer !== 'X') return;
    tttBoardData[i] = 'X'; renderTTT(); checkTTT();
    if (!tttOver) { tttPlayer='O'; tttMsg.textContent='Майбах думает...'; tttTimer = setTimeout(maybachTTT, 800+Math.random()*1200); }
  };
  const maybachTTT = () => {
    if (!tttActive || tttOver) return;
    let moved = false;
    for (const [a,b,c] of winPatterns) {
      if (tttBoardData[a]==='O'&&tttBoardData[b]==='O'&&!tttBoardData[c]) { setCell(c,'O'); moved=true; break; }
      if (tttBoardData[a]==='O'&&tttBoardData[c]==='O'&&!tttBoardData[b]) { setCell(b,'O'); moved=true; break; }
      if (tttBoardData[b]==='O'&&tttBoardData[c]==='O'&&!tttBoardData[a]) { setCell(a,'O'); moved=true; break; }
    }
    if (!moved) {
      for (const [a,b,c] of winPatterns) {
        if (tttBoardData[a]==='X'&&tttBoardData[b]==='X'&&!tttBoardData[c]) { setCell(c,'O'); moved=true; break; }
        if (tttBoardData[a]==='X'&&tttBoardData[c]==='X'&&!tttBoardData[b]) { setCell(b,'O'); moved=true; break; }
        if (tttBoardData[b]==='X'&&tttBoardData[c]==='X'&&!tttBoardData[a]) { setCell(a,'O'); moved=true; break; }
      }
    }
    if (!moved) {
      if (!tttBoardData[4]) { setCell(4,'O'); moved=true; }
    }
    if (!moved) {
      const empty = tttBoardData.reduce((arr,v,i)=> v===''?[...arr,i]:arr, []);
      if (empty.length) setCell(empty[Math.floor(Math.random()*empty.length)], 'O');
    }
    checkTTT();
    if (!tttOver) {
      tttPlayer = 'X';
      tttMsg.textContent = 'Твой ход (X)';
    }
  };
  const setCell = (i, pl) => { tttBoardData[i] = pl; renderTTT(); };
  const checkTTT = () => {
    for (const [a,b,c] of winPatterns) {
      if (tttBoardData[a]&&tttBoardData[a]===tttBoardData[b]&&tttBoardData[a]===tttBoardData[c]) {
        tttOver=true; tttActive=false; cleanupTTT();
        if (tttBoardData[a]==='X') { tttMsg.textContent='Ты выиграл!'; showBubble('Ты выиграл!',3000); playSound('angry'); }
        else { tttMsg.textContent='Майбах выиграл!'; showBubble('Я выиграл!',3000); addXP(10); }
        incAction(); return;
      }
    }
    if (!tttBoardData.includes('')) { tttOver=true; tttActive=false; cleanupTTT(); tttMsg.textContent='Ничья!'; showBubble('Ничья!',2000); addXP(5); incAction(); }
  };
  const startNewGame = () => {
    cleanupTTT();
    tttBoardData = ['','','','','','','','',''];
    tttActive = true; tttOver = false; tttPlayer = 'X';
    renderTTT(); tttMsg.textContent = 'Твой ход (X)';
  };

  let treatActive, treatCorrect;
  const cleanupTreat = () => { treatActive = false; };
  const startTreatGame = () => {
    cleanupTreat();
    treatActive = true; treatCorrect = Math.floor(Math.random()*3);
    treatBowls.innerHTML = ''; treatMsg.textContent = 'Выбери миску!';
    for (let i=0;i<3;i++) {
      const bowl = document.createElement('div'); bowl.style.cssText = 'font-size:60px;cursor:pointer'; bowl.textContent='🥣';
      bowl.addEventListener('click',()=>{
        if (!treatActive) return;
        treatActive = false;
        if (i===treatCorrect) { treatMsg.textContent='Правильно! Гав!'; showBubble('Ура! Вкусняшка!',2000); addXP(8); playSound('bark'); }
        else { treatMsg.textContent='Нет, здесь пусто...'; showBubble('Не угадал!',2000); }
      });
      treatBowls.appendChild(bowl);
    }
  };

  let tugPos = 50, tugActive = false;
  const cleanupTug = () => {
    tugActive = false;
    tugRope.onpointerdown = null;
    window.removeEventListener('pointermove', tugMoveHandler);
    window.removeEventListener('pointerup', tugUpHandler);
  };
  let tugMoveHandler, tugUpHandler;
  const resetTug = () => { tugPos = 50; tugMarker.style.left = '50%'; tugMsg.textContent = 'Тяни за маркер!'; };
  const startTugGame = () => {
    cleanupTug();
    tugActive = true; resetTug();
    tugRope.onpointerdown = (e) => {
      if (!tugActive) return;
      e.preventDefault();
      const rect = tugRope.getBoundingClientRect();
      tugMoveHandler = (ev) => {
        const x = ev.clientX - rect.left;
        tugPos = clamp((x/rect.width)*100, 5, 95);
        tugMarker.style.left = tugPos+'%';
        if (tugPos<10) endTug('win');
        else if (tugPos>90) endTug('lose');
      };
      tugUpHandler = () => {
        window.removeEventListener('pointermove', tugMoveHandler);
        window.removeEventListener('pointerup', tugUpHandler);
      };
      window.addEventListener('pointermove', tugMoveHandler);
      window.addEventListener('pointerup', tugUpHandler);
    };
  };
  const endTug = (result) => {
    if (!tugActive) return;
    tugActive = false; tugRope.onpointerdown = null;
    if (result==='win') { tugMsg.textContent='Ты выиграл! Майбах отпустил.'; showBubble('Ладно, твоя взяла!',2000); addXP(10); }
    else { tugMsg.textContent='Майбах победил!'; showBubble('Я сильнее! Гав!',2000); playSound('angry'); }
    incAction();
  };

  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal || modal.classList.contains('active')) return;
    modal.classList.add('active');
  };
  const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    if (id === 'tictactoeModal') cleanupTTT();
    else if (id === 'treatModal') cleanupTreat();
    else if (id === 'tugModal') cleanupTug();
  };

  const bindUI = () => {
    $('openTttBtn').onclick = () => { if (pet.sleep) showBubble('Я сплю...'); else { openModal('tictactoeModal'); startNewGame(); } };
    $('newTttGameBtn').onclick = startNewGame;
    $('closeTttBtn').onclick = () => closeModal('tictactoeModal');

    $('openTreatBtn').onclick = () => { if (pet.sleep) showBubble('Я сплю...'); else { openModal('treatModal'); startTreatGame(); } };
    $('newTreatGameBtn').onclick = startTreatGame;
    $('closeTreatBtn').onclick = () => closeModal('treatModal');

    $('openTugBtn').onclick = () => { if (pet.sleep) showBubble('Я сплю...'); else { openModal('tugModal'); startTugGame(); } };
    $('resetTugBtn').onclick = () => { resetTug(); startTugGame(); };
    $('closeTugBtn').onclick = () => closeModal('tugModal');

    diaryBtn.onclick = () => { renderDiary(); openModal('diaryModal'); };
    $('closeDiaryBtn').onclick = () => closeModal('diaryModal');

    photoBtn.onclick = () => openModal('photoModal');
    $('takePhotoBtn').onclick = takePhoto;
    $('closePhotoBtn').onclick = () => closeModal('photoModal');

    weatherBtn.onclick = () => { fetchWeather(); openModal('weatherModal'); };
    $('closeWeatherBtn').onclick = () => closeModal('weatherModal');

    voiceBtn.onclick = () => {
      if (pet.sleep) { showBubble('Я сплю...'); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { showBubble('Нет поддержки', 1000); return; }
      if (window.currentRecognition) window.currentRecognition.abort();
      const rec = new SR(); rec.lang = 'ru-RU';
      rec.onstart = () => showBubble('🎤 Говорите...');
      rec.onresult = (e) => {
        const t = e.results[0][0].transcript;
        if (textInput) textInput.value = t;
        handleMsg(t);
      };
      rec.onerror = () => showBubble('Не расслышал', 1000);
      rec.start();
      window.currentRecognition = rec;
    };
    textInput.addEventListener('keypress', (e) => { if (e.key==='Enter' && textInput.value.trim()) { handleMsg(textInput.value.trim()); textInput.value = ''; } });

    sizeSlider.oninput = () => { settings.size = +sizeSlider.value; if (sizeValue) sizeValue.textContent = settings.size+'%'; saveSettings(); };
    volumeSlider.oninput = () => { settings.volume = +volumeSlider.value; if (volumeValue) volumeValue.textContent = settings.volume+'%'; saveSettings(); };
    showPrintsCheck.onchange = () => { settings.showPrints = showPrintsCheck.checked; saveSettings(); };
    darkThemeCheck.onchange = () => { settings.darkTheme = darkThemeCheck.checked; document.body.classList.toggle('dark-theme'); saveSettings(); };
    collarSelect.onchange = () => { pet.collar = collarSelect.value; savePet(); };
    bgSelect.onchange = () => { settings.bg = bgSelect.value; updateBg(); saveSettings(); };
    rainBtn.onclick = () => { settings.weather='rain'; updateWeatherFx(); saveSettings(); };
    snowBtn.onclick = () => { settings.weather='snow'; updateWeatherFx(); saveSettings(); };
    clearWeatherBtn.onclick = () => { settings.weather='none'; updateWeatherFx(); saveSettings(); };
    stepCheck.onchange = function() { this.checked ? startStepCounter() : stopStepCounter(); saveSettings(); };

    menuBtn.onclick = () => menuPanel.classList.add('open');
    $('menuCloseBtn').onclick = () => menuPanel.classList.remove('open');
    sleepToggle.onclick = () => { if (pet.sleep) softWake(); else { stateLock=true; setState(STATE.SLEEP); } };
    guestBtn.onclick = () => { showBubble('Гостевой режим! Привет!'); pet.bond = 0.5; };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!userInteracted) { userInteracted = true; initVideoPlayback(); }
    if (document.querySelector('.game-modal.active')) return;

    const mx = e.clientX, my = e.clientY;

    if (pet.ball.active && Math.hypot(mx - pet.ball.x, my - pet.ball.y) < pet.ball.r) {
      e.preventDefault();
      ballDrag = true;
      ballDragOffX = pet.ball.x - mx;
      ballDragOffY = pet.ball.y - my;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (pet.dragged || pet.sleep) return;
    if (Math.hypot(mx - pet.x, my - pet.y) < 60) {
      pet.dragged = true;
      pet.dx = pet.x - mx;
      pet.dy = pet.y - my;
      pet.memory.pet = Date.now();
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (ballDrag) {
      e.preventDefault();
      pet.ball.x = clamp(e.clientX + ballDragOffX, 30, W - 30);
      pet.ball.y = clamp(e.clientY + ballDragOffY, 30, H - 30);
      mouseX = e.clientX;
      mouseY = e.clientY;
      return;
    }
    if (!pet.dragged) return;
    e.preventDefault();
    pet.x = clamp(e.clientX + pet.dx, 60, W-60);
    pet.y = clamp(e.clientY + pet.dy, 80, H-80);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (ballDrag) {
      ballDrag = false;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }
    if (pet.dragged) {
      pet.dragged = false;
      pet.memory.pet = Date.now();
      canvas.releasePointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (ballDrag) {
      ballDrag = false;
      canvas.releasePointerCapture(e.pointerId);
    }
    if (pet.dragged) {
      pet.dragged = false;
      canvas.releasePointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('click', (e) => {
    if (document.querySelector('.game-modal.active')) return;
    const mx = e.clientX, my = e.clientY;
    if (pet.ball.active && Math.hypot(mx - pet.ball.x, my - pet.ball.y) < pet.ball.r) {
      return;
    }
    if (Math.hypot(mx - pet.x, my - pet.y) < 60) {
      return;
    }
    if (!pet.ball.active) {
      pet.ball.x = clamp(mx, 30, W-30);
      pet.ball.y = clamp(my, 30, H-30);
      pet.ball.active = true;
      showBubble('Вот твой мячик!', 1500);
    }
  });

  dogBed.addEventListener('pointerdown', (e) => {
    if (document.querySelector('.game-modal.active')) return;
    e.stopPropagation(); e.preventDefault();
    pet.bedDrag = true;
    const rect = dogBed.getBoundingClientRect();
    pet.bedOffX = e.clientX - rect.left; pet.bedOffY = e.clientY - rect.top;
    dogBed.setPointerCapture(e.pointerId);
  });
  dogBed.addEventListener('pointermove', (e) => {
    if (!pet.bedDrag) return;
    e.preventDefault();
    pet.bedX = clamp(e.clientX - pet.bedOffX, 0, W-160);
    pet.bedY = clamp(e.clientY - pet.bedOffY, 0, H-100);
    dogBed.style.left = pet.bedX + 'px'; dogBed.style.top = pet.bedY + 'px';
  });
  dogBed.addEventListener('pointerup', (e) => {
    if (pet.bedDrag) { pet.bedDrag = false; storage.set('spitz_bed', {x:pet.bedX, y:pet.bedY}); dogBed.releasePointerCapture(e.pointerId); }
  });
  dogBed.addEventListener('pointercancel', (e) => {
    if (pet.bedDrag) { pet.bedDrag = false; dogBed.releasePointerCapture(e.pointerId); }
  });

  const startStepCounter = () => {
    if (stepWatchId) return;
    if (window.DeviceMotionEvent) {
      let lastStep = 0;
      stepHandler = (e) => {
        const acc = e.accelerationIncludingGravity;
        const mag = Math.sqrt(acc.x*acc.x+acc.y*acc.y+acc.z*acc.z);
        if (mag > 15 && Date.now()-lastStep > 500) { totalSteps++; lastStep = Date.now(); saveSteps(); }
      };
      window.addEventListener('devicemotion', stepHandler);
      stepWatchId = 1;
    }
  };
  const stopStepCounter = () => {
    if (stepHandler) { window.removeEventListener('devicemotion', stepHandler); stepHandler = null; }
    stepWatchId = null;
  };

  const renderDiary = () => {
    diaryEntries.innerHTML = '';
    if (diary.length === 0) {
      diaryEntries.appendChild(document.createTextNode('Пока записей нет.'));
      return;
    }
    diary.forEach(e => {
      const div = document.createElement('div');
      div.style.marginBottom = '8px';
      const b = document.createElement('b');
      b.textContent = e.time + ' ';
      div.appendChild(b);
      div.appendChild(document.createTextNode(e.text));
      diaryEntries.appendChild(div);
    });
  };
  const addDiary = (text) => {
    diary.unshift({time:new Date().toLocaleString(), text});
    if(diary.length>50) diary.pop();
    saveDiary();
  };

  const takePhoto = () => {
    photoCanvas.width = canvas.width; photoCanvas.height = canvas.height;
    const pctx = photoCanvas.getContext('2d'); pctx.drawImage(canvas,0,0);
    const data = photoCanvas.toDataURL('image/png');
    photoFrame.src = data; photoFrame.style.display='block';
    downloadLink.href = data; downloadLink.download='maybach.png'; downloadLink.style.display='inline-block';
  };

  const fetchWeather = () => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current_weather=true', { signal: AbortSignal.timeout(5000) })
      .then(r=>r.json())
      .then(d => {
        const w = d.current_weather;
        weatherInfo.textContent = `Температура: ${w.temperature}°C, Ветер: ${w.windspeed} км/ч`;
        showBubble(w.weathercode <= 3 ? 'Хорошая погода! Гав!' : 'На улице пасмурно...');
      })
      .catch(() => { weatherInfo.textContent = 'Ошибка загрузки'; });
  };

  resize();
  pet.x = W/2; pet.y = H/2;
  const savedBed = storage.get('spitz_bed', {x:W-200, y:H-150});
  pet.bedX = savedBed.x; pet.bedY = savedBed.y;
  dogBed.style.left = pet.bedX+'px'; dogBed.style.top = pet.bedY+'px';

  loadSettings(); loadPet(); loadSteps(); loadDiary();

  if (isMobile) { sleepToggle.style.display = 'flex'; guestBtn.style.display = 'flex'; }

  bindUI();

  document.addEventListener('touchstart', () => { if (!userInteracted) { userInteracted = true; initVideoPlayback(); } }, { passive: true });

  loadConfig();
  spawnBall();
  setInterval(() => { if (!pet.ball.active && Math.random() < 0.3) spawnBall(); }, 10000);

  requestAnimationFrame(gameLoop);
})();