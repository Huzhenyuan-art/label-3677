package com.prompt2repo.admin.security;

import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        SysUser user = sysUserService.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));

        if (user.getUserStatus() == null || user.getUserStatus() != 1) {
            throw new DisabledException("用户已禁用");
        }

        List<SimpleGrantedAuthority> authorities = sysMenuService.listPermissions().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());

        return new LoginUserDetails(user, authorities);
    }
}
