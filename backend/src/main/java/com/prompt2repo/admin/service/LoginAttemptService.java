package com.prompt2repo.admin.service;

public interface LoginAttemptService {

    void assertAllow(String ip);

    void recordFailure(String ip);

    void clear(String ip);
}
