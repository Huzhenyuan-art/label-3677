package com.prompt2repo.admin.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prompt2repo.admin.dto.OnlineSessionVO;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.service.RedisSessionService;
import com.prompt2repo.admin.service.SysUserService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisSessionServiceImpl implements RedisSessionService {

    private static final String LOGIN_KEY_PREFIX = "login:";
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS");

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final SysUserService sysUserService;

    @Override
    public void saveSession(Long userId, String username, List<String> permissions, String sessionId, String loginIp, long expireSeconds) {
        try {
            String key = LOGIN_KEY_PREFIX + userId;
            LoginSession session = new LoginSession(username, permissions, sessionId, LocalDateTime.now().toString(), loginIp);
            String sessionJson = objectMapper.writeValueAsString(session);
            stringRedisTemplate.opsForValue().set(key, sessionJson, Duration.ofSeconds(expireSeconds));
        } catch (Exception ignored) {
        }
    }

    @Override
    public boolean hasSession(Long userId) {
        try {
            Boolean exists = stringRedisTemplate.hasKey(LOGIN_KEY_PREFIX + userId);
            return Boolean.TRUE.equals(exists);
        } catch (Exception ex) {
            return true;
        }
    }

    @Override
    public List<String> getPermissions(Long userId) {
        try {
            String payload = stringRedisTemplate.opsForValue().get(LOGIN_KEY_PREFIX + userId);
            if (payload == null || payload.isBlank()) {
                return Collections.emptyList();
            }
            LoginSession session = objectMapper.readValue(payload, LoginSession.class);
            if (session.getPermissions() == null) {
                return Collections.emptyList();
            }
            return session.getPermissions();
        } catch (Exception ex) {
            return Collections.emptyList();
        }
    }

    @Override
    public void refreshSession(Long userId, long expireSeconds) {
        try {
            String key = LOGIN_KEY_PREFIX + userId;
            if (Boolean.TRUE.equals(stringRedisTemplate.hasKey(key))) {
                stringRedisTemplate.expire(key, Duration.ofSeconds(expireSeconds));
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public String getSessionId(Long userId) {
        try {
            String payload = stringRedisTemplate.opsForValue().get(LOGIN_KEY_PREFIX + userId);
            if (payload == null || payload.isBlank()) {
                return null;
            }
            LoginSession session = objectMapper.readValue(payload, LoginSession.class);
            return session.getSessionId();
        } catch (Exception ex) {
            return null;
        }
    }

    @Override
    public void deleteSession(Long userId) {
        try {
            stringRedisTemplate.delete(LOGIN_KEY_PREFIX + userId);
        } catch (Exception ignored) {
        }
    }

    @Override
    public Long countOnlineSessions() {
        try {
            Set<String> keys = stringRedisTemplate.keys(LOGIN_KEY_PREFIX + "*");
            return keys == null ? 0L : (long) keys.size();
        } catch (Exception ex) {
            return 0L;
        }
    }

    @Override
    public List<OnlineSessionVO> listOnlineSessions() {
        try {
            Set<String> keys = stringRedisTemplate.keys(LOGIN_KEY_PREFIX + "*");
            if (keys == null || keys.isEmpty()) {
                return Collections.emptyList();
            }
            List<OnlineSessionVO> result = new ArrayList<>();
            for (String key : keys) {
                try {
                    String userIdStr = key.substring(LOGIN_KEY_PREFIX.length());
                    Long userId = Long.parseLong(userIdStr);
                    String payload = stringRedisTemplate.opsForValue().get(key);
                    if (payload == null || payload.isBlank()) {
                        continue;
                    }
                    LoginSession session = objectMapper.readValue(payload, LoginSession.class);
                    Long expireSeconds = stringRedisTemplate.getExpire(key, TimeUnit.SECONDS);
                    LocalDateTime expireAt = expireSeconds != null && expireSeconds > 0
                            ? LocalDateTime.now().plusSeconds(expireSeconds)
                            : null;
                    LocalDateTime loginAt = parseLocalDateTime(session.getLoginAt());

                    SysUser user = sysUserService.getById(userId);
                    String nickname = user != null ? user.getNickname() : null;

                    result.add(OnlineSessionVO.builder()
                            .userId(userId)
                            .username(session.getUsername())
                            .nickname(nickname)
                            .sessionId(session.getSessionId())
                            .loginIp(session.getLoginIp())
                            .loginAt(loginAt)
                            .expireAt(expireAt)
                            .build());
                } catch (Exception ex) {
                    log.warn("解析会话失败 key={}", key, ex);
                }
            }
            result.sort((a, b) -> {
                if (a.getLoginAt() == null && b.getLoginAt() == null) return 0;
                if (a.getLoginAt() == null) return 1;
                if (b.getLoginAt() == null) return -1;
                return b.getLoginAt().compareTo(a.getLoginAt());
            });
            return result;
        } catch (Exception ex) {
            log.error("获取在线会话列表失败", ex);
            return Collections.emptyList();
        }
    }

    @Override
    public boolean forceLogout(Long userId) {
        try {
            String key = LOGIN_KEY_PREFIX + userId;
            Boolean deleted = stringRedisTemplate.delete(key);
            return Boolean.TRUE.equals(deleted);
        } catch (Exception ex) {
            log.error("强制下线失败 userId={}", userId, ex);
            return false;
        }
    }

    private LocalDateTime parseLocalDateTime(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(text, FORMATTER);
        } catch (Exception ex) {
            try {
                return LocalDateTime.parse(text);
            } catch (Exception ex2) {
                return null;
            }
        }
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    private static class LoginSession {
        private String username;
        private List<String> permissions;
        private String sessionId;
        private String loginAt;
        private String loginIp;
    }
}
