package com.prompt2repo.admin.controller;

import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.DashboardOverviewVO;
import com.prompt2repo.admin.service.RedisSessionService;
import com.prompt2repo.admin.service.SysMenuService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final SysUserService sysUserService;
    private final SysMenuService sysMenuService;
    private final RedisSessionService redisSessionService;

    @GetMapping("/overview")
    public ApiResponse<DashboardOverviewVO> overview() {
        DashboardOverviewVO data = DashboardOverviewVO.builder()
                .userCount(sysUserService.count())
                .menuCount(sysMenuService.count())
                .onlineSessions(redisSessionService.countOnlineSessions())
                .serverTime(LocalDateTime.now())
                .build();
        return ApiResponse.success(data);
    }
}
