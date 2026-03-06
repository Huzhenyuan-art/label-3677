# 智能后台管理系统

## 项目简介
基于 Spring Boot + AdminLTE 的后台管理系统示例，提供登录鉴权、动态菜单、仪表盘、锁屏解锁与基础监控能力，支持 Docker 一键启动。

## 🛠 技术栈
- Frontend: AdminLTE 3 + Bootstrap 4.6 + jQuery + Ajax + Chart.js
- Backend: Spring Boot 2.7 + Spring Security + JWT + MyBatis-Plus + Redis + Spring Boot Admin
- Database: MySQL 8.0（utf8mb4）

## 核心功能
- 用户登录与 JWT 鉴权
- 登录失败限流（Redis）
- 锁屏与解锁（二次密码验证）
- 动态菜单渲染与仪表盘统计
- Swagger 接口文档与 Spring Boot Admin 监控

## 🚀 How to Run
1. 确保 Docker Desktop 已启动。
2. 在项目根目录执行：`docker compose up --build`
3. 首次启动会自动初始化数据库与演示数据。
4. 打开浏览器访问前端地址登录系统。

## 🔗 Services
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- Swagger: http://localhost:8080/swagger-ui.html
- Spring Boot Admin: http://localhost:8080/admin
- MySQL: `localhost:3306`（`root/root`）
- Redis: `localhost:6379`

## 🧪 测试账号
- Admin: `admin / 123456`

## 环境变量
可在根目录创建 `.env`（参考 `.env.example`）：
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `JWT_SECRET`
- `TOKEN_EXPIRE_MINUTES`

## ✅ Verification
1. 访问 http://localhost:3000，使用 `admin / 123456` 登录。
2. 确认仪表盘显示用户数、菜单数、在线会话数与服务器时间。
3. 点击右上角“锁屏”，输入 `123456` 成功解锁。
4. 访问 Swagger 页面，确认接口可调试。
5. 访问 Spring Boot Admin 页面，确认监控面板可访问。

## 常用命令
- 启动：`docker compose up --build -d`
- 查看日志：`docker compose logs -f backend`
- 停止：`docker compose down`
- 清空数据并重置：`docker compose down -v && docker compose up --build`

## 目录结构
```text
.
├── backend/            # Spring Boot 后端
├── frontend/           # AdminLTE 前端
├── initdb/             # MySQL 初始化脚本
├── docker-compose.yml  # 容器编排
└── README.md
```

## 排障说明
- 若前端显示旧数据或乱码，先清理浏览器 `localStorage` 后重新登录。
- 若登录页报 404，请使用 `http://localhost:3000/login.html` 或强制刷新。
