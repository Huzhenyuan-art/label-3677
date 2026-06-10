package com.prompt2repo.admin.security;

import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.service.RedisSessionService;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysRoleService;
import com.prompt2repo.admin.service.SysUserService;
import com.prompt2repo.admin.util.JwtTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService jwtTokenService;
    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;
    private final SysRoleService sysRoleService;
    private final RedisSessionService redisSessionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            Long userId = jwtTokenService.parseUserId(token);
            if (!redisSessionService.hasSession(userId)) {
                throw new BusinessException(401, "登录状态已失效，请重新登录");
            }

            String tokenSessionId = jwtTokenService.parseSessionId(token);
            String redisSessionId = redisSessionService.getSessionId(userId);
            if (tokenSessionId == null || !tokenSessionId.equals(redisSessionId)) {
                throw new BusinessException(401, "会话已变更，请重新登录");
            }

            SysUser user = sysUserService.getById(userId);
            if (user == null || user.getUserStatus() == null || user.getUserStatus() != 1) {
                throw new BusinessException(401, "用户状态异常，请重新登录");
            }

            boolean isSuperAdmin = sysRoleService.isSuperAdmin(userId);
            List<SysRole> roles = sysRoleService.listRolesByUserId(userId).stream()
                    .map(vo -> {
                        SysRole r = new SysRole();
                        r.setId(vo.getId());
                        r.setRoleCode(vo.getRoleCode());
                        r.setRoleName(vo.getRoleName());
                        return r;
                    })
                    .collect(Collectors.toList());

            List<String> permissions = redisSessionService.getPermissions(userId);
            if (permissions == null || permissions.isEmpty()) {
                if (isSuperAdmin) {
                    permissions = sysMenuService.listPermissions();
                } else {
                    permissions = sysRoleService.listPermCodesByUserId(userId);
                }
            }

            List<SimpleGrantedAuthority> authorities = (permissions != null ? permissions : Collections.<String>emptyList())
                    .stream()
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());

            LoginUserDetails principal = new LoginUserDetails(user, roles, isSuperAdmin, authorities);
            UsernamePasswordAuthenticationToken authenticationToken =
                    new UsernamePasswordAuthenticationToken(principal, null, authorities);
            authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authenticationToken);
        } catch (BusinessException ex) {
            log.debug("JWT 鉴权失败 path={}, message={}", request.getRequestURI(), ex.getMessage());
        } catch (Exception ex) {
            log.debug("JWT 鉴权异常 path={}, message={}", request.getRequestURI(), ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
