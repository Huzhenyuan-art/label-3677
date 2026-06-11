package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.TaskExecutionLogPageQuery;
import com.prompt2repo.admin.dto.TaskExecutionLogVO;
import com.prompt2repo.admin.entity.TaskExecutionLog;
import com.prompt2repo.admin.mapper.TaskExecutionLogMapper;
import com.prompt2repo.admin.service.TaskExecutionLogService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class TaskExecutionLogServiceImpl extends ServiceImpl<TaskExecutionLogMapper, TaskExecutionLog> implements TaskExecutionLogService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public IPage<TaskExecutionLogVO> pageExecutionLogs(TaskExecutionLogPageQuery query) {
        Page<TaskExecutionLog> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<TaskExecutionLog> wrapper = new LambdaQueryWrapper<>();
        if (query.getTaskId() != null) {
            wrapper.eq(TaskExecutionLog::getTaskId, query.getTaskId());
        }
        if (query.getTaskName() != null && !query.getTaskName().isBlank()) {
            wrapper.like(TaskExecutionLog::getTaskName, query.getTaskName());
        }
        if (query.getExecutionStatus() != null) {
            wrapper.eq(TaskExecutionLog::getExecutionStatus, query.getExecutionStatus());
        }
        if (query.getStartTime() != null && !query.getStartTime().isBlank()) {
            wrapper.ge(TaskExecutionLog::getStartTime, LocalDateTime.parse(query.getStartTime(), DATE_TIME_FORMATTER));
        }
        if (query.getEndTime() != null && !query.getEndTime().isBlank()) {
            wrapper.le(TaskExecutionLog::getStartTime, LocalDateTime.parse(query.getEndTime(), DATE_TIME_FORMATTER));
        }
        wrapper.orderByDesc(TaskExecutionLog::getCreatedAt);
        IPage<TaskExecutionLog> logPage = page(page, wrapper);
        return logPage.convert(this::toVO);
    }

    @Override
    public TaskExecutionLogVO getLatestExecutionLog(Long taskId) {
        LambdaQueryWrapper<TaskExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskExecutionLog::getTaskId, taskId);
        wrapper.orderByDesc(TaskExecutionLog::getCreatedAt);
        wrapper.last("LIMIT 1");
        TaskExecutionLog log = getOne(wrapper, false);
        return log != null ? toVO(log) : null;
    }

    @Override
    @Async
    public void saveExecutionLog(TaskExecutionLog log) {
        save(log);
    }

    private TaskExecutionLogVO toVO(TaskExecutionLog log) {
        return TaskExecutionLogVO.builder()
                .id(log.getId())
                .taskId(log.getTaskId())
                .taskName(log.getTaskName())
                .taskGroup(log.getTaskGroup())
                .cronExpression(log.getCronExpression())
                .executionStatus(log.getExecutionStatus())
                .executionDuration(log.getExecutionDuration())
                .errorMessage(log.getErrorMessage())
                .startTime(log.getStartTime())
                .endTime(log.getEndTime())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
