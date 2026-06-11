package com.prompt2repo.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.prompt2repo.admin.annotation.OperationLog;
import com.prompt2repo.admin.common.ApiResponse;
import com.prompt2repo.admin.dto.NoticeCreateRequest;
import com.prompt2repo.admin.dto.NoticePageQuery;
import com.prompt2repo.admin.dto.NoticeUpdateRequest;
import com.prompt2repo.admin.dto.NoticeVO;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.security.LoginUserDetails;
import com.prompt2repo.admin.service.SysNoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

@RestController
@RequestMapping("/api/admin/notices")
@RequiredArgsConstructor
public class NoticeAdminController {

    private final SysNoticeService sysNoticeService;

    @GetMapping
    @PreAuthorize("hasAuthority('notice:manage')")
    public ApiResponse<IPage<NoticeVO>> pageNotices(NoticePageQuery query) {
        return ApiResponse.success(sysNoticeService.pageNotices(query));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('notice:manage')")
    public ApiResponse<NoticeVO> getNoticeDetail(@PathVariable Long id) {
        return ApiResponse.success(sysNoticeService.getNoticeDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('notice:manage')")
    @OperationLog(module = "公告管理", description = "创建公告")
    public ApiResponse<Long> createNotice(@Valid @RequestBody NoticeCreateRequest request,
                                          Authentication authentication) {
        SysUser publisher = getCurrentUser(authentication);
        Long noticeId = sysNoticeService.createNotice(publisher, request);
        return ApiResponse.success("创建成功", noticeId);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('notice:manage')")
    @OperationLog(module = "公告管理", description = "编辑公告")
    public ApiResponse<Void> updateNotice(@PathVariable Long id,
                                          @Valid @RequestBody NoticeUpdateRequest request) {
        sysNoticeService.updateNotice(id, request);
        return ApiResponse.success("编辑成功", null);
    }

    @PutMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('notice:manage')")
    @OperationLog(module = "公告管理", description = "发布公告")
    public ApiResponse<Void> publishNotice(@PathVariable Long id,
                                           Authentication authentication) {
        SysUser publisher = getCurrentUser(authentication);
        sysNoticeService.publishNotice(id, publisher);
        return ApiResponse.success("发布成功", null);
    }

    @PutMapping("/{id}/recall")
    @PreAuthorize("hasAuthority('notice:manage')")
    @OperationLog(module = "公告管理", description = "撤回公告")
    public ApiResponse<Void> recallNotice(@PathVariable Long id,
                                          Authentication authentication) {
        SysUser publisher = getCurrentUser(authentication);
        sysNoticeService.recallNotice(id, publisher);
        return ApiResponse.success("撤回成功", null);
    }

    @PutMapping("/{id}/pin")
    @PreAuthorize("hasAuthority('notice:manage')")
    @OperationLog(module = "公告管理", description = "切换公告置顶")
    public ApiResponse<Void> togglePin(@PathVariable Long id) {
        sysNoticeService.togglePin(id);
        return ApiResponse.success("操作成功", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('notice:manage')")
    @OperationLog(module = "公告管理", description = "删除公告")
    public ApiResponse<Void> deleteNotice(@PathVariable Long id) {
        sysNoticeService.deleteNotice(id);
        return ApiResponse.success("删除成功", null);
    }

    private SysUser getCurrentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUserDetails)) {
            throw new BusinessException(401, "未登录或令牌已失效");
        }
        LoginUserDetails principal = (LoginUserDetails) authentication.getPrincipal();
        return principal.getUser();
    }
}
