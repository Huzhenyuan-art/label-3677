package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.LoginLogPageQuery;
import com.prompt2repo.admin.dto.LoginLogVO;
import com.prompt2repo.admin.dto.LoginTrendVO;
import com.prompt2repo.admin.entity.SysLoginLog;
import com.prompt2repo.admin.mapper.SysLoginLogMapper;
import com.prompt2repo.admin.service.SysLoginLogService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SysLoginLogServiceImpl extends ServiceImpl<SysLoginLogMapper, SysLoginLog> implements SysLoginLogService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    @Async
    public void recordLoginLog(String username, boolean success, String clientIp, String userAgent, String failReason) {
        SysLoginLog loginLog = new SysLoginLog();
        loginLog.setUsername(username);
        loginLog.setLoginStatus(success ? 1 : 0);
        loginLog.setClientIp(clientIp);
        loginLog.setUserAgent(userAgent);
        loginLog.setFailReason(failReason);
        loginLog.setLoginAt(LocalDateTime.now());
        save(loginLog);
    }

    @Override
    public IPage<LoginLogVO> pageLoginLogs(LoginLogPageQuery query) {
        Page<SysLoginLog> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<SysLoginLog> wrapper = buildQueryWrapper(query);
        wrapper.orderByDesc(SysLoginLog::getLoginAt);

        IPage<SysLoginLog> logPage = page(page, wrapper);
        return logPage.convert(this::toLoginLogVO);
    }

    @Override
    public List<LoginTrendVO> getLoginTrend7Days() {
        LocalDate today = LocalDate.now();
        LocalDate startDay = today.minusDays(6);

        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.ge(SysLoginLog::getLoginAt, startDay.atStartOfDay());
        wrapper.le(SysLoginLog::getLoginAt, today.atTime(LocalTime.MAX));
        List<SysLoginLog> logs = list(wrapper);

        Map<String, long[]> trendMap = new LinkedHashMap<>();
        for (int i = 0; i < 7; i++) {
            LocalDate day = startDay.plusDays(i);
            trendMap.put(day.format(DATE_FORMATTER), new long[]{0, 0});
        }

        for (SysLoginLog log : logs) {
            String day = log.getLoginAt().format(DATE_FORMATTER);
            long[] counts = trendMap.get(day);
            if (counts != null) {
                if (log.getLoginStatus() == 1) {
                    counts[0]++;
                } else {
                    counts[1]++;
                }
            }
        }

        List<LoginTrendVO> result = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : trendMap.entrySet()) {
            result.add(LoginTrendVO.builder()
                    .date(entry.getKey())
                    .successCount(entry.getValue()[0])
                    .failCount(entry.getValue()[1])
                    .build());
        }
        return result;
    }

    @Override
    public void exportCsv(LoginLogPageQuery query, HttpServletResponse response) {
        LambdaQueryWrapper<SysLoginLog> wrapper = buildQueryWrapper(query);
        wrapper.orderByDesc(SysLoginLog::getLoginAt);
        List<SysLoginLog> logs = list(wrapper);

        response.setContentType("text/csv");
        response.setCharacterEncoding("UTF-8");
        String fileName = "login_logs_" + LocalDate.now().format(DATE_FORMATTER) + ".csv";
        try {
            response.setHeader("Content-Disposition",
                    "attachment; filename=" + URLEncoder.encode(fileName, StandardCharsets.UTF_8.name()));
        } catch (Exception e) {
            response.setHeader("Content-Disposition", "attachment; filename=login_logs.csv");
        }

        try (PrintWriter writer = response.getWriter()) {
            writer.write("\uFEFF");
            writer.println("ID,用户名,登录状态,客户端IP,用户代理,失败原因,登录时间");
            for (SysLoginLog log : logs) {
                writer.println(String.join(",",
                        escapeCsv(String.valueOf(log.getId())),
                        escapeCsv(log.getUsername()),
                        log.getLoginStatus() == 1 ? "成功" : "失败",
                        escapeCsv(log.getClientIp()),
                        escapeCsv(log.getUserAgent()),
                        escapeCsv(log.getFailReason()),
                        log.getLoginAt() != null ? log.getLoginAt().format(DATE_TIME_FORMATTER) : ""
                ));
            }
            writer.flush();
        } catch (IOException e) {
            throw new RuntimeException("导出CSV失败", e);
        }
    }

    private LambdaQueryWrapper<SysLoginLog> buildQueryWrapper(LoginLogPageQuery query) {
        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        if (query.getUsername() != null && !query.getUsername().isBlank()) {
            wrapper.like(SysLoginLog::getUsername, query.getUsername());
        }
        if (query.getLoginStatus() != null) {
            wrapper.eq(SysLoginLog::getLoginStatus, query.getLoginStatus());
        }
        if (query.getClientIp() != null && !query.getClientIp().isBlank()) {
            wrapper.like(SysLoginLog::getClientIp, query.getClientIp());
        }
        if (query.getStartTime() != null && !query.getStartTime().isBlank()) {
            wrapper.ge(SysLoginLog::getLoginAt, LocalDateTime.parse(query.getStartTime(), DATE_TIME_FORMATTER));
        }
        if (query.getEndTime() != null && !query.getEndTime().isBlank()) {
            wrapper.le(SysLoginLog::getLoginAt, LocalDateTime.parse(query.getEndTime(), DATE_TIME_FORMATTER));
        }
        return wrapper;
    }

    private LoginLogVO toLoginLogVO(SysLoginLog log) {
        return LoginLogVO.builder()
                .id(log.getId())
                .username(log.getUsername())
                .loginStatus(log.getLoginStatus())
                .clientIp(log.getClientIp())
                .userAgent(log.getUserAgent())
                .failReason(log.getFailReason())
                .loginAt(log.getLoginAt())
                .build();
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
