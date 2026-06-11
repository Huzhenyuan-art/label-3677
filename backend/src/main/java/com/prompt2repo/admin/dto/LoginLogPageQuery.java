package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class LoginLogPageQuery {

    private String username;

    private Integer loginStatus;

    private String clientIp;

    private String startTime;

    private String endTime;

    private Integer page = 1;

    private Integer size = 10;
}
