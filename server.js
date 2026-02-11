const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3333;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const STATUSES = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
const PRIORITIES = ["Lowest", "Low", "Medium", "High", "Highest"];
const TYPES = ["Story", "Task", "Bug", "Epic"];
const DEFAULT_USERS = [
  "Antonio - PM",
  "Igor",
  "Bruno",
  "Arthur",
  "Xavier",
  "Raissa",
  "Jasmine"
];

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function nowISO() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const createdAt = nowISO();
    const initial = {
      meta: {
        createdAt,
        updatedAt: createdAt,
        issueCounter: 4
      },
      project: {
        id: "project-arbogame",
        key: "ARBO",
        name: "ArboGame",
        description: "Projeto principal do ArboGame"
      },
      users: clone(DEFAULT_USERS),
      sprints: [
        {
          id: "sprint-1",
          name: "Sprint 1 - Core Loop",
          goal: "Estabilizar loop principal do jogo",
          state: "active",
          startDate: "2026-02-10",
          endDate: "2026-02-24",
          createdAt,
          updatedAt: createdAt
        },
        {
          id: "sprint-2",
          name: "Sprint 2 - Economia",
          goal: "Implantar sistema de economia inicial",
          state: "planned",
          startDate: "2026-02-25",
          endDate: "2026-03-10",
          createdAt,
          updatedAt: createdAt
        }
      ],
      issues: [
        {
          id: "ARBO-1",
          title: "Implementar sistema de login",
          description: "Criar autenticação de jogador com sessão persistente.",
          type: "Story",
          status: "In Progress",
          priority: "High",
          assignee: "Bruno",
          reporter: "Antonio - PM",
          labels: ["backend", "auth"],
          storyPoints: 5,
          sprintId: "sprint-1",
          createdAt,
          updatedAt: createdAt
        },
        {
          id: "ARBO-2",
          title: "Corrigir travamento no inventário",
          description: "Aplicação trava ao arrastar itens rapidamente.",
          type: "Bug",
          status: "To Do",
          priority: "Highest",
          assignee: "Arthur",
          reporter: "Raissa",
          labels: ["frontend", "inventory"],
          storyPoints: 3,
          sprintId: "sprint-1",
          createdAt,
          updatedAt: createdAt
        },
        {
          id: "ARBO-3",
          title: "Definir economia inicial",
          description: "Modelar moedas e preços base da loja.",
          type: "Task",
          status: "Backlog",
          priority: "Medium",
          assignee: "Igor",
          reporter: "Antonio - PM",
          labels: ["design", "economy"],
          storyPoints: 8,
          sprintId: "sprint-2",
          createdAt,
          updatedAt: createdAt
        }
      ],
      comments: [
        {
          id: "comment-1",
          issueId: "ARBO-2",
          author: "Raissa",
          body: "Reproduz em ambiente local com 100% de frequência.",
          createdAt
        }
      ]
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readDb() {
  ensureDataFile();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const aliasMap = {
    "Dev 1": "Bruno",
    "Dev 2": "Arthur",
    QA: "Raissa",
    "Product Owner": "Antonio - PM"
  };

  let changed = false;

  for (const issue of db.issues || []) {
    if (aliasMap[issue.assignee]) {
      issue.assignee = aliasMap[issue.assignee];
      changed = true;
    }
    if (aliasMap[issue.reporter]) {
      issue.reporter = aliasMap[issue.reporter];
      changed = true;
    }
  }

  for (const comment of db.comments || []) {
    if (aliasMap[comment.author]) {
      comment.author = aliasMap[comment.author];
      changed = true;
    }
  }

  const activeUsers = (db.issues || [])
    .flatMap((issue) => [issue.assignee, issue.reporter])
    .map((item) => String(item || "").trim())
    .filter((item) => item && item !== "Unassigned");
  const normalizedUsers = [...new Set([...DEFAULT_USERS, ...activeUsers])];

  if (
    normalizedUsers.length !== (db.users || []).length ||
    normalizedUsers.some((user, index) => user !== (db.users || [])[index])
  ) {
    db.users = normalizedUsers;
    changed = true;
  }

  if (changed) {
    writeDb(db);
  }

  return db;
}

function writeDb(nextDb) {
  nextDb.meta.updatedAt = nowISO();
  fs.writeFileSync(DB_FILE, JSON.stringify(nextDb, null, 2), "utf8");
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function validateIssuePayload(payload, mode = "create") {
  const errors = [];
  const required = mode === "create";

  const fieldExists = (field) =>
    Object.prototype.hasOwnProperty.call(payload, field);

  if ((required || fieldExists("title")) && !String(payload.title || "").trim()) {
    errors.push("title é obrigatório");
  }
  if (
    (required || fieldExists("type")) &&
    !TYPES.includes(String(payload.type || ""))
  ) {
    errors.push(`type deve ser um de: ${TYPES.join(", ")}`);
  }
  if (
    (required || fieldExists("status")) &&
    !STATUSES.includes(String(payload.status || ""))
  ) {
    errors.push(`status deve ser um de: ${STATUSES.join(", ")}`);
  }
  if (
    (required || fieldExists("priority")) &&
    !PRIORITIES.includes(String(payload.priority || ""))
  ) {
    errors.push(`priority deve ser um de: ${PRIORITIES.join(", ")}`);
  }

  if (fieldExists("storyPoints")) {
    const points = Number(payload.storyPoints);
    if (!Number.isFinite(points) || points < 0 || points > 100) {
      errors.push("storyPoints deve ser um número entre 0 e 100");
    }
  }

  return errors;
}

function issueWithComments(issue, comments) {
  return {
    ...issue,
    comments: comments.filter((comment) => comment.issueId === issue.id)
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: nowISO() });
});

