package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class OperationLogPageQuery {

    private String operatorUsername;

    private String operationModule;

    private Integer success;

    private String startTime;

    private String endTime;

    private Integer page = 1;

    private Integer size = 10;
}
