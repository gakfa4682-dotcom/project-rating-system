const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

// ==================== 数据库初始化 ====================
const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    realName TEXT NOT NULL,
    role TEXT NOT NULL,
    password TEXT NOT NULL,
    color TEXT NOT NULL
  )`);

  // 项目表
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    managerId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  // 评分表
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    fromId TEXT NOT NULL,
    toId TEXT NOT NULL,
    score REAL NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  // 插入默认用户（如果表为空）
  db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
    if (err) { console.error(err); return; }
    if (row.count === 0) {
      const defaultUsers = [
        { id: 'A', name: '老板', realName: '老板', role: 'admin', password: 'admin123', color: '#e74c3c' },
        { id: 'B', name: '金洪樑', realName: '金洪樑', role: 'employee', password: '123456', color: '#3498db' },
        { id: 'C', name: '郭晨浩', realName: '郭晨浩', role: 'employee', password: '123456', color: '#2ecc71' },
        { id: 'D', name: '胡耀', realName: '胡耀', role: 'employee', password: '123456', color: '#9b59b6' }
      ];

      const stmt = db.prepare(`INSERT INTO users (id, name, realName, role, password, color) VALUES (?, ?, ?, ?, ?, ?)`);
      defaultUsers.forEach(u => {
        stmt.run(u.id, u.name, u.realName, u.role, u.password, u.color);
      });
      stmt.finalize();
      console.log('默认用户数据已初始化');
    }
  });
});

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
  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: '账号不存在' });
    // 明文密码比对（因为初始密码是明文存储的）
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
});

// 获取当前用户信息
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 获取所有用户（管理员）
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  db.all(`SELECT id, name, realName, role, color FROM users`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users: rows });
  });
});

// 重置密码（管理员）
app.post('/api/users/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '密码至少4位' });
  }
  db.run(`UPDATE users SET password = ? WHERE id = ?`, [newPassword, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ message: '密码已重置' });
  });
});

// 获取项目列表（登录用户）
app.get('/api/projects', authMiddleware, (req, res) => {
  db.all(`SELECT * FROM projects ORDER BY createdAt DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ projects: rows });
  });
});

// 创建项目（管理员）
app.post('/api/projects', authMiddleware, adminMiddleware, (req, res) => {
  const { name, managerId } = req.body;
  if (!name || !managerId) {
    return res.status(400).json({ error: '项目名称和项目经理不能为空' });
  }
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  const createdAt = new Date().toISOString();
  db.run(`INSERT INTO projects (id, name, managerId, createdAt) VALUES (?, ?, ?, ?)`,
    [id, name, managerId, createdAt], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, name, managerId, createdAt });
    });
});

// 删除项目（管理员）
app.delete('/api/projects/:id', authMiddleware, adminMiddleware, (req, res) => {
  const pid = req.params.id;
  db.run(`DELETE FROM scores WHERE projectId = ?`, [pid], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM projects WHERE id = ?`, [pid], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '项目不存在' });
      res.json({ message: '项目已删除' });
    });
  });
});

// 获取评分记录（登录用户）
app.get('/api/scores', authMiddleware, (req, res) => {
  db.all(`SELECT * FROM scores ORDER BY createdAt DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ scores: rows });
  });
});

// 提交评分（登录用户）
app.post('/api/scores', authMiddleware, (req, res) => {
  const { projectId, scores } = req.body;
  if (!projectId || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: '参数错误' });
  }

  // 权限校验
  db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, project) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const isAdmin = req.user.role === 'admin';
    const isManager = project.managerId === req.user.id;

    for (const s of scores) {
      if (s.fromId !== req.user.id) {
        return res.status(403).json({ error: '只能提交自己的评分' });
      }
      // 老板只能给项目经理打分
      if (s.fromId === 'A' && s.toId !== project.managerId) {
        return res.status(403).json({ error: '老板只能给项目经理打分' });
      }
      // 非管理员非项目经理不能打分
      if (!isAdmin && !isManager) {
        return res.status(403).json({ error: '您没有该项目的评分权限' });
      }
      // 项目经理只能给其他员工打分
      if (s.fromId !== 'A' && s.toId === s.fromId) {
        return res.status(403).json({ error: '不能给自己打分' });
      }
    }

    // 删除该用户在该项目的旧评分
    db.run(`DELETE FROM scores WHERE projectId = ? AND fromId = ?`, [projectId, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // 插入新评分
      const stmt = db.prepare(`INSERT INTO scores (id, projectId, fromId, toId, score, createdAt) VALUES (?, ?, ?, ?, ?, ?)`);
      let inserted = 0;
      let hasError = false;

      scores.forEach(s => {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        const createdAt = new Date().toISOString();
        stmt.run(id, projectId, s.fromId, s.toId, s.score, createdAt, function(err) {
          if (err) { hasError = true; console.error(err); }
          inserted++;
        });
      });
      stmt.finalize(() => {
        if (hasError) return res.status(500).json({ error: '部分评分插入失败' });
        res.json({ message: '评分提交成功', count: inserted });
      });
    });
  });
});

// 数据导出（管理员）
app.get('/api/export', authMiddleware, adminMiddleware, (req, res) => {
  db.all(`SELECT id, name, realName, role, color FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`SELECT * FROM projects`, [], (err, projects) => {
      if (err) return res.status(500).json({ error: err.message });
      db.all(`SELECT * FROM scores`, [], (err, scores) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ users, projects, scores, exportedAt: new Date().toISOString() });
      });
    });
  });
});

// 数据导入（管理员）- 覆盖式导入
app.post('/api/import', authMiddleware, adminMiddleware, (req, res) => {
  const { users: importUsers, projects: importProjects, scores: importScores } = req.body;
  if (!importUsers || !importProjects || !importScores) {
    return res.status(400).json({ error: '缺少必要数据' });
  }

  db.serialize(() => {
    db.run(`DELETE FROM scores`);
    db.run(`DELETE FROM projects`);
    db.run(`DELETE FROM users`);

    const userStmt = db.prepare(`INSERT INTO users (id, name, realName, role, password, color) VALUES (?, ?, ?, ?, ?, ?)`);
    importUsers.forEach(u => {
      userStmt.run(u.id, u.name, u.realName, u.role, u.password || '123456', u.color);
    });
    userStmt.finalize();

    const projStmt = db.prepare(`INSERT INTO projects (id, name, managerId, createdAt) VALUES (?, ?, ?, ?)`);
    importProjects.forEach(p => {
      projStmt.run(p.id, p.name, p.managerId, p.createdAt);
    });
    projStmt.finalize();

    const scoreStmt = db.prepare(`INSERT INTO scores (id, projectId, fromId, toId, score, createdAt) VALUES (?, ?, ?, ?, ?, ?)`);
    importScores.forEach(s => {
      scoreStmt.run(s.id, s.projectId, s.fromId, s.toId, s.score, s.createdAt);
    });
    scoreStmt.finalize(() => {
      res.json({ message: '数据导入成功' });
    });
  });
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
  console.log(`数据库文件: ${DB_PATH}`);
  console.log(`=====================================`);
});
