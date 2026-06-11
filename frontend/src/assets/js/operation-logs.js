(function (window, $) {
    'use strict';

    var state = {
        page: 1,
        size: 10,
        operatorUsername: '',
        operationModule: '',
        success: null,
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
            '操作日志',
            '查看系统所有操作记录，支持按操作人、时间范围、操作模块筛选查询。',
            ['审计追踪', '操作回溯', '安全监控']
        );

        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '日志总数', value: state.total || '-', icon: 'fas fa-clipboard-list', tone: 'tone-info', note: '系统所有操作记录' },
            { label: '当前页码', value: state.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: state.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'operationLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        window.AppLayout && window.AppLayout.setPrimaryPanelTitle('操作日志列表');

        var searchHtml = '' +
            '<div class="operation-log-search-bar">' +
            '<form id="operation-log-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="ols-username" class="form-control form-control-sm" placeholder="操作人用户名" maxlength="64" value="' + escapeHtml(state.operatorUsername) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ols-module" class="form-control form-control-sm">' +
            '<option value="">全部模块</option>' +
            '<option value="用户管理"' + (state.operationModule === '用户管理' ? ' selected' : '') + '>用户管理</option>' +
            '<option value="菜单管理"' + (state.operationModule === '菜单管理' ? ' selected' : '') + '>菜单管理</option>' +
            '<option value="认证管理"' + (state.operationModule === '认证管理' ? ' selected' : '') + '>认证管理</option>' +
            '<option value="个人中心"' + (state.operationModule === '个人中心' ? ' selected' : '') + '>个人中心</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ols-success" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (state.success === 1 ? ' selected' : '') + '>成功</option>' +
            '<option value="0"' + (state.success === 0 ? ' selected' : '') + '>失败</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">开始时间:</label>' +
            '<input type="datetime-local" id="ols-start-time" class="form-control form-control-sm" value="' + escapeHtml(state.startTime || '') + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">结束时间:</label>' +
            '<input type="datetime-local" id="ols-end-time" class="form-control form-control-sm" value="' + escapeHtml(state.endTime || '') + '">' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="ols-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="operation-log-table-container"></div>' +
            '<div id="operation-log-pagination" class="operation-log-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>操作人筛选</span><span class="badge badge-soft-success">按用户名模糊搜索</span></div>' +
            '<div class="status-item"><span>模块筛选</span><span class="badge badge-soft-info">按功能模块分类查看</span></div>' +
            '<div class="status-item"><span>时间筛选</span><span class="badge badge-soft-warning">支持自定义时间范围</span></div>' +
            '<div class="status-item"><span>状态筛选</span><span class="badge badge-soft-primary">成功/失败记录</span></div>' +
            '<div class="status-item"><span>查看详情</span><span class="badge badge-soft-danger">点击详情查看完整信息</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">操作日志记录所有关键接口的调用情况，包括操作人、请求参数、执行结果和耗时，便于审计和问题追溯。</div>'
        );

        fetchPage();
    }

    function bindEvents() {
        $(document).off('submit.operationLogSearch').on('submit.operationLogSearch', '#operation-log-search-form', function (e) {
            e.preventDefault();
            state.operatorUsername = $.trim($('#ols-username').val());
            state.operationModule = $('#ols-module').val();
            var successVal = $('#ols-success').val();
            state.success = successVal !== '' ? Number(successVal) : null;
            state.startTime = $('#ols-start-time').val() ? $('#ols-start-time').val().replace('T', ' ') + ':00' : '';
            state.endTime = $('#ols-end-time').val() ? $('#ols-end-time').val().replace('T', ' ') + ':00' : '';
            state.page = 1;
            fetchPage();
        });

        $(document).off('click.operationLogReset').on('click.operationLogReset', '#ols-reset-btn', function () {
            state.operatorUsername = '';
            state.operationModule = '';
            state.success = null;
            state.startTime = '';
            state.endTime = '';
            state.page = 1;
            $('#ols-username').val('');
            $('#ols-module').val('');
            $('#ols-success').val('');
            $('#ols-start-time').val('');
            $('#ols-end-time').val('');
            fetchPage();
        });

        $(document).off('click.operationLogDetail').on('click.operationLogDetail', '.btn-operation-log-detail', function () {
            var row = $(this).closest('tr');
            var logData = {
                id: row.data('id'),
                operatorUsername: row.data('operator-username'),
                operatorNickname: row.data('operator-nickname'),
                operationModule: row.data('operation-module'),
                operationDesc: row.data('operation-desc'),
                requestMethod: row.data('request-method'),
                requestPath: row.data('request-path'),
                requestParams: row.data('request-params'),
                responseResult: row.data('response-result'),
                executionTime: row.data('execution-time'),
                success: row.data('success'),
                errorMessage: row.data('error-message'),
                clientIp: row.data('client-ip'),
                userAgent: row.data('user-agent'),
                createdAt: row.data('created-at')
            };
            showDetail(logData);
        });

        $(document).off('click.operationLogPage').on('click.operationLogPage', '.operation-log-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= state.pages) {
                state.page = p;
                fetchPage();
            }
        });
    }

    function fetchPage() {
        var params = { page: state.page, size: state.size };
        if (state.operatorUsername) params.operatorUsername = state.operatorUsername;
        if (state.operationModule) params.operationModule = state.operationModule;
        if (state.success !== null) params.success = state.success;
        if (state.startTime) params.startTime = state.startTime;
        if (state.endTime) params.endTime = state.endTime;

        $.ajax({
            url: '/api/operation-logs',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载操作日志失败', 'bg-danger');
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
            $('#operation-log-table-container').html('<div class="text-center text-muted py-4">暂无操作日志</div>');
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 operation-log-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>操作人</th><th>模块</th><th>操作</th><th>请求方法</th><th>状态</th><th>耗时(ms)</th><th>操作时间</th><th>操作</th>' +
            '</tr></thead><tbody>';

        records.forEach(function (log) {
            var statusBadge = log.success === 1
                ? '<span class="badge badge-soft-success">成功</span>'
                : '<span class="badge badge-soft-danger">失败</span>';

            html += '<tr data-id="' + log.id + '"' +
                ' data-operator-username="' + escapeHtml(log.operatorUsername || '') + '"' +
                ' data-operator-nickname="' + escapeHtml(log.operatorNickname || '') + '"' +
                ' data-operation-module="' + escapeHtml(log.operationModule || '') + '"' +
                ' data-operation-desc="' + escapeHtml(log.operationDesc || '') + '"' +
                ' data-request-method="' + escapeHtml(log.requestMethod || '') + '"' +
                ' data-request-path="' + escapeHtml(log.requestPath || '') + '"' +
                ' data-request-params="' + escapeHtml(log.requestParams || '') + '"' +
                ' data-response-result="' + escapeHtml(log.responseResult || '') + '"' +
                ' data-execution-time="' + escapeHtml(String(log.executionTime || 0)) + '"' +
                ' data-success="' + escapeHtml(String(log.success || 0)) + '"' +
                ' data-error-message="' + escapeHtml(log.errorMessage || '') + '"' +
                ' data-client-ip="' + escapeHtml(log.clientIp || '') + '"' +
                ' data-user-agent="' + escapeHtml(log.userAgent || '') + '"' +
                ' data-created-at="' + escapeHtml(formatDatetime(log.createdAt)) + '">' +
                '<td>' + escapeHtml(String(log.id)) + '</td>' +
                '<td>' + escapeHtml(log.operatorNickname || log.operatorUsername || '-') + '</td>' +
                '<td>' + escapeHtml(log.operationModule || '-') + '</td>' +
                '<td>' + escapeHtml(log.operationDesc || '-') + '</td>' +
                '<td><span class="badge badge-soft-info">' + escapeHtml(log.requestMethod || '-') + '</span></td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(String(log.executionTime || 0)) + '</td>' +
                '<td>' + escapeHtml(formatDatetime(log.createdAt)) + '</td>' +
                '<td>' +
                '<button class="btn btn-sm btn-outline-info btn-operation-log-detail" title="查看详情"><i class="fas fa-eye"></i></button>' +
                '</td></tr>';
        });

        html += '</tbody></table>';
        $('#operation-log-table-container').html(html);
    }

    function renderPagination() {
        var total = state.total;
        var pages = state.pages;
        var current = state.page;

        if (pages <= 1) {
            $('#operation-log-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }

        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';

        if (current > 1) {
            html += '<button class="btn btn-outline-secondary operation-log-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }

        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);

        if (start > 1) {
            html += '<button class="btn btn-outline-secondary operation-log-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }

        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary operation-log-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary operation-log-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary operation-log-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        if (current < pages) {
            html += '<button class="btn btn-outline-secondary operation-log-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div></div>';
        $('#operation-log-pagination').html(html);
    }

    function updateOverviewCards() {
        window.AppLayout && window.AppLayout.renderOverviewCards([
            { label: '日志总数', value: state.total || '-', icon: 'fas fa-clipboard-list', tone: 'tone-info', note: '系统所有操作记录' },
            { label: '当前页码', value: state.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: state.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'operationLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    function showDetail(log) {
        var html = '';
        var fields = [
            { label: '日志ID', value: log.id },
            { label: '操作人用户名', value: log.operatorUsername || '-' },
            { label: '操作人昵称', value: log.operatorNickname || '-' },
            { label: '操作模块', value: log.operationModule || '-' },
            { label: '操作描述', value: log.operationDesc || '-' },
            { label: '请求方法', value: log.requestMethod || '-' },
            { label: '请求路径', value: log.requestPath || '-' },
            { label: '执行状态', value: log.success === 1 ? '成功' : '失败' },
            { label: '执行耗时', value: (log.executionTime || 0) + ' ms' },
            { label: '客户端IP', value: log.clientIp || '-' },
            { label: '操作时间', value: log.createdAt || '-' }
        ];

        fields.forEach(function (field) {
            html += '<tr><th class="bg-light" style="width: 150px;">' + escapeHtml(field.label) + '</th><td>' + escapeHtml(String(field.value)) + '</td></tr>';
        });

        if (log.requestParams) {
            html += '<tr><th class="bg-light" style="width: 150px;">请求参数</th><td><pre class="mb-0" style="max-height: 200px; overflow-y: auto;">' + escapeHtml(log.requestParams) + '</pre></td></tr>';
        }
        if (log.responseResult) {
            html += '<tr><th class="bg-light" style="width: 150px;">响应结果</th><td><pre class="mb-0" style="max-height: 200px; overflow-y: auto;">' + escapeHtml(log.responseResult) + '</pre></td></tr>';
        }
        if (log.errorMessage) {
            html += '<tr><th class="bg-light" style="width: 150px;">错误信息</th><td class="text-danger">' + escapeHtml(log.errorMessage) + '</td></tr>';
        }
        if (log.userAgent) {
            html += '<tr><th class="bg-light" style="width: 150px;">用户代理</th><td>' + escapeHtml(log.userAgent) + '</td></tr>';
        }

        $('#operation-log-detail-tbody').html(html);
        $('#operation-log-detail-modal').modal('show');
    }

    window.AppOperationLogs = {
        state: state,
        renderScene: renderScene,
        fetchPage: fetchPage
    };
})(window, jQuery);
