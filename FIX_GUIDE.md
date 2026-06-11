# 修复指南

本文件记录项目开发过程中所有代码修复记录。后续所有修复请追加到此文件。

---

## 修复记录

### 修复 #6: 登录后首页仍空白（浏览器缓存旧 JS + CDN 依赖不稳定）

**日期**: 2026-06-11

**问题描述**:
修复 #5 的语法错误后，部分用户登录成功仍看到首页停留在初始占位状态：侧边栏无菜单、昵称显示「加载中...」、令牌倒计时显示「计算中...」、仪表盘卡片不更新。

**影响文件**:
- `frontend/build.mjs`
- `frontend/nginx.conf`
- `frontend/src/index.html`
- `frontend/src/login.html`
- `frontend/src/assets/js/boot.js`（新增）
- `frontend/src/assets/js/common.js`
- `frontend/src/assets/js/app.js`

**问题位置与详情**:

| 问题点 | 说明 |
|--------|------|
| 浏览器强缓存 | `app.js` 无版本号，浏览器继续使用带语法错误的旧缓存文件 |
| CDN 外链脚本 | `index.html` 依赖 jsdelivr 加载 jQuery/Chart.js，网络不稳定时 `app.js` 无法执行 |
| 无兜底初始化 | 主脚本失败时，页面永远停留在 HTML 占位文案 |
| 遮罩层计数 | 多个并行请求时 `$.ajaxSetup.complete` 可能被局部回调覆盖，遮罩层偶发不关闭 |

**根本原因**:
#5 仅修复了源码语法，但 nginx 对静态 JS 未设置 `no-cache`，浏览器仍可能使用旧版 `app.js`；同时首页关键依赖全部走 CDN，在部分网络环境下主脚本加载失败，导致 `loadBaseData()` 从未执行。

**修复方式**:
1. 构建时通过 `build.mjs` 将 jQuery/Bootstrap/Chart.js/AdminLTE 下载到 `assets/vendor/`，HTML 改为本地引用并追加版本号 `?v=2026061103`
2. nginx 对 `.js/.css` 响应添加 `Cache-Control: no-cache`
3. 新增 `boot.js`：在 `app.js` 之前用原生 JS 从 `localStorage` 恢复用户信息/侧边栏菜单，并在 `app.js` 报错时兜底
4. `common.js` 改用 `$(document).ajaxSend/ajaxComplete` 管理全局遮罩层，避免局部 `complete` 覆盖全局逻辑
5. `app.js` 初始化增加 `try/catch`，启动时强制 `hideLoading()`

**验证方式**:
1. 执行 `docker compose up --build -d frontend`
2. 浏览器按 **Ctrl+F5** 强制刷新（或清理站点缓存）
3. 登录后确认侧边栏菜单、用户昵称、仪表盘数据正常显示
4. 开发者工具 Network 中 `app.js?v=2026061103`、`boot.js?v=2026061103` 均返回 200
5. Console 无 `SyntaxError` / `$ is not a function` 报错

---

### 修复 #5: 登录后首页空白（app.js 语法错误导致脚本未执行）

**日期**: 2026-06-11

**问题描述**:
用户登录成功后跳转到 `index.html`，页面一片空白：侧边栏菜单未渲染、个人信息仍显示「加载中...」、仪表盘数据不加载。HTML 结构可见，但所有由 `app.js` 驱动的动态内容均失效。

**影响文件**:
- `frontend/src/assets/js/app.js`

**问题位置与详情**:

| 行号（修复前） | 函数/上下文 | 错误代码 | 说明 |
|---------------|------------|----------|------|
| ~2294 | `bindRoleManageEvents` 角色删除确认 | `'确定要删除角色「' + (rolePageState.pendingDeleteRoleName + '」吗？')` | 字符串拼接缺少闭合引号与 `+`，导致整文件 JavaScript 解析失败 |
| ~2299 | 角色删除确认按钮 | `if (... && deleteRole(...));` | 条件后多余分号，删除逻辑实际不会执行（附带修复） |

