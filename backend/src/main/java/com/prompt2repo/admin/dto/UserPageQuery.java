package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class UserPageQuery {

    private String username;

    private String nickname;

    private Integer userStatus;

    private Integer page = 1;

    private Integer size = 10;
}
