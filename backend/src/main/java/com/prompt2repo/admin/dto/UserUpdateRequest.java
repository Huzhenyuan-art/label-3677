package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.Size;

@Data
public class UserUpdateRequest {

    @Size(min = 1, max = 64, message = "昵称长度须在1-64位之间")
    private String nickname;

    private String avatar;
}
