package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class AssignMenusRequest {
    @NotNull(message = "角色ID不能为空")
    private Long roleId;

    private List<Long> menuIds;
}
