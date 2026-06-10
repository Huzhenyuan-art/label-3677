package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.MenuCreateRequest;
import com.prompt2repo.admin.dto.MenuSortRequest;
import com.prompt2repo.admin.dto.MenuUpdateRequest;
import com.prompt2repo.admin.dto.MenuVO;
import com.prompt2repo.admin.entity.SysMenu;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.mapper.SysMenuMapper;
import com.prompt2repo.admin.service.SysMenuService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
        return buildMenuTree(listVisibleMenus());
    }

    @Override
    public List<MenuVO> listAllMenuTree() {
        LambdaQueryWrapper<SysMenu> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(SysMenu::getParentId)
                .orderByAsc(SysMenu::getSortOrder);
        return buildMenuTree(list(wrapper));
    }

    @Override
    public List<String> listPermissions() {
        return listVisibleMenus().stream()
                .map(SysMenu::getPermCode)
                .filter(perm -> perm != null && !perm.isBlank())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SysMenu createMenu(MenuCreateRequest request) {
        SysMenu parent = null;
        if (request.getParentId() != null && request.getParentId() > 0) {
            parent = getById(request.getParentId());
            if (parent == null) {
                throw new BusinessException(400, "父级菜单不存在");
            }
        }

        SysMenu menu = new SysMenu();
        menu.setParentId(request.getParentId() != null ? request.getParentId() : 0L);
        menu.setTitle(request.getTitle());
        menu.setPath(request.getPath());
        menu.setIcon(request.getIcon());
        menu.setPermCode(request.getPermCode());
        menu.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : getNextSortOrder(menu.getParentId()));
        menu.setVisible(request.getVisible() != null ? request.getVisible() : 1);
        menu.setCreatedAt(LocalDateTime.now());
        menu.setUpdatedAt(LocalDateTime.now());
        save(menu);
        return menu;
    }

    @Override
    @Transactional
    public void updateMenu(Long id, MenuUpdateRequest request) {
        SysMenu menu = getById(id);
        if (menu == null) {
            throw new BusinessException(404, "菜单不存在");
        }

        if (request.getParentId() != null) {
            if (request.getParentId().equals(id)) {
                throw new BusinessException(400, "不能将自己设为父级菜单");
            }
            if (request.getParentId() > 0) {
                SysMenu parent = getById(request.getParentId());
                if (parent == null) {
                    throw new BusinessException(400, "父级菜单不存在");
                }
                if (isDescendant(id, request.getParentId())) {
                    throw new BusinessException(400, "不能将菜单移动到其子菜单下");
                }
            }
            menu.setParentId(request.getParentId());
        }

        if (request.getTitle() != null) {
            menu.setTitle(request.getTitle());
        }
        if (request.getPath() != null) {
            menu.setPath(request.getPath());
        }
        if (request.getIcon() != null) {
            menu.setIcon(request.getIcon());
        }
        if (request.getPermCode() != null) {
            menu.setPermCode(request.getPermCode());
        }
        if (request.getSortOrder() != null) {
            menu.setSortOrder(request.getSortOrder());
        }
        if (request.getVisible() != null) {
            menu.setVisible(request.getVisible());
        }
        menu.setUpdatedAt(LocalDateTime.now());
        updateById(menu);
    }

    @Override
    @Transactional
    public void deleteMenu(Long id) {
        SysMenu menu = getById(id);
        if (menu == null) {
            throw new BusinessException(404, "菜单不存在");
        }

        LambdaQueryWrapper<SysMenu> childWrapper = new LambdaQueryWrapper<>();
        childWrapper.eq(SysMenu::getParentId, id);
        long childCount = count(childWrapper);
        if (childCount > 0) {
            throw new BusinessException(400, "存在子菜单，无法删除");
        }

        removeById(id);
    }

    @Override
    @Transactional
    public void toggleVisible(Long id) {
        SysMenu menu = getById(id);
        if (menu == null) {
            throw new BusinessException(404, "菜单不存在");
        }
        menu.setVisible(menu.getVisible() == 1 ? 0 : 1);
        menu.setUpdatedAt(LocalDateTime.now());
        updateById(menu);
    }

    @Override
    @Transactional
    public void updateSort(MenuSortRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (MenuSortRequest.SortItem item : request.getItems()) {
            SysMenu menu = getById(item.getId());
            if (menu != null) {
                menu.setSortOrder(item.getSortOrder());
                menu.setUpdatedAt(now);
                updateById(menu);
            }
        }
    }

    private List<MenuVO> buildMenuTree(List<SysMenu> menus) {
        Map<Long, MenuVO> map = new LinkedHashMap<>();

        for (SysMenu menu : menus) {
            map.put(menu.getId(), MenuVO.builder()
                    .id(menu.getId())
                    .parentId(menu.getParentId())
                    .title(menu.getTitle())
                    .path(menu.getPath())
                    .icon(menu.getIcon())
                    .permCode(menu.getPermCode())
                    .sortOrder(menu.getSortOrder())
                    .visible(menu.getVisible())
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

    private Integer getNextSortOrder(Long parentId) {
        LambdaQueryWrapper<SysMenu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysMenu::getParentId, parentId)
                .orderByDesc(SysMenu::getSortOrder)
                .last("LIMIT 1");
        SysMenu last = getOne(wrapper);
        return last != null && last.getSortOrder() != null ? last.getSortOrder() + 1 : 1;
    }

    private boolean isDescendant(Long ancestorId, Long targetId) {
        Long current = targetId;
        while (current != null && current > 0) {
            if (current.equals(ancestorId)) {
                return true;
            }
            SysMenu menu = getById(current);
            if (menu == null) {
                break;
            }
            current = menu.getParentId();
        }
        return false;
    }
}