app.get("/api/meta", (req, res) => {
  const db = readDb();
  res.json({
    statuses: STATUSES,
    priorities: PRIORITIES,
    types: TYPES,
    users: db.users
  });
});

app.get("/api/project", (req, res) => {
  const db = readDb();
  res.json(db.project);
});

app.get("/api/sprints", (req, res) => {
  const db = readDb();
  const items = clone(db.sprints).sort((a, b) => a.startDate.localeCompare(b.startDate));
  res.json(items);
});

app.post("/api/sprints", (req, res) => {
  const { name, goal = "", state = "planned", startDate, endDate } = req.body || {};
  if (!String(name || "").trim()) {
    return res.status(400).json({ error: "name é obrigatório" });
  }
  if (!["planned", "active", "closed"].includes(String(state))) {
    return res.status(400).json({ error: "state inválido" });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate e endDate são obrigatórios (YYYY-MM-DD)" });
  }

  const db = readDb();
  const stamp = nowISO();
  const sprint = {
    id: `sprint-${Date.now()}`,
    name: String(name).trim(),
    goal: String(goal || "").trim(),
    state,
    startDate: String(startDate),
    endDate: String(endDate),
    createdAt: stamp,
    updatedAt: stamp
  };
  db.sprints.push(sprint);
  writeDb(db);
  res.status(201).json(sprint);
});

app.patch("/api/sprints/:id", (req, res) => {
  const db = readDb();
  const sprint = db.sprints.find((s) => s.id === req.params.id);
  if (!sprint) {
    return res.status(404).json({ error: "Sprint não encontrada" });
  }

  const { name, goal, state, startDate, endDate } = req.body || {};

  if (name !== undefined) sprint.name = String(name).trim();
  if (goal !== undefined) sprint.goal = String(goal || "").trim();
  if (state !== undefined) {
    if (!["planned", "active", "closed"].includes(String(state))) {
      return res.status(400).json({ error: "state inválido" });
    }
    sprint.state = String(state);
  }
  if (startDate !== undefined) sprint.startDate = String(startDate);
  if (endDate !== undefined) sprint.endDate = String(endDate);
  sprint.updatedAt = nowISO();
  writeDb(db);
  res.json(sprint);
});

app.delete("/api/sprints/:id", (req, res) => {
  const db = readDb();
  const index = db.sprints.findIndex((s) => s.id === req.params.id);
  if (index < 0) {
    return res.status(404).json({ error: "Sprint nao encontrada" });
  }

  const [removedSprint] = db.sprints.splice(index, 1);
  let affectedIssues = 0;
  for (const issue of db.issues) {
    if (issue.sprintId === removedSprint.id) {
      issue.sprintId = "";
      issue.updatedAt = nowISO();
      affectedIssues += 1;
    }
  }

  writeDb(db);
  res.json({
    ok: true,
    removedSprintId: removedSprint.id,
    affectedIssues
  });
});

