package com.prompt2repo.admin.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class OperationLogVO {

    private Long id;

    private Long operatorId;

    private String operatorUsername;

    private String operatorNickname;

    private String operationModule;

    private String operationDesc;

    private String requestMethod;

    private String requestPath;

    private String requestParams;

    private String responseResult;

    private Long executionTime;

    private Integer success;

    private String errorMessage;

    private String clientIp;

    private String userAgent;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
}
