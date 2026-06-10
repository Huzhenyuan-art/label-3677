package com.prompt2repo.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_operation_log")
public class SysOperationLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_username")
    private String operatorUsername;

    @TableField("operator_nickname")
    private String operatorNickname;

    @TableField("operation_module")
    private String operationModule;

    @TableField("operation_desc")
    private String operationDesc;

    @TableField("request_method")
    private String requestMethod;

    @TableField("request_path")
    private String requestPath;

    @TableField("request_params")
    private String requestParams;

    @TableField("response_result")
    private String responseResult;

    @TableField("execution_time")
    private Long executionTime;

    private Integer success;

    @TableField("error_message")
    private String errorMessage;

    @TableField("client_ip")
    private String clientIp;

    @TableField("user_agent")
    private String userAgent;

    @TableField("created_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
}
