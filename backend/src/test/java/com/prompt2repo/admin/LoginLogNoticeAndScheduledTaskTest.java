package com.prompt2repo.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.prompt2repo.admin.entity.SysLoginLog;
import com.prompt2repo.admin.entity.SysNotice;
import com.prompt2repo.admin.mapper.SysLoginLogMapper;
import com.prompt2repo.admin.mapper.SysNoticeMapper;
import com.prompt2repo.admin.service.SysLoginLogService;
import com.prompt2repo.admin.service.SysNoticeService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("登录日志、公告发布与定时任务测试")
public class LoginLogNoticeAndScheduledTaskTest extends BaseIntegrationTest {

    @Autowired
    private SysLoginLogMapper sysLoginLogMapper;

    @Autowired
    private SysLoginLogService sysLoginLogService;

    @Autowired
    private SysNoticeMapper sysNoticeMapper;

    @Autowired
    private SysNoticeService sysNoticeService;

    @Test
    @DisplayName("登录日志记录 - 登录成功后写入数据库")
    public void testLoginLogRecordedOnSuccess() throws Exception {
        loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        Thread.sleep(500);

        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysLoginLog::getUsername, ADMIN_USERNAME)
                .eq(SysLoginLog::getLoginStatus, 1);
        Long count = sysLoginLogMapper.selectCount(wrapper);

