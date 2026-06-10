package com.prompt2repo.admin.controller;

import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.ChangePasswordRequest;
import com.prompt2repo.admin.dto.LoginAttemptStatusVO;
import com.prompt2repo.admin.dto.LoginRequest;
import com.prompt2repo.admin.dto.LoginResponseVO;
import com.prompt2repo.admin.dto.UnlockRequest;
import com.prompt2repo.admin.dto.UpdateProfileRequest;
import com.prompt2repo.admin.dto.UserProfileVO;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.exception.TooManyRequestsException;
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
import org.springframework.web.bind.annotation.PutMapping;
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
    @OperationLog(module = "认证管理", description = "用户登录", recordResult = false)
    public ApiResponse<?> login(@Valid @RequestBody LoginRequest loginRequest,
                                              HttpServletRequest request) {
        String ip = IpUtil.getClientIp(request);

        try {
            loginAttemptService.assertAllow(ip);
        } catch (TooManyRequestsException ex) {
            LoginAttemptStatusVO status = loginAttemptService.getAttemptStatus(ip);
            return ApiResponse.fail(429, "登录尝试过于频繁，账户已被锁定", status);
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword())
            );

            LoginUserDetails userDetails = (LoginUserDetails) authentication.getPrincipal();
            SysUser user = userDetails.getUser();
            var permissions = sysMenuService.listPermissions();

            String token = jwtTokenService.generateToken(user.getId(), user.getUsername());
            String sessionId = jwtTokenService.parseSessionId(token);
            redisSessionService.saveSession(user.getId(), user.getUsername(), permissions, sessionId, jwtTokenService.getExpireSeconds());
            sysUserService.updateLastLogin(user.getId());
            loginAttemptService.clear(ip);

            log.info("用户登录成功 username={}, ip={}", user.getUsername(), ip);
            return ApiResponse.success("登录成功", buildLoginResponse(user, token));
        } catch (BadCredentialsException ex) {
            loginAttemptService.recordFailure(ip);
            LoginAttemptStatusVO status = loginAttemptService.getAttemptStatus(ip);
            return ApiResponse.fail(401, "用户名或密码错误", status);
        } catch (DisabledException ex) {
            throw new BusinessException(403, "用户已被禁用");
        } catch (AuthenticationException ex) {
            loginAttemptService.recordFailure(ip);
            LoginAttemptStatusVO status = loginAttemptService.getAttemptStatus(ip);
            return ApiResponse.fail(401, "登录失败，请检查账号或密码", status);
        }
    }

    @PostMapping("/unlock")
    @OperationLog(module = "认证管理", description = "解锁屏幕", recordResult = false)
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

    @PutMapping("/profile")
    @OperationLog(module = "个人中心", description = "更新个人资料")
    public ApiResponse<UserProfileVO> updateProfile(@Valid @RequestBody UpdateProfileRequest request,
                                                     Authentication authentication) {
        SysUser currentUser = getCurrentUser(authentication);
        sysUserService.updateProfile(currentUser.getId(), request.getNickname(), request.getAvatar());
        log.info("用户资料更新成功 username={}", currentUser.getUsername());
        SysUser updated = sysUserService.getById(currentUser.getId());
        return ApiResponse.success("资料更新成功", toUserProfile(updated));
    }

    @PutMapping("/password")
    @OperationLog(module = "个人中心", description = "修改密码", recordParams = false, recordResult = false)
    public ApiResponse<LoginResponseVO> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                                        Authentication authentication,
                                                        HttpServletRequest httpRequest) {
        SysUser currentUser = getCurrentUser(authentication);

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(400, "两次输入的新密码不一致");
        }

        if (passwordEncoder.matches(request.getNewPassword(), currentUser.getPassword())) {
            throw new BusinessException(400, "新密码不能与旧密码相同");
        }

        if (!passwordEncoder.matches(request.getOldPassword(), currentUser.getPassword())) {
            throw new BusinessException(401, "旧密码错误");
        }

        sysUserService.updatePassword(currentUser.getId(), passwordEncoder.encode(request.getNewPassword()));

        redisSessionService.deleteSession(currentUser.getId());

        var permissions = sysMenuService.listPermissions();
        String newToken = jwtTokenService.generateToken(currentUser.getId(), currentUser.getUsername());
        String sessionId = jwtTokenService.parseSessionId(newToken);
        redisSessionService.saveSession(currentUser.getId(), currentUser.getUsername(), permissions, sessionId, jwtTokenService.getExpireSeconds());

        log.info("用户修改密码成功 username={}", currentUser.getUsername());

        SysUser updatedUser = sysUserService.getById(currentUser.getId());
        return ApiResponse.success("密码修改成功", buildLoginResponse(updatedUser, newToken));
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
                .avatar(user.getAvatar())
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
