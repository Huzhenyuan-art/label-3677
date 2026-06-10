package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.UserCreateRequest;
import com.prompt2repo.admin.dto.UserPageQuery;
import com.prompt2repo.admin.dto.UserUpdateRequest;
import com.prompt2repo.admin.dto.UserVO;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class SysUserController {

    private final SysUserService sysUserService;

    @GetMapping
    @PreAuthorize("hasAuthority('user:manage')")
    public ApiResponse<IPage<UserVO>> pageUsers(UserPageQuery query) {
        return ApiResponse.success(sysUserService.pageUsers(query));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user:manage')")
    @OperationLog(module = "用户管理", description = "新增用户")
    public ApiResponse<Long> createUser(@Valid @RequestBody UserCreateRequest request) {
        Long userId = sysUserService.createUser(request);
        return ApiResponse.success("新增成功", userId);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user:manage')")
    @OperationLog(module = "用户管理", description = "编辑用户")
    public ApiResponse<Void> updateUser(@PathVariable Long id,
                                         @Valid @RequestBody UserUpdateRequest request) {
        sysUserService.updateUser(id, request);
        return ApiResponse.success("编辑成功", null);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAuthority('user:manage')")
    @OperationLog(module = "用户管理", description = "切换用户状态")
    public ApiResponse<Void> toggleStatus(@PathVariable Long id) {
        sysUserService.toggleUserStatus(id);
        return ApiResponse.success("状态切换成功", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user:manage')")
    @OperationLog(module = "用户管理", description = "删除用户")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        sysUserService.deleteUser(id);
        return ApiResponse.success("删除成功", null);
    }
}
