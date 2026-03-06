package com.prompt2repo.admin.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prompt2repo.admin.service.RedisSessionService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RedisSessionServiceImpl implements RedisSessionService {

    private static final String LOGIN_KEY_PREFIX = "login:";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void saveSession(Long userId, String username, List<String> permissions, long expireSeconds) {
        String key = LOGIN_KEY_PREFIX + userId;
        LoginSession session = new LoginSession(username, permissions, LocalDateTime.now().toString());
        try {
            String sessionJson = objectMapper.writeValueAsString(session);
            stringRedisTemplate.opsForValue().set(key, sessionJson, Duration.ofSeconds(expireSeconds));
        } catch (JsonProcessingException ex) {
            stringRedisTemplate.opsForValue().set(key, "{\"username\":\"" + username + "\"}", Duration.ofSeconds(expireSeconds));
        }
    }

    @Override
    public boolean hasSession(Long userId) {
        Boolean exists = stringRedisTemplate.hasKey(LOGIN_KEY_PREFIX + userId);
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public List<String> getPermissions(Long userId) {
        String payload = stringRedisTemplate.opsForValue().get(LOGIN_KEY_PREFIX + userId);
        if (payload == null || payload.isBlank()) {
            return Collections.emptyList();
        }
        try {
            LoginSession session = objectMapper.readValue(payload, LoginSession.class);
            if (session.getPermissions() == null) {
                return Collections.emptyList();
            }
            return session.getPermissions();
        } catch (JsonProcessingException ex) {
            return Collections.emptyList();
        }
    }

    @Override
    public void refreshSession(Long userId, long expireSeconds) {
        String key = LOGIN_KEY_PREFIX + userId;
        if (Boolean.TRUE.equals(stringRedisTemplate.hasKey(key))) {
            stringRedisTemplate.expire(key, Duration.ofSeconds(expireSeconds));
        }
    }

    @Override
    public Long countOnlineSessions() {
        Set<String> keys = stringRedisTemplate.keys(LOGIN_KEY_PREFIX + "*");
        return keys == null ? 0L : (long) keys.size();
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    private static class LoginSession {
        private String username;
        private List<String> permissions;
        private String loginAt;
    }
}
