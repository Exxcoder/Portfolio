// ==========================================================================
// Владлен — Портфолио & Резюме
// Полный интерактивный движок: 3D-космос (950+ звёзд), звуки, рисование, квест
// ==========================================================================

// 1. Управление аудиосистемой (WAV-файлы + Web Audio API Fallback)
let audioEnabled = false;
let audioCtx = null;

// Предзагрузка внешних аудиофайлов из папки sounds/
const soundFiles = {
  click: new Audio('sounds/click.wav'),
  beep: new Audio('sounds/beep.wav'),
  success: new Audio('sounds/success.wav'),
  node: new Audio('sounds/node.wav'),
  supernova: new Audio('sounds/supernova.wav')
};

// Настройка громкости
Object.values(soundFiles).forEach(audio => {
  audio.volume = 0.25;
});

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('audioToggleBtn');
  if (audioEnabled) {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (btn) btn.classList.add('active');
    playSound('beep', 880, 0.08, 'sine');
    showToast('Космические звуковые эффекты включены');
  } else {
    if (btn) btn.classList.remove('active');
    showToast('Звуковые эффекты выключены');
  }
}

// Универсальное воспроизведение: пробуем WAV, если недоступен — синтезируем звук
function playSound(soundName, freq = 440, duration = 0.08, type = 'sine') {
  if (!audioEnabled) return;

  // 1. Попытка воспроизвести аудиофайл
  const audio = soundFiles[soundName];
  if (audio) {
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Если файл заблокирован политикой браузера, используем Web Audio API
          synthBeep(freq, duration, type);
        });
        return;
      }
    } catch (e) {
      synthBeep(freq, duration, type);
      return;
    }
  }

  // 2. Fallback на синтезатор Web Audio
  synthBeep(freq, duration, type);
}

function synthBeep(freq = 440, duration = 0.08, type = 'sine') {
  if (!audioEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (err) {
    console.warn('Audio synth error:', err);
  }
}

// ==========================================================================
// 2. 3D-космос со сверхплотным звёздным полем (950+ звёзд и метеоры)
// ==========================================================================
const cosmosCanvas = document.getElementById('cosmosCanvas');
const cosmosCtx = cosmosCanvas ? cosmosCanvas.getContext('2d') : null;
let cWidth = 0;
let cHeight = 0;

function resizeCosmos() {
  if (!cosmosCanvas) return;
  cWidth = cosmosCanvas.width = window.innerWidth;
  cHeight = cosmosCanvas.height = window.innerHeight;
}
resizeCosmos();
window.addEventListener('resize', resizeCosmos);

const STAR_COUNT = 950; // Увеличенное число частиц звёзд
const FOV = 420;
const stars = [];
const meteors = [];

let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let mouseCurX = window.innerWidth / 2;
let mouseCurY = window.innerHeight / 2;
let isGravityActive = false;

class Star {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = (Math.random() - 0.5) * cWidth * 3.0;
    this.y = (Math.random() - 0.5) * cHeight * 3.0;
    this.z = initial ? Math.random() * 1100 + 1 : 1100;
    
    // Три слоя звёзд: мелкая звёздная пыль, средние звёзды и яркие ближние светила
    const rand = Math.random();
    if (rand < 0.65) {
      this.size = Math.random() * 0.8 + 0.4;
      this.baseAlpha = Math.random() * 0.5 + 0.2;
    } else if (rand < 0.92) {
      this.size = Math.random() * 1.4 + 0.8;
      this.baseAlpha = Math.random() * 0.6 + 0.4;
    } else {
      this.size = Math.random() * 2.2 + 1.4;
      this.baseAlpha = Math.random() * 0.4 + 0.6;
    }

    this.twinkleSpeed = Math.random() * 0.04 + 0.01;
    this.twinkleOffset = Math.random() * Math.PI * 2;
    
    const tints = [
      '255, 255, 255',
      '240, 245, 255',
      '210, 230, 255',
      '220, 195, 255'
    ];
    this.color = tints[Math.floor(Math.random() * tints.length)];
  }

  update(speed, parallaxX, parallaxY) {
    if (isGravityActive) {
      const k = FOV / this.z;
      const px = (this.x - parallaxX) * k + cWidth / 2;
      const py = (this.y - parallaxY) * k + cHeight / 2;
      
      const dx = mouseCurX - px;
      const dy = mouseCurY - py;
      const dist = Math.hypot(dx, dy);

      if (dist > 15 && dist < 550) {
        const angle = Math.atan2(dy, dx);
        const force = 190 / Math.max(25, dist);
        this.x += (Math.cos(angle + 1.25) * force * 1.6 + Math.cos(angle) * force) * (this.z / FOV);
        this.y += (Math.sin(angle + 1.25) * force * 1.6 + Math.sin(angle) * force) * (this.z / FOV);
      }
      this.z -= speed * 0.35;
    } else {
      this.z -= speed;
    }

    if (this.z <= 0) {
      this.reset(false);
    }
  }

  draw(c, parallaxX, parallaxY, time) {
    const k = FOV / this.z;
    const px = (this.x - parallaxX) * k + cWidth / 2;
    const py = (this.y - parallaxY) * k + cHeight / 2;

    if (px < -60 || px > cWidth + 60 || py < -60 || py > cHeight + 60) return;

    const projectedSize = Math.max(0.35, this.size * k);
    const depthAlpha = Math.min(1, Math.max(0, (1 - this.z / 1100) * 1.35));
    const twinkle = Math.sin(time * this.twinkleSpeed + this.twinkleOffset) * 0.25 + 0.75;
    const alpha = Math.min(1, this.baseAlpha * depthAlpha * twinkle);

    c.beginPath();
    c.arc(px, py, projectedSize, 0, Math.PI * 2);
    c.fillStyle = `rgba(${this.color}, ${alpha})`;
    c.fill();

    // Ореол для крупных близких звёзд
    if (projectedSize > 1.3 && alpha > 0.45) {
      c.beginPath();
      c.arc(px, py, projectedSize * 2.4, 0, Math.PI * 2);
      c.fillStyle = `rgba(${this.color}, ${alpha * 0.16})`;
      c.fill();
    }
  }
}

