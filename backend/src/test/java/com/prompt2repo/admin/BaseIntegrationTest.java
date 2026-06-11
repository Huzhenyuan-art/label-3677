package com.prompt2repo.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prompt2repo.admin.config.EmbeddedRedisConfig;
import com.prompt2repo.admin.dto.LoginRequest;
import com.prompt2repo.admin.entity.SysMenu;
import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.mapper.SysMenuMapper;
import com.prompt2repo.admin.mapper.SysRoleMapper;
import com.prompt2repo.admin.mapper.SysRoleMenuMapper;
import com.prompt2repo.admin.mapper.SysUserMapper;
import com.prompt2repo.admin.mapper.SysUserRoleMapper;
import com.prompt2repo.admin.entity.SysUserRole;
import com.prompt2repo.admin.entity.SysRoleMenu;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(EmbeddedRedisConfig.class)
@Sql(scripts = "classpath:schema.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
public abstract class BaseIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected SysUserMapper sysUserMapper;

    @Autowired
    protected SysRoleMapper sysRoleMapper;

    @Autowired
    protected SysMenuMapper sysMenuMapper;

    @Autowired
    protected SysUserRoleMapper sysUserRoleMapper;

    @Autowired
    protected SysRoleMenuMapper sysRoleMenuMapper;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected StringRedisTemplate stringRedisTemplate;

    protected static final String ADMIN_USERNAME = "admin";
    protected static final String ADMIN_PASSWORD = "123456";
    protected static final String TEST_USERNAME = "testuser";
    protected static final String TEST_PASSWORD = "Test@12345";

    protected Long adminUserId;
    protected Long testUserId;
    protected Long superAdminRoleId;
    protected Long viewerRoleId;

    @BeforeEach
    public void setUpBase() {
        clearRedis();
        initTestData();
    }

    protected void clearRedis() {
        Set<String> keys = stringRedisTemplate.keys("*");
        if (keys != null && !keys.isEmpty()) {
            stringRedisTemplate.delete(keys);
        }
    }

    protected void initTestData() {
        SysMenu m1 = createMenu(0L, "仪表盘", "/dashboard", "fas fa-tachometer-alt", "dashboard:view", 1, 1);
        SysMenu m2 = createMenu(0L, "系统管理", "#", "fas fa-cogs", "system:root", 2, 1);
        SysMenu m6 = createMenu(0L, "日志审计", "#", "fas fa-history", "log:root", 3, 1);
        Long systemMenuId = m2.getId();
        Long logMenuId = m6.getId();

        SysMenu m3 = createMenu(systemMenuId, "用户信息", "/profile", "far fa-user", "user:view", 1, 1);
        SysMenu m4 = createMenu(systemMenuId, "菜单权限", "/menus", "fas fa-list", "menu:manage", 2, 1);
        SysMenu m5 = createMenu(systemMenuId, "用户管理", "/users", "fas fa-users-cog", "user:manage", 3, 1);
        SysMenu m8 = createMenu(systemMenuId, "角色管理", "/roles", "fas fa-user-tag", "role:manage", 4, 1);
        SysMenu m9 = createMenu(systemMenuId, "在线会话", "/online-sessions", "fas fa-user-clock", "session:view", 5, 1);
        SysMenu m11 = createMenu(systemMenuId, "公告管理", "/notices", "fas fa-bullhorn", "notice:manage", 6, 1);
        SysMenu m12 = createMenu(systemMenuId, "定时任务", "/scheduled-tasks", "fas fa-clock", "scheduledTask:manage", 7, 1);
        SysMenu m7 = createMenu(logMenuId, "操作日志", "/operation-logs", "fas fa-clipboard-list", "operationLog:view", 1, 1);
        SysMenu m10 = createMenu(logMenuId, "登录日志", "/login-logs", "fas fa-sign-in-alt", "loginLog:view", 2, 1);

        SysRole superAdmin = createRole("SUPER_ADMIN", "超级管理员", "拥有系统全部权限", 1, 1);
        SysRole viewer = createRole("VIEWER", "访客", "仅查看权限", 1, 4);
        superAdminRoleId = superAdmin.getId();
        viewerRoleId = viewer.getId();

        List<SysMenu> allMenus = Arrays.asList(m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12);
        for (SysMenu menu : allMenus) {
            SysRoleMenu rm = new SysRoleMenu();
            rm.setRoleId(superAdminRoleId);
            rm.setMenuId(menu.getId());
            rm.setCreatedAt(LocalDateTime.now());
            sysRoleMenuMapper.insert(rm);
        }

        SysRoleMenu viewerRm = new SysRoleMenu();
        viewerRm.setRoleId(viewerRoleId);
        viewerRm.setMenuId(m1.getId());
        viewerRm.setCreatedAt(LocalDateTime.now());
        sysRoleMenuMapper.insert(viewerRm);

        SysUser admin = createUser(ADMIN_USERNAME, ADMIN_PASSWORD, "系统管理员", 1);
        adminUserId = admin.getId();

        SysUser testUser = createUser(TEST_USERNAME, TEST_PASSWORD, "测试用户", 1);
        testUserId = testUser.getId();

        SysUserRole adminUr = new SysUserRole();
        adminUr.setUserId(adminUserId);
        adminUr.setRoleId(superAdminRoleId);
        adminUr.setCreatedAt(LocalDateTime.now());
        sysUserRoleMapper.insert(adminUr);

        SysUserRole viewerUr = new SysUserRole();
        viewerUr.setUserId(testUserId);
        viewerUr.setRoleId(viewerRoleId);
        viewerUr.setCreatedAt(LocalDateTime.now());
        sysUserRoleMapper.insert(viewerUr);
    }

    protected SysUser createUser(String username, String password, String nickname, Integer status) {
        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname);
        user.setUserStatus(status);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user.setDeleted(0);
        sysUserMapper.insert(user);
        return user;
    }

    protected SysRole createRole(String roleCode, String roleName, String description, Integer status, Integer sortOrder) {
        SysRole role = new SysRole();
        role.setRoleCode(roleCode);
        role.setRoleName(roleName);
        role.setDescription(description);
        role.setRoleStatus(status);
        role.setSortOrder(sortOrder);
        role.setCreatedAt(LocalDateTime.now());
        role.setUpdatedAt(LocalDateTime.now());
        role.setDeleted(0);
        sysRoleMapper.insert(role);
        return role;
    }

    protected SysMenu createMenu(Long parentId, String title, String path, String icon,
                                 String permCode, Integer sortOrder, Integer visible) {
        SysMenu menu = new SysMenu();
        menu.setParentId(parentId);
        menu.setTitle(title);
        menu.setPath(path);
        menu.setIcon(icon);
        menu.setPermCode(permCode);
        menu.setSortOrder(sortOrder);
        menu.setVisible(visible);
        menu.setCreatedAt(LocalDateTime.now());
        menu.setUpdatedAt(LocalDateTime.now());
        sysMenuMapper.insert(menu);
        return menu;
    }

    protected String loginAndGetToken(String username, String password) throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(username);
        loginRequest.setPassword(password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        var jsonNode = objectMapper.readTree(responseBody);
        if (jsonNode.get("code").asInt() == 0) {
            return jsonNode.get("data").get("token").asText();
        }
        throw new RuntimeException("登录失败: " + responseBody);
    }

    protected String authHeader(String token) {
        return "Bearer " + token;
    }
}
