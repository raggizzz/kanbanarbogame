const STATUS_LABELS = {
  Backlog: "Backlog",
  "To Do": "A Fazer",
  "In Progress": "Em Progresso",
  "In Review": "Em Revisao",
  Done: "Concluido"
};

const PRIORITY_LABELS = {
  Lowest: "Muito Baixa",
  Low: "Baixa",
  Medium: "Media",
  High: "Alta",
  Highest: "Critica"
};

const TYPE_LABELS = {
  Story: "Historia",
  Task: "Tarefa",
  Bug: "Bug",
  Epic: "Epico"
};

const SPRINT_STATE_LABELS = {
  planned: "Planejada",
  active: "Ativa",
  closed: "Encerrada"
};

const state = {
  project: null,
  meta: null,
  sprints: [],
  issues: [],
  filters: {
    search: "",
    status: "",
    priority: "",
    assignee: "",
    sprintId: ""
  },
  selectedIssueId: null
};

const dom = {
  projectTitle: document.getElementById("project-title"),
  projectDescription: document.getElementById("project-description"),
  metricTotal: document.getElementById("metric-total"),
  metricProgress: document.getElementById("metric-progress"),
  metricDone: document.getElementById("metric-done"),
  membersList: document.getElementById("members-list"),
  newSprintForm: document.getElementById("new-sprint-form"),
  sprintList: document.getElementById("sprint-list"),
  sprintTemplate: document.getElementById("sprint-template"),
  board: document.getElementById("board"),
  refreshBtn: document.getElementById("refresh-btn"),
  newIssueForm: document.getElementById("new-issue-form"),
  filterSearch: document.getElementById("filter-search"),
  filterStatus: document.getElementById("filter-status"),
  filterPriority: document.getElementById("filter-priority"),
  filterAssignee: document.getElementById("filter-assignee"),
  filterSprint: document.getElementById("filter-sprint"),
  clearFiltersBtn: document.getElementById("clear-filters-btn"),
  issueDialog: document.getElementById("issue-dialog"),
  issueEditForm: document.getElementById("issue-edit-form"),
  commentsList: document.getElementById("comments-list"),
  commentForm: document.getElementById("comment-form"),
  closeDialogBtn: document.getElementById("close-dialog-btn"),
  deleteIssueBtn: document.getElementById("delete-issue-btn"),
  cardTemplate: document.getElementById("card-template"),
  toastHost: document.getElementById("toast-host"),
  confirmDialog: document.getElementById("confirm-dialog"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmCancelBtn: document.getElementById("confirm-cancel-btn"),
  confirmOkBtn: document.getElementById("confirm-ok-btn")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || (Array.isArray(data.errors) ? data.errors.join(", ") : "Erro na API");
    throw new Error(message);
  }
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notify(message, options = {}) {
  if (!dom.toastHost) return;
  const type = options.type || "info";
  const title =
    options.title ||
    (type === "success" ? "Sucesso" : type === "error" ? "Erro" : "Informacao");
  const toast = document.createElement("article");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
  dom.toastHost.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 180);
  }, options.timeout || 3400);
}

function askConfirm(message, options = {}) {
  return new Promise((resolve) => {
    if (!dom.confirmDialog) {
      resolve(true);
      return;
    }

    dom.confirmTitle.textContent = options.title || "Confirmar acao";
    dom.confirmMessage.textContent = message;

    let closed = false;

    const close = (accepted) => {
      if (closed) return;
      closed = true;
      dom.confirmDialog.removeEventListener("close", onClose);
      dom.confirmCancelBtn.removeEventListener("click", onCancel);
      dom.confirmOkBtn.removeEventListener("click", onOk);
      if (dom.confirmDialog.open) dom.confirmDialog.close();
      resolve(accepted);
    };

    const onCancel = () => close(false);
    const onOk = () => close(true);
    const onClose = () => close(false);

    dom.confirmCancelBtn.addEventListener("click", onCancel);
    dom.confirmOkBtn.addEventListener("click", onOk);
    dom.confirmDialog.addEventListener("close", onClose);
    dom.confirmDialog.showModal();
  });
}

function labelStatus(value) {
  return STATUS_LABELS[value] || value;
}

function labelPriority(value) {
  return PRIORITY_LABELS[value] || value;
}

function labelType(value) {
  return TYPE_LABELS[value] || value;
}

function labelSprintState(value) {
  return SPRINT_STATE_LABELS[value] || value;
}

function labelUser(value) {
  if (!value || value === "Unassigned") return "Nao atribuido";
  return value;
}

