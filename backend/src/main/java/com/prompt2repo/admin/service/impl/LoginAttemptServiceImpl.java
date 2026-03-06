package com.prompt2repo.admin.service.impl;

import com.prompt2repo.admin.exception.TooManyRequestsException;
import com.prompt2repo.admin.service.LoginAttemptService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class LoginAttemptServiceImpl implements LoginAttemptService {

    private static final String LOGIN_ATTEMPT_PREFIX = "login:attempt:";

    private final StringRedisTemplate stringRedisTemplate;

    @Value("${app.login.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.login.lock-minutes:10}")
    private int lockMinutes;

    @Override
    public void assertAllow(String ip) {
        String key = LOGIN_ATTEMPT_PREFIX + ip;
        String value = stringRedisTemplate.opsForValue().get(key);
        if (value == null) {
            return;
        }
        int attempts;
        try {
            attempts = Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            stringRedisTemplate.delete(key);
            return;
        }
        if (attempts >= maxAttempts) {
            throw new TooManyRequestsException("登录尝试过于频繁，请稍后再试");
        }
    }

    @Override
    public void recordFailure(String ip) {
        String key = LOGIN_ATTEMPT_PREFIX + ip;
        Long count = stringRedisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            stringRedisTemplate.expire(key, Duration.ofMinutes(lockMinutes));
        }
    }

    @Override
    public void clear(String ip) {
        stringRedisTemplate.delete(LOGIN_ATTEMPT_PREFIX + ip);
    }
}
