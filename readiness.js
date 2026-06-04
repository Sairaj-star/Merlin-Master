/**
 * Exam Readiness Predictor
 */
const Readiness = (function () {
  function calculate(subjects, chapters, tasks, mockScores = []) {
    const activeSubjects = subjects.filter((s) => !s.archived);
    if (!activeSubjects.length) {
      return {
        score: 0,
        explanations: ['Add subjects and chapters to calculate exam readiness.']
      };
    }

    let totalWeight = 0;
    let weightedScore = 0;
    const explanations = [];
    const today = Utils.formatDate(new Date());

    activeSubjects.forEach((subject) => {
      const subChapters = chapters.filter((c) => c.subjectId === subject.id);
      const total = subChapters.length || 1;
      const completed = subChapters.filter((c) => c.completionStatus).length;
      const chapterPct = (completed / total) * 100;

      const avgRevisions = subChapters.length
        ? subChapters.reduce((s, c) => s + (c.revisionCount || 0), 0) / subChapters.length
        : 0;
      const revisionScore = Math.min(100, avgRevisions * 25);

      const conf = subject.confidence <= 5
        ? (subject.confidence / 5) * 100
        : Utils.clamp(subject.confidence, 0, 100);

      const subjectMocks = mockScores.filter((m) => m.subjectId === subject.id);
      const mockScore = subjectMocks.length
        ? subjectMocks.reduce((s, m) => s + m.score, 0) / subjectMocks.length
        : 50;

      const examDays = subject.examDate ? Utils.daysBetween(today, subject.examDate) : 90;
      let timeFactor = 100;
      if (examDays >= 0 && examDays < 30) {
        const expectedProgress = ((30 - examDays) / 30) * 100;
        timeFactor = chapterPct >= expectedProgress ? 100 : (chapterPct / Math.max(expectedProgress, 1)) * 100;
      }

      const subjectScore =
        chapterPct * 0.4 +
        revisionScore * 0.2 +
        conf * 0.15 +
        mockScore * 0.15 +
        timeFactor * 0.1;

      const weight = (subject.priority || 3) + (examDays >= 0 && examDays <= 14 ? 2 : 0);
      totalWeight += weight;
      weightedScore += subjectScore * weight;

      if (chapterPct < 70 && examDays >= 0 && examDays <= 14) {
        explanations.push(`${subject.name}: Only ${Math.round(chapterPct)}% chapters done with ${examDays} days left.`);
      }
      if (conf < 50) {
        explanations.push(`${subject.name}: Confidence is low — more practice needed.`);
      }
      if (avgRevisions < 1 && completed > 0) {
        explanations.push(`${subject.name}: Schedule revision sessions for completed chapters.`);
      }
    });

    const completedTasks = tasks.filter((t) => t.completed).length;
    const totalTasks = tasks.length || 1;
    const taskBonus = (completedTasks / totalTasks) * 10;

    const score = Utils.clamp(Math.round(weightedScore / totalWeight + taskBonus), 0, 100);

    if (score >= 80) {
      explanations.unshift('Strong overall readiness. Focus on mock tests and weak spots.');
    } else if (score >= 60) {
      explanations.unshift('Moderate readiness. Increase revision frequency before exams.');
    } else {
      explanations.unshift('Readiness needs improvement. Prioritize incomplete chapters and daily study.');
    }

    return { score, explanations: explanations.slice(0, 6) };
  }

  function predictCurve(subjects, chapters, daysAhead = 30) {
    const points = [];
    const today = Utils.formatDate(new Date());
    let simulated = JSON.parse(JSON.stringify(chapters));

    for (let i = 0; i <= daysAhead; i++) {
      const date = Utils.addDays(today, i);
      const dailyRate = 0.03 + (i * 0.001);
      simulated = simulated.map((c) => {
        if (!c.completionStatus && Math.random() < dailyRate) {
          return { ...c, completionStatus: true };
        }
        return c;
      });
      const result = calculate(subjects, simulated, [], []);
      points.push({ date, score: result.score });
    }
    return points;
  }

  return { calculate, predictCurve };
})();
