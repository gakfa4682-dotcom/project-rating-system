# 项目评分系统 - 部署指南

## 一、项目结构（全栈版）

```
project-rating-system/
├── index.html          # 前端页面
├── server.js           # 后端服务（Express + SQLite）
├── package.json        # 依赖配置
├── render.yaml         # Render 部署配置
├── database.sqlite     # 数据库文件（自动创建）
└── DEPLOY.md           # 本文件
```

## 二、本地启动测试

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

启动后访问 `http://localhost:3000`

---

## 三、方案二：Render.com 免费云部署（推荐）

Render 是一个免费的云服务平台，支持自动从 GitHub 部署 Node.js 应用。

### 准备工作

你需要：
1. 一个 GitHub 账号（免费注册：https://github.com）
2. 一个 Render 账号（用 GitHub 账号直接登录：https://render.com）

### 部署步骤

#### 第 1 步：把代码上传到 GitHub

1. 打开浏览器，登录 https://github.com
2. 点击右上角 `+` → `New repository`
3. 仓库名称填写：`project-rating-system`
4. 选择 `Public`（公开，免费）或 `Private`（私有，也免费）
5. 点击 `Create repository`
6. 创建后，页面上会出现上传代码的指引，你会看到类似这样的命令：

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/你的用户名/project-rating-system.git
git push -u origin main
```

7. 在电脑上打开命令行，进入项目文件夹，依次执行上面的命令

> 如果电脑上没有 git，可以先安装：https://git-scm.com/download/win

#### 第 2 步：在 Render 上部署

1. 打开 https://render.com，用 GitHub 账号登录
2. 登录后点击 `New +` → `Web Service`
3. 选择刚才创建的 GitHub 仓库 `project-rating-system`
4. 填写配置：
   - **Name**: `project-rating-system`（或你喜欢的名字）
   - **Region**: 选择 `Singapore`（离你最近，速度快）
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. 点击页面底部的 `Create Web Service`
6. 等待部署完成（大约 2-3 分钟）

#### 第 3 步：获取访问链接

部署成功后，Render 会给你分配一个链接，格式类似：

```
https://project-rating-system-xxx.onrender.com
```

把这个链接复制下来，发给所有人，手机/电脑打开就能用。

> 注意：免费版 15 分钟没有访问会自动休眠，下次有人访问时需要等 30 秒左右唤醒。这是唯一的限制，对小公司内部使用影响不大。

### 后续更新代码

如果你修改了代码，需要更新到 Render：

```bash
git add .
git commit -m "更新说明"
git push origin main
```

Render 会自动检测到代码更新并重新部署，不需要手动操作。

---

## 四、数据备份

数据库文件是 `database.sqlite`，直接复制这个文件就是完整的备份。

也可以登录管理员账号，在「数据管理」页面导出 JSON 备份文件。

---

## 五、后续扩展售后系统

当前后端架构（Express + SQLite）已经具备扩展能力：

1. 在 `server.js` 中新增 API 路由（如 `/api/after-sales`）
2. 在 SQLite 中新建表（如 `after_sales`）
3. 前端新增页面调用新 API

由于前后端分离，你可以：
- 在同一套后端里不断增加新模块
- 或者把售后系统做成独立服务，共用同一个用户认证体系

---

## 六、默认账号

| 身份 | 账号 | 密码 |
|------|------|------|
| 老板 | A | admin123 |
| 金洪樑 | B | 123456 |
| 郭晨浩 | C | 123456 |
| 胡耀 | D | 123456 |
