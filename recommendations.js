/**
 * Rule-based AI recommendation engine
 */
const Recommendations = (function () {
  function generate(context) {
    const {
      subjects = [],
      chapters = [],
      tasks = [],
      readiness = 0,
      streak = 0,
      focusStats = {},
      hoursPerDay = 4,
      weakTopics = ''
    } = context;

    const recs = [];
    const today = Utils.formatDate(new Date());
    const weak = String(weakTopics).split(',').map((s) => s.trim()).filter(Boolean);

    subjects.filter((s) => !s.archived).forEach((subject) => {
      const examDays = subject.examDate ? Utils.daysBetween(today, subject.examDate) : null;
      const subChapters = chapters.filter((c) => c.subjectId === subject.id);
      const completed = subChapters.filter((c) => c.completionStatus).length;
      const total = subChapters.length;
      const subReadiness = total ? (completed / total) * 100 : 0;

      if (examDays !== null && examDays >= 0 && examDays < 7 && subReadiness < 70) {
        recs.push({
          priority: 100,
          text: `${subject.name}: Exam in ${examDays} day(s) with ${Math.round(subReadiness)}% chapter completion. Focus on revision and mock tests.`
        });
      }

      if ((subject.confidence || 3) < 2.5 || (subject.confidence && subject.confidence < 40 && subject.confidence <= 5)) {
        const conf = subject.confidence <= 5 ? subject.confidence * 20 : subject.confidence;
        if (conf < 40) {
          recs.push({
            priority: 85,
            text: `Low confidence in ${subject.name} (${conf}%). Increase study frequency and break chapters into smaller sessions.`
          });
        }
      }

      if (examDays !== null && examDays > 7 && examDays <= 21 && subReadiness < 50) {
        recs.push({
          priority: 75,
          text: `${subject.name}: ${examDays} days until exam. Accelerate incomplete chapters — aim for 2+ hours daily.`
        });
      }
    });

    const missed = tasks.filter((t) => t.missed && !t.completed);
    if (missed.length >= 3) {
      recs.push({
        priority: 90,
        text: `You have ${missed.length} missed sessions. Run "Regenerate Plan" to redistribute workload and avoid overload.`
      });
    }

    if (readiness < 50 && subjects.some((s) => s.examDate && Utils.daysBetween(today, s.examDate) <= 30)) {
      recs.push({
        priority: 80,
        text: 'Overall exam readiness is below 50%. Prioritize high-weight chapters and complete at least one revision cycle per topic.'
      });
    }

    if (streak === 0) {
      recs.push({
        priority: 60,
        text: 'Start a study streak today! Even 25 minutes of focused study builds momentum.'
      });
    } else if (streak >= 7) {
      recs.push({
        priority: 40,
        text: `Great ${streak}-day streak! Consider a mock test to validate retention.`
      });
    }

    const todayHours = tasks.filter((t) => t.date === today).reduce((s, t) => s + (t.hours || 0), 0);
    if (todayHours > hoursPerDay * 1.2) {
      recs.push({
        priority: 70,
        text: "Today's plan exceeds your daily capacity. Spread tasks across the week for sustainable progress."
      });
    }

    if ((focusStats.totalMinutes || 0) < 60 && subjects.length > 0) {
      recs.push({
        priority: 55,
        text: 'Use Focus Mode with Pomodoro sessions to build deep work habits.'
      });
    }

    weak.forEach((topic) => {
      const match = chapters.find((c) => !c.completionStatus &&
        c.chapterName.toLowerCase().includes(topic.toLowerCase()));
      if (match) {
        const sub = subjects.find((s) => s.id === match.subjectId);
        recs.push({
          priority: 88,
          text: `Weak topic alert: Review "${match.chapterName}"${sub ? ` (${sub.name})` : ''} with extra revision sessions.`
        });
      }
    });

    const overloadedDays = {};
    tasks.forEach((t) => {
      overloadedDays[t.date] = (overloadedDays[t.date] || 0) + (t.hours || 0);
    });
    Object.entries(overloadedDays).forEach(([date, hrs]) => {
      if (hrs > hoursPerDay * 1.15 && date >= today) {
        recs.push({
          priority: 65,
          text: `${date}: Scheduled ${hrs.toFixed(1)}h exceeds your ${hoursPerDay}h daily limit. Rebalance this day.`
        });
      }
    });

    if (!recs.length) {
      recs.push({
        priority: 30,
        text: 'You\'re on track! Maintain consistency and complete scheduled revision sessions.'
      });
    }

    return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }

  return { generate };
})();