app.get("/api/issues", (req, res) => {
  const db = readDb();
  let result = clone(db.issues);

  const { search, status, priority, assignee, type, sprintId } = req.query;

  if (status) {
    const statuses = normalizeList(status);
    result = result.filter((issue) => statuses.includes(issue.status));
  }
  if (priority) {
    const priorities = normalizeList(priority);
    result = result.filter((issue) => priorities.includes(issue.priority));
  }
  if (assignee) {
    const assignees = normalizeList(assignee).map((item) => item.toLowerCase());
    result = result.filter((issue) =>
      assignees.includes(String(issue.assignee || "").toLowerCase())
    );
  }
  if (type) {
    const types = normalizeList(type);
    result = result.filter((issue) => types.includes(issue.type));
  }
  if (sprintId) {
    const sprints = normalizeList(sprintId);
    result = result.filter((issue) => sprints.includes(issue.sprintId || ""));
  }
  if (search) {
    const term = String(search).toLowerCase();
    result = result.filter((issue) => {
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
      return haystack.includes(term);
    });
  }

  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(result.map((issue) => issueWithComments(issue, db.comments)));
});

app.get("/api/issues/:id", (req, res) => {
  const db = readDb();
  const issue = db.issues.find((item) => item.id === req.params.id);
  if (!issue) {
    return res.status(404).json({ error: "Issue não encontrada" });
  }
  res.json(issueWithComments(issue, db.comments));
});

app.post("/api/issues", (req, res) => {
  const payload = req.body || {};
  const errors = validateIssuePayload(payload, "create");
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const db = readDb();
  const stamp = nowISO();
  const id = `${db.project.key}-${db.meta.issueCounter}`;
  db.meta.issueCounter += 1;

  const issue = {
    id,
    title: String(payload.title).trim(),
    description: String(payload.description || "").trim(),
    type: String(payload.type),
    status: String(payload.status),
    priority: String(payload.priority),
    assignee: String(payload.assignee || "").trim() || "Unassigned",
    reporter: String(payload.reporter || "").trim() || "Antonio - PM",
    labels: normalizeList(payload.labels),
    storyPoints: Number(payload.storyPoints || 0),
    sprintId: String(payload.sprintId || ""),
    createdAt: stamp,
    updatedAt: stamp
  };

  if (issue.assignee !== "Unassigned" && !db.users.includes(issue.assignee)) {
    db.users.push(issue.assignee);
  }
  if (issue.reporter && !db.users.includes(issue.reporter)) {
    db.users.push(issue.reporter);
  }

  db.issues.push(issue);
  writeDb(db);
  res.status(201).json(issueWithComments(issue, db.comments));
});

app.patch("/api/issues/:id", (req, res) => {
  const payload = req.body || {};
  const errors = validateIssuePayload(payload, "update");
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const db = readDb();
  const issue = db.issues.find((item) => item.id === req.params.id);
  if (!issue) {
    return res.status(404).json({ error: "Issue não encontrada" });
  }

  const updatableFields = [
    "title",
    "description",
    "type",
    "status",
    "priority",
    "assignee",
    "reporter",
    "sprintId",
    "storyPoints"
  ];

  for (const field of updatableFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      if (field === "storyPoints") {
        issue[field] = Number(payload[field] || 0);
      } else {
        issue[field] = String(payload[field] || "").trim();
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "labels")) {
    issue.labels = normalizeList(payload.labels);
  }

  issue.updatedAt = nowISO();

  if (issue.assignee && issue.assignee !== "Unassigned" && !db.users.includes(issue.assignee)) {
    db.users.push(issue.assignee);
  }
  if (issue.reporter && !db.users.includes(issue.reporter)) {
    db.users.push(issue.reporter);
  }

  writeDb(db);
  res.json(issueWithComments(issue, db.comments));
});

app.delete("/api/issues/:id", (req, res) => {
  const db = readDb();
  const index = db.issues.findIndex((item) => item.id === req.params.id);
  if (index < 0) {
    return res.status(404).json({ error: "Issue não encontrada" });
  }
  const [removed] = db.issues.splice(index, 1);
  db.comments = db.comments.filter((comment) => comment.issueId !== removed.id);
  writeDb(db);
  res.json({ ok: true, removedId: removed.id });
});

app.post("/api/issues/:id/comments", (req, res) => {
  const { author, body } = req.body || {};
  if (!String(body || "").trim()) {
    return res.status(400).json({ error: "body é obrigatório" });
  }

  const db = readDb();
  const issue = db.issues.find((item) => item.id === req.params.id);
  if (!issue) {
    return res.status(404).json({ error: "Issue não encontrada" });
  }

  const comment = {
    id: `comment-${Date.now()}`,
    issueId: issue.id,
    author: String(author || "Igor").trim() || "Igor",
    body: String(body).trim(),
    createdAt: nowISO()
  };

  db.comments.push(comment);
  writeDb(db);
  res.status(201).json(comment);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  ensureDataFile();
  app.listen(PORT, () => {
    console.log(`ArboGame Jira running at http://localhost:${PORT}`);
  });
}

module.exports = { app, ensureDataFile, readDb, writeDb, DB_FILE };
