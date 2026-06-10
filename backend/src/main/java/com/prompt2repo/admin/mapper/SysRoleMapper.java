package com.prompt2repo.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.prompt2repo.admin.entity.SysRole;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysRoleMapper extends BaseMapper<SysRole> {

    @Select("SELECT r.* FROM sys_role r " +
            "INNER JOIN sys_user_role ur ON r.id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND r.deleted = 0 AND r.role_status = 1 " +
            "ORDER BY r.sort_order ASC")
    List<SysRole> selectRolesByUserId(@Param("userId") Long userId);

    @Select("SELECT DISTINCT rm.menu_id FROM sys_role_menu rm " +
            "INNER JOIN sys_role r ON rm.role_id = r.id " +
            "INNER JOIN sys_user_role ur ON r.id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND r.deleted = 0 AND r.role_status = 1")
    List<Long> selectMenuIdsByUserId(@Param("userId") Long userId);
}
