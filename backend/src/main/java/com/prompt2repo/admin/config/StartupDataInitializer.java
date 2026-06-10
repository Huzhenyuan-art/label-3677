package com.prompt2repo.admin.config;

import com.prompt2repo.admin.entity.SysMenu;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class StartupDataInitializer implements CommandLineRunner {

    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        initAdminUser();
        initMenus();
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
        sysMenuService.saveBatch(Arrays.asList(m1, m2));

        Long systemMenuId = m2.getId();
        SysMenu m3 = buildMenu(systemMenuId, "用户信息", "/profile", "far fa-user", "user:view", 1, 1);
        SysMenu m4 = buildMenu(systemMenuId, "菜单权限", "/menus", "fas fa-list", "menu:manage", 2, 1);
        SysMenu m5 = buildMenu(systemMenuId, "用户管理", "/users", "fas fa-users-cog", "user:manage", 3, 1);
        List<SysMenu> list = Arrays.asList(m1, m2, m3, m4, m5);
        sysMenuService.saveBatch(Arrays.asList(m3, m4, m5));
        log.info("初始化菜单数据完成，数量={}", list.size());
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
}