        assertTrue(count > 0, "应记录至少一条成功登录日志");
    }

    @Test
    @DisplayName("登录日志记录 - 登录失败后写入数据库")
    public void testLoginLogRecordedOnFailure() throws Exception {
        String body = "{\"username\":\"" + ADMIN_USERNAME + "\",\"password\":\"wrong\"}";

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));

        Thread.sleep(500);

        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysLoginLog::getUsername, ADMIN_USERNAME)
                .eq(SysLoginLog::getLoginStatus, 0);
        Long count = sysLoginLogMapper.selectCount(wrapper);

        assertTrue(count > 0, "应记录至少一条失败登录日志");
    }

    @Test
    @DisplayName("登录日志分页查询 - 管理员正常查询")
    public void testPageLoginLogs() throws Exception {
        loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);
        Thread.sleep(500);
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        mockMvc.perform(get("/api/login-logs?page=1&size=10")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.total").isNumber());
    }

    @Test
    @DisplayName("登录日志 - 普通用户无权限查询")
    public void testLoginLogsNoPermission() throws Exception {
        String viewerToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/login-logs?page=1&size=10")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("登录日志趋势 - 获取7天登录趋势")
    public void testLoginTrend7Days() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        mockMvc.perform(get("/api/login-logs/trend")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("公告管理 - 创建公告成功")
    public void testCreateNoticeSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"title\":\"测试公告标题\",\"content\":\"这是公告的内容\",\"noticeType\":1,\"isPinned\":0}";

        mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("创建成功"))
                .andExpect(jsonPath("$.data").isNumber());

        LambdaQueryWrapper<SysNotice> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysNotice::getTitle, "测试公告标题");
        Long count = sysNoticeMapper.selectCount(wrapper);
        assertTrue(count > 0, "公告应被创建到数据库");
    }

    @Test
    @DisplayName("公告管理 - 创建公告参数校验失败")
    public void testCreateNoticeValidationFail() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"title\":\"\",\"content\":\"\",\"noticeType\":1}";

        mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("公告管理 - 发布公告成功")
    public void testPublishNoticeSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"待发布公告\",\"content\":\"待发布的内容\",\"noticeType\":1}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/publish")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("发布成功"));

        SysNotice published = sysNoticeMapper.selectById(noticeId);
        assertEquals(1, published.getNoticeStatus(), "公告状态应为已发布");
        assertNotNull(published.getPublishedAt(), "发布时间应被设置");
    }

    @Test
    @DisplayName("公告管理 - 重复发布同一公告失败")
    public void testPublishAlreadyPublishedNotice() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"重复发布公告\",\"content\":\"内容\",\"noticeType\":1}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/publish")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/publish")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("该公告已发布"));
    }

    @Test
    @DisplayName("公告管理 - 撤回公告成功")
    public void testRecallNoticeSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"待撤回公告\",\"content\":\"内容\",\"noticeType\":1}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/publish")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/recall")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("撤回成功"));

        SysNotice recalled = sysNoticeMapper.selectById(noticeId);
        assertEquals(2, recalled.getNoticeStatus(), "公告状态应为已撤回");
    }

    @Test
    @DisplayName("公告管理 - 撤回未发布公告失败")
    public void testRecallUnpublishedNotice() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"未发布公告\",\"content\":\"内容\",\"noticeType\":1}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/recall")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("只有已发布的公告才能撤回"));
    }

    @Test
    @DisplayName("公告管理 - 切换公告置顶状态")
    public void testToggleNoticePin() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"置顶测试公告\",\"content\":\"内容\",\"noticeType\":1}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/pin")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        SysNotice pinned = sysNoticeMapper.selectById(noticeId);
        assertEquals(1, pinned.getIsPinned(), "公告应被置顶");
    }

    @Test
    @DisplayName("公告管理 - 删除公告成功")
    public void testDeleteNoticeSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"待删除公告\",\"content\":\"内容\",\"noticeType\":1}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        mockMvc.perform(delete("/api/admin/notices/" + noticeId)
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("删除成功"));
    }

    @Test
    @DisplayName("公告管理 - 无权限用户访问")
    public void testNoticeManagementNoPermission() throws Exception {
        String viewerToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/admin/notices?page=1&size=10")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("定时任务 - 创建定时任务成功")
    public void testCreateScheduledTaskSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{" +
                "\"taskName\":\"测试定时任务\"," +
                "\"taskGroup\":\"TEST\"," +
                "\"cronExpression\":\"0 0/5 * * * ?\"," +
                "\"beanName\":\"systemHealthTask\"," +
                "\"methodName\":\"execute\"," +
                "\"taskStatus\":0," +
                "\"remark\":\"测试用\"" +
                "}";

        mockMvc.perform(post("/api/scheduled-tasks")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.taskName").value("测试定时任务"))
                .andExpect(jsonPath("$.data.taskStatus").value(0));
    }

    @Test
    @DisplayName("定时任务 - 创建任务参数校验失败")
    public void testCreateTaskValidationFail() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String body = "{\"taskName\":\"\",\"cronExpression\":\"\",\"beanName\":\"\"}";

        mockMvc.perform(post("/api/scheduled-tasks")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("定时任务 - 分页查询任务列表")
    public void testPageScheduledTasks() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        mockMvc.perform(get("/api/scheduled-tasks?page=1&size=10")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.records").isArray());
    }

    @Test
    @DisplayName("定时任务 - 启动任务成功")
    public void testStartTaskSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{" +
                "\"taskName\":\"待启动任务\"," +
                "\"cronExpression\":\"0 0/10 * * * ?\"," +
                "\"beanName\":\"systemHealthTask\"," +
                "\"methodName\":\"execute\"," +
                "\"taskStatus\":0" +
                "}";
        String createResp = mockMvc.perform(post("/api/scheduled-tasks")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long taskId = objectMapper.readTree(createResp).get("data").get("id").asLong();

        mockMvc.perform(put("/api/scheduled-tasks/" + taskId + "/start")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("定时任务 - 启动已运行的任务失败")
    public void testStartAlreadyRunningTask() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{" +
                "\"taskName\":\"已运行任务\"," +
                "\"cronExpression\":\"0 0/15 * * * ?\"," +
                "\"beanName\":\"systemHealthTask\"," +
                "\"methodName\":\"execute\"," +
                "\"taskStatus\":0" +
                "}";
        String createResp = mockMvc.perform(post("/api/scheduled-tasks")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long taskId = objectMapper.readTree(createResp).get("data").get("id").asLong();

        mockMvc.perform(put("/api/scheduled-tasks/" + taskId + "/start")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(put("/api/scheduled-tasks/" + taskId + "/start")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("任务已在运行中"));
    }

    @Test
    @DisplayName("定时任务 - 暂停任务成功")
    public void testPauseTaskSuccess() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{" +
                "\"taskName\":\"待暂停任务\"," +
                "\"cronExpression\":\"0 0/20 * * * ?\"," +
                "\"beanName\":\"systemHealthTask\"," +
                "\"methodName\":\"execute\"," +
                "\"taskStatus\":0" +
                "}";
        String createResp = mockMvc.perform(post("/api/scheduled-tasks")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long taskId = objectMapper.readTree(createResp).get("data").get("id").asLong();

        mockMvc.perform(put("/api/scheduled-tasks/" + taskId + "/start")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(put("/api/scheduled-tasks/" + taskId + "/pause")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("定时任务 - 删除任务成功")
    public void testDeleteScheduledTask() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{" +
                "\"taskName\":\"待删除任务\"," +
                "\"cronExpression\":\"0 0/30 * * * ?\"," +
                "\"beanName\":\"systemHealthTask\"," +
                "\"methodName\":\"execute\"," +
                "\"taskStatus\":0" +
                "}";
        String createResp = mockMvc.perform(post("/api/scheduled-tasks")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long taskId = objectMapper.readTree(createResp).get("data").get("id").asLong();

        mockMvc.perform(delete("/api/scheduled-tasks/" + taskId)
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("定时任务 - 无权限用户访问")
    public void testScheduledTaskNoPermission() throws Exception {
        String viewerToken = loginAndGetToken(TEST_USERNAME, TEST_PASSWORD);

        mockMvc.perform(get("/api/scheduled-tasks?page=1&size=10")
                        .header("Authorization", authHeader(viewerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("公告状态一致性验证 - 创建、发布、撤回数据库状态一致")
    public void testNoticeStatusConsistency() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_USERNAME, ADMIN_PASSWORD);

        String createBody = "{\"title\":\"状态一致性测试\",\"content\":\"测试内容\",\"noticeType\":2}";
        String createResp = mockMvc.perform(post("/api/admin/notices")
                        .header("Authorization", authHeader(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andReturn().getResponse().getContentAsString();
        Long noticeId = objectMapper.readTree(createResp).get("data").asLong();

        SysNotice draft = sysNoticeMapper.selectById(noticeId);
        assertEquals(0, draft.getNoticeStatus(), "草稿状态应为0");
        assertNull(draft.getPublishedAt(), "草稿不应有发布时间");

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/publish")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(jsonPath("$.code").value(0));
        SysNotice published = sysNoticeMapper.selectById(noticeId);
        assertEquals(1, published.getNoticeStatus(), "已发布状态应为1");
        assertNotNull(published.getPublishedAt(), "发布时间应存在");
        assertEquals(ADMIN_USERNAME, published.getPublisherUsername(), "发布人用户名应正确");

        mockMvc.perform(put("/api/admin/notices/" + noticeId + "/recall")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(jsonPath("$.code").value(0));
        SysNotice recalled = sysNoticeMapper.selectById(noticeId);
        assertEquals(2, recalled.getNoticeStatus(), "已撤回状态应为2");
        assertNotNull(recalled.getRecalledAt(), "撤回时间应存在");
    }
}