// Класс метеоров (падающих звёзд)
class Meteor {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * cWidth;
    this.y = Math.random() * (cHeight * 0.4);
    this.len = Math.random() * 80 + 50;
    this.speed = Math.random() * 12 + 16;
    this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.2;
    this.alpha = 1.0;
    this.decay = Math.random() * 0.02 + 0.015;
    this.active = false;
  }
  spawn() {
    this.reset();
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.alpha -= this.decay;
    if (this.alpha <= 0) {
      this.active = false;
    }
  }
  draw(c) {
    if (!this.active || this.alpha <= 0) return;
    const tailX = this.x - Math.cos(this.angle) * this.len;
    const tailY = this.y - Math.sin(this.angle) * this.len;
    const grad = c.createLinearGradient(tailX, tailY, this.x, this.y);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, `rgba(200, 220, 255, ${this.alpha * 0.9})`);
    
    c.beginPath();
    c.moveTo(tailX, tailY);
    c.lineTo(this.x, this.y);
    c.strokeStyle = grad;
    c.lineWidth = 1.6;
    c.stroke();
  }
}

for (let i = 0; i < STAR_COUNT; i++) {
  stars.push(new Star());
}

for (let i = 0; i < 3; i++) {
  meteors.push(new Meteor());
}

// Запуск случайных метеоров каждые 4-7 секунд
setInterval(() => {
  const m = meteors.find(item => !item.active);
  if (m) m.spawn();
}, 4500);

window.addEventListener('mousemove', (e) => {
  mouseCurX = e.clientX;
  mouseCurY = e.clientY;
  const nx = (e.clientX - cWidth / 2) / (cWidth / 2);
  const ny = (e.clientY - cHeight / 2) / (cHeight / 2);
  targetMouseX = nx * 240;
  targetMouseY = ny * 190;
});

// Мобильное сенсорное управление параллаксом
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    const t = e.touches[0];
    mouseCurX = t.clientX;
    mouseCurY = t.clientY;
    const nx = (t.clientX - cWidth / 2) / (cWidth / 2);
    const ny = (t.clientY - cHeight / 2) / (cHeight / 2);
    targetMouseX = nx * 180;
    targetMouseY = ny * 140;
  }
}, { passive: true });

function renderCosmos(timestamp) {
  if (!cosmosCtx) return;
  mouseX += (targetMouseX - mouseX) * 0.055;
  mouseY += (targetMouseY - mouseY) * 0.055;

  cosmosCtx.clearRect(0, 0, cWidth, cHeight);
  const timeSec = timestamp * 0.001;
  const speed = 0.55;

  for (let i = 0; i < stars.length; i++) {
    stars[i].update(speed, mouseX, mouseY);
    stars[i].draw(cosmosCtx, mouseX, mouseY, timeSec);
  }

  for (let i = 0; i < meteors.length; i++) {
    meteors[i].update();
    meteors[i].draw(cosmosCtx);
  }

  requestAnimationFrame(renderCosmos);
}

requestAnimationFrame(renderCosmos);

// ==========================================================================
// 3. Кастомный курсор (Белая точка + плавное кольцо)
// ==========================================================================
const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');
let ringCurX = mouseCurX;
let ringCurY = mouseCurY;

window.addEventListener('mousemove', (e) => {
  if (cursorDot) {
    cursorDot.style.left = e.clientX + 'px';
    cursorDot.style.top = e.clientY + 'px';
  }
});

function renderCursorRing() {
  ringCurX += (mouseCurX - ringCurX) * 0.18;
  ringCurY += (mouseCurY - ringCurY) * 0.18;
  if (cursorRing) {
    cursorRing.style.left = ringCurX + 'px';
    cursorRing.style.top = ringCurY + 'px';
  }
  requestAnimationFrame(renderCursorRing);
}
renderCursorRing();

const hoverTargets = 'a, button, input, textarea, select, .btn, .chip-btn, .filter-tab, .skill-row, .cert-item, .contact-row, .status-pill, .modal-close-btn, .project-card, .metric-card';

