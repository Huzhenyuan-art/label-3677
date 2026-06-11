package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class UserNoticePageQuery {

    private Integer noticeType;

    private Integer readStatus;

    private Integer page = 1;

    private Integer size = 10;
}
