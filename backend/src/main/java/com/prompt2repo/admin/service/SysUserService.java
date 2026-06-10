package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.entity.SysUser;

import java.util.Optional;

public interface SysUserService extends IService<SysUser> {

    Optional<SysUser> findByUsername(String username);

    void updateLastLogin(Long userId);

    void updateProfile(Long userId, String nickname, String avatar);

    void updatePassword(Long userId, String encodedPassword);
}