function attachCursorHover() {
  document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (cursorRing) cursorRing.classList.add('cursor-hover');
      if (cursorDot) cursorDot.classList.add('cursor-hover');
    });
    el.addEventListener('mouseleave', () => {
      if (cursorRing) cursorRing.classList.remove('cursor-hover');
      if (cursorDot) cursorDot.classList.remove('cursor-hover');
    });
  });
}
attachCursorHover();

// Гравитационная сингулярность при зажатии мыши
window.addEventListener('mousedown', (e) => {
  const tag = e.target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.closest('#constellationCanvas')) return;
  
  isGravityActive = true;
  if (cursorRing) cursorRing.classList.add('cursor-gravity');
  if (cursorDot) cursorDot.classList.add('cursor-gravity');
  playSound('beep', 260, 0.15, 'sawtooth');
});

window.addEventListener('mouseup', () => {
  if (isGravityActive) {
    isGravityActive = false;
    if (cursorRing) cursorRing.classList.remove('cursor-gravity');
    if (cursorDot) cursorDot.classList.remove('cursor-gravity');
    playSound('supernova', 520, 0.35, 'sine');
  }
  if (cursorRing) cursorRing.classList.remove('cursor-active');
});

// Искры звёздной пыльцы при клике
window.addEventListener('click', (e) => {
  if (e.target.closest('input') || e.target.closest('textarea')) return;
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'stardust-particle';
    const size = Math.random() * 4 + 2;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    document.body.appendChild(p);

    const angle = (Math.PI * 2 / 6) * i + (Math.random() - 0.5) * 0.5;
    const distance = Math.random() * 45 + 25;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    requestAnimationFrame(() => {
      p.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
      p.style.opacity = '0';
    });

    setTimeout(() => p.remove(), 650);
  }
});

// ==========================================================================
// 4. Интерактивный холст: свободное рисование белым светом (затухание 3 сек)
// ==========================================================================
const cPadCanvas = document.getElementById('constellationCanvas');
const cPadCtx = cPadCanvas ? cPadCanvas.getContext('2d') : null;
let cPadWidth = 0;
let cPadHeight = 0;

function resizeCPad() {
  if (!cPadCanvas) return;
  cPadWidth = cPadCanvas.width = cPadCanvas.clientWidth;
  cPadHeight = cPadCanvas.height = cPadCanvas.clientHeight;
}
window.addEventListener('resize', resizeCPad);
setTimeout(resizeCPad, 100);

const nodeLabels = [
  'Firewall', 'SIEM Core', 'Active Directory', 'CCTV RTSP', 
  'VPN Gateway', 'IDS/IPS', 'Proxy Guard', 'Patch Panel DME'
];

const pentatonicNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

let cNodes = [];
let connectedNodes = [];
let isDrawingOnPad = false;
let drawnStrokes = [];
let currentStroke = null;
const STROKE_LIFETIME = 3000; // 3 секунды

function initConstellationNodes() {
  if (!cPadCanvas) return;
  cNodes = [];
  connectedNodes = [];
  const w = cPadWidth || 800;
  const h = cPadHeight || 380;

  for (let i = 0; i < nodeLabels.length; i++) {
    cNodes.push({
      id: i,
      label: nodeLabels[i],
      x: Math.random() * (w - 140) + 70,
      y: Math.random() * (h - 120) + 60,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: 8,
      freq: pentatonicNotes[i % pentatonicNotes.length],
      color: i % 2 === 0 ? '#38bdf8' : '#a78bfa'
    });
  }
  updateCScore();
}

function updateCScore() {
  const scoreElem = document.getElementById('constellationScore');
  if (scoreElem) {
    scoreElem.innerText = `${connectedNodes.length} / ${nodeLabels.length}`;
    if (connectedNodes.length === nodeLabels.length) {
      scoreElem.innerText = `${connectedNodes.length} / ${nodeLabels.length} [ЩИТ АКТИВЕН ✦]`;
      scoreElem.style.color = '#86efac';
    } else {
      scoreElem.style.color = '#38bdf8';
    }
  }
}

function resetConstellationPad() {
  connectedNodes = [];
  drawnStrokes = [];
  currentStroke = null;
  initConstellationNodes();
  playSound('beep', 320, 0.1, 'sine');
  showToast('Холст очищен');
}

let cPadMouse = { x: -1000, y: -1000 };

if (cPadCanvas) {
  // Мышь
  cPadCanvas.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isDrawingOnPad = true;
    const rect = cPadCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    currentStroke = [{ x: mx, y: my, time: Date.now() }];
    drawnStrokes.push(currentStroke);
    checkNodeInteraction(mx, my);
  });

  window.addEventListener('mouseup', () => {
    isDrawingOnPad = false;
    currentStroke = null;
  });

  cPadCanvas.addEventListener('mousemove', (e) => {
    const rect = cPadCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    cPadMouse.x = mx;
    cPadMouse.y = my;

    if (isDrawingOnPad && currentStroke) {
      currentStroke.push({ x: mx, y: my, time: Date.now() });
      checkNodeInteraction(mx, my);
    }
  });

  cPadCanvas.addEventListener('mouseleave', () => {
    cPadMouse.x = -1000;
    cPadMouse.y = -1000;
  });

  // Сенсорное рисование на смартфонах/планшетах
  cPadCanvas.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = cPadCanvas.getBoundingClientRect();
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    isDrawingOnPad = true;
    currentStroke = [{ x: mx, y: my, time: Date.now() }];
    drawnStrokes.push(currentStroke);
    checkNodeInteraction(mx, my);
  }, { passive: true });

  cPadCanvas.addEventListener('touchmove', (e) => {
    if (!isDrawingOnPad || !currentStroke) return;
    const touch = e.touches[0];
    const rect = cPadCanvas.getBoundingClientRect();
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    cPadMouse.x = mx;
    cPadMouse.y = my;
    currentStroke.push({ x: mx, y: my, time: Date.now() });
    checkNodeInteraction(mx, my);
  }, { passive: true });

  cPadCanvas.addEventListener('touchend', () => {
    isDrawingOnPad = false;
    currentStroke = null;
  });
}

