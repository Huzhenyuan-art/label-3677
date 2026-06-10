# 修复指南

本文件记录项目开发过程中所有代码修复记录。后续所有修复请追加到此文件。

---

## 修复记录

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
