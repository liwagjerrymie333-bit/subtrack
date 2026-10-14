/* ---------- Storage helpers ---------- */
function getUsers() {
  return JSON.parse(localStorage.getItem("subtrack_users")) || [];
}

function saveUsers(users) {
  localStorage.setItem("subtrack_users", JSON.stringify(users));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("subtrack_currentUser"));
}

function setCurrentUser(user) {
  localStorage.setItem("subtrack_currentUser", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("subtrack_currentUser");
  window.location.href = "index.html";
}

if (document.body.dataset.protected === "true" && !getCurrentUser()) {
  window.location.href = "index.html";
}

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("formError");

    const users = getUsers();

    if (users.some(function (u) { return u.email === email; })) {
      errorBox.textContent = "That email is already registered. Try logging in.";
      return;
    }

    users.push({ name: name, email: email, password: password });
    saveUsers(users);

    setCurrentUser({ name: name, email: email });
    window.location.href = "dashboard.html";
  });
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  if (getCurrentUser()) {
    window.location.href = "dashboard.html";
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("formError");

    const user = getUsers().find(function (u) {
      return u.email === email && u.password === password;
    });

    if (!user) {
      errorBox.textContent = "Wrong email or password.";
      return;
    }

    setCurrentUser({ name: user.name, email: user.email });
    window.location.href = "dashboard.html";
  });
}

function subsKey() {
  const user = getCurrentUser();
  return "subtrack_subs_" + (user ? user.email : "guest");
}

function getSubscriptions() {
  return JSON.parse(localStorage.getItem(subsKey())) || [];
}

function saveSubscriptions(subs) {
  localStorage.setItem(subsKey(), JSON.stringify(subs));
}

