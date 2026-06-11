package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class NoticePageQuery {

    private String title;

    private Integer noticeType;

    private Integer noticeStatus;

    private Integer page = 1;

    private Integer size = 10;
}
