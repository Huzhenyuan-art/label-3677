package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.MenuCreateRequest;
import com.prompt2repo.admin.dto.MenuSortRequest;
import com.prompt2repo.admin.dto.MenuUpdateRequest;
import com.prompt2repo.admin.dto.MenuVO;
import com.prompt2repo.admin.entity.SysMenu;

import java.util.List;

public interface SysMenuService extends IService<SysMenu> {

    List<SysMenu> listVisibleMenus();

    List<MenuVO> listMenuTree();

    List<MenuVO> listAllMenuTree();

    List<String> listPermissions();

    SysMenu createMenu(MenuCreateRequest request);

    void updateMenu(Long id, MenuUpdateRequest request);

    void deleteMenu(Long id);

    void toggleVisible(Long id);

    void updateSort(MenuSortRequest request);
}
