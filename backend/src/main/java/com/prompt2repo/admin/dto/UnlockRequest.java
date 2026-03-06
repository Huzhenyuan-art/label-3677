package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class UnlockRequest {

    @NotBlank(message = "解锁密码不能为空")
    @Size(max = 64, message = "密码长度不能超过64")
    private String password;
}