function checkNodeInteraction(mx, my) {
  for (let node of cNodes) {
    const dist = Math.hypot(node.x - mx, node.y - my);
    if (dist < 28) {
      if (!connectedNodes.includes(node.id)) {
        connectedNodes.push(node.id);
        playSound('node', node.freq, 0.35, 'sine');
        showToast(`Узел [${node.label}] активирован!`);
        updateCScore();

        if (connectedNodes.length === cNodes.length) {
          setTimeout(() => {
            playSound('success', 523.25, 0.5, 'sine');
            showToast('✦ Защитная паутина полностью сформирована!');
          }, 200);
        }
      }
      break;
    }
  }
}

function renderConstellationPad() {
  if (!cPadCtx || !cPadCanvas) return;
  cPadCtx.clearRect(0, 0, cPadWidth, cPadHeight);
  const now = Date.now();

  // 1. Отрисовка светящихся белых линий с плавным затуханием
  cPadCtx.save();
  cPadCtx.lineCap = 'round';
  cPadCtx.lineJoin = 'round';

  for (let s = drawnStrokes.length - 1; s >= 0; s--) {
    const stroke = drawnStrokes[s];
    while (stroke.length > 0 && (now - stroke[0].time) > STROKE_LIFETIME) {
      stroke.shift();
    }
    if (stroke.length === 0) {
      drawnStrokes.splice(s, 1);
      continue;
    }

    for (let i = 0; i < stroke.length - 1; i++) {
      const p1 = stroke[i];
      const p2 = stroke[i + 1];
      const age = now - p2.time;
      const progress = age / STROKE_LIFETIME;
      const alpha = Math.max(0, 1 - progress);

      if (alpha <= 0) continue;

      cPadCtx.beginPath();
      cPadCtx.moveTo(p1.x, p1.y);
      cPadCtx.lineTo(p2.x, p2.y);

      // Основная белая светящаяся линия
      cPadCtx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      cPadCtx.shadowColor = `rgba(255, 255, 255, ${alpha * 0.85})`;
      cPadCtx.shadowBlur = 12 * alpha;
      cPadCtx.lineWidth = 2.8 * alpha + 1;
      cPadCtx.stroke();

      // Мягкий космический ореол
      cPadCtx.strokeStyle = `rgba(216, 180, 254, ${alpha * 0.35})`;
      cPadCtx.shadowColor = `rgba(167, 139, 250, ${alpha * 0.6})`;
      cPadCtx.shadowBlur = 22 * alpha;
      cPadCtx.lineWidth = 5 * alpha + 1.2;
      cPadCtx.stroke();
    }
  }
  cPadCtx.restore();

  // 2. Фоновые тонкие линии связей между узлами
  for (let i = 0; i < cNodes.length; i++) {
    for (let j = i + 1; j < cNodes.length; j++) {
      const d = Math.hypot(cNodes[i].x - cNodes[j].x, cNodes[i].y - cNodes[j].y);
      if (d < 160) {
        cPadCtx.beginPath();
        cPadCtx.moveTo(cNodes[i].x, cNodes[i].y);
        cPadCtx.lineTo(cNodes[j].x, cNodes[j].y);
        cPadCtx.strokeStyle = `rgba(255, 255, 255, ${(1 - d / 160) * 0.08})`;
        cPadCtx.lineWidth = 1;
        cPadCtx.stroke();
      }
    }
  }

  // 3. Соединенные активные узлы
  if (connectedNodes.length > 1) {
    cPadCtx.beginPath();
    const first = cNodes[connectedNodes[0]];
    cPadCtx.moveTo(first.x, first.y);
    for (let k = 1; k < connectedNodes.length; k++) {
      const n = cNodes[connectedNodes[k]];
      cPadCtx.lineTo(n.x, n.y);
    }
    cPadCtx.strokeStyle = '#38bdf8';
    cPadCtx.lineWidth = 2.2;
    cPadCtx.shadowColor = '#38bdf8';
    cPadCtx.shadowBlur = 14;
    cPadCtx.stroke();
    cPadCtx.shadowBlur = 0;
  }

  // 4. Линия притяжения от курсора к близким узлам
  for (let node of cNodes) {
    const mouseDist = Math.hypot(node.x - cPadMouse.x, node.y - cPadMouse.y);
    if (mouseDist < 140) {
      cPadCtx.beginPath();
      cPadCtx.moveTo(node.x, node.y);
      cPadCtx.lineTo(cPadMouse.x, cPadMouse.y);
      cPadCtx.strokeStyle = `rgba(167, 139, 250, ${(1 - mouseDist / 140) * 0.35})`;
      cPadCtx.lineWidth = 1.2;
      cPadCtx.stroke();
    }
  }

  // 5. Движение и отрисовка узлов
  for (let node of cNodes) {
    node.x += node.vx;
    node.y += node.vy;

    if (node.x < 30 || node.x > cPadWidth - 30) node.vx *= -1;
    if (node.y < 30 || node.y > cPadHeight - 30) node.vy *= -1;

    const isConnected = connectedNodes.includes(node.id);
    const isHovered = Math.hypot(node.x - cPadMouse.x, node.y - cPadMouse.y) < 26;

    cPadCtx.beginPath();
    cPadCtx.arc(node.x, node.y, isHovered ? 14 : (isConnected ? 11 : 8), 0, Math.PI * 2);
    cPadCtx.fillStyle = isConnected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)';
    cPadCtx.fill();

    cPadCtx.beginPath();
    cPadCtx.arc(node.x, node.y, isConnected ? 6 : 4.5, 0, Math.PI * 2);
    cPadCtx.fillStyle = isConnected ? '#38bdf8' : (isHovered ? '#ffffff' : node.color);
    cPadCtx.fill();

    cPadCtx.font = '11px monospace';
    cPadCtx.fillStyle = isConnected ? '#ffffff' : 'rgba(226, 232, 240, 0.65)';
    cPadCtx.fillText(node.label, node.x + 12, node.y + 4);
  }

  requestAnimationFrame(renderConstellationPad);
}