function toDateLabel(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

function setSelectOptions(selectEl, values, config = {}) {
  if (!selectEl) return;
  const { placeholder = "", labelFn = (value) => value } = config;
  const oldValue = selectEl.value;
  const options = [];
  if (placeholder) {
    options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
  }
  for (const value of values) {
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(labelFn(value))}</option>`);
  }
  selectEl.innerHTML = options.join("");
  if (values.includes(oldValue)) {
    selectEl.value = oldValue;
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function getMembers() {
  const fromIssues = state.issues.flatMap((issue) => [issue.assignee, issue.reporter]).filter(Boolean);
  return unique([...(state.meta?.users || []), ...fromIssues]).filter((member) => member !== "Unassigned");
}

function fillMemberSelect(selectEl, members, options = {}) {
  const { allowUnassigned = false, defaultValue = "" } = options;
  const oldValue = selectEl.value;
  const parts = [];
  if (allowUnassigned) {
    parts.push('<option value="">Nao atribuido</option>');
  }
  for (const member of members) {
    parts.push(`<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`);
  }
  selectEl.innerHTML = parts.join("");

  if (members.includes(oldValue) || (allowUnassigned && oldValue === "")) {
    selectEl.value = oldValue;
    return;
  }

  if (defaultValue && (members.includes(defaultValue) || (allowUnassigned && defaultValue === ""))) {
    selectEl.value = defaultValue;
    return;
  }

  if (allowUnassigned) {
    selectEl.value = "";
  } else if (members.length > 0) {
    selectEl.value = members[0];
  }
}

function fillSprintSelect(selectEl, options) {
  const oldValue = selectEl.value;
  const lines = ['<option value="">Sem sprint</option>'];
  for (const option of options) {
    lines.push(`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`);
  }
  selectEl.innerHTML = lines.join("");
  if (options.some((option) => option.value === oldValue)) {
    selectEl.value = oldValue;
  }
}

function setDefaultSprintDates() {
  if (!dom.newSprintForm) return;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const toYmd = (d) => d.toISOString().slice(0, 10);
  if (!dom.newSprintForm.startDate.value) dom.newSprintForm.startDate.value = toYmd(start);
  if (!dom.newSprintForm.endDate.value) dom.newSprintForm.endDate.value = toYmd(end);
}

async function loadInitialData() {
  const [project, meta, sprints, issues] = await Promise.all([
    api("/api/project"),
    api("/api/meta"),
    api("/api/sprints"),
    api("/api/issues")
  ]);

  state.project = project;
  state.meta = meta;
  state.sprints = sprints;
  state.issues = issues;
  render();
}

function render() {
  renderHeader();
  renderMetrics();
  renderMembers();
  renderSprints();
  renderFilterControls();
  renderFormsOptions();
  renderBoard();
}

function renderHeader() {
  dom.projectTitle.textContent = `${state.project.key} - ${state.project.name}`;
  dom.projectDescription.textContent = state.project.description || "";
}

function renderMetrics() {
  const total = state.issues.length;
  const progress = state.issues.filter((issue) =>
    ["In Progress", "In Review"].includes(issue.status)
  ).length;
  const done = state.issues.filter((issue) => issue.status === "Done").length;

  dom.metricTotal.textContent = String(total);
  dom.metricProgress.textContent = String(progress);
  dom.metricDone.textContent = String(done);
}

function renderMembers() {
  const members = getMembers();
  dom.membersList.innerHTML = members
    .map((member) => `<article class="member-chip">${escapeHtml(member)}</article>`)
    .join("");
}

function renderSprints() {
  if (!dom.sprintList) return;
  const sprints = [...state.sprints].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sprints.length === 0) {
    dom.sprintList.innerHTML =
      '<article class="sprint-card"><p class="sprint-goal">Nenhuma sprint criada.</p></article>';
    return;
  }

  dom.sprintList.innerHTML = "";
  for (const sprint of sprints) {
    const node = dom.sprintTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".sprint-name").textContent = sprint.name;
    node.querySelector(".sprint-state").textContent = labelSprintState(sprint.state);
    node.querySelector(".sprint-state").dataset.state = sprint.state;
    node.querySelector(".sprint-goal").textContent = sprint.goal || "Sem objetivo definido.";
    node.querySelector(".sprint-dates").textContent = `${toDateLabel(sprint.startDate)} ate ${toDateLabel(sprint.endDate)}`;
    const deleteBtn = node.querySelector(".sprint-delete-btn");
    deleteBtn.addEventListener("click", async () => {
      const accepted = await askConfirm(`Excluir sprint "${sprint.name}"?`, {
        title: "Excluir sprint"
      });
      if (!accepted) return;
      try {
        const result = await api(`/api/sprints/${encodeURIComponent(sprint.id)}`, {
          method: "DELETE"
        });
        await reloadSprints();
        await reloadIssues();
        if (result.affectedIssues > 0) {
          notify(
            `Sprint removida. ${result.affectedIssues} ticket(s) ficaram sem sprint.`,
            { type: "success", title: "Sprint excluida" }
          );
        } else {
          notify("Sprint removida com sucesso.", { type: "success", title: "Sprint excluida" });
        }
      } catch (error) {
        notify(error.message, { type: "error", title: "Falha ao excluir sprint" });
      }
    });
    dom.sprintList.appendChild(node);
  }
}

function renderFilterControls() {
  setSelectOptions(dom.filterStatus, state.meta.statuses, {
    placeholder: "Todos os status",
    labelFn: labelStatus
  });
  setSelectOptions(dom.filterPriority, state.meta.priorities, {
    placeholder: "Todas as prioridades",
    labelFn: labelPriority
  });
  setSelectOptions(dom.filterAssignee, getMembers(), {
    placeholder: "Todos os responsaveis",
    labelFn: labelUser
  });
  setSelectOptions(
    dom.filterSprint,
    state.sprints.map((s) => `${s.id}::${s.name}`),
    { placeholder: "Todas as sprints" }
  );

  [...dom.filterSprint.options].forEach((option) => {
    if (!option.value) return;
    const [id, name] = option.value.split("::");
    option.value = id;
    option.textContent = name;
  });
}

function renderFormsOptions() {
  setSelectOptions(dom.newIssueForm.elements.type, state.meta.types, { labelFn: labelType });
  setSelectOptions(dom.newIssueForm.elements.priority, state.meta.priorities, {
    labelFn: labelPriority
  });
  setSelectOptions(dom.newIssueForm.elements.status, state.meta.statuses, {
    labelFn: labelStatus
  });
  setSelectOptions(dom.issueEditForm.elements.type, state.meta.types, { labelFn: labelType });
  setSelectOptions(dom.issueEditForm.elements.priority, state.meta.priorities, {
    labelFn: labelPriority
  });
  setSelectOptions(dom.issueEditForm.elements.status, state.meta.statuses, {
    labelFn: labelStatus
  });

  const members = getMembers();
  fillMemberSelect(dom.newIssueForm.elements.assignee, members, {
    allowUnassigned: true,
    defaultValue: ""
  });
  fillMemberSelect(dom.newIssueForm.elements.reporter, members, {
    defaultValue: "Antonio - PM"
  });
  fillMemberSelect(dom.issueEditForm.elements.assignee, members, {
    allowUnassigned: true,
    defaultValue: ""
  });
  fillMemberSelect(dom.issueEditForm.elements.reporter, members, {
    defaultValue: "Antonio - PM"
  });
  fillMemberSelect(dom.commentForm.elements.author, members, {
    defaultValue: "Igor"
  });

  const sprintOptions = state.sprints.map((s) => ({
    value: s.id,
    label: `${s.name} (${labelSprintState(s.state)})`
  }));
  fillSprintSelect(dom.newIssueForm.elements.sprintId, sprintOptions);
  fillSprintSelect(dom.issueEditForm.elements.sprintId, sprintOptions);
}

function getFilteredIssues() {
  return state.issues.filter((issue) => {
    if (state.filters.search) {
      const term = state.filters.search.toLowerCase();
      const haystack = [
        issue.id,
        issue.title,
        issue.description,
        issue.assignee,
        issue.reporter,
        ...(issue.labels || [])
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (state.filters.status && issue.status !== state.filters.status) return false;
    if (state.filters.priority && issue.priority !== state.filters.priority) return false;
    if (state.filters.assignee && issue.assignee !== state.filters.assignee) return false;
    if (state.filters.sprintId && issue.sprintId !== state.filters.sprintId) return false;
    return true;
  });
}

function renderBoard() {
  const byStatus = new Map();
  for (const status of state.meta.statuses) {
    byStatus.set(status, []);
  }
  for (const issue of getFilteredIssues()) {
    if (!byStatus.has(issue.status)) {
      byStatus.set(issue.status, []);
    }
    byStatus.get(issue.status).push(issue);
  }

  dom.board.innerHTML = "";
  state.meta.statuses.forEach((status, index) => {
    const column = document.createElement("section");
    const statusClass = `status-${status.toLowerCase().replaceAll(" ", "-")}`;
    column.className = `column ${statusClass}`;
    column.dataset.status = status;
    column.style.setProperty("--col-order", String(index));
    column.innerHTML = `
      <div class="column-head">
        <h3>${escapeHtml(labelStatus(status))}</h3>
        <span class="count">${byStatus.get(status).length}</span>
      </div>
      <div class="cards"></div>
    `;

    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const issueId = event.dataTransfer.getData("text/plain");
      if (!issueId) return;
      const issue = state.issues.find((item) => item.id === issueId);
      if (!issue || issue.status === status) return;
      await updateIssue(issueId, { status });
      notify(`Ticket ${issueId} movido para ${labelStatus(status)}.`, {
        type: "success",
        title: "Ticket atualizado"
      });
    });

    const cardsEl = column.querySelector(".cards");
    for (const issue of byStatus.get(status)) {
      cardsEl.appendChild(renderCard(issue));
    }
    dom.board.appendChild(column);
  });
}

function renderCard(issue) {
  const node = dom.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = issue.id;
  node.dataset.priority = String(issue.priority || "").toLowerCase();
  node.querySelector(".chip-type").textContent = labelType(issue.type);
  node.querySelector(".issue-card-id").textContent = issue.id;
  node.querySelector(".issue-card-title").textContent = issue.title;
  node.querySelector(".issue-card-meta").textContent = `${labelUser(issue.assignee)} | ${labelStatus(issue.status)}`;
  node.querySelector(".issue-card-labels").textContent = (issue.labels || []).length
    ? issue.labels.map((label) => `#${label}`).join(" ")
    : "Sem labels";
  node.querySelector(".chip-priority").textContent = labelPriority(issue.priority);
  node.querySelector(".chip-points").textContent = `${issue.storyPoints || 0} pontos`;

  node.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", issue.id);
  });
  node.addEventListener("click", () => openIssueDialog(issue.id));
  return node;
}

