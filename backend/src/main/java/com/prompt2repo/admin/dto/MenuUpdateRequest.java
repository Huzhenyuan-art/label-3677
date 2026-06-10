package com.prompt2repo.admin.dto;

import lombok.Data;

import javax.validation.constraints.Size;

@Data
public class MenuUpdateRequest {

    private Long parentId;

    @Size(min = 1, max = 64, message = "菜单名称长度须在1-64位之间")
    private String title;

    @Size(max = 128, message = "菜单路径长度不能超过128位")
    private String path;

    @Size(max = 64, message = "图标长度不能超过64位")
    private String icon;

    @Size(max = 64, message = "权限码长度不能超过64位")
    private String permCode;

    private Integer sortOrder;

    private Integer visible;
}
