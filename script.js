document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;

  // ================= SAMPLE LOCAL DATA =================
  // Note: Employees, Departments, and Requests remain in-memory
  // on the frontend as they are not part of the auth migration scope.
  let departments = [
    { id: 1, name: "Engineering", description: "Software team" },
    { id: 2, name: "HR", description: "Human Resources" }
  ];

  let employees = [
    {
      empId: "EMP-001",
      email: "admin@example.com",
      position: "System Administrator",
      department: "Engineering",
      hireDate: "2026-03-01"
    }
  ];

  let requests = [
    { id: 1, title: "Leave Request", status: "Pending" },
    { id: 2, title: "Equipment Request", status: "Pending" }
  ];

  // ================= AUTH HELPERS =================

  // Step 2: Add Auth Header to Protected Requests
  function getAuthHeader() {
    const token = sessionStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function navigateTo(hash) {
    window.location.hash = hash;
  }

  // Step 3: Update UI Based on Role
  // On page load, check sessionStorage.authToken and set UI accordingly
  function setAuthState(isAuth, user = null) {
    currentUser = user;

    document.body.classList.toggle("authenticated", isAuth);
    document.body.classList.toggle("not-authenticated", !isAuth);
    document.body.classList.toggle("is-admin", user?.role === "admin");

    document.querySelectorAll(".role-logged-in").forEach(el => el.style.display = isAuth ? "block" : "none");
    document.querySelectorAll(".role-logged-out").forEach(el => el.style.display = isAuth ? "none" : "block");

    // Show/hide Admin Dashboard links based on role
    document.querySelectorAll(".role-admin").forEach(el => el.style.display = user?.role === "admin" ? "block" : "none");

    if (user) {
      const usernameEl = document.getElementById("nav-username");
      if (usernameEl) usernameEl.textContent = user.first;
    }
  }

  // ================= CLEAR LOGIN FORM (AUTOFILL FIX) =================
  function clearLoginForm() {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    loginForm.reset();

    const emailInput = loginForm.querySelector('input[type="email"]');
    const passwordInput = loginForm.querySelector('input[type="password"]');

    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";

    setTimeout(() => {
      if (emailInput) emailInput.value = "";
      if (passwordInput) passwordInput.value = "";
    }, 50);

    setTimeout(() => {
      if (emailInput) emailInput.value = "";
      if (passwordInput) passwordInput.value = "";
    }, 300);
  }

  // ================= PROFILE =================
  // Calls /api/profile to get the user role and update UI
  async function renderProfile() {
    try {
      const res = await fetch("http://localhost:3000/api/profile", {
        headers: getAuthHeader()
      });

      if (!res.ok) throw new Error("Unauthorized");

      const user = await res.json();

      document.getElementById("profile-name").textContent = user.first + " " + user.last;
      document.getElementById("profile-email").textContent = user.email;
      document.getElementById("profile-role").textContent = user.role;

      const editEmail = document.getElementById("editEmail");
      if (editEmail) editEmail.value = user.email;

      setAuthState(true, user);

    } catch (err) {
      alert("Session expired. Please login again.");
      sessionStorage.removeItem("authToken");
      setAuthState(false);
      navigateTo("#/login");
      clearLoginForm();
    }
  }

  // ================= ACCOUNTS =================
  async function renderAccounts() {
    const tbody = document.querySelector("#accountsTable tbody");
    if (!tbody) return;

    try {
      const res = await fetch("http://localhost:3000/api/users", {
        headers: getAuthHeader()
      });

      if (!res.ok) throw new Error("Failed to fetch accounts");

      const accountsList = await res.json();

      if (accountsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">No accounts found.</td></tr>`;
        return;
      }

      tbody.innerHTML = accountsList.map(acc => `
        <tr>
          <td>${acc.first} ${acc.last}</td>
          <td>${acc.email}</td>
          <td>${acc.role.charAt(0).toUpperCase() + acc.role.slice(1)}</td>
          <td>
            ${acc.verified
              ? `<span class="text-success fw-bold">&#10003;</span>`
              : `<span class="text-danger">&#10007;</span>`}
          </td>
          <td>
            <button class="btn btn-sm btn-primary me-1 edit-account"
              data-id="${acc.id}"
              data-first="${acc.first}"
              data-last="${acc.last}"
              data-email="${acc.email}"
              data-role="${acc.role}"
              data-verified="${acc.verified}">Edit</button>
            <button class="btn btn-sm btn-warning me-1 reset-password"
              data-id="${acc.id}"
              data-email="${acc.email}">Reset Password</button>
            <button class="btn btn-sm btn-danger delete-account"
              data-id="${acc.id}">Delete</button>
          </td>
        </tr>
      `).join("");

      // Edit button
      document.querySelectorAll(".edit-account").forEach(btn => {
        btn.addEventListener("click", () => {
          document.getElementById("accountEditId").value = btn.dataset.id;
          document.getElementById("accFirst").value = btn.dataset.first;
          document.getElementById("accLast").value = btn.dataset.last;
          document.getElementById("accEmail").value = btn.dataset.email;
          document.getElementById("accPassword").value = "";
          document.getElementById("accRole").value = btn.dataset.role;
          document.getElementById("accVerified").checked = btn.dataset.verified === "true";
          document.getElementById("accountFormContainer").style.display = "block";
        });
      });

      // Reset Password button
      document.querySelectorAll(".reset-password").forEach(btn => {
        btn.addEventListener("click", async () => {
          const newPass = prompt(`Enter new password for ${btn.dataset.email}:`);
          if (newPass === null) return;
          if (newPass.length < 6) return alert("Password must be at least 6 characters.");

          try {
            const res = await fetch(`http://localhost:3000/api/users/${btn.dataset.id}/reset-password`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...getAuthHeader() },
              body: JSON.stringify({ password: newPass })
            });

            const data = await res.json();
            if (!res.ok) return alert(data.error);
            alert("Password reset successfully!");
          } catch {
            alert("Server error during password reset.");
          }
        });
      });

      // Delete button
      document.querySelectorAll(".delete-account").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this account?")) return;

          try {
            const res = await fetch(`http://localhost:3000/api/users/${btn.dataset.id}`, {
              method: "DELETE",
              headers: getAuthHeader()
            });

            const data = await res.json();
            if (!res.ok) return alert(data.error);
            await renderAccounts();
          } catch {
            alert("Server error during deletion.");
          }
        });
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Unable to load accounts.</td></tr>`;
    }
  }

  // Add Account Button
  document.getElementById("addAccountBtn")?.addEventListener("click", () => {
    document.getElementById("accountForm").reset();
    document.getElementById("accountEditId").value = "";
    document.getElementById("accountFormContainer").style.display = "block";
  });

  // Cancel Account Form
  document.getElementById("cancelAccountBtn")?.addEventListener("click", () => {
    document.getElementById("accountFormContainer").style.display = "none";
    document.getElementById("accountForm").reset();
  });

  // Save Account (Add or Edit)
  document.getElementById("accountForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("accountEditId").value;
    const first = document.getElementById("accFirst").value.trim();
    const last = document.getElementById("accLast").value.trim();
    const email = document.getElementById("accEmail").value.trim();
    const password = document.getElementById("accPassword").value;
    const role = document.getElementById("accRole").value;
    const verified = document.getElementById("accVerified").checked;

    try {
      let res;

      if (!id) {
        // Add new user
        res = await fetch("http://localhost:3000/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ first, last, email, password, role, verified })
        });
      } else {
        // Update existing user
        res = await fetch(`http://localhost:3000/api/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ first, last, email, role, verified, ...(password && { password }) })
        });
      }

      const data = await res.json();
      if (!res.ok) return alert(data.error);

      await renderAccounts();
      document.getElementById("accountFormContainer").style.display = "none";
      document.getElementById("accountForm").reset();

    } catch {
      alert("Server error while saving account.");
    }
  });

  // ================= DEPARTMENTS =================
  function renderDepartments() {
    const tbody = document.querySelector("#departmentsTable tbody");
    if (!tbody) return;

    if (departments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center">No departments found.</td></tr>`;
      return;
    }

    tbody.innerHTML = departments.map((dep, index) => `
      <tr>
        <td>${dep.name}</td>
        <td>${dep.description}</td>
        <td>
          <button class="btn btn-sm btn-primary me-1 edit-dept" data-index="${index}">Edit</button>
          <button class="btn btn-sm btn-danger delete-dept" data-index="${index}">Delete</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".edit-dept").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = btn.getAttribute("data-index");
        const dep = departments[index];
        document.getElementById("deptEditIndex").value = index;
        document.getElementById("deptName").value = dep.name;
        document.getElementById("deptDesc").value = dep.description;

        const modal = new bootstrap.Modal(document.getElementById("departmentModal"));
        modal.show();
      });
    });

    document.querySelectorAll(".delete-dept").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.getAttribute("data-index"));
        if (confirm("Delete this department?")) {
          departments.splice(index, 1);
          renderDepartments();
        }
      });
    });
  }

  document.getElementById("addDepartmentBtn")?.addEventListener("click", () => {
    document.getElementById("departmentForm").reset();
    document.getElementById("deptEditIndex").value = "";
    const modal = new bootstrap.Modal(document.getElementById("departmentModal"));
    modal.show();
  });

  document.getElementById("departmentForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const index = document.getElementById("deptEditIndex").value;
    const name = document.getElementById("deptName").value.trim();
    const description = document.getElementById("deptDesc").value.trim();

    if (index === "") {
      departments.push({ id: departments.length + 1, name, description });
    } else {
      departments[index].name = name;
      departments[index].description = description;
    }

    renderDepartments();
    bootstrap.Modal.getInstance(document.getElementById("departmentModal")).hide();
  });

  // ================= EMPLOYEES =================
  function populateDepartmentDropdown() {
    const select = document.getElementById("empDept");
    if (!select) return;

    select.innerHTML = `<option value="">Select Department</option>`;
    departments.forEach(dep => {
      const option = document.createElement("option");
      option.value = dep.name;
      option.textContent = dep.name;
      select.appendChild(option);
    });
  }

  function renderEmployees() {
    const tbody = document.querySelector("#employeesTable tbody");
    if (!tbody) return;

    if (employees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No employees.</td></tr>`;
      return;
    }

    tbody.innerHTML = employees.map((emp, index) => `
      <tr>
        <td>${emp.empId}</td>
        <td>${emp.email}</td>
        <td>${emp.position}</td>
        <td>${emp.department}</td>
        <td>${emp.hireDate}</td>
        <td>
          <button class="btn btn-sm btn-danger delete-employee" data-index="${index}">Delete</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".delete-employee").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = btn.getAttribute("data-index");
        employees.splice(index, 1);
        renderEmployees();
      });
    });
  }

  // ================= REQUESTS =================
  function renderRequests() {
    const container = document.getElementById("requestsTable");
    if (!container) return;

    if (requests.length === 0) {
      container.innerHTML = `<div class="alert alert-warning">No requests found.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="table table-bordered">
        <thead class="table-dark">
          <tr>
            <th>Request ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((req, index) => `
            <tr>
              <td>${req.id}</td>
              <td>${req.title}</td>
              <td>
                <span class="
                  ${req.status === "Approved" ? "text-success fw-bold" : ""}
                  ${req.status === "Rejected" ? "text-danger fw-bold" : ""}
                  ${req.status === "Pending" ? "text-warning fw-bold" : ""}
                ">
                  ${req.status}
                </span>
              </td>
              <td>
                ${currentUser?.role === "admin" ? `
                  <button class="btn btn-sm btn-success me-1 approve-request" data-index="${index}"
                    ${req.status !== "Pending" ? "disabled" : ""}>Accept</button>
                  <button class="btn btn-sm btn-danger reject-request" data-index="${index}"
                    ${req.status !== "Pending" ? "disabled" : ""}>Reject</button>
                ` : `
                  <span class="text-muted">Waiting for admin</span>
                `}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    document.querySelectorAll(".approve-request").forEach(btn => {
      btn.addEventListener("click", () => {
        requests[btn.getAttribute("data-index")].status = "Approved";
        renderRequests();
      });
    });

    document.querySelectorAll(".reject-request").forEach(btn => {
      btn.addEventListener("click", () => {
        requests[btn.getAttribute("data-index")].status = "Rejected";
        renderRequests();
      });
    });
  }

  // ================= NEW REQUEST =================
  document.getElementById("newRequestBtn")?.addEventListener("click", () => {
    const requestForm = document.getElementById("requestForm");
    if (requestForm) requestForm.reset();

    const itemsContainer = document.getElementById("requestItemsContainer");
    if (itemsContainer) {
      itemsContainer.innerHTML = `
        <div class="input-group mb-2 request-item-row">
          <input type="text" class="form-control item-name" placeholder="Item name" required>
          <input type="number" class="form-control item-qty" value="1" min="1" style="max-width: 100px;" required>
          <button type="button" class="btn btn-outline-success add-item-btn">+</button>
          <button type="button" class="btn btn-outline-danger remove-item-btn">X</button>
        </div>
      `;
    }

    const modal = new bootstrap.Modal(document.getElementById("requestModal"));
    modal.show();
  });

  // Request item add/remove
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("add-item-btn")) {
      const itemsContainer = document.getElementById("requestItemsContainer");
      const newRow = document.createElement("div");
      newRow.className = "input-group mb-2 request-item-row";
      newRow.innerHTML = `
        <input type="text" class="form-control item-name" placeholder="Item name" required>
        <input type="number" class="form-control item-qty" value="1" min="1" style="max-width: 100px;" required>
        <button type="button" class="btn btn-outline-success add-item-btn">+</button>
        <button type="button" class="btn btn-outline-danger remove-item-btn">X</button>
      `;
      itemsContainer.appendChild(newRow);
    }

    if (e.target.classList.contains("remove-item-btn")) {
      const rows = document.querySelectorAll(".request-item-row");
      if (rows.length > 1) {
        e.target.closest(".request-item-row").remove();
      } else {
        alert("At least one item is required.");
      }
    }
  });

  // Submit request
  document.getElementById("requestForm")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const requestType = document.getElementById("requestType").value;
    const itemRows = document.querySelectorAll(".request-item-row");
    const items = [];

    itemRows.forEach(row => {
      const name = row.querySelector(".item-name").value.trim();
      const qty = row.querySelector(".item-qty").value;
      if (name) items.push({ name, qty: Number(qty) });
    });

    requests.push({
      id: requests.length > 0 ? requests[requests.length - 1].id + 1 : 1,
      title: `${requestType} Request`,
      status: "Pending",
      items
    });

    renderRequests();

    const modal = bootstrap.Modal.getInstance(document.getElementById("requestModal"));
    if (modal) modal.hide();

    alert("Request submitted successfully!");
  });

  // ================= ROUTING =================
  function handleRouting() {
    const hash = window.location.hash || "#/";
    const pageId = hash.replace("#/", "") || "home";

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const page = document.getElementById(pageId + "-page");

    if (!page) {
      document.getElementById("home-page").classList.add("active");
      return;
    }

    // Frontend route protection — backend ALSO enforces this
    const protectedRoutes = ["profile", "employees", "accounts", "departments", "requests"];
    if (protectedRoutes.includes(pageId) && !currentUser) {
      navigateTo("#/login");
      return;
    }

    // Admin-only routes — backend ALSO enforces this
    const adminRoutes = ["employees", "accounts", "departments"];
    if (adminRoutes.includes(pageId) && currentUser?.role !== "admin") {
      alert("Access denied. Admin only.");
      navigateTo("#/");
      return;
    }

    page.classList.add("active");

    if (pageId === "login") clearLoginForm();
    if (pageId === "profile") renderProfile();
    if (pageId === "employees") { populateDepartmentDropdown(); renderEmployees(); }
    if (pageId === "accounts") renderAccounts();
    if (pageId === "departments") renderDepartments();
    if (pageId === "requests") renderRequests();
  }

  // ================= LOGIN =================
  // Step 1: Replace localStorage — Login with API
  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginForm = e.target;
    const email = loginForm.elements[0].value.trim();
    const password = loginForm.elements[1].value;

    try {
      const response = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Save token in sessionStorage for page refresh
        sessionStorage.setItem("authToken", data.token);

        // Clear form after successful login
        loginForm.reset();
        loginForm.elements[0].value = "";
        loginForm.elements[1].value = "";

        setAuthState(true, data.user);
        navigateTo("#/profile");

      } else {
        alert("Login failed: " + data.error);
      }

    } catch (err) {
      alert("Network error");
    }
  });

  // ================= REGISTER =================
  document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const registerForm = e.target;
    const first = registerForm.elements[0].value.trim();
    const last = registerForm.elements[1].value.trim();
    const email = registerForm.elements[2].value.trim();
    const password = registerForm.elements[3].value;

    try {
      const res = await fetch("http://localhost:3000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first, last, email, password })
      });

      const data = await res.json();
      if (!res.ok) return alert(data.error);

      alert("Registration successful!");
      registerForm.reset();
      navigateTo("#/login");
      clearLoginForm();

    } catch (err) {
      alert("Network error");
    }
  });

  // ================= LOGOUT =================
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    // Clear sessionStorage on logout
    sessionStorage.removeItem("authToken");
    setAuthState(false);
    navigateTo("#/login");
    clearLoginForm();
  });

  // ================= EDIT PROFILE =================
  document.getElementById("editProfileBtn")?.addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("editProfileModal"));
    modal.show();
  });

  document.getElementById("editProfileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEmail = document.getElementById("editEmail").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();

    // Only include password in body if it was filled in
    const body = { email: newEmail };
    if (newPassword) body.password = newPassword;

    try {
      const res = await fetch("http://localhost:3000/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader()
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        return alert(data.error || "Failed to update profile.");
      }

      // Save the new token (email may have changed inside the payload)
      sessionStorage.setItem("authToken", data.token);

      // Update the displayed profile info
      document.getElementById("profile-email").textContent = data.user.email;
      setAuthState(true, data.user);

      alert("Profile updated successfully!");

      const modal = bootstrap.Modal.getInstance(document.getElementById("editProfileModal"));
      if (modal) modal.hide();

      // Re-fetch profile from server to confirm all changes saved
      renderProfile();

    } catch (err) {
      alert("Network error. Please try again.");
    }
  });

  // ================= ADD EMPLOYEE =================
  document.getElementById("addEmployeeBtn")?.addEventListener("click", () => {
    document.getElementById("employeeForm").reset();
    populateDepartmentDropdown();
    const modal = new bootstrap.Modal(document.getElementById("employeeModal"));
    modal.show();
  });

  document.getElementById("employeeForm")?.addEventListener("submit", (e) => {
    e.preventDefault();

    employees.push({
      empId: document.getElementById("empId").value.trim(),
      email: document.getElementById("empEmail").value.trim(),
      position: document.getElementById("empPosition").value.trim(),
      department: document.getElementById("empDept").value,
      hireDate: document.getElementById("empHireDate").value
    });

    renderEmployees();

    const modal = bootstrap.Modal.getInstance(document.getElementById("employeeModal"));
    if (modal) modal.hide();

    alert("Employee added successfully!");
  });

  // ================= INITIALIZE =================
  // On page load, check if sessionStorage.authToken exists
  const token = sessionStorage.getItem("authToken");
  if (token) {
    // Call /api/profile to get the user role and restore session
    renderProfile();
  } else {
    setAuthState(false);
    clearLoginForm();
  }

  if (!window.location.hash) navigateTo("#/");
  window.addEventListener("hashchange", handleRouting);
  handleRouting();
});
