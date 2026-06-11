package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class ScheduledTaskPageQuery {

    private Integer page = 1;

    private Integer size = 10;

    private String taskName;

    private String taskGroup;

    private Integer taskStatus;
}
