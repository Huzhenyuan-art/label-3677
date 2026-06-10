package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class RoleCreateRequest {
    @NotBlank(message = "角色编码不能为空")
    @Size(max = 64, message = "角色编码最长64字符")
    private String roleCode;

    @NotBlank(message = "角色名称不能为空")
    @Size(max = 64, message = "角色名称最长64字符")
    private String roleName;

    @Size(max = 255, message = "描述最长255字符")
    private String description;

    private Integer roleStatus;
    private Integer sortOrder;
}