**根本原因**:
`app.js` 第 2294 行在拼接删除确认文案时，误将 `'」吗？'` 写入了括号内的字符串，造成字符串字面量提前结束、括号不匹配。浏览器解析 `app.js` 时抛出 `SyntaxError: missing ) after argument list`，后续所有初始化逻辑（`loadBaseData`、`renderSidebarMenus`、`syncUserUI`、`renderDashboardScene` 等）均无法执行。

由于 `index.html` 在 `<body>` 末尾才加载 `app.js`，语法错误不会阻止静态 HTML 渲染，因此用户能看到导航栏骨架和「加载中...」占位，但看不到菜单与个人信息。

**修复方式**:
- 修正第 2294 行字符串拼接，与菜单删除确认（第 1248 行）保持相同写法
- 顺带修正第 2299 行 `if` 语句多余分号，确保角色删除回调正常执行

**修复前代码**:
```javascript
$('#role-delete-body').text('确定要删除角色「' + (rolePageState.pendingDeleteRoleName + '」吗？');
// ...
if (rolePageState.pendingDeleteRoleId && deleteRole(rolePageState.pendingDeleteRoleId));
```

**修复后代码**:
```javascript
$('#role-delete-body').text('确定要删除角色「' + (rolePageState.pendingDeleteRoleName || '') + '」吗？');
// ...
if (rolePageState.pendingDeleteRoleId) {
    deleteRole(rolePageState.pendingDeleteRoleId);
}
```

**验证方式**:
1. 执行 `node --check frontend/src/assets/js/app.js`，确认无语法错误
2. 重新构建并启动前端：`docker compose up --build -d frontend`
3. 访问 http://localhost:3000，使用 `admin / 123456` 登录
4. 确认侧边栏显示菜单树、左下角显示用户昵称、仪表盘卡片与图表正常加载
5. 浏览器开发者工具 Console 无 `SyntaxError` 报错

---

### 修复 #4: 分配请求 DTO 校验注解错误（@NotEmpty 使用不当）

**日期**: 2026-06-10

**问题描述**:
`AssignRolesRequest.roleIds` 和 `AssignMenusRequest.menuIds` 字段使用了 `@NotEmpty` 校验注解，导致无法传空列表清除所有绑定。同时 `userId` 和 `roleId` 主键缺少 `@NotNull` 校验。

**影响文件**:
- `backend/src/main/java/com/prompt2repo/admin/dto/AssignRolesRequest.java`
- `backend/src/main/java/com/prompt2repo/admin/dto/AssignMenusRequest.java`

**问题位置与详情**:

| 文件 | 字段 | 原注解 | 问题 |
|------|------|--------|------|
| AssignRolesRequest | roleIds | `@NotEmpty` | 空列表（清除所有角色）时校验失败 |
| AssignMenusRequest | menuIds | `@NotEmpty` | 空列表（清除所有菜单）时校验失败 |
| AssignRolesRequest | userId | 无注解 | 未校验非空 |
| AssignMenusRequest | roleId | 无注解 | 未校验非空 |

**根本原因**:
`@NotEmpty` 要求集合必须至少包含一个元素，但根据业务设计，分配角色/菜单时应该允许传空列表表示"清除所有已分配的绑定"。Service 层的 `assignRoles` 和 `assignMenus` 方法已经正确处理了空列表（先删除再批量插入，空列表则只删除）。

**修复方式**:
- 移除 `roleIds` 和 `menuIds` 的 `@NotEmpty` 注解
- 给 `userId` 和 `roleId` 添加 `@NotNull` 注解

**修复前代码**（AssignRolesRequest）:
```java
@NotEmpty(message = "角色ID列表不能为空")
private List<Long> roleIds;
private Long userId;
```

