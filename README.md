# 智能后台管理系统

## 项目简介
基于 Spring Boot + AdminLTE 的后台管理系统示例，提供登录鉴权、动态菜单、仪表盘、锁屏解锁与基础监控能力，支持 Docker 一键启动。

## 技术栈
- Frontend: AdminLTE 3 + Bootstrap 4.6 + jQuery + Chart.js
- Backend: Spring Boot 2.7.18 + Spring Security + JWT + MyBatis-Plus 3.5.5 + Redis + Spring Boot Admin 2.7.16
- Database: MySQL 8.0 (utf8mb4) + Redis 7
- CI/CD: GitHub Actions
- Container: Docker Compose

## 核心功能
- 用户登录与 JWT 鉴权
- 登录失败限流（Redis）
- 锁屏与解锁（二次密码验证）
- 动态菜单渲染与仪表盘统计
- 用户/角色/菜单/公告/定时任务管理
- 操作日志与登录日志审计
- 在线会话管理
- Swagger 接口文档与 Spring Boot Admin 监控

## 一键启动（新成员快速上手）

### 前置条件
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 已安装并运行

### 开发环境启动
```powershell
# 方式一：使用一键启动脚本（推荐）
.\start.ps1 -Env dev -Build

# 方式二：手动启动
copy .env.dev .env
docker compose up --build -d
```

### 测试/生产环境启动
```powershell
# 测试环境
.\start.ps1 -Env test -Build

# 生产环境（需先填写 .env.prod 中的敏感配置）
.\start.ps1 -Env prod -Build
```

### 启动脚本参数
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-Env` | 环境：dev / test / prod | dev |
| `-Build` | 强制重新构建镜像 | 否 |
| `-Reset` | 清空数据卷并重置 | 否 |
| `-SkipHealthCheck` | 跳过健康巡检 | 否 |

### 启动后访问
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- Swagger: http://localhost:8080/swagger-ui.html
- Spring Boot Admin: http://localhost:8080/admin
- MySQL: `localhost:3306` (root/root)
- Redis: `localhost:6379`

### 测试账号
- Admin: `admin / 123456`

## 环境变量管理

### 配置文件体系
| 文件 | 用途 | 是否提交 |
|------|------|----------|
| `.env.example` | 模板与说明 | 是 |
| `.env.dev` | 开发环境默认值 | 是 |
| `.env.test` | 测试环境默认值 | 否（已gitignore） |
| `.env.prod` | 生产环境（含密钥，空值需手动填） | 否（已gitignore） |
| `.env` | 实际生效文件（由脚本自动生成） | 否（已gitignore） |

### 敏感配置注入规则
1. **开发环境**：`.env.dev` 包含默认值，可直接使用
2. **测试环境**：`.env.test` 预设测试密码，仍需替换
3. **生产环境**：`.env.prod` 中 `MYSQL_ROOT_PASSWORD`、`SPRING_DATASOURCE_PASSWORD`、`JWT_SECRET`、`SPRING_REDIS_PASSWORD` 必须手动填写，不可使用默认值
4. **Spring Boot**：通过 `${ENV_VAR:-default}` 语法从环境变量读取，配置文件中不硬编码密钥

### Spring Profile
| Profile | 配置文件 | 用途 |
|---------|----------|------|
| dev | `application-dev.yml` | 本地开发，详细日志 |
| test | `application-test.yml` | H2内嵌DB+内嵌Redis，自动化测试 |
| prod | `application-prod.yml` | 生产配置，连接池优化，日志文件滚动 |

## 健康巡检

### 自动巡检
```powershell
# 启动后自动巡检（start.ps1 已内置）
.\start.ps1 -Env dev -Build

# 独立巡检脚本
.\healthcheck.ps1
```

### 冒烟验收测试
```powershell
.\smoke-test.ps1
```
验收内容覆盖：
1. Docker 容器运行状态
2. 后端健康端点（/actuator/health）
3. MySQL / Redis 连接状态
4. 前端页面可访问性
5. 登录 API 可用性
6. 仪表盘数据接口
7. 菜单/用户/角色管理 API
8. Swagger / Admin 监控面板
9. 锁屏/解锁 API

## CI/CD 流水线

### GitHub Actions（`.github/workflows/ci-cd.yml`）
触发条件：
- `push` 到 `main` / `develop` 分支：构建 + 测试 + 镜像推送
- `pull_request` 到 `main`：构建 + 测试 + 集成健康巡检

流水线阶段：
1. **Backend Build & Test**：Maven 编译 + 单元/集成测试
2. **Frontend Build**：Node.js 构建 + Vendor 下载
3. **Docker Build & Push**：构建镜像并推送到 GHCR（仅 main 分支）
4. **Integration Health Check**：Docker Compose 启动 + 端点检查 + 登录验证（仅 PR）

## 依赖版本固化

### 后端（Maven）
所有依赖版本在 `pom.xml` 的 `<properties>` 中集中声明：
- Spring Boot: 2.7.18
- MyBatis-Plus: 3.5.5
- JJWT: 0.11.5
- SpringDoc: 1.7.0
- Spring Boot Admin: 2.7.16
- MySQL Connector: 8.0.33
- H2: 2.2.224
- Lombok: 1.18.30

### 前端（Vendor）
前端 vendor 库在 `build.mjs` 中锁定精确版本和 SRI 完整性校验：
- jQuery: 3.6.4
- Bootstrap: 4.6.2
- Chart.js: 3.9.1
- AdminLTE: 3.2

构建时自动校验 SHA-256 完整性，如文件被篡改会告警。

## 常用命令
```powershell
# 启动（开发环境）
.\start.ps1 -Env dev -Build

# 启动（重置数据）
.\start.ps1 -Env dev -Build -Reset

# 停止服务
docker compose down

# 清空数据并重置
docker compose down -v

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 健康巡检
.\healthcheck.ps1

# 冒烟验收
.\smoke-test.ps1

# 后端本地构建
cd backend
mvnw.cmd -s settings.xml clean package

# 前端本地构建
cd frontend
npm ci
npm run build
```

## 目录结构
```
.
├── .github/workflows/   # CI/CD 流水线
│   └── ci-cd.yml
├── backend/             # Spring Boot 后端
│   ├── .mvn/wrapper/    # Maven Wrapper 配置
│   ├── src/main/        # 源码
│   ├── src/test/        # 测试
│   ├── Dockerfile
│   ├── pom.xml
│   ├── settings.xml
│   └── mvnw.cmd
├── frontend/            # AdminLTE 前端
│   ├── src/             # 源码
│   ├── Dockerfile
│   ├── build.mjs        # 构建脚本（含 SRI 校验）
│   ├── nginx.conf
│   └── package.json
├── initdb/              # MySQL 初始化脚本
│   ├── 01-schema.sql
│   └── 02-seed.sql
├── .env.example         # 环境变量模板
├── .env.dev             # 开发环境配置
├── .env.test            # 测试环境配置（gitignored）
├── .env.prod            # 生产环境配置（gitignored）
├── docker-compose.yml   # 容器编排
├── start.ps1            # 一键启动脚本
├── healthcheck.ps1      # 健康巡检脚本
├── smoke-test.ps1       # 冒烟验收测试脚本
└── README.md
```

## 排障说明
- 若前端显示旧数据或乱码，先清理浏览器 `localStorage` 后重新登录
- 若登录页报 404，请使用 `http://localhost:3000/login.html` 或强制刷新
- 若后端健康检查失败，检查 `docker compose logs backend` 确认数据库连接
- 生产环境务必修改 `JWT_SECRET`，避免使用默认值
