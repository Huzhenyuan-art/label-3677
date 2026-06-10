package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.OperationLogPageQuery;
import com.prompt2repo.admin.dto.OperationLogVO;
import com.prompt2repo.admin.service.SysOperationLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/operation-logs")
@RequiredArgsConstructor
public class OperationLogController {

    private final SysOperationLogService operationLogService;

    @GetMapping
    @PreAuthorize("hasAuthority('operationLog:view')")
    public ApiResponse<IPage<OperationLogVO>> pageOperationLogs(OperationLogPageQuery query) {
        return ApiResponse.success(operationLogService.pageOperationLogs(query));
    }
}
