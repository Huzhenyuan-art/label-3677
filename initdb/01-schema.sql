-- 如需手动创建数据库，可执行：
-- CREATE DATABASE admin_demo DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sys_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(128) NOT NULL,
  nickname VARCHAR(64) NOT NULL,
  avatar VARCHAR(255) NULL,
  user_status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT chk_user_status CHECK (user_status IN (0, 1)),
  CONSTRAINT chk_deleted CHECK (deleted IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sys_menu (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  parent_id BIGINT NOT NULL DEFAULT 0,
  title VARCHAR(64) NOT NULL,
  path VARCHAR(128) NOT NULL,
  icon VARCHAR(64) NULL,
  perm_code VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  visible TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_menu_visible CHECK (visible IN (0, 1)),
  INDEX idx_parent_sort (parent_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sys_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL UNIQUE,
  role_name VARCHAR(64) NOT NULL,
  description VARCHAR(255) NULL,
  role_status TINYINT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT chk_role_status CHECK (role_status IN (0, 1)),
  CONSTRAINT chk_role_deleted CHECK (deleted IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统角色表';

CREATE TABLE IF NOT EXISTS sys_user_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户角色关联表';

CREATE TABLE IF NOT EXISTS sys_role_menu (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  menu_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_menu (role_id, menu_id),
  INDEX idx_role_id (role_id),
  INDEX idx_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色菜单关联表';

CREATE TABLE IF NOT EXISTS sys_operation_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operator_id BIGINT NULL COMMENT '操作人ID',
  operator_username VARCHAR(64) NULL COMMENT '操作人用户名',
  operator_nickname VARCHAR(64) NULL COMMENT '操作人昵称',
  operation_module VARCHAR(64) NOT NULL COMMENT '操作模块',
  operation_desc VARCHAR(255) NOT NULL COMMENT '操作描述',
  request_method VARCHAR(16) NOT NULL COMMENT '请求方法（GET/POST/PUT/DELETE）',
  request_path VARCHAR(255) NOT NULL COMMENT '请求路径',
  request_params TEXT NULL COMMENT '请求参数摘要（JSON格式）',
  response_result TEXT NULL COMMENT '响应结果摘要（JSON格式）',
  execution_time BIGINT NOT NULL DEFAULT 0 COMMENT '执行耗时（毫秒）',
  success TINYINT NOT NULL DEFAULT 1 COMMENT '是否成功（0-失败，1-成功）',
  error_message TEXT NULL COMMENT '错误信息',
  client_ip VARCHAR(64) NULL COMMENT '客户端IP',
  user_agent VARCHAR(512) NULL COMMENT '用户代理',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  INDEX idx_operator (operator_id),
  INDEX idx_created_at (created_at),
  INDEX idx_module (operation_module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统操作日志表';

CREATE TABLE IF NOT EXISTS sys_login_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NULL COMMENT '登录用户名',
  login_status TINYINT NOT NULL COMMENT '登录状态（0-失败，1-成功）',
  client_ip VARCHAR(64) NULL COMMENT '客户端IP',
  user_agent VARCHAR(512) NULL COMMENT '用户代理',
  fail_reason VARCHAR(255) NULL COMMENT '失败原因',
  login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  INDEX idx_username (username),
  INDEX idx_login_status (login_status),
  INDEX idx_client_ip (client_ip),
  INDEX idx_login_at (login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='登录日志表';

CREATE TABLE IF NOT EXISTS sys_notice (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  notice_type TINYINT NOT NULL DEFAULT 1 COMMENT '公告类型（1-通知，2-公告）',
  notice_status TINYINT NOT NULL DEFAULT 0 COMMENT '状态（0-草稿，1-已发布，2-已撤回）',
  is_pinned TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶（0-否，1-是）',
  publisher_id BIGINT NULL COMMENT '发布人ID',
  publisher_username VARCHAR(64) NULL COMMENT '发布人用户名',
  publisher_nickname VARCHAR(64) NULL COMMENT '发布人昵称',
  published_at DATETIME NULL COMMENT '发布时间',
  recalled_at DATETIME NULL COMMENT '撤回时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT chk_notice_type CHECK (notice_type IN (1, 2)),
  CONSTRAINT chk_notice_status CHECK (notice_status IN (0, 1, 2)),
  CONSTRAINT chk_notice_pinned CHECK (is_pinned IN (0, 1)),
  CONSTRAINT chk_notice_deleted CHECK (deleted IN (0, 1)),
  INDEX idx_notice_status (notice_status),
  INDEX idx_is_pinned (is_pinned),
  INDEX idx_published_at (published_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='通知公告表';

CREATE TABLE IF NOT EXISTS sys_notice_read (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  notice_id BIGINT NOT NULL COMMENT '公告ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '阅读时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_notice_user (notice_id, user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_notice_id (notice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='通知公告已读记录表';
