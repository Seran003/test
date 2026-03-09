const appEl = document.getElementById("app");
const modalBackdropEl = document.getElementById("modalBackdrop");
const modalContentEl = document.getElementById("modalContent");

const state = {
  view: "landing",
  bids: [],
  projects: [],
  workOrders: [],
  tasks: [],
  selectedBidId: "",
  selectedProjectId: "",
  selectedWorkOrderId: "",
  me: "USR-003",
  lastResponse: null
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["complete", "approved", "paid", "done"].includes(s)) return "badge badge-complete";
  if (["in_progress", "assigned", "submitted", "active"].includes(s)) return "badge badge-progress";
  if (["blocked", "rejected"].includes(s)) return "badge badge-warn";
  return "badge badge-draft";
}

function routeTo(view) {
  state.view = view;
  render();
}

async function refreshAll() {
  const [bids, projects, workOrders, tasks] = await Promise.all([
    api("/bids"),
    api("/projects"),
    api("/work-orders"),
    api(`/my-tasks?userId=${encodeURIComponent(state.me)}`)
  ]);
  state.bids = bids;
  state.projects = projects;
  state.workOrders = workOrders;
  state.tasks = tasks;
  if (!state.selectedBidId && bids[0]) state.selectedBidId = bids[0].BidId;
  if (!state.selectedProjectId && projects[0]) state.selectedProjectId = projects[0].ProjectId;
  if (!state.selectedWorkOrderId && workOrders[0]) state.selectedWorkOrderId = workOrders[0].WorkOrderId;
}

function showModal(title, html) {
  modalContentEl.innerHTML = `
    <h3>${title}</h3>
    ${html}
    <div class="btn-row">
      <button class="btn-neutral" onclick="hideModal()">Close</button>
    </div>
  `;
  modalBackdropEl.style.display = "flex";
}

function hideModal() {
  modalBackdropEl.style.display = "none";
}

modalBackdropEl.addEventListener("click", (e) => {
  if (e.target === modalBackdropEl) hideModal();
});

async function createBidFromModal() {
  const payload = {
    CustomerId: document.getElementById("mBidCustomerId").value,
    BidTitle: document.getElementById("mBidTitle").value,
    BidOwnerUserId: document.getElementById("mBidOwner").value,
    EstimatorUserId: document.getElementById("mEstimator").value,
    DueDate: document.getElementById("mBidDue").value
  };
  const bid = await api("/bids", { method: "POST", body: JSON.stringify(payload) });
  state.lastResponse = bid;
  hideModal();
  await refreshAll();
  routeTo("bids");
}

function openCreateBidModal() {
  showModal(
    "Create Bid",
    `
      <div class="field"><label>Customer ID</label><input id="mBidCustomerId" value="CUST-0001" /></div>
      <div class="field"><label>Bid Title</label><input id="mBidTitle" value="New HVAC Bid" /></div>
      <div class="field"><label>Bid Owner UserId</label><input id="mBidOwner" value="USR-001" /></div>
      <div class="field"><label>Estimator UserId</label><input id="mEstimator" value="USR-003" /></div>
      <div class="field"><label>Due Date</label><input id="mBidDue" value="2026-03-15" /></div>
      <div class="btn-row"><button class="btn-primary" onclick="createBidFromModal()">Create</button></div>
    `
  );
}

async function assignSelectedBid() {
  if (!state.selectedBidId) return;
  const result = await api(`/bids/${state.selectedBidId}/assign`, {
    method: "POST",
    body: JSON.stringify({
      AssignedUserId: "USR-003",
      AssignedRole: "estimator",
      TaskTitle: "Complete bid pricing and submit"
    })
  });
  state.lastResponse = result;
  await refreshAll();
  render();
}

async function convertSelectedBid() {
  if (!state.selectedBidId) return;
  const result = await api(`/bids/${state.selectedBidId}/convert-to-project`, {
    method: "POST",
    body: JSON.stringify({ ProjectManagerUserId: "USR-002" })
  });
  state.lastResponse = result;
  await refreshAll();
  routeTo("projects");
}

