package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.LoginLogPageQuery;
import com.prompt2repo.admin.dto.LoginLogVO;
import com.prompt2repo.admin.dto.LoginTrendVO;
import com.prompt2repo.admin.entity.SysLoginLog;

import javax.servlet.http.HttpServletResponse;
import java.util.List;

public interface SysLoginLogService extends IService<SysLoginLog> {

    void recordLoginLog(String username, boolean success, String clientIp, String userAgent, String failReason);

    IPage<LoginLogVO> pageLoginLogs(LoginLogPageQuery query);

    List<LoginTrendVO> getLoginTrend7Days();

    void exportCsv(LoginLogPageQuery query, HttpServletResponse response);
}