setTimeout(() => {
  initConstellationNodes();
  renderConstellationPad();
}, 200);

// ==========================================================================
// 5. Мобильное меню и навигация
// ==========================================================================
const mobileBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

if (mobileBtn && navLinks) {
  mobileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navLinks.classList.toggle('open');
    playSound('click', 600, 0.05, 'sine');
  });

  // Закрывать меню при клике на любой пункт
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      playSound('click', 750, 0.05, 'sine');
    });
  });

  // Закрывать меню при клике вне его
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !mobileBtn.contains(e.target)) {
      navLinks.classList.remove('open');
    }
  });
}

// Индикатор прокрутки страницы
window.addEventListener('scroll', () => {
  const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
  const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const scrolled = (winScroll / height) * 100;
  const bar = document.getElementById('scrollProgressBar');
  if (bar) bar.style.width = scrolled + '%';
});

// Плавное появление элементов
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
    }
  });
}, {
  threshold: 0.08,
  rootMargin: '0px 0px -30px 0px'
});

document.querySelectorAll('.reveal-item').forEach(el => {
  revealObserver.observe(el);
});

// ==========================================================================
// 6. Мини-игра «Аудит периметра & Оффер-токен»
// ==========================================================================
let currentStage = 1;
let gameScore = 0;

function selectGameOption(stage, type, btn) {
  if (type === 'correct') {
    btn.classList.add('selected-correct');
    playSound('node', 880, 0.15, 'sine');
    showToast('Рубеж пройден! Защита усилена.');
    
    const currentBadge = document.getElementById(`stepBadge${stage}`);
    if (currentBadge) {
      currentBadge.classList.remove('active');
      currentBadge.classList.add('completed');
    }

    gameScore += 33.3;
    const scoreElem = document.getElementById('gameShieldPercent');
    if (scoreElem) scoreElem.innerText = Math.round(gameScore) + '%';

    setTimeout(() => {
      const curStageEl = document.getElementById(`gameStage${stage}`);
      if (curStageEl) curStageEl.classList.remove('active');
      
      if (stage < 3) {
        currentStage = stage + 1;
        const nextStageEl = document.getElementById(`gameStage${currentStage}`);
        if (nextStageEl) nextStageEl.classList.add('active');
        const nextBadge = document.getElementById(`stepBadge${currentStage}`);
        if (nextBadge) nextBadge.classList.add('active');
      } else {
        if (scoreElem) scoreElem.innerText = '100% [ОФФЕР РАЗБЛОКИРОВАН]';
        const vicEl = document.getElementById('gameStageVictory');
        if (vicEl) vicEl.classList.add('active');
        playSound('success', 1046, 0.45, 'sine');
        showToast('Поздравляем! Оффер-пакет разблокирован.');
      }
    }, 600);

  } else {
    btn.classList.add('selected-wrong');
    playSound('beep', 200, 0.15, 'sawtooth');
    showToast('Уязвимость не устранена! Попробуйте другой вариант.');
    setTimeout(() => btn.classList.remove('selected-wrong'), 600);
  }
}

// ==========================================================================
// 7. Интерактивный CLI Терминал
// ==========================================================================
const terminalBox = document.getElementById('terminalBox');
const terminalToggleBtn = document.getElementById('terminalToggleBtn');
const terminalInput = document.getElementById('terminalInput');
const terminalHistory = document.getElementById('terminalHistory');

if (terminalToggleBtn) {
  terminalToggleBtn.addEventListener('click', () => {
    if (terminalBox) {
      terminalBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (terminalInput) terminalInput.focus();
    }
    playSound('click', 520, 0.08, 'sine');
  });
}