**修复后代码**（AssignRolesRequest）:
```java
@NotNull(message = "用户ID不能为空")
private Long userId;
private List<Long> roleIds;
```

**验证方式**:
编译后端项目，验证空列表 `roleIds: []` 或 `menuIds: []` 能成功清除绑定。

---

### 修复 #3: Spring Boot 循环依赖导致容器启动失败（unhealthy）

**日期**: 2026-06-10

**问题描述**:
`SysRoleServiceImpl` 注入了 `SysUserService`，而 `SysUserServiceImpl` 注入了 `SysRoleService`，形成**双向循环依赖**。Spring Boot 2.6+ 默认禁止循环依赖，导致 Bean 创建失败，容器无法启动，Docker healthcheck 显示 unhealthy。

**影响文件**:
- `backend/src/main/java/com/prompt2repo/admin/service/impl/SysRoleServiceImpl.java`

**问题位置与详情**:
```
SysRoleServiceImpl → SysUserService → SysUserServiceImpl → SysRoleService
                         ↑_____________________循环依赖_____________________↑
```

`SysRoleServiceImpl` 中实际只在 `assignRoles()` 方法中调用了 `sysUserService.getById(request.getUserId())`，仅需要简单的主键查询。

**根本原因**:
`SysUserServiceImpl` 需要 `SysRoleService`（获取用户角色列表），而 `SysRoleServiceImpl` 也反向依赖了 `SysUserService`（验证用户是否存在），构造器注入形成闭环。

**修复方式**:
在 `SysRoleServiceImpl` 中**直接注入 `SysUserMapper`** 替代 `SysUserService`，因为只需要 MyBatis-Plus BaseMapper 自带的 `selectById()` 方法，不需要 Service 层的其他业务逻辑。这样就切断了循环链：
```
SysRoleServiceImpl → SysUserMapper（无反向依赖）
SysUserServiceImpl → SysRoleService → SysRoleServiceImpl（不再反向依赖）
```

**修复前代码**:
```java
import com.prompt2repo.admin.service.SysUserService;
// ...
private final SysUserService sysUserService;
// ...
SysUser user = sysUserService.getById(request.getUserId());
```

**修复后代码**:
```java
import com.prompt2repo.admin.mapper.SysUserMapper;
// ...
private final SysUserMapper sysUserMapper;
// ...
SysUser user = sysUserMapper.selectById(request.getUserId());
```

**验证方式**:
- 启动 Spring Boot 容器，观察启动日志不再出现 `BeanCurrentlyInCreationException` 或循环依赖错误
- Docker healthcheck 变为 healthy

---

### 修复 #2: /api/menus/all 接口权限配置不足

**日期**: 2026-06-10

**问题描述**:
`GET /api/menus/all` 接口权限仅配置为 `hasAuthority('menu:manage')`，但**角色管理分配菜单时也需要调用该接口获取全量菜单树**。拥有 `role:manage` 权限但无 `menu:manage` 权限的用户无法打开"分配菜单"窗口，显示 403 错误。

**影响文件**:
- `backend/src/main/java/com/prompt2repo/admin/controller/MenuController.java`

**问题位置与详情**:
调用方：前端角色管理的"分配菜单"按钮 → `openRoleMenuModal()` → 调用 `GET /api/menus/all` 获取全量菜单和 `GET /api/roles/{id}/menus` 获取已分配菜单ID。

鉴权要求：角色管理需要 `role:manage` 权限，但原接口只允许 `menu:manage` 通过。

**根本原因**:
全量菜单接口被两处业务复用（菜单管理页面、角色分配菜单弹窗），但权限注解未覆盖第二种场景。

**修复方式**:
将权限表达式改为 `hasAuthority('menu:manage') or hasAuthority('role:manage')`，两种权限的用户均可访问。

