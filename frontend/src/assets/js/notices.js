(function (window, $) {
    'use strict';

    var userNoticeState = {
        page: 1,
        size: 10,
        noticeType: null,
        readStatus: null,
        total: 0,
        pages: 0,
        unreadCount: 0,
        refreshTimer: null,
        refreshInterval: 60000
    };

    var adminNoticeState = {
        page: 1,
        size: 10,
        title: '',
        noticeType: null,
        noticeStatus: null,
        total: 0,
        pages: 0,
        pendingDeleteId: null,
        pendingEditId: null
    };

    function formatDatetime(text) {
        if (!text) return '-';
        return String(text).replace('T', ' ').substring(0, 19);
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getNoticeTypeText(type) {
        var types = { 1: '系统公告', 2: '通知', 3: '待办' };
        return types[type] || '-';
    }

    function getNoticeStatusText(status) {
        var statuses = { 0: '草稿', 1: '已发布', 2: '已撤回' };
        return statuses[status] || '-';
    }

    function renderScene() {
        window.AppLayout && window.AppLayout.destroyAllDashboardCharts && window.AppLayout.destroyAllDashboardCharts();
        bindEvents();

        window.AppLayout && window.AppLayout.setHero(
            '公告管理',
            '管理系统公告和通知，支持发布、编辑、撤回和删除操作。',
            ['公告发布', '通知管理', '消息推送']
        );

        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '公告总数', value: adminNoticeState.total || '-', icon: 'fas fa-bullhorn', tone: 'tone-info', note: '所有公告记录' },
            { label: '当前页码', value: adminNoticeState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '未读消息', value: userNoticeState.unreadCount || 0, icon: 'fas fa-bell', tone: 'tone-warning', note: '当前用户未读' },
            { label: '权限标识', value: 'notice:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        window.AppLayout && window.AppLayout.setPrimaryPanelTitle('公告列表');

        var searchHtml = '' +
            '<div class="notice-search-bar">' +
            '<form id="notice-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="ns-title" class="form-control form-control-sm" placeholder="公告标题" maxlength="200" value="' + escapeHtml(adminNoticeState.title) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ns-type" class="form-control form-control-sm">' +
            '<option value="">全部类型</option>' +
            '<option value="1"' + (adminNoticeState.noticeType === 1 ? ' selected' : '') + '>系统公告</option>' +
            '<option value="2"' + (adminNoticeState.noticeType === 2 ? ' selected' : '') + '>通知</option>' +
            '<option value="3"' + (adminNoticeState.noticeType === 3 ? ' selected' : '') + '>待办</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ns-status" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="0"' + (adminNoticeState.noticeStatus === 0 ? ' selected' : '') + '>草稿</option>' +
            '<option value="1"' + (adminNoticeState.noticeStatus === 1 ? ' selected' : '') + '>已发布</option>' +
            '<option value="2"' + (adminNoticeState.noticeStatus === 2 ? ' selected' : '') + '>已撤回</option>' +
            '</select>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="ns-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '<button type="button" id="nc-add-btn" class="btn btn-success btn-sm mb-2"><i class="fas fa-plus mr-1"></i>新增公告</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="notice-table-container"></div>' +
            '<div id="notice-admin-pagination" class="notice-admin-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>新增公告</span><span class="badge badge-soft-success">创建新公告</span></div>' +
            '<div class="status-item"><span>发布公告</span><span class="badge badge-soft-info">发布后所有用户可见</span></div>' +
            '<div class="status-item"><span>撤回公告</span><span class="badge badge-soft-warning">已发布公告可撤回</span></div>' +
            '<div class="status-item"><span>置顶公告</span><span class="badge badge-soft-primary">重要公告可置顶</span></div>' +
            '<div class="status-item"><span>删除公告</span><span class="badge badge-soft-danger">删除后不可恢复</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">公告发布后将推送给所有在线用户，并在消息中心显示未读提醒。</div>'
        );

        fetchAdminNoticePage();
    }

    function bindEvents() {
        $(document).off('click.noticeBell').on('click.noticeBell', '#notice-bell-btn', function (event) {
            event.preventDefault();
            openNoticeCenter();
        });

        $(document).off('click.ncMarkAll').on('click.ncMarkAll', '#nc-mark-all-btn', function () {
            markAllNoticesAsRead();
        });

        $(document).off('change.ncType').on('change.ncType', '#nc-type-filter', function () {
            var val = $(this).val();
            userNoticeState.noticeType = val !== '' ? Number(val) : null;
            userNoticeState.page = 1;
            fetchUserNoticePage();
        });

        $(document).off('change.ncRead').on('change.ncRead', '#nc-read-filter', function () {
            var val = $(this).val();
            userNoticeState.readStatus = val !== '' ? Number(val) : null;
            userNoticeState.page = 1;
            fetchUserNoticePage();
        });

        $(document).off('click.ncPage').on('click.ncPage', '.nc-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= userNoticeState.pages) {
                userNoticeState.page = p;
                fetchUserNoticePage();
            }
        });

        $(document).off('click.ncItem').on('click.ncItem', '.notice-item', function () {
            var id = $(this).data('id');
            openNoticeDetail(id);
        });

        $(document).off('submit.noticeForm').on('submit.noticeForm', '#notice-form', function (e) {
            e.preventDefault();
            submitNoticeForm(true);
        });

        $(document).off('click.nfSaveDraft').on('click.nfSaveDraft', '#nf-save-draft-btn', function () {
            submitNoticeForm(false);
        });

        $(document).off('click.ncAdd').on('click.ncAdd', '#nc-add-btn', function () {
            openNoticeForm(null);
        });

        $(document).off('click.ncEdit').on('click.ncEdit', '.btn-notice-edit', function () {
            var row = $(this).closest('tr');
            var id = row.data('id');
            openNoticeForm(id);
        });

        $(document).off('click.ncPublish').on('click.ncPublish', '.btn-notice-publish', function () {
            var id = $(this).closest('tr').data('id');
            publishNotice(id);
        });

        $(document).off('click.ncRecall').on('click.ncRecall', '.btn-notice-recall', function () {
            var id = $(this).closest('tr').data('id');
            recallNotice(id);
        });

        $(document).off('click.ncPin').on('click.ncPin', '.btn-notice-pin', function () {
            var id = $(this).closest('tr').data('id');
            toggleNoticePin(id);
        });

        $(document).off('click.ncDelete').on('click.ncDelete', '.btn-notice-delete', function () {
            adminNoticeState.pendingDeleteId = $(this).closest('tr').data('id');
            $('#notice-delete-modal').modal('show');
        });

        $(document).off('click.ncDeleteConfirm').on('click.ncDeleteConfirm', '#notice-delete-confirm-btn', function () {
            if (adminNoticeState.pendingDeleteId) {
                deleteNotice(adminNoticeState.pendingDeleteId);
            }
            $('#notice-delete-modal').modal('hide');
            adminNoticeState.pendingDeleteId = null;
        });

        $(document).off('submit.ncSearch').on('submit.ncSearch', '#notice-search-form', function (e) {
            e.preventDefault();
            adminNoticeState.title = $.trim($('#ns-title').val());
            var typeVal = $('#ns-type').val();
            adminNoticeState.noticeType = typeVal !== '' ? Number(typeVal) : null;
            var statusVal = $('#ns-status').val();
            adminNoticeState.noticeStatus = statusVal !== '' ? Number(statusVal) : null;
            adminNoticeState.page = 1;
            fetchAdminNoticePage();
        });

        $(document).off('click.ncReset').on('click.ncReset', '#ns-reset-btn', function () {
            adminNoticeState.title = '';
            adminNoticeState.noticeType = null;
            adminNoticeState.noticeStatus = null;
            adminNoticeState.page = 1;
            $('#ns-title').val('');
            $('#ns-type').val('');
            $('#ns-status').val('');
            fetchAdminNoticePage();
        });

        $(document).off('click.ncAdminPage').on('click.ncAdminPage', '.notice-admin-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= adminNoticeState.pages) {
                adminNoticeState.page = p;
                fetchAdminNoticePage();
            }
        });
    }

    function fetchUnreadNoticeCount() {
        $.ajax({
            url: '/api/notices/unread-count',
            method: 'GET',
            skipGlobalLoading: true,
            success: function (resp) {
                if (resp && Number(resp.code) === 0 && resp.data != null) {
                    userNoticeState.unreadCount = Number(resp.data) || 0;
                    updateNoticeBadge();
                }
            }
        });
    }

    function startNoticeUnreadRefresh() {
        stopNoticeUnreadRefresh();
        userNoticeState.refreshTimer = setInterval(function () {
            fetchUnreadNoticeCount();
        }, userNoticeState.refreshInterval);
    }

    function stopNoticeUnreadRefresh() {
        if (userNoticeState.refreshTimer) {
            clearInterval(userNoticeState.refreshTimer);
            userNoticeState.refreshTimer = null;
        }
    }

    function updateNoticeBadge() {
        var $badge = $('#notice-badge');
        if (!$badge.length) return;
        if (userNoticeState.unreadCount > 0) {
            $badge.text(userNoticeState.unreadCount > 99 ? '99+' : userNoticeState.unreadCount).removeClass('d-none');
        } else {
            $badge.addClass('d-none');
        }
    }

    function openNoticeCenter() {
        userNoticeState.page = 1;
        userNoticeState.noticeType = null;
        userNoticeState.readStatus = null;

        var html = '' +
            '<div class="notice-center-header">' +
            '<div class="d-flex align-items-center justify-content-between mb-3">' +
            '<h5 class="mb-0"><i class="fas fa-bell mr-2"></i>消息中心</h5>' +
            '<button type="button" class="btn btn-sm btn-outline-primary" id="nc-mark-all-btn">' +
            '<i class="fas fa-check-double mr-1"></i>全部标为已读' +
            '</button>' +
            '</div>' +
            '<div class="form-inline mb-3">' +
            '<select id="nc-type-filter" class="form-control form-control-sm mr-2">' +
            '<option value="">全部类型</option>' +
            '<option value="1">系统公告</option>' +
            '<option value="2">通知</option>' +
            '<option value="3">待办</option>' +
            '</select>' +
            '<select id="nc-read-filter" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="0">未读</option>' +
            '<option value="1">已读</option>' +
            '</select>' +
            '</div>' +
            '</div>' +
            '<div id="notice-list-container" class="notice-list-container"></div>' +
            '<div id="notice-pagination" class="notice-pagination-bar mt-3"></div>';

        $('#notice-center-modal .modal-body').html(html);
        $('#notice-center-modal').modal('show');
        fetchUserNoticePage();
    }

    function fetchUserNoticePage() {
        var params = { page: userNoticeState.page, size: userNoticeState.size };
        if (userNoticeState.noticeType !== null) params.noticeType = userNoticeState.noticeType;
        if (userNoticeState.readStatus !== null) params.readStatus = userNoticeState.readStatus;

        $.ajax({
            url: '/api/notices/user',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    return;
                }
                var page = resp.data;
                userNoticeState.total = page.total || 0;
                userNoticeState.pages = page.pages || 0;
                renderUserNoticeList(page.records || []);
                renderUserNoticePagination();
            }
        });
    }

    function renderUserNoticeList(records) {
        var container = $('#notice-list-container');
        if (!records.length) {
            container.html('<div class="text-center text-muted py-5">暂无消息</div>');
            return;
        }

        var html = '';
        records.forEach(function (notice) {
            var typeBadge = '';
            if (notice.noticeType === 1) {
                typeBadge = '<span class="badge badge-danger mr-2">公告</span>';
            } else if (notice.noticeType === 2) {
                typeBadge = '<span class="badge badge-info mr-2">通知</span>';
            } else if (notice.noticeType === 3) {
                typeBadge = '<span class="badge badge-warning mr-2">待办</span>';
            }

            var unreadDot = notice.readStatus === 0
                ? '<span class="unread-dot"></span>'
                : '';

            html += '<div class="notice-item ' + (notice.readStatus === 0 ? 'unread' : '') + '" data-id="' + notice.id + '">' +
                '<div class="notice-item-header">' +
                unreadDot +
                typeBadge +
                '<strong class="notice-item-title">' + escapeHtml(notice.title || '-') + '</strong>' +
                '<small class="text-muted ml-auto">' + formatDatetime(notice.publishTime || notice.createdAt) + '</small>' +
                '</div>' +
                '<div class="notice-item-content text-muted">' +
                escapeHtml((notice.content || '').substring(0, 150)) +
                ((notice.content || '').length > 150 ? '...' : '') +
                '</div>' +
                '</div>';
        });

        container.html(html);
    }

    function renderUserNoticePagination() {
        var total = userNoticeState.total;
        var pages = userNoticeState.pages;
        var current = userNoticeState.page;

        if (pages <= 1) {
            $('#notice-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }

        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';

        if (current > 1) {
            html += '<button class="btn btn-outline-secondary nc-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }

        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);

        if (start > 1) {
            html += '<button class="btn btn-outline-secondary nc-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }

        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary nc-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary nc-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary nc-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        if (current < pages) {
            html += '<button class="btn btn-outline-secondary nc-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div></div>';
        $('#notice-pagination').html(html);
    }

    function markAllNoticesAsRead() {
        $.ajax({
            url: '/api/notices/mark-all-read',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '操作失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('已全部标为已读', 'bg-success');
                userNoticeState.unreadCount = 0;
                updateNoticeBadge();
                fetchUserNoticePage();
            }
        });
    }

    function openNoticeDetail(id) {
        $.ajax({
            url: '/api/notices/' + id,
            method: 'GET',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载公告详情失败', 'bg-danger');
                    return;
                }
                var notice = resp.data;

                if (notice.readStatus === 0) {
                    $.ajax({
                        url: '/api/notices/' + id + '/read',
                        method: 'PUT',
                        skipGlobalLoading: true
                    });
                    if (userNoticeState.unreadCount > 0) {
                        userNoticeState.unreadCount--;
                        updateNoticeBadge();
                    }
                }

                var typeText = getNoticeTypeText(notice.noticeType);
                var html = '' +
                    '<div class="notice-detail-header mb-3">' +
                    '<h4 class="mb-2">' + escapeHtml(notice.title || '-') + '</h4>' +
                    '<div class="text-muted text-sm">' +
                    '<span class="mr-3"><i class="fas fa-tag mr-1"></i>' + typeText + '</span>' +
                    '<span class="mr-3"><i class="fas fa-clock mr-1"></i>' + formatDatetime(notice.publishTime || notice.createdAt) + '</span>' +
                    '<span><i class="fas fa-user mr-1"></i>' + escapeHtml(notice.author || '系统') + '</span>' +
                    '</div>' +
                    '</div>' +
                    '<div class="notice-detail-content">' +
                    (notice.content || '').replace(/\n/g, '<br>') +
                    '</div>';

                $('#notice-detail-modal .modal-body').html(html);
                $('#notice-detail-modal').modal('show');

                fetchUserNoticePage();
            }
        });
    }

    function fetchAdminNoticePage() {
        var params = { page: adminNoticeState.page, size: adminNoticeState.size };
        if (adminNoticeState.title) params.title = adminNoticeState.title;
        if (adminNoticeState.noticeType !== null) params.noticeType = adminNoticeState.noticeType;
        if (adminNoticeState.noticeStatus !== null) params.noticeStatus = adminNoticeState.noticeStatus;

        $.ajax({
            url: '/api/notices/admin',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载公告列表失败', 'bg-danger');
                    return;
                }
                var page = resp.data;
                adminNoticeState.total = page.total || 0;
                adminNoticeState.pages = page.pages || 0;
                renderAdminNoticeTable(page.records || []);
                renderAdminNoticePagination();
                updateOverviewCards();
            }
        });
    }

    function renderAdminNoticeTable(records) {
        if (!records.length) {
            $('#notice-table-container').html('<div class="text-center text-muted py-4">暂无公告数据</div>');
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 notice-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>标题</th><th>类型</th><th>状态</th><th>是否置顶</th><th>作者</th><th>发布时间</th><th>操作</th>' +
            '</tr></thead><tbody>';

        records.forEach(function (n) {
            var typeBadge = '';
            if (n.noticeType === 1) {
                typeBadge = '<span class="badge badge-danger">系统公告</span>';
            } else if (n.noticeType === 2) {
                typeBadge = '<span class="badge badge-info">通知</span>';
            } else if (n.noticeType === 3) {
                typeBadge = '<span class="badge badge-warning">待办</span>';
            }

            var statusBadge = '';
            if (n.noticeStatus === 0) {
                statusBadge = '<span class="badge badge-secondary">草稿</span>';
            } else if (n.noticeStatus === 1) {
                statusBadge = '<span class="badge badge-success">已发布</span>';
            } else if (n.noticeStatus === 2) {
                statusBadge = '<span class="badge badge-warning">已撤回</span>';
            }

            var pinBadge = n.isPinned === 1
                ? '<span class="badge badge-primary"><i class="fas fa-thumbtack mr-1"></i>置顶</span>'
                : '<span class="badge badge-light">普通</span>';

            var showPublish = n.noticeStatus === 0;
            var showRecall = n.noticeStatus === 1;

            html += '<tr data-id="' + n.id + '">' +
                '<td>' + escapeHtml(String(n.id)) + '</td>' +
                '<td>' + escapeHtml(n.title || '-') + '</td>' +
                '<td>' + typeBadge + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + pinBadge + '</td>' +
                '<td>' + escapeHtml(n.author || '-') + '</td>' +
                '<td>' + escapeHtml(formatDatetime(n.publishTime || n.createdAt)) + '</td>' +
                '<td class="notice-action-col">' +
                '<button class="btn btn-sm btn-outline-info btn-notice-edit mr-1" title="编辑"><i class="fas fa-edit"></i></button>' +
                (showPublish ? '<button class="btn btn-sm btn-outline-success btn-notice-publish mr-1" title="发布"><i class="fas fa-paper-plane"></i></button>' : '') +
                (showRecall ? '<button class="btn btn-sm btn-outline-warning btn-notice-recall mr-1" title="撤回"><i class="fas fa-undo"></i></button>' : '') +
                '<button class="btn btn-sm btn-outline-secondary btn-notice-pin mr-1" title="' + (n.isPinned === 1 ? '取消置顶' : '置顶') + '"><i class="fas fa-thumbtack"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger btn-notice-delete" title="删除"><i class="fas fa-trash-alt"></i></button>' +
                '</td></tr>';
        });

        html += '</tbody></table>';
        $('#notice-table-container').html(html);
    }

    function renderAdminNoticePagination() {
        var total = adminNoticeState.total;
        var pages = adminNoticeState.pages;
        var current = adminNoticeState.page;

        if (pages <= 1) {
            $('#notice-admin-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }

        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';

        if (current > 1) {
            html += '<button class="btn btn-outline-secondary notice-admin-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }

        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);

        if (start > 1) {
            html += '<button class="btn btn-outline-secondary notice-admin-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }

        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary notice-admin-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary notice-admin-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary notice-admin-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        if (current < pages) {
            html += '<button class="btn btn-outline-secondary notice-admin-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div></div>';
        $('#notice-admin-pagination').html(html);
    }

    function updateOverviewCards() {
        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '公告总数', value: adminNoticeState.total || '-', icon: 'fas fa-bullhorn', tone: 'tone-info', note: '所有公告记录' },
            { label: '当前页码', value: adminNoticeState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '未读消息', value: userNoticeState.unreadCount || 0, icon: 'fas fa-bell', tone: 'tone-warning', note: '当前用户未读' },
            { label: '权限标识', value: 'notice:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    function openNoticeForm(id) {
        adminNoticeState.pendingEditId = id;
        $('#nf-error-msg').addClass('d-none').text('');

        if (id) {
            $('#notice-form-label').text('编辑公告');
            $.ajax({
                url: '/api/notices/' + id,
                method: 'GET',
                success: function (resp) {
                    if (!resp || Number(resp.code) !== 0 || !resp.data) {
                        AppCommon.showToast(resp ? resp.message : '加载公告失败', 'bg-danger');
                        return;
                    }
                    var n = resp.data;
                    $('#nf-id').val(n.id);
                    $('#nf-title').val(n.title || '');
                    $('#nf-type').val(String(n.noticeType || 1));
                    $('#nf-content').val(n.content || '');
                    $('#notice-form-modal').modal('show');
                }
            });
        } else {
            $('#notice-form-label').text('新增公告');
            $('#nf-id').val('');
            $('#nf-title').val('');
            $('#nf-type').val('1');
            $('#nf-content').val('');
            $('#notice-form-modal').modal('show');
        }
    }

    function submitNoticeForm(publish) {
        var id = $('#nf-id').val();
        var title = $.trim($('#nf-title').val());
        var noticeType = Number($('#nf-type').val()) || 1;
        var content = $.trim($('#nf-content').val());

        if (!title) {
            $('#nf-error-msg').removeClass('d-none').text('公告标题不能为空');
            return;
        }
        if (!content) {
            $('#nf-error-msg').removeClass('d-none').text('公告内容不能为空');
            return;
        }

        var data = {
            title: title,
            noticeType: noticeType,
            content: content,
            noticeStatus: publish ? 1 : 0
        };

        var method = id ? 'PUT' : 'POST';
        var url = id ? '/api/notices/' + id : '/api/notices';

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    $('#nf-error-msg').removeClass('d-none').text(resp ? resp.message : '保存失败');
                    return;
                }
                $('#notice-form-modal').modal('hide');
                AppCommon.showToast(id ? '编辑成功' : (publish ? '发布成功' : '草稿保存成功'), 'bg-success');
                fetchAdminNoticePage();
            }
        });
    }

    function publishNotice(id) {
        $.ajax({
            url: '/api/notices/' + id + '/publish',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '发布失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('发布成功', 'bg-success');
                fetchAdminNoticePage();
            }
        });
    }

    function recallNotice(id) {
        $.ajax({
            url: '/api/notices/' + id + '/recall',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '撤回失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('撤回成功', 'bg-success');
                fetchAdminNoticePage();
            }
        });
    }

    function toggleNoticePin(id) {
        $.ajax({
            url: '/api/notices/' + id + '/pin',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '操作失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast(resp.message || '操作成功', 'bg-success');
                fetchAdminNoticePage();
            }
        });
    }

    function deleteNotice(id) {
        $.ajax({
            url: '/api/notices/' + id,
            method: 'DELETE',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('删除成功', 'bg-success');
                fetchAdminNoticePage();
            }
        });
    }

    window.AppNotices = {
        userNoticeState: userNoticeState,
        adminNoticeState: adminNoticeState,
        renderScene: renderScene,
        fetchUnreadNoticeCount: fetchUnreadNoticeCount,
        startNoticeUnreadRefresh: startNoticeUnreadRefresh,
        stopNoticeUnreadRefresh: stopNoticeUnreadRefresh,
        openNoticeCenter: openNoticeCenter
    };
})(window, jQuery);
