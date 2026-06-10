package com.prompt2repo.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.prompt2repo.admin.entity.SysRoleMenu;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysRoleMenuMapper extends BaseMapper<SysRoleMenu> {

    @Delete("DELETE FROM sys_role_menu WHERE role_id = #{roleId}")
    int deleteByRoleId(@Param("roleId") Long roleId);

    @Delete("DELETE FROM sys_role_menu WHERE menu_id = #{menuId}")
    int deleteByMenuId(@Param("menuId") Long menuId);

    @Select("SELECT menu_id FROM sys_role_menu WHERE role_id = #{roleId}")
    List<Long> selectMenuIdsByRoleId(@Param("roleId") Long roleId);

    @Select("SELECT DISTINCT sm.perm_code FROM sys_role_menu srm " +
            "INNER JOIN sys_menu sm ON srm.menu_id = sm.id " +
            "INNER JOIN sys_user_role sur ON srm.role_id = sur.role_id " +
            "INNER JOIN sys_role sr ON sur.role_id = sr.id " +
            "WHERE sur.user_id = #{userId} AND sr.role_status = 1 AND sr.deleted = 0 " +
            "AND sm.visible = 1 AND sm.perm_code IS NOT NULL AND sm.perm_code != ''")
    List<String> selectPermCodesByUserId(@Param("userId") Long userId);
}