async function createWorkOrderQuick() {
  if (!state.selectedProjectId) return;
  const projectWorkOrders = state.workOrders.filter((w) => w.ProjectId === state.selectedProjectId);
  const selectedProject = state.projects.find((p) => p.ProjectId === state.selectedProjectId);
  const phaseGuess = projectWorkOrders[0]?.ProjectPhaseId || "PP-0001";
  const result = await api("/work-orders", {
    method: "POST",
    body: JSON.stringify({
      ProjectId: state.selectedProjectId,
      ProjectPhaseId: phaseGuess,
      Title: `${selectedProject?.ProjectName || "Project"} - New Work Order`,
      AssignedUserId: "USR-005",
      InstallerUserId: "USR-005"
    })
  });
  state.lastResponse = result;
  await refreshAll();
  routeTo("workorders");
}

async function assignSelectedWorkOrder() {
  if (!state.selectedWorkOrderId) return;
  const result = await api(`/work-orders/${state.selectedWorkOrderId}/assign`, {
    method: "POST",
    body: JSON.stringify({
      AssignedUserId: "USR-005",
      InstallerUserId: "USR-005",
      TaskTitle: "Execute assigned work order"
    })
  });
  state.lastResponse = result;
  await refreshAll();
  render();
}

async function completeTask(taskId) {
  const result = await api(`/assignments/${taskId}/complete`, { method: "POST" });
  state.lastResponse = result;
  await refreshAll();
  routeTo("tasks");
}

function nav() {
  return `
    <div class="btn-row">
      <button class="btn-neutral" onclick="routeTo('landing')">Hub</button>
      <button class="btn-outline" onclick="routeTo('bids')">Bids</button>
      <button class="btn-outline" onclick="routeTo('projects')">Projects</button>
      <button class="btn-outline" onclick="routeTo('workorders')">Work Orders</button>
      <button class="btn-outline" onclick="routeTo('tasks')">My Tasks</button>
      <button class="btn-outline" onclick="reloadData()">Refresh</button>
    </div>
  `;
}

function renderLanding() {
  return `
    <section class="card-grid">
      <article class="card">
        <h2>Bids Desk</h2>
        <p class="muted">Create bids, assign estimator tasks, convert approved bids to projects.</p>
        <div class="btn-row"><button class="btn-primary" onclick="routeTo('bids')">Open Bids</button></div>
      </article>
      <article class="card">
        <h2>Projects and Work Orders</h2>
        <p class="muted">Track active projects, assign installers, and manage work order status.</p>
        <div class="btn-row"><button class="btn-primary" onclick="routeTo('projects')">Open Projects</button></div>
      </article>
      <article class="card">
        <h2>Task Inbox</h2>
        <p class="muted">Task-driven completion flow for bid and work order assignments.</p>
        <div class="btn-row"><button class="btn-primary" onclick="routeTo('tasks')">Open Tasks</button></div>
      </article>
    </section>
    <section class="card">
      <h3>Latest API Response</h3>
      <pre>${JSON.stringify(state.lastResponse || { info: "No actions yet" }, null, 2)}</pre>
    </section>
  `;
}

