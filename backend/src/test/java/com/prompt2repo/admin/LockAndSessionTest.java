package com.prompt2repo.admin;

import com.prompt2repo.admin.dto.UnlockRequest;
import com.prompt2repo.admin.service.RedisSessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("锁屏解锁与会话强制下线测试")
public class LockAndSessionTest extends BaseIntegrationTest {

    @Autowired
    private RedisSessionService redisSessionService;

    @Test
    @DisplayName("解锁屏幕 - 密码正确，解锁成功并刷新会话")
    public void testUnlockSuccess() throws Exception {
        String token = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        UnlockRequest request = new UnlockRequest();
        request.setPassword(ADMIN_PASSWORD);

        mockMvc.perform(post("/api/auth/unlock")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("解锁成功"))
                .andExpect(jsonPath("$.data").value("ok"));

        assertTrue(redisSessionService.hasSession(adminUserId), "解锁后会话应仍然存在");
    }

    @Test
    @DisplayName("解锁屏幕 - 密码错误，解锁失败")
    public void testUnlockWrongPassword() throws Exception {
        String token = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        UnlockRequest request = new UnlockRequest();
        request.setPassword("wrong_password");

        mockMvc.perform(post("/api/auth/unlock")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("密码错误，解锁失败"));
    }

    @Test
    @DisplayName("解锁屏幕 - 未登录请求，返回401")
    public void testUnlockWithoutAuth() throws Exception {
        UnlockRequest request = new UnlockRequest();
        request.setPassword(ADMIN_PASSWORD);

        mockMvc.perform(post("/api/auth/unlock")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("解锁屏幕 - 密码为空，参数校验失败")
    public void testUnlockBlankPassword() throws Exception {
        String token = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        UnlockRequest request = new UnlockRequest();
        request.setPassword("");

        mockMvc.perform(post("/api/auth/unlock")
                        .header("Authorization", authHeader(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("获取在线会话列表 - 管理员权限正常获取")
    public void testListOnlineSessions() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);
        loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/sessions/online")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("获取在线会话数量 - 正常获取")
    public void testCountOnlineSessions() throws Exception {
        loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);
        loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/sessions/online/count")
                        .header("Authorization", authHeader(loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isNumber());
    }

    @Test
    @DisplayName("强制用户下线 - 管理员强制其他用户下线")
    public void testForceLogoutSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);
        loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        assertTrue(redisSessionService.hasSession(testUserId), "下线前测试用户应有会话");

        mockMvc.perform(delete("/api/sessions/" + testUserId + "/force-logout")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").value(true));

        assertFalse(redisSessionService.hasSession(testUserId), "下线后测试用户会话应被清除");
    }

    @Test
    @DisplayName("强制用户下线 - 目标用户不在线")
    public void testForceLogoutUserNotOnline() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        assertFalse(redisSessionService.hasSession(testUserId), "测试用户不应在线");

        mockMvc.perform(delete("/api/sessions/" + testUserId + "/force-logout")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").value(false));
    }

    @Test
    @DisplayName("强制下线后 - 用户的旧token失效")
    public void testTokenInvalidAfterForceLogout() throws Exception {
        loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);
        String testUserToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", authHeader(testUserToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(delete("/api/sessions/" + testUserId + "/force-logout")
                        .header("Authorization", authHeader(loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", authHeader(testUserToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("无权限用户访问会话管理接口 - 返回403")
    public void testAccessSessionManagementWithoutPermission() throws Exception {
        String viewerToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/sessions/online")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));

        mockMvc.perform(delete("/api/sessions/" + adminUserId + "/force-logout")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("修改密码后旧会话失效 - 新token可正常使用")
    public void testSessionInvalidAfterPasswordChange() throws Exception {
        String oldToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", authHeader(oldToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        String newPassword = "NewPass@123";
        String changePwdBody = String.format(
                "{\"oldPassword\":\"%s\",\"newPassword\":\"%s\",\"confirmPassword\":\"%s\"}",
                TEST_PASSWORD, newPassword, newPassword);

        String response = mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", authHeader(oldToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(changePwdBody))
                .andReturn()
                .getResponse()
                .getContentAsString();

        var jsonNode = objectMapper.readTree(response);
        assertEquals(0, jsonNode.get("code").asInt(), "修改密码应成功");
        String newToken = jsonNode.get("data").get("token").asText();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", authHeader(oldToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", authHeader(newToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value(TEST_USERNAME));
    }
}
