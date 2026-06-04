/**
 * UI helpers — modals, toasts, progress rings, theme
 */
const UI = (function () {
  function toast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function showAchievement(id) {
    const def = Achievements.DEFINITIONS.find((a) => a.id === id);
    if (!def) return;
    const popup = document.getElementById('achievement-popup');
    document.getElementById('achievement-popup-title').textContent = def.title;
    document.getElementById('achievement-popup-desc').textContent = def.desc;
    popup.querySelector('.achievement-icon').textContent = def.icon;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 4000);
  }

  function openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  function applyTheme(theme) {
    let resolved = theme;
    if (theme === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    StudyStore.set('theme', theme);
  }

  function renderProgressRing(percent, label, size = 100) {
    const offset = 283 - (283 * Utils.clamp(percent, 0, 100)) / 100;
    return `
      <div class="ring-card">
        <div class="ring-wrap">
          <svg class="progress-ring" width="${size}" height="${size}" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:var(--primary)"/>
                <stop offset="100%" style="stop-color:var(--accent)"/>
              </linearGradient>
            </defs>
            <circle class="track" cx="50" cy="50" r="45"/>
            <circle class="fill" cx="50" cy="50" r="45" style="stroke-dashoffset:${offset}"/>
          </svg>
          <div class="ring-value">${Math.round(percent)}%</div>
        </div>
        <h4>${Utils.escapeHtml(label)}</h4>
      </div>
    `;
  }

  function renderStats(stats) {
    const grid = document.getElementById('stats-grid');
    const items = [
      { label: 'Total Subjects', value: stats.totalSubjects },
      { label: 'Total Chapters', value: stats.totalChapters },
      { label: 'Completed', value: stats.completedChapters },
      { label: 'Remaining', value: stats.remainingChapters },
      { label: 'Study Hours', value: stats.totalStudyHours.toFixed(1) },
      { label: 'Completion', value: stats.completionPct + '%' },
      { label: 'Exam Readiness', value: stats.readiness + '%' }
    ];
    grid.innerHTML = items.map((i) => `
      <div class="stat-card">
        <div class="stat-value">${i.value}</div>
        <div class="stat-label">${i.label}</div>
      </div>
    `).join('');
  }

  function renderRings(rings) {
    const container = document.getElementById('progress-rings');
    container.innerHTML = rings.map((r) => renderProgressRing(r.percent, r.label)).join('');
    requestAnimationFrame(() => {
      container.querySelectorAll('.fill').forEach((el, i) => {
        const pct = rings[i].percent;
        el.style.strokeDashoffset = 283 - (283 * Utils.clamp(pct, 0, 100)) / 100;
      });
    });
  }

  function renderRecommendations(recs) {
    const bar = document.getElementById('recommendations-bar');
    const list = document.getElementById('recommendations-list');
    if (!recs.length) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    list.innerHTML = recs.map((r) => `<li>${Utils.escapeHtml(r.text)}</li>`).join('');
  }

  function renderAchievements(unlockedIds) {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = Achievements.DEFINITIONS.map((a) => `
      <div class="achievement-badge ${unlockedIds.includes(a.id) ? 'unlocked' : 'locked'}">
        <span class="badge-icon">${a.icon}</span>
        <h4>${Utils.escapeHtml(a.title)}</h4>
        <p>${Utils.escapeHtml(a.desc)}</p>
      </div>
    `).join('');
  }

  function renderStreakShowcase(streak) {
    const el = document.getElementById('streak-showcase');
    el.innerHTML = `
      <div class="big-streak">${streak.current || 0} 🔥</div>
      <p>Daily streak · Longest: ${streak.longest || 0} days</p>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem">
        Weekly consistency: ${streak.weekly || 0} · Monthly: ${streak.monthly || 0}
      </p>
    `;
    document.getElementById('streak-count').textContent = streak.current || 0;
  }

  function initModalClose() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
  }

  function initThemeToggle() {
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const current = StudyStore.get('theme') || 'dark';
      const next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
      applyTheme(next);
      const sel = document.getElementById('setting-theme');
      if (sel) sel.value = next;
    });
  }

  return {
    toast, showAchievement, openModal, closeModal, applyTheme,
    renderProgressRing, renderStats, renderRings, renderRecommendations,
    renderAchievements, renderStreakShowcase, initModalClose, initThemeToggle
  };
})();
