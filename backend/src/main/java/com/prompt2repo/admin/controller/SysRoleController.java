package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.AssignMenusRequest;
import com.prompt2repo.admin.dto.AssignRolesRequest;
import com.prompt2repo.admin.dto.RoleCreateRequest;
import com.prompt2repo.admin.dto.RolePageQuery;
import com.prompt2repo.admin.dto.RoleUpdateRequest;
import com.prompt2repo.admin.dto.RoleVO;
import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.service.SysRoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class SysRoleController {

    private final SysRoleService sysRoleService;

    @GetMapping
    @PreAuthorize("hasAuthority('role:manage')")
    public ApiResponse<IPage<RoleVO>> pageRoles(RolePageQuery query) {
        return ApiResponse.success(sysRoleService.pageRoles(query));
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('role:manage') or hasAuthority('user:manage')")
    public ApiResponse<List<RoleVO>> listRoles() {
        return ApiResponse.success(sysRoleService.listAllRoles());
    }

    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAuthority('role:manage') or hasAuthority('user:manage')")
    public ApiResponse<List<RoleVO>> listRolesByUserId(@PathVariable Long userId) {
        return ApiResponse.success(sysRoleService.listRolesByUserId(userId));
    }

    @GetMapping("/{id}/menus")
    @PreAuthorize("hasAuthority('role:manage')")
    public ApiResponse<List<Long>> listMenuIdsByRoleId(@PathVariable Long id) {
        return ApiResponse.success(sysRoleService.listMenuIdsByRoleId(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role:manage')")
    @OperationLog(module = "角色管理", description = "新增角色")
    public ApiResponse<Long> createRole(@Valid @RequestBody RoleCreateRequest request) {
        SysRole role = sysRoleService.createRole(request);
        return ApiResponse.success("新增成功", role.getId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('role:manage')")
    @OperationLog(module = "角色管理", description = "编辑角色")
    public ApiResponse<Void> updateRole(@PathVariable Long id,
                                         @Valid @RequestBody RoleUpdateRequest request) {
        sysRoleService.updateRole(id, request);
        return ApiResponse.success("编辑成功", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('role:manage')")
    @OperationLog(module = "角色管理", description = "删除角色")
    public ApiResponse<Void> deleteRole(@PathVariable Long id) {
        sysRoleService.deleteRole(id);
        return ApiResponse.success("删除成功", null);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAuthority('role:manage')")
    @OperationLog(module = "角色管理", description = "切换角色状态")
    public ApiResponse<Void> toggleStatus(@PathVariable Long id) {
        sysRoleService.toggleStatus(id);
        return ApiResponse.success("状态切换成功", null);
    }

    @PutMapping("/assign-menus")
    @PreAuthorize("hasAuthority('role:manage')")
    @OperationLog(module = "角色管理", description = "分配菜单权限")
    public ApiResponse<Void> assignMenus(@Valid @RequestBody AssignMenusRequest request) {
        sysRoleService.assignMenus(request);
        return ApiResponse.success("权限分配成功", null);
    }

    @PutMapping("/assign-roles")
    @PreAuthorize("hasAuthority('user:manage')")
    @OperationLog(module = "用户管理", description = "分配用户角色")
    public ApiResponse<Void> assignRoles(@Valid @RequestBody AssignRolesRequest request) {
        sysRoleService.assignRoles(request);
        return ApiResponse.success("角色分配成功", null);
    }
}
