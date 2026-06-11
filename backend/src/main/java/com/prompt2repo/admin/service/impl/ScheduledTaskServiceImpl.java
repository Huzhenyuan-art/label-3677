package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.ScheduledTaskCreateRequest;
import com.prompt2repo.admin.dto.ScheduledTaskPageQuery;
import com.prompt2repo.admin.dto.ScheduledTaskUpdateRequest;
import com.prompt2repo.admin.dto.ScheduledTaskVO;
import com.prompt2repo.admin.entity.ScheduledTask;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.mapper.ScheduledTaskMapper;
import com.prompt2repo.admin.scheduler.DynamicTaskScheduler;
import com.prompt2repo.admin.service.ScheduledTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ScheduledTaskServiceImpl extends ServiceImpl<ScheduledTaskMapper, ScheduledTask> implements ScheduledTaskService {

    @Lazy
    private final DynamicTaskScheduler dynamicTaskScheduler;

    @Override
    public IPage<ScheduledTaskVO> pageScheduledTasks(ScheduledTaskPageQuery query) {
        Page<ScheduledTask> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<ScheduledTask> wrapper = new LambdaQueryWrapper<>();
        if (query.getTaskName() != null && !query.getTaskName().isBlank()) {
            wrapper.like(ScheduledTask::getTaskName, query.getTaskName());
        }
        if (query.getTaskGroup() != null && !query.getTaskGroup().isBlank()) {
            wrapper.eq(ScheduledTask::getTaskGroup, query.getTaskGroup());
        }
        if (query.getTaskStatus() != null) {
            wrapper.eq(ScheduledTask::getTaskStatus, query.getTaskStatus());
        }
        wrapper.orderByDesc(ScheduledTask::getCreatedAt);
        IPage<ScheduledTask> taskPage = page(page, wrapper);
        return taskPage.convert(this::toVO);
    }

    @Override
    @Transactional
    public ScheduledTaskVO createTask(ScheduledTaskCreateRequest request) {
        ScheduledTask task = new ScheduledTask();
        BeanUtils.copyProperties(request, task);
        if (task.getTaskGroup() == null || task.getTaskGroup().isBlank()) {
            task.setTaskGroup("DEFAULT");
        }
        if (task.getMethodName() == null || task.getMethodName().isBlank()) {
            task.setMethodName("execute");
        }
        if (task.getTaskStatus() == null) {
            task.setTaskStatus(0);
        }
        task.setDeleted(0);
        save(task);
        if (task.getTaskStatus() == 1) {
            dynamicTaskScheduler.addTask(task);
        }
        return toVO(task);
    }

    @Override
    @Transactional
    public ScheduledTaskVO updateTask(Long id, ScheduledTaskUpdateRequest request) {
        ScheduledTask task = getById(id);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }
        boolean wasRunning = task.getTaskStatus() == 1;
        if (request.getTaskName() != null) task.setTaskName(request.getTaskName());
        if (request.getTaskGroup() != null) task.setTaskGroup(request.getTaskGroup());
        if (request.getCronExpression() != null) task.setCronExpression(request.getCronExpression());
        if (request.getBeanName() != null) task.setBeanName(request.getBeanName());
        if (request.getMethodName() != null) task.setMethodName(request.getMethodName());
        if (request.getMethodParams() != null) task.setMethodParams(request.getMethodParams());
        if (request.getTaskStatus() != null) task.setTaskStatus(request.getTaskStatus());
        if (request.getRemark() != null) task.setRemark(request.getRemark());
        updateById(task);
        if (wasRunning) {
            dynamicTaskScheduler.removeTask(id);
        }
        if (task.getTaskStatus() == 1) {
            dynamicTaskScheduler.addTask(task);
        }
        return toVO(task);
    }

    @Override
    @Transactional
    public void deleteTask(Long id) {
        ScheduledTask task = getById(id);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }
        if (task.getTaskStatus() == 1) {
            dynamicTaskScheduler.removeTask(id);
        }
        task.setDeleted(1);
        updateById(task);
    }

    @Override
    @Transactional
    public void startTask(Long id) {
        ScheduledTask task = getById(id);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }
        if (task.getTaskStatus() == 1) {
            throw new BusinessException("任务已在运行中");
        }
        task.setTaskStatus(1);
        updateById(task);
        dynamicTaskScheduler.addTask(task);
    }

    @Override
    @Transactional
    public void pauseTask(Long id) {
        ScheduledTask task = getById(id);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }
        if (task.getTaskStatus() == 0) {
            throw new BusinessException("任务已暂停");
        }
        task.setTaskStatus(0);
        updateById(task);
        dynamicTaskScheduler.removeTask(id);
    }

    @Override
    public ScheduledTaskVO getTaskDetail(Long id) {
        ScheduledTask task = getById(id);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }
        return toVO(task);
    }

    private ScheduledTaskVO toVO(ScheduledTask task) {
        ScheduledTaskVO vo = ScheduledTaskVO.builder()
                .id(task.getId())
                .taskName(task.getTaskName())
                .taskGroup(task.getTaskGroup())
                .cronExpression(task.getCronExpression())
                .beanName(task.getBeanName())
                .methodName(task.getMethodName())
                .methodParams(task.getMethodParams())
                .taskStatus(task.getTaskStatus())
                .remark(task.getRemark())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
        if (task.getTaskStatus() == 1) {
            try {
                vo.setNextExecutionTime(dynamicTaskScheduler.getNextExecutionTime(task.getCronExpression()));
            } catch (Exception ignored) {
            }
        }
        return vo;
    }
}
