package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.ScheduledTaskCreateRequest;
import com.prompt2repo.admin.dto.ScheduledTaskPageQuery;
import com.prompt2repo.admin.dto.ScheduledTaskUpdateRequest;
import com.prompt2repo.admin.dto.ScheduledTaskVO;
import com.prompt2repo.admin.entity.ScheduledTask;

public interface ScheduledTaskService extends IService<ScheduledTask> {

    IPage<ScheduledTaskVO> pageScheduledTasks(ScheduledTaskPageQuery query);

    ScheduledTaskVO createTask(ScheduledTaskCreateRequest request);

    ScheduledTaskVO updateTask(Long id, ScheduledTaskUpdateRequest request);

    void deleteTask(Long id);

    void startTask(Long id);

    void pauseTask(Long id);

    ScheduledTaskVO getTaskDetail(Long id);
}
