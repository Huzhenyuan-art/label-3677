package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.*;
import com.prompt2repo.admin.service.ScheduledTaskService;
import com.prompt2repo.admin.service.TaskExecutionLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/scheduled-tasks")
@RequiredArgsConstructor
public class ScheduledTaskController {

    private final ScheduledTaskService scheduledTaskService;
    private final TaskExecutionLogService taskExecutionLogService;

    @GetMapping
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    public ApiResponse<IPage<ScheduledTaskVO>> pageScheduledTasks(ScheduledTaskPageQuery query) {
        return ApiResponse.success(scheduledTaskService.pageScheduledTasks(query));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    public ApiResponse<ScheduledTaskVO> getTaskDetail(@PathVariable Long id) {
        return ApiResponse.success(scheduledTaskService.getTaskDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    @OperationLog(module = "定时任务", description = "创建定时任务")
    public ApiResponse<ScheduledTaskVO> createTask(@Validated @RequestBody ScheduledTaskCreateRequest request) {
        return ApiResponse.success(scheduledTaskService.createTask(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    @OperationLog(module = "定时任务", description = "更新定时任务")
    public ApiResponse<ScheduledTaskVO> updateTask(@PathVariable Long id, @RequestBody ScheduledTaskUpdateRequest request) {
        return ApiResponse.success(scheduledTaskService.updateTask(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    @OperationLog(module = "定时任务", description = "删除定时任务")
    public ApiResponse<Void> deleteTask(@PathVariable Long id) {
        scheduledTaskService.deleteTask(id);
        return ApiResponse.success(null);
    }

    @PutMapping("/{id}/start")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    @OperationLog(module = "定时任务", description = "启动定时任务")
    public ApiResponse<Void> startTask(@PathVariable Long id) {
        scheduledTaskService.startTask(id);
        return ApiResponse.success(null);
    }

    @PutMapping("/{id}/pause")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    @OperationLog(module = "定时任务", description = "暂停定时任务")
    public ApiResponse<Void> pauseTask(@PathVariable Long id) {
        scheduledTaskService.pauseTask(id);
        return ApiResponse.success(null);
    }

    @GetMapping("/{id}/execution-logs")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    public ApiResponse<IPage<TaskExecutionLogVO>> pageExecutionLogs(
            @PathVariable Long id, TaskExecutionLogPageQuery query) {
        query.setTaskId(id);
        return ApiResponse.success(taskExecutionLogService.pageExecutionLogs(query));
    }

    @GetMapping("/{id}/execution-logs/latest")
    @PreAuthorize("hasAuthority('scheduledTask:manage')")
    public ApiResponse<TaskExecutionLogVO> getLatestExecutionLog(@PathVariable Long id) {
        return ApiResponse.success(taskExecutionLogService.getLatestExecutionLog(id));
    }
}
