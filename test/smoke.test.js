const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_ENABLED = "false";

const { app, ensureDataFile } = require("../server");

ensureDataFile();

test("API smoke test end-to-end", async () => {
  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const data = await response.json();
    return { response, data };
  }

  try {
    const health = await request("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.data.ok, true);

    const createdSprint = await request("/api/sprints", {
      method: "POST",
      body: JSON.stringify({
        name: "Sprint Smoke",
        goal: "Validar criacao e exclusao de sprint",
        state: "planned",
        startDate: "2026-02-11",
        endDate: "2026-02-25"
      })
    });
    assert.equal(createdSprint.response.status, 201);
    const sprintId = createdSprint.data.id;
    assert.ok(sprintId);

    const created = await request("/api/issues", {
      method: "POST",
      body: JSON.stringify({
        title: "Smoke test issue",
        description: "Issue criada por teste automático",
        type: "Task",
        status: "To Do",
        priority: "Low",
        assignee: "Smoke Tester",
        reporter: "Smoke Tester",
        sprintId,
        storyPoints: 1,
        labels: ["smoke", "test"]
      })
    });
    assert.equal(created.response.status, 201);
    const issueId = created.data.id;
    assert.ok(issueId);

    const moved = await request(`/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "In Progress" })
    });
    assert.equal(moved.response.status, 200);
    assert.equal(moved.data.status, "In Progress");

    const commented = await request(`/api/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        author: "Smoke Tester",
        body: "Comentário de validação"
      })
    });
    assert.equal(commented.response.status, 201);

    const loaded = await request(`/api/issues/${issueId}`);
    assert.equal(loaded.response.status, 200);
    assert.equal(loaded.data.id, issueId);
    assert.ok(Array.isArray(loaded.data.comments));
    assert.ok(loaded.data.comments.length > 0);

    const removedSprint = await request(`/api/sprints/${sprintId}`, { method: "DELETE" });
    assert.equal(removedSprint.response.status, 200);
    assert.equal(removedSprint.data.removedSprintId, sprintId);
    assert.ok(removedSprint.data.affectedIssues >= 1);

    const loadedAfterSprintDelete = await request(`/api/issues/${issueId}`);
    assert.equal(loadedAfterSprintDelete.response.status, 200);
    assert.equal(loadedAfterSprintDelete.data.sprintId, "");

    const removed = await request(`/api/issues/${issueId}`, { method: "DELETE" });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.data.removedId, issueId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