if (terminalInput) {
  terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = terminalInput.value.trim();
      if (cmd) {
        executeTerminalCommand(cmd);
        terminalInput.value = '';
      }
    }
  });
}

function runCommand(cmd) {
  executeTerminalCommand(cmd);
}

function executeTerminalCommand(cmd) {
  playSound('beep', 480, 0.04, 'square');
  const cleanCmd = cmd.toLowerCase().trim();
  let output = '';

  if (cleanCmd === 'help') {
    output = `Список доступных команд:
  whoami      — профиль кандидата и целевые направления (DevOps, SysAdmin, Infra, Sec)
  devops      — компетенции в автоматизации, виртуализации и администрировании
  docker      — контейнеризация и микросервисы
  skills      — технические навыки и стек технологий
  exp         — хронология опыта работы (Faberlic -> СТРОЙЭНЕРГОСЕРВИС -> DME)
  github      — ссылка на профиль GitHub (https://github.com/Exxcoder)
  projects    — список реализованных проектов и кейсов
  contact     — контактные данные для связи
  clear       — очистить терминал
  print       — открыть версию для печати и PDF`;
  } else if (cleanCmd === 'devops' || cleanCmd === 'infra') {
    output = `DEVOPS И ИНФРАСТРУКТУРА:
• ОС: Linux (Ubuntu, Debian, Kali) — установка, конфигурация, системные службы systemd, харденинг
• Серверы: Windows Server (Active Directory, GPO, DNS, DHCP), разграничение доступа
• Оборудование: компонентное обслуживание стоек в 3-х дата-центрах Faberlic (HDD RAID, ECC RAM, БП)
• Сети: TCP/IP, VLAN, статическая и динамическая маршрутизация, Cisco Packet Tracer, VPN
• Автоматизация и скрипты: базовые знания C#, Bash-скрипты, системные утилиты, 1C API
• Безопасность периметра (DevSecOps): KES, Secret Net Studio, Континент АП, аудит уязвимостей`;
  } else if (cleanCmd === 'docker') {
    output = `DOCKER И КОНТЕЙНЕРИЗАЦИЯ:
• Концепции контейнеризации, работа с Docker CLI и Dockerfile
• Сетевые режимы (bridge, host), volume persistent storage
• Понимание контейнерных архитектур и принципов CI/CD`;
  } else if (cleanCmd === 'whoami') {
    output = `ПОЛЬЗОВАТЕЛЬ: Владлен (19 лет)
РОЛЬ: Junior DevOps Engineer / системный администратор / специалист по инфраструктуре
СПЕЦИАЛИЗАЦИЯ: системное администрирование Linux и Windows, инфраструктура ЦОД, сети, безопасность
GITHUB: https://github.com/Exxcoder
ЛОКАЦИЯ: Москва (офис, гибрид, удаленно)
СТАТУС: открыт к предложениям (DevOps, сисадмин, инженер инфраструктуры, ИБ)`;
  } else if (cleanCmd === 'skills' || cleanCmd === 'cat skills.txt') {
    output = `ТЕХНИЧЕСКИЙ СТЕК:
• ОС: Linux (Ubuntu, Debian, Kali), Windows Server (AD, GPO), Windows 10/11
• ПО ИБ: Secret Net Studio, Kaspersky Security Center (KES), Континент АП, DLP, SIEM (база)
• Сети: TCP/IP, Cisco Packet Tracer, монтаж ЛВС, коммутация
• Системы безопасности: Орион-ПРО, СИРИУС, Bolid, Honeywell, Тромбон (СОУЭ)
• Программирование: C#, Unity 2D/3D, Web (HTML/CSS/JS)
• Железо: компонентный ремонт серверов (3 ЦОД), сборка ПК и видеосерверов`;
  } else if (cleanCmd === 'exp' || cleanCmd === 'cat exp.log') {
    output = `ХРОНОЛОГИЯ ОПЫТА:
1. Faberlic (стажировка, 2 мес.) — технический специалист
   • 3 дата-центра, сборка и замена серверного железа (HDD, RAM, БП), корпоративная сеть
2. ООО «СТРОЙЭНЕРГОСЕРВИС» (1 мес.) — системный администратор и электромонтажник
   • Собянинская программа «Московское долголетие», ЛВС на базе Орион-ПРО, камеры, Тромбон
3. Аэропорт Домодедово «DME» (1 год 1 месяц) — инженер ПРТ слаботочных систем 2 класса
   • стратегический объект: Bolid и Honeywell, панель СИРИУС, ТКП, восстановление линий датчиков, 1С, ТО-1/ТО-2`;
  } else if (cleanCmd === 'projects' || cleanCmd === 'ls ./projects') {
    output = `всего 5
ip-cctv-server      (сборка сервера и настройка IP-видеонаблюдения)
orion-network       (ЛВС и Орион-ПРО, программа «Московское долголетие»)
faberlic-dc         (серверная инфраструктура 3-х дата-центров)
dme-security        (слаботочный комплекс Bolid и панель СИРИУС в DME)
pentest-lab         (лаборатория этичного хакинга и аудит AD)`;
  } else if (cleanCmd === 'github') {
    output = `GITHUB: https://github.com/Exxcoder
Профиль: Exxcoder. Репозитории и пет-проекты доступны по ссылке.`;
  } else if (cleanCmd === 'contact' || cleanCmd === 'curl /contact') {
    output = `КОНТАКТЫ:
• GitHub: https://github.com/Exxcoder
• Телефон: +7 (901) 901-54-42
• Email: vlad.vip8888@gmail.com
• Локация: Москва`;
  } else if (cleanCmd === 'clear') {
    if (terminalHistory) terminalHistory.textContent = '';
    return;
  } else if (cleanCmd === 'print') {
    window.print();
    output = 'Запущен диалог печати резюме в PDF...';
  } else {
    output = `zsh: команда не найдена: ${cmd}. Введите 'help' для справки.`;
  }

  if (terminalHistory) {
    terminalHistory.textContent += `\nvladlen@sec:~$ ${cmd}\n${output}\n`;
    const body = terminalBox.querySelector('.terminal-body');
    if (body) body.scrollTop = body.scrollHeight;
  }
}

