package com.prompt2repo.admin.security;

import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.entity.SysUser;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.List;

@Getter
public class LoginUserDetails implements UserDetails {

    private final SysUser user;
    private final List<SysRole> roles;
    private final boolean superAdmin;
    private final Collection<? extends GrantedAuthority> authorities;

    public LoginUserDetails(SysUser user, List<SysRole> roles, boolean superAdmin,
                            Collection<? extends GrantedAuthority> authorities) {
        this.user = user;
        this.roles = roles != null ? roles : Collections.emptyList();
        this.superAdmin = superAdmin;
        this.authorities = authorities;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.getUserStatus() != null && user.getUserStatus() == 1;
    }
}
