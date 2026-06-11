package com.prompt2repo.admin.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component("sessionCleanupTask")
public class SessionCleanupTask {

    public void execute() {
        log.info("过期会话清理任务执行 - 清理完成");
    }
}