function formatPeso(amount) {
  return "₱" + Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseDate(str) {
  const parts = str.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatLongDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/* ---------- Cost calculations ---------- */
function monthlyCost(sub) {
  if (sub.cycle === "Yearly") return sub.price / 12;
  if (sub.cycle === "Weekly") return (sub.price * 52) / 12;
  return sub.price; // Monthly
}

/* ---------- Sidebar + profile (shared by all app pages) ---------- */
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  const user = getCurrentUser();
  if (user) {
    userNameEl.textContent = user.name;
    document.getElementById("userEmail").textContent = user.email;
    document.getElementById("userAvatar").textContent =
      user.name.charAt(0).toUpperCase();
  }
}

/* ==========================================================
   Dashboard
   ========================================================== */

// Date of the k-th charge after the subscription's saved renewal date
function chargeDateAfter(sub, k) {
  const start = parseDate(sub.nextRenewal);
  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();

  if (sub.cycle === "Weekly") return new Date(y, m, d + 7 * k);

  if (sub.cycle === "Yearly") {
    const dim = new Date(y + k, m + 1, 0).getDate();
    return new Date(y + k, m, Math.min(d, dim));
  }

  // Monthly: clamp so the 31st still works in shorter months
  const dim = new Date(y, m + k + 1, 0).getDate();
  return new Date(y, m + k, Math.min(d, dim));
}

// First charge date that is today or later
function nextChargeDate(sub) {
  const today = startOfToday();
  let k = 0;
  while (chargeDateAfter(sub, k) < today && k < 5000) k++;
  return chargeDateAfter(sub, k);
}

function daysUntilLabel(date) {
  const diff = Math.round((date - startOfToday()) / 86400000);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return "Due in " + diff + " days";
}

function renderDashboard() {
  const active = getSubscriptions().filter(function (s) { return s.status === "Active"; });
  const today = startOfToday();

  // stat cards
  const monthly = active.reduce(function (sum, s) { return sum + monthlyCost(s); }, 0);
  document.getElementById("monthlySpending").textContent = formatPeso(monthly);
  document.getElementById("yearlySpending").textContent = formatPeso(monthly * 12);
  document.getElementById("activeCount").textContent = active.length;

  // next charge date for every active subscription, soonest first
  const renewals = active
    .map(function (s) { return { sub: s, date: nextChargeDate(s) }; })
    .sort(function (a, b) { return a.date - b.date; });

  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  document.getElementById("upcomingCount").textContent =
    renewals.filter(function (r) { return r.date <= in7; }).length;

  // renewals list (next 30 days)
  const list = document.getElementById("renewalList");
  list.innerHTML = "";

  const due = renewals.filter(function (r) { return r.date <= in30; });

  if (due.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Nothing due in the next 30 days.";
    list.appendChild(empty);
    return;
  }

  due.forEach(function (r) {
    const li = document.createElement("li");
    li.className = "transaction-item";

    const info = document.createElement("div");

    const name = document.createElement("span");
    name.className = "transaction-name";
    name.textContent = r.sub.name;

    const when = document.createElement("span");
    when.className = "transaction-date";
    when.textContent = daysUntilLabel(r.date) + " · " + formatLongDate(r.date);

    info.appendChild(name);
    info.appendChild(when);

    const amount = document.createElement("span");
    amount.className = "transaction-amount";
    amount.textContent = formatPeso(r.sub.price);

    li.appendChild(info);
    li.appendChild(amount);
    list.appendChild(li);
  });
}

if (document.body.dataset.page === "dashboard") {
  renderDashboard();
}

// "2026-11-09" -> "Nov 9, 2026"
function formatShortDate(str) {
  return parseDate(str).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

/* ---------- Table ---------- */
function renderSubscriptions() {
  const tbody = document.getElementById("subTableBody");
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const status = document.getElementById("statusFilter").value;

  const subs = getSubscriptions()
    .filter(function (s) {
      return s.name.toLowerCase().includes(search) &&
             (category === "" || s.category === category) &&
             (status === "" || s.status === status);
    })
    .sort(function (a, b) { return a.nextRenewal.localeCompare(b.nextRenewal); });

  document.getElementById("countBadge").textContent =
    subs.length + (subs.length === 1 ? " subscription" : " subscriptions");

  tbody.innerHTML = "";

  if (subs.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = "No subscriptions found.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  subs.forEach(function (s) {
    const row = document.createElement("tr");

    // name + category
    const nameCell = document.createElement("td");
    const nameEl = document.createElement("span");
    nameEl.className = "sub-name";
    nameEl.textContent = s.name;
    const catEl = document.createElement("span");
    catEl.className = "sub-category";
    catEl.textContent = s.category;
    nameCell.appendChild(nameEl);
    nameCell.appendChild(catEl);

    // price
    const priceCell = document.createElement("td");
    priceCell.className = "sub-price";
    priceCell.textContent = formatPeso(s.price);

    // cycle
    const cycleCell = document.createElement("td");
    cycleCell.textContent = s.cycle;

    // renewal
    const renewCell = document.createElement("td");
    renewCell.textContent = formatShortDate(s.nextRenewal);

    // status
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status-badge " + s.status.toLowerCase();
    badge.textContent = s.status;
    statusCell.appendChild(badge);

    // actions
    const actionCell = document.createElement("td");
    actionCell.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-edit";
    editBtn.textContent = "Edit";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = s.id;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = s.id;

    actionCell.appendChild(editBtn);
    actionCell.appendChild(deleteBtn);

    priceCell.dataset.label = "Price";
    cycleCell.dataset.label = "Billing Cycle";
    renewCell.dataset.label = "Next Renewal";
    statusCell.dataset.label = "Status";

    row.appendChild(nameCell);
    row.appendChild(priceCell);
    row.appendChild(cycleCell);
    row.appendChild(renewCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);
    tbody.appendChild(row);
  });
}

let editingId = null;

function openModal(sub) {
  editingId = sub ? sub.id : null;
  document.getElementById("modalTitle").textContent =
    sub ? "Edit Subscription" : "Add Subscription";

  document.getElementById("subName").value = sub ? sub.name : "";
  document.getElementById("subCategory").value = sub ? sub.category : "Entertainment";
  document.getElementById("subPrice").value = sub ? sub.price : "";
  document.getElementById("subCycle").value = sub ? sub.cycle : "Monthly";
  document.getElementById("subRenewal").value = sub ? sub.nextRenewal : "";
  document.getElementById("subStatus").value = sub ? sub.status : "Active";

  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById("subName").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  editingId = null;
}

if (document.body.dataset.page === "subscriptions") {
  renderSubscriptions();

  document.getElementById("searchInput").addEventListener("input", renderSubscriptions);
  document.getElementById("categoryFilter").addEventListener("change", renderSubscriptions);
  document.getElementById("statusFilter").addEventListener("change", renderSubscriptions);

  document.getElementById("addBtn").addEventListener("click", function () {
    openModal(null);
  });
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", function (e) {
    if (e.target === this) closeModal(); // clicked the dark background
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  document.getElementById("subForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const data = {
      name: document.getElementById("subName").value.trim(),
      category: document.getElementById("subCategory").value,
      price: parseFloat(document.getElementById("subPrice").value),
      cycle: document.getElementById("subCycle").value,
      nextRenewal: document.getElementById("subRenewal").value,
      status: document.getElementById("subStatus").value
    };

    let subs = getSubscriptions();

    if (editingId === null) {
      data.id = Date.now();
      subs.push(data);
    } else {
      subs = subs.map(function (s) {
        return s.id === editingId ? Object.assign({}, data, { id: s.id }) : s;
      });
    }

    saveSubscriptions(subs);
    closeModal();
    renderSubscriptions();
  });

  document.getElementById("subTableBody").addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const subs = getSubscriptions();

    if (btn.dataset.action === "edit") {
      openModal(subs.find(function (s) { return s.id === id; }));
    }

    if (btn.dataset.action === "delete") {
      const sub = subs.find(function (s) { return s.id === id; });
      if (confirm('Delete "' + sub.name + '"?')) {
        saveSubscriptions(subs.filter(function (s) { return s.id !== id; }));
        renderSubscriptions();
      }
    }
  });
}

