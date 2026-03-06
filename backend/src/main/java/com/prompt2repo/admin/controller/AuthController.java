package com.prompt2repo.admin.controller;

import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.LoginRequest;
import com.prompt2repo.admin.dto.LoginResponseVO;
import com.prompt2repo.admin.dto.UnlockRequest;
import com.prompt2repo.admin.dto.UserProfileVO;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.security.LoginUserDetails;
import com.prompt2repo.admin.service.LoginAttemptService;
import com.prompt2repo.admin.service.RedisSessionService;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysUserService;
import com.prompt2repo.admin.util.IpUtil;
import com.prompt2repo.admin.util.JwtTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.time.LocalDateTime;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;
    private final RedisSessionService redisSessionService;
    private final LoginAttemptService loginAttemptService;
    private final JwtTokenService jwtTokenService;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ApiResponse<LoginResponseVO> login(@Valid @RequestBody LoginRequest loginRequest,
                                              HttpServletRequest request) {
        String ip = IpUtil.getClientIp(request);
        loginAttemptService.assertAllow(ip);

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword())
            );

            LoginUserDetails userDetails = (LoginUserDetails) authentication.getPrincipal();
            SysUser user = userDetails.getUser();
            var permissions = sysMenuService.listPermissions();

            String token = jwtTokenService.generateToken(user.getId(), user.getUsername());
            redisSessionService.saveSession(user.getId(), user.getUsername(), permissions, jwtTokenService.getExpireSeconds());
            sysUserService.updateLastLogin(user.getId());
            loginAttemptService.clear(ip);

            log.info("用户登录成功 username={}, ip={}", user.getUsername(), ip);
            return ApiResponse.success("登录成功", buildLoginResponse(user, token));
        } catch (BadCredentialsException ex) {
            loginAttemptService.recordFailure(ip);
            throw new BusinessException(401, "用户名或密码错误");
        } catch (DisabledException ex) {
            throw new BusinessException(403, "用户已被禁用");
        } catch (AuthenticationException ex) {
            loginAttemptService.recordFailure(ip);
            throw new BusinessException(401, "登录失败，请检查账号或密码");
        }
    }

    @PostMapping("/unlock")
    public ApiResponse<String> unlock(@Valid @RequestBody UnlockRequest unlockRequest,
                                      Authentication authentication) {
        SysUser currentUser = getCurrentUser(authentication);
        if (!passwordEncoder.matches(unlockRequest.getPassword(), currentUser.getPassword())) {
            throw new BusinessException(401, "密码错误，解锁失败");
        }

        redisSessionService.refreshSession(currentUser.getId(), jwtTokenService.getExpireSeconds());
        log.info("用户解锁成功 username={}", currentUser.getUsername());
        return ApiResponse.success("解锁成功", "ok");
    }

    @GetMapping("/me")
    public ApiResponse<UserProfileVO> me(Authentication authentication) {
        SysUser currentUser = getCurrentUser(authentication);
        return ApiResponse.success(toUserProfile(currentUser));
    }

    private LoginResponseVO buildLoginResponse(SysUser user, String token) {
        return LoginResponseVO.builder()
                .token(token)
                .expireAt(LocalDateTime.now().plusSeconds(jwtTokenService.getExpireSeconds()))
                .user(toUserProfile(user))
                .menus(sysMenuService.listMenuTree())
                .build();
    }

    private UserProfileVO toUserProfile(SysUser user) {
        return UserProfileVO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .nickname(user.getNickname())
                .build();
    }

    private SysUser getCurrentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUserDetails)) {
            throw new BusinessException(401, "未登录或令牌已失效");
        }
        LoginUserDetails principal = (LoginUserDetails) authentication.getPrincipal();
        SysUser latest = sysUserService.getById(principal.getUser().getId());
        if (latest == null) {
            throw new BusinessException(401, "用户不存在");
        }
        return latest;
    }
}