function renderBids() {
  const rows = state.bids
    .map(
      (b) => `
      <tr>
        <td>${b.BidId}</td>
        <td>${b.BidTitle}</td>
        <td>${b.CustomerId}</td>
        <td><span class="${badge(b.BidStatus)}">${b.BidStatus}</span></td>
        <td>${b.DueDate || ""}</td>
        <td><button class="btn-outline" onclick="selectBid('${b.BidId}')">Select</button></td>
      </tr>
    `
    )
    .join("");
  return `
    <section class="card">
      <h2>Bids Board</h2>
      <p class="muted">Current selected bid: <strong>${state.selectedBidId || "-"}</strong></p>
      ${nav()}
      <div class="btn-row">
        <button class="btn-primary" onclick="openCreateBidModal()">Create Bid</button>
        <button class="btn-outline" onclick="assignSelectedBid()">Assign Selected Bid</button>
        <button class="btn-primary" onclick="convertSelectedBid()">Convert Selected Bid to Project</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Bid ID</th><th>Title</th><th>Customer</th><th>Status</th><th>Due</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderProjects() {
  const rows = state.projects
    .map(
      (p) => `
      <tr>
        <td>${p.ProjectId}</td>
        <td>${p.ProjectName}</td>
        <td>${p.BidId}</td>
        <td><span class="${badge(p.ProjectStatus)}">${p.ProjectStatus}</span></td>
        <td><button class="btn-outline" onclick="selectProject('${p.ProjectId}')">Select</button></td>
      </tr>
    `
    )
    .join("");
  return `
    <section class="card">
      <h2>Projects Board</h2>
      <p class="muted">Current selected project: <strong>${state.selectedProjectId || "-"}</strong></p>
      ${nav()}
      <div class="btn-row">
        <button class="btn-primary" onclick="createWorkOrderQuick()">Create Work Order for Selected Project</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Project ID</th><th>Name</th><th>From Bid</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderWorkOrders() {
  const rows = state.workOrders
    .filter((w) => (state.selectedProjectId ? w.ProjectId === state.selectedProjectId : true))
    .map(
      (w) => `
      <tr>
        <td>${w.WorkOrderId}</td>
        <td>${w.ProjectId}</td>
        <td>${w.Title}</td>
        <td>${w.InstallerUserId || "-"}</td>
        <td><span class="${badge(w.WorkOrderStatus)}">${w.WorkOrderStatus}</span></td>
        <td><button class="btn-outline" onclick="selectWorkOrder('${w.WorkOrderId}')">Select</button></td>
      </tr>
    `
    )
    .join("");
  return `
    <section class="card">
      <h2>Work Orders</h2>
      <p class="muted">Selected work order: <strong>${state.selectedWorkOrderId || "-"}</strong></p>
      ${nav()}
      <div class="btn-row">
        <button class="btn-outline" onclick="assignSelectedWorkOrder()">Assign Selected Work Order to Installer</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>WO ID</th><th>Project</th><th>Title</th><th>Installer</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTasks() {
  const rows = state.tasks
    .map(
      (t) => `
      <tr>
        <td>${t.AssignmentId}</td>
        <td>${t.EntityType}</td>
        <td>${t.EntityId}</td>
        <td>${t.TaskTitle}</td>
        <td><span class="${badge(t.TaskStatus)}">${t.TaskStatus}</span></td>
        <td><button class="btn-primary" onclick="completeTask('${t.AssignmentId}')">Mark Complete</button></td>
      </tr>
    `
    )
    .join("");
  return `
    <section class="card">
      <h2>My Tasks (${state.me})</h2>
      <p class="muted">Task completion updates underlying Bid/Work Order status.</p>
      ${nav()}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Task ID</th><th>Type</th><th>Entity</th><th>Title</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">No open tasks</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function render() {
  switch (state.view) {
    case "bids":
      appEl.innerHTML = renderBids();
      break;
    case "projects":
      appEl.innerHTML = renderProjects();
      break;
    case "workorders":
      appEl.innerHTML = renderWorkOrders();
      break;
    case "tasks":
      appEl.innerHTML = renderTasks();
      break;
    default:
      appEl.innerHTML = renderLanding();
  }
}

function selectBid(id) {
  state.selectedBidId = id;
  render();
}

function selectProject(id) {
  state.selectedProjectId = id;
  render();
}

function selectWorkOrder(id) {
  state.selectedWorkOrderId = id;
  render();
}

async function reloadData() {
  await refreshAll();
  render();
}

window.routeTo = routeTo;
window.hideModal = hideModal;
window.openCreateBidModal = openCreateBidModal;
window.createBidFromModal = createBidFromModal;
window.assignSelectedBid = assignSelectedBid;
window.convertSelectedBid = convertSelectedBid;
window.selectBid = selectBid;
window.selectProject = selectProject;
window.selectWorkOrder = selectWorkOrder;
window.createWorkOrderQuick = createWorkOrderQuick;
window.assignSelectedWorkOrder = assignSelectedWorkOrder;
window.completeTask = completeTask;
window.reloadData = reloadData;

reloadData().catch((err) => {
  state.lastResponse = { error: err.message };
  render();
});
