package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.LoginLogPageQuery;
import com.prompt2repo.admin.dto.LoginLogVO;
import com.prompt2repo.admin.dto.LoginTrendVO;
import com.prompt2repo.admin.service.SysLoginLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletResponse;
import java.util.List;

@RestController
@RequestMapping("/api/login-logs")
@RequiredArgsConstructor
public class LoginLogController {

    private final SysLoginLogService loginLogService;

    @GetMapping
    @PreAuthorize("hasAuthority('loginLog:view')")
    public ApiResponse<IPage<LoginLogVO>> pageLoginLogs(LoginLogPageQuery query) {
        return ApiResponse.success(loginLogService.pageLoginLogs(query));
    }

    @GetMapping("/trend")
    @PreAuthorize("hasAuthority('dashboard:view')")
    public ApiResponse<List<LoginTrendVO>> loginTrend7Days() {
        return ApiResponse.success(loginLogService.getLoginTrend7Days());
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('loginLog:view')")
    public void exportCsv(LoginLogPageQuery query, HttpServletResponse response) {
        loginLogService.exportCsv(query, response);
    }
}
