package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.TaskExecutionLogPageQuery;
import com.prompt2repo.admin.dto.TaskExecutionLogVO;
import com.prompt2repo.admin.entity.TaskExecutionLog;

public interface TaskExecutionLogService extends IService<TaskExecutionLog> {

    IPage<TaskExecutionLogVO> pageExecutionLogs(TaskExecutionLogPageQuery query);

    TaskExecutionLogVO getLatestExecutionLog(Long taskId);

    void saveExecutionLog(TaskExecutionLog log);
}
