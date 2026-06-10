package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.OperationLogPageQuery;
import com.prompt2repo.admin.dto.OperationLogVO;
import com.prompt2repo.admin.entity.SysOperationLog;

public interface SysOperationLogService extends IService<SysOperationLog> {

    IPage<OperationLogVO> pageOperationLogs(OperationLogPageQuery query);

    void saveOperationLog(SysOperationLog log);
}