**修复前代码**:
```java
@GetMapping("/all")
@PreAuthorize("hasAuthority('menu:manage')")
public ApiResponse<List<MenuVO>> listAllMenus() {
```

**修复后代码**:
```java
@GetMapping("/all")
@PreAuthorize("hasAuthority('menu:manage') or hasAuthority('role:manage')")
public ApiResponse<List<MenuVO>> listAllMenus() {
```

**验证方式**:
- 拥有 `role:manage` 权限但无 `menu:manage` 权限的用户，在角色管理中点击"分配菜单"按钮，菜单树能正常加载不再出现 403

---

### 修复 #1: SysUserServiceImpl.java 语法错误（多余右括号）

**日期**: 2026-06-10

**问题描述**:
`SysUserServiceImpl.java` 文件中存在4处多余的右括号 `))`，导致 Java 语法错误，无法编译。

**影响文件**:
- `backend/src/main/java/com/prompt2repo/admin/service/impl/SysUserServiceImpl.java`

**问题位置与详情**:

| 行号（修复前） | 方法 | 错误代码 | 说明 |
|---------------|------|----------|------|
| ~53 | `updateProfile` | `.set(SysUser::getAvatar, avatar));` | 末尾多了一个 `)` |
| ~61 | `updatePassword` | `.set(SysUser::getPassword, encodedPassword));` | 末尾多了一个 `)` |
| ~111 | `updateUser` | `updateWrapper.set(SysUser::getNickname, request.getNickname()));` | 末尾多了一个 `)` |
| ~114 | `updateUser` | `updateWrapper.set(SysUser::getAvatar, request.getAvatar()));` | 末尾多了一个 `)` |

**根本原因**:
使用 `LambdaUpdateWrapper.set()` 方法链式调用时，误多写了一个右括号。`set()` 方法返回 `LambdaUpdateWrapper` 自身以支持链式调用，每个 `set()` 只有一层括号。

**修复方式**:
将每处的 `));` 改为 `);`，即移除多余的一个右括号。

**修复前代码示例**:
```java
updateWrapper.eq(SysUser::getId, userId)
        .set(SysUser::getNickname, nickname)
        .set(SysUser::getAvatar, avatar));  // 错误：多一个 )
update(updateWrapper);
```

**修复后代码示例**:
```java
updateWrapper.eq(SysUser::getId, userId)
        .set(SysUser::getNickname, nickname)
        .set(SysUser::getAvatar, avatar);   // 正确
update(updateWrapper);
```

**验证方式**:
编译后端项目，确保无语法错误。

---

## 修复模板（新增修复请复制以下模板并填写）

```
### 修复 #N: 简短标题

**日期**: YYYY-MM-DD

**问题描述**:
简要描述问题是什么。

**影响文件**:
- `文件路径1`
- `文件路径2`

**问题位置与详情**:
列出具体的错误位置、错误代码和说明。

**根本原因**:
分析问题产生的原因。

**修复方式**:
说明如何修复。

**修复前代码**:
```java
// 错误代码
```

**修复后代码**:
```java
// 修复后的代码
```

**验证方式**:
如何验证修复有效。
```

---

*新增修复请在"修复记录"标题下按时间倒序排列（最新的在最上面）。*

---

# Toast 提示组件高度异常修复指南

## 问题描述

**问题 ID**: TOAST-HEIGHT-004  
**严重级别**: 中（UI 缺陷）  
**发现日期**: 2026-06-11

Toast 提示组件在升级为支持多条消息排队展示后，出现高度异常问题：组件内部出现大片空白区域，Toast 卡片高度远大于实际内容高度，影响视觉效果。

---

## 根因分析

旧静态 #appToast 元素（HTML 中残留）
  + .toast-container 上的 p-3 padding 类
  + flex 布局 gap 间距叠加
  + 未明确指定 toast-header/toast-body 的 padding
  = 大面积空白 + 高度异常

**核心缺陷**：

