package com.prompt2repo.admin.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component("systemHealthTask")
public class SystemHealthTask {

    public void execute() {
        log.info("系统状态检测任务执行 - 内存使用: {}MB / {}MB",
                (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / 1024 / 1024,
                Runtime.getRuntime().maxMemory() / 1024 / 1024);
    }
}
