package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.MenuVO;
import com.prompt2repo.admin.entity.SysMenu;

import java.util.List;

public interface SysMenuService extends IService<SysMenu> {

    List<SysMenu> listVisibleMenus();

    List<MenuVO> listMenuTree();

    List<String> listPermissions();
}
