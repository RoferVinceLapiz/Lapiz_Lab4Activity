// server.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = 3000;
const SECRET_KEY = "your-very-secure-secret"; // In production, use environment variables!

// Enable CORS for frontend (e.g., Live Server on port 5500)
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"] // Adjust based on your frontend URL
}));

// Middleware to parse JSON
app.use(express.json());

// 🔒 In-memory "database" (replace with MySQL later)
let users = [
  {
    id: 1,
    first: "Admin",
    last: "User",
    username: "admin",
    email: "admin@example.com",
    password: "$2a$10$placeholder",
    role: "admin"
  },
  {
    id: 2,
    first: "Alice",
    last: "Smith",
    username: "alice",
    email: "alice@example.com",
    password: "$2a$10$placeholder",
    role: "user"
  }
];

// Pre-hash known passwords for demo
if (!users[0].password.includes("$2a$10$") || users[0].password === "$2a$10$placeholder") {
  users[0].password = bcrypt.hashSync("admin123", 10);
  users[1].password = bcrypt.hashSync("user123", 10);
}


// ================= AUTH ROUTES =================

// POST /api/register
app.post("/api/register", async (req, res) => {

  const { first, last, email, password } = req.body;

  if (!first || !last || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  // Check if user exists
  const existing = users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ error: "Email already exists" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: users.length + 1,
    first,
    last,
    username: email,
    email,
    password: hashedPassword,
    role: "user" // Note: In real apps, role should NOT be set by client!
  };

  users.push(newUser);

  res.status(201).json({
    message: "User registered",
    user: {
      first,
      last,
      email,
      role: "user"
    }
  });
});


// POST /api/login
app.post("/api/login", async (req, res) => {

  const { email, password } = req.body;

  const user = users.find(u => u.email === email);

  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET_KEY,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: {
      first: user.first,
      last: user.last,
      email: user.email,
      role: user.role
    }
  });
});


// 🔒 PROTECTED ROUTE: Get user profile
app.get("/api/profile", authenticateToken, (req, res) => {

  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    first: user.first,
    last: user.last,
    email: user.email,
    role: user.role
  });

});


// 🔒 PROTECTED ROUTE: Update own profile
app.put("/api/profile", authenticateToken, async (req, res) => {

  const { email, password } = req.body;

  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check if new email is already taken by another user
  if (email && email !== users[userIndex].email) {
    const emailTaken = users.find(u => u.email === email && u.id !== req.user.id);
    if (emailTaken) {
      return res.status(409).json({ error: "Email already in use" });
    }
    users[userIndex].email = email;
  }

  // Update password only if provided
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    users[userIndex].password = await bcrypt.hash(password, 10);
  }

  // Issue a new token since email may have changed inside the payload
  const updatedUser = users[userIndex];
  const newToken = jwt.sign(
    { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
    SECRET_KEY,
    { expiresIn: "1h" }
  );

  res.json({
    message: "Profile updated successfully",
    token: newToken,
    user: {
      first: updatedUser.first,
      last: updatedUser.last,
      email: updatedUser.email,
      role: updatedUser.role
    }
  });

});


// 🛡️ ROLE-BASED PROTECTED ROUTE: Admin-only
app.get("/api/admin/dashboard",
  authenticateToken,
  authorizeRole("admin"),
  (req, res) => {
    res.json({ message: "Welcome to admin dashboard!", data: "Secret admin info" });
  }
);


// 🌐 PUBLIC ROUTE: Guest content
app.get("/api/content/guest", (req, res) => {
  res.json({ message: "Public content for all visitors" });
});


// Root check
app.get("/", (req, res) => {
  res.send("Backend API is running");
});


// ================= MIDDLEWARE =================

// Token authentication
function authenticateToken(req, res, next) {

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });

}

// Role authorization
function authorizeRole(role) {

  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Access denied: insufficient permissions" });
    }
    next();
  };

}


// ================= GET ALL USERS (Admin only) =================
app.get("/api/users", authenticateToken, authorizeRole("admin"), (req, res) => {
  const safeUsers = users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// ================= ADD USER (Admin only) =================
app.post("/api/users", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { first, last, email, password, role, verified } = req.body;

  if (!first || !last || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  const existing = users.find(u => u.email === email);
  if (existing) return res.status(409).json({ error: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    first,
    last,
    username: email,
    email,
    password: hashedPassword,
    role: role || "user",
    verified: verified || false
  };

  users.push(newUser);
  const { password: _, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

// ================= UPDATE USER (Admin only) =================
app.put("/api/users/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { first, last, email, role, verified, password } = req.body;

  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  users[userIndex] = {
    ...users[userIndex],
    first: first ?? users[userIndex].first,
    last: last ?? users[userIndex].last,
    email: email ?? users[userIndex].email,
    role: role ?? users[userIndex].role,
    verified: verified ?? users[userIndex].verified,
  };

  if (password) {
    users[userIndex].password = await bcrypt.hash(password, 10);
  }

  const { password: _, ...safeUser } = users[userIndex];
  res.json(safeUser);
});

// ================= DELETE USER (Admin only) =================
app.delete("/api/users/:id", authenticateToken, authorizeRole("admin"), (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: "User not found" });

  users.splice(index, 1);
  res.json({ message: "User deleted" });
});

// ================= RESET PASSWORD (Admin only) =================
app.put("/api/users/:id/reset-password", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  users[userIndex].password = await bcrypt.hash(password, 10);
  res.json({ message: "Password reset successfully" });
});


// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`🔑 Try logging in with:`);
  console.log(`   - Admin: email=admin@example.com, password=admin123`);
  console.log(`   - User:  email=alice@example.com, password=user123`);
});
