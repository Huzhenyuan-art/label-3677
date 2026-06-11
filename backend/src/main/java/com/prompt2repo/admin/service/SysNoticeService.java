package com.prompt2repo.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.prompt2repo.admin.dto.NoticeCreateRequest;
import com.prompt2repo.admin.dto.NoticePageQuery;
import com.prompt2repo.admin.dto.NoticeUpdateRequest;
import com.prompt2repo.admin.dto.NoticeVO;
import com.prompt2repo.admin.dto.UserNoticePageQuery;
import com.prompt2repo.admin.dto.UserNoticeVO;
import com.prompt2repo.admin.entity.SysNotice;
import com.prompt2repo.admin.entity.SysUser;

public interface SysNoticeService extends IService<SysNotice> {

    IPage<NoticeVO> pageNotices(NoticePageQuery query);

    NoticeVO getNoticeDetail(Long id);

    Long createNotice(SysUser publisher, NoticeCreateRequest request);

    void updateNotice(Long id, NoticeUpdateRequest request);

    void publishNotice(Long id, SysUser publisher);

    void recallNotice(Long id, SysUser publisher);

    void togglePin(Long id);

    void deleteNotice(Long id);

    IPage<UserNoticeVO> pageUserNotices(Long userId, UserNoticePageQuery query);

    UserNoticeVO getUserNoticeDetail(Long userId, Long noticeId);

    void markAsRead(Long userId, Long noticeId);

    void markAllAsRead(Long userId);

    Long countUnread(Long userId);
}
