package com.prompt2repo.admin.controller;

import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.MenuVO;
import com.prompt2repo.admin.service.SysMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final SysMenuService sysMenuService;

    @GetMapping
    public ApiResponse<List<MenuVO>> listMenus() {
        return ApiResponse.success(sysMenuService.listMenuTree());
    }
}
