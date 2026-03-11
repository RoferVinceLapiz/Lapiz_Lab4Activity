const STORAGE_KEY = "ipt_demo_v1";
let currentUser = null;

window.db = { accounts: [], departments: [], requests: [] };

/* ================= STORAGE ================= */
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function loadFromStorage() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!data) {
    // Seed admin account
    window.db.accounts = [
      {
        first: "Admin",
        last: "User",
        email: "admin@example.com",
        password: "Password123!",
        role: "admin",
        verified: true
      }
    ];
    window.db.departments = [
      { name: "Engineering" },
      { name: "HR" }
    ];
    saveToStorage();
  } else {
    window.db = data;
  }
}

/* ================= AUTH ================= */
function setAuthState(isAuth, user = null) {
  currentUser = user;

  document.body.classList.toggle("authenticated", isAuth);
  document.body.classList.toggle("not-authenticated", !isAuth);
  document.body.classList.toggle("is-admin", user?.role === "admin");

  if (user) {
    document.getElementById("nav-username").textContent = user.first;
  }
}

/* ================= NAVIGATION ================= */
function navigateTo(hash) {
  window.location.hash = hash;
}

function handleRouting() {
  const hash = window.location.hash || "#/";
  const pageId = hash.replace("#/", "") || "home";

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

  const page = document.getElementById(pageId + "-page");

  if (!page) {
    document.getElementById("home-page").classList.add("active");
    return;
  }

  // Protected routes only redirect if user not logged in
  const protectedRoutes = ["profile", "employees", "accounts", "departments", "requests"];
  if (protectedRoutes.includes(pageId) && !currentUser) {
    navigateTo("#/login");
    return;
  }

  // Admin routes redirect if user is not admin
  const adminRoutes = ["employees", "accounts", "departments"];
  if (adminRoutes.includes(pageId) && currentUser?.role !== "admin") {
    navigateTo("#/");
    return;
  }

  page.classList.add("active");

  // Render profile dynamically
  if (pageId === "profile") renderProfile();
}

/* ================= LOGIN ================= */
document.getElementById("loginForm")?.addEventListener("submit", function (e) {
  e.preventDefault();

  const email = this.elements[0].value.trim();
  const password = this.elements[1].value;

  const user = window.db.accounts.find(acc =>
    acc.email === email && acc.password === password && acc.verified
  );

  if (!user) {
    alert("Invalid credentials or email not verified.");
    return;
  }

  localStorage.setItem("auth_token", email);
  setAuthState(true, user);
  navigateTo("#/profile");
  this.reset();
});

/* ================= REGISTER ================= */
document.getElementById("registerForm")?.addEventListener("submit", function (e) {
  e.preventDefault();

  const [first, last, email, password] = [...this.elements].map(i => i.value.trim());

  if (window.db.accounts.find(a => a.email === email)) {
    alert("Email already exists.");
    return;
  }

  window.db.accounts.push({
    first,
    last,
    email,
    password,
    role: "user",
    verified: false
  });

  saveToStorage();
  localStorage.setItem("unverified_email", email);
  this.reset();
  navigateTo("#/verify-email");
});

/* ================= VERIFY EMAIL ================= */
document.getElementById("verifyBtn")?.addEventListener("click", function () {
  const email = localStorage.getItem("unverified_email");
  const acc = window.db.accounts.find(a => a.email === email);

  if (!acc || acc.verified) return;

  acc.verified = true;
  saveToStorage();

  const msg = document.getElementById("verifyMessage");
  msg.textContent = "Email verified! You can now log in.";
  msg.classList.remove("d-none");

  localStorage.removeItem("unverified_email");

  setTimeout(() => {
    navigateTo("#/login");
  }, 1500);
});

/* ================= LOGOUT ================= */
document.getElementById("logoutBtn")?.addEventListener("click", function () {
  localStorage.removeItem("auth_token");
  setAuthState(false);
  navigateTo("#/");
});

/* ================= PROFILE ================= */
function renderProfile() {
  if (!currentUser) return;

  document.getElementById("profile-name").textContent = `${currentUser.first} ${currentUser.last}`;
  document.getElementById("profile-email").textContent = currentUser.email;
  document.getElementById("profile-role").textContent =
    currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
}

// Open modal on button click
document.getElementById("editProfileBtn")?.addEventListener("click", function () {
  const modal = new bootstrap.Modal(document.getElementById("editProfileModal"));

  // Pre-fill email field
  document.getElementById("editEmail").value = currentUser.email;

  modal.show();
});

