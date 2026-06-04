/**
 * Smart Study Plan Generator — algorithmic scheduling
 */
const StudyPlanner = (function () {
  const REVISION_INTERVALS = [1, 3, 7, 15, 30];

  function computeChapterPriority(chapter, subject, weakTopics, examDaysLeft) {
    let score = 0;
    if (!chapter.completionStatus) score += 50;
    score += (chapter.difficulty || 3) * 8;
    score += (6 - (subject.confidence || 3)) * 10;
    score += (subject.difficulty || 3) * 5;
    if (weakTopics.some((w) => chapter.chapterName.toLowerCase().includes(w.toLowerCase()) ||
        subject.name.toLowerCase().includes(w.toLowerCase()))) {
      score += 25;
    }
    if (examDaysLeft !== null && examDaysLeft >= 0) {
      if (examDaysLeft <= 7) score += 40;
      else if (examDaysLeft <= 14) score += 25;
      else if (examDaysLeft <= 30) score += 15;
    }
    score += (subject.priority || 3) * 6;
    if (chapter.revisionCount > 0 && !chapter.completionStatus) score += 10;
    return score;
  }

  function buildWorkQueue(subjects, chapters, weakTopics) {
    const queue = [];
    const today = Utils.formatDate(new Date());

    subjects.filter((s) => !s.archived).forEach((subject) => {
      const subjectChapters = chapters.filter((c) => c.subjectId === subject.id);
      const examDays = subject.examDate ? Utils.daysBetween(today, subject.examDate) : null;

      subjectChapters.forEach((chapter) => {
        if (chapter.completionStatus) return;
        const hours = chapter.estimatedHours || 2;
        const priority = computeChapterPriority(chapter, subject, weakTopics, examDays);
        queue.push({
          chapterId: chapter.id,
          subjectId: subject.id,
          subjectName: subject.name,
          chapterName: chapter.chapterName,
          hours,
          priority,
          type: 'study',
          examDays
        });
      });

      if (examDays !== null && examDays <= 14 && examDays >= 0) {
        queue.push({
          subjectId: subject.id,
          subjectName: subject.name,
          chapterName: `Mock Test: ${subject.name}`,
          hours: 1.5,
          priority: 90 + (14 - examDays),
          type: 'mock',
          examDays
        });
      }
    });

    queue.sort((a, b) => b.priority - a.priority);
    return queue;
  }

  function scheduleRevisionSessions(chapters, subjects, startDate, hoursPerDay) {
    const revisions = [];
    const completed = chapters.filter((c) => c.completionStatus && c.completedAt);

    completed.forEach((chapter) => {
      const subject = subjects.find((s) => s.id === chapter.subjectId);
      if (!subject) return;
      const baseDate = chapter.completedAt || startDate;

      REVISION_INTERVALS.forEach((days) => {
        const revDate = Utils.addDays(baseDate, days);
        revisions.push({
          id: Utils.uid(),
          chapterId: chapter.id,
          subjectId: chapter.subjectId,
          subjectName: subject.name,
          chapterName: `${chapter.chapterName} (${days}-day revision)`,
          date: revDate,
          hours: Math.min(1, (chapter.estimatedHours || 2) * 0.3),
          type: 'revision',
          intervalDays: days,
          completed: false
        });
      });
    });

    return revisions;
  }

  function distributeToDays(queue, startDate, hoursPerDay, numDays = 14) {
    const schedule = {};
    for (let i = 0; i < numDays; i++) {
      schedule[Utils.addDays(startDate, i)] = { tasks: [], totalHours: 0 };
    }

    const dates = Object.keys(schedule).sort();
    let dayIndex = 0;
    const remaining = [...queue];

    while (remaining.length > 0) {
      let placed = false;
      for (let attempt = 0; attempt < dates.length && !placed; attempt++) {
        const date = dates[(dayIndex + attempt) % dates.length];
        const day = schedule[date];
        const task = remaining[0];
        const chunkHours = Math.min(task.hours, hoursPerDay - day.totalHours);

        if (chunkHours <= 0) continue;
        if (day.totalHours + chunkHours > hoursPerDay + 0.01) continue;

        day.tasks.push({
          ...task,
          hours: chunkHours,
          id: Utils.uid(),
          date,
          completed: false,
          missed: false
        });
        day.totalHours += chunkHours;
        task.hours -= chunkHours;
        if (task.hours <= 0.01) remaining.shift();
        placed = true;
        dayIndex = (dates.indexOf(date) + 1) % dates.length;
      }
      if (!placed) {
        const date = dates[dayIndex % dates.length];
        const task = remaining.shift();
        if (task) {
          schedule[date].tasks.push({
            ...task,
            id: Utils.uid(),
            date,
            completed: false,
            missed: false
          });
          schedule[date].totalHours += task.hours;
        }
        dayIndex++;
      }
      if (remaining.length > 0 && !placed && dayIndex > dates.length * 3) break;
    }

    return schedule;
  }

  function generatePlan(subjects, chapters, options) {
    const {
      hoursPerDay = 4,
      startDate = Utils.formatDate(new Date()),
      weakTopics = [],
      strongTopics = []
    } = options;

    const weak = Array.isArray(weakTopics) ? weakTopics :
      String(weakTopics).split(',').map((s) => s.trim()).filter(Boolean);
    const strong = Array.isArray(strongTopics) ? strongTopics :
      String(strongTopics).split(',').map((s) => s.trim()).filter(Boolean);

    const queue = buildWorkQueue(subjects, chapters, weak);
    strong.forEach((topic) => {
      queue.forEach((item) => {
        if (item.chapterName && item.chapterName.toLowerCase().includes(topic.toLowerCase())) {
          item.priority = Math.max(0, item.priority - 15);
        }
      });
    });
    queue.sort((a, b) => b.priority - a.priority);

    const schedule = distributeToDays(queue, startDate, hoursPerDay, 21);
    const revisionTasks = scheduleRevisionSessions(chapters, subjects, startDate, hoursPerDay);

    revisionTasks.forEach((rev) => {
      if (schedule[rev.date]) {
        if (schedule[rev.date].totalHours + rev.hours <= hoursPerDay) {
          schedule[rev.date].tasks.push({ ...rev, id: rev.id });
          schedule[rev.date].totalHours += rev.hours;
        } else {
          const nextDate = Utils.addDays(rev.date, 1);
          if (!schedule[nextDate]) schedule[nextDate] = { tasks: [], totalHours: 0 };
          schedule[nextDate].tasks.push({ ...rev, id: rev.id, date: nextDate });
          schedule[nextDate].totalHours += rev.hours;
        }
      }
    });

    return { schedule, queue };
  }

  function flattenScheduleToTasks(schedule) {
    const tasks = [];
    Object.entries(schedule).forEach(([date, day]) => {
      day.tasks.forEach((t) => {
        tasks.push({ ...t, date });
      });
    });
    return tasks;
  }

  function redistributeMissed(tasks, hoursPerDay) {
    const missed = tasks.filter((t) => t.missed && !t.completed);
    if (!missed.length) return tasks;

    const updated = tasks.map((t) => ({ ...t }));
    const today = Utils.formatDate(new Date());
    let dayOffset = 0;

    missed.forEach((task) => {
      const idx = updated.findIndex((t) => t.id === task.id);
      if (idx >= 0) updated[idx].rescheduled = true;

      let newDate = Utils.addDays(today, dayOffset + 1);
      while (updated.filter((t) => t.date === newDate).reduce((s, t) => s + (t.hours || 1), 0) >= hoursPerDay) {
        dayOffset++;
        newDate = Utils.addDays(today, dayOffset + 1);
      }

      updated.push({
        ...task,
        id: Utils.uid(),
        date: newDate,
        missed: false,
        priority: (task.priority || 50) + 20,
        rescheduledFrom: task.id
      });
      dayOffset++;
    });

    return updated;
  }

  function markMissedSessions(tasks) {
    const today = Utils.formatDate(new Date());
    return tasks.map((t) => {
      if (!t.completed && t.date < today && t.type !== 'exam') {
        return { ...t, missed: true };
      }
      return t;
    });
  }

  function getScheduleStats(schedule) {
    let totalTasks = 0;
    let totalHours = 0;
    Object.values(schedule).forEach((day) => {
      totalTasks += day.tasks.length;
      totalHours += day.totalHours;
    });
    return { totalTasks, totalHours };
  }

  return {
    REVISION_INTERVALS,
    generatePlan,
    flattenScheduleToTasks,
    redistributeMissed,
    markMissedSessions,
    buildWorkQueue,
    scheduleRevisionSessions,
    getScheduleStats
  };
})();
