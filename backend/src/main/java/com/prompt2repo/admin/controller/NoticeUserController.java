package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.UserNoticePageQuery;
import com.prompt2repo.admin.dto.UserNoticeVO;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.security.LoginUserDetails;
import com.prompt2repo.admin.service.SysNoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user/notices")
@RequiredArgsConstructor
public class NoticeUserController {

    private final SysNoticeService sysNoticeService;

    @GetMapping
    public ApiResponse<IPage<UserNoticeVO>> pageNotices(UserNoticePageQuery query,
                                                        Authentication authentication) {
        SysUser user = getCurrentUser(authentication);
        return ApiResponse.success(sysNoticeService.pageUserNotices(user.getId(), query));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserNoticeVO> getNoticeDetail(@PathVariable Long id,
                                                     Authentication authentication) {
        SysUser user = getCurrentUser(authentication);
        UserNoticeVO notice = sysNoticeService.getUserNoticeDetail(user.getId(), id);
        sysNoticeService.markAsRead(user.getId(), id);
        notice.setIsRead(1);
        return ApiResponse.success(notice);
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> countUnread(Authentication authentication) {
        SysUser user = getCurrentUser(authentication);
        return ApiResponse.success(sysNoticeService.countUnread(user.getId()));
    }

    @PutMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(@PathVariable Long id,
                                        Authentication authentication) {
        SysUser user = getCurrentUser(authentication);
        sysNoticeService.markAsRead(user.getId(), id);
        return ApiResponse.success("标记已读成功", null);
    }

    @PutMapping("/read-all")
    public ApiResponse<Void> markAllAsRead(Authentication authentication) {
        SysUser user = getCurrentUser(authentication);
        sysNoticeService.markAllAsRead(user.getId());
        return ApiResponse.success("全部已读成功", null);
    }

    private SysUser getCurrentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUserDetails)) {
            throw new BusinessException(401, "未登录或令牌已失效");
        }
        LoginUserDetails principal = (LoginUserDetails) authentication.getPrincipal();
        return principal.getUser();
    }
}