function issueById(issueId) {
  return state.issues.find((issue) => issue.id === issueId);
}

function openIssueDialog(issueId) {
  const issue = issueById(issueId);
  if (!issue) return;
  state.selectedIssueId = issueId;
  dom.issueEditForm.elements.id.value = issue.id;
  dom.issueEditForm.elements.title.value = issue.title;
  dom.issueEditForm.elements.type.value = issue.type;
  dom.issueEditForm.elements.status.value = issue.status;
  dom.issueEditForm.elements.priority.value = issue.priority;
  dom.issueEditForm.elements.assignee.value = issue.assignee === "Unassigned" ? "" : issue.assignee || "";
  dom.issueEditForm.elements.reporter.value = issue.reporter || "Antonio - PM";
  dom.issueEditForm.elements.sprintId.value = issue.sprintId || "";
  dom.issueEditForm.elements.storyPoints.value = issue.storyPoints || 0;
  dom.issueEditForm.elements.labels.value = (issue.labels || []).join(", ");
  dom.issueEditForm.elements.description.value = issue.description || "";

  renderComments(issue.comments || []);
  dom.issueDialog.showModal();
}

function renderComments(comments) {
  dom.commentsList.innerHTML = "";
  if (!comments.length) {
    const li = document.createElement("li");
    li.textContent = "Sem comentarios.";
    dom.commentsList.appendChild(li);
    return;
  }

  for (const comment of comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${escapeHtml(labelUser(comment.author))}</strong>
      <p>${escapeHtml(comment.body)}</p>
      <small>${new Date(comment.createdAt).toLocaleString("pt-BR")}</small>
    `;
    dom.commentsList.appendChild(li);
  }
}

async function reloadIssues() {
  state.issues = await api("/api/issues");
  render();
}

async function reloadSprints() {
  state.sprints = await api("/api/sprints");
}

async function updateIssue(issueId, payload) {
  await api(`/api/issues/${encodeURIComponent(issueId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  await reloadIssues();
  if (state.selectedIssueId === issueId) {
    openIssueDialog(issueId);
  }
}

function bindEvents() {
  dom.refreshBtn.addEventListener("click", async () => {
    try {
      await Promise.all([reloadSprints(), reloadIssues()]);
      notify("Dados atualizados com sucesso.", { type: "success" });
    } catch (error) {
      notify(error.message, { type: "error", title: "Falha ao atualizar" });
    }
  });

  dom.newSprintForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      name: form.name.value.trim(),
      goal: form.goal.value.trim(),
      state: form.state.value,
      startDate: form.startDate.value,
      endDate: form.endDate.value
    };

    if (!payload.name || !payload.startDate || !payload.endDate) {
      notify("Preencha nome, inicio e fim da sprint.", { type: "error" });
      return;
    }
    if (payload.endDate < payload.startDate) {
      notify("A data de fim deve ser maior ou igual a data de inicio.", { type: "error" });
      return;
    }

    try {
      await api("/api/sprints", { method: "POST", body: JSON.stringify(payload) });
      form.name.value = "";
      form.goal.value = "";
      form.state.value = "planned";
      setDefaultSprintDates();
      await reloadSprints();
      await reloadIssues();
      notify("Sprint criada com sucesso.", { type: "success" });
    } catch (error) {
      notify(error.message, { type: "error", title: "Falha ao criar sprint" });
    }
  });

  dom.newIssueForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      type: form.type.value,
      status: form.status.value,
      priority: form.priority.value,
      assignee: form.assignee.value,
      reporter: form.reporter.value,
      sprintId: form.sprintId.value,
      storyPoints: Number(form.storyPoints.value || 0),
      labels: form.labels.value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    };

    try {
      const created = await api("/api/issues", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.storyPoints.value = 0;
      form.assignee.value = "";
      if ([...form.reporter.options].some((option) => option.value === "Antonio - PM")) {
        form.reporter.value = "Antonio - PM";
      }
      await reloadIssues();
      notify(`Ticket ${created.id} criado com sucesso.`, { type: "success" });
    } catch (error) {
      notify(error.message, { type: "error", title: "Falha ao criar ticket" });
    }
  });

  dom.issueEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const issueId = form.id.value;
    if (!issueId) return;
    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      type: form.type.value,
      status: form.status.value,
      priority: form.priority.value,
      assignee: form.assignee.value,
      reporter: form.reporter.value,
      sprintId: form.sprintId.value,
      storyPoints: Number(form.storyPoints.value || 0),
      labels: form.labels.value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    };
    try {
      await updateIssue(issueId, payload);
      notify(`Ticket ${issueId} atualizado.`, { type: "success" });
    } catch (error) {
      notify(error.message, { type: "error", title: "Falha ao atualizar ticket" });
    }
  });

  dom.deleteIssueBtn.addEventListener("click", async () => {
    const issueId = dom.issueEditForm.elements.id.value;
    if (!issueId) return;
    const accepted = await askConfirm(`Excluir ${issueId}?`, { title: "Excluir ticket" });
    if (!accepted) return;
    try {
      await api(`/api/issues/${encodeURIComponent(issueId)}`, { method: "DELETE" });
      dom.issueDialog.close();
      state.selectedIssueId = null;
      await reloadIssues();
      notify(`Ticket ${issueId} excluido.`, { type: "success" });
    } catch (error) {
      notify(error.message, { type: "error", title: "Falha ao excluir ticket" });
    }
  });

  dom.commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const issueId = state.selectedIssueId;
    if (!issueId) return;
    const author = dom.commentForm.author.value;
    const body = dom.commentForm.body.value.trim();
    if (!body) return;
    try {
      await api(`/api/issues/${encodeURIComponent(issueId)}/comments`, {
        method: "POST",
        body: JSON.stringify({ author, body })
      });
      dom.commentForm.body.value = "";
      await reloadIssues();
      openIssueDialog(issueId);
      notify("Comentario adicionado.", { type: "success" });
    } catch (error) {
      notify(error.message, { type: "error", title: "Falha ao comentar" });
    }
  });

  dom.closeDialogBtn.addEventListener("click", () => {
    dom.issueDialog.close();
  });

  dom.issueDialog.addEventListener("click", (event) => {
    const rect = dom.issueDialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) {
      dom.issueDialog.close();
    }
  });

  const onFilterChange = () => {
    state.filters.search = dom.filterSearch.value.trim();
    state.filters.status = dom.filterStatus.value;
    state.filters.priority = dom.filterPriority.value;
    state.filters.assignee = dom.filterAssignee.value;
    state.filters.sprintId = dom.filterSprint.value;
    renderBoard();
  };

  dom.filterSearch.addEventListener("input", onFilterChange);
  dom.filterStatus.addEventListener("change", onFilterChange);
  dom.filterPriority.addEventListener("change", onFilterChange);
  dom.filterAssignee.addEventListener("change", onFilterChange);
  dom.filterSprint.addEventListener("change", onFilterChange);

  dom.clearFiltersBtn.addEventListener("click", () => {
    dom.filterSearch.value = "";
    dom.filterStatus.value = "";
    dom.filterPriority.value = "";
    dom.filterAssignee.value = "";
    dom.filterSprint.value = "";
    onFilterChange();
    notify("Filtros limpos.", { type: "info" });
  });
}

async function boot() {
  bindEvents();
  setDefaultSprintDates();
  try {
    await loadInitialData();
  } catch (error) {
    console.error(error);
    notify(`Falha ao carregar Jira local: ${error.message}`, {
      type: "error",
      title: "Erro inicial"
    });
  }
}

boot();
