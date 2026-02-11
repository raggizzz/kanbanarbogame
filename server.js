require("dotenv").config({ quiet: true });

const express = require("express");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3333;

const IS_VERCEL = Boolean(process.env.VERCEL);
const RUNTIME_DATA_ROOT =
  process.env.DATA_DIR || (IS_VERCEL ? path.join("/tmp", "arbogame-jira") : __dirname);
const DATA_DIR = path.join(RUNTIME_DATA_ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const SUPABASE_ENABLED = String(process.env.SUPABASE_ENABLED || "false").toLowerCase() === "true";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const USE_SUPABASE = SUPABASE_ENABLED && Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);
const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

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

const DEFAULT_PROJECT = {
  id: "project-arbogame",
  key: "ARBO",
  name: "ArboGame",
  description: "Projeto principal do ArboGame"
};

const DEFAULT_SPRINTS = [
  {
    id: "sprint-1",
    name: "Sprint 1 - Core Loop",
    goal: "Estabilizar loop principal do jogo",
    state: "active",
    startDate: "2026-02-10",
    endDate: "2026-02-24"
  },
  {
    id: "sprint-2",
    name: "Sprint 2 - Economia",
    goal: "Implantar sistema de economia inicial",
    state: "planned",
    startDate: "2026-02-25",
    endDate: "2026-03-10"
  }
];

const DEFAULT_ISSUES = [
  {
    id: "ARBO-1",
    title: "Implementar sistema de login",
    description: "Criar autenticacao de jogador com sessao persistente.",
    type: "Story",
    status: "In Progress",
    priority: "High",
    assignee: "Bruno",
    reporter: "Antonio - PM",
    labels: ["backend", "auth"],
    storyPoints: 5,
    sprintId: "sprint-1"
  },
  {
    id: "ARBO-2",
    title: "Corrigir travamento no inventario",
    description: "Aplicacao trava ao arrastar itens rapidamente.",
    type: "Bug",
    status: "To Do",
    priority: "Highest",
    assignee: "Arthur",
    reporter: "Raissa",
    labels: ["frontend", "inventory"],
    storyPoints: 3,
    sprintId: "sprint-1"
  },
  {
    id: "ARBO-3",
    title: "Definir economia inicial",
    description: "Modelar moedas e precos base da loja.",
    type: "Task",
    status: "Backlog",
    priority: "Medium",
    assignee: "Igor",
    reporter: "Antonio - PM",
    labels: ["design", "economy"],
    storyPoints: 8,
    sprintId: "sprint-2"
  }
];

