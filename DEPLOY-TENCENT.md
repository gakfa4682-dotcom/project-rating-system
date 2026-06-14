# 项目评分系统 - 腾讯云服务器部署指南

## 一、购买腾讯云服务器

### 1. 打开腾讯云官网
访问 https://cloud.tencent.com

### 2. 注册/登录账号
用手机号注册并实名认证（必须实名才能购买）

### 3. 进入轻量应用服务器购买页面
路径：产品 → 计算 → 轻量应用服务器
或直接访问：https://cloud.tencent.com/product/lighthouse

### 4. 选择配置（推荐）

| 配置项 | 推荐选择 | 说明 |
|--------|---------|------|
| **地域** | 上海/广州/北京 | 选离你最近的 |
| **镜像** | Ubuntu 22.04 LTS | 系统稳定，社区支持好 |
| **套餐** | 2核2G4M | 足够本项目使用 |
| **时长** | 1年 | 新用户首单优惠大 |
| **数据盘** | 0GB（默认） | 系统盘50GB已够用 |

> 💡 新用户首单通常 60-100 元/年，非常划算

### 5. 确认订单并支付

### 6. 获取服务器信息
购买成功后，在控制台 → 轻量应用服务器 → 找到你的实例，记录：
- **公网 IP 地址**（如：123.456.789.123）
- **登录密码**（购买时设置的，或重置密码）

---

## 二、连接服务器

### Windows 用户

1. 下载 PuTTY 或使用 Windows 自带的 PowerShell
2. 打开 PowerShell，执行：
```bash
ssh ubuntu@你的服务器IP
```
3. 输入密码（输入时不显示，直接回车）

### Mac 用户

打开终端，执行：
```bash
ssh ubuntu@你的服务器IP
```

---

## 三、服务器环境配置

连接成功后，依次执行以下命令：

### 1. 更新系统
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. 安装 Node.js
```bash
# 安装 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安装 Node.js
sudo apt install -y nodejs

# 验证安装
node -v
npm -v
```

### 3. 安装 pm2（进程管理器）
```bash
sudo npm install -g pm2
```

### 4. 安装 git
```bash
sudo apt install -y git
```

---

## 四、部署项目代码

### 1. 创建项目目录
```bash
cd ~
mkdir project-rating-system
cd project-rating-system
```

### 2. 克隆代码
```bash
git clone https://github.com/gakfa4682-dotcom/project-rating-system.git .
```

> 如果提示输入用户名密码，输入你的 GitHub 账号和 Token（或密码）

### 3. 安装依赖
```bash
npm install
```

### 4. 测试启动
```bash
node server.js
```

看到以下输出说明启动成功：
```
=====================================
项目评分系统已启动
访问地址: http://localhost:3000
数据库文件: /home/ubuntu/project-rating-system/database.json
=====================================
```

按 `Ctrl + C` 停止测试。

---

## 五、配置 pm2 守护进程

### 1. 使用 pm2 启动
```bash
pm2 start server.js --name "project-rating"
```

### 2. 保存 pm2 配置
```bash
pm2 save
pm2 startup
```

执行 `pm2 startup` 后会输出一条命令，复制并执行它，这样服务器重启后 pm2 会自动启动你的服务。

### 3. 查看运行状态
```bash
pm2 status
pm2 logs project-rating
```

---

## 六、配置 Nginx 反向代理（可选但推荐）

如果不配置 Nginx，直接通过 `http://服务器IP:3000` 也能访问。
配置 Nginx 后可以通过 `http://服务器IP`（默认80端口）访问，更简洁。

### 1. 安装 Nginx
```bash
sudo apt install -y nginx
```

### 2. 配置 Nginx
```bash
sudo nano /etc/nginx/sites-available/project-rating
```

粘贴以下内容：
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

按 `Ctrl + X`，然后按 `Y`，再按 `Enter` 保存。

### 3. 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/project-rating /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 七、配置防火墙

```bash
# 允许 HTTP 访问
sudo ufw allow 80/tcp

# 允许 HTTPS 访问（后续如需配置SSL）
sudo ufw allow 443/tcp

# 如果需要直接访问 3000 端口（未配置Nginx时）
sudo ufw allow 3000/tcp

# 启用防火墙
sudo ufw enable
```

---

## 八、数据迁移（从 Render 导入旧数据）

### 1. 在 Render 上导出数据
- 用老板账号登录 Render 上的系统
- 进入「数据管理」→ 点击「导出全部数据」
- 保存 `.json` 文件到本地电脑

### 2. 上传到服务器
```bash
# 在本地电脑的 PowerShell/CMD 中执行
scp 项目评分系统备份_xxx.json ubuntu@你的服务器IP:~/project-rating-system/
```

### 3. 导入数据
用老板账号登录腾讯云上的系统，进入「数据管理」→ 选择刚才上传的文件 → 导入。

---

## 九、后续更新功能（数据不会丢失！）

当需要新增功能时：

### 1. 本地修改代码并推送
```bash
git add .
git commit -m "新增xxx功能"
git push
```

### 2. 服务器上更新
```bash
cd ~/project-rating-system
git pull
pm2 restart project-rating
```

**数据自动保留，无需任何导入导出操作！**

---

## 十、绑定域名（可选）

如果你有域名：

1. 在域名服务商添加 A 记录，指向服务器 IP
2. 修改 Nginx 配置中的 `server_name` 为你的域名
3. 申请 SSL 证书（可使用 certbot 免费申请）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 十一、日常维护命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs project-rating

# 重启服务
pm2 restart project-rating

# 停止服务
pm2 stop project-rating

# 备份数据文件
cp ~/project-rating-system/database.json ~/database-backup-$(date +%Y%m%d).json

# 查看服务器资源使用
htop
```

---

## 十二、故障排查

### 无法访问网站
1. 检查服务是否运行：`pm2 status`
2. 检查防火墙：`sudo ufw status`
3. 检查端口监听：`netstat -tlnp | grep 3000`

### 数据库损坏
如果 `database.json` 损坏，可以从备份恢复：
```bash
cp ~/database-backup-xxx.json ~/project-rating-system/database.json
pm2 restart project-rating
```

---

**部署完成后，记得把服务器 IP 或域名发给大家使用！**
