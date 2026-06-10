package com.prompt2repo.admin.config;

import com.prompt2repo.admin.dto.AssignRolesRequest;
import com.prompt2repo.admin.entity.SysMenu;
import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysRoleService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class StartupDataInitializer implements CommandLineRunner {

    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;
    private final SysRoleService sysRoleService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        initAdminUser();
        initMenus();
        initRoles();
        initAdminRoleBinding();
    }

    private void initAdminUser() {
        SysUser admin = sysUserService.findByUsername("admin").orElse(null);
        if (admin == null) {
            SysUser user = new SysUser();
            user.setUsername("admin");
            user.setPassword(passwordEncoder.encode("123456"));
            user.setNickname("系统管理员");
            user.setUserStatus(1);
            sysUserService.save(user);
            log.info("初始化管理员账号完成，用户名：admin");
            return;
        }

        if (!passwordEncoder.matches("123456", admin.getPassword())) {
            admin.setPassword(passwordEncoder.encode("123456"));
            sysUserService.updateById(admin);
            log.info("管理员账号密码已按 BCrypt 规范重新加密");
        }
    }

    private void initMenus() {
        if (sysMenuService.count() > 0) {
            return;
        }

        SysMenu m1 = buildMenu(0L, "仪表盘", "/dashboard", "fas fa-tachometer-alt", "dashboard:view", 1, 1);
        SysMenu m2 = buildMenu(0L, "系统管理", "#", "fas fa-cogs", "system:root", 2, 1);
        SysMenu m6 = buildMenu(0L, "日志审计", "#", "fas fa-history", "log:root", 3, 1);
        sysMenuService.saveBatch(Arrays.asList(m1, m2, m6));

        Long systemMenuId = m2.getId();
        SysMenu m3 = buildMenu(systemMenuId, "用户信息", "/profile", "far fa-user", "user:view", 1, 1);
        SysMenu m4 = buildMenu(systemMenuId, "菜单权限", "/menus", "fas fa-list", "menu:manage", 2, 1);
        SysMenu m5 = buildMenu(systemMenuId, "用户管理", "/users", "fas fa-users-cog", "user:manage", 3, 1);
        SysMenu m8 = buildMenu(systemMenuId, "角色管理", "/roles", "fas fa-user-tag", "role:manage", 4, 1);

        Long logMenuId = m6.getId();
        SysMenu m7 = buildMenu(logMenuId, "操作日志", "/operation-logs", "fas fa-clipboard-list", "operationLog:view", 1, 1);

        sysMenuService.saveBatch(Arrays.asList(m3, m4, m5, m7, m8));
        log.info("初始化菜单数据完成");
    }

    private void initRoles() {
        if (sysRoleService.count() > 0) {
            return;
        }

        List<SysRole> roles = new ArrayList<>();
        roles.add(buildRole("SUPER_ADMIN", "超级管理员", "拥有系统全部权限", 1, 1));
        roles.add(buildRole("SYSTEM_ADMIN", "系统管理员", "负责用户、菜单、角色等系统级管理", 1, 2));
        roles.add(buildRole("OPERATOR", "运营人员", "日常运营操作权限", 1, 3));
        roles.add(buildRole("VIEWER", "访客", "仅查看权限", 1, 4));
        sysRoleService.saveBatch(roles);
        log.info("初始化角色数据完成，数量={}", roles.size());
    }

    private void initAdminRoleBinding() {
        SysUser admin = sysUserService.findByUsername("admin").orElse(null);
        if (admin == null) {
            return;
        }
        SysRole superAdmin = sysRoleService.lambdaQuery()
                .eq(SysRole::getRoleCode, "SUPER_ADMIN")
                .one();
        if (superAdmin == null) {
            return;
        }
        List<Long> existingRoleIds = sysRoleService.listRolesByUserId(admin.getId()).stream()
                .map(r -> r.getId())
                .toList();
        if (!existingRoleIds.contains(superAdmin.getId())) {
            AssignRolesRequest req = new AssignRolesRequest();
            req.setUserId(admin.getId());
            req.setRoleIds(Arrays.asList(superAdmin.getId()));
            sysRoleService.assignRoles(req);
            log.info("管理员账号绑定超级管理员角色完成");
        }
    }

    private SysMenu buildMenu(Long parentId, String title, String path, String icon,
                              String permCode, Integer sortOrder, Integer visible) {
        SysMenu menu = new SysMenu();
        menu.setParentId(parentId);
        menu.setTitle(title);
        menu.setPath(path);
        menu.setIcon(icon);
        menu.setPermCode(permCode);
        menu.setSortOrder(sortOrder);
        menu.setVisible(visible);
        return menu;
    }

    private SysRole buildRole(String roleCode, String roleName, String description,
                              Integer roleStatus, Integer sortOrder) {
        SysRole role = new SysRole();
        role.setRoleCode(roleCode);
        role.setRoleName(roleName);
        role.setDescription(description);
        role.setRoleStatus(roleStatus);
        role.setSortOrder(sortOrder);
        return role;
    }
}
