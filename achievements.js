/**
 * Achievements & Streak System
 */
const Achievements = (function () {
  const DEFINITIONS = [
    { id: 'first_session', title: 'First Study Session', desc: 'Complete your first focus session', icon: '🎯' },
    { id: 'streak_7', title: '7-Day Streak', desc: 'Study 7 days in a row', icon: '🔥' },
    { id: 'streak_30', title: '30-Day Streak', desc: 'Study 30 days in a row', icon: '💎' },
    { id: 'hours_100', title: '100 Hours Studied', desc: 'Log 100 hours of study time', icon: '⏱' },
    { id: 'subject_master', title: 'Subject Master', desc: 'Complete all chapters in a subject', icon: '📚' },
    { id: 'exam_ready', title: 'Exam Ready', desc: 'Reach 85% exam readiness', icon: '🏆' },
    { id: 'pomodoro_10', title: 'Focus Warrior', desc: 'Complete 10 Pomodoro sessions', icon: '⚡' },
    { id: 'notes_10', title: 'Knowledge Keeper', desc: 'Create 10 study notes', icon: '📝' },
    { id: 'plan_generated', title: 'Strategic Planner', desc: 'Generate your first study plan', icon: '📋' },
    { id: 'chapter_50', title: 'Chapter Champion', desc: 'Complete 50 chapters', icon: '✅' }
  ];

  function check(context, unlockedIds) {
    const newly = [];
    const {
      focusStats = {},
      streak = {},
      studyLogs = [],
      subjects = [],
      chapters = [],
      notes = [],
      readiness = 0,
      planGenerated = false
    } = context;

    const totalHours = studyLogs.reduce((s, l) => s + (l.minutes || 0), 0) / 60;
    const pomodoroCount = (focusStats.sessions || []).length;
    const completedChapters = chapters.filter((c) => c.completionStatus).length;

    const checks = [
      { id: 'first_session', cond: pomodoroCount >= 1 || totalHours > 0.1 },
      { id: 'streak_7', cond: (streak.current || 0) >= 7 },
      { id: 'streak_30', cond: (streak.current || 0) >= 30 },
      { id: 'hours_100', cond: totalHours >= 100 },
      { id: 'subject_master', cond: subjects.some((s) => {
        const ch = chapters.filter((c) => c.subjectId === s.id);
        return ch.length > 0 && ch.every((c) => c.completionStatus);
      }) },
      { id: 'exam_ready', cond: readiness >= 85 },
      { id: 'pomodoro_10', cond: pomodoroCount >= 10 },
      { id: 'notes_10', cond: notes.length >= 10 },
      { id: 'plan_generated', cond: planGenerated },
      { id: 'chapter_50', cond: completedChapters >= 50 }
    ];

    checks.forEach(({ id, cond }) => {
      if (cond && !unlockedIds.includes(id)) newly.push(id);
    });

    return newly;
  }

  function updateStreak(streakData) {
    const today = Utils.formatDate(new Date());
    const last = streakData.lastStudyDate;
    let current = streakData.current || 0;

    if (last === today) return streakData;

    if (last) {
      const daysSince = Utils.daysBetween(last, today);
      if (daysSince === 1) {
        current += 1;
      } else if (daysSince > 1) {
        current = 1;
      }
    } else {
      current = 1;
    }

    const longest = Math.max(streakData.longest || 0, current);
    const weekStart = Utils.getWeekStart(today);
    let weekly = streakData.weekly || 0;
    if (last && Utils.getWeekStart(last) === weekStart) weekly++;
    else weekly = 1;

    const month = today.slice(0, 7);
    let monthly = streakData.monthly || 0;
    if (streakData.lastMonth === month) monthly++;
    else monthly = 1;

    return {
      current,
      longest,
      lastStudyDate: today,
      weekly,
      monthly,
      lastMonth: month
    };
  }

  function getProductivityScore(studyLogs, tasks, streak, focusStats) {
    const weekMins = studyLogs.filter((l) => {
      const d = Utils.parseDate(l.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }).reduce((s, l) => s + (l.minutes || 0), 0);

    const taskRate = tasks.length
      ? tasks.filter((t) => t.completed).length / tasks.length
      : 0;

    const score = Math.round(
      Math.min(40, weekMins / 3) +
      taskRate * 30 +
      Math.min(20, (streak.current || 0) * 2) +
      Math.min(10, (focusStats.sessions || []).length)
    );

    return Utils.clamp(score, 0, 100);
  }

  function detectBurnout(studyLogs, hoursPerDay) {
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = Utils.addDays(Utils.formatDate(new Date()), -i);
      const mins = studyLogs.filter((l) => l.date === d).reduce((s, l) => s + (l.minutes || 0), 0);
      last7.push(mins / 60);
    }
    const avg = last7.reduce((a, b) => a + b, 0) / 7;
    const overloadDays = last7.filter((h) => h > hoursPerDay * 1.3).length;

    if (overloadDays >= 4 && avg > hoursPerDay) {
      return {
        burnedOut: true,
        message: 'You\'ve been studying above your daily limit for several days.',
        breakRec: 'Take a 15–30 minute break. Consider reducing tomorrow\'s plan by 20%.'
      };
    }
    if (last7.every((h) => h > 0) && avg > hoursPerDay * 1.1) {
      return {
        burnedOut: true,
        message: 'Consistent high workload detected — watch for fatigue.',
        breakRec: 'Try a 5-minute walk or light stretching between sessions.'
      };
    }
    return { burnedOut: false };
  }

  return {
    DEFINITIONS,
    check,
    updateStreak,
    getProductivityScore,
    detectBurnout
  };
})();
