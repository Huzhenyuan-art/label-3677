package com.prompt2repo.admin.dto;

import lombok.Data;

@Data
public class RolePageQuery {
    private String roleCode;
    private String roleName;
    private Integer roleStatus;
    private Integer page = 1;
    private Integer size = 10;
}
