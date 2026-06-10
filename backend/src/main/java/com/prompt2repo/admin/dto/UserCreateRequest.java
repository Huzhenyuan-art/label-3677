package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class UserCreateRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 64, message = "用户名长度须在2-64位之间")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 64, message = "密码长度须在6-64位之间")
    private String password;

    @NotBlank(message = "昵称不能为空")
    @Size(min = 1, max = 64, message = "昵称长度须在1-64位之间")
    private String nickname;

    private String avatar;
}
