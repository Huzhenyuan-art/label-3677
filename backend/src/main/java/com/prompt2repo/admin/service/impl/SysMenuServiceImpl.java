package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.MenuVO;
import com.prompt2repo.admin.entity.SysMenu;
import com.prompt2repo.admin.mapper.SysMenuMapper;
import com.prompt2repo.admin.service.SysMenuService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class SysMenuServiceImpl extends ServiceImpl<SysMenuMapper, SysMenu> implements SysMenuService {

    @Override
    public List<SysMenu> listVisibleMenus() {
        LambdaQueryWrapper<SysMenu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysMenu::getVisible, 1)
                .orderByAsc(SysMenu::getParentId)
                .orderByAsc(SysMenu::getSortOrder);
        return list(wrapper);
    }

    @Override
    public List<MenuVO> listMenuTree() {
        List<SysMenu> menus = listVisibleMenus();
        Map<Long, MenuVO> map = new LinkedHashMap<>();

        for (SysMenu menu : menus) {
            map.put(menu.getId(), MenuVO.builder()
                    .id(menu.getId())
                    .parentId(menu.getParentId())
                    .title(menu.getTitle())
                    .path(menu.getPath())
                    .icon(menu.getIcon())
                    .permCode(menu.getPermCode())
                    .build());
        }

        List<MenuVO> roots = new ArrayList<>();
        for (MenuVO node : map.values()) {
            if (Objects.equals(node.getParentId(), 0L)) {
                roots.add(node);
                continue;
            }
            MenuVO parent = map.get(node.getParentId());
            if (parent != null) {
                parent.getChildren().add(node);
            }
        }
        return roots;
    }

    @Override
    public List<String> listPermissions() {
        return listVisibleMenus().stream()
                .map(SysMenu::getPermCode)
                .filter(perm -> perm != null && !perm.isBlank())
                .collect(Collectors.toList());
    }
}
