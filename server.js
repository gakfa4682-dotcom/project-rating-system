const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'project-rating-secret-key-2026';

// ==================== 中间件 ====================
app.use(cors());
app.use(express.json());

// ==================== JSON 数据库 ====================
const DB_FILE = path.join(__dirname, 'database.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], projects: [], scores: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: [], projects: [], scores: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 初始化默认数据
let db = loadDB();
if (!db.users) db.users = [];
if (!db.projects) db.projects = [];
if (!db.scores) db.scores = [];

const DEFAULT_USERS = [
  { id: 'A', name: '老板', realName: '老板', role: 'admin', password: 'admin123', color: '#e74c3c' },
  { id: 'B', name: '金洪樑', realName: '金洪樑', role: 'employee', password: '123456', color: '#3498db' },
  { id: 'C', name: '郭晨浩', realName: '郭晨浩', role: 'employee', password: '123456', color: '#2ecc71' },
  { id: 'D', name: '胡耀', realName: '胡耀', role: 'employee', password: '123456', color: '#9b59b6' }
];

// 确保默认用户存在且密码正确
let changed = false;
DEFAULT_USERS.forEach(def => {
  const existing = db.users.find(u => u.id === def.id);
  if (!existing) {
    db.users.push({ ...def });
    changed = true;
  } else if (existing.password !== def.password) {
    existing.password = def.password;
    changed = true;
  }
});
if (changed) {
  saveDB(db);
  console.log('默认用户数据已初始化/修复');
}

// ==================== JWT 认证中间件 ====================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// ==================== API 路由 ====================

// 登录
app.post('/api/login', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: '请提供账号和密码' });
  }
  const data = loadDB();
  const user = data.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: '账号不存在' });
  if (user.password !== password) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, realName: user.realName, role: user.role, color: user.color },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, realName: user.realName, role: user.role, color: user.color } });
});

// 获取当前用户信息
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 获取所有用户（管理员）
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const data = loadDB();
  const users = data.users.map(u => ({ id: u.id, name: u.name, realName: u.realName, role: u.role, color: u.color }));
  res.json({ users });
});

// 重置密码（管理员）
app.post('/api/users/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '密码至少4位' });
  }
  const data = loadDB();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  user.password = newPassword;
  saveDB(data);
  res.json({ message: '密码已重置' });
});

// 获取项目列表（登录用户）
app.get('/api/projects', authMiddleware, (req, res) => {
  const data = loadDB();
  const projects = [...data.projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ projects });
});

// 创建项目（管理员）
app.post('/api/projects', authMiddleware, adminMiddleware, (req, res) => {
  const { name, managerId } = req.body;
  if (!name || !managerId) {
    return res.status(400).json({ error: '项目名称和项目经理不能为空' });
  }
  const data = loadDB();
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  const createdAt = new Date().toISOString();
  const project = { id, name, managerId, createdAt };
  data.projects.push(project);
  saveDB(data);
  res.json(project);
});

// 删除项目（管理员）
app.delete('/api/projects/:id', authMiddleware, adminMiddleware, (req, res) => {
  const pid = req.params.id;
  const data = loadDB();
  data.scores = data.scores.filter(s => s.projectId !== pid);
  const idx = data.projects.findIndex(p => p.id === pid);
  if (idx === -1) return res.status(404).json({ error: '项目不存在' });
  data.projects.splice(idx, 1);
  saveDB(data);
  res.json({ message: '项目已删除' });
});

// 获取评分记录（登录用户）
app.get('/api/scores', authMiddleware, (req, res) => {
  const data = loadDB();
  const scores = [...data.scores].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ scores });
});

// 提交评分（登录用户）
app.post('/api/scores', authMiddleware, (req, res) => {
  const { projectId, scores } = req.body;
  if (!projectId || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: '参数错误' });
  }

  const data = loadDB();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const isAdmin = req.user.role === 'admin';
  const isManager = project.managerId === req.user.id;

  for (const s of scores) {
    if (s.fromId !== req.user.id) {
      return res.status(403).json({ error: '只能提交自己的评分' });
    }
    if (s.fromId === 'A' && s.toId !== project.managerId) {
      return res.status(403).json({ error: '老板只能给项目经理打分' });
    }
    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: '您没有该项目的评分权限' });
    }
    if (s.fromId !== 'A' && s.toId === s.fromId) {
      return res.status(403).json({ error: '不能给自己打分' });
    }
  }

  // 删除该用户在该项目的旧评分
  data.scores = data.scores.filter(s => !(s.projectId === projectId && s.fromId === req.user.id));

  // 插入新评分
  for (const s of scores) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    data.scores.push({
      id, projectId, fromId: s.fromId, toId: s.toId, score: s.score,
      createdAt: new Date().toISOString()
    });
  }

  saveDB(data);
  res.json({ message: '评分提交成功', count: scores.length });
});

// 数据导出（管理员）
app.get('/api/export', authMiddleware, adminMiddleware, (req, res) => {
  const data = loadDB();
  const users = data.users.map(u => ({ id: u.id, name: u.name, realName: u.realName, role: u.role, color: u.color }));
  res.json({
    users, projects: data.projects, scores: data.scores,
    exportedAt: new Date().toISOString()
  });
});

// 数据导入（管理员）- 覆盖式导入
app.post('/api/import', authMiddleware, adminMiddleware, (req, res) => {
  const { users: importUsers, projects: importProjects, scores: importScores } = req.body;
  if (!importUsers || !importProjects || !importScores) {
    return res.status(400).json({ error: '缺少必要数据' });
  }
  saveDB({
    users: importUsers.map(u => ({ ...u, password: u.password || '123456' })),
    projects: importProjects,
    scores: importScores
  });
  res.json({ message: '数据导入成功' });
});

// ==================== 静态文件服务 ====================
app.use(express.static(__dirname));

// 所有路由都指向前端
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== 启动 ====================
app.listen(PORT, () => {
  console.log(`=====================================`);
  console.log(`项目评分系统已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`数据库文件: ${DB_FILE}`);
  console.log(`=====================================`);
});
