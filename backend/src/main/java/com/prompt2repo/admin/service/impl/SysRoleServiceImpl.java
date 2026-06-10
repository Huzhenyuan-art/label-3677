package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.AssignMenusRequest;
import com.prompt2repo.admin.dto.AssignRolesRequest;
import com.prompt2repo.admin.dto.RoleCreateRequest;
import com.prompt2repo.admin.dto.RolePageQuery;
import com.prompt2repo.admin.dto.RoleUpdateRequest;
import com.prompt2repo.admin.dto.RoleVO;
import com.prompt2repo.admin.entity.SysRole;
import com.prompt2repo.admin.entity.SysRoleMenu;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.entity.SysUserRole;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.mapper.SysRoleMapper;
import com.prompt2repo.admin.mapper.SysRoleMenuMapper;
import com.prompt2repo.admin.mapper.SysUserRoleMapper;
import com.prompt2repo.admin.service.SysRoleService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysRoleServiceImpl extends ServiceImpl<SysRoleMapper, SysRole> implements SysRoleService {

    private final SysRoleMenuMapper sysRoleMenuMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final SysUserService sysUserService;

    private static final String SUPER_ADMIN_CODE = "SUPER_ADMIN";

    @Override
    public IPage<RoleVO> pageRoles(RolePageQuery query) {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(query.getRoleCode())) {
            wrapper.like(SysRole::getRoleCode, query.getRoleCode());
        }
        if (StringUtils.hasText(query.getRoleName())) {
            wrapper.like(SysRole::getRoleName, query.getRoleName());
        }
        if (query.getRoleStatus() != null) {
            wrapper.eq(SysRole::getRoleStatus, query.getRoleStatus());
        }
        wrapper.orderByAsc(SysRole::getSortOrder)
                .orderByDesc(SysRole::getCreatedAt);

        Page<SysRole> page = new Page<>(query.getPage(), query.getSize());
        IPage<SysRole> rolePage = page(page, wrapper);

        return rolePage.convert(this::toRoleVO);
    }

    @Override
    public List<RoleVO> listAllRoles() {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysRole::getRoleStatus, 1)
                .orderByAsc(SysRole::getSortOrder);
        return list(wrapper).stream()
                .map(this::toRoleVO)
                .collect(Collectors.toList());
    }

    @Override
    public List<RoleVO> listRolesByUserId(Long userId) {
        List<SysRole> roles = baseMapper.selectRolesByUserId(userId);
        return roles.stream()
                .map(this::toRoleVO)
                .collect(Collectors.toList());
    }

    @Override
    public List<Long> listMenuIdsByRoleId(Long roleId) {
        return sysRoleMenuMapper.selectMenuIdsByRoleId(roleId);
    }

    @Override
    @Transactional
    public SysRole createRole(RoleCreateRequest request) {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysRole::getRoleCode, request.getRoleCode());
        Long count = count(wrapper);
        if (count > 0) {
            throw new BusinessException(400, "角色编码已存在");
        }

        SysRole role = new SysRole();
        role.setRoleCode(request.getRoleCode());
        role.setRoleName(request.getRoleName());
        role.setDescription(request.getDescription());
        role.setRoleStatus(request.getRoleStatus() != null ? request.getRoleStatus() : 1);
        role.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : getNextSortOrder());
        role.setCreatedAt(LocalDateTime.now());
        role.setUpdatedAt(LocalDateTime.now());
        save(role);
        return role;
    }

    @Override
    @Transactional
    public void updateRole(Long id, RoleUpdateRequest request) {
        SysRole role = getById(id);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }

        if (SUPER_ADMIN_CODE.equals(role.getRoleCode())) {
            throw new BusinessException(400, "超级管理员角色不允许修改");
        }

        if (request.getRoleCode() != null) {
            LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(SysRole::getRoleCode, request.getRoleCode())
                    .ne(SysRole::getId, id);
            Long count = count(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "角色编码已存在");
            }
            role.setRoleCode(request.getRoleCode());
        }
        if (request.getRoleName() != null) {
            role.setRoleName(request.getRoleName());
        }
        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }
        if (request.getRoleStatus() != null) {
            role.setRoleStatus(request.getRoleStatus());
        }
        if (request.getSortOrder() != null) {
            role.setSortOrder(request.getSortOrder());
        }
        role.setUpdatedAt(LocalDateTime.now());
        updateById(role);

        if (request.getMenuIds() != null) {
            assignRoleMenusInternal(id, request.getMenuIds());
        }
    }

    @Override
    @Transactional
    public void deleteRole(Long id) {
        SysRole role = getById(id);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }

        if (SUPER_ADMIN_CODE.equals(role.getRoleCode())) {
            throw new BusinessException(400, "超级管理员角色不允许删除");
        }

        sysRoleMenuMapper.deleteByRoleId(id);
        sysUserRoleMapper.deleteByRoleId(id);
        removeById(id);
    }

    @Override
    @Transactional
    public void toggleStatus(Long id) {
        SysRole role = getById(id);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }

        if (SUPER_ADMIN_CODE.equals(role.getRoleCode())) {
            throw new BusinessException(400, "超级管理员角色不允许禁用");
        }

        role.setRoleStatus(role.getRoleStatus() == 1 ? 0 : 1);
        role.setUpdatedAt(LocalDateTime.now());
        updateById(role);
    }

    @Override
    @Transactional
    public void assignMenus(AssignMenusRequest request) {
        SysRole role = getById(request.getRoleId());
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }
        assignRoleMenusInternal(request.getRoleId(), request.getMenuIds());
    }

    @Override
    @Transactional
    public void assignRoles(AssignRolesRequest request) {
        SysUser user = sysUserService.getById(request.getUserId());
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        sysUserRoleMapper.deleteByUserId(request.getUserId());

        if (!CollectionUtils.isEmpty(request.getRoleIds())) {
            LocalDateTime now = LocalDateTime.now();
            List<SysUserRole> userRoles = request.getRoleIds().stream()
                    .map(roleId -> {
                        SysUserRole ur = new SysUserRole();
                        ur.setUserId(request.getUserId());
                        ur.setRoleId(roleId);
                        ur.setCreatedAt(now);
                        return ur;
                    })
                    .collect(Collectors.toList());
            for (SysUserRole ur : userRoles) {
                sysUserRoleMapper.insert(ur);
            }
        }
    }

    @Override
    public List<String> listPermCodesByUserId(Long userId) {
        if (isSuperAdmin(userId)) {
            return Collections.emptyList();
        }
        return sysRoleMenuMapper.selectPermCodesByUserId(userId);
    }

    @Override
    public List<Long> listMenuIdsByUserId(Long userId) {
        if (isSuperAdmin(userId)) {
            return Collections.emptyList();
        }
        return baseMapper.selectMenuIdsByUserId(userId);
    }

    @Override
    public boolean isSuperAdmin(Long userId) {
        List<SysRole> roles = baseMapper.selectRolesByUserId(userId);
        return roles.stream()
                .anyMatch(r -> SUPER_ADMIN_CODE.equals(r.getRoleCode()));
    }

    private void assignRoleMenusInternal(Long roleId, List<Long> menuIds) {
        sysRoleMenuMapper.deleteByRoleId(roleId);

        if (!CollectionUtils.isEmpty(menuIds)) {
            LocalDateTime now = LocalDateTime.now();
            List<SysRoleMenu> roleMenus = menuIds.stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .map(menuId -> {
                        SysRoleMenu rm = new SysRoleMenu();
                        rm.setRoleId(roleId);
                        rm.setMenuId(menuId);
                        rm.setCreatedAt(now);
                        return rm;
                    })
                    .collect(Collectors.toList());
            for (SysRoleMenu rm : roleMenus) {
                sysRoleMenuMapper.insert(rm);
            }
        }
    }

    private RoleVO toRoleVO(SysRole role) {
        return RoleVO.builder()
                .id(role.getId())
                .roleCode(role.getRoleCode())
                .roleName(role.getRoleName())
                .description(role.getDescription())
                .roleStatus(role.getRoleStatus())
                .sortOrder(role.getSortOrder())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .menuIds(new ArrayList<>())
                .build();
    }

    private Integer getNextSortOrder() {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SysRole::getSortOrder)
                .last("LIMIT 1");
        SysRole last = getOne(wrapper);
        return last != null && last.getSortOrder() != null ? last.getSortOrder() + 1 : 1;
    }
}
