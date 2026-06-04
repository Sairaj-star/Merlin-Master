/**
 * StudyMaster AI — Main Application
 */
const App = (function () {
  let state = {
    subjects: [],
    chapters: [],
    tasks: [],
    notes: [],
    studyLogs: [],
    habits: [],
    goals: [],
    mockScores: [],
    subjectFilter: 'active',
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    noteTagFilter: null,
    planGenerated: false
  };

  let saveTimer = null;

  async function loadAll() {
    await StudyDB.open();
    state.subjects = await StudyDB.getAll(StudyDB.STORES.subjects);
    state.chapters = await StudyDB.getAll(StudyDB.STORES.chapters);
    state.tasks = await StudyDB.getAll(StudyDB.STORES.tasks);
    state.notes = await StudyDB.getAll(StudyDB.STORES.notes);
    state.studyLogs = await StudyDB.getAll(StudyDB.STORES.studyLogs);
    state.habits = await StudyDB.getAll(StudyDB.STORES.habits);
    state.goals = await StudyDB.getAll(StudyDB.STORES.goals);
    state.mockScores = await StudyDB.getAll(StudyDB.STORES.mockScores);
    state.planGenerated = state.tasks.length > 0;

    const hours = StudyStore.get('hoursPerDay');
    document.getElementById('hours-per-day').value = hours;
    document.getElementById('weak-topics').value = StudyStore.get('weakTopics') || '';
    document.getElementById('strong-topics').value = StudyStore.get('strongTopics') || '';
    const planStart = StudyStore.get('planStartDate') || Utils.formatDate(new Date());
    document.getElementById('plan-start-date').value = planStart;

    applySettingsToUI();
    state.tasks = StudyPlanner.markMissedSessions(state.tasks);
    await refresh();
  }

  function applySettingsToUI() {
    UI.applyTheme(StudyStore.get('theme') || 'dark');
    document.getElementById('setting-theme').value = StudyStore.get('theme') || 'dark';
    document.getElementById('setting-focus-min').value = StudyStore.get('focusMinutes') || 25;
    document.getElementById('setting-break-min').value = StudyStore.get('breakMinutes') || 5;
    document.getElementById('setting-long-break').value = StudyStore.get('longBreakMinutes') || 15;
    renderDailyScheduleInputs();
    document.getElementById('motivation-quote').textContent = `"${StudyStore.getQuote()}"`;
  }

  function renderDailyScheduleInputs() {
    const schedule = StudyStore.get('dailySchedule') || {};
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const container = document.getElementById('daily-schedule-inputs');
    container.innerHTML = days.map((d) => {
      const s = schedule[d] || { start: '09:00', end: '17:00' };
      return `
        <label class="setting-row">
          <span>${d.charAt(0).toUpperCase() + d.slice(1)}</span>
          <span>
            <input type="time" data-day="${d}" data-field="start" value="${s.start}" style="max-width:90px">
            –
            <input type="time" data-day="${d}" data-field="end" value="${s.end}" style="max-width:90px">
          </span>
        </label>
      `;
    }).join('');
  }

  function computeStats() {
    const active = state.subjects.filter((s) => !s.archived);
    const totalChapters = state.chapters.filter((c) => active.some((s) => s.id === c.subjectId)).length;
    const completed = state.chapters.filter((c) => c.completionStatus && active.some((s) => s.id === c.subjectId)).length;
    const studyHours = state.studyLogs.reduce((s, l) => s + (l.minutes || 0), 0) / 60;
    const readiness = Readiness.calculate(active, state.chapters, state.tasks, state.mockScores);
    return {
      totalSubjects: active.length,
      totalChapters,
      completedChapters: completed,
      remainingChapters: totalChapters - completed,
      totalStudyHours: studyHours,
      completionPct: totalChapters ? Math.round((completed / totalChapters) * 100) : 0,
      readiness: readiness.score,
      readinessDetails: readiness.explanations
    };
  }

  function getProgressRings(stats) {
    const today = Utils.formatDate(new Date());
    const weekStart = Utils.getWeekStart(today);
    const weekTasks = state.tasks.filter((t) => t.date >= weekStart && t.date <= today);
    const weekDone = weekTasks.filter((t) => t.completed).length;
    const weekPct = weekTasks.length ? (weekDone / weekTasks.length) * 100 : 0;

    const month = today.slice(0, 7);
    const monthLogs = state.studyLogs.filter((l) => l.date.startsWith(month));
    const monthTarget = (StudyStore.get('hoursPerDay') || 4) * 30;
    const monthHours = monthLogs.reduce((s, l) => s + l.minutes, 0) / 60;
    const monthPct = Math.min(100, (monthHours / monthTarget) * 100);

    const subjectProgress = state.subjects.filter((s) => !s.archived).map((s) => {
      const ch = state.chapters.filter((c) => c.subjectId === s.id);
      return ch.length ? (ch.filter((c) => c.completionStatus).length / ch.length) * 100 : 0;
    });
    const avgSubject = subjectProgress.length
      ? subjectProgress.reduce((a, b) => a + b, 0) / subjectProgress.length
      : 0;

    return [
      { label: 'Overall Progress', percent: stats.completionPct },
      { label: 'Weekly Progress', percent: weekPct },
      { label: 'Monthly Progress', percent: monthPct },
      { label: 'Subject Progress', percent: avgSubject }
    ];
  }

  async function refresh() {
    const stats = computeStats();
    UI.renderStats(stats);
    UI.renderRings(getProgressRings(stats));

    document.getElementById('readiness-score').textContent = stats.readiness;
    document.getElementById('readiness-details').innerHTML =
      stats.readinessDetails.map((e) => `<li>${Utils.escapeHtml(e)}</li>`).join('');

    renderTodayTasks();
    renderSubjects();
    renderWeeklyPlan();
    renderCalendar();
    renderNotes();
    renderHabits();
    renderFocusStats();
    populateSubjectSelect();

    const streak = StudyStore.get('streak') || {};
    UI.renderStreakShowcase(streak);

    const unlocked = StudyStore.get('unlockedAchievements') || [];
    UI.renderAchievements(unlocked);

    const recs = Recommendations.generate({
      subjects: state.subjects,
      chapters: state.chapters,
      tasks: state.tasks,
      readiness: stats.readiness,
      streak: streak.current,
      focusStats: StudyStore.get('focusStats'),
      hoursPerDay: StudyStore.get('hoursPerDay') || 4,
      weakTopics: StudyStore.get('weakTopics')
    });
    UI.renderRecommendations(recs);

    const prod = Achievements.getProductivityScore(
      state.studyLogs, state.tasks, streak, StudyStore.get('focusStats')
    );
    document.getElementById('productivity-score').textContent = `Score ${prod}`;

    const burnout = Achievements.detectBurnout(state.studyLogs, StudyStore.get('hoursPerDay') || 4);
    const burnoutCard = document.getElementById('burnout-card');
    if (burnout.burnedOut) {
      burnoutCard.classList.remove('hidden');
      document.getElementById('burnout-message').textContent = burnout.message;
      document.getElementById('break-recommendation').textContent = burnout.breakRec;
    } else burnoutCard.classList.add('hidden');

    checkAchievements(stats.readiness);

    if (document.getElementById('view-analytics').classList.contains('active')) {
      StudyAnalytics.renderAll(
        state.subjects, state.chapters, state.studyLogs, state.tasks, stats.readiness
      );
      document.getElementById('weekly-report').innerHTML = StudyAnalytics.generateWeeklyReport(
        state.studyLogs, state.tasks, StudyStore.get('focusStats')
      );
      document.getElementById('monthly-report').innerHTML = StudyAnalytics.generateMonthlyReport(
        state.studyLogs, state.subjects, state.chapters
      );
    }

    StudyAnalytics.drawHeatmap(document.getElementById('heatmap-canvas'), state.studyLogs);
  }

  function renderTodayTasks() {
    const today = Utils.formatDate(new Date());
    const tasks = state.tasks.filter((t) => t.date === today).slice(0, 8);
    const el = document.getElementById('today-tasks');
    if (!tasks.length) {
      el.innerHTML = '<li style="color:var(--text-muted)">No tasks scheduled. Generate a study plan.</li>';
      return;
    }
    el.innerHTML = tasks.map((t) => `
      <li>
        <span>
          <input type="checkbox" data-task-id="${t.id}" ${t.completed ? 'checked' : ''}>
          ${Utils.escapeHtml(t.chapterName || t.subjectName || 'Task')}
        </span>
        <span class="task-type ${t.type || 'study'}">${t.type || 'study'}</span>
      </li>
    `).join('');
    el.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => toggleTask(cb.dataset.taskId, cb.checked));
    });
  }

  async function toggleTask(id, completed) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = completed;
    if (completed) {
      const log = {
        id: Utils.uid(),
        date: Utils.formatDate(new Date()),
        minutes: Math.round((task.hours || 1) * 60),
        subjectId: task.subjectId,
        chapterId: task.chapterId,
        type: task.type
      };
      state.studyLogs.push(log);
      await StudyDB.put(StudyDB.STORES.studyLogs, log);
      const streak = Achievements.updateStreak(StudyStore.get('streak') || {});
      StudyStore.set('streak', streak);
    }
    await StudyDB.put(StudyDB.STORES.tasks, task);
    autoSave();
    await refresh();
  }

  function renderSubjects() {
    const grid = document.getElementById('subjects-grid');
    const filtered = state.subjects.filter((s) =>
      state.subjectFilter === 'archived' ? s.archived : !s.archived
    );

    if (!filtered.length) {
      grid.innerHTML = '<p style="color:var(--text-muted)">No subjects yet. Add your first subject to get started.</p>';
      return;
    }

    grid.innerHTML = filtered.map((subject) => {
      const chapters = state.chapters.filter((c) => c.subjectId === subject.id);
      const done = chapters.filter((c) => c.completionStatus).length;
      const pct = chapters.length ? (done / chapters.length) * 100 : 0;
      const examLabel = subject.examDate
        ? `Exam: ${subject.examDate} (${Utils.daysBetween(Utils.formatDate(new Date()), subject.examDate)}d)`
        : 'No exam date';

      return `
        <div class="subject-card ${subject.archived ? 'archived' : ''}" data-subject-id="${subject.id}">
          <div class="subject-header">
            <h3>${Utils.escapeHtml(subject.name)}</h3>
            <span style="font-size:0.75rem;color:var(--accent)">P${subject.priority || 3}</span>
          </div>
          <div class="subject-meta">
            Difficulty: ${subject.difficulty || 3}/5 · Confidence: ${subject.confidence || 3}/5<br>
            ${examLabel}
          </div>
          <div class="subject-progress"><div class="subject-progress-bar" style="width:${pct}%"></div></div>
          <ul class="chapters-list" data-subject-id="${subject.id}">
            ${chapters.map((ch) => `
              <li class="chapter-item ${ch.completionStatus ? 'done' : ''}" draggable="true" data-chapter-id="${ch.id}">
                <input type="checkbox" ${ch.completionStatus ? 'checked' : ''} data-chapter-check="${ch.id}">
                <span>${Utils.escapeHtml(ch.chapterName)}</span>
                <small style="margin-left:auto;color:var(--text-muted)">${ch.estimatedHours || 2}h · Rev:${ch.revisionCount || 0}</small>
              </li>
            `).join('')}
          </ul>
          <div class="subject-actions">
            <button class="btn btn-ghost btn-sm" data-action="add-chapter" data-id="${subject.id}">+ Chapter</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${subject.id}">Edit</button>
            ${subject.archived
              ? `<button class="btn btn-ghost btn-sm" data-action="unarchive" data-id="${subject.id}">Restore</button>`
              : `<button class="btn btn-ghost btn-sm" data-action="archive" data-id="${subject.id}">Archive</button>`}
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${subject.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleSubjectAction(btn.dataset.action, btn.dataset.id));
    });

    grid.querySelectorAll('[data-chapter-check]').forEach((cb) => {
      cb.addEventListener('change', () => toggleChapter(cb.dataset.chapterCheck, cb.checked));
    });

    initChapterDragDrop();
  }

  function initChapterDragDrop() {
    let draggedId = null;
    document.querySelectorAll('.chapter-item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        draggedId = item.dataset.chapterId;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (e) => e.preventDefault());
      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetId = item.dataset.chapterId;
        if (!draggedId || draggedId === targetId) return;
        const subjectId = item.closest('.chapters-list').dataset.subjectId;
        const chapters = state.chapters.filter((c) => c.subjectId === subjectId);
        const fromIdx = chapters.findIndex((c) => c.id === draggedId);
        const toIdx = chapters.findIndex((c) => c.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return;
        const [moved] = chapters.splice(fromIdx, 1);
        chapters.splice(toIdx, 0, moved);
        chapters.forEach((c, i) => { c.sortOrder = i; });
        await StudyDB.putMany(StudyDB.STORES.chapters, chapters);
        state.chapters = await StudyDB.getAll(StudyDB.STORES.chapters);
        renderSubjects();
      });
    });
  }

  async function toggleChapter(id, completed) {
    const ch = state.chapters.find((c) => c.id === id);
    if (!ch) return;
    ch.completionStatus = completed;
    ch.completedAt = completed ? Utils.formatDate(new Date()) : null;
    if (completed) ch.revisionCount = (ch.revisionCount || 0);
    await StudyDB.put(StudyDB.STORES.chapters, ch);
    autoSave();
    await refresh();
  }

  function handleSubjectAction(action, id) {
    if (action === 'edit') openSubjectModal(id);
    else if (action === 'add-chapter') openChapterModal(id);
    else if (action === 'archive') archiveSubject(id, true);
    else if (action === 'unarchive') archiveSubject(id, false);
    else if (action === 'delete') deleteSubject(id);
  }

  function openSubjectModal(editId = null) {
    const subject = editId ? state.subjects.find((s) => s.id === editId) : null;
    const body = `
      <div class="form-group"><label>Subject Name</label><input id="f-name" value="${subject ? Utils.escapeHtml(subject.name) : ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Difficulty (1-5)</label><input type="number" id="f-difficulty" min="1" max="5" value="${subject?.difficulty || 3}"></div>
        <div class="form-group"><label>Confidence (1-5)</label><input type="number" id="f-confidence" min="1" max="5" value="${subject?.confidence || 3}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Exam Date</label><input type="date" id="f-exam" value="${subject?.examDate || ''}"></div>
        <div class="form-group"><label>Priority (1-5)</label><input type="number" id="f-priority" min="1" max="5" value="${subject?.priority || 3}"></div>
      </div>
    `;
    const footer = `
      <button class="btn btn-ghost modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-save-subject">Save</button>
    `;
    UI.openModal(editId ? 'Edit Subject' : 'Add Subject', body, footer);
    document.querySelector('.modal-cancel').onclick = UI.closeModal;
    document.getElementById('modal-save-subject').onclick = async () => {
      const name = document.getElementById('f-name').value.trim();
      if (!name) return UI.toast('Enter a subject name');
      const data = {
        id: subject?.id || Utils.uid(),
        name,
        difficulty: +document.getElementById('f-difficulty').value || 3,
        confidence: +document.getElementById('f-confidence').value || 3,
        examDate: document.getElementById('f-exam').value || null,
        priority: +document.getElementById('f-priority').value || 3,
        archived: subject?.archived || false,
        chapters: subject?.chapters || []
      };
      await StudyDB.put(StudyDB.STORES.subjects, data);
      if (!subject) state.subjects.push(data);
      else Object.assign(subject, data);
      UI.closeModal();
      autoSave();
      await refresh();
    };
  }

  function openChapterModal(subjectId, editId = null) {
    const ch = editId ? state.chapters.find((c) => c.id === editId) : null;
    const body = `
      <div class="form-group"><label>Chapter Name</label><input id="f-ch-name" value="${ch ? Utils.escapeHtml(ch.chapterName) : ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Estimated Hours</label><input type="number" id="f-ch-hours" min="0.5" step="0.5" value="${ch?.estimatedHours || 2}"></div>
        <div class="form-group"><label>Difficulty (1-5)</label><input type="number" id="f-ch-diff" min="1" max="5" value="${ch?.difficulty || 3}"></div>
      </div>
      <div class="form-group"><label>Notes</label><textarea id="f-ch-notes" rows="3">${ch?.notes || ''}</textarea></div>
      <div class="form-group"><label>Priority (1-5)</label><input type="number" id="f-ch-priority" min="1" max="5" value="${ch?.priority || 3}"></div>
    `;
    UI.openModal(ch ? 'Edit Chapter' : 'Add Chapter', body,
      `<button class="btn btn-ghost modal-cancel">Cancel</button>
       <button class="btn btn-primary" id="modal-save-chapter">Save</button>`);
    document.querySelector('.modal-cancel').onclick = UI.closeModal;
    document.getElementById('modal-save-chapter').onclick = async () => {
      const chapterName = document.getElementById('f-ch-name').value.trim();
      if (!chapterName) return UI.toast('Enter chapter name');
      const data = {
        id: ch?.id || Utils.uid(),
        subjectId,
        chapterName,
        estimatedHours: +document.getElementById('f-ch-hours').value || 2,
        difficulty: +document.getElementById('f-ch-diff').value || 3,
        completionStatus: ch?.completionStatus || false,
        revisionCount: ch?.revisionCount || 0,
        notes: document.getElementById('f-ch-notes').value,
        priority: +document.getElementById('f-ch-priority').value || 3,
        completedAt: ch?.completedAt || null,
        sortOrder: ch?.sortOrder ?? state.chapters.filter((c) => c.subjectId === subjectId).length
      };
      await StudyDB.put(StudyDB.STORES.chapters, data);
      if (!ch) state.chapters.push(data);
      UI.closeModal();
      autoSave();
      await refresh();
    };
  }

  async function archiveSubject(id, archived) {
    const s = state.subjects.find((x) => x.id === id);
    if (s) { s.archived = archived; await StudyDB.put(StudyDB.STORES.subjects, s); }
    autoSave();
    await refresh();
  }

  async function deleteSubject(id) {
    if (!confirm('Delete this subject and all its chapters?')) return;
    await StudyDB.remove(StudyDB.STORES.subjects, id);
    const chIds = state.chapters.filter((c) => c.subjectId === id).map((c) => c.id);
    for (const cid of chIds) await StudyDB.remove(StudyDB.STORES.chapters, cid);
    state.subjects = state.subjects.filter((s) => s.id !== id);
    state.chapters = state.chapters.filter((c) => c.subjectId !== id);
    autoSave();
    await refresh();
  }

  async function generatePlan() {
    const hoursPerDay = +document.getElementById('hours-per-day').value || 4;
    const startDate = document.getElementById('plan-start-date').value || Utils.formatDate(new Date());
    const weakTopics = document.getElementById('weak-topics').value;
    const strongTopics = document.getElementById('strong-topics').value;

    StudyStore.set('hoursPerDay', hoursPerDay);
    StudyStore.set('weakTopics', weakTopics);
    StudyStore.set('strongTopics', strongTopics);
    StudyStore.set('planStartDate', startDate);

    let tasks = [...state.tasks];
    tasks = StudyPlanner.markMissedSessions(tasks);
    tasks = StudyPlanner.redistributeMissed(tasks, hoursPerDay);

    const { schedule } = StudyPlanner.generatePlan(
      state.subjects, state.chapters,
      { hoursPerDay, startDate, weakTopics, strongTopics }
    );

    const newTasks = StudyPlanner.flattenScheduleToTasks(schedule);

    for (const t of state.tasks) {
      if (!t.completed) await StudyDB.remove(StudyDB.STORES.tasks, t.id);
    }

    const toSave = [...tasks.filter((t) => t.completed), ...newTasks];
    await StudyDB.putMany(StudyDB.STORES.tasks, toSave);
    state.tasks = toSave;
    state.planGenerated = true;

    UI.toast('Study plan generated successfully!');
    autoSave();
    await refresh();
  }

  function renderWeeklyPlan() {
    const container = document.getElementById('weekly-plan');
    const hoursPerDay = StudyStore.get('hoursPerDay') || 4;
    const start = document.getElementById('plan-start-date')?.value || Utils.formatDate(new Date());
    const days = [];
    for (let i = 0; i < 14; i++) days.push(Utils.addDays(start, i));

    const byDate = {};
    days.forEach((d) => { byDate[d] = state.tasks.filter((t) => t.date === d); });

    container.innerHTML = days.map((date) => {
      const tasks = byDate[date] || [];
      const totalH = tasks.reduce((s, t) => s + (t.hours || 0), 0);
      const overloaded = totalH > hoursPerDay;
      return `
        <div class="day-plan ${overloaded ? 'overloaded' : ''}">
          <h4>${Utils.dayName(date)} · ${date} · ${totalH.toFixed(1)}h / ${hoursPerDay}h</h4>
          ${tasks.length ? tasks.map((t) => `
            <div class="plan-task ${t.missed ? 'missed' : ''}">
              <input type="checkbox" data-plan-task="${t.id}" ${t.completed ? 'checked' : ''}>
              <span class="task-type ${t.type}">${t.type}</span>
              <span>${Utils.escapeHtml(t.chapterName || t.subjectName)}</span>
              <small style="margin-left:auto">${(t.hours || 1).toFixed(1)}h</small>
            </div>
          `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem">No tasks — generate plan</p>'}
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-plan-task]').forEach((cb) => {
      cb.addEventListener('change', () => toggleTask(cb.dataset.planTask, cb.checked));
    });
  }

  function renderCalendar() {
    const y = state.calendarYear;
    const m = state.calendarMonth;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('cal-month-label').textContent = `${monthNames[m]} ${y}`;

    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = Utils.getMonthDays(y, m);
    const grid = document.getElementById('calendar-grid');
    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = headers.map((h) => `<div class="cal-header">${h}</div>`).join('');

    const startPad = firstDay;
    for (let i = 0; i < startPad; i++) html += '<div class="cal-day other-month"></div>';

    const today = Utils.formatDate(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = state.tasks.filter((t) => t.date === date);
      const exams = state.subjects.filter((s) => s.examDate === date);

      html += `
        <div class="cal-day ${date === today ? 'today' : ''}" data-date="${date}">
          <div class="cal-day-num">${d}</div>
          ${exams.map((s) => `<div class="cal-event exam" draggable="true" data-exam="${s.id}">${Utils.escapeHtml(s.name)} Exam</div>`).join('')}
          ${dayTasks.map((t) => `
            <div class="cal-event ${t.type || 'study'}" draggable="true" data-task-id="${t.id}">
              ${Utils.escapeHtml((t.chapterName || '').slice(0, 20))}
            </div>
          `).join('')}
        </div>
      `;
    }
    grid.innerHTML = html;
    initCalendarDragDrop();
  }

  function initCalendarDragDrop() {
    let draggedTaskId = null;
    document.querySelectorAll('.cal-event[data-task-id]').forEach((el) => {
      el.addEventListener('dragstart', () => { draggedTaskId = el.dataset.taskId; });
    });
    document.querySelectorAll('.cal-day[data-date]').forEach((day) => {
      day.addEventListener('dragover', (e) => e.preventDefault());
      day.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!draggedTaskId) return;
        const task = state.tasks.find((t) => t.id === draggedTaskId);
        if (task) {
          task.date = day.dataset.date;
          await StudyDB.put(StudyDB.STORES.tasks, task);
          draggedTaskId = null;
          autoSave();
          renderCalendar();
        }
      });
    });
  }

  function renderNotes() {
    const query = (document.getElementById('notes-search')?.value || '').toLowerCase();
    let notes = [...state.notes];
    if (query) notes = notes.filter((n) =>
      n.title.toLowerCase().includes(query) ||
      n.content.toLowerCase().includes(query) ||
      (n.tags || []).some((t) => t.toLowerCase().includes(query))
    );
    if (state.noteTagFilter) notes = notes.filter((n) => (n.tags || []).includes(state.noteTagFilter));
    notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    const allTags = [...new Set(state.notes.flatMap((n) => n.tags || []))];
    document.getElementById('tag-filters').innerHTML = allTags.map((t) =>
      `<button class="tag-chip ${state.noteTagFilter === t ? 'active' : ''}" data-tag="${t}">${Utils.escapeHtml(t)}</button>`
    ).join('') + (allTags.length ? '' : '');

    document.getElementById('notes-grid').innerHTML = notes.length ? notes.map((n) => `
      <div class="note-card ${n.pinned ? 'pinned' : ''}" data-note-id="${n.id}">
        ${n.pinned ? '<span class="pin-icon">📌</span>' : ''}
        <h4>${Utils.escapeHtml(n.title)}</h4>
        <p>${Utils.escapeHtml(n.content)}</p>
        <div class="note-tags">${(n.tags || []).map((t) => `<span class="note-tag">${Utils.escapeHtml(t)}</span>`).join('')}</div>
      </div>
    `).join('') : '<p style="color:var(--text-muted)">No notes yet.</p>';

    document.querySelectorAll('.note-card').forEach((card) => {
      card.addEventListener('click', () => openNoteModal(card.dataset.noteId));
    });
    document.querySelectorAll('.tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.noteTagFilter = state.noteTagFilter === chip.dataset.tag ? null : chip.dataset.tag;
        renderNotes();
      });
    });
  }

  function openNoteModal(editId = null) {
    const note = editId ? state.notes.find((n) => n.id === editId) : null;
    UI.openModal(note ? 'Edit Note' : 'New Note', `
      <div class="form-group"><label>Title</label><input id="f-note-title" value="${note ? Utils.escapeHtml(note.title) : ''}"></div>
      <div class="form-group"><label>Content</label><textarea id="f-note-content" rows="5">${note?.content || ''}</textarea></div>
      <div class="form-group"><label>Tags (comma-separated)</label><input id="f-note-tags" value="${(note?.tags || []).join(', ')}"></div>
      <label class="setting-row"><span>Pin note</span><input type="checkbox" id="f-note-pinned" ${note?.pinned ? 'checked' : ''}></label>
    `, `<button class="btn btn-ghost modal-cancel">Cancel</button>
        ${note ? '<button class="btn btn-danger" id="modal-delete-note">Delete</button>' : ''}
        <button class="btn btn-primary" id="modal-save-note">Save</button>`);
    document.querySelector('.modal-cancel').onclick = UI.closeModal;
    document.getElementById('modal-save-note').onclick = async () => {
      const data = {
        id: note?.id || Utils.uid(),
        title: document.getElementById('f-note-title').value.trim() || 'Untitled',
        content: document.getElementById('f-note-content').value,
        tags: document.getElementById('f-note-tags').value.split(',').map((s) => s.trim()).filter(Boolean),
        pinned: document.getElementById('f-note-pinned').checked,
        updatedAt: new Date().toISOString()
      };
      await StudyDB.put(StudyDB.STORES.notes, data);
      if (!note) state.notes.push(data);
      else Object.assign(note, data);
      UI.closeModal();
      autoSave();
      renderNotes();
      checkAchievements();
    };
    const del = document.getElementById('modal-delete-note');
    if (del) del.onclick = async () => {
      await StudyDB.remove(StudyDB.STORES.notes, note.id);
      state.notes = state.notes.filter((n) => n.id !== note.id);
      UI.closeModal();
      renderNotes();
    };
  }

  function renderHabits() {
    document.getElementById('habits-list').innerHTML = state.habits.length
      ? state.habits.map((h) => `
        <div class="habit-item">
          <input type="checkbox" data-habit="${h.id}" ${h.doneToday ? 'checked' : ''}>
          <span>${Utils.escapeHtml(h.name)}</span>
          <span class="habit-streak">${h.streak || 0} day streak</span>
        </div>
      `).join('')
      : '<p style="color:var(--text-muted);font-size:0.9rem">No habits yet.</p>';

    document.getElementById('goals-list').innerHTML = state.goals.length
      ? state.goals.map((g) => {
        const pct = g.target ? Math.min(100, (g.current / g.target) * 100) : 0;
        return `
          <div class="goal-item">
            <span>${Utils.escapeHtml(g.name)}</span>
            <div class="goal-progress"><div class="goal-progress-bar" style="width:${pct}%"></div></div>
            <small>${g.current || 0}/${g.target}</small>
          </div>
        `;
      }).join('')
      : '<p style="color:var(--text-muted);font-size:0.9rem">No goals yet.</p>';

    document.querySelectorAll('[data-habit]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const h = state.habits.find((x) => x.id === cb.dataset.habit);
        if (h) {
          h.doneToday = cb.checked;
          if (cb.checked) h.streak = (h.streak || 0) + 1;
          await StudyDB.put(StudyDB.STORES.habits, h);
        }
      });
    });
  }

  function renderFocusStats() {
    const stats = StudyStore.get('focusStats') || {};
    document.getElementById('focus-total').textContent = Utils.formatMinutes(stats.totalMinutes || 0);
    document.getElementById('focus-longest').textContent = Utils.formatMinutes(stats.longestSession || 0);
    document.getElementById('focus-weekly-avg').textContent = Utils.formatMinutes(FocusMode.getWeeklyAverage());
  }

  function populateSubjectSelect() {
    const sel = document.getElementById('focus-subject-select');
    if (!sel) return;
    const active = state.subjects.filter((s) => !s.archived);
    sel.innerHTML = '<option value="">General focus</option>' +
      active.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`).join('');
  }

  function checkAchievements(readiness = 0) {
    const unlocked = StudyStore.get('unlockedAchievements') || [];
    const newly = Achievements.check({
      focusStats: StudyStore.get('focusStats'),
      streak: StudyStore.get('streak'),
      studyLogs: state.studyLogs,
      subjects: state.subjects,
      chapters: state.chapters,
      notes: state.notes,
      readiness,
      planGenerated: state.planGenerated
    }, unlocked);

    if (newly.length) {
      const all = [...unlocked, ...newly];
      StudyStore.set('unlockedAchievements', all);
      newly.forEach((id) => UI.showAchievement(id));
      UI.renderAchievements(all);
    }
  }

  function autoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      StudyStore.set('lastAutoSave', new Date().toISOString());
      document.getElementById('autosave-status').textContent =
        `Auto-saved at ${new Date().toLocaleTimeString()}`;
    }, 500);
  }

  async function manualSave() {
    StudyStore.set('lastAutoSave', new Date().toISOString());
    UI.toast('All data saved locally');
  }

  async function exportData() {
    const data = await StudyDB.exportAll();
    data.settings = StudyStore.getAllSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `studymaster-backup-${Utils.formatDate(new Date())}.json`;
    a.click();
    UI.toast('Data exported');
  }

  async function importData(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.settings) StudyStore.applySettings(data.settings);
    await StudyDB.importAll(data);
    await loadAll();
    UI.toast('Data imported successfully');
  }

  function globalSearch(query) {
    const q = query.toLowerCase().trim();
    const results = document.getElementById('search-results');
    if (!q) { results.classList.add('hidden'); return; }

    const items = [];
    state.subjects.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) items.push({ type: 'Subject', label: s.name, action: () => navigate('subjects') });
    });
    state.chapters.forEach((c) => {
      if (c.chapterName.toLowerCase().includes(q)) {
        const sub = state.subjects.find((s) => s.id === c.subjectId);
        items.push({ type: 'Chapter', label: `${c.chapterName} (${sub?.name || ''})`, action: () => navigate('subjects') });
      }
    });
    state.tasks.forEach((t) => {
      if ((t.chapterName || '').toLowerCase().includes(q)) {
        items.push({ type: 'Task', label: t.chapterName, action: () => navigate('planner') });
      }
    });
    state.notes.forEach((n) => {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        items.push({ type: 'Note', label: n.title, action: () => navigate('notes') });
      }
    });
    state.subjects.filter((s) => s.examDate).forEach((s) => {
      if (s.examDate.includes(q) || s.name.toLowerCase().includes(q)) {
        items.push({ type: 'Exam', label: `${s.name} — ${s.examDate}`, action: () => navigate('calendar') });
      }
    });

    if (!items.length) {
      results.innerHTML = '<div class="result-item">No results</div>';
    } else {
      results.innerHTML = items.slice(0, 12).map((item, i) => `
        <div class="result-item" data-idx="${i}">
          <div class="result-type">${item.type}</div>
          ${Utils.escapeHtml(item.label)}
        </div>
      `).join('');
      results.querySelectorAll('.result-item').forEach((el, i) => {
        if (items[i]) el.addEventListener('click', () => { items[i].action(); results.classList.add('hidden'); });
      });
    }
    results.classList.remove('hidden');
  }

  function navigate(view) {
    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.toggle('active', n.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.dataset.view === view);
    });
    if (view === 'analytics') refresh();
    document.getElementById('sidebar').classList.remove('open');
  }

  function initNavigation() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    document.getElementById('btn-focus-quick').addEventListener('click', () => navigate('focus'));
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('global-search').focus(); }
      if (e.key === 'Escape') UI.closeModal();
      if (e.key === 't' && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') {
        const themes = ['dark', 'light', 'auto'];
        const i = themes.indexOf(StudyStore.get('theme') || 'dark');
        UI.applyTheme(themes[(i + 1) % themes.length]);
      }
      if (e.key === 'f' && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') navigate('focus');
      if (e.key === 'g' && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') generatePlan();
      const views = ['dashboard', 'subjects', 'planner', 'calendar', 'focus', 'analytics', 'notes', 'habits', 'achievements'];
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey) navigate(views[+e.key - 1]);
    });
  }

  function initEvents() {
    document.getElementById('btn-add-subject').addEventListener('click', () => openSubjectModal());
    document.getElementById('btn-generate-plan').addEventListener('click', generatePlan);
    document.getElementById('btn-planner-generate').addEventListener('click', generatePlan);
    document.getElementById('btn-regenerate-plan').addEventListener('click', generatePlan);
    document.getElementById('dismiss-recs').addEventListener('click', () => {
      document.getElementById('recommendations-bar').classList.add('hidden');
    });

    document.querySelectorAll('.filter-tabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tabs .tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.subjectFilter = tab.dataset.filter;
        renderSubjects();
      });
    });

    document.getElementById('cal-prev').addEventListener('click', () => {
      state.calendarMonth--;
      if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
      renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      state.calendarMonth++;
      if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
      renderCalendar();
    });

    document.getElementById('global-search').addEventListener('input',
      Utils.debounce((e) => globalSearch(e.target.value), 200));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrap')) {
        document.getElementById('search-results').classList.add('hidden');
      }
    });

    document.getElementById('btn-add-note').addEventListener('click', () => openNoteModal());
    document.getElementById('notes-search')?.addEventListener('input', Utils.debounce(renderNotes, 200));

    document.getElementById('btn-timer-start').addEventListener('click', () => FocusMode.toggle());
    document.getElementById('btn-timer-reset').addEventListener('click', () => FocusMode.reset());
    document.getElementById('btn-fullscreen').addEventListener('click', () => FocusMode.enterFullscreen());

    document.getElementById('btn-timer-settings').addEventListener('click', () => navigate('settings'));

    document.getElementById('setting-theme').addEventListener('change', (e) => UI.applyTheme(e.target.value));
    ['setting-focus-min', 'setting-break-min', 'setting-long-break'].forEach((id) => {
      document.getElementById(id).addEventListener('change', (e) => {
        const map = { 'setting-focus-min': 'focusMinutes', 'setting-break-min': 'breakMinutes', 'setting-long-break': 'longBreakMinutes' };
        StudyStore.set(map[id], +e.target.value);
      });
    });

    document.getElementById('btn-manual-save').addEventListener('click', manualSave);
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('change', (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
    });
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
      if (!confirm('Delete ALL local data? This cannot be undone.')) return;
      await StudyDB.clearAll();
      localStorage.clear();
      location.reload();
    });

    document.getElementById('btn-add-habit').addEventListener('click', () => {
      UI.openModal('Add Habit', `
        <div class="form-group"><label>Habit name</label><input id="f-habit-name"></div>
      `, `<button class="btn btn-ghost modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="save-habit">Save</button>`);
      document.querySelector('.modal-cancel').onclick = UI.closeModal;
      document.getElementById('save-habit').onclick = async () => {
        const name = document.getElementById('f-habit-name').value.trim();
        if (!name) return;
        const h = { id: Utils.uid(), name, streak: 0, doneToday: false };
        await StudyDB.put(StudyDB.STORES.habits, h);
        state.habits.push(h);
        UI.closeModal();
        renderHabits();
      };
    });

    document.getElementById('btn-add-goal').addEventListener('click', () => {
      UI.openModal('Add Goal', `
        <div class="form-group"><label>Goal</label><input id="f-goal-name"></div>
        <div class="form-group"><label>Target</label><input type="number" id="f-goal-target" min="1" value="10"></div>
      `, `<button class="btn btn-ghost modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="save-goal">Save</button>`);
      document.querySelector('.modal-cancel').onclick = UI.closeModal;
      document.getElementById('save-goal').onclick = async () => {
        const g = {
          id: Utils.uid(),
          name: document.getElementById('f-goal-name').value.trim(),
          target: +document.getElementById('f-goal-target').value || 10,
          current: 0
        };
        await StudyDB.put(StudyDB.STORES.goals, g);
        state.goals.push(g);
        UI.closeModal();
        renderHabits();
      };
    });

    document.getElementById('daily-schedule-inputs')?.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.dataset.day) return;
      const schedule = StudyStore.get('dailySchedule') || {};
      if (!schedule[t.dataset.day]) schedule[t.dataset.day] = {};
      schedule[t.dataset.day][t.dataset.field] = t.value;
      StudyStore.set('dailySchedule', schedule);
    });

    if (!document.getElementById('timerGradient')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = `<defs><linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:var(--primary)"/><stop offset="100%" style="stop-color:var(--accent)"/>
      </linearGradient></defs>`;
      svg.style.position = 'absolute'; svg.style.width = '0'; svg.style.height = '0';
      document.body.appendChild(svg);
    }
  }

  async function init() {
    UI.initModalClose();
    UI.initThemeToggle();
    initNavigation();
    initKeyboard();
    initEvents();

    FocusMode.init({
      onComplete: async () => {
        const subId = document.getElementById('focus-subject-select').value;
        const log = {
          id: Utils.uid(),
          date: Utils.formatDate(new Date()),
          minutes: StudyStore.get('focusMinutes') || 25,
          subjectId: subId || null,
          type: 'focus'
        };
        state.studyLogs.push(log);
        await StudyDB.put(StudyDB.STORES.studyLogs, log);
        const streak = Achievements.updateStreak(StudyStore.get('streak') || {});
        StudyStore.set('streak', streak);
        renderFocusStats();
        checkAchievements();
        autoSave();
      }
    });

    await loadAll();

    if (!state.subjects.length) {
      seedDemoData();
    }
  }

  async function seedDemoData() {
    const sub1 = {
      id: Utils.uid(),
      name: 'Mathematics',
      difficulty: 4,
      confidence: 2,
      examDate: Utils.addDays(Utils.formatDate(new Date()), 21),
      priority: 5,
      archived: false
    };
    const sub2 = {
      id: Utils.uid(),
      name: 'Physics',
      difficulty: 3,
      confidence: 3,
      examDate: Utils.addDays(Utils.formatDate(new Date()), 35),
      priority: 4,
      archived: false
    };
    await StudyDB.put(StudyDB.STORES.subjects, sub1);
    await StudyDB.put(StudyDB.STORES.subjects, sub2);

    const chapters = [
      { id: Utils.uid(), subjectId: sub1.id, chapterName: 'Calculus — Limits', estimatedHours: 3, difficulty: 4, completionStatus: false, revisionCount: 0, priority: 5 },
      { id: Utils.uid(), subjectId: sub1.id, chapterName: 'Integration Techniques', estimatedHours: 4, difficulty: 5, completionStatus: false, revisionCount: 0, priority: 5 },
      { id: Utils.uid(), subjectId: sub1.id, chapterName: 'Differential Equations', estimatedHours: 3, difficulty: 4, completionStatus: true, revisionCount: 1, priority: 4, completedAt: Utils.addDays(Utils.formatDate(new Date()), -5) },
      { id: Utils.uid(), subjectId: sub2.id, chapterName: 'Mechanics — Newton\'s Laws', estimatedHours: 2.5, difficulty: 3, completionStatus: false, revisionCount: 0, priority: 3 },
      { id: Utils.uid(), subjectId: sub2.id, chapterName: 'Electromagnetism', estimatedHours: 4, difficulty: 4, completionStatus: false, revisionCount: 0, priority: 4 }
    ];
    await StudyDB.putMany(StudyDB.STORES.chapters, chapters);

    StudyStore.set('weakTopics', 'Integration, Electromagnetism');
    StudyStore.set('strongTopics', 'Mechanics');
    document.getElementById('weak-topics').value = 'Integration, Electromagnetism';
    document.getElementById('strong-topics').value = 'Mechanics';

    state.subjects = [sub1, sub2];
    state.chapters = chapters;
    await generatePlan();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { refresh, generatePlan, navigate };
})();
