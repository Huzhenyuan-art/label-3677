package com.prompt2repo.admin.controller;

import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.OnlineSessionVO;
import com.prompt2repo.admin.service.RedisSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final RedisSessionService redisSessionService;

    @GetMapping("/online")
    @PreAuthorize("hasAuthority('session:view') or hasAuthority('user:manage')")
    public ApiResponse<List<OnlineSessionVO>> listOnlineSessions() {
        List<OnlineSessionVO> sessions = redisSessionService.listOnlineSessions();
        return ApiResponse.success(sessions);
    }

    @GetMapping("/online/count")
    public ApiResponse<Long> countOnlineSessions() {
        Long count = redisSessionService.countOnlineSessions();
        return ApiResponse.success(count);
    }

    @DeleteMapping("/{userId}/force-logout")
    @PreAuthorize("hasAuthority('session:manage') or hasAuthority('user:manage')")
    @OperationLog(module = "会话管理", description = "强制用户下线")
    public ApiResponse<Boolean> forceLogout(@PathVariable Long userId) {
        boolean result = redisSessionService.forceLogout(userId);
        return ApiResponse.success(result ? "强制下线成功" : "强制下线失败", result);
    }
}
