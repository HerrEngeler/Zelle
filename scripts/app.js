/* ===================================================================
   app.js – Zellen-Escape-Room NT9
   Zentrale Spiellogik für alle Kapitel-Seiten
   =================================================================== */

'use strict';

// ─── Konstanten ──────────────────────────────────────────────────
var PROGRESS_KEY = 'zellen-escape-room_progress_v1';
var TEACHER_KEY  = 'zellen-escape-room_teacher_v1';
var MUSIC_KEY    = 'zellen-escape-room_music_v1';
var TRACK_KEY    = 'zellen-escape-room_track_v1';
var TOTAL_MAPPES = 7;

var TRACK_NAMES = ['Challenge', 'Escape', 'Thinking', 'Mission', 'Focus', 'Discovery', 'Tension', 'Journey'];

// ─── Audio / Musik ────────────────────────────────────────────────
var _audioCtx = null;
var _musicEl  = null;
var _musicOn  = false;
var _trackIdx = 0;

function _getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return _audioCtx;
}

function playSound(type) {
  var ctx = _getAudioCtx();
  if (!ctx) return;
  try {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    var now = ctx.currentTime;
    if (type === 'correct') {
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.1);
      osc.frequency.setValueAtTime(784, now + 0.2);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(180, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'unlock') {
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.setValueAtTime(523, now + 0.12);
      osc.frequency.setValueAtTime(659, now + 0.24);
      osc.frequency.setValueAtTime(784, now + 0.36);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.start(now); osc.stop(now + 0.7);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    }
  } catch(e) {}
}

// ─── Fortschritt ─────────────────────────────────────────────────
function getProgress() {
  try {
    var raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (!Array.isArray(p.unlockedMappes)) p.unlockedMappes = [1];
      if (!p.completedTasks) p.completedTasks = {};
      return p;
    }
  } catch(e) {}
  return { unlockedMappes: [1], completedTasks: {} };
}

function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch(e) {}
}

function isUnlocked(n) {
  if (n === 1) return true;
  if (isTeacherMode()) return true;
  var p = getProgress();
  return Array.isArray(p.unlockedMappes) && p.unlockedMappes.indexOf(n) !== -1;
}

function isCompleted(n) {
  var p = getProgress();
  return !!(p.completedTasks && Array.isArray(p.completedTasks[n]) &&
            p.completedTasks[n].indexOf('done') !== -1);
}

function isTaskDone(mappeNum, taskKey) {
  var p = getProgress();
  if (!p.completedTasks || !Array.isArray(p.completedTasks[mappeNum])) return false;
  return p.completedTasks[mappeNum].indexOf(String(taskKey)) !== -1;
}

function saveTaskDone(mappeNum, taskKey) {
  var p = getProgress();
  if (!p.completedTasks) p.completedTasks = {};
  if (!Array.isArray(p.completedTasks[mappeNum])) p.completedTasks[mappeNum] = [];
  var key = String(taskKey);
  if (p.completedTasks[mappeNum].indexOf(key) === -1) {
    p.completedTasks[mappeNum].push(key);
  }
  saveProgress(p);
}

function unlockNextMappe(n) {
  var p = getProgress();
  if (!Array.isArray(p.unlockedMappes)) p.unlockedMappes = [1];
  var next = n + 1;
  if (p.unlockedMappes.indexOf(n) === -1) p.unlockedMappes.push(n);
  if (next <= TOTAL_MAPPES && p.unlockedMappes.indexOf(next) === -1) {
    p.unlockedMappes.push(next);
  }
  // Mappe als fertig markieren
  if (!p.completedTasks) p.completedTasks = {};
  if (!Array.isArray(p.completedTasks[n])) p.completedTasks[n] = [];
  if (p.completedTasks[n].indexOf('done') === -1) p.completedTasks[n].push('done');
  saveProgress(p);

  // Erfolgs-Feedback anzeigen dann weiterleiten
  var fbEl = document.getElementById('feedback-code');
  if (fbEl) {
    fbEl.className = 'feedback-area correct';
    fbEl.innerHTML = '✓ Code korrekt! Labor ' + next + ' ist jetzt freigeschaltet. Du wirst weitergeleitet…';
    fbEl.style.display = 'block';
  }

  // Musik für nächste Seite aktivieren
  sessionStorage.setItem(MUSIC_KEY, 'on');

  setTimeout(function() {
    if (next <= TOTAL_MAPPES) {
      window.location.href = 'labor-0' + next + '.html';
    } else {
      window.location.href = '../karte.html';
    }
  }, 1800);
}

function resetProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

// ─── Punktesystem ──────────────────────────────────────────────────
var POINTS_MAX_PER_TASK = 2;
var TASKS_PER_MAPPE     = 5;

function awardPoints(mappeNum, taskNum, pts) {
  var p = getProgress();
  if (!p.points) p.points = {};
  var key = mappeNum + '_' + taskNum;
  if (p.points[key] !== undefined) return; // Idempotenz: nie doppelt vergeben
  p.points[key] = Math.max(0, Math.min(POINTS_MAX_PER_TASK, Number(pts) || 0));
  saveProgress(p);
  updatePointsDisplay();
}

function getTotalPoints() {
  var pts = getProgress().points || {};
  var total = 0;
  for (var k in pts) {
    if (Object.prototype.hasOwnProperty.call(pts, k)) total += pts[k];
  }
  return total;
}

function getMaxPossiblePoints() {
  return TOTAL_MAPPES * TASKS_PER_MAPPE * POINTS_MAX_PER_TASK; // 70
}

function getLevel(pct) {
  if (pct >= 90) return { label: 'Expert:in',          stars: '★★★★★', color: '#c9a227' };
  if (pct >= 80) return { label: 'Fortgeschrittene:r', stars: '★★★★☆', color: '#2980b9' };
  if (pct >= 70) return { label: 'Kompetent',          stars: '★★★☆☆', color: '#27ae60' };
  if (pct >= 60) return { label: 'Lernende:r',         stars: '★★☆☆☆', color: '#e67e22' };
  return             { label: 'Einsteiger:in',         stars: '★☆☆☆☆', color: '#9b2226' };
}

function updatePointsDisplay() {
  var el = document.getElementById('points-counter');
  if (!el) return;
  var total = getTotalPoints();
  var max   = getMaxPossiblePoints();
  el.textContent = total + '\u00a0/\u00a0' + max + '\u00a0Pkt.';
}

function injectPointsCounter() {
  if (document.getElementById('points-counter-wrap')) return;
  var inner = document.querySelector('.header-inner');
  if (!inner) return;
  var wrap = document.createElement('div');
  wrap.id = 'points-counter-wrap';
  wrap.innerHTML =
    '<span class="points-label">Punkte</span>' +
    '<span id="points-counter">0\u00a0/\u00a070\u00a0Pkt.</span>';
  inner.appendChild(wrap);
  updatePointsDisplay();
}

// ─── Lehrer-Modus ─────────────────────────────────────────────────
function isTeacherMode() {
  return sessionStorage.getItem(TEACHER_KEY) === 'active';
}

function addTeacherUI() {
  if (!isTeacherMode()) return;
  var fab = document.createElement('div');
  fab.className = 'teacher-fab';
  fab.innerHTML = '👩‍🏫 Lehrer-Modus aktiv | <button onclick="exitTeacherMode()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:inherit;">Beenden</button>';
  document.body.appendChild(fab);
  // Alle Kapitel entsperren in der Nav
  document.querySelectorAll('.chapter-circle.locked').forEach(function(el) {
    el.classList.remove('locked');
  });
}

function exitTeacherMode() {
  sessionStorage.removeItem(TEACHER_KEY);
  location.reload();
}

