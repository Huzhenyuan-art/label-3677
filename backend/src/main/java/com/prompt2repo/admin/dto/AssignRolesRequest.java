package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class AssignRolesRequest {
    @NotNull(message = "用户ID不能为空")
    private Long userId;

    private List<Long> roleIds;
}