// Save new email and/or password
document.getElementById("editProfileForm")?.addEventListener("submit", function (e) {
  e.preventDefault();

  const newEmail = document.getElementById("editEmail").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();

  if (!newEmail) {
    alert("Email cannot be empty.");
    return;
  }

  if (newPassword && newPassword.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  currentUser.email = newEmail;

  if (newPassword) {
    currentUser.password = newPassword;
  }

  saveToStorage();

  alert("Profile updated successfully!");
  document.getElementById("editProfileForm").reset();

  const modalEl = document.getElementById("editProfileModal");
  const modal = bootstrap.Modal.getInstance(modalEl);
  modal.hide();

  renderProfile(); // Update profile display
});

/* ================= INIT ================= */
loadFromStorage();

// Check for logged-in user token
const token = localStorage.getItem("auth_token");
if (token) {
  const user = window.db.accounts.find(acc => acc.email === token);
  if (user) setAuthState(true, user);
}

// Ensure we default to home if no hash
if (!window.location.hash) navigateTo("#/");

handleRouting();
window.addEventListener("hashchange", handleRouting);


window.db.employees = window.db.employees || []; // Ensure employees array exists

const employeesTable = document.getElementById("employeesTable").querySelector("tbody");
const addEmployeeBtn = document.getElementById("addEmployeeBtn");
const employeeModalEl = document.getElementById("employeeModal");
const employeeModal = new bootstrap.Modal(employeeModalEl);
const employeeForm = document.getElementById("employeeForm");

// Populate departments in modal
function populateDepartments() {
  const select = document.getElementById("empDept");
  select.innerHTML = "";
  window.db.departments.forEach(d => {
    const option = document.createElement("option");
    option.value = d.name;
    option.textContent = d.name;
    select.appendChild(option);
  });
}

// Render employees table
function renderEmployees() {
  if (!currentUser || currentUser.role !== "admin") return;

  employeesTable.innerHTML = "";

  if (window.db.employees.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="text-center">No employees.</td>`;
    employeesTable.appendChild(tr);
    return;
  }

  window.db.employees.forEach((emp, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.id}</td>
      <td>${emp.email}</td>
      <td>${emp.position}</td>
      <td>${emp.department}</td>
      <td>${emp.hireDate}</td>
      <td>
        <button class="btn btn-sm btn-primary edit-emp" data-index="${index}">Edit</button>
        <button class="btn btn-sm btn-danger delete-emp" data-index="${index}">Delete</button>
      </td>
    `;
    employeesTable.appendChild(tr);
  });
}

// Open Add Employee modal
addEmployeeBtn?.addEventListener("click", () => {
  employeeForm.reset();
  employeeModal.show();
  populateDepartments();
  employeeForm.dataset.editIndex = "";
});

// Handle form submit
employeeForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("empId").value.trim();
  const email = document.getElementById("empEmail").value.trim();
  const position = document.getElementById("empPosition").value.trim();
  const department = document.getElementById("empDept").value;
  const hireDate = document.getElementById("empHireDate").value;

  const editIndex = employeeForm.dataset.editIndex;

  const empData = { id, email, position, department, hireDate };

  if (editIndex !== "") {
    window.db.employees[editIndex] = empData;
  } else {
    window.db.employees.push(empData);
  }

  saveToStorage();
  renderEmployees();
  employeeModal.hide();
});

// Handle edit/delete buttons
employeesTable.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-emp")) {
    const index = e.target.dataset.index;
    const emp = window.db.employees[index];

    document.getElementById("empId").value = emp.id;
    document.getElementById("empEmail").value = emp.email;
    document.getElementById("empPosition").value = emp.position;
    document.getElementById("empDept").value = emp.department;
    document.getElementById("empHireDate").value = emp.hireDate;

    employeeForm.dataset.editIndex = index;
    populateDepartments();
    employeeModal.show();
  }

  if (e.target.classList.contains("delete-emp")) {
    const index = e.target.dataset.index;
    if (confirm("Are you sure you want to delete this employee?")) {
      window.db.employees.splice(index, 1);
      saveToStorage();
      renderEmployees();
    }
  }
});

// Render employees when page loads
window.addEventListener("hashchange", () => {
  if (window.location.hash === "#/employees") renderEmployees();
});
if (window.location.hash === "#/employees") renderEmployees();
