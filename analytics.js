/**
 * Canvas chart rendering with smooth animations
 */
const StudyAnalytics = (function () {
  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      primary: style.getPropertyValue('--primary').trim() || '#6c5ce7',
      accent: style.getPropertyValue('--accent').trim() || '#00cec9',
      accent2: style.getPropertyValue('--accent-2').trim() || '#fd79a8',
      muted: style.getPropertyValue('--text-muted').trim() || '#8b92a8',
      track: style.getPropertyValue('--ring-track').trim() || 'rgba(255,255,255,0.06)'
    };
  }

  function animateValue(from, to, duration, onFrame) {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      onFrame(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function drawLineChart(canvas, labels, datasets, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    const colors = getThemeColors();

    let progress = 0;
    animateValue(0, 1, 1200, (p) => {
      progress = p;
      ctx.clearRect(0, 0, w, h);

      const maxVal = Math.max(...datasets.flatMap((d) => d.data), 1) * 1.1;
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;

      ctx.strokeStyle = colors.track;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
      }

      datasets.forEach((ds, di) => {
        const color = ds.color || [colors.primary, colors.accent, colors.accent2][di % 3];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        ds.data.forEach((val, i) => {
          const x = pad.left + (chartW / Math.max(labels.length - 1, 1)) * i;
          const y = pad.top + chartH - (val / maxVal) * chartH * progress;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.lineTo(pad.left + chartW, pad.top + chartH);
        ctx.lineTo(pad.left, pad.top + chartH);
        ctx.closePath();
        ctx.fillStyle = color + '22';
        ctx.fill();
      });

      ctx.fillStyle = colors.muted;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      labels.forEach((lbl, i) => {
        if (i % Math.ceil(labels.length / 7) !== 0 && i !== labels.length - 1) return;
        const x = pad.left + (chartW / Math.max(labels.length - 1, 1)) * i;
        ctx.fillText(lbl, x, h - 8);
      });
    });
  }

  function drawBarChart(canvas, labels, data, color) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 15, bottom: 30, left: 40 };
    const colors = getThemeColors();
    const barColor = color || colors.primary;
    const maxVal = Math.max(...data, 1) * 1.15;

    let progress = 0;
    animateValue(0, 1, 1000, (p) => {
      progress = p;
      ctx.clearRect(0, 0, w, h);
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;
      const barW = chartW / data.length * 0.65;
      const gap = chartW / data.length;

      data.forEach((val, i) => {
        const barH = (val / maxVal) * chartH * progress;
        const x = pad.left + gap * i + (gap - barW) / 2;
        const y = pad.top + chartH - barH;
        const grad = ctx.createLinearGradient(0, y, 0, pad.top + chartH);
        grad.addColorStop(0, barColor);
        grad.addColorStop(1, barColor + '66');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);
      });

      ctx.fillStyle = colors.muted;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      labels.forEach((lbl, i) => {
        const x = pad.left + gap * i + gap / 2;
        ctx.fillText(lbl, x, h - 8);
      });
    });
  }

  function drawHeatmap(canvas, studyLogs) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const colors = getThemeColors();
    const weeks = 12;
    const days = 7;
    const cellW = (w - 20) / weeks;
    const cellH = (h - 10) / days;

    const byDate = {};
    studyLogs.forEach((log) => {
      byDate[log.date] = (byDate[log.date] || 0) + (log.minutes || 0);
    });

    const today = new Date();
    ctx.clearRect(0, 0, w, h);

    for (let wk = 0; wk < weeks; wk++) {
      for (let d = 0; d < days; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (weeks - 1 - wk) * 7 - (6 - d));
        const key = Utils.formatDate(date);
        const mins = byDate[key] || 0;
        const intensity = Math.min(1, mins / 120);
        const r = parseInt(intensity * 108 + 20);
        const g = parseInt(intensity * 92 + 20);
        const b = parseInt(intensity * 231 + 30);
        ctx.fillStyle = mins > 0 ? `rgba(${r},${g},${b},${0.3 + intensity * 0.7})` : colors.track;
        ctx.fillRect(10 + wk * cellW, 5 + d * cellH, cellW - 2, cellH - 2);
      }
    }
  }

  function buildDailyData(studyLogs, days = 14) {
    const labels = [];
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = Utils.formatDate(d);
      labels.push(key.slice(5));
      const mins = studyLogs.filter((l) => l.date === key).reduce((s, l) => s + (l.minutes || 0), 0);
      data.push(mins / 60);
    }
    return { labels, data };
  }

  function buildWeeklyData(studyLogs) {
    const labels = [];
    const data = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date();
      start.setDate(start.getDate() - w * 7 - 6);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      labels.push(`W${4 - w}`);
      const mins = studyLogs.filter((l) => {
        const d = Utils.parseDate(l.date);
        return d >= start && d <= end;
      }).reduce((s, l) => s + (l.minutes || 0), 0);
      data.push(mins / 60);
    }
    return { labels, data };
  }

  function buildSubjectComparison(subjects, chapters, studyLogs) {
    return subjects.filter((s) => !s.archived).map((s) => {
      const mins = studyLogs.filter((l) => l.subjectId === s.id).reduce((a, l) => a + (l.minutes || 0), 0);
      const ch = chapters.filter((c) => c.subjectId === s.id);
      const done = ch.filter((c) => c.completionStatus).length;
      return {
        name: s.name.slice(0, 8),
        hours: mins / 60,
        completion: ch.length ? (done / ch.length) * 100 : 0
      };
    });
  }

  function renderAll(subjects, chapters, studyLogs, tasks, readinessScore) {
    const daily = buildDailyData(studyLogs);
    drawLineChart(
      document.getElementById('chart-daily'),
      daily.labels,
      [{ data: daily.data, color: getThemeColors().primary }]
    );

    const weekly = buildWeeklyData(studyLogs);
    drawBarChart(document.getElementById('chart-weekly'), weekly.labels, weekly.data);

    const subComp = buildSubjectComparison(subjects, chapters, studyLogs);
    drawBarChart(
      document.getElementById('chart-subjects'),
      subComp.map((s) => s.name),
      subComp.map((s) => s.hours),
      getThemeColors().accent
    );

    const completionTrend = [];
    const compLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      compLabels.push(Utils.formatDate(d).slice(5));
      const done = chapters.filter((c) => c.completionStatus && c.completedAt && c.completedAt <= Utils.formatDate(d)).length;
      completionTrend.push(chapters.length ? (done / chapters.length) * 100 : 0);
    }
    drawLineChart(
      document.getElementById('chart-completion'),
      compLabels,
      [{ data: completionTrend, color: getThemeColors().accent2 }]
    );

    const curve = Readiness.predictCurve(subjects, chapters, 20);
    drawLineChart(
      document.getElementById('chart-readiness'),
      curve.map((p) => p.date.slice(5)),
      [{ data: curve.map((p) => p.score), color: getThemeColors().accent }]
    );

    drawHeatmap(document.getElementById('heatmap-canvas'), studyLogs);
  }

  function generateWeeklyReport(studyLogs, tasks, focusStats) {
    const weekMins = studyLogs.slice(-7).reduce((s, l) => s + (l.minutes || 0), 0);
    const completed = tasks.filter((t) => t.completed).length;
    return `
      <div class="report-stat"><span>Study time</span><strong>${Utils.formatMinutes(weekMins)}</strong></div>
      <div class="report-stat"><span>Tasks completed</span><strong>${completed}</strong></div>
      <div class="report-stat"><span>Focus sessions</span><strong>${(focusStats.sessions || []).length}</strong></div>
      <div class="report-stat"><span>Longest focus</span><strong>${Utils.formatMinutes(focusStats.longestSession || 0)}</strong></div>
    `;
  }

  function generateMonthlyReport(studyLogs, subjects, chapters) {
    const monthMins = studyLogs.reduce((s, l) => s + (l.minutes || 0), 0);
    const done = chapters.filter((c) => c.completionStatus).length;
    return `
      <div class="report-stat"><span>Total study time</span><strong>${Utils.formatHours(monthMins / 60)}</strong></div>
      <div class="report-stat"><span>Chapters completed</span><strong>${done} / ${chapters.length}</strong></div>
      <div class="report-stat"><span>Active subjects</span><strong>${subjects.filter((s) => !s.archived).length}</strong></div>
    `;
  }

  return {
    renderAll,
    drawHeatmap,
    generateWeeklyReport,
    generateMonthlyReport,
    buildDailyData
  };
})();
