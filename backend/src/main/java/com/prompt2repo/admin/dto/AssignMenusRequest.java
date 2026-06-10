package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class AssignMenusRequest {
    private Long roleId;

    @NotEmpty(message = "菜单ID列表不能为空")
    private List<Long> menuIds;
}
