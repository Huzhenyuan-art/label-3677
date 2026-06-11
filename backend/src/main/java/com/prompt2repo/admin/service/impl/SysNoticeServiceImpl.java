package com.prompt2repo.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.prompt2repo.admin.dto.NoticeCreateRequest;
import com.prompt2repo.admin.dto.NoticePageQuery;
import com.prompt2repo.admin.dto.NoticeUpdateRequest;
import com.prompt2repo.admin.dto.NoticeVO;
import com.prompt2repo.admin.dto.UserNoticePageQuery;
import com.prompt2repo.admin.dto.UserNoticeVO;
import com.prompt2repo.admin.entity.SysNotice;
import com.prompt2repo.admin.entity.SysNoticeRead;
import com.prompt2repo.admin.entity.SysUser;
import com.prompt2repo.admin.exception.BusinessException;
import com.prompt2repo.admin.mapper.SysNoticeMapper;
import com.prompt2repo.admin.mapper.SysNoticeReadMapper;
import com.prompt2repo.admin.service.SysNoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysNoticeServiceImpl extends ServiceImpl<SysNoticeMapper, SysNotice> implements SysNoticeService {

    private final SysNoticeReadMapper sysNoticeReadMapper;

    @Override
    public IPage<NoticeVO> pageNotices(NoticePageQuery query) {
        Page<SysNotice> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<SysNotice> wrapper = new LambdaQueryWrapper<>();
        if (query.getTitle() != null && !query.getTitle().isBlank()) {
            wrapper.like(SysNotice::getTitle, query.getTitle());
        }
        if (query.getNoticeType() != null) {
            wrapper.eq(SysNotice::getNoticeType, query.getNoticeType());
        }
        if (query.getNoticeStatus() != null) {
            wrapper.eq(SysNotice::getNoticeStatus, query.getNoticeStatus());
        }
        wrapper.orderByDesc(SysNotice::getIsPinned)
                .orderByDesc(SysNotice::getCreatedAt);

        IPage<SysNotice> noticePage = page(page, wrapper);
        return noticePage.convert(this::toNoticeVO);
    }

    @Override
    public NoticeVO getNoticeDetail(Long id) {
        SysNotice notice = getById(id);
        if (notice == null) {
            throw new BusinessException(404, "公告不存在");
        }
        return toNoticeVO(notice);
    }

    @Override
    public Long createNotice(SysUser publisher, NoticeCreateRequest request) {
        SysNotice notice = new SysNotice();
        notice.setTitle(request.getTitle());
        notice.setContent(request.getContent());
        notice.setNoticeType(request.getNoticeType());
        notice.setIsPinned(request.getIsPinned() != null ? request.getIsPinned() : 0);
        notice.setNoticeStatus(0);
        notice.setPublisherId(publisher.getId());
        notice.setPublisherUsername(publisher.getUsername());
        notice.setPublisherNickname(publisher.getNickname());
        save(notice);
        return notice.getId();
    }

    @Override
    public void updateNotice(Long id, NoticeUpdateRequest request) {
        SysNotice notice = getById(id);
        if (notice == null) {
            throw new BusinessException(404, "公告不存在");
        }
        if (notice.getNoticeStatus() == 1) {
            throw new BusinessException(400, "已发布的公告不能编辑，请先撤回");
        }
        LambdaUpdateWrapper<SysNotice> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysNotice::getId, id)
                .set(SysNotice::getTitle, request.getTitle())
                .set(SysNotice::getContent, request.getContent());
        if (request.getNoticeType() != null) {
            updateWrapper.set(SysNotice::getNoticeType, request.getNoticeType());
        }
        if (request.getIsPinned() != null) {
            updateWrapper.set(SysNotice::getIsPinned, request.getIsPinned());
        }
        update(updateWrapper);
    }

    @Override
    @Transactional
    public void publishNotice(Long id, SysUser publisher) {
        SysNotice notice = getById(id);
        if (notice == null) {
            throw new BusinessException(404, "公告不存在");
        }
        if (notice.getNoticeStatus() == 1) {
            throw new BusinessException(400, "该公告已发布");
        }
        LambdaUpdateWrapper<SysNotice> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysNotice::getId, id)
                .set(SysNotice::getNoticeStatus, 1)
                .set(SysNotice::getPublisherId, publisher.getId())
                .set(SysNotice::getPublisherUsername, publisher.getUsername())
                .set(SysNotice::getPublisherNickname, publisher.getNickname())
                .set(SysNotice::getPublishedAt, LocalDateTime.now())
                .set(SysNotice::getRecalledAt, null);
        update(updateWrapper);
    }

    @Override
    @Transactional
    public void recallNotice(Long id, SysUser publisher) {
        SysNotice notice = getById(id);
        if (notice == null) {
            throw new BusinessException(404, "公告不存在");
        }
        if (notice.getNoticeStatus() != 1) {
            throw new BusinessException(400, "只有已发布的公告才能撤回");
        }
        LambdaUpdateWrapper<SysNotice> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysNotice::getId, id)
                .set(SysNotice::getNoticeStatus, 2)
                .set(SysNotice::getRecalledAt, LocalDateTime.now());
        update(updateWrapper);
    }

    @Override
    public void togglePin(Long id) {
        SysNotice notice = getById(id);
        if (notice == null) {
            throw new BusinessException(404, "公告不存在");
        }
        int newPin = notice.getIsPinned() == 1 ? 0 : 1;
        LambdaUpdateWrapper<SysNotice> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SysNotice::getId, id)
                .set(SysNotice::getIsPinned, newPin);
        update(updateWrapper);
    }

    @Override
    public void deleteNotice(Long id) {
        SysNotice notice = getById(id);
        if (notice == null) {
            throw new BusinessException(404, "公告不存在");
        }
        removeById(id);
    }

    @Override
    public IPage<UserNoticeVO> pageUserNotices(Long userId, UserNoticePageQuery query) {
        Page<SysNotice> page = new Page<>(query.getPage(), query.getSize());
        LambdaQueryWrapper<SysNotice> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysNotice::getNoticeStatus, 1);
        if (query.getNoticeType() != null) {
            wrapper.eq(SysNotice::getNoticeType, query.getNoticeType());
        }
        wrapper.orderByDesc(SysNotice::getIsPinned)
                .orderByDesc(SysNotice::getPublishedAt);

        IPage<SysNotice> noticePage = page(page, wrapper);

        List<Long> noticeIds = noticePage.getRecords().stream()
                .map(SysNotice::getId)
                .collect(Collectors.toList());

        Map<Long, SysNoticeRead> readMap = getReadMap(userId, noticeIds);

        if (query.getReadStatus() != null) {
            List<SysNotice> filtered = noticePage.getRecords().stream()
                    .filter(n -> {
                        boolean isRead = readMap.containsKey(n.getId());
                        return query.getReadStatus() == 1 ? isRead : !isRead;
                    })
                    .collect(Collectors.toList());

            long totalFiltered = filtered.size();
            int from = (query.getPage() - 1) * query.getSize();
            int to = Math.min(from + query.getSize(), filtered.size());
            List<SysNotice> pagedFiltered = from >= filtered.size()
                    ? new ArrayList<>()
                    : filtered.subList(from, to);

            Page<UserNoticeVO> resultPage = new Page<>(query.getPage(), query.getSize(), totalFiltered);
            resultPage.setRecords(pagedFiltered.stream()
                    .map(n -> toUserNoticeVO(n, readMap.get(n.getId())))
                    .collect(Collectors.toList()));
            return resultPage;
        }

        return noticePage.convert(n -> toUserNoticeVO(n, readMap.get(n.getId())));
    }

    @Override
    public UserNoticeVO getUserNoticeDetail(Long userId, Long noticeId) {
        SysNotice notice = getById(noticeId);
        if (notice == null || notice.getNoticeStatus() != 1) {
            throw new BusinessException(404, "公告不存在或未发布");
        }
        LambdaQueryWrapper<SysNoticeRead> readWrapper = new LambdaQueryWrapper<>();
        readWrapper.eq(SysNoticeRead::getNoticeId, noticeId)
                .eq(SysNoticeRead::getUserId, userId);
        SysNoticeRead readRecord = sysNoticeReadMapper.selectOne(readWrapper);
        return toUserNoticeVO(notice, readRecord);
    }

    @Override
    @Transactional
    public void markAsRead(Long userId, Long noticeId) {
        SysNotice notice = getById(noticeId);
        if (notice == null || notice.getNoticeStatus() != 1) {
            throw new BusinessException(404, "公告不存在或未发布");
        }
        LambdaQueryWrapper<SysNoticeRead> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysNoticeRead::getNoticeId, noticeId)
                .eq(SysNoticeRead::getUserId, userId);
        if (sysNoticeReadMapper.selectCount(wrapper) > 0) {
            return;
        }
        SysNoticeRead read = new SysNoticeRead();
        read.setNoticeId(noticeId);
        read.setUserId(userId);
        read.setReadAt(LocalDateTime.now());
        sysNoticeReadMapper.insert(read);
    }

    @Override
    @Transactional
    public void markAllAsRead(Long userId) {
        LambdaQueryWrapper<SysNotice> noticeWrapper = new LambdaQueryWrapper<>();
        noticeWrapper.eq(SysNotice::getNoticeStatus, 1)
                .select(SysNotice::getId);
        List<Long> allPublishedIds = list(noticeWrapper).stream()
                .map(SysNotice::getId)
                .collect(Collectors.toList());

        if (allPublishedIds.isEmpty()) {
            return;
        }

        LambdaQueryWrapper<SysNoticeRead> readWrapper = new LambdaQueryWrapper<>();
        readWrapper.eq(SysNoticeRead::getUserId, userId);
        List<Long> alreadyReadIds = sysNoticeReadMapper.selectList(readWrapper).stream()
                .map(SysNoticeRead::getNoticeId)
                .collect(Collectors.toList());

        allPublishedIds.removeAll(alreadyReadIds);

        for (Long noticeId : allPublishedIds) {
            SysNoticeRead read = new SysNoticeRead();
            read.setNoticeId(noticeId);
            read.setUserId(userId);
            read.setReadAt(LocalDateTime.now());
            sysNoticeReadMapper.insert(read);
        }
    }

    @Override
    public Long countUnread(Long userId) {
        LambdaQueryWrapper<SysNotice> noticeWrapper = new LambdaQueryWrapper<>();
        noticeWrapper.eq(SysNotice::getNoticeStatus, 1)
                .select(SysNotice::getId);
        List<Long> publishedIds = list(noticeWrapper).stream()
                .map(SysNotice::getId)
                .collect(Collectors.toList());

        if (publishedIds.isEmpty()) {
            return 0L;
        }

        LambdaQueryWrapper<SysNoticeRead> readWrapper = new LambdaQueryWrapper<>();
        readWrapper.eq(SysNoticeRead::getUserId, userId)
                .in(SysNoticeRead::getNoticeId, publishedIds);
        Long readCount = sysNoticeReadMapper.selectCount(readWrapper);

        return publishedIds.size() - readCount;
    }

    private Map<Long, SysNoticeRead> getReadMap(Long userId, List<Long> noticeIds) {
        if (noticeIds == null || noticeIds.isEmpty()) {
            return java.util.Collections.emptyMap();
        }
        LambdaQueryWrapper<SysNoticeRead> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysNoticeRead::getUserId, userId)
                .in(SysNoticeRead::getNoticeId, noticeIds);
        List<SysNoticeRead> reads = sysNoticeReadMapper.selectList(wrapper);
        return reads.stream()
                .collect(Collectors.toMap(SysNoticeRead::getNoticeId, r -> r));
    }

    private NoticeVO toNoticeVO(SysNotice notice) {
        NoticeVO vo = new NoticeVO();
        vo.setId(notice.getId());
        vo.setTitle(notice.getTitle());
        vo.setContent(notice.getContent());
        vo.setNoticeType(notice.getNoticeType());
        vo.setNoticeStatus(notice.getNoticeStatus());
        vo.setIsPinned(notice.getIsPinned());
        vo.setPublisherId(notice.getPublisherId());
        vo.setPublisherUsername(notice.getPublisherUsername());
        vo.setPublisherNickname(notice.getPublisherNickname());
        vo.setPublishedAt(notice.getPublishedAt());
        vo.setRecalledAt(notice.getRecalledAt());
        vo.setCreatedAt(notice.getCreatedAt());
        vo.setUpdatedAt(notice.getUpdatedAt());
        return vo;
    }

    private UserNoticeVO toUserNoticeVO(SysNotice notice, SysNoticeRead read) {
        UserNoticeVO vo = new UserNoticeVO();
        vo.setId(notice.getId());
        vo.setTitle(notice.getTitle());
        vo.setContent(notice.getContent());
        vo.setNoticeType(notice.getNoticeType());
        vo.setIsPinned(notice.getIsPinned());
        vo.setPublisherNickname(notice.getPublisherNickname());
        vo.setPublishedAt(notice.getPublishedAt());
        vo.setIsRead(read != null ? 1 : 0);
        vo.setReadAt(read != null ? read.getReadAt() : null);
        return vo;
    }
}
