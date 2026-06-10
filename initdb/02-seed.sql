SET NAMES utf8mb4;

INSERT INTO sys_user (id, username, password, nickname, user_status)
VALUES (1, 'admin', '$2y$10$sLcYRisVfJ8GSkYLq9XZOO/B/vzrmAWEqInH0gCQ1MqbthE5BLfSm', '系统管理员', 1)
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), user_status = VALUES(user_status);

INSERT INTO sys_menu (id, parent_id, title, path, icon, perm_code, sort_order, visible)
VALUES
  (1, 0, '仪表盘', '/dashboard', 'fas fa-tachometer-alt', 'dashboard:view', 1, 1),
  (2, 0, '系统管理', '#', 'fas fa-cogs', 'system:root', 2, 1),
  (3, 2, '用户信息', '/profile', 'far fa-user', 'user:view', 1, 1),
  (4, 2, '菜单权限', '/menus', 'fas fa-list', 'menu:manage', 2, 1),
  (5, 2, '用户管理', '/users', 'fas fa-users-cog', 'user:manage', 3, 1),
  (6, 0, '日志审计', '#', 'fas fa-history', 'log:root', 3, 1),
  (7, 6, '操作日志', '/operation-logs', 'fas fa-clipboard-list', 'operationLog:view', 1, 1)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  path = VALUES(path),
  icon = VALUES(icon),
  perm_code = VALUES(perm_code),
  sort_order = VALUES(sort_order),
  visible = VALUES(visible);