// ─── Feedback ─────────────────────────────────────────────────────
function showFeedback(id, message, type) {
  var el = document.getElementById(id);
  if (!el) return;
  el.className = 'feedback-area ' + type;
  el.innerHTML = message;
  el.style.display = 'block';
  setTimeout(function() {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

// ─── Aufgaben-Steuerung ────────────────────────────────────────────
function showTask(n) {
  var el = document.getElementById('task-' + n);
  if (!el) return;
  el.classList.add('visible');
  setTimeout(function() {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

// Nächste Aufgabe anzeigen (wird von next-btn onclick-Handlern gerufen)
function goToTask(taskId) {
  if (String(taskId) === 'code' || String(taskId) === 'fertig') {
    revealCodeSection();
    return;
  }
  var el = document.getElementById('task-' + taskId);
  if (!el) return;
  el.classList.add('visible');
  setTimeout(function() {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function revealCodeSection() {
  var cs = document.getElementById('code-section');
  if (cs) {
    cs.style.display = 'block';
    setTimeout(function() {
      cs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
  var nav = document.querySelector('.task-list [data-task="code"]');
  if (nav) {
    nav.classList.remove('locked');
    var st = nav.querySelector('.task-status');
    if (st) st.textContent = '';
  }
}

// ─── Stempel-Animation ─────────────────────────────────────────────
function showStamp(n) {
  var card = document.querySelector('#task-' + n + ' .document-card');
  if (!card) return;
  var existing = card.querySelector('.analysiert-stamp');
  if (existing) existing.remove();
  var stamp = document.createElement('div');
  stamp.className = 'analysiert-stamp';
  stamp.textContent = 'ANALYSIERT \u2713';
  card.style.position = 'relative';
  card.appendChild(stamp);
}

// ─── Konfetti ─────────────────────────────────────────────────────
function launchConfetti() {
  var canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%;';
    document.body.appendChild(canvas);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  var ctx = canvas.getContext('2d');
  var pieces = [];
  var colors = ['#c9a227','#27ae60','#2980b9','#e67e22','#9b59b6','#e74c3c'];
  for (var i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  var frames = 0;
  var maxFrames = 150;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(function(p) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.vy += 0.05;
    });
    frames++;
    if (frames < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(draw);
}

// ─── Kapitel-Navigation ────────────────────────────────────────────
function updateChapterNav() {
  var circles = document.querySelectorAll('.chapter-circle, .chapter-dot');
  circles.forEach(function(el) {
    var n = parseInt(el.getAttribute('data-mappe') || el.getAttribute('data-chapter') || el.textContent.trim(), 10);
    if (!n) return;
    if (isCompleted(n)) {
      el.classList.add('completed');
      el.classList.remove('locked');
    } else if (!isUnlocked(n)) {
      el.classList.add('locked');
      el.removeAttribute('href');
    }
  });
}

// ─── Fortschritt wiederherstellen ──────────────────────────────────
function restoreTaskProgress(mappeNum, numTasks) {
  var allTasksDone = true;
  for (var i = 1; i <= numTasks; i++) {
    if (isTaskDone(mappeNum, i)) {
      var taskEl = document.getElementById('task-' + i);
      if (taskEl) {
        taskEl.classList.add('visible', 'completed');
        var nb = document.getElementById('next-btn-' + i);
        if (nb) nb.style.display = 'inline-flex';
        var si = document.querySelector('.task-list [data-task="' + i + '"] .task-status');
        if (si) si.textContent = '\u2713';
        var li = document.querySelector('.task-list [data-task="' + i + '"]');
        if (li) { li.classList.remove('active', 'locked'); li.classList.add('completed'); }
        if (i < numTasks) {
          var nextLi = document.querySelector('.task-list [data-task="' + (i + 1) + '"]');
          if (nextLi) { nextLi.classList.remove('locked'); var nst = nextLi.querySelector('.task-status'); if (nst) nst.textContent = ''; }
        }
      }
    } else {
      allTasksDone = false;
    }
  }
  // Code-Section NUR anzeigen wenn 'done'-Key gesetzt
  if (isTaskDone(mappeNum, 'done')) {
    revealCodeSection();
  } else if (allTasksDone) {
    var lastBtn = document.getElementById('next-btn-' + numTasks);
    if (lastBtn) lastBtn.style.display = 'inline-flex';
  }
}

// ─── Musik-Player ─────────────────────────────────────────────────
function _updateMusicBtn() {
  var btn = document.getElementById('music-toggle-btn');
  var lbl = document.getElementById('music-track-label');
  var player = document.getElementById('music-player');
  if (btn) btn.textContent = _musicOn ? '\uD83C\uDFB5' : '\uD83D\uDD07';
  if (lbl) lbl.textContent = TRACK_NAMES[_trackIdx] || '';
  if (player) {
    if (_musicOn) player.classList.add('music-on');
    else player.classList.remove('music-on');
  }
}

function initMusicPlayer() {
  // Erzeuge Player-UI
  var existing = document.getElementById('music-player');
  if (!existing) {
    var player = document.createElement('div');
    player.id = 'music-player';
    player.innerHTML =
      '<button class="music-btn" onclick="changeTrack(-1)" title="Vorheriger Track">\u2039</button>' +
      '<button class="music-btn" id="music-toggle-btn" onclick="toggleMusic()" title="Musik an/aus">\uD83D\uDD07</button>' +
      '<span class="music-label" id="music-track-label">Challenge</span>' +
      '<button class="music-btn" onclick="changeTrack(1)" title="N\u00e4chster Track">\u203a</button>';
    document.body.appendChild(player);
  }

  // Gespeicherten Track laden
  var savedTrack = sessionStorage.getItem(TRACK_KEY);
  if (savedTrack !== null) _trackIdx = parseInt(savedTrack, 10) || 0;

  // Musik starten wenn sessionStorage = 'on'
  var shouldPlay = sessionStorage.getItem(MUSIC_KEY) === 'on';
  if (shouldPlay) {
    _startMusic();
  }
  _updateMusicBtn();
}

function _startMusic() {
  if (!_musicEl) {
    _musicEl = document.createElement('audio');
    _musicEl.loop = true;
    _musicEl.volume = 0.35;
    document.body.appendChild(_musicEl);
  }
  // Keine echte Audiodatei – Musik-Player ist UI-only ohne MP3
  // Bei vorhandenen MP3s: _musicEl.src = '../audio/track-' + (_trackIdx + 1) + '.mp3';
  _musicEl.play().then(function() {
    _musicOn = true;
    sessionStorage.setItem(MUSIC_KEY, 'on');
    _updateMusicBtn();
  }).catch(function() {
    _musicOn = false;
    sessionStorage.removeItem(MUSIC_KEY);
    _updateMusicBtn();
    // Autoplay-Retry bei erstem Klick
    document.addEventListener('click', function _resumeOnClick() {
      document.removeEventListener('click', _resumeOnClick);
      if (_musicEl && !_musicOn) {
        _musicEl.play().then(function() {
          _musicOn = true;
          sessionStorage.setItem(MUSIC_KEY, 'on');
          _updateMusicBtn();
        }).catch(function() {});
      }
    }, { once: true });
  });
}

function toggleMusic() {
  if (_musicOn) {
    if (_musicEl) _musicEl.pause();
    _musicOn = false;
    sessionStorage.removeItem(MUSIC_KEY);
  } else {
    _startMusic();
    return;
  }
  _updateMusicBtn();
}

function changeTrack(dir) {
  _trackIdx = (_trackIdx + dir + TRACK_NAMES.length) % TRACK_NAMES.length;
  sessionStorage.setItem(TRACK_KEY, String(_trackIdx));
  if (_musicEl) {
    // _musicEl.src = '../audio/track-' + (_trackIdx + 1) + '.mp3';
    if (_musicOn) _startMusic();
  }
  _updateMusicBtn();
}

// ─── Karte rendern ─────────────────────────────────────────────────
function renderKarte() {
  var KAPITEL_URLS = {
    1: 'labore/labor-01.html',
    2: 'labore/labor-02.html',
    3: 'labore/labor-03.html',
    4: 'labore/labor-04.html',
    5: 'labore/labor-05.html',
    6: 'labore/labor-06.html',
    7: 'labore/labor-07.html'
  };
  var KAPITEL_TITLES = {
    1: 'Was ist Leben?',
    2: 'Blick durchs Mikroskop',
    3: 'Deine Zellen, meine Zellen',
    4: 'Der Motor der Zelle',
    5: 'Bauplan des Lebens',
    6: 'XX oder XY?',
    7: 'Fehler, Zufall, Zukunft'
  };
  var KAPITEL_DESC = {
    1: 'Die Zelle als Grundbaustein – Prokaryoten vs. Eukaryoten',
    2: 'Aufbau der Pflanzenzelle – Mikroskopie der Zwiebelschale',
    3: 'Tierische Zelle – Vergleich mit der Pflanzenzelle',
    4: 'Zellatmung und Mitochondrien – Das Kraftwerk der Zelle',
    5: 'DNA, Gene und Chromosomen – Hierarchie des Erbmaterials',
    6: 'Gonosomen XX/XY – Kreuzungsschema und Geschlecht',
    7: 'Mutation, Erbkrankheiten, Gentechnik – Ethische Fragen'
  };

  var grid = document.getElementById('karte-grid');
  if (!grid) return;

  var html = '';
  for (var n = 1; n <= TOTAL_MAPPES; n++) {
    var unlocked = isUnlocked(n);
    var completed = isCompleted(n);
    var cls = 'karte-card';
    if (!unlocked) cls += ' locked';
    if (completed) cls += ' completed';

    var statusIcon = '';
    if (completed) statusIcon = '<span class="karte-card-status check-icon">\u2713</span>';
    else if (unlocked) statusIcon = '<span class="karte-card-status start-arrow">\u2192</span>';
    else statusIcon = '<span class="karte-card-status">\uD83D\uDD12</span>';

    var cardHtml = '<div class="' + cls + '" onclick="openKapitel(' + n + ')">' +
      statusIcon +
      '<div class="karte-card-num">Labor ' + n + '</div>' +
      '<div class="karte-card-title">' + KAPITEL_TITLES[n] + '</div>' +
      '<div class="karte-card-desc">' + KAPITEL_DESC[n] + '</div>' +
      '</div>';
    html += cardHtml;
  }
  grid.innerHTML = html;
}

// ─── Startseite (index.html) ────────────────────────────────────
function initLandingPage() {
  // PFLICHT: Teacher-Session beim Start zurücksetzen
  sessionStorage.removeItem(TEACHER_KEY);

  // Start-Button → Musik aktivieren
  var startBtn = document.querySelector('.start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', function() {
      sessionStorage.setItem(MUSIC_KEY, 'on');
    });
  }

  // Anleitung-Modal
  var anleitungBtn = document.querySelector('.anleitung-btn');
  var overlay = document.getElementById('anleitung-overlay');
  var closeBtn = document.getElementById('anleitung-close');

  if (anleitungBtn && overlay) {
    anleitungBtn.addEventListener('click', function() {
      overlay.classList.add('open');
    });
  }
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', function() {
      overlay.classList.remove('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  }
}

// ─── Haupt-Initialisierung ──────────────────────────────────────
function initApp(kapitelNum, totalTasks) {
  // Sidebar-Toggle (Mobile)
  var toggle = document.getElementById('sidebar-toggle');
  var sidebar = document.getElementById('task-sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function() {
      sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Kapitel-Navigation aktualisieren
  updateChapterNav();

  // Punkte-Zähler in Header einblenden
  injectPointsCounter();

  // Prev/Next Navigation
  var prevBtn = document.getElementById('prev-mappe');
  var nextBtn = document.getElementById('next-mappe');
  if (prevBtn) {
    prevBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (kapitelNum > 1) window.location.href = 'labor-0' + (kapitelNum - 1) + '.html';
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (kapitelNum < TOTAL_MAPPES && isUnlocked(kapitelNum + 1)) {
        window.location.href = 'labor-0' + (kapitelNum + 1) + '.html';
      }
    });
  }

  // Fortschritt wiederherstellen
  restoreTaskProgress(kapitelNum, totalTasks);

  // Musik-Player
  initMusicPlayer();

  // Lehrer-UI
  addTeacherUI();

  // Sidebar-Klick-Navigation
  var taskItems = document.querySelectorAll('.task-nav-item:not(.locked)');
  taskItems.forEach(function(item) {
    item.addEventListener('click', function() {
      var taskId = item.getAttribute('data-task');
      if (taskId && taskId !== 'code' && taskId !== 'fertig') {
        var el = document.getElementById('task-' + taskId);
        if (el && el.classList.contains('visible')) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (taskId === 'code' || taskId === 'fertig') {
        var cs = document.getElementById('code-section');
        if (cs && cs.style.display !== 'none') cs.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}
