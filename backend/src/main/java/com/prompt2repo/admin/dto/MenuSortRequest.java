package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class MenuSortRequest {

    @NotNull(message = "排序数据不能为空")
    private List<SortItem> items;

    @Data
    public static class SortItem {
        @NotNull(message = "菜单ID不能为空")
        private Long id;

        @NotNull(message = "排序值不能为空")
        private Integer sortOrder;
    }
}
