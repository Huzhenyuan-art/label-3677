package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.Size;

@Data
public class ScheduledTaskUpdateRequest {

    @Size(max = 64, message = "任务名称最长64字符")
    private String taskName;

    @Size(max = 64, message = "任务分组最长64字符")
    private String taskGroup;

    @Size(max = 128, message = "Cron表达式最长128字符")
    private String cronExpression;

    @Size(max = 128, message = "Bean名称最长128字符")
    private String beanName;

    @Size(max = 128, message = "方法名称最长128字符")
    private String methodName;

    @Size(max = 512, message = "方法参数最长512字符")
    private String methodParams;

    private Integer taskStatus;

    @Size(max = 255, message = "备注最长255字符")
    private String remark;
}