const DEFAULT_COMMENTS = [
  {
    id: "comment-1",
    issueId: "ARBO-2",
    author: "Raissa",
    body: "Reproduz em ambiente local com 100% de frequencia."
  }
];

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function nowISO() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
  const fieldExists = (field) => Object.prototype.hasOwnProperty.call(payload, field);

  if ((required || fieldExists("title")) && !String(payload.title || "").trim()) {
    errors.push("title e obrigatorio");
  }
  if ((required || fieldExists("type")) && !TYPES.includes(String(payload.type || ""))) {
    errors.push(`type deve ser um de: ${TYPES.join(", ")}`);
  }
  if ((required || fieldExists("status")) && !STATUSES.includes(String(payload.status || ""))) {
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
      errors.push("storyPoints deve ser um numero entre 0 e 100");
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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
      project: clone(DEFAULT_PROJECT),
      users: clone(DEFAULT_USERS),
      sprints: DEFAULT_SPRINTS.map((sprint) => ({
        ...clone(sprint),
        createdAt,
        updatedAt: createdAt
      })),
      issues: DEFAULT_ISSUES.map((issue) => ({
        ...clone(issue),
        createdAt,
        updatedAt: createdAt
      })),
      comments: DEFAULT_COMMENTS.map((comment) => ({
        ...clone(comment),
        createdAt
      }))
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readDb() {
  ensureDataFile();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.users = [...new Set([...(db.users || []), ...DEFAULT_USERS])];
  return db;
}

function writeDb(nextDb) {
  nextDb.meta.updatedAt = nowISO();
  fs.writeFileSync(DB_FILE, JSON.stringify(nextDb, null, 2), "utf8");
}

function mapSprintRow(row) {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal || "",
    state: row.state,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapIssueRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    type: row.type,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee || "Unassigned",
    reporter: row.reporter || "Antonio - PM",
    labels: Array.isArray(row.labels) ? row.labels : [],
    storyPoints: Number(row.story_points || 0),
    sprintId: row.sprint_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCommentRow(row) {
  return {
    id: row.id,
    issueId: row.issue_id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at
  };
}

function throwIfSupabaseError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function upsertSupabaseUsers(names) {
  const uniqueNames = [...new Set(names.filter(Boolean).map((n) => String(n).trim()))];
  if (uniqueNames.length === 0) return;
  const payload = uniqueNames.map((name) => ({ name }));
  const { error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "name", ignoreDuplicates: true });
  throwIfSupabaseError(error, "Falha ao atualizar usuarios");
}

let supabaseInitPromise = null;

async function ensureSupabaseInitialized() {
  if (!USE_SUPABASE) return;
  if (!supabaseInitPromise) {
    supabaseInitPromise = (async () => {
      const createdAt = nowISO();

      const { error: projectError } = await supabase
        .from("projects")
        .upsert(
          [
            {
              id: DEFAULT_PROJECT.id,
              key: DEFAULT_PROJECT.key,
              name: DEFAULT_PROJECT.name,
              description: DEFAULT_PROJECT.description
            }
          ],
          { onConflict: "id", ignoreDuplicates: true }
        );
      throwIfSupabaseError(projectError, "Falha ao iniciar projeto");

      await upsertSupabaseUsers(DEFAULT_USERS);

      const sprintSeed = DEFAULT_SPRINTS.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        state: s.state,
        start_date: s.startDate,
        end_date: s.endDate,
        created_at: createdAt,
        updated_at: createdAt
      }));
      const { error: sprintError } = await supabase
        .from("sprints")
        .upsert(sprintSeed, { onConflict: "id", ignoreDuplicates: true });
      throwIfSupabaseError(sprintError, "Falha ao iniciar sprints");

      const issueSeed = DEFAULT_ISSUES.map((issue) => ({
        id: issue.id,
        project_id: DEFAULT_PROJECT.id,
        title: issue.title,
        description: issue.description,
        type: issue.type,
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee,
        reporter: issue.reporter,
        labels: issue.labels,
        story_points: issue.storyPoints,
        sprint_id: issue.sprintId || null,
        created_at: createdAt,
        updated_at: createdAt
      }));
      const { error: issueError } = await supabase
        .from("issues")
        .upsert(issueSeed, { onConflict: "id", ignoreDuplicates: true });
      throwIfSupabaseError(issueError, "Falha ao iniciar issues");

      const commentSeed = DEFAULT_COMMENTS.map((comment) => ({
        id: comment.id,
        issue_id: comment.issueId,
        author: comment.author,
        body: comment.body,
        created_at: createdAt
      }));
      const { error: commentError } = await supabase
        .from("comments")
        .upsert(commentSeed, { onConflict: "id", ignoreDuplicates: true });
      throwIfSupabaseError(commentError, "Falha ao iniciar comentarios");
    })().catch((error) => {
      supabaseInitPromise = null;
      throw error;
    });
  }

  await supabaseInitPromise;
}

function isUsingSupabase() {
  return USE_SUPABASE;
}

async function ensureProviderReady() {
  if (USE_SUPABASE) {
    await ensureSupabaseInitialized();
    return;
  }
  ensureDataFile();
}

async function getProject() {
  if (!USE_SUPABASE) {
    return readDb().project;
  }
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", DEFAULT_PROJECT.id)
    .maybeSingle();
  throwIfSupabaseError(error, "Falha ao carregar projeto");
  if (!data) return clone(DEFAULT_PROJECT);
  return {
    id: data.id,
    key: data.key,
    name: data.name,
    description: data.description || ""
  };
}

