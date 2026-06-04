/**
 * LocalStorage for settings and lightweight state
 */
const StudyStore = (function () {
  const PREFIX = 'sm_';
  const DEFAULTS = {
    theme: 'dark',
    hoursPerDay: 4,
    weakTopics: '',
    strongTopics: '',
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    dailySchedule: {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: { start: '10:00', end: '14:00' },
      sun: { start: '10:00', end: '14:00' }
    },
    streak: { current: 0, longest: 0, lastStudyDate: null, weekly: 0, monthly: 0 },
    focusStats: { totalMinutes: 0, longestSession: 0, sessions: [] },
    productivityHistory: [],
    unlockedAchievements: [],
    lastAutoSave: null,
    planStartDate: null,
    calendarMonth: null
  };

  const QUOTES = [
    'The expert in anything was once a beginner.',
    'Study while others are sleeping; work while others are loafing.',
    'Success is the sum of small efforts repeated day in and day out.',
    'Don\'t watch the clock; do what it does. Keep going.',
    'The secret of getting ahead is getting started.',
    'It always seems impossible until it\'s done.',
    'Push yourself, because no one else is going to do it for you.',
    'Great things never come from comfort zones.',
    'Dream it. Wish it. Do it.',
    'Stay hungry. Stay foolish.',
    'Quality is not an act, it is a habit.',
    'The future depends on what you do today.',
    'Discipline is choosing between what you want now and what you want most.',
    'One hour of focused study beats three hours of distracted reading.',
    'Your only limit is you.'
  ];

  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return DEFAULTS[key] !== undefined ? JSON.parse(JSON.stringify(DEFAULTS[key])) : null;
      return JSON.parse(raw);
    } catch {
      return DEFAULTS[key] !== undefined ? JSON.parse(JSON.stringify(DEFAULTS[key])) : null;
    }
  }

  function set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  function getQuote() {
    const day = new Date().toDateString();
    let idx = get('quoteIndex');
    let storedDay = get('quoteDay');
    if (storedDay !== day) {
      idx = Math.floor(Math.random() * QUOTES.length);
      set('quoteIndex', idx);
      set('quoteDay', day);
    }
    return QUOTES[idx ?? 0];
  }

  function getAllSettings() {
    const keys = Object.keys(DEFAULTS);
    const out = {};
    keys.forEach((k) => { out[k] = get(k); });
    return out;
  }

  function applySettings(settings) {
    Object.entries(settings).forEach(([k, v]) => {
      if (DEFAULTS[k] !== undefined || k.startsWith('sm_') === false) set(k, v);
    });
  }

  return { get, set, getQuote, getAllSettings, applySettings, QUOTES, DEFAULTS };
})();