// Фильтр проектов
function filterProjects(category, clickedBtn) {
  playSound('click', 600, 0.05, 'sine');
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  if (clickedBtn) clickedBtn.classList.add('active');

  const cards = document.querySelectorAll('.project-card');
  cards.forEach(card => {
    const cats = card.getAttribute('data-category') || '';
    if (category === 'all' || cats.includes(category)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// Данные модальных окон
const modalData = {
  'cctv-server': {
    tag: 'IP-видеонаблюдение · аппаратное обеспечение и сети',
    title: 'Комплексная система IP-видеонаблюдения и выделенный сервер',
    problem: 'Необходимость построения надежной локальной системы видеофиксации с высокими требованиями к пропускной способности, непрерывной 24/7 записи видеопотоков без потери кадров и изоляции видеосегмента от внешней сети.',
    architecture: `[IP Камеры RTSP] ──────> [PoE Switch (VLAN 10)] ──────> [Сервер Видеонаблюдения]
                                                       ├── Хранилище (RAID-1)
                                                       ├── ПО мониторинга
                                                       └── Защищенный VPN Gateway`,
    implementation: [
      'Подбор оптимальных аппаратных компонентов сервера (многопоточный процессор, 16GB+ RAM, надежный блок питания с запасом мощности).',
      'Сборка, тестирование стабильности под нагрузкой и установка серверной ОС.',
      'Монтаж и коммутация IP-камер, настройка сетевых интерфейсов, битрейта и компрессии H.264/H.265.',
      'Изоляция подсети видеонаблюдения для предотвращения несанкционированного доступа к видеоархиву.',
      'Конфигурация детекторов движения, циклической перезаписи и удаленного шифрованного доступа.'
    ],
    results: 'Система успешно запущена, обеспечивает бесперебойную фиксацию видеопотока, быстрый доступ к архиву и защищена от внешнего сканирования.'
  },
  'orion-network': {
    tag: 'Корпоративная инфраструктура · Орион-ПРО',
    title: 'Локальная сеть и интеграция «Орион-ПРО» (СТРОЙЭНЕРГОСЕРВИС, «Московское долголетие»)',
    problem: 'Развертывание защищенной сетевой инфраструктуры на объектах программы «Московское долголетие» с одновременным подключением охранного видеонаблюдения и интеграцией с системой оповещения при ЧС.',
    architecture: `[Рабочие станции ЛВС] ──> [Коммутатор Cisco/D-Link] <── [АРМ Орион-ПРО]
                                 │                            │
                        [IP-Камеры периметра]         [Устройство «Тромбон»]`,
    implementation: [
      'Проектирование и физический монтаж кабельных трасс (витая пара Cat 5e/6), установка патч-панелей и розеток на объектах Собянинской программы «Московское долголетие».',
      'Настройка адресации TCP/IP, шлюзов по умолчанию и исключение коллизий в сети.',
      'Установка и подключение камер наблюдения, ввод в единую систему мониторинга.',
      'Пусконаладка специализированного звукового оповещения «Тромбон» для эвакуационного оповещения персонала.',
      'Разграничение прав операторов в ПО «Орион-ПРО» для защиты конфигураций от модификаций.'
    ],
    results: 'Полная готовность объекта к сдаче, нулевой уровень сетевых сбоев, интеграция противопожарных и эвакуационных сценариев.'
  },
  'faberlic-dc': {
    tag: 'Дата-центры · серверное оборудование',
    title: 'Обслуживание серверной инфраструктуры в 3-х дата-центрах (Faberlic)',
    problem: 'Поддержание непрерывной работы сотен высоконагруженных серверов, оперативная замена вышедших из строя модулей без простоя сервисов компании.',
    architecture: `[Стойка DC #1/#2/#3] ──> [Blade / 1U-2U Серверы] ──> [Модули Hot-Swap HDD/RAM]
                                   │
                     [Диагностика IPMI / iLO] ──> [Регламентная замена]`,
    implementation: [
      'Выездные работы на площадках 3-х крупнейших коммерческих дата-центров.',
      'Диагностика аппаратных неисправностей серверов с использованием индикации и консоли управления.',
      'Горячая и плановая замена дисковых накопителей (HDD/SSD) в аппаратных RAID-массивах с контролем ребилда.',
      'Замена модулей питания и оперативной памяти ECC DDR4/DDR5.',
      'Сборка новых серверов с нуля в соответствии с техническими регламентами IT-отдела компании.'
    ],
    results: 'Успешное закрытие инцидентов по замене оборудования, исключение деградации производительности корпоративных баз данных и приложений.'
  },
  'dme-systems': {
    tag: 'Критическая инфраструктура · аэропорт',
    title: 'Слаботочные системы и панель «СИРИУС» (Аэропорт Домодедово — 1 год 1 месяц)',
    problem: 'Обеспечение безотказной работы систем пожарной безопасности и адресных датчиков на объекте с высочайшими требованиями к надежности (Международный аэропорт).',
    architecture: `[Адресные датчики ДИП] ──> [Линия ДПЛС] ──> [Панель «СИРИУС» / Bolid]
                                                │
                                       [1C: Учет ТО-1/ТО-2]`,
    implementation: [
      'Более года (1 год 1 месяц) непрерывной эксплуатации слаботочных систем 2 класса в Аэропорту Домодедово.',
      'Монтаж и протяжка сигнальных кабелей в жестких условиях инфраструктуры аэропорта.',
      'Программирование и конфигурирование адресной панели «СИРИУС» (Bolid) и систем Honeywell.',
      'Поиск обрывов, коротких замыканий и помех в адресных шлейфах ДПЛС, восстановление работоспособности датчиков.',
      'Обслуживание датчиков дыма, тепла, пламени, панелей ТКП, насосных систем пожаротушения.',
      'Фиксация каждого регламентного действия в корпоративной системе 1С с формированием отчетов.'
    ],
    results: 'Безупречное прохождение ежемесячных регламентов ТО-1 и ТО-2, своевременное устранение внештатных срабатываний.'
  },
  'pentest-lab': {
    tag: 'Исследование безопасности · аудит',
    title: 'Пентестинг-лаборатория: аудит Active Directory и средства защиты',
    problem: 'Практическое исследование того, как средства защиты информации (Secret Net Studio, KES, Континент АП) реагируют на реальные действия пентестера и злоумышленника.',
    architecture: `[Kali Linux / Pentest Box] ──> [Сетевой сегмент Lab] ──> [Windows Server 2022 DC]
   └── Nmap, BloodHound, Impacket                       ├── Active Directory GPO
                                                        ├── Secret Net Studio
                                                        └── Kaspersky KES`,
    implementation: [
      'Развертывание виртуализированного домена на Windows Server с клиентскими машинами Windows 10.',
      'Настройка групповых политик (GPO), учетных записей, групп безопасности и списков контроля доступа (ACL).',
      'Инсталляция и настройка СЗИ: Secret Net Studio (контроль входа, контроль устройств, замкнутая программная среда), KES и Континент АП.',
      'Проведение тестов на проникновение: сетевое сканирование (Nmap), анализ конфигурации Kerberos, выявление слабых паролей и избыточных прав.',
      'Анализ логов безопасности в Event Viewer и моделирование сценариев выявления аномалий для SIEM.'
    ],
    results: 'Глубокое практическое понимание механик работы СЗИ и практических методов выявления уязвимостей в корпоративных сетях.'
  }
};

function openModal(caseKey) {
  playSound('click', 680, 0.08, 'sine');
  const data = modalData[caseKey];
  if (!data) return;

  const content = document.getElementById('modalContent');
  if (content) {
    content.innerHTML = `
      <div class="modal-tag">${data.tag}</div>
      <h3 class="modal-title">${data.title}</h3>

      <div class="modal-section">
        <div class="modal-section-title">Постановка задачи</div>
        <p>${data.problem}</p>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Топология и архитектура</div>
        <pre class="ascii-diagram">${data.architecture}</pre>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Что было реализовано</div>
        <ul>
          ${data.implementation.map(step => `<li>${step}</li>`).join('')}
        </ul>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Итог и практическая ценность</div>
        <p>${data.results}</p>
      </div>
    `;
  }

  const modal = document.getElementById('caseModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const modal = document.getElementById('caseModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  playSound('click', 440, 0.05, 'sine');
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'caseModal') {
    closeModal();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Toast-уведомления
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

function copyContact(text, feedbackMsg) {
  playSound('click', 650, 0.06, 'sine');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(feedbackMsg || 'Скопировано в буфер обмена');
    }).catch(() => fallbackCopy(text, feedbackMsg));
  } else {
    fallbackCopy(text, feedbackMsg);
  }
}

function fallbackCopy(text, feedbackMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(feedbackMsg || 'Скопировано в буфер обмена');
}

function interactSkill(name) {
  playSound('click', 720, 0.05, 'sine');
  showToast(`Навык проверен: ${name}`);
}

function handleFormSubmit(e) {
  e.preventDefault();
  playSound('success', 880, 0.12, 'sine');
  const name = document.getElementById('senderName') ? document.getElementById('senderName').value : 'Гость';
  showToast(`Спасибо, ${name}! Сообщение сохранено.`);
  e.target.reset();
}
