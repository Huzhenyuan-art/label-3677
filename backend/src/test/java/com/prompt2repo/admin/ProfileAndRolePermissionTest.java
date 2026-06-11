package com.prompt2repo.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.prompt2repo.admin.dto.UpdateProfileRequest;
import com.prompt2repo.admin.entity.SysUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("个人资料修改与角色菜单权限控制测试")
public class ProfileAndRolePermissionTest extends BaseIntegrationTest {

    @Test
    @DisplayName("修改个人资料 - 成功更新昵称和头像")
    public void testUpdateProfileSuccess() throws Exception {
        String token = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("新昵称管理员");
        request.setAvatar("http://example.com/avatar.png");

        mockMvc.perform(put("/api/auth/profile")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("资料更新成功"))
                .andExpect(jsonPath("$.data.nickname").value("新昵称管理员"))
                .andExpect(jsonPath("$.data.avatar").value("http://example.com/avatar.png"));

        SysUser updated = sysUserMapper.selectById(adminUserId);
        assertEquals("新昵称管理员", updated.getNickname());
        assertEquals("http://example.com/avatar.png", updated.getAvatar());
    }

    @Test
    @DisplayName("修改个人资料 - 昵称为空，参数校验失败")
    public void testUpdateProfileBlankNickname() throws Exception {
        String token = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("");
        request.setAvatar("http://example.com/avatar.png");

        mockMvc.perform(put("/api/auth/profile")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("修改个人资料 - 未登录，返回401")
    public void testUpdateProfileWithoutAuth() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("测试昵称");

        mockMvc.perform(put("/api/auth/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("修改密码 - 成功修改密码")
    public void testChangePasswordSuccess() throws Exception {
        String oldToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);
        String newPassword = "NewPass@456";

        String body = String.format(
                "{\"oldPassword\":\"%s\",\"newPassword\":\"%s\",\"confirmPassword\":\"%s\"}",
                TEST_PASSWORD, newPassword, newPassword);

        mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", authHeader(oldToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("密码修改成功"))
                .andExpect(jsonPath("$.data.token").exists());

        loginAndGetToken(TEST_USERNAME, newPassword);
    }

    @Test
    @DisplayName("修改密码 - 旧密码错误")
    public void testChangePasswordWrongOld() throws Exception {
        String token = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);
        String body = String.format(
                "{\"oldPassword\":\"%s\",\"newPassword\":\"%s\",\"confirmPassword\":\"%s\"}",
                "WrongPass123", "NewPass@456", "NewPass@456");

        mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("旧密码错误"));
    }

    @Test
    @DisplayName("修改密码 - 两次新密码不一致")
    public void testChangePasswordMismatch() throws Exception {
        String token = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);
        String body = String.format(
                "{\"oldPassword\":\"%s\",\"newPassword\":\"%s\",\"confirmPassword\":\"%s\"}",
                TEST_PASSWORD, "NewPass@456", "Different@789");

        mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("两次输入的新密码不一致"));
    }

    @Test
    @DisplayName("修改密码 - 新密码与旧密码相同")
    public void testChangePasswordSameAsOld() throws Exception {
        String token = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);
        String body = String.format(
                "{\"oldPassword\":\"%s\",\"newPassword\":\"%s\",\"confirmPassword\":\"%s\"}",
                TEST_PASSWORD, TEST_PASSWORD, TEST_PASSWORD);

        mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("新密码不能与旧密码相同"));
    }

    @Test
    @DisplayName("角色管理 - 创建新角色成功")
    public void testCreateRoleSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"roleCode\":\"TEST_ROLE\",\"roleName\":\"测试角色\",\"description\":\"测试用角色\",\"roleStatus\":1,\"sortOrder\":10}";

        mockMvc.perform(post("/api/roles")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("新增成功"))
                .andExpect(jsonPath("$.data").isNumber());
    }

    @Test
    @DisplayName("角色管理 - 角色编码重复，创建失败")
    public void testCreateRoleDuplicateCode() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"roleCode\":\"SUPER_ADMIN\",\"roleName\":\"重复角色\",\"description\":\"重复编码测试\"}";

        mockMvc.perform(post("/api/roles")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("角色编码已存在"));
    }

    @Test
    @DisplayName("角色管理 - 超级管理员角色不能删除")
    public void testDeleteSuperAdminForbidden() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        mockMvc.perform(delete("/api/roles/" + superAdminRoleId)
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("超级管理员角色不允许删除"));
    }

    @Test
    @DisplayName("角色权限控制 - 分配菜单权限")
    public void testAssignMenusToRole() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createRoleBody = "{\"roleCode\":\"PERM_TEST_ROLE\",\"roleName\":\"权限测试角色\",\"roleStatus\":1}";
        String createResp = mockMvc.perform(post("/api/roles")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createRoleBody))
                .andReturn().getResponse().getContentAsString();
        Long roleId = objectMapper.readTree(createResp).get("data").asLong();

        LambdaQueryWrapper<com.prompt2repo.admin.entity.SysMenu> menuWrapper = new LambdaQueryWrapper<>();
        menuWrapper.last("LIMIT 3");
        var menus = sysMenuMapper.selectList(menuWrapper);
        java.util.List<Long> menuIds = menus.stream().map(com.prompt2repo.admin.entity.SysMenu::getId).toList();

        String assignBody = String.format("{\"roleId\":%d,\"menuIds\":%s}",
                roleId, objectMapper.writeValueAsString(menuIds));

        mockMvc.perform(put("/api/roles/assign-menus")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("权限分配成功"));

        mockMvc.perform(get("/api/roles/" + roleId + "/menus")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("用户角色分配 - 给用户分配角色")
    public void testAssignRolesToUser() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = String.format("{\"userId\":%d,\"roleIds\":[%d]}", testUserId, viewerRoleId);

        mockMvc.perform(put("/api/roles/assign-roles")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("角色分配成功"));

        mockMvc.perform(get("/api/roles/user/" + testUserId)
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("权限越权访问 - 普通用户访问用户管理接口")
    public void testUnauthorizedAccessUserManage() throws Exception {
        String viewerToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/users")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("权限越权访问 - 普通用户访问角色管理接口")
    public void testUnauthorizedAccessRoleManage() throws Exception {
        String viewerToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/roles")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("权限访问 - 管理员正常访问用户管理")
    public void testAuthorizedAccessUserManage() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        mockMvc.perform(get("/api/users?page=1&size=10")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.records").isArray());
    }

    @Test
    @DisplayName("用户管理 - 创建用户成功")
    public void testCreateUserSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"username\":\"newuser\",\"password\":\"NewUser@123\",\"nickname\":\"新用户\"}";

        mockMvc.perform(post("/api/users")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("新增成功"))
                .andExpect(jsonPath("$.data").isNumber());
    }

    @Test
    @DisplayName("用户管理 - 用户名重复创建失败")
    public void testCreateUserDuplicateUsername() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"username\":\"admin\",\"password\":\"Test@12345\",\"nickname\":\"重复用户\"}";

        mockMvc.perform(post("/api/users")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户名已存在"));
    }

    @Test
    @DisplayName("用户管理 - 切换用户状态")
    public void testToggleUserStatus() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        SysUser before = sysUserMapper.selectById(testUserId);
        int originalStatus = before.getUserStatus();

        mockMvc.perform(put("/api/users/" + testUserId + "/status")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        SysUser after = sysUserMapper.selectById(testUserId);
        assertNotEquals(originalStatus, after.getUserStatus());
    }
}