1. **旧静态元素残留**：index.html 和 login.html 中保留了旧的 #appToast 静态元素，在 flex 布局中作为占位存在
2. **容器 padding 冗余**：.toast-container 的 p-3 类（Bootstrap padding 1rem）与 flex gap: 10px 叠加，造成四周不必要的空白
3. **Toast 内边距不一致**：toast-header 和 toast-body 未明确指定 padding，依赖 Bootstrap 默认值可能产生过大的内边距
4. **overflow 未约束**：动态创建的 Toast 元素未设置 overflow: hidden，在某些浏览器下可能出现高度计算异常

---

## 修复方案（4 层优化）

### 第 1 层：CSS 容器样式重置
**文件**: frontend/src/assets/css/styles.css

`css
.toast-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 1070;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;          /* 关键：移除 p-3 的影响，用 gap 统一控制间距 */
}
`

---

### 第 2 层：Toast 卡片样式精细化
**文件**: frontend/src/assets/css/styles.css

`css
.toast-container > .toast {
    min-width: 300px;
    max-width: 380px;
    animation: toastSlideIn 0.3s ease-out;
    margin: 0;            /* 关键：清除 Bootstrap 默认 margin */
    overflow: hidden;     /* 关键：约束内容溢出，稳定高度计算 */
}

.toast-container > .toast .toast-header {
    padding: 0.5rem 0.75rem;   /* 明确内边距，替代默认过大值 */
}

.toast-container > .toast .toast-body {
    padding: 0.75rem;           /* 明确内边距 */
    line-height: 1.5;           /* 稳定行高，避免高度跳动 */
}
`

---

### 第 3 层：旧静态 Toast 强制隐藏
**文件**: frontend/src/assets/css/styles.css

`css
/* 隐藏 HTML 中残留的旧静态 Toast 元素，防止它参与 flex 布局 */
.toast-container > #appToast {
    display: none !important;
}
`

---

### 第 4 层：JS 运行时清理
**文件**: frontend/src/assets/js/common.js

新增 initToastContainer() 初始化函数，在每次创建 Toast 前执行清理：

`js
function initToastContainer() {
    var container = .toast-container;
    if (!container.length) {
        container = <div class="toast-container"></div>.appendTo('body');
    }
    container.find('#appToast').remove();  // 关键：移除旧静态 toast 节点
    container.removeClass('p-3');            // 关键：移除冗余 padding 类
    return container;
}
`

---

## 修复验证清单

| 验证项 | 预期结果 |
|--------|----------|
| 单条 Toast 展示 | 高度紧凑贴合内容，无多余空白 |
| 连续触发多条 Toast | 每条高度正常，纵向间距 10px，最新在上 |
| 不同类型 Toast | 高度一致，无变形 |
| Toast header 区域 | 高度紧凑，布局合理 |
| Toast body 区域 | 内边距适中，文字行高稳定 |
| 长文本消息 | 自动换行，高度自适应 |
| 短文本消息 | 高度紧凑，无多余填充 |
| 滑入/滑出动画 | 流畅无变形 |

---

## 涉及文件与定位

| 文件 | 关键修改位置 |
|------|--------------|
| frontend/src/assets/css/styles.css | .toast-container、.toast-container > .toast、.toast-header、.toast-body、.toast-container > #appToast 规则 |
| frontend/src/assets/js/common.js | 新增 initToastContainer() 函数，showToast() 中调用 |

---

## 设计要点

1. **双保险隐藏策略**：CSS 层 display: none !important + JS 层 .remove() 双重处理
2. **padding 与 gap 分工明确**：容器用 gap 控制 Toast 间纵向间距，top/right 控制与视口边缘距离
3. **直接子元素选择器**：使用 > 避免嵌套元素误匹配
4. **overflow 约束**：确保高度计算稳定，同时保护圆角边缘
5. **防御性编程**：initToastContainer() 每次执行都检查清理，兼容未来变动