function chargeDaysInMonth(sub, year, month) {
  const start = parseDate(sub.nextRenewal);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (sub.cycle === "Monthly") {
    const monthsApart =
      (year - start.getFullYear()) * 12 + (month - start.getMonth());
    if (monthsApart < 0) return [];
    return [Math.min(start.getDate(), daysInMonth)];
  }

  if (sub.cycle === "Yearly") {
    if (year < start.getFullYear() || month !== start.getMonth()) return [];
    return [Math.min(start.getDate(), daysInMonth)];
  }

  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const diff = Math.round((date - start) / 86400000);
    if (diff >= 0 && diff % 7 === 0) days.push(day);
  }
  return days;
}

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

function renderCalendar() {
  const monthName = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("en-US", { month: "long" });

  document.getElementById("calendarTitle").textContent = monthName + " " + viewYear;

  const active = getSubscriptions().filter(function (s) { return s.status === "Active"; });
  const chargesByDay = {};
  let paymentCount = 0;
  let spendingTotal = 0;

  active.forEach(function (sub) {
    chargeDaysInMonth(sub, viewYear, viewMonth).forEach(function (day) {
      if (!chargesByDay[day]) chargesByDay[day] = [];
      chargesByDay[day].push(sub);
      paymentCount++;
      spendingTotal += sub.price;
    });
  });

  // summary cards
  document.getElementById("paymentCount").textContent = paymentCount;
  document.getElementById("spendingTotal").textContent = formatPeso(spendingTotal);
  document.getElementById("paymentLabel").textContent = "in " + monthName;
  document.getElementById("spendingLabel").textContent = "in " + monthName;

  // grid
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const today = startOfToday();

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    const day = i - firstWeekday + 1;

    if (day < 1 || day > daysInMonth) {
      cell.classList.add("empty");
      grid.appendChild(cell);
      continue;
    }

    cell.appendChild(document.createTextNode(day));

    const cellDate = new Date(viewYear, viewMonth, day);
    if (cellDate.getTime() === today.getTime()) cell.classList.add("today");

    (chargesByDay[day] || []).forEach(function (sub) {
      const nameEl = document.createElement("span");
      nameEl.className = "calendar-event";
      nameEl.textContent = sub.name;

      const priceEl = document.createElement("span");
      priceEl.className = "calendar-event-price";
      priceEl.textContent = formatPeso(sub.price);

      cell.appendChild(nameEl);
      cell.appendChild(priceEl);
    });

    grid.appendChild(cell);
  }
}

function changeMonth(step) {
  viewMonth += step;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
}

if (document.body.dataset.page === "calendar") {
  renderCalendar();
  document.getElementById("prevMonth").addEventListener("click", function () { changeMonth(-1); });
  document.getElementById("nextMonth").addEventListener("click", function () { changeMonth(1); });
}