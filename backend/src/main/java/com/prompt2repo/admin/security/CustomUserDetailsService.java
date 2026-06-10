package com.prompt2repo.admin.security;

import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysRoleService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;
    private final SysRoleService sysRoleService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        SysUser user = sysUserService.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));

        if (user.getUserStatus() == null || user.getUserStatus() != 1) {
            throw new DisabledException("用户已禁用");
        }

        List<SysRole> roles = sysRoleService.listRolesByUserId(user.getId()).stream()
                .map(vo -> {
                    SysRole r = new SysRole();
                    r.setId(vo.getId());
                    r.setRoleCode(vo.getRoleCode());
                    r.setRoleName(vo.getRoleName());
                    r.setDescription(vo.getDescription());
                    return r;
                })
                .collect(Collectors.toList());

        boolean isSuperAdmin = sysRoleService.isSuperAdmin(user.getId());

        List<String> permissions;
        if (isSuperAdmin) {
            permissions = sysMenuService.listPermissions();
        } else {
            permissions = sysRoleService.listPermCodesByUserId(user.getId());
        }

        List<SimpleGrantedAuthority> authorities = permissions.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());

        return new LoginUserDetails(user, roles, isSuperAdmin, authorities);
    }
}
