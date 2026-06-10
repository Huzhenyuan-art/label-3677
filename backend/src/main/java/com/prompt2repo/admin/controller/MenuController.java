package com.prompt2repo.admin.controller;

import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.MenuCreateRequest;
import com.prompt2repo.admin.dto.MenuSortRequest;
import com.prompt2repo.admin.dto.MenuUpdateRequest;
import com.prompt2repo.admin.dto.MenuVO;
import com.prompt2repo.admin.entity.SysMenu;
import com.prompt2repo.admin.security.LoginUserDetails;
import com.prompt2repo.admin.service.SysMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final SysMenuService sysMenuService;

    @GetMapping
    public ApiResponse<List<MenuVO>> listMenus(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUserDetails)) {
            return ApiResponse.success(sysMenuService.listMenuTree());
        }
        LoginUserDetails principal = (LoginUserDetails) authentication.getPrincipal();
        return ApiResponse.success(sysMenuService.listMenuTreeByUserId(principal.getUser().getId()));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAuthority('menu:manage') or hasAuthority('role:manage')")
    public ApiResponse<List<MenuVO>> listAllMenus() {
        return ApiResponse.success(sysMenuService.listAllMenuTree());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('menu:manage')")
    @OperationLog(module = "菜单管理", description = "新增菜单")
    public ApiResponse<Long> createMenu(@Valid @RequestBody MenuCreateRequest request) {
        SysMenu menu = sysMenuService.createMenu(request);
        return ApiResponse.success("新增成功", menu.getId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('menu:manage')")
    @OperationLog(module = "菜单管理", description = "编辑菜单")
    public ApiResponse<Void> updateMenu(@PathVariable Long id,
                                         @Valid @RequestBody MenuUpdateRequest request) {
        sysMenuService.updateMenu(id, request);
        return ApiResponse.success("编辑成功", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('menu:manage')")
    @OperationLog(module = "菜单管理", description = "删除菜单")
    public ApiResponse<Void> deleteMenu(@PathVariable Long id) {
        sysMenuService.deleteMenu(id);
        return ApiResponse.success("删除成功", null);
    }

    @PutMapping("/{id}/visible")
    @PreAuthorize("hasAuthority('menu:manage')")
    @OperationLog(module = "菜单管理", description = "切换菜单显示状态")
    public ApiResponse<Void> toggleVisible(@PathVariable Long id) {
        sysMenuService.toggleVisible(id);
        return ApiResponse.success("状态切换成功", null);
    }

    @PutMapping("/sort")
    @PreAuthorize("hasAuthority('menu:manage')")
    @OperationLog(module = "菜单管理", description = "调整菜单排序")
    public ApiResponse<Void> updateSort(@Valid @RequestBody MenuSortRequest request) {
        sysMenuService.updateSort(request);
        return ApiResponse.success("排序更新成功", null);
    }
}
