package com.prompt2repo.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.prompt2repo.admin.dto.LoginRequest;
import com.prompt2repo.admin.entity.SysLoginLog;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.mapper.SysLoginLogMapper;
import com.prompt2repo.admin.service.LoginAttemptService;
import com.prompt2repo.admin.service.RedisSessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("登录鉴权与登录失败限流测试")
public class AuthAndLoginAttemptTest extends BaseIntegrationTest {

    @Autowired
    private SysLoginLogMapper sysLoginLogMapper;

    @Autowired
    private LoginAttemptService loginAttemptService;

    @Autowired
    private RedisSessionService redisSessionService;

    @Test
    @DisplayName("登录成功 - 返回token并更新最后登录时间")
    public void testLoginSuccess() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(ADMIN_USERNAME);
        loginRequest.setPassword(ADMIN_PASSWORD);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("登录成功"))
                .andExpect(jsonPath("$.data.token").exists())
                .andExpect(jsonPath("$.data.user.username").value(ADMIN_USERNAME))
                .andExpect(jsonPath("$.data.user.nickname").value("系统管理员"))
                .andExpect(jsonPath("$.data.menus").isArray())
                .andExpect(jsonPath("$.data.expireAt").exists());

        SysUser user = sysUserMapper.selectById(adminUserId);
        assertNotNull(user.getLastLoginAt(), "最后登录时间应被更新");

        assertTrue(redisSessionService.hasSession(adminUserId), "Redis中应存在登录会话");

        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysLoginLog::getUsername, ADMIN_USERNAME)
                .eq(SysLoginLog::getLoginStatus, 1);
        Long logCount = sysLoginLogMapper.selectCount(wrapper);
        assertTrue(logCount > 0, "应记录登录成功日志");
    }

    @Test
    @DisplayName("登录失败 - 用户名或密码错误")
    public void testLoginBadCredentials() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(ADMIN_USERNAME);
        loginRequest.setPassword("wrong_password");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("用户名或密码错误"))
                .andExpect(jsonPath("$.data.remainingAttempts").exists())
                .andExpect(jsonPath("$.data.locked").value(false));

        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysLoginLog::getUsername, ADMIN_USERNAME)
                .eq(SysLoginLog::getLoginStatus, 0);
        Long failLogCount = sysLoginLogMapper.selectCount(wrapper);
        assertTrue(failLogCount > 0, "应记录登录失败日志");
    }

    @Test
    @DisplayName("登录失败 - 用户不存在")
    public void testLoginUserNotFound() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("nonexistent_user");
        loginRequest.setPassword("any_password");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("登录失败 - 用户已禁用")
    public void testLoginDisabledUser() throws Exception {
        SysUser disabledUser = createUser("disabled_user", "Test@12345", "已禁用用户", 0);

        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("disabled_user");
        loginRequest.setPassword("Test@12345");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("登录失败 - 参数校验（用户名为空）")
    public void testLoginValidationBlankUsername() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("");
        loginRequest.setPassword(ADMIN_PASSWORD);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("登录失败限流 - 超过最大尝试次数后被锁定")
    public void testLoginRateLimitExceeded() throws Exception {
        String testIp = "192.168.1.100";
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(ADMIN_USERNAME);
        loginRequest.setPassword("wrong_password");

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-Forwarded-For", testIp)
                            .content(objectMapper.writeValueAsString(loginRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(401));
        }

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", testIp)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("登录尝试过于频繁，账户已被锁定"))
                .andExpect(jsonPath("$.data.locked").value(true));

        var status = loginAttemptService.getAttemptStatus(testIp);
        assertTrue(status.isLocked(), "状态应显示已锁定");
        assertEquals(0, status.getRemainingAttempts(), "剩余尝试次数应为0");
        assertTrue(status.getLockTtlSeconds() > 0, "锁定剩余时间应大于0");

        loginAttemptService.clear(testIp);
    }

    @Test
    @DisplayName("登录限流 - 成功登录后清除失败计数")
    public void testLoginSuccessClearsAttempts() throws Exception {
        String testIp = "192.168.1.200";
        LoginRequest wrongRequest = new LoginRequest();
        wrongRequest.setUsername(ADMIN_USERNAME);
        wrongRequest.setPassword("wrong_password");

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-Forwarded-For", testIp)
                            .content(objectMapper.writeValueAsString(wrongRequest)))
                    .andExpect(jsonPath("$.code").value(401));
        }

        var statusBefore = loginAttemptService.getAttemptStatus(testIp);
        assertEquals(2, statusBefore.getRemainingAttempts(), "成功前应有2次剩余尝试");

        LoginRequest correctRequest = new LoginRequest();
        correctRequest.setUsername(ADMIN_USERNAME);
        correctRequest.setPassword(ADMIN_PASSWORD);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", testIp)
                        .content(objectMapper.writeValueAsString(correctRequest)))
                .andExpect(jsonPath("$.code").value(0));

        var statusAfter = loginAttemptService.getAttemptStatus(testIp);
        assertFalse(statusAfter.isLocked(), "成功登录后不应被锁定");
        assertEquals(5, statusAfter.getRemainingAttempts(), "成功登录后剩余次数应重置");
    }

    @Test
    @DisplayName("未登录访问受保护接口 - 返回401")
    public void testAccessProtectedEndpointWithoutAuth() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未登录或令牌已过期"));
    }

    @Test
    @DisplayName("使用无效token访问 - 返回401")
    public void testAccessWithInvalidToken() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer invalid_token_12345"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("使用有效token访问个人信息 - 成功")
    public void testAccessWithValidToken() throws Exception {
        String token = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", authHeader(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value(ADMIN_USERNAME))
                .andExpect(jsonPath("$.data.nickname").value("系统管理员"));
    }

    @Test
    @DisplayName("并发登录测试 - 多个请求同时登录")
    public void testConcurrentLogin() throws Exception {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    LoginRequest loginRequest = new LoginRequest();
                    loginRequest.setUsername(ADMIN_USERNAME);
                    loginRequest.setPassword(ADMIN_PASSWORD);

                    String response = mockMvc.perform(post("/api/auth/login")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(loginRequest)))
                            .andReturn()
                            .getResponse()
                            .getContentAsString();

                    var jsonNode = objectMapper.readTree(response);
                    if (jsonNode.get("code").asInt() == 0) {
                        successCount.incrementAndGet();
                    } else {
                        failCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(30, TimeUnit.SECONDS), "所有并发登录请求应在30秒内完成");
        executor.shutdown();

        assertEquals(threadCount, successCount.get() + failCount.get(), "所有请求都应有结果");
        assertTrue(successCount.get() > 0, "至少应有一个成功的登录请求");
    }
}
