package com.prompt2repo.admin.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.entity.SysOperationLog;
import com.prompt2repo.admin.security.LoginUserDetails;
import com.prompt2repo.admin.service.SysOperationLogService;
import com.prompt2repo.admin.util.IpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class OperationLogAspect {

    private final SysOperationLogService operationLogService;
    private final ObjectMapper objectMapper;

    private static final int MAX_PARAM_LENGTH = 2000;
    private static final int MAX_RESULT_LENGTH = 2000;
    private static final List<String> SENSITIVE_FIELDS = Arrays.asList("password", "oldPassword", "newPassword", "confirmPassword");

    @Around("@annotation(com.prompt2repo.admin.annotation.OperationLog)")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        SysOperationLog operationLog = new SysOperationLog();
        operationLog.setCreatedAt(LocalDateTime.now());

        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof LoginUserDetails) {
                LoginUserDetails userDetails = (LoginUserDetails) authentication.getPrincipal();
                operationLog.setOperatorId(userDetails.getUser().getId());
                operationLog.setOperatorUsername(userDetails.getUser().getUsername());
                operationLog.setOperatorNickname(userDetails.getUser().getNickname());
            }
        } catch (Exception e) {
            log.warn("获取当前登录用户信息失败", e);
        }

        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                operationLog.setRequestMethod(request.getMethod());
                operationLog.setRequestPath(request.getRequestURI());
                operationLog.setClientIp(IpUtil.getClientIp(request));
                operationLog.setUserAgent(request.getHeader("User-Agent"));
            }
        } catch (Exception e) {
            log.warn("获取请求信息失败", e);
        }

        try {
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            Method method = signature.getMethod();
            OperationLog annotation = method.getAnnotation(OperationLog.class);
            if (annotation != null) {
                operationLog.setOperationModule(annotation.module());
                operationLog.setOperationDesc(annotation.description());

                if (annotation.recordParams()) {
                    String[] paramNames = signature.getParameterNames();
                    Object[] paramValues = joinPoint.getArgs();
                    if (paramNames != null && paramValues != null) {
                        StringBuilder paramsBuilder = new StringBuilder();
                        paramsBuilder.append("{");
                        for (int i = 0; i < paramNames.length; i++) {
                            if (i > 0) {
                                paramsBuilder.append(", ");
                            }
                            String paramName = paramNames[i];
                            Object paramValue = paramValues[i];
                            if (SENSITIVE_FIELDS.contains(paramName)) {
                                paramsBuilder.append("\"").append(paramName).append("\": \"***\"");
                            } else {
                                try {
                                    String valueStr = objectMapper.writeValueAsString(paramValue);
                                    paramsBuilder.append("\"").append(paramName).append("\": ").append(valueStr);
                                } catch (Exception e) {
                                    paramsBuilder.append("\"").append(paramName).append("\": \"").append(String.valueOf(paramValue)).append("\"");
                                }
                            }
                        }
                        paramsBuilder.append("}");
                        String paramsStr = paramsBuilder.toString();
                        if (paramsStr.length() > MAX_PARAM_LENGTH) {
                            paramsStr = paramsStr.substring(0, MAX_PARAM_LENGTH) + "...}";
                        }
                        operationLog.setRequestParams(paramsStr);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("解析方法注解和参数失败", e);
        }

        Object result = null;
        try {
            result = joinPoint.proceed();
            operationLog.setSuccess(1);

            if (operationLog.getOperatorId() == null) {
                try {
                    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                    if (authentication != null && authentication.getPrincipal() instanceof LoginUserDetails) {
                        LoginUserDetails userDetails = (LoginUserDetails) authentication.getPrincipal();
                        operationLog.setOperatorId(userDetails.getUser().getId());
                        operationLog.setOperatorUsername(userDetails.getUser().getUsername());
                        operationLog.setOperatorNickname(userDetails.getUser().getNickname());
                    }
                } catch (Exception e) {
                    log.warn("方法执行后获取当前登录用户信息失败", e);
                }
            }

            try {
                MethodSignature signature = (MethodSignature) joinPoint.getSignature();
                Method method = signature.getMethod();
                OperationLog annotation = method.getAnnotation(OperationLog.class);
                if (annotation != null && annotation.recordResult() && result != null) {
                    String resultStr = objectMapper.writeValueAsString(result);
                    if (resultStr.length() > MAX_RESULT_LENGTH) {
                        resultStr = resultStr.substring(0, MAX_RESULT_LENGTH) + "...";
                    }
                    operationLog.setResponseResult(resultStr);
                }
            } catch (Exception e) {
                log.warn("序列化响应结果失败", e);
            }

            return result;
        } catch (Throwable e) {
            operationLog.setSuccess(0);
            operationLog.setErrorMessage(e.getMessage());

            if (operationLog.getOperatorId() == null) {
                try {
                    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
                    String[] paramNames = signature.getParameterNames();
                    Object[] paramValues = joinPoint.getArgs();
                    if (paramNames != null && paramValues != null) {
                        for (int i = 0; i < paramNames.length; i++) {
                            if ("loginRequest".equals(paramNames[i]) && paramValues[i] != null) {
                                try {
                                    Object username = objectMapper.convertValue(paramValues[i], java.util.Map.class).get("username");
                                    if (username != null) {
                                        operationLog.setOperatorUsername(username.toString());
                                    }
                                } catch (Exception ex) {
                                    log.debug("从登录请求中提取用户名失败", ex);
                                }
                                break;
                            }
                        }
                    }
                } catch (Exception ex) {
                    log.warn("从请求参数提取操作人信息失败", ex);
                }
            }

            throw e;
        } finally {
            long executionTime = System.currentTimeMillis() - startTime;
            operationLog.setExecutionTime(executionTime);

            try {
                operationLogService.saveOperationLog(operationLog);
            } catch (Exception e) {
                log.error("保存操作日志失败", e);
            }
        }
    }
}
