package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.UserCreateRequest;
import com.prompt2repo.admin.dto.UserPageQuery;
import com.prompt2repo.admin.dto.UserUpdateRequest;
import com.prompt2repo.admin.dto.UserVO;
import com.prompt2repo.admin.entity.SysUser;

import java.util.Optional;

public interface SysUserService extends IService<SysUser> {

    Optional<SysUser> findByUsername(String username);

    void updateLastLogin(Long userId);

    void updateProfile(Long userId, String nickname, String avatar);

    void updatePassword(Long userId, String encodedPassword);

    IPage<UserVO> pageUsers(UserPageQuery query);

    Long createUser(UserCreateRequest request);

    void updateUser(Long userId, UserUpdateRequest request);

    void toggleUserStatus(Long userId);

    void deleteUser(Long userId);
}
