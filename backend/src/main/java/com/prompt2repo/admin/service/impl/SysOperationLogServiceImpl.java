package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.OperationLogPageQuery;
import com.prompt2repo.admin.dto.OperationLogVO;
import com.prompt2repo.admin.entity.SysOperationLog;
import com.prompt2repo.admin.mapper.SysOperationLogMapper;
import com.prompt2repo.admin.service.SysOperationLogService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class SysOperationLogServiceImpl extends ServiceImpl<SysOperationLogMapper, SysOperationLog> implements SysOperationLogService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public IPage<OperationLogVO> pageOperationLogs(OperationLogPageQuery query) {
        Page<SysOperationLog> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<SysOperationLog> wrapper = new LambdaQueryWrapper<>();

        if (query.getOperatorUsername() != null && !query.getOperatorUsername().isBlank()) {
            wrapper.like(SysOperationLog::getOperatorUsername, query.getOperatorUsername());
        }
        if (query.getOperationModule() != null && !query.getOperationModule().isBlank()) {
            wrapper.eq(SysOperationLog::getOperationModule, query.getOperationModule());
        }
        if (query.getSuccess() != null) {
            wrapper.eq(SysOperationLog::getSuccess, query.getSuccess());
        }
        if (query.getStartTime() != null && !query.getStartTime().isBlank()) {
            wrapper.ge(SysOperationLog::getCreatedAt, LocalDateTime.parse(query.getStartTime(), DATE_TIME_FORMATTER));
        }
        if (query.getEndTime() != null && !query.getEndTime().isBlank()) {
            wrapper.le(SysOperationLog::getCreatedAt, LocalDateTime.parse(query.getEndTime(), DATE_TIME_FORMATTER));
        }
        wrapper.orderByDesc(SysOperationLog::getCreatedAt);

        IPage<SysOperationLog> logPage = page(page, wrapper);
        return logPage.convert(this::toOperationLogVO);
    }

    @Override
    @Async
    public void saveOperationLog(SysOperationLog log) {
        save(log);
    }

    private OperationLogVO toOperationLogVO(SysOperationLog log) {
        return OperationLogVO.builder()
                .id(log.getId())
                .operatorId(log.getOperatorId())
                .operatorUsername(log.getOperatorUsername())
                .operatorNickname(log.getOperatorNickname())
                .operationModule(log.getOperationModule())
                .operationDesc(log.getOperationDesc())
                .requestMethod(log.getRequestMethod())
                .requestPath(log.getRequestPath())
                .requestParams(log.getRequestParams())
                .responseResult(log.getResponseResult())
                .executionTime(log.getExecutionTime())
                .success(log.getSuccess())
                .errorMessage(log.getErrorMessage())
                .clientIp(log.getClientIp())
                .userAgent(log.getUserAgent())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
