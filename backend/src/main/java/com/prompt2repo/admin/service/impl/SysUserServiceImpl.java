package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.mapper.SysUserMapper;
import com.prompt2repo.admin.service.SysUserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class SysUserServiceImpl extends ServiceImpl<SysUserMapper, SysUser> implements SysUserService {

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
}
