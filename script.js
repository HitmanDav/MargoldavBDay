(function() {
  const UA = navigator.userAgent, isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(UA);
  const isLow = isMobile && (navigator.deviceMemory||4) < 4;
  let enableFX = !isLow, audioCtx, lastGesture = false;
  const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
  const dogVideo = document.getElementById('dogVideo'), bubble = document.getElementById('speechBubble');
  const sleepInd = document.getElementById('sleepIndicator'), dogBed = document.getElementById('dogBed');
  const menuPanel = document.getElementById('menuPanel'), menuBtn = document.getElementById('menuButton');
  const sleepToggle = document.getElementById('sleepToggleButton'), guestBtn = document.getElementById('guestButton');
  const sizeSlider = document.getElementById('sizeSlider'), volumeSlider = document.getElementById('volumeSlider');
  const showPrintsCheck = document.getElementById('showPrintsCheck'), darkThemeCheck = document.getElementById('darkThemeCheck');
  const collarSelect = document.getElementById('collarSelect'), bgSelect = document.getElementById('bgSelect');
  const rainBtn = document.getElementById('rainBtn'), snowBtn = document.getElementById('snowBtn'), clearWeatherBtn = document.getElementById('clearWeatherBtn');
  const textInput = document.getElementById('textInputMenu'), voiceBtn = document.getElementById('voiceBtnMenu');
  const diaryBtn = document.getElementById('diaryBtn'), photoBtn = document.getElementById('photoBtn'), weatherBtn = document.getElementById('weatherBtn');
  const stepCheck = document.getElementById('stepCounterCheck');
  const tttBoard = document.getElementById('ticTacToeBoard'), tttMsg = document.getElementById('tttMessage');
  const treatBowls = document.getElementById('treatBowls'), treatMsg = document.getElementById('treatMessage');
  const tugRope = document.getElementById('tugRope'), tugMarker = document.getElementById('tugMarker'), tugMsg = document.getElementById('tugMessage');
  const photoCanvas = document.getElementById('photoCanvas'), photoFrame = document.getElementById('photoFrame');
  const downloadLink = document.getElementById('downloadLink'), weatherInfo = document.getElementById('weatherInfo');
  const diaryEntries = document.getElementById('diaryEntries');

  let W, H, mouseX = 0, mouseY = 0, lastActivity = Date.now(), actionCount = 0;
  let weatherParticles = [], diary = [], totalSteps = 0, stepWatchId = null, stepHandler = null;
  let settings = { size:100, opacity:100, showPrints:true, volume:50, darkTheme:false, bg:'default', weather:'none' };
  let pet = {
    x:0,y:0,vx:0,vy:0,mood:'happy',sleep:false,dragged:false,dx:0,dy:0,facing:true,anim:'idle',
    targetX:null,targetY:null,moveStart:0,moveDur:0,startX:0,startY:0,moving:false,
    prints:[],lastPrintTime:0,bedX:0,bedY:0,bedDrag:false,bedOffX:0,bedOffY:0,
    ball:{x:0,y:0,active:false,r:20},emotion:'happy',bond:0.6,
    memory:{pet:0,play:0,ignore:Date.now()},xp:0,level:1,collar:'none'
  };
  let stateLock = false, lastDec = 0, needs = {energy:0.8,fun:0.7,social:0.6};
  const STATE = {IDLE:'IDLE',WANDER:'WANDER',FOLLOW:'FOLLOW',FETCH:'FETCH',SLEEP:'SLEEP'};
  let currState = STATE.IDLE;
  let CONFIG = { apiKeys:[], models:[], systemPrompt:'' }, keyIdx = 0;
  let videoReady = false, posterImg = new Image(); posterImg.src = 'animations/start.png';
  let animReadyHandler = null; // для очистки обработчика canplay

  const ANIM = {
    idle:{src:null,type:'poster'}, walk:{src:'animations/walk.webm',type:'video',rate:1},
    run:{src:'animations/run.webm',type:'video',rate:1}, sleep:{src:'animations/sleep.webm',type:'video',rate:1,loop:true},
    sitting:{src:'animations/sitting.webm',type:'video',rate:1,loop:true},
    look:{src:'animations/looking_back.webm',type:'video',rate:1,once:true},
    sneeze:{src:'animations/sneeze.webm',type:'video',rate:2,once:true}
  };
  const phrases = {
    angryWake:["КТО МЕНЯ ТРЯСЁТ?!","НЕ ТРОГАЙ СПЯЩЕГО ПСА!","Я ТЕБЕ СЕЙЧАС ПОКАЖУ ГРОМКИЙ ЗВУК!","ТЫ ЧТО, С УМА СОШЁЛ?!","ГАВ-ГАВ-ГАВ!!!","МАЙБАХ НЕ ДОВОЛЕН!!!"],
    softWake:["Ты чего? Я так сладко спал...","Зачем разбудили?","Ладно, давай играть.","Я ещё немного уставший...","Ну что там у тебя?"],
    owner:["Соня — самая лучшая хозяйка в мире! Гав!","Обожаю Соню, она меня чешет за ушком.","Соня приносит мне игрушки и вкусняшки.","Моя Соня всегда со мной играет, я её защищаю!","Если кто-то обидит Соню, я зарычу! Р-р-р!","Соня для меня как солнышко. Гав!"]
  };

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function showBubble(txt,d=4000){
    bubble.style.opacity='1'; bubble.textContent=txt;
    bubble.style.left=(pet.x-40)+'px'; bubble.style.top=(pet.y-110)+'px';
    clearTimeout(window.bt); window.bt=setTimeout(()=>bubble.style.opacity='0',d);
  }
  function speak(txt){
    if(!window.speechSynthesis)return;
    const u=new SpeechSynthesisUtterance(txt); u.lang='ru-RU'; u.rate=1.1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function updateMood(){
    const m={calm:'😌 Спокойный',happy:'😊 Счастливый',tired:'😴 Уставший',angry:'😠 Злой'};
    const t=m[pet.mood]||m.calm; document.getElementById('moodStateIcon').textContent=t.split(' ')[0];
    document.getElementById('moodStateText').textContent=t.split(' ').slice(1).join(' ');
  }
  function updateSleepDisp(){
    document.getElementById('sleepStateText').textContent=pet.sleep?'Да (😴)':'Нет (бодрствует)';
    if(isMobile) sleepToggle.textContent=pet.sleep?'😴':'🐕';
  }
  function incAction(){ actionCount++; document.getElementById('actionStateCount').textContent=actionCount; }
  function addXP(amt){
    pet.xp+=amt; const need=pet.level*100;
    if(pet.xp>=need){ pet.xp-=need; pet.level++; showBubble(`Уровень ${pet.level}! Гав!`,3000); }
    document.getElementById('levelDisplay').textContent=pet.level;
    document.getElementById('xpDisplay').textContent=pet.xp;
    savePet();
  }
  function updateBg(){
    const b=document.body;
    if(settings.bg==='park') b.style.background='linear-gradient(180deg, #87CEEB 0%, #98FB98 100%)';
    else if(settings.bg==='beach') b.style.background='linear-gradient(180deg, #FFDAB9 0%, #FFE4B5 100%)';
    else b.style.background='';
  }
  function updateWeatherFx(){
    weatherParticles=[];
    if(settings.weather==='rain') for(let i=0;i<80;i++) weatherParticles.push({x:Math.random()*W,y:Math.random()*H,s:4+Math.random()*8});
    else if(settings.weather==='snow') for(let i=0;i<60;i++) weatherParticles.push({x:Math.random()*W,y:Math.random()*H,s:1+Math.random()*3,r:2+Math.random()*4});
  }
  function getAudioCtx(){
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }
  function playSound(type){
    if(!enableFX||(isMobile&&!lastGesture))return;
    const vol=settings.volume/100;
    try{
      const ac=getAudioCtx(), osc=ac.createOscillator(), g=ac.createGain();
      g.gain.value=vol*0.3;
      if(type==='snore'){ osc.type='sawtooth'; osc.frequency.setValueAtTime(120,ac.currentTime); osc.frequency.exponentialRampToValueAtTime(80,ac.currentTime+0.5); g.gain.setValueAtTime(0.1*vol,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.8); osc.start(); osc.stop(ac.currentTime+0.8); }
      else if(type==='bark'){ osc.type='triangle'; osc.frequency.setValueAtTime(700,ac.currentTime); osc.frequency.exponentialRampToValueAtTime(400,ac.currentTime+0.15); osc.start(); osc.stop(ac.currentTime+0.2); }
      else if(type==='angry'){ osc.type='sawtooth'; osc.frequency.setValueAtTime(300,ac.currentTime); osc.frequency.exponentialRampToValueAtTime(150,ac.currentTime+0.3); osc.start(); osc.stop(ac.currentTime+0.4); }
      osc.connect(g); g.connect(ac.destination);
    }catch(e){}
  }
  function addDiary(text){ diary.unshift({time:new Date().toLocaleString(),text}); if(diary.length>50) diary.pop(); localStorage.setItem('spitz_diary',JSON.stringify(diary)); }
  function loadDiary(){ const d=localStorage.getItem('spitz_diary'); if(d) try{ diary=JSON.parse(d); }catch(e){} }
  function renderDiary(){
    diaryEntries.innerHTML=diary.length?diary.map(e=>`<div style="margin-bottom:8px;"><b>${e.time}</b> ${e.text}</div>`).join(''):'Пока записей нет.';
  }
  function takePhoto(){
    photoCanvas.width = canvas.width;
    photoCanvas.height = canvas.height;
    const pctx=photoCanvas.getContext('2d');
    pctx.drawImage(canvas,0,0);
    const data=photoCanvas.toDataURL('image/png');
    photoFrame.src=data; photoFrame.style.display='block';
    downloadLink.href=data; downloadLink.download='maybach.png'; downloadLink.style.display='inline-block';
  }
  function fetchWeather(){
    fetch('https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current_weather=true')
    .then(r=>r.json()).then(d=>{
      const w=d.current_weather;
      weatherInfo.innerHTML=`Температура: ${w.temperature}°C, Ветер: ${w.windspeed} км/ч`;
      if(w.weathercode<=3) showBubble('Хорошая погода! Гав!');
      else showBubble('На улице пасмурно...');
    }).catch(()=>weatherInfo.innerHTML='Ошибка загрузки');
  }
  function startStepCounter(){
    if(stepWatchId) return;
    if(window.DeviceMotionEvent){
      let lastStep=0;
      stepHandler = e => {
        const acc=e.accelerationIncludingGravity;
        const mag=Math.sqrt(acc.x*acc.x+acc.y*acc.y+acc.z*acc.z);
        if(mag>15&&Date.now()-lastStep>500){ totalSteps++; lastStep=Date.now(); saveSteps(); }
      };
      window.addEventListener('devicemotion', stepHandler);
      stepWatchId=1;
    }
  }
  function stopStepCounter(){
    if(stepHandler){
      window.removeEventListener('devicemotion', stepHandler);
      stepHandler = null;
    }
    stepWatchId=null;
  }
  function saveSteps(){ localStorage.setItem('spitz_steps',totalSteps); }
  function loadSteps(){ totalSteps=parseInt(localStorage.getItem('spitz_steps')||'0'); }

  function initVideoPlayback(){
    if(videoReady) return;
    dogVideo.muted = true;
    dogVideo.playsInline = true;
    dogVideo.play().then(() => {
      videoReady = true;
      dogVideo.pause();
    }).catch(() => {
      videoReady = false;
    });
  }

  function setAnim(name){
    if(pet.anim===name&&name!=='sneeze'&&name!=='look')return;
    const anim=ANIM[name]; if(!anim)return;
    pet.anim=name;
    if(anim.type==='poster'){
      dogVideo.pause();
      dogVideo.currentTime=0;
    }else if(videoReady){
      if(animReadyHandler) dogVideo.removeEventListener('canplay', animReadyHandler);
      dogVideo.src = anim.src;
      dogVideo.playbackRate = anim.rate||1;
      dogVideo.loop = anim.loop||false;
      if(dogVideo.readyState >= 2) {
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
  }
  function updateAnimByState(){
    if(pet.sleep){ setAnim('sleep'); return; }
    const spd=Math.hypot(pet.vx,pet.vy);
    if(pet.dragged||pet.moving) setAnim(spd>4?'run':'walk');
    else if(spd<0.3) setAnim('idle'); else if(spd<2.5) setAnim('walk'); else setAnim('run');
  }
  function drawDog(){
    const w=dogVideo.videoWidth||130, h=dogVideo.videoHeight||130;
    const scale=(H*0.35)/130*(settings.size/100);
    const dw=w*scale, dh=h*scale, x=pet.x-dw/2, y=pet.y-dh/2;
    if(pet.collar!=='none'){
      ctx.save(); ctx.strokeStyle=pet.collar; ctx.lineWidth=4;
      ctx.beginPath(); ctx.ellipse(pet.x,pet.y-dh*0.35,dw*0.25,8,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
    if(pet.anim==='idle'||!videoReady||dogVideo.readyState<2||dogVideo.ended){
      if(posterImg.complete) ctx.drawImage(posterImg, x, y, dw, dh);
      return;
    }
    ctx.save();
    if(!pet.facing){ ctx.translate(pet.x,pet.y); ctx.scale(-1,1); ctx.drawImage(dogVideo,-dw/2,-dh/2,dw,dh); }
    else ctx.drawImage(dogVideo,x,y,dw,dh);
    ctx.restore();
  }
  function drawWeather(){
    if(settings.weather==='rain'){
      ctx.fillStyle='rgba(200,200,255,0.5)';
      weatherParticles.forEach(p=>{ ctx.fillRect(p.x,p.y,2,10); p.y+=p.s; if(p.y>H){p.y=-10;p.x=Math.random()*W;} });
    }else if(settings.weather==='snow'){
      ctx.fillStyle='white';
      weatherParticles.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); p.y+=p.s; if(p.y>H){p.y=-10;p.x=Math.random()*W;} });
    }
  }
  function drawBall(){
    if(!pet.ball.active)return;
    ctx.beginPath(); ctx.arc(pet.ball.x,pet.ball.y,pet.ball.r,0,Math.PI*2);
    ctx.fillStyle='#FF4500'; ctx.fill(); ctx.strokeStyle='#B22222'; ctx.lineWidth=3; ctx.stroke();
    ctx.beginPath(); ctx.arc(pet.ball.x-6,pet.ball.y-6,5,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  }
  function spawnBall(){ pet.ball.x=100+Math.random()*(W-200); pet.ball.y=100+Math.random()*(H-200); pet.ball.active=true; }
  function addPrint(){
    if(!settings.showPrints||!enableFX)return;
    const now=Date.now();
    if(now-pet.lastPrintTime<300)return;
    pet.lastPrintTime=now;
    if(pet.y<H-100)return;
    pet.prints.push({x:pet.x,y:pet.y+20,time:now});
    if(pet.prints.length>40) pet.prints.shift();
  }
  function moveToSleep(){
    if(pet.sleep)return;
    const bx=pet.bedX+80, by=pet.bedY+50;
    pet.moving=true; pet.targetX=bx; pet.targetY=by-20; pet.moveStart=performance.now(); pet.moveDur=2000; pet.startX=pet.x; pet.startY=pet.y;
    pet.onMoveEnd=()=>{ pet.sleep=true; updateSleepDisp(); pet.vx=0; pet.vy=0; sleepInd.style.opacity='1'; setAnim('sleep'); showBubble('😴 Хррр...',2000); playSound('snore'); pet.facing=true; pet.x=bx; pet.y=by-20; pet.targetX=null; pet.targetY=null; };
    setAnim('run');
  }
  function softWake(reason){
    if(!pet.sleep)return;
    pet.sleep=false; updateSleepDisp(); sleepInd.style.opacity='0'; pet.mood='tired'; updateMood();
    showBubble(pick(phrases.softWake),3000); speak(pick(phrases.softWake));
    setAnim('idle'); stateLock=false;
  }
  function angryWake(){
    if(!pet.sleep)return;
    pet.sleep=false; updateSleepDisp(); sleepInd.style.opacity='0'; pet.mood='angry'; updateMood();
    showBubble(pick(phrases.angryWake),3000); speak(pick(phrases.angryWake));
    pet.vx=(Math.random()-0.5)*8; pet.vy=(Math.random()-0.5)*8; setAnim('run'); stateLock=false;
  }
  function goTo(tx,ty,dur,next){
    if(pet.dragged||pet.sleep){ stateLock=false; return; }
    pet.moving=true; pet.targetX=tx; pet.targetY=ty; pet.moveStart=performance.now(); pet.moveDur=dur; pet.startX=pet.x; pet.startY=pet.y;
    pet.onMoveEnd=()=>{ pet.moving=false; pet.targetX=null; pet.targetY=null; if(next) setState(next); else stateLock=false; };
  }
  function setState(st){
    currState=st;
    if(st===STATE.IDLE) setTimeout(()=>{stateLock=false;},1000+Math.random()*2000);
    else if(st===STATE.WANDER){
      const a=Math.random()*Math.PI*2, d=150+Math.random()*200;
      goTo(clamp(pet.x+Math.cos(a)*d,60,W-60),clamp(pet.y+Math.sin(a)*d,80,H-80),2000,STATE.IDLE);
    }else if(st===STATE.FOLLOW) goTo(mouseX,mouseY,2000,STATE.IDLE);
    else if(st===STATE.FETCH){
      if(!pet.ball.active){ stateLock=false; return; }
      goTo(pet.ball.x,pet.ball.y,1500,null);
      pet.onMoveEnd=()=>{
        if(!pet.ball.active){ stateLock=false; return; }
        pet.ball.active=false; goTo(mouseX,mouseY,2000,null);
        pet.onMoveEnd=()=>{ pet.ball.x=mouseX; pet.ball.y=mouseY; pet.ball.active=true; showBubble('Апорт!',1500); needs.fun+=0.2; pet.memory.play=Date.now(); stateLock=false; };
      };
    }else if(st===STATE.SLEEP){ moveToSleep(); setTimeout(()=>{needs.energy=1;stateLock=false;setState(STATE.IDLE);},8000); }
  }
  function decideState(){
    if(stateLock||Date.now()-lastDec<1500)return;
    lastDec=Date.now(); stateLock=true;
    const now=Date.now();
    if(pet.sleep) pet.emotion='sleepy';
    else if(now-pet.memory.pet<5000) pet.emotion='happy';
    else if(now-pet.memory.play<8000) pet.emotion='excited';
    else if(now-pet.memory.ignore>15000) pet.emotion='bored';
    if(needs.energy<0.2||pet.emotion==='sleepy') setState(STATE.SLEEP);
    else if(pet.emotion==='bored'&&Math.random()<0.6) setState(STATE.FOLLOW);
    else if(pet.emotion==='excited'&&pet.ball.active) setState(STATE.FETCH);
    else if(Math.random()<pet.bond) setState(STATE.FOLLOW);
    else setState(STATE.WANDER);
  }
  function gameLoop(t){
    if(!gameLoop.lastT) gameLoop.lastT=t;
    const dt=t-gameLoop.lastT; gameLoop.lastT=t;
    if(!document.querySelector('.game-modal.active')){
      needs.energy-=dt*0.00002; needs.fun-=dt*0.000015; needs.social-=dt*0.00001;
      needs.energy=clamp(needs.energy,0,1); needs.fun=clamp(needs.fun,0,1); needs.social=clamp(needs.social,0,1);
      decideState();
      if(!pet.dragged&&!pet.sleep&&pet.moving){
        const elapsed=performance.now()-pet.moveStart, t1=Math.min(1,elapsed/pet.moveDur);
        const eased=t1<0.5?2*t1*t1:1-Math.pow(-2*t1+2,2)/2;
        pet.x=pet.startX+(pet.targetX-pet.startX)*eased; pet.y=pet.startY+(pet.targetY-pet.startY)*eased;
        if(t1>=1){ pet.x=pet.targetX; pet.y=pet.targetY; pet.moving=false; pet.targetX=null; pet.targetY=null; if(pet.onMoveEnd){ pet.onMoveEnd(); pet.onMoveEnd=null; } }
      }
      updateAnimByState();
      if(pet.vx>0.1||(pet.moving&&pet.targetX&&pet.targetX>pet.x)) pet.facing=true;
      else if(pet.vx<-0.1||(pet.moving&&pet.targetX&&pet.targetX<pet.x)) pet.facing=false;
      if(settings.showPrints&&enableFX&&(Math.abs(pet.vx)>0.5||pet.moving)&&pet.y<H-100) addPrint();
    }
    pet.vx=(pet.targetX||pet.x)?(pet.targetX-pet.x)*0.05:0;
    pet.vy=(pet.targetY||pet.y)?(pet.targetY-pet.y)*0.05:0;
    ctx.clearRect(0,0,W,H);
    drawWeather(); drawBall(); drawDog();
    bubble.style.left=(pet.x-40)+'px'; bubble.style.top=(pet.y-110)+'px';
    requestAnimationFrame(gameLoop);
  }
  function resize(){
    const dpr=isLow?Math.min(window.devicePixelRatio,2):window.devicePixelRatio||1;
    W=window.innerWidth; H=window.innerHeight;
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr,dpr);
    pet.x = clamp(pet.x, 60, W-60);
    pet.y = clamp(pet.y, 80, H-80);
    updateWeatherFx();
  }
  function loadConfig(){
    fetch('config.json').then(r=>r.json()).then(d=>{
      if(d.apiKeys) CONFIG.apiKeys=d.apiKeys;
      if(d.models) CONFIG.models=d.models;
      if(d.systemPrompt) CONFIG.systemPrompt=d.systemPrompt;
    }).catch(()=>{});
  }
  function getApiKey(){ return CONFIG.apiKeys.length?CONFIG.apiKeys[keyIdx]:null; }
  function rotateKey(){ keyIdx=(keyIdx+1)%CONFIG.apiKeys.length; return CONFIG.apiKeys[keyIdx]; }
  async function askAI(msg){
    const key=getApiKey(); if(!key){ showBubble('Нет ключа API',3000); return; }
    const model=CONFIG.models[0]||'google/gemma-4-31b-it:free';
    let retries=0;
    const attempt=async()=>{
      if(retries++>5){ showBubble('ИИ устал',3000); return; }
      try{
        const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
          method:'POST',
          headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json','HTTP-Referer':location.origin},
          body:JSON.stringify({model,messages:[{role:'system',content:CONFIG.systemPrompt},{role:'user',content:msg}],max_tokens:120,temperature:0.9})
        });
        if(!res.ok){ if(res.status===429||res.status===401){ rotateKey(); return attempt(); } throw new Error(); }
        const data=await res.json();
        let reply=data.choices[0].message.content||'Гав?';
        reply=reply.replace(/р/g,()=>Math.random()<0.1?'р-р-р':'р');
        showBubble(reply,5000); speak(reply); incAction();
      }catch(e){ showBubble('Ошибка связи',3000); }
    };
    attempt();
  }
  function handleMsg(msg){
    if(pet.sleep){ showBubble('Я сплю...',1000); return; }
    pet.memory.ignore=Date.now(); pet.bond+=0.01;
    if(/соня|хозяйка|хозяин|хозяйку|хозяйке|соню|соне|соней/i.test(msg)){
      const p=pick(phrases.owner); showBubble(p,5000); speak(p); incAction(); return;
    }
    askAI(msg);
  }
  function savePet(){ localStorage.setItem('spitz_data',JSON.stringify({xp:pet.xp,level:pet.level,collar:pet.collar})); }
  function loadPet(){
    const d=localStorage.getItem('spitz_data');
    if(d){ try{ const p=JSON.parse(d); pet.xp=p.xp||0; pet.level=p.level||1; pet.collar=p.collar||'none'; }catch(e){} }
    document.getElementById('levelDisplay').textContent=pet.level;
    document.getElementById('xpDisplay').textContent=pet.xp;
    collarSelect.value=pet.collar;
  }
  function loadSettings(){
    const s=localStorage.getItem('spitz_settings');
    if(s){ try{ Object.assign(settings,JSON.parse(s)); }catch(e){} }
    if(isLow) settings.showPrints=false;
    sizeSlider.value=settings.size; volumeSlider.value=settings.volume;
    showPrintsCheck.checked=settings.showPrints; darkThemeCheck.checked=settings.darkTheme;
    bgSelect.value=settings.bg; document.body.classList.toggle('dark-theme',settings.darkTheme);
    updateBg(); updateWeatherFx();
  }
  function saveSettings(){ localStorage.setItem('spitz_settings',JSON.stringify(settings)); }

  function openModal(id){ document.getElementById(id).classList.add('active'); }
  function closeModal(id){ document.getElementById(id).classList.remove('active'); }

  let tttBoardData, tttActive, tttPlayer, tttOver;
  const winPatterns=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function renderTTT(){
    tttBoard.innerHTML='';
    tttBoardData.forEach((c,i)=>{
      const div=document.createElement('div'); div.className='ttt-cell'; if(c) div.classList.add(c);
      div.textContent=c; div.onclick=()=>tttClick(i); tttBoard.appendChild(div);
    });
  }
  function tttClick(i){
    if(!tttActive||tttOver||tttBoardData[i]||tttPlayer!=='X')return;
    tttBoardData[i]='X'; renderTTT(); checkTTT();
    if(!tttOver){ tttPlayer='O'; tttMsg.textContent='Майбах думает...'; setTimeout(maybachTTT,800+Math.random()*1200); }
  }
  function maybachTTT(){
    if(!tttActive||tttOver) return;
    for(const p of winPatterns){
      const[a,b,c]=p;
      if(tttBoardData[a]==='O'&&tttBoardData[b]==='O'&&!tttBoardData[c]){ makeTTTMove(c,'O'); return; }
      if(tttBoardData[a]==='O'&&tttBoardData[c]==='O'&&!tttBoardData[b]){ makeTTTMove(b,'O'); return; }
      if(tttBoardData[b]==='O'&&tttBoardData[c]==='O'&&!tttBoardData[a]){ makeTTTMove(a,'O'); return; }
    }
    for(const p of winPatterns){
      const[a,b,c]=p;
      if(tttBoardData[a]==='X'&&tttBoardData[b]==='X'&&!tttBoardData[c]){ makeTTTMove(c,'O'); return; }
      if(tttBoardData[a]==='X'&&tttBoardData[c]==='X'&&!tttBoardData[b]){ makeTTTMove(b,'O'); return; }
      if(tttBoardData[b]==='X'&&tttBoardData[c]==='X'&&!tttBoardData[a]){ makeTTTMove(a,'O'); return; }
    }
    if(!tttBoardData[4]){ makeTTTMove(4,'O'); return; }
    const empty=tttBoardData.map((v,i)=>v===''?i:null).filter(v=>v!==null);
    if(empty.length) makeTTTMove(empty[Math.floor(Math.random()*empty.length)],'O');
  }
  function makeTTTMove(i,pl){ tttBoardData[i]=pl; renderTTT(); checkTTT(); }
  function checkTTT(){
    for(const p of winPatterns){
      const[a,b,c]=p;
      if(tttBoardData[a]&&tttBoardData[a]===tttBoardData[b]&&tttBoardData[a]===tttBoardData[c]){
        tttOver=true; tttActive=false;
        if(tttBoardData[a]==='X'){ tttMsg.textContent='Ты выиграл!'; showBubble('Ты выиграл!',3000); playSound('angry'); }
        else{ tttMsg.textContent='Майбах выиграл!'; showBubble('Я выиграл!',3000); addXP(10); }
        incAction(); return;
      }
    }
    if(!tttBoardData.includes('')){ tttOver=true; tttActive=false; tttMsg.textContent='Ничья!'; showBubble('Ничья!',2000); addXP(5); }
  }
  window.startNewGame=function(){
    tttBoardData=['','','','','','','','','']; tttActive=true; tttOver=false; tttPlayer='X';
    renderTTT(); tttMsg.textContent='Твой ход (X)';
  };

  let treatCorrect, treatActive;
  window.startTreatGame=function(){
    treatActive=true; treatCorrect=Math.floor(Math.random()*3);
    treatBowls.innerHTML=''; treatMsg.textContent='Выбери миску!';
    for(let i=0;i<3;i++){
      const bowl=document.createElement('div');
      bowl.style.fontSize='60px'; bowl.style.cursor='pointer';
      bowl.textContent='🥣'; bowl.onclick=()=>{
        if(!treatActive)return;
        treatActive=false;
        if(i===treatCorrect){ treatMsg.textContent='Правильно! Гав!'; showBubble('Ура! Вкусняшка!',2000); addXP(8); playSound('bark'); }
        else{ treatMsg.textContent='Нет, здесь пусто...'; showBubble('Не угадал!',2000); }
      };
      treatBowls.appendChild(bowl);
    }
  };

  let tugPos=50, tugActive=false;
  function resetTug(){ tugPos=50; tugMarker.style.left='50%'; tugMsg.textContent='Тяни за маркер!'; }
  window.startTugGame=function(){
    if(tugActive)return;
    tugActive=true; resetTug();
    tugRope.onpointerdown=function(e){
      if(!tugActive)return;
      const rect=tugRope.getBoundingClientRect();
      const move=e=>{
        const x=e.clientX-rect.left; tugPos=clamp((x/rect.width)*100,5,95);
        tugMarker.style.left=tugPos+'%';
        if(tugPos<10){ endTug('win'); } else if(tugPos>90){ endTug('lose'); }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
  };
  function endTug(result){
    tugActive=false; tugRope.onpointerdown=null;
    if(result==='win'){ tugMsg.textContent='Ты выиграл! Майбах отпустил.'; showBubble('Ладно, твоя взяла!',2000); addXP(10); }
    else{ tugMsg.textContent='Майбах победил!'; showBubble('Я сильнее! Гав!',2000); playSound('angry'); }
    incAction();
  }

  function bindEvents(){
    document.getElementById('openTttBtn').onclick=()=>{ if(pet.sleep)showBubble('Я сплю...'); else { openModal('tictactoeModal'); window.startNewGame(); } };
    document.getElementById('newTttGameBtn').onclick=window.startNewGame;
    document.getElementById('closeTttBtn').onclick=()=>closeModal('tictactoeModal');
    document.getElementById('openTreatBtn').onclick=()=>{ if(pet.sleep)showBubble('Я сплю...'); else { openModal('treatModal'); window.startTreatGame(); } };
    document.getElementById('newTreatGameBtn').onclick=window.startTreatGame;
    document.getElementById('closeTreatBtn').onclick=()=>closeModal('treatModal');
    document.getElementById('openTugBtn').onclick=()=>{ if(pet.sleep)showBubble('Я сплю...'); else { openModal('tugModal'); window.startTugGame(); } };
    document.getElementById('resetTugBtn').onclick=()=>{ resetTug(); window.startTugGame(); };
    document.getElementById('closeTugBtn').onclick=()=>closeModal('tugModal');
    diaryBtn.onclick=()=>{ renderDiary(); openModal('diaryModal'); };
    document.getElementById('closeDiaryBtn').onclick=()=>closeModal('diaryModal');
    photoBtn.onclick=()=>openModal('photoModal');
    document.getElementById('takePhotoBtn').onclick=takePhoto;
    document.getElementById('closePhotoBtn').onclick=()=>closeModal('photoModal');
    weatherBtn.onclick=()=>{ fetchWeather(); openModal('weatherModal'); };
    document.getElementById('closeWeatherBtn').onclick=()=>closeModal('weatherModal');

    voiceBtn.onclick=()=>{
      if(pet.sleep){ showBubble('Я сплю...'); return; }
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){ showBubble('Нет поддержки'); return; }
      const rec=new SR(); rec.lang='ru-RU';
      rec.onstart=()=>showBubble('🎤 Говорите...');
      rec.onresult=e=>{ textInput.value=e.results[0][0].transcript; handleMsg(e.results[0][0].transcript); };
      rec.onerror=()=>showBubble('Не расслышал');
      rec.start();
    };
    textInput.addEventListener('keypress',e=>{ if(e.key==='Enter'){ handleMsg(textInput.value.trim()); textInput.value=''; } });

    sizeSlider.oninput=()=>{ settings.size=+sizeSlider.value; saveSettings(); document.getElementById('sizeValue').textContent=settings.size+'%'; };
    volumeSlider.oninput=()=>{ settings.volume=+volumeSlider.value; saveSettings(); document.getElementById('volumeValue').textContent=settings.volume+'%'; };
    showPrintsCheck.onchange=()=>{ settings.showPrints=showPrintsCheck.checked; saveSettings(); };
    darkThemeCheck.onchange=()=>{ settings.darkTheme=darkThemeCheck.checked; document.body.classList.toggle('dark-theme'); saveSettings(); };
    collarSelect.onchange=()=>{ pet.collar=collarSelect.value; savePet(); };
    bgSelect.onchange=()=>{ settings.bg=bgSelect.value; updateBg(); saveSettings(); };
    rainBtn.onclick=()=>{ settings.weather='rain'; updateWeatherFx(); saveSettings(); };
    snowBtn.onclick=()=>{ settings.weather='snow'; updateWeatherFx(); saveSettings(); };
    clearWeatherBtn.onclick=()=>{ settings.weather='none'; updateWeatherFx(); saveSettings(); };
    stepCheck.onchange=function(){ if(this.checked) startStepCounter(); else stopStepCounter(); saveSettings(); };

    menuBtn.onclick=()=>menuPanel.classList.add('open');
    document.getElementById('menuCloseBtn').onclick=()=>menuPanel.classList.remove('open');
    sleepToggle.onclick=()=>{ if(pet.sleep) softWake(); else { stateLock=true; setState(STATE.SLEEP); } };
    guestBtn.onclick=()=>{ showBubble('Гостевой режим! Привет!'); pet.bond=0.5; };
  }

  function addGlobalPointerEvents(){
    const initOnInteract = () => {
      if(!lastGesture){
        lastGesture = true;
        initVideoPlayback();
      }
    };
    document.addEventListener('pointerdown', initOnInteract, {once: false});
    canvas.addEventListener('pointerdown', e => {
      initOnInteract();
      const mx=e.clientX, my=e.clientY;
      if(pet.dragged||pet.sleep) return;
      if(Math.hypot(mx-pet.x,my-pet.y)<60){ pet.dragged=true; pet.dx=pet.x-mx; pet.dy=pet.y-my; pet.memory.pet=Date.now(); }
    });
    canvas.addEventListener('pointermove',e=>{
      if(!pet.dragged) return;
      pet.x=clamp(e.clientX+pet.dx,60,W-60); pet.y=clamp(e.clientY+pet.dy,80,H-80);
    });
    window.addEventListener('pointerup',()=>{ if(pet.dragged){ pet.dragged=false; pet.memory.pet=Date.now(); } });

    dogBed.addEventListener('pointerdown',e=>{
      e.stopPropagation(); pet.bedDrag=true;
      const r=dogBed.getBoundingClientRect(); pet.bedOffX=e.clientX-r.left; pet.bedOffY=e.clientY-r.top;
    });
    window.addEventListener('pointermove',e=>{
      if(!pet.bedDrag)return;
      pet.bedX=clamp(e.clientX-pet.bedOffX,0,W-160); pet.bedY=clamp(e.clientY-pet.bedOffY,0,H-100);
      dogBed.style.left=pet.bedX+'px'; dogBed.style.top=pet.bedY+'px';
    });
    window.addEventListener('pointerup',()=>{ pet.bedDrag=false; localStorage.setItem('spitz_bed',JSON.stringify({x:pet.bedX,y:pet.bedY})); });
  }

  resize();
  pet.x=W/2; pet.y=H/2;
  const bedSaved=JSON.parse(localStorage.getItem('spitz_bed')||'{}');
  pet.bedX=bedSaved.x||(W-200); pet.bedY=bedSaved.y||(H-150);
  dogBed.style.left=pet.bedX+'px'; dogBed.style.top=pet.bedY+'px';
  loadSettings(); loadPet(); loadSteps(); loadDiary();
  if(isMobile){ sleepToggle.style.display='flex'; guestBtn.style.display='flex'; }
  bindEvents();
  addGlobalPointerEvents();
  document.addEventListener('touchstart', ()=>{ lastGesture=true; initVideoPlayback(); }, {passive:true});
  window.addEventListener('resize', resize);
  loadConfig();
  spawnBall(); setInterval(()=>{ if(!pet.ball.active&&Math.random()<0.3) spawnBall(); },10000);
  gameLoop.lastT=performance.now();
  requestAnimationFrame(gameLoop);
})();