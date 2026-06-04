/**
 * Utility helpers
 */
const Utils = (function () {
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function formatDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toISOString().slice(0, 10);
  }

  function parseDate(str) {
    return new Date(str + 'T12:00:00');
  }

  function daysBetween(a, b) {
    const ms = parseDate(b) - parseDate(a);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function addDays(dateStr, n) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return formatDate(d);
  }

  function formatMinutes(m) {
    if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60 ? m % 60 + 'm' : ''}`.trim();
    return `${m}m`;
  }

  function formatHours(h) {
    return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getWeekStart(dateStr) {
    const d = parseDate(dateStr);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return formatDate(d);
  }

  function getMonthDays(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function isToday(dateStr) {
    return dateStr === formatDate(new Date());
  }

  function dayName(dateStr) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseDate(dateStr).getDay()];
  }

  return {
    uid, formatDate, parseDate, daysBetween, addDays, formatMinutes, formatHours,
    clamp, debounce, escapeHtml, getWeekStart, getMonthDays, isToday, dayName
  };
})();
