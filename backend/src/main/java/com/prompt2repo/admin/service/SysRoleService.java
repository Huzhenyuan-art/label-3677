package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.AssignMenusRequest;
import com.prompt2repo.admin.dto.AssignRolesRequest;
import com.prompt2repo.admin.dto.RoleCreateRequest;
import com.prompt2repo.admin.dto.RolePageQuery;
import com.prompt2repo.admin.dto.RoleUpdateRequest;
import com.prompt2repo.admin.dto.RoleVO;
import com.prompt2repo.admin.entity.SysRole;

import java.util.List;

public interface SysRoleService extends IService<SysRole> {

    IPage<RoleVO> pageRoles(RolePageQuery query);

    List<RoleVO> listAllRoles();

    List<RoleVO> listRolesByUserId(Long userId);

    List<Long> listMenuIdsByRoleId(Long roleId);

    SysRole createRole(RoleCreateRequest request);

    void updateRole(Long id, RoleUpdateRequest request);

    void deleteRole(Long id);

    void toggleStatus(Long id);

    void assignMenus(AssignMenusRequest request);

    void assignRoles(AssignRolesRequest request);

    List<String> listPermCodesByUserId(Long userId);

    List<Long> listMenuIdsByUserId(Long userId);

    boolean isSuperAdmin(Long userId);
}
