package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.RoleVO;
import com.prompt2repo.admin.dto.UserCreateRequest;
import com.prompt2repo.admin.dto.UserPageQuery;
import com.prompt2repo.admin.dto.UserUpdateRequest;
import com.prompt2repo.admin.dto.UserVO;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.mapper.SysUserMapper;
import com.prompt2repo.admin.service.SysRoleService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SysUserServiceImpl extends ServiceImpl<SysUserMapper, SysUser> implements SysUserService {

    private final PasswordEncoder passwordEncoder;
    private final SysRoleService sysRoleService;

    @Override
    public Optional<SysUser> findByUsername(String username) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysUser::getUsername, username);
        return Optional.ofNullable(getOne(wrapper, false));
    }

    @Override
    public void updateLastLogin(Long userId) {
        LambdaUpdateWrapper<SysUser> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysUser::getId, userId)
                .set(SysUser::getLastLoginAt, LocalDateTime.now());
        update(updateWrapper);
    }

    @Override
    public void updateProfile(Long userId, String nickname, String avatar) {
        LambdaUpdateWrapper<SysUser> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysUser::getId, userId)
                .set(SysUser::getNickname, nickname)
                .set(SysUser::getAvatar, avatar);
        update(updateWrapper);
    }

    @Override
    public void updatePassword(Long userId, String encodedPassword) {
        LambdaUpdateWrapper<SysUser> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysUser::getId, userId)
                .set(SysUser::getPassword, encodedPassword);
        update(updateWrapper);
    }

    @Override
    public IPage<UserVO> pageUsers(UserPageQuery query) {
        Page<SysUser> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        if (query.getUsername() != null && !query.getUsername().isBlank()) {
            wrapper.like(SysUser::getUsername, query.getUsername());
        }
        if (query.getNickname() != null && !query.getNickname().isBlank()) {
            wrapper.like(SysUser::getNickname, query.getNickname());
        }
        if (query.getUserStatus() != null) {
            wrapper.eq(SysUser::getUserStatus, query.getUserStatus());
        }
        wrapper.orderByDesc(SysUser::getCreatedAt);

        IPage<SysUser> userPage = page(page, wrapper);

        return userPage.convert(this::toUserVO);
    }

    @Override
    public Long createUser(UserCreateRequest request) {
        if (findByUsername(request.getUsername()).isPresent()) {
            throw new BusinessException(400, "用户名已存在");
        }

        SysUser user = new SysUser();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname());
        user.setAvatar(request.getAvatar());
        user.setUserStatus(1);
        save(user);
        return user.getId();
    }

    @Override
    public void updateUser(Long userId, UserUpdateRequest request) {
        SysUser user = getById(userId);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        LambdaUpdateWrapper<SysUser> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysUser::getId, userId);
        if (request.getNickname() != null) {
            updateWrapper.set(SysUser::getNickname, request.getNickname());
        }
        if (request.getAvatar() != null) {
            updateWrapper.set(SysUser::getAvatar, request.getAvatar());
        }
        update(updateWrapper);
    }

    @Override
    public void toggleUserStatus(Long userId) {
        SysUser user = getById(userId);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        int newStatus = user.getUserStatus() == 1 ? 0 : 1;
        LambdaUpdateWrapper<SysUser> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysUser::getId, userId)
                .set(SysUser::getUserStatus, newStatus);
        update(updateWrapper);
    }

    @Override
    public void deleteUser(Long userId) {
        SysUser user = getById(userId);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        removeById(userId);
    }

    private UserVO toUserVO(SysUser user) {
        List<RoleVO> roles = sysRoleService.listRolesByUserId(user.getId());
        return UserVO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .nickname(user.getNickname())
                .avatar(user.getAvatar())
                .userStatus(user.getUserStatus())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .roles(roles)
                .build();
    }
}
