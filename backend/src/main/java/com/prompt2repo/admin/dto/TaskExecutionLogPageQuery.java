package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class TaskExecutionLogPageQuery {

    private Integer page = 1;

    private Integer size = 10;

    private Long taskId;

    private String taskName;

    private Integer executionStatus;

    private String startTime;

    private String endTime;
}