async function getUsers() {
  if (!USE_SUPABASE) {
    const db = readDb();
    return [...new Set([...(db.users || []), ...DEFAULT_USERS])];
  }
  const { data, error } = await supabase.from("users").select("name").order("name");
  throwIfSupabaseError(error, "Falha ao carregar usuarios");
  return [...new Set([...(data || []).map((row) => row.name), ...DEFAULT_USERS])];
}

async function listSprints() {
  if (!USE_SUPABASE) {
    const db = readDb();
    return clone(db.sprints).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .order("start_date", { ascending: true });
  throwIfSupabaseError(error, "Falha ao listar sprints");
  return safeArray(data).map(mapSprintRow);
}

async function createSprint(payload) {
  const { name, goal = "", state = "planned", startDate, endDate } = payload;
  if (!String(name || "").trim()) {
    throw new Error("name e obrigatorio");
  }
  if (!["planned", "active", "closed"].includes(String(state))) {
    throw new Error("state invalido");
  }
  if (!startDate || !endDate) {
    throw new Error("startDate e endDate sao obrigatorios (YYYY-MM-DD)");
  }

  if (!USE_SUPABASE) {
    const db = readDb();
    const stamp = nowISO();
    const sprint = {
      id: `sprint-${Date.now()}`,
      name: String(name).trim(),
      goal: String(goal || "").trim(),
      state: String(state),
      startDate: String(startDate),
      endDate: String(endDate),
      createdAt: stamp,
      updatedAt: stamp
    };
    db.sprints.push(sprint);
    writeDb(db);
    return sprint;
  }

  const stamp = nowISO();
  const row = {
    id: `sprint-${Date.now()}`,
    name: String(name).trim(),
    goal: String(goal || "").trim(),
    state: String(state),
    start_date: String(startDate),
    end_date: String(endDate),
    created_at: stamp,
    updated_at: stamp
  };
  const { data, error } = await supabase.from("sprints").insert([row]).select("*").single();
  throwIfSupabaseError(error, "Falha ao criar sprint");
  return mapSprintRow(data);
}

async function updateSprintById(id, payload) {
  if (!USE_SUPABASE) {
    const db = readDb();
    const sprint = db.sprints.find((item) => item.id === id);
    if (!sprint) return null;

    const { name, goal, state, startDate, endDate } = payload;
    if (name !== undefined) sprint.name = String(name).trim();
    if (goal !== undefined) sprint.goal = String(goal || "").trim();
    if (state !== undefined) {
      if (!["planned", "active", "closed"].includes(String(state))) {
        throw new Error("state invalido");
      }
      sprint.state = String(state);
    }
    if (startDate !== undefined) sprint.startDate = String(startDate);
    if (endDate !== undefined) sprint.endDate = String(endDate);
    sprint.updatedAt = nowISO();

    writeDb(db);
    return sprint;
  }

  const { data: existing, error: findError } = await supabase
    .from("sprints")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(findError, "Falha ao localizar sprint");
  if (!existing) return null;

  const patch = {};
  if (payload.name !== undefined) patch.name = String(payload.name).trim();
  if (payload.goal !== undefined) patch.goal = String(payload.goal || "").trim();
  if (payload.state !== undefined) {
    if (!["planned", "active", "closed"].includes(String(payload.state))) {
      throw new Error("state invalido");
    }
    patch.state = String(payload.state);
  }
  if (payload.startDate !== undefined) patch.start_date = String(payload.startDate);
  if (payload.endDate !== undefined) patch.end_date = String(payload.endDate);
  patch.updated_at = nowISO();

  const { data, error } = await supabase
    .from("sprints")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwIfSupabaseError(error, "Falha ao atualizar sprint");
  return mapSprintRow(data);
}

async function deleteSprintById(id) {
  if (!USE_SUPABASE) {
    const db = readDb();
    const index = db.sprints.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const [removed] = db.sprints.splice(index, 1);
    let affectedIssues = 0;
    for (const issue of db.issues) {
      if (issue.sprintId === removed.id) {
        issue.sprintId = "";
        issue.updatedAt = nowISO();
        affectedIssues += 1;
      }
    }
    writeDb(db);
    return { removedSprintId: removed.id, affectedIssues };
  }

  const { data: found, error: findError } = await supabase
    .from("sprints")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(findError, "Falha ao localizar sprint");
  if (!found) return null;

  const now = nowISO();
  const { data: affectedRows, error: updateError } = await supabase
    .from("issues")
    .update({ sprint_id: null, updated_at: now })
    .eq("sprint_id", id)
    .select("id");
  throwIfSupabaseError(updateError, "Falha ao desvincular issues da sprint");

  const { error: deleteError } = await supabase.from("sprints").delete().eq("id", id);
  throwIfSupabaseError(deleteError, "Falha ao excluir sprint");

  return {
    removedSprintId: id,
    affectedIssues: safeArray(affectedRows).length
  };
}

async function listIssues(filters = {}) {
  if (!USE_SUPABASE) {
    const db = readDb();
    let result = clone(db.issues);
    const { search, status, priority, assignee, type, sprintId } = filters;

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
    return result.map((issue) => issueWithComments(issue, db.comments));
  }

  let query = supabase.from("issues").select("*").order("created_at", { ascending: false });

  if (filters.status) query = query.in("status", normalizeList(filters.status));
  if (filters.priority) query = query.in("priority", normalizeList(filters.priority));
  if (filters.assignee) query = query.in("assignee", normalizeList(filters.assignee));
  if (filters.type) query = query.in("type", normalizeList(filters.type));
  if (filters.sprintId) {
    const ids = normalizeList(filters.sprintId).map((value) => (value ? value : null));
    query = query.in("sprint_id", ids);
  }

  const { data: issueRows, error: issueError } = await query;
  throwIfSupabaseError(issueError, "Falha ao listar issues");

  let mapped = safeArray(issueRows).map(mapIssueRow);

  if (filters.search) {
    const term = String(filters.search).toLowerCase();
    mapped = mapped.filter((issue) => {
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

  const ids = mapped.map((issue) => issue.id);
  let comments = [];
  if (ids.length > 0) {
    const { data: commentRows, error: commentError } = await supabase
      .from("comments")
      .select("*")
      .in("issue_id", ids);
    throwIfSupabaseError(commentError, "Falha ao listar comentarios");
    comments = safeArray(commentRows).map(mapCommentRow);
  }

  return mapped.map((issue) => issueWithComments(issue, comments));
}

async function getIssueById(id) {
  if (!USE_SUPABASE) {
    const db = readDb();
    const issue = db.issues.find((item) => item.id === id);
    if (!issue) return null;
    return issueWithComments(issue, db.comments);
  }

  const { data: issueRow, error: issueError } = await supabase
    .from("issues")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(issueError, "Falha ao carregar issue");
  if (!issueRow) return null;

  const { data: commentRows, error: commentError } = await supabase
    .from("comments")
    .select("*")
    .eq("issue_id", id)
    .order("created_at", { ascending: false });
  throwIfSupabaseError(commentError, "Falha ao carregar comentarios");

  return issueWithComments(mapIssueRow(issueRow), safeArray(commentRows).map(mapCommentRow));
}

async function generateNextIssueId(projectKey) {
  if (!USE_SUPABASE) {
    const db = readDb();
    const id = `${projectKey}-${db.meta.issueCounter}`;
    db.meta.issueCounter += 1;
    writeDb(db);
    return id;
  }

  const { data, error } = await supabase
    .from("issues")
    .select("id")
    .ilike("id", `${projectKey}-%`);
  throwIfSupabaseError(error, "Falha ao gerar id de issue");

  let max = 0;
  for (const row of safeArray(data)) {
    const match = String(row.id).match(/-(\d+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${projectKey}-${max + 1}`;
}

async function createIssue(payload) {
  const errors = validateIssuePayload(payload, "create");
  if (errors.length) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const project = await getProject();
  const id = await generateNextIssueId(project.key);
  const stamp = nowISO();

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

  if (!USE_SUPABASE) {
    const db = readDb();
    db.issues.push(issue);
    for (const name of [issue.assignee, issue.reporter]) {
      if (name && name !== "Unassigned" && !db.users.includes(name)) {
        db.users.push(name);
      }
    }
    writeDb(db);
    return issueWithComments(issue, db.comments);
  }

  const row = {
    id: issue.id,
    project_id: project.id,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    status: issue.status,
    priority: issue.priority,
    assignee: issue.assignee,
    reporter: issue.reporter,
    labels: issue.labels,
    story_points: issue.storyPoints,
    sprint_id: issue.sprintId || null,
    created_at: issue.createdAt,
    updated_at: issue.updatedAt
  };

  const { error } = await supabase.from("issues").insert([row]);
  throwIfSupabaseError(error, "Falha ao criar issue");
  await upsertSupabaseUsers([issue.assignee, issue.reporter].filter((n) => n !== "Unassigned"));
  return getIssueById(issue.id);
}

async function updateIssueById(id, payload) {
  const errors = validateIssuePayload(payload, "update");
  if (errors.length) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  if (!USE_SUPABASE) {
    const db = readDb();
    const issue = db.issues.find((item) => item.id === id);
    if (!issue) return null;

    const updatable = [
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
    for (const field of updatable) {
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

    for (const name of [issue.assignee, issue.reporter]) {
      if (name && name !== "Unassigned" && !db.users.includes(name)) {
        db.users.push(name);
      }
    }

    writeDb(db);
    return issueWithComments(issue, db.comments);
  }

  const { data: existing, error: findError } = await supabase
    .from("issues")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(findError, "Falha ao localizar issue");
  if (!existing) return null;

  const patch = { updated_at: nowISO() };
  const mapFields = {
    title: "title",
    description: "description",
    type: "type",
    status: "status",
    priority: "priority",
    assignee: "assignee",
    reporter: "reporter",
    sprintId: "sprint_id",
    storyPoints: "story_points"
  };
  for (const [key, column] of Object.entries(mapFields)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      if (key === "storyPoints") {
        patch[column] = Number(payload[key] || 0);
      } else if (key === "sprintId") {
        patch[column] = String(payload[key] || "").trim() || null;
      } else {
        patch[column] = String(payload[key] || "").trim();
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "labels")) {
    patch.labels = normalizeList(payload.labels);
  }

  const { error } = await supabase.from("issues").update(patch).eq("id", id);
  throwIfSupabaseError(error, "Falha ao atualizar issue");

  const assigneeName = patch.assignee || "";
  const reporterName = patch.reporter || "";
  await upsertSupabaseUsers([assigneeName, reporterName].filter((n) => n && n !== "Unassigned"));

  return getIssueById(id);
}

async function deleteIssueById(id) {
  if (!USE_SUPABASE) {
    const db = readDb();
    const index = db.issues.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const [removed] = db.issues.splice(index, 1);
    db.comments = db.comments.filter((comment) => comment.issueId !== removed.id);
    writeDb(db);
    return { removedId: removed.id };
  }

  const { data: existing, error: findError } = await supabase
    .from("issues")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(findError, "Falha ao localizar issue");
  if (!existing) return null;

  const { error: commentsDeleteError } = await supabase.from("comments").delete().eq("issue_id", id);
  throwIfSupabaseError(commentsDeleteError, "Falha ao excluir comentarios da issue");

  const { error: issueDeleteError } = await supabase.from("issues").delete().eq("id", id);
  throwIfSupabaseError(issueDeleteError, "Falha ao excluir issue");
  return { removedId: id };
}

async function createComment(issueId, payload) {
  const author = String(payload.author || "Igor").trim() || "Igor";
  const body = String(payload.body || "").trim();
  if (!body) {
    const error = new Error("body e obrigatorio");
    error.statusCode = 400;
    throw error;
  }

  const issue = await getIssueById(issueId);
  if (!issue) return null;

  const comment = {
    id: `comment-${Date.now()}`,
    issueId,
    author,
    body,
    createdAt: nowISO()
  };

  if (!USE_SUPABASE) {
    const db = readDb();
    db.comments.push(comment);
    if (author && !db.users.includes(author)) db.users.push(author);
    writeDb(db);
    return comment;
  }

  const row = {
    id: comment.id,
    issue_id: comment.issueId,
    author: comment.author,
    body: comment.body,
    created_at: comment.createdAt
  };
  const { error } = await supabase.from("comments").insert([row]);
  throwIfSupabaseError(error, "Falha ao criar comentario");
  await upsertSupabaseUsers([author]);
  return comment;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get(
  "/api/health",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    res.json({
      ok: true,
      provider: USE_SUPABASE ? "supabase" : "local",
      timestamp: nowISO()
    });
  })
);

app.get(
  "/api/meta",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const users = await getUsers();
    res.json({
      statuses: STATUSES,
      priorities: PRIORITIES,
      types: TYPES,
      users
    });
  })
);

app.get(
  "/api/realtime-config",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    res.json({
      enabled: USE_SUPABASE,
      supabaseUrl: USE_SUPABASE ? SUPABASE_URL : "",
      supabaseAnonKey: USE_SUPABASE ? SUPABASE_ANON_KEY : ""
    });
  })
);

app.get(
  "/api/project",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    res.json(await getProject());
  })
);

app.get(
  "/api/sprints",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    res.json(await listSprints());
  })
);

app.post(
  "/api/sprints",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const sprint = await createSprint(req.body || {});
    res.status(201).json(sprint);
  })
);

app.patch(
  "/api/sprints/:id",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const sprint = await updateSprintById(req.params.id, req.body || {});
    if (!sprint) {
      return res.status(404).json({ error: "Sprint nao encontrada" });
    }
    res.json(sprint);
  })
);

app.delete(
  "/api/sprints/:id",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const removed = await deleteSprintById(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: "Sprint nao encontrada" });
    }
    res.json({ ok: true, ...removed });
  })
);

app.get(
  "/api/issues",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    res.json(await listIssues(req.query || {}));
  })
);

app.get(
  "/api/issues/:id",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const issue = await getIssueById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: "Issue nao encontrada" });
    }
    res.json(issue);
  })
);

app.post(
  "/api/issues",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const issue = await createIssue(req.body || {});
    res.status(201).json(issue);
  })
);

app.patch(
  "/api/issues/:id",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const issue = await updateIssueById(req.params.id, req.body || {});
    if (!issue) {
      return res.status(404).json({ error: "Issue nao encontrada" });
    }
    res.json(issue);
  })
);

app.delete(
  "/api/issues/:id",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const removed = await deleteIssueById(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: "Issue nao encontrada" });
    }
    res.json({ ok: true, ...removed });
  })
);

app.post(
  "/api/issues/:id/comments",
  asyncRoute(async (req, res) => {
    await ensureProviderReady();
    const comment = await createComment(req.params.id, req.body || {});
    if (!comment) {
      return res.status(404).json({ error: "Issue nao encontrada" });
    }
    res.status(201).json(comment);
  })
);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
  const statusCode = Number(error.statusCode) || 500;
  if (req.path.startsWith("/api/")) {
    return res.status(statusCode).json({ error: error.message || "Erro interno" });
  }
  res.status(statusCode).send("Internal Server Error");
});

if (require.main === module) {
  ensureProviderReady()
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          `ArboGame Jira running at http://localhost:${PORT} (provider: ${
            USE_SUPABASE ? "supabase" : "local"
          })`
        );
      });
    })
    .catch((error) => {
      console.error("Failed to initialize provider:", error.message);
      process.exit(1);
    });
}

module.exports = {
  app,
  ensureDataFile,
  readDb,
  writeDb,
  DB_FILE,
  isUsingSupabase
};

