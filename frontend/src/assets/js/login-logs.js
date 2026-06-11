(function (window, $) {
    'use strict';

    var state = {
        page: 1,
        size: 10,
        username: '',
        loginStatus: null,
        clientIp: '',
        startTime: '',
        endTime: '',
        total: 0,
        pages: 0
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
            '登录日志',
            '查看系统所有登录记录，支持按用户名、登录状态、IP地址和时间范围筛选查询。',
            ['安全审计', '登录追踪', '风险监控']
        );

        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '日志总数', value: state.total || '-', icon: 'fas fa-sign-in-alt', tone: 'tone-info', note: '系统所有登录记录' },
            { label: '当前页码', value: state.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: state.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'loginLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        window.AppLayout && window.AppLayout.setPrimaryPanelTitle('登录日志列表');

        var searchHtml = '' +
            '<div class="login-log-search-bar">' +
            '<form id="login-log-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="lls-username" class="form-control form-control-sm" placeholder="用户名" maxlength="64" value="' + escapeHtml(state.username) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="lls-status" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (state.loginStatus === 1 ? ' selected' : '') + '>成功</option>' +
            '<option value="0"' + (state.loginStatus === 0 ? ' selected' : '') + '>失败</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="lls-ip" class="form-control form-control-sm" placeholder="登录IP" maxlength="64" value="' + escapeHtml(state.clientIp) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">开始时间:</label>' +
            '<input type="datetime-local" id="lls-start-time" class="form-control form-control-sm" value="' + escapeHtml(state.startTime || '') + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">结束时间:</label>' +
            '<input type="datetime-local" id="lls-end-time" class="form-control form-control-sm" value="' + escapeHtml(state.endTime || '') + '">' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="lls-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="login-log-table-container"></div>' +
            '<div id="login-log-pagination" class="login-log-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>用户名筛选</span><span class="badge badge-soft-success">按用户名精确搜索</span></div>' +
            '<div class="status-item"><span>IP筛选</span><span class="badge badge-soft-info">按登录IP地址搜索</span></div>' +
            '<div class="status-item"><span>状态筛选</span><span class="badge badge-soft-warning">成功/失败记录</span></div>' +
            '<div class="status-item"><span>时间筛选</span><span class="badge badge-soft-primary">支持自定义时间范围</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">登录日志记录所有登录尝试，包括成功和失败的登录，便于安全审计和风险监控。</div>'
        );

        fetchPage();
    }

    function bindEvents() {
        $(document).off('submit.loginLogSearch').on('submit.loginLogSearch', '#login-log-search-form', function (e) {
            e.preventDefault();
            state.username = $.trim($('#lls-username').val());
            var statusVal = $('#lls-status').val();
            state.loginStatus = statusVal !== '' ? Number(statusVal) : null;
            state.clientIp = $.trim($('#lls-ip').val());
            state.startTime = $('#lls-start-time').val() ? $('#lls-start-time').val().replace('T', ' ') + ':00' : '';
            state.endTime = $('#lls-end-time').val() ? $('#lls-end-time').val().replace('T', ' ') + ':00' : '';
            state.page = 1;
            fetchPage();
        });

        $(document).off('click.loginLogReset').on('click.loginLogReset', '#lls-reset-btn', function () {
            state.username = '';
            state.loginStatus = null;
            state.clientIp = '';
            state.startTime = '';
            state.endTime = '';
            state.page = 1;
            $('#lls-username').val('');
            $('#lls-status').val('');
            $('#lls-ip').val('');
            $('#lls-start-time').val('');
            $('#lls-end-time').val('');
            fetchPage();
        });

        $(document).off('click.loginLogPage').on('click.loginLogPage', '.login-log-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= state.pages) {
                state.page = p;
                fetchPage();
            }
        });
    }

    function fetchPage() {
        var params = { page: state.page, size: state.size };
        if (state.username) params.username = state.username;
        if (state.loginStatus !== null) params.loginStatus = state.loginStatus;
        if (state.clientIp) params.clientIp = state.clientIp;
        if (state.startTime) params.startTime = state.startTime;
        if (state.endTime) params.endTime = state.endTime;

        $.ajax({
            url: '/api/login-logs',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载登录日志失败', 'bg-danger');
                    return;
                }
                var page = resp.data;
                state.total = page.total || 0;
                state.pages = page.pages || 0;
                renderTable(page.records || []);
                renderPagination();
                updateOverviewCards();
            }
        });
    }

    function renderTable(records) {
        if (!records.length) {
            $('#login-log-table-container').html('<div class="text-center text-muted py-4">暂无登录日志</div>');
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 login-log-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>用户名</th><th>登录IP</th><th>登录地点</th><th>浏览器</th><th>操作系统</th><th>状态</th><th>登录时间</th>' +
            '</tr></thead><tbody>';

        records.forEach(function (log) {
            var statusBadge = log.loginStatus === 1
                ? '<span class="badge badge-soft-success">成功</span>'
                : '<span class="badge badge-soft-danger">失败</span>';

            html += '<tr data-id="' + log.id + '">' +
                '<td>' + escapeHtml(String(log.id)) + '</td>' +
                '<td>' + escapeHtml(log.username || '-') + '</td>' +
                '<td><span class="badge badge-soft-secondary">' + escapeHtml(log.clientIp || '-') + '</span></td>' +
                '<td>' + escapeHtml(log.loginLocation || '-') + '</td>' +
                '<td>' + escapeHtml(log.browser || '-') + '</td>' +
                '<td>' + escapeHtml(log.os || '-') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(formatDatetime(log.loginAt)) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        $('#login-log-table-container').html(html);
    }

    function renderPagination() {
        var total = state.total;
        var pages = state.pages;
        var current = state.page;

        if (pages <= 1) {
            $('#login-log-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }

        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';

        if (current > 1) {
            html += '<button class="btn btn-outline-secondary login-log-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }

        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);

        if (start > 1) {
            html += '<button class="btn btn-outline-secondary login-log-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }

        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary login-log-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary login-log-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary login-log-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        if (current < pages) {
            html += '<button class="btn btn-outline-secondary login-log-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div></div>';
        $('#login-log-pagination').html(html);
    }

    function updateOverviewCards() {
        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '日志总数', value: state.total || '-', icon: 'fas fa-sign-in-alt', tone: 'tone-info', note: '系统所有登录记录' },
            { label: '当前页码', value: state.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: state.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'loginLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    window.AppLoginLogs = {
        state: state,
        renderScene: renderScene,
        fetchPage: fetchPage
    };
})(window, jQuery);
