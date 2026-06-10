package com.prompt2repo.admin.service;

import com.prompt2repo.admin.dto.LoginAttemptStatusVO;

public interface LoginAttemptService {

    void assertAllow(String ip);

    void recordFailure(String ip);

    void clear(String ip);

    LoginAttemptStatusVO getAttemptStatus(String ip);
}
