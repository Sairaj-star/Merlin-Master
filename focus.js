/**
 * Focus Mode & Pomodoro System
 */
const FocusMode = (function () {
  let timerId = null;
  let remaining = 0;
  let totalSeconds = 0;
  let phase = 'focus';
  let sessionCount = 0;
  let running = false;
  let onTick = null;
  let onComplete = null;

  function getDurations() {
    return {
      focus: (StudyStore.get('focusMinutes') || 25) * 60,
      break: (StudyStore.get('breakMinutes') || 5) * 60,
      longBreak: (StudyStore.get('longBreakMinutes') || 15) * 60
    };
  }

  function startPhase(type) {
    const d = getDurations();
    phase = type;
    totalSeconds = type === 'focus' ? d.focus : type === 'longBreak' ? d.longBreak : d.break;
    remaining = totalSeconds;
    updateRing();
  }

  function updateRing() {
    const ring = document.getElementById('pomodoro-ring');
    if (!ring) return;
    const circumference = 565;
    const progress = totalSeconds ? (totalSeconds - remaining) / totalSeconds : 0;
    ring.style.strokeDashoffset = circumference - progress * circumference;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function tick() {
    if (remaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      running = false;
      handlePhaseComplete();
      return;
    }
    remaining--;
    const el = document.getElementById('timer-time');
    if (el) el.textContent = formatTime(remaining);
    updateRing();
    if (onTick) onTick(remaining, phase);
  }

  function handlePhaseComplete() {
    if (phase === 'focus') {
      sessionCount++;
      const stats = StudyStore.get('focusStats') || { totalMinutes: 0, longestSession: 0, sessions: [] };
      const mins = Math.round(getDurations().focus / 60);
      stats.totalMinutes = (stats.totalMinutes || 0) + mins;
      stats.longestSession = Math.max(stats.longestSession || 0, mins);
      stats.sessions = stats.sessions || [];
      stats.sessions.push({ date: Utils.formatDate(new Date()), minutes: mins });
      StudyStore.set('focusStats', stats);
      if (onComplete) onComplete('focus', mins);

      if (sessionCount % 4 === 0) startPhase('longBreak');
      else startPhase('break');
    } else {
      startPhase('focus');
    }
    const label = document.getElementById('timer-label');
    if (label) label.textContent = phase === 'focus' ? 'Focus' : 'Break';
    const count = document.getElementById('timer-session-count');
    if (count) count.textContent = `Session ${sessionCount + 1}`;
    document.getElementById('timer-time').textContent = formatTime(remaining);
    if (running) timerId = setInterval(tick, 1000);
  }

  function start() {
    if (!running) {
      if (remaining <= 0) startPhase('focus');
      running = true;
      timerId = setInterval(tick, 1000);
      const btn = document.getElementById('btn-timer-start');
      if (btn) btn.textContent = 'Pause';
    }
  }

  function pause() {
    running = false;
    clearInterval(timerId);
    timerId = null;
    const btn = document.getElementById('btn-timer-start');
    if (btn) btn.textContent = 'Resume';
  }

  function toggle() {
    if (running) pause();
    else start();
  }

  function reset() {
    pause();
    sessionCount = 0;
    startPhase('focus');
    document.getElementById('timer-time').textContent = formatTime(remaining);
    document.getElementById('btn-timer-start').textContent = 'Start';
  }

  function enterFullscreen() {
    const container = document.getElementById('focus-container');
    document.body.classList.add('focus-fullscreen');
    if (container.requestFullscreen) container.requestFullscreen();
    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
  }

  function exitFullscreen() {
    document.body.classList.remove('focus-fullscreen');
    if (document.fullscreenElement) document.exitFullscreen();
  }

  function getWeeklyAverage() {
    const stats = StudyStore.get('focusStats') || { sessions: [] };
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = (stats.sessions || []).filter((s) => Utils.parseDate(s.date) >= weekAgo);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((a, s) => a + s.minutes, 0) / recent.length);
  }

  function init(callbacks) {
    onTick = callbacks?.onTick;
    onComplete = callbacks?.onComplete;
    startPhase('focus');
    document.getElementById('timer-time').textContent = formatTime(remaining);
  }

  return {
    init, start, pause, toggle, reset, enterFullscreen, exitFullscreen,
    getWeeklyAverage, get phase() { return phase; }, get running() { return running; }
  };
})();
