# 修复指南

本文件记录项目开发过程中所有代码修复记录。后续所有修复请追加到此文件。

---

## 修复记录

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
