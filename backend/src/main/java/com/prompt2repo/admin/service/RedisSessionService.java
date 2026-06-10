package com.prompt2repo.admin.service;

import java.util.List;

public interface RedisSessionService {

    void saveSession(Long userId, String username, List<String> permissions, String sessionId, long expireSeconds);

    boolean hasSession(Long userId);

    List<String> getPermissions(Long userId);

    String getSessionId(Long userId);

    void refreshSession(Long userId, long expireSeconds);

    void deleteSession(Long userId);

    Long countOnlineSessions();
}
