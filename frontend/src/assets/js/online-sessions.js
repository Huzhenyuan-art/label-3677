(function (window, $) {
    'use strict';

    var state = {
        sessions: [],
        loading: false,
        pendingForceLogoutUserId: null,
        pendingForceLogoutUsername: '',
        refreshTimer: null,
        refreshInterval: 10000
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

    function renderScene() {
        window.AppLayout && window.AppLayout.destroyAllDashboardCharts && window.AppLayout.destroyAllDashboardCharts();
        bindEvents();

        window.AppLayout && window.AppLayout.setHero(
            '在线会话',
            '实时查看当前在线用户列表，支持强制下线指定会话，管理系统访问安全。',
            ['实时监控', '会话管理', '强制下线']
        );

        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '在线用户数', value: state.sessions.length || '-', icon: 'fas fa-users', tone: 'tone-info', note: '当前活跃会话数' },
            { label: '刷新间隔', value: (state.refreshInterval / 1000) + ' 秒', icon: 'fas fa-sync-alt', tone: 'tone-success', note: '自动刷新频率' },
            { label: '权限标识', value: 'session:view', icon: 'fas fa-key', tone: 'tone-warning', note: '查看权限' },
            { label: '管理权限', value: 'session:manage', icon: 'fas fa-user-shield', tone: 'tone-danger', note: '强制下线权限' }
        ]);

        window.AppLayout && window.AppLayout.setPrimaryPanelTitle('在线用户列表');

        var headerHtml = '' +
            '<div class="d-flex flex-wrap align-items-center justify-content-between mb-3">' +
            '<div class="d-flex align-items-center">' +
            '<button type="button" id="session-refresh-btn" class="btn btn-primary btn-sm mr-2">' +
            '<i class="fas fa-sync-alt mr-1"></i>刷新' +
            '</button>' +
            '<span class="text-muted text-sm">' +
            '<i class="fas fa-info-circle mr-1"></i>' +
            '数据每 ' + (state.refreshInterval / 1000) + ' 秒自动刷新' +
            '</span>' +
            '</div>' +
            '<span class="text-sm text-info">' +
            '<i class="fas fa-circle text-success mr-1"></i>' +
            '共 <span id="session-count">' + state.sessions.length + '</span> 个在线会话' +
            '</span>' +
            '</div>';

        var tableHtml = '<div class="table-responsive" id="session-table-container">' +
            '<div class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>' +
            '</div>';

        $('#primary-panel-body').html(headerHtml + tableHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>实时列表</span><span class="badge badge-soft-success">自动刷新在线状态</span></div>' +
            '<div class="status-item"><span>登录时间</span><span class="badge badge-soft-info">显示登录起始时间</span></div>' +
            '<div class="status-item"><span>来源 IP</span><span class="badge badge-soft-warning">记录登录 IP 地址</span></div>' +
            '<div class="status-item"><span>强制下线</span><span class="badge badge-soft-danger">立即终止指定会话</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">强制下线会立即删除该用户的 Redis 会话，用户下次请求时将被要求重新登录。</div>'
        );

        fetchSessions();
        startRefresh();
    }

    function bindEvents() {
        $(document).off('click.sessionRefresh').on('click.sessionRefresh', '#session-refresh-btn', function () {
            fetchSessions();
        });

        $(document).off('click.forceLogout').on('click.forceLogout', '.btn-force-logout', function () {
            var row = $(this).closest('tr');
            var userId = row.data('user-id');
            var username = row.data('username');
            confirmForceLogout(userId, username);
        });

        $(document).off('click.forceLogoutConfirm').on('click.forceLogoutConfirm', '#force-logout-confirm-btn', function () {
            if (state.pendingForceLogoutUserId) {
                forceLogoutSession(state.pendingForceLogoutUserId);
            }
            $('#force-logout-modal').modal('hide');
            state.pendingForceLogoutUserId = null;
            state.pendingForceLogoutUsername = '';
        });
    }

    function fetchSessions() {
        if (state.loading) {
            return;
        }
        state.loading = true;

        $.ajax({
            url: '/api/sessions/online',
            method: 'GET',
            skipGlobalLoading: true,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                    AppCommon.showToast(resp ? resp.message : '加载在线会话失败', 'bg-warning');
                    return;
                }
                state.sessions = resp.data;
                renderTable(resp.data);
                updateOverviewCards();
                updateSessionCount();
                updateDashboardOnlineCount(resp.data.length);

                if (window.AppDashboard && window.AppDashboard.getCurrentOverview) {
                    var overview = window.AppDashboard.getCurrentOverview();
                    if (overview) {
                        overview.onlineSessions = resp.data.length;
                    }
                }
            },
            error: function () {
                $('#session-table-container').html(
                    '<div class="text-center text-danger py-4">加载失败，请点击刷新按钮重试</div>'
                );
            },
            complete: function () {
                state.loading = false;
            }
        });
    }

    function renderTable(sessions) {
        if (!sessions || !sessions.length) {
            $('#session-table-container').html(
                '<div class="text-center text-muted py-5">暂无在线用户</div>'
            );
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 session-table">' +
            '<thead class="thead-light"><tr>' +
            '<th style="width: 60px;">ID</th>' +
            '<th>用户名</th>' +
            '<th>昵称</th>' +
            '<th>登录 IP</th>' +
            '<th>登录时间</th>' +
            '<th>过期时间</th>' +
            '<th style="width: 100px;">操作</th>' +
            '</tr></thead><tbody>';

        sessions.forEach(function (s) {
            var displayName = s.nickname || s.username || '-';
            html += '<tr data-user-id="' + s.userId + '" data-username="' + escapeHtml(s.username || '') + '">' +
                '<td>' + escapeHtml(String(s.userId)) + '</td>' +
                '<td>' +
                '<div class="d-flex align-items-center">' +
                '<span class="online-dot mr-2"></span>' +
                '<strong>' + escapeHtml(s.username || '-') + '</strong>' +
                '</div>' +
                '</td>' +
                '<td>' + escapeHtml(displayName) + '</td>' +
                '<td>' +
                '<span class="badge badge-soft-secondary">' + escapeHtml(s.loginIp || '-') + '</span>' +
                '</td>' +
                '<td>' + escapeHtml(formatDatetime(s.loginAt)) + '</td>' +
                '<td>' + escapeHtml(formatDatetime(s.expireAt)) + '</td>' +
                '<td>' +
                '<button class="btn btn-sm btn-outline-danger btn-force-logout" title="强制下线">' +
                '<i class="fas fa-sign-out-alt mr-1"></i>下线' +
                '</button>' +
                '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        $('#session-table-container').html(html);
    }

    function updateOverviewCards() {
        if (window.AppLayout && window.AppLayout.getCurrentMenuPath && window.AppLayout.getCurrentMenuPath() !== '/online-sessions') {
            return;
        }
        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '在线用户数', value: state.sessions.length, icon: 'fas fa-users', tone: 'tone-info', note: '当前活跃会话数' },
            { label: '刷新间隔', value: (state.refreshInterval / 1000) + ' 秒', icon: 'fas fa-sync-alt', tone: 'tone-success', note: '自动刷新频率' },
            { label: '权限标识', value: 'session:view', icon: 'fas fa-key', tone: 'tone-warning', note: '查看权限' },
            { label: '管理权限', value: 'session:manage', icon: 'fas fa-user-shield', tone: 'tone-danger', note: '强制下线权限' }
        ]);
    }

    function updateSessionCount() {
        $('#session-count').text(state.sessions.length);
    }

    function updateDashboardOnlineCount(count) {
        if (window.AppLayout && window.AppLayout.getCurrentMenuPath && window.AppLayout.getCurrentMenuPath() === '/dashboard') {
            if (window.AppDashboard && window.AppDashboard.refreshOverviewCards) {
                window.AppDashboard.refreshOverviewCards();
            }
        }
    }

    function confirmForceLogout(userId, username) {
        state.pendingForceLogoutUserId = userId;
        state.pendingForceLogoutUsername = username || '';
        $('#force-logout-body').text('确定要强制下线用户「' + (username || '') + '」吗？该操作会立即终止其会话，用户需要重新登录才能继续使用。');
        $('#force-logout-modal').modal('show');
    }

    function forceLogoutSession(userId) {
        $.ajax({
            url: '/api/sessions/' + userId + '/force-logout',
            method: 'DELETE',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '强制下线失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('强制下线成功', 'bg-success');
                fetchSessions();
            },
            error: function () {
                AppCommon.showToast('强制下线失败，请稍后重试', 'bg-danger');
            }
        });
    }

    function startRefresh() {
        stopRefresh();
        state.refreshTimer = setInterval(function () {
            if (window.AppLayout && window.AppLayout.getCurrentMenuPath && window.AppLayout.getCurrentMenuPath() === '/online-sessions') {
                fetchSessions();
            }
        }, state.refreshInterval);
    }

    function stopRefresh() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
            state.refreshTimer = null;
        }
    }

    window.AppOnlineSessions = {
        state: state,
        renderScene: renderScene,
        fetchSessions: fetchSessions,
        startOnlineSessionRefresh: startRefresh,
        stopOnlineSessionRefresh: stopRefresh,
        startRefresh: startRefresh,
        stopRefresh: stopRefresh
    };
})(window, jQuery);
