(function (window, $) {
    'use strict';

    var state = {
        page: 1,
        size: 10,
        total: 0,
        pages: 0,
        taskName: '',
        taskGroup: '',
        taskStatus: null,
        pendingDeleteTaskId: null,
        execLogState: {
            taskId: null,
            taskName: '',
            page: 1,
            size: 10,
            total: 0,
            pages: 0,
            executionStatus: null
        }
    };

    function renderScene() {
        if (window.AppLayout && typeof AppLayout.destroyAllDashboardCharts === 'function') {
            AppLayout.destroyAllDashboardCharts();
        }
        if (window.AppLayout && typeof AppLayout.setHero === 'function') {
            AppLayout.setHero(
                '定时任务',
                '管理系统定时任务，支持Cron表达式配置、启停控制与执行记录查看。',
                ['Cron配置', '启停控制', '执行追踪']
            );
        }
        renderOverviewCards();
        if (window.AppLayout && typeof AppLayout.setPrimaryPanelTitle === 'function') {
            AppLayout.setPrimaryPanelTitle('定时任务列表');
        }
        var searchHtml = '' +
            '<div class="user-search-bar">' +
            '<form id="task-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="ts-task-name" class="form-control form-control-sm" placeholder="任务名称" maxlength="64" value="' + escapeHtml(state.taskName) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="ts-task-group" class="form-control form-control-sm" placeholder="任务分组" maxlength="64" value="' + escapeHtml(state.taskGroup) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ts-status" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (state.taskStatus === 1 ? ' selected' : '') + '>运行中</option>' +
            '<option value="0"' + (state.taskStatus === 0 ? ' selected' : '') + '>已暂停</option>' +
            '</select>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="ts-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '<button type="button" id="ts-add-btn" class="btn btn-success btn-sm mb-2"><i class="fas fa-plus mr-1"></i>新增任务</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="task-table-container"></div>' +
            '<div id="task-pagination" class="user-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);
        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>新增任务</span><span class="badge badge-soft-success">填写名称/Cron/Bean</span></div>' +
            '<div class="status-item"><span>启停控制</span><span class="badge badge-soft-info">一键启动或暂停任务</span></div>' +
            '<div class="status-item"><span>执行记录</span><span class="badge badge-soft-warning">查看历史执行详情</span></div>' +
            '<div class="status-item"><span>最近执行</span><span class="badge badge-soft-danger">快速检索最近一次执行</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">Cron表达式格式：秒 分 时 日 月 周。如 0 */5 * * * ? 表示每5分钟执行一次。失败的任务会自动写入操作日志。</div>'
        );
        bindEvents();
        fetchPage();
    }

    function renderOverviewCards() {
        if (!window.AppLayout || typeof AppLayout.renderOverviewCards !== 'function') {
            return;
        }
        AppLayout.renderOverviewCards([
            { label: '任务总数', value: state.total || '-', icon: 'fas fa-clock', tone: 'tone-info', note: '所有已配置任务' },
            { label: '当前页码', value: state.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: state.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'scheduledTask:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    function bindEvents() {
        $(document).off('submit.taskSearch').on('submit.taskSearch', '#task-search-form', function (e) {
            e.preventDefault();
            state.taskName = $.trim($('#ts-task-name').val());
            state.taskGroup = $.trim($('#ts-task-group').val());
            var statusVal = $('#ts-status').val();
            state.taskStatus = statusVal !== '' ? Number(statusVal) : null;
            state.page = 1;
            fetchPage();
        });
        $(document).off('click.taskReset').on('click.taskReset', '#ts-reset-btn', function () {
            state.taskName = '';
            state.taskGroup = '';
            state.taskStatus = null;
            state.page = 1;
            $('#ts-task-name').val('');
            $('#ts-task-group').val('');
            $('#ts-status').val('');
            fetchPage();
        });
        $(document).off('click.taskAdd').on('click.taskAdd', '#ts-add-btn', function () {
            openTaskFormModal(null);
        });
        $(document).off('submit.taskForm').on('submit.taskForm', '#task-form', function (e) {
            e.preventDefault();
            submitTaskForm();
        });
        $(document).off('click.taskEdit').on('click.taskEdit', '.btn-task-edit', function () {
            var row = $(this).closest('tr');
            var taskData = {
                id: row.data('id'),
                taskName: row.data('task-name'),
                taskGroup: row.data('task-group'),
                cronExpression: row.data('cron-expression'),
                beanName: row.data('bean-name'),
                methodName: row.data('method-name'),
                methodParams: row.data('method-params'),
                taskStatus: row.data('task-status'),
                remark: row.data('remark')
            };
            openTaskFormModal(taskData);
        });
        $(document).off('click.taskStart').on('click.taskStart', '.btn-task-start', function () {
            var taskId = $(this).closest('tr').data('id');
            startScheduledTask(taskId);
        });
        $(document).off('click.taskPause').on('click.taskPause', '.btn-task-pause', function () {
            var taskId = $(this).closest('tr').data('id');
            pauseScheduledTask(taskId);
        });
        $(document).off('click.taskDelete').on('click.taskDelete', '.btn-task-delete', function () {
            state.pendingDeleteTaskId = $(this).closest('tr').data('id');
            $('#task-delete-modal').modal('show');
        });
        $(document).off('click.taskDeleteConfirm').on('click.taskDeleteConfirm', '#task-delete-confirm-btn', function () {
            if (state.pendingDeleteTaskId) {
                deleteScheduledTask(state.pendingDeleteTaskId);
            }
            $('#task-delete-modal').modal('hide');
            state.pendingDeleteTaskId = null;
        });
        $(document).off('click.taskPage').on('click.taskPage', '.task-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= state.pages) {
                state.page = p;
                fetchPage();
            }
        });
        $(document).off('click.taskExecLog').on('click.taskExecLog', '.btn-task-exec-log', function () {
            var taskId = $(this).closest('tr').data('id');
            var taskName = $(this).closest('tr').data('task-name');
            openExecLogModal(taskId, taskName);
        });
        $(document).off('click.taskLatestExec').on('click.taskLatestExec', '.btn-task-latest-exec', function () {
            var taskId = $(this).closest('tr').data('id');
            showLatestExecDetail(taskId);
        });
        $(document).off('click.execLogPage').on('click.execLogPage', '.exec-log-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= state.execLogState.pages) {
                state.execLogState.page = p;
                fetchExecLogPage();
            }
        });
        $(document).off('click.execLogDetail').on('click.execLogDetail', '.btn-exec-log-detail', function () {
            var logData = $(this).closest('tr').data();
            showExecDetail(logData);
        });
        $(document).off('change.execLogStatus').on('change.execLogStatus', '#exec-log-status-filter', function () {
            var val = $(this).val();
            state.execLogState.executionStatus = val !== '' ? Number(val) : null;
            state.execLogState.page = 1;
            fetchExecLogPage();
        });
    }

    function fetchPage() {
        var params = { page: state.page, size: state.size };
        if (state.taskName) params.taskName = state.taskName;
        if (state.taskGroup) params.taskGroup = state.taskGroup;
        if (state.taskStatus !== null) params.taskStatus = state.taskStatus;
        $.ajax({
            url: '/api/scheduled-tasks',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载任务列表失败', 'bg-danger');
                    return;
                }
                var page = resp.data;
                state.total = page.total || 0;
                state.pages = page.pages || 0;
                renderTable(page.records || []);
                renderPagination();
                renderOverviewCards();
            }
        });
    }

    function renderTable(records) {
        if (!records.length) {
            $('#task-table-container').html('<div class="text-center text-muted py-4">暂无定时任务数据</div>');
            return;
        }
        var html = '<table class="table table-sm table-hover mb-0 user-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>任务名称</th><th>分组</th><th>Cron表达式</th><th>Bean</th><th>状态</th><th>下次执行</th><th>创建时间</th><th>操作</th>' +
            '</tr></thead><tbody>';
        records.forEach(function (t) {
            var statusBadge = t.taskStatus === 1
                ? '<span class="badge badge-soft-success">运行中</span>'
                : '<span class="badge badge-soft-warning">已暂停</span>';
            var toggleBtn = t.taskStatus === 1
                ? '<button class="btn btn-sm btn-outline-warning btn-task-pause mr-1" title="暂停"><i class="fas fa-pause"></i></button>'
                : '<button class="btn btn-sm btn-outline-success btn-task-start mr-1" title="启动"><i class="fas fa-play"></i></button>';
            html += '<tr data-id="' + t.id + '" data-task-name="' + escapeHtml(t.taskName || '') + '" data-task-group="' + escapeHtml(t.taskGroup || '') + '" data-cron-expression="' + escapeHtml(t.cronExpression || '') + '" data-bean-name="' + escapeHtml(t.beanName || '') + '" data-method-name="' + escapeHtml(t.methodName || '') + '" data-method-params="' + escapeHtml(t.methodParams || '') + '" data-task-status="' + (t.taskStatus != null ? t.taskStatus : '') + '" data-remark="' + escapeHtml(t.remark || '') + '">' +
                '<td>' + escapeHtml(String(t.id)) + '</td>' +
                '<td>' + escapeHtml(t.taskName || '-') + '</td>' +
                '<td><span class="badge badge-soft-secondary">' + escapeHtml(t.taskGroup || '-') + '</span></td>' +
                '<td><code>' + escapeHtml(t.cronExpression || '-') + '</code></td>' +
                '<td>' + escapeHtml(t.beanName || '-') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(formatDatetime(t.nextExecutionTime)) + '</td>' +
                '<td>' + escapeHtml(formatDatetime(t.createdAt)) + '</td>' +
                '<td class="user-action-col">' +
                '<button class="btn btn-sm btn-outline-info btn-task-edit mr-1" title="编辑"><i class="fas fa-edit"></i></button>' +
                toggleBtn +
                '<button class="btn btn-sm btn-outline-secondary btn-task-exec-log mr-1" title="执行记录"><i class="fas fa-history"></i></button>' +
                '<button class="btn btn-sm btn-outline-primary btn-task-latest-exec mr-1" title="最近执行"><i class="fas fa-info-circle"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger btn-task-delete" title="删除"><i class="fas fa-trash-alt"></i></button>' +
                '</td></tr>';
        });
        html += '</tbody></table>';
        $('#task-table-container').html(html);
    }

    function renderPagination() {
        var total = state.total;
        var pages = state.pages;
        var current = state.page;
        if (pages <= 1) {
            $('#task-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }
        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';
        if (current > 1) {
            html += '<button class="btn btn-outline-secondary task-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }
        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);
        if (start > 1) {
            html += '<button class="btn btn-outline-secondary task-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }
        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary task-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary task-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }
        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary task-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }
        if (current < pages) {
            html += '<button class="btn btn-outline-secondary task-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }
        html += '</div></div>';
        $('#task-pagination').html(html);
    }

    function openTaskFormModal(taskData) {
        $('#tf-error-msg').addClass('d-none').text('');
        if (taskData && taskData.id) {
            $('#task-form-label').text('编辑任务');
            $('#tf-id').val(taskData.id);
            $('#tf-task-name').val(taskData.taskName || '');
            $('#tf-task-group').val(taskData.taskGroup || 'DEFAULT');
            $('#tf-cron-expression').val(taskData.cronExpression || '');
            $('#tf-bean-name').val(taskData.beanName || '');
            $('#tf-method-name').val(taskData.methodName || 'execute');
            $('#tf-method-params').val(taskData.methodParams || '');
            $('#tf-task-status').val(String(taskData.taskStatus != null ? taskData.taskStatus : 0));
            $('#tf-remark').val(taskData.remark || '');
        } else {
            $('#task-form-label').text('新增任务');
            $('#tf-id').val('');
            $('#tf-task-name').val('');
            $('#tf-task-group').val('DEFAULT');
            $('#tf-cron-expression').val('');
            $('#tf-bean-name').val('');
            $('#tf-method-name').val('execute');
            $('#tf-method-params').val('');
            $('#tf-task-status').val('0');
            $('#tf-remark').val('');
        }
        $('#task-form-modal').modal('show');
    }

    function submitTaskForm() {
        var id = $('#tf-id').val();
        var taskName = $.trim($('#tf-task-name').val());
        var cronExpression = $.trim($('#tf-cron-expression').val());
        var beanName = $.trim($('#tf-bean-name').val());
        if (!taskName) { showTfError('任务名称不能为空'); return; }
        if (!cronExpression) { showTfError('Cron表达式不能为空'); return; }
        if (!beanName) { showTfError('Bean名称不能为空'); return; }
        var payload = {
            taskName: taskName,
            taskGroup: $.trim($('#tf-task-group').val()) || 'DEFAULT',
            cronExpression: cronExpression,
            beanName: beanName,
            methodName: $.trim($('#tf-method-name').val()) || 'execute',
            methodParams: $.trim($('#tf-method-params').val()),
            taskStatus: Number($('#tf-task-status').val()),
            remark: $.trim($('#tf-remark').val())
        };
        if (id) {
            $.ajax({
                url: '/api/scheduled-tasks/' + id,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                success: function (resp) {
                    if (!resp || Number(resp.code) !== 0) {
                        showTfError(resp ? resp.message : '编辑失败');
                        return;
                    }
                    $('#task-form-modal').modal('hide');
                    AppCommon.showToast('编辑成功', 'bg-success');
                    fetchPage();
                }
            });
        } else {
            $.ajax({
                url: '/api/scheduled-tasks',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                success: function (resp) {
                    if (!resp || Number(resp.code) !== 0) {
                        showTfError(resp ? resp.message : '新增失败');
                        return;
                    }
                    $('#task-form-modal').modal('hide');
                    AppCommon.showToast('新增成功', 'bg-success');
                    state.page = 1;
                    fetchPage();
                }
            });
        }
    }

    function showTfError(msg) {
        $('#tf-error-msg').removeClass('d-none').text(msg);
    }

    function startScheduledTask(taskId) {
        $.ajax({
            url: '/api/scheduled-tasks/' + taskId + '/start',
            method: 'PUT',
            success: function (resp) {
                if (resp && Number(resp.code) === 0) {
                    AppCommon.showToast('任务已启动', 'bg-success');
                    fetchPage();
                } else {
                    AppCommon.showToast(resp ? resp.message : '启动失败', 'bg-danger');
                }
            }
        });
    }

    function pauseScheduledTask(taskId) {
        $.ajax({
            url: '/api/scheduled-tasks/' + taskId + '/pause',
            method: 'PUT',
            success: function (resp) {
                if (resp && Number(resp.code) === 0) {
                    AppCommon.showToast('任务已暂停', 'bg-success');
                    fetchPage();
                } else {
                    AppCommon.showToast(resp ? resp.message : '暂停失败', 'bg-danger');
                }
            }
        });
    }

    function deleteScheduledTask(taskId) {
        $.ajax({
            url: '/api/scheduled-tasks/' + taskId,
            method: 'DELETE',
            success: function (resp) {
                if (resp && Number(resp.code) === 0) {
                    AppCommon.showToast('删除成功', 'bg-success');
                    fetchPage();
                } else {
                    AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                }
            }
        });
    }

    function openExecLogModal(taskId, taskName) {
        state.execLogState.taskId = taskId;
        state.execLogState.taskName = taskName || '';
        state.execLogState.page = 1;
        state.execLogState.executionStatus = null;
        $('#execution-log-label').text('执行记录 - ' + (taskName || '任务'));
        $('#exec-log-task-info').html('<span class="mr-3"><i class="fas fa-tasks mr-1"></i>任务ID: ' + taskId + '</span>' +
            '<span class="mr-3"><i class="fas fa-tag mr-1"></i>任务名称: ' + escapeHtml(taskName || '-') + '</span>' +
            '<select id="exec-log-status-filter" class="form-control form-control-sm d-inline-block" style="width:auto;">' +
            '<option value="">全部状态</option><option value="1">成功</option><option value="0">失败</option></select>');
        fetchExecLogPage();
        $('#execution-log-modal').modal('show');
    }

    function fetchExecLogPage() {
        var params = { page: state.execLogState.page, size: state.execLogState.size };
        if (state.execLogState.executionStatus !== null) params.executionStatus = state.execLogState.executionStatus;
        $.ajax({
            url: '/api/scheduled-tasks/' + state.execLogState.taskId + '/execution-logs',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    $('#exec-log-table-container').html('<div class="text-center text-muted py-4">暂无执行记录</div>');
                    return;
                }
                var page = resp.data;
                state.execLogState.total = page.total || 0;
                state.execLogState.pages = page.pages || 0;
                renderExecLogTable(page.records || []);
                renderExecLogPagination();
            }
        });
    }

    function renderExecLogTable(records) {
        if (!records.length) {
            $('#exec-log-table-container').html('<div class="text-center text-muted py-4">暂无执行记录</div>');
            $('#exec-log-pagination').html('');
            return;
        }
        var html = '<table class="table table-sm table-hover mb-0 user-table">' +
            '<thead><tr><th>ID</th><th>状态</th><th>开始时间</th><th>结束时间</th><th>耗时(ms)</th><th>操作</th></tr></thead><tbody>';
        records.forEach(function (r) {
            var statusBadge = r.executionStatus === 1
                ? '<span class="badge badge-soft-success">成功</span>'
                : '<span class="badge badge-soft-danger">失败</span>';
            html += '<tr data-id="' + r.id + '" data-task-name="' + escapeHtml(r.taskName || '') + '" data-task-group="' + escapeHtml(r.taskGroup || '') + '" data-cron-expression="' + escapeHtml(r.cronExpression || '') + '" data-execution-status="' + (r.executionStatus != null ? r.executionStatus : '') + '" data-start-time="' + escapeHtml(formatDatetime(r.startTime)) + '" data-end-time="' + escapeHtml(formatDatetime(r.endTime)) + '" data-execution-duration="' + (r.executionDuration || 0) + '" data-error-message="' + escapeHtml(r.errorMessage || '') + '">' +
                '<td>' + escapeHtml(String(r.id)) + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(formatDatetime(r.startTime)) + '</td>' +
                '<td>' + escapeHtml(formatDatetime(r.endTime)) + '</td>' +
                '<td>' + (r.executionDuration || 0) + '</td>' +
                '<td><button class="btn btn-sm btn-outline-info btn-exec-log-detail" title="查看详情"><i class="fas fa-eye"></i></button></td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        $('#exec-log-table-container').html(html);
    }

    function renderExecLogPagination() {
        var total = state.execLogState.total;
        var pages = state.execLogState.pages;
        var current = state.execLogState.page;
        if (pages <= 1) {
            $('#exec-log-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }
        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';
        if (current > 1) html += '<button class="btn btn-outline-secondary exec-log-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);
        if (start > 1) {
            html += '<button class="btn btn-outline-secondary exec-log-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }
        for (var i = start; i <= end; i++) {
            html += i === current
                ? '<button class="btn btn-primary exec-log-page-btn" data-page="' + i + '">' + i + '</button>'
                : '<button class="btn btn-outline-secondary exec-log-page-btn" data-page="' + i + '">' + i + '</button>';
        }
        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary exec-log-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }
        if (current < pages) html += '<button class="btn btn-outline-secondary exec-log-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        html += '</div></div>';
        $('#exec-log-pagination').html(html);
    }

    function showExecDetail(logData) {
        var rows = [
            ['日志ID', logData.id || '-'],
            ['任务名称', logData.taskName || '-'],
            ['任务分组', logData.taskGroup || '-'],
            ['Cron表达式', logData.cronExpression || '-'],
            ['执行状态', logData.executionStatus == 1 ? '<span class="badge badge-soft-success">成功</span>' : '<span class="badge badge-soft-danger">失败</span>'],
            ['开始时间', logData.startTime || '-'],
            ['结束时间', logData.endTime || '-'],
            ['执行耗时', (logData.executionDuration || 0) + ' ms']
        ];
        if (logData.errorMessage) {
            rows.push(['错误信息', '<pre class="mb-0 text-danger" style="white-space:pre-wrap;word-break:break-word;">' + escapeHtml(logData.errorMessage) + '</pre>']);
        }
        var html = '';
        rows.forEach(function (r) {
            html += '<tr><td class="font-weight-bold text-nowrap" style="width:120px;">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
        });
        $('#exec-detail-tbody').html(html);
        $('#exec-detail-label').text('执行详情 - ' + (logData.taskName || '任务'));
        $('#exec-detail-modal').modal('show');
    }

    function showLatestExecDetail(taskId) {
        $.ajax({
            url: '/api/scheduled-tasks/' + taskId + '/execution-logs/latest',
            method: 'GET',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast('暂无执行记录', 'bg-warning');
                    return;
                }
                var log = resp.data;
                showExecDetail({
                    id: log.id,
                    taskName: log.taskName,
                    taskGroup: log.taskGroup,
                    cronExpression: log.cronExpression,
                    executionStatus: log.executionStatus,
                    startTime: formatDatetime(log.startTime),
                    endTime: formatDatetime(log.endTime),
                    executionDuration: log.executionDuration,
                    errorMessage: log.errorMessage
                });
            }
        });
    }

    function escapeHtml(text) {
        if (window.AppCommon && typeof AppCommon.escapeHtml === 'function') {
            return AppCommon.escapeHtml(text);
        }
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDatetime(ts) {
        if (window.AppCommon && typeof AppCommon.formatDatetime === 'function') {
            return AppCommon.formatDatetime(ts);
        }
        if (!ts) return '-';
        var d = new Date(ts);
        if (isNaN(d.getTime())) return '-';
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        var s = String(d.getSeconds()).padStart(2, '0');
        return y + '-' + m + '-' + day + ' ' + h + ':' + min + ':' + s;
    }

    window.AppScheduledTasks = {
        renderScene: renderScene
    };

})(window, jQuery);
