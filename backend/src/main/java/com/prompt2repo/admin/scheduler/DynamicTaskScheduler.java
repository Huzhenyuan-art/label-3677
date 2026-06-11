package com.prompt2repo.admin.scheduler;

import com.prompt2repo.admin.entity.ScheduledTask;
import com.prompt2repo.admin.entity.TaskExecutionLog;
import com.prompt2repo.admin.mapper.ScheduledTaskMapper;
import com.prompt2repo.admin.service.SysOperationLogService;
import com.prompt2repo.admin.service.TaskExecutionLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.CronTask;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class DynamicTaskScheduler implements SchedulingConfigurer {

    private final ScheduledTaskMapper scheduledTaskMapper;
    private final TaskExecutionLogService taskExecutionLogService;
    private final SysOperationLogService operationLogService;
    private final ApplicationContext applicationContext;

    private ScheduledTaskRegistrar taskRegistrar;
    private final Map<Long, org.springframework.scheduling.config.ScheduledTask> scheduledTasks = new ConcurrentHashMap<>();

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        this.taskRegistrar = taskRegistrar;
        initTasks();
    }

    private void initTasks() {
        try {
            java.util.List<ScheduledTask> tasks = scheduledTaskMapper.selectList(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<ScheduledTask>()
                            .eq(ScheduledTask::getTaskStatus, 1)
                            .eq(ScheduledTask::getDeleted, 0)
            );
            for (ScheduledTask task : tasks) {
                addTask(task);
            }
            log.info("初始化加载 {} 个运行中的定时任务", tasks.size());
        } catch (Exception e) {
            log.error("初始化定时任务失败", e);
        }
    }

    public synchronized void addTask(ScheduledTask task) {
        if (scheduledTasks.containsKey(task.getId())) {
            removeTask(task.getId());
        }
        try {
            CronExpression.parse(task.getCronExpression());
        } catch (IllegalArgumentException e) {
            log.error("任务[{}]的Cron表达式[{}]无效: {}", task.getId(), task.getCronExpression(), e.getMessage());
            return;
        }
        Runnable runnable = createRunnable(task);
        CronTask cronTask = new CronTask(runnable, task.getCronExpression());
        org.springframework.scheduling.config.ScheduledTask scheduledTask = taskRegistrar.scheduleCronTask(cronTask);
        scheduledTasks.put(task.getId(), scheduledTask);
        log.info("定时任务[{}-{}]已启动, Cron: {}", task.getId(), task.getTaskName(), task.getCronExpression());
    }

    public synchronized void removeTask(Long taskId) {
        org.springframework.scheduling.config.ScheduledTask scheduledTask = scheduledTasks.remove(taskId);
        if (scheduledTask != null) {
            scheduledTask.cancel();
            log.info("定时任务[{}]已停止", taskId);
        }
    }

    private Runnable createRunnable(ScheduledTask task) {
        return () -> {
            LocalDateTime startTime = LocalDateTime.now();
            TaskExecutionLog executionLog = new TaskExecutionLog();
            executionLog.setTaskId(task.getId());
            executionLog.setTaskName(task.getTaskName());
            executionLog.setTaskGroup(task.getTaskGroup());
            executionLog.setCronExpression(task.getCronExpression());
            executionLog.setStartTime(startTime);

            try {
                Object bean = applicationContext.getBean(task.getBeanName());
                Method method;
                if (task.getMethodParams() != null && !task.getMethodParams().isBlank()) {
                    method = bean.getClass().getMethod(task.getMethodName(), String.class);
                    method.invoke(bean, task.getMethodParams());
                } else {
                    method = bean.getClass().getMethod(task.getMethodName());
                    method.invoke(bean);
                }
                executionLog.setExecutionStatus(1);
            } catch (Exception e) {
                executionLog.setExecutionStatus(0);
                executionLog.setErrorMessage(e.getMessage());
                log.error("定时任务[{}-{}]执行失败: {}", task.getId(), task.getTaskName(), e.getMessage(), e);
                writeFailureOperationLog(task, e);
            } finally {
                LocalDateTime endTime = LocalDateTime.now();
                executionLog.setEndTime(endTime);
                executionLog.setExecutionDuration(java.time.Duration.between(startTime, endTime).toMillis());
                executionLog.setCreatedAt(LocalDateTime.now());
                try {
                    taskExecutionLogService.saveExecutionLog(executionLog);
                } catch (Exception e) {
                    log.error("保存任务执行日志失败", e);
                }
            }
        };
    }

    private void writeFailureOperationLog(ScheduledTask task, Exception e) {
        try {
            com.prompt2repo.admin.entity.SysOperationLog opLog = new com.prompt2repo.admin.entity.SysOperationLog();
            opLog.setOperatorId(0L);
            opLog.setOperatorUsername("SYSTEM");
            opLog.setOperatorNickname("系统");
            opLog.setOperationModule("定时任务");
            opLog.setOperationDesc("任务[" + task.getTaskName() + "]执行失败");
            opLog.setRequestMethod("CRON");
            opLog.setRequestPath("/scheduled-task/" + task.getId());
            opLog.setRequestParams("{\"taskId\":" + task.getId() + ",\"taskName\":\"" + task.getTaskName() + "\"}");
            opLog.setExecutionTime(0L);
            opLog.setSuccess(0);
            opLog.setErrorMessage(e.getMessage());
            opLog.setClientIp("127.0.0.1");
            opLog.setUserAgent("ScheduledTaskRunner");
            opLog.setCreatedAt(LocalDateTime.now());
            operationLogService.saveOperationLog(opLog);
        } catch (Exception ex) {
            log.error("写入定时任务失败操作日志异常", ex);
        }
    }

    public LocalDateTime getNextExecutionTime(String cronExpression) {
        try {
            CronExpression cron = CronExpression.parse(cronExpression);
            return cron.next(LocalDateTime.now());
        } catch (Exception e) {
            return null;
        }
    }

    @PreDestroy
    public void destroy() {
        scheduledTasks.values().forEach(org.springframework.scheduling.config.ScheduledTask::cancel);
        scheduledTasks.clear();
        log.info("所有定时任务已停止");
    }
}
