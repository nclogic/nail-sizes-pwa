// app.js
const appEl = document.getElementById("app");
let route = "clients";
let routeState = {}; // e.g. { clientId: "..." }

function setRoute(r, state = {}) {
  route = r;
  routeState = state;
  render();
}

document.querySelectorAll("nav button[data-route]").forEach(btn => {
  btn.addEventListener("click", () => setRoute(btn.dataset.route));
});

function esc(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function fingerFields(prefix, data) {
  const fingers = ["thumb","index","middle","ring","pinky"];
  return fingers.map(f => `
    <div class="field">
      <label>${prefix} ${f}</label>
      <input inputmode="text" autocomplete="off" name="${prefix}_${f}" value="${esc(data?.[f] ?? "")}" placeholder="e.g. 0, 00, 10" />
    </div>
  `).join("");
}

async function renderClients() {
  const clients = await db.clients.orderBy("updatedAt").reverse().toArray();

  appEl.innerHTML = `
    <div class="card">
      <div class="field">
        <label>Find client</label>
        <input id="q" placeholder="Search name / phone / email" />
        <small>Tap a client to view/edit.</small>
      </div>
    </div>
    <div id="results"></div>
  `;

  const resultsEl = document.getElementById("results");
  const qEl = document.getElementById("q");

  function show(list) {
    resultsEl.innerHTML = list.map(c => `
      <div class="card" role="button" tabindex="0" data-id="${esc(c.id)}">
        <div><strong>${esc(c.nameOrId || "(no name)")}</strong></div>
        <small>${esc(c.phone || "no phone")} • ${esc(c.email || "no email")}</small>
      </div>
    `).join("") || `<div class="card">No clients yet.</div>`;

    resultsEl.querySelectorAll("[data-id]").forEach(card => {
      card.addEventListener("click", () => setRoute("edit", { clientId: card.dataset.id }));
    });
  }

  show(clients);

  qEl.addEventListener("input", () => {
    const q = qEl.value.trim().toLowerCase();
    if (!q) return show(clients);
    const filtered = clients.filter(c =>
      (c.nameOrId || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
    show(filtered);
  });
}

async function renderAddClient() {
  const styles = await db.styles.toArray();

  appEl.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Add Client</h2>
      <div class="row">
        <div class="field">
          <label>Name / ID</label>
          <input id="nameOrId" placeholder="Name or email, etc." />
        </div>
        <div class="field">
          <label>Phone</label>
          <input id="phone" placeholder="Optional" inputmode="tel" />
        </div>
        <div class="field">
          <label>Email</label>
          <input id="email" placeholder="Optional" inputmode="email" />
        </div>
      </div>

      <hr />

      <div class="field">
        <label>Style</label>
        <select id="styleId">
          ${styles.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (sizes ${esc(s.minLabel)}-${esc(s.maxLabel)})</option>`).join("")}
        </select>
        <small>Measurements are stored per-style per-client.</small>
      </div>

      <div class="grid">
        <div class="card">
          <strong>Right hand</strong>
          <div class="fingers">${fingerFields("right", {})}</div>
        </div>
        <div class="card">
          <strong>Left hand</strong>
          <div class="fingers">${fingerFields("left", {})}</div>
        </div>
      </div>

      <div class="field">
        <label>Notes</label>
        <textarea id="notes" rows="3" placeholder="Optional"></textarea>
      </div>

      <button class="primary" id="save">Save</button>
    </div>
  `;

  document.getElementById("save").addEventListener("click", async () => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const nameOrId = document.getElementById("nameOrId").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const styleId = document.getElementById("styleId").value;

    if (!nameOrId) {
      alert("Name / ID is required.");
      return;
    }

    const right = {};
    const left = {};
    ["thumb","index","middle","ring","pinky"].forEach(f => {
      right[f] = document.querySelector(`input[name="right_${f}"]`).value.trim();
      left[f]  = document.querySelector(`input[name="left_${f}"]`).value.trim();
    });

    await db.clients.add({ id, nameOrId, phone, email, createdAt, updatedAt: createdAt });

    await db.measurements.add({
      id: crypto.randomUUID(),
      clientId: id,
      styleId,
      right,
      left,
      notes: document.getElementById("notes").value.trim(),
      updatedAt: createdAt
    });

    setRoute("edit", { clientId: id });
  });
}

async function renderEditClient(clientId) {
  const client = await db.clients.get(clientId);
  if (!client) {
    appEl.innerHTML = `<div class="card">Client not found.</div>`;
    return;
  }

  const styles = await db.styles.toArray();
  const measurements = await db.measurements.where({ clientId }).toArray();

  // Build a map styleId -> measurement
  const measByStyle = new Map(measurements.map(m => [m.styleId, m]));
  const currentStyleId = routeState.styleId || (measurements[0]?.styleId ?? styles[0]?.id);

  const currentMeas = measByStyle.get(currentStyleId) || {
    id: null,
    clientId,
    styleId: currentStyleId,
    right: { thumb:"",index:"",middle:"",ring:"",pinky:"" },
    left:  { thumb:"",index:"",middle:"",ring:"",pinky:"" },
    notes: "",
    updatedAt: nowISO()
  };

  appEl.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">View / Edit Client</h2>

      <div class="row">
        <div class="field">
          <label>Name / ID</label>
          <input id="nameOrId" value="${esc(client.nameOrId)}" />
        </div>
        <div class="field">
          <label>Phone</label>
          <input id="phone" value="${esc(client.phone)}" />
        </div>
        <div class="field">
          <label>Email</label>
          <input id="email" value="${esc(client.email)}" />
        </div>
      </div>

      <div class="row">
        <button id="saveClient" class="primary">Save Client Info</button>
        <button id="deleteClient">Delete Client</button>
      </div>

      <hr />

      <div class="field">
        <label>Style</label>
        <select id="stylePick">
          ${styles.map(s => `<option value="${esc(s.id)}" ${s.id===currentStyleId?"selected":""}>
            ${esc(s.name)} (sizes ${esc(s.minLabel)}-${esc(s.maxLabel)})
          </option>`).join("")}
        </select>
        <small>Switch styles to view/edit measurements for that style.</small>
      </div>

      <div class="row">
        <button id="addStyleMeas">Add measurements for this style (if missing)</button>
      </div>

      <div class="grid">
        <div class="card">
          <strong>Right hand</strong>
          <div class="fingers">${fingerFields("right", currentMeas.right)}</div>
        </div>
        <div class="card">
          <strong>Left hand</strong>
          <div class="fingers">${fingerFields("left", currentMeas.left)}</div>
        </div>
      </div>

      <div class="field">
        <label>Notes (for this style)</label>
        <textarea id="notes" rows="3">${esc(currentMeas.notes ?? "")}</textarea>
      </div>

      <button class="primary" id="saveMeas">Save Measurements</button>
      <small>Created: ${esc(client.createdAt)} • Updated: ${esc(client.updatedAt)}</small>
    </div>
  `;

  document.getElementById("stylePick").addEventListener("change", (e) => {
    setRoute("edit", { clientId, styleId: e.target.value });
  });

  document.getElementById("saveClient").addEventListener("click", async () => {
    const updatedAt = nowISO();
    await db.clients.update(clientId, {
      nameOrId: document.getElementById("nameOrId").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      updatedAt
    });
    alert("Client info saved.");
    render(); // refresh timestamps
  });

  document.getElementById("deleteClient").addEventListener("click", async () => {
    if (!confirm("Delete this client and all measurements?")) return;
    await db.measurements.where({ clientId }).delete();
    await db.clients.delete(clientId);
    setRoute("clients");
  });

  document.getElementById("addStyleMeas").addEventListener("click", async () => {
    const styleId = document.getElementById("stylePick").value;
    const existing = await db.measurements.where({ clientId, styleId }).first();
    if (existing) {
      alert("Measurements already exist for this style.");
      return;
    }
    await db.measurements.add({
      id: crypto.randomUUID(),
      clientId,
      styleId,
      right: { thumb:"",index:"",middle:"",ring:"",pinky:"" },
      left:  { thumb:"",index:"",middle:"",ring:"",pinky:"" },
      notes: "",
      updatedAt: nowISO()
    });
    setRoute("edit", { clientId, styleId });
  });

  document.getElementById("saveMeas").addEventListener("click", async () => {
    const styleId = document.getElementById("stylePick").value;
    const updatedAt = nowISO();

    const right = {};
    const left = {};
    ["thumb","index","middle","ring","pinky"].forEach(f => {
      right[f] = document.querySelector(`input[name="right_${f}"]`).value.trim();
      left[f]  = document.querySelector(`input[name="left_${f}"]`).value.trim();
    });

    const notes = document.getElementById("notes").value.trim();

    const existing = await db.measurements.where({ clientId, styleId }).first();
    if (existing) {
      await db.measurements.update(existing.id, { right, left, notes, updatedAt });
    } else {
      await db.measurements.add({ id: crypto.randomUUID(), clientId, styleId, right, left, notes, updatedAt });
    }

    await db.clients.update(clientId, { updatedAt });
    alert("Measurements saved.");
    render();
  });
}

async function renderStyles() {
  const styles = await db.styles.toArray();

  appEl.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Available Styles</h2>
    </div>
    <div class="styles-grid">
      ${styles.map(s => `
        <div class="style-tile">
          <img src="./images/${esc(s.imageFile || "")}" alt="${esc(s.name)}" onerror="this.style.display='none'" />
          <div class="title">${esc(s.name)}</div>
          <div class="meta">Sizes ${esc(s.minLabel)}-${esc(s.maxLabel)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

async function renderBackup() {
  appEl.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Backup</h2>
      <p><button class="primary" id="export">Export JSON</button></p>
      <p>
        <label><strong>Import JSON</strong></label><br/>
        <input type="file" id="importFile" accept="application/json" />
      </p>
      <small>This is optional, but it protects you if you change phones.</small>
    </div>
  `;

  document.getElementById("export").addEventListener("click", async () => {
    const data = {
      exportedAt: nowISO(),
      styles: await db.styles.toArray(),
      clients: await db.clients.toArray(),
      measurements: await db.measurements.toArray()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nail-sizes-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);

    if (!confirm("This will replace your current app data. Continue?")) return;

    await db.transaction("rw", db.styles, db.clients, db.measurements, async () => {
      await db.styles.clear();
      await db.clients.clear();
      await db.measurements.clear();
      if (Array.isArray(data.styles)) await db.styles.bulkAdd(data.styles);
      if (Array.isArray(data.clients)) await db.clients.bulkAdd(data.clients);
      if (Array.isArray(data.measurements)) await db.measurements.bulkAdd(data.measurements);
    });

    alert("Import complete.");
    setRoute("clients");
  });
}

async function render() {
  if (route === "clients") return renderClients();
  if (route === "add") return renderAddClient();
  if (route === "styles") return renderStyles();
  if (route === "backup") return renderBackup();
  if (route === "edit") return renderEditClient(routeState.clientId);
  appEl.innerHTML = `<div class="card">Unknown route.</div>`;
}

(async function init() {
  await seedIfEmpty();

  // Register service worker for offline app shell caching (no background jobs)
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }
  render();
})();

