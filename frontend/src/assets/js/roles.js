(function (window, $) {
    'use strict';

    var rolePageState = {
        page: 1,
        size: 10,
        roleCode: '',
        roleName: '',
        roleStatus: null,
        total: 0,
        pages: 0,
        allRoles: [],
        pendingDeleteRoleId: null,
        pendingDeleteRoleName: '',
        pendingAssignRoleId: null,
        pendingAssignRoleName: '',
        assignMenuIds: [],
        pendingAssignUserId: null,
        pendingAssignUserName: '',
        assignRoleIds: []
    };

    function setHero(title, desc, tags) {
        if (window.AppLayout && typeof window.AppLayout.setHero === 'function') {
            window.AppLayout.setHero(title, desc, tags);
        } else if (window.AppDashboard && typeof window.AppDashboard.setHero === 'function') {
            window.AppDashboard.setHero(title, desc, tags);
        }
    }

    function renderOverviewCards(cards) {
        if (window.AppLayout && typeof window.AppLayout.renderOverviewCards === 'function') {
            window.AppLayout.renderOverviewCards(cards);
        } else if (window.AppDashboard && typeof window.AppDashboard.renderOverviewCards === 'function') {
            window.AppDashboard.renderOverviewCards(cards);
        }
    }

    function setPrimaryPanelTitle(title) {
        if (window.AppLayout && typeof window.AppLayout.setPrimaryPanelTitle === 'function') {
            window.AppLayout.setPrimaryPanelTitle(title);
        } else if (window.AppDashboard && typeof window.AppDashboard.setPrimaryPanelTitle === 'function') {
            window.AppDashboard.setPrimaryPanelTitle(title);
        }
    }

    function destroyAllDashboardCharts() {
        if (window.AppLayout && typeof window.AppLayout.destroyAllDashboardCharts === 'function') {
            window.AppLayout.destroyAllDashboardCharts();
        } else if (window.AppDashboard && typeof window.AppDashboard.destroyAllDashboardCharts === 'function') {
            window.AppDashboard.destroyAllDashboardCharts();
        }
    }

    function fetchMenus() {
        if (window.AppDashboard && typeof window.AppDashboard.fetchMenus === 'function') {
            window.AppDashboard.fetchMenus();
        }
    }

    function fetchUserPage() {
        if (window.AppUsers && typeof window.AppUsers.fetchUserPage === 'function') {
            window.AppUsers.fetchUserPage();
        }
    }

    function renderRolesScene() {
        destroyAllDashboardCharts();
        bindRoleEvents();

        setHero(
            '角色管理',
            '管理系统角色定义，支持角色创建、编辑、删除及菜单权限绑定和用户角色分配。',
            ['RBAC权限', '角色定义', '权限绑定']
        );

        renderOverviewCards([
            { label: '角色总数', value: rolePageState.total || '-', icon: 'fas fa-user-tag', tone: 'tone-info', note: '系统所有角色' },
            { label: '当前页码', value: rolePageState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: rolePageState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'role:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        setPrimaryPanelTitle('角色列表');
        var searchHtml = '' +
            '<div class="role-search-bar">' +
            '<form id="role-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="rs-role-code" class="form-control form-control-sm" placeholder="角色编码" maxlength="64" value="' + AppCommon.escapeHtml(rolePageState.roleCode) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="rs-role-name" class="form-control form-control-sm" placeholder="角色名称" maxlength="64" value="' + AppCommon.escapeHtml(rolePageState.roleName) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="rs-status" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (rolePageState.roleStatus === 1 ? ' selected' : '') + '>启用</option>' +
            '<option value="0"' + (rolePageState.roleStatus === 0 ? ' selected' : '') + '>禁用</option>' +
            '</select>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="rs-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '<button type="button" id="rs-add-btn" class="btn btn-success btn-sm mb-2"><i class="fas fa-plus mr-1"></i>新增角色</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="role-table-container"></div>' +
            '<div id="role-pagination" class="role-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>新增角色</span><span class="badge badge-soft-success">定义角色编码和名称</span></div>' +
            '<div class="status-item"><span>分配菜单</span><span class="badge badge-soft-info">为角色绑定菜单权限</span></div>' +
            '<div class="status-item"><span>分配用户</span><span class="badge badge-soft-warning">为用户分配角色</span></div>' +
            '<div class="status-item"><span>超级管理员</span><span class="badge badge-soft-danger">不可删除或禁用</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">所有操作均需要 role:manage 权限。超级管理员角色默认拥有全部菜单权限，不可修改或删除。</div>'
        );

        fetchRolePage();
    }

    function bindRoleEvents() {
        $(document).off('submit.roleSearch').on('submit.roleSearch', '#role-search-form', function (e) {
            e.preventDefault();
            rolePageState.roleCode = $.trim($('#rs-role-code').val());
            rolePageState.roleName = $.trim($('#rs-role-name').val());
            var statusVal = $('#rs-status').val();
            rolePageState.roleStatus = statusVal !== '' ? Number(statusVal) : null;
            rolePageState.page = 1;
            fetchRolePage();
        });

        $(document).off('click.roleReset').on('click.roleReset', '#rs-reset-btn', function () {
            rolePageState.roleCode = '';
            rolePageState.roleName = '';
            rolePageState.roleStatus = null;
            rolePageState.page = 1;
            $('#rs-role-code').val('');
            $('#rs-role-name').val('');
            $('#rs-status').val('');
            fetchRolePage();
        });

        $(document).off('click.roleAdd').on('click.roleAdd', '#rs-add-btn', function () {
            openRoleFormModal(null);
        });

        $(document).off('submit.roleForm').on('submit.roleForm', '#role-form', function (e) {
            e.preventDefault();
            submitRoleForm();
        });

        $(document).off('click.roleEdit').on('click.roleEdit', '.btn-role-edit', function () {
            var row = $(this).closest('tr');
            var roleData = {
                id: row.data('id'),
                roleCode: row.data('role-code'),
                roleName: row.data('role-name'),
                description: row.data('description'),
                sortOrder: row.data('sort-order'),
                roleStatus: row.data('role-status')
            };
            openRoleFormModal(roleData);
        });

        $(document).off('click.roleAssignMenu').on('click.roleAssignMenu', '.btn-role-assign-menu', function () {
            var row = $(this).closest('tr');
            var roleId = row.data('id');
            var roleName = row.data('role-name');
            openRoleMenuModal(roleId, roleName);
        });

        $(document).off('click.roleToggle').on('click.roleToggle', '.btn-role-toggle', function () {
            var roleId = $(this).closest('tr').data('id');
            toggleRoleStatus(roleId);
        });

        $(document).off('click.roleDelete').on('click.roleDelete', '.btn-role-delete', function () {
            var row = $(this).closest('tr');
            rolePageState.pendingDeleteRoleId = row.data('id');
            rolePageState.pendingDeleteRoleName = row.data('role-name');
            $('#role-delete-body').text('确定要删除角色「' + (rolePageState.pendingDeleteRoleName || '') + '」吗？');
            $('#role-delete-modal').modal('show');
        });

        $(document).off('click.roleDeleteConfirm').on('click.roleDeleteConfirm', '#role-delete-confirm-btn', function () {
            if (rolePageState.pendingDeleteRoleId) {
                deleteRole(rolePageState.pendingDeleteRoleId);
            }
            $('#role-delete-modal').modal('hide');
            rolePageState.pendingDeleteRoleId = null;
        });

        $(document).off('click.rolePage').on('click.rolePage', '.role-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= rolePageState.pages) {
                rolePageState.page = p;
                fetchRolePage();
            }
        });

        $(document).off('click.rmCheckAll').on('click.rmCheckAll', '#rm-check-all', function () {
            $('#rm-menu-tree input[type="checkbox"]').prop('checked', true);
        });

        $(document).off('click.rmUncheckAll').on('click.rmUncheckAll', '#rm-uncheck-all', function () {
            $('#rm-menu-tree input[type="checkbox"]').prop('checked', false);
        });

        $(document).off('click.rmSave').on('click.rmSave', '#rm-save-btn', function () {
            submitRoleMenuAssign();
        });

        $(document).off('click.urSave').on('click.urSave', '#ur-save-btn', function () {
            submitUserRoleAssign();
        });
    }

    function fetchRolePage() {
        var params = { page: rolePageState.page, size: rolePageState.size };
        if (rolePageState.roleCode) params.roleCode = rolePageState.roleCode;
        if (rolePageState.roleName) params.roleName = rolePageState.roleName;
        if (rolePageState.roleStatus !== null) params.roleStatus = rolePageState.roleStatus;

        $.ajax({
            url: '/api/roles',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载角色列表失败', 'bg-danger');
                    return;
                }
                var page = resp.data;
                rolePageState.total = page.total || 0;
                rolePageState.pages = page.pages || 0;
                rolePageState.allRoles = page.records || [];
                renderRoleTable(page.records || []);
                renderRolePagination();
                updateRolesOverviewCards();
            }
        });
    }

    function renderRoleTable(records) {
        if (!records.length) {
            $('#role-table-container').html('<div class="text-center text-muted py-4">暂无角色数据</div>');
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 role-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>角色编码</th><th>角色名称</th><th>描述</th><th>状态</th><th>排序</th><th>创建时间</th><th>操作</th>' +
            '</tr></thead><tbody>';

        records.forEach(function (r) {
            var statusBadge = r.roleStatus === 1
                ? '<span class="badge badge-soft-success">启用</span>'
                : '<span class="badge badge-soft-warning">禁用</span>';
            var isSuperAdmin = r.roleCode === 'SUPER_ADMIN';
            var toggleLabel = r.roleStatus === 1 ? '禁用' : '启用';
            var toggleIcon = r.roleStatus === 1 ? 'fa-ban' : 'fa-check';
            var toggleBtnClass = r.roleStatus === 1 ? 'btn-outline-warning' : 'btn-outline-success';
            var toggleDisabled = isSuperAdmin ? ' disabled' : '';
            var deleteDisabled = isSuperAdmin ? ' disabled' : '';

            html += '<tr data-id="' + r.id + '"' +
                ' data-role-code="' + AppCommon.escapeHtml(r.roleCode || '') + '"' +
                ' data-role-name="' + AppCommon.escapeHtml(r.roleName || '') + '"' +
                ' data-description="' + AppCommon.escapeHtml(r.description || '') + '"' +
                ' data-sort-order="' + (r.sortOrder != null ? r.sortOrder : 0) + '"' +
                ' data-role-status="' + (r.roleStatus != null ? r.roleStatus : 1) + '">' +
                '<td>' + AppCommon.escapeHtml(String(r.id)) + '</td>' +
                '<td><code>' + AppCommon.escapeHtml(r.roleCode || '-') + '</code></td>' +
                '<td>' + AppCommon.escapeHtml(r.roleName || '-') + '</td>' +
                '<td>' + AppCommon.escapeHtml(r.description || '-') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + AppCommon.escapeHtml(String(r.sortOrder != null ? r.sortOrder : 0)) + '</td>' +
                '<td>' + AppCommon.escapeHtml(AppCommon.formatDatetime(r.createdAt)) + '</td>' +
                '<td class="role-action-col">' +
                '<button class="btn btn-sm btn-outline-info btn-role-edit mr-1" title="编辑"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-primary btn-role-assign-menu mr-1" title="分配菜单"><i class="fas fa-list"></i></button>' +
                '<button class="btn btn-sm ' + toggleBtnClass + ' btn-role-toggle mr-1' + toggleDisabled + '" title="' + toggleLabel + '"><i class="fas ' + toggleIcon + '"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger btn-role-delete' + deleteDisabled + '" title="删除"><i class="fas fa-trash-alt"></i></button>' +
                '</td></tr>';
        });

        html += '</tbody></table>';
        $('#role-table-container').html(html);
    }

    function renderRolePagination() {
        var total = rolePageState.total;
        var pages = rolePageState.pages;
        var current = rolePageState.page;

        if (pages <= 1) {
            $('#role-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }

        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';

        if (current > 1) {
            html += '<button class="btn btn-outline-secondary role-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }

        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);

        if (start > 1) {
            html += '<button class="btn btn-outline-secondary role-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }

        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary role-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary role-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary role-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        if (current < pages) {
            html += '<button class="btn btn-outline-secondary role-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div></div>';
        $('#role-pagination').html(html);
    }

    function updateRolesOverviewCards() {
        renderOverviewCards([
            { label: '角色总数', value: rolePageState.total || '-', icon: 'fas fa-user-tag', tone: 'tone-info', note: '系统所有角色' },
            { label: '当前页码', value: rolePageState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: rolePageState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'role:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    function openRoleFormModal(roleData) {
        $('#rf-error-msg').addClass('d-none').text('');
        if (roleData && roleData.id) {
            $('#role-form-label').text('编辑角色');
            $('#rf-id').val(roleData.id);
            $('#rf-role-code').val(roleData.roleCode || '').prop('readonly', roleData.roleCode === 'SUPER_ADMIN');
            $('#rf-role-name').val(roleData.roleName || '');
            $('#rf-description').val(roleData.description || '');
            $('#rf-sort-order').val(roleData.sortOrder != null ? roleData.sortOrder : 1);
            $('#rf-role-status').val(String(roleData.roleStatus != null ? roleData.roleStatus : 1));
        } else {
            $('#role-form-label').text('新增角色');
            $('#rf-id').val('');
            $('#rf-role-code').val('').prop('readonly', false);
            $('#rf-role-name').val('');
            $('#rf-description').val('');
            $('#rf-sort-order').val(1);
            $('#rf-role-status').val('1');
        }
        $('#role-form-modal').modal('show');
    }

    function showRfError(msg) {
        $('#rf-error-msg').removeClass('d-none').text(msg);
    }

    function submitRoleForm() {
        var id = $('#rf-id').val();
        var roleCode = $.trim($('#rf-role-code').val());
        var roleName = $.trim($('#rf-role-name').val());
        var description = $.trim($('#rf-description').val());
        var sortOrder = Number($('#rf-sort-order').val()) || 0;
        var roleStatus = Number($('#rf-role-status').val()) || 0;

        if (!roleCode) { showRfError('角色编码不能为空'); return; }
        if (!/^[A-Za-z0-9_]+$/.test(roleCode) && roleCode.length < 2) { showRfError('角色编码至少2个字符，仅限字母、数字和下划线'); return; }
        if (!roleName) { showRfError('角色名称不能为空'); return; }

        var data = {
            roleCode: roleCode,
            roleName: roleName,
            description: description,
            sortOrder: sortOrder,
            roleStatus: roleStatus
        };

        var method, url;
        if (id) {
            method = 'PUT';
            url = '/api/roles/' + id;
        } else {
            method = 'POST';
            url = '/api/roles';
        }

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    showRfError(resp ? resp.message : '保存失败');
                    return;
                }
                $('#role-form-modal').modal('hide');
                AppCommon.showToast(id ? '编辑成功' : '新增成功', 'bg-success');
                fetchRolePage();
            }
        });
    }

    function toggleRoleStatus(roleId) {
        $.ajax({
            url: '/api/roles/' + roleId + '/status',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '操作失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('状态切换成功', 'bg-success');
                fetchRolePage();
            }
        });
    }

    function deleteRole(roleId) {
        $.ajax({
            url: '/api/roles/' + roleId,
            method: 'DELETE',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('删除成功', 'bg-success');
                fetchRolePage();
            }
        });
    }

    function openRoleMenuModal(roleId, roleName) {
        rolePageState.pendingAssignRoleId = roleId;
        rolePageState.pendingAssignRoleName = roleName || '';
        rolePageState.assignMenuIds = [];
        $('#rm-role-info').html('为角色「<strong>' + AppCommon.escapeHtml(roleName || '') + '</strong>分配菜单权限');
        $('#rm-error-msg').addClass('d-none').text('');
        $('#rm-menu-tree').html('<div class="text-center text-muted py-4">加载中...</div>');
        $('#role-menu-modal').modal('show');

        $.when(
            $.get('/api/menus/all'),
            $.get('/api/roles/' + roleId + '/menus')
        ).done(function (menusResp, assignedResp) {
            var menus = (menusResp[0] && menusResp[0].code === 0) ? menusResp[0].data : [];
            var assignedIds = (assignedResp[0] && assignedResp[0].code === 0) ? assignedResp[0].data : [];
            rolePageState.assignMenuIds = assignedIds || [];
            renderAssignMenuTree(menus, rolePageState.assignMenuIds || []);
        }).fail(function () {
            $('#rm-menu-tree').html('<div class="text-center text-danger py-4">加载菜单数据失败，请重试</div>');
        });
    }

    function renderAssignMenuTree(menus, assignedIds) {
        if (!Array.isArray(menus) || !menus.length) {
            $('#rm-menu-tree').html('<div class="text-center text-muted py-4">暂无菜单数据</div>');
            return;
        }
        var assignedSet = {};
        (assignedIds || []).forEach(function (id) { assignedSet[id] = true; });
        var html = buildAssignMenuHtml(menus, 1, assignedSet);
        $('#rm-menu-tree').html(html);
    }

    function buildAssignMenuHtml(nodes, depth, assignedSet) {
        if (!Array.isArray(nodes) || !nodes.length) return '';
        var html = '<ul class="assign-menu-list" style="list-style: none; padding-left: ' + ((depth - 1) * 20) + 'px;">';
        nodes.forEach(function (node) {
            var checked = assignedSet[node.id] ? ' checked' : '';
            html += '<li style="padding: 4px 0;">' +
                '<label class="mb-0" style="cursor: pointer; font-weight: normal;">' +
                '<input type="checkbox" class="mr-2 menu-assign-checkbox" value="' + node.id + '"' + checked + '>' +
                '<i class="' + AppCommon.safeIcon(node.icon) + ' mr-1 text-muted" style="width: 18px;"></i>' +
                AppCommon.escapeHtml(node.title || '-') +
                '<span class="text-muted ml-2 text-sm">(' + AppCommon.escapeHtml(node.permCode || '-') + ')</span>' +
                '</label>';
            if (Array.isArray(node.children) && node.children.length) {
                html += buildAssignMenuHtml(node.children, depth + 1, assignedSet);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function submitRoleMenuAssign() {
        var ids = [];
        $('#rm-menu-tree input[type="checkbox"]:checked').each(function () {
            ids.push(Number($(this).val()));
        });

        if (!ids.length) {
            $('#rm-error-msg').removeClass('d-none').text('请至少选择一个菜单');
            return;
        }

        $.ajax({
            url: '/api/roles/assign-menus',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ roleId: rolePageState.pendingAssignRoleId, menuIds: ids }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    $('#rm-error-msg').removeClass('d-none').text(resp ? resp.message : '保存失败');
                    return;
                }
                $('#role-menu-modal').modal('hide');
                AppCommon.showToast('菜单权限分配成功', 'bg-success');
                fetchMenus();
            }
        });
    }

    function openUserRoleModal(userId, displayName) {
        rolePageState.pendingAssignUserId = userId;
        rolePageState.pendingAssignUserName = displayName || '';
        rolePageState.assignRoleIds = [];
        $('#ur-user-info').html('为用户「<strong>' + AppCommon.escapeHtml(displayName || '') + '</strong>分配角色');
        $('#ur-error-msg').addClass('d-none').text('');
        $('#ur-role-list').html('<div class="text-center text-muted py-4">加载中...</div>');
        $('#user-role-modal').modal('show');

        $.when(
            $.get('/api/roles/list'),
            $.get('/api/roles/user/' + userId)
        ).done(function (allResp, userRolesResp) {
            var allRoles = (allResp[0] && allResp[0].code === 0) ? allResp[0].data : [];
            var userRoles = (userRolesResp[0] && userRolesResp[0].code === 0) ? userRolesResp[0].data : [];
            var userRoleIds = (userRoles || []).map(function (r) { return r.id; });
            rolePageState.assignRoleIds = userRoleIds;
            renderAssignRoleList(allRoles || [], userRoleIds || []);
        }).fail(function () {
            $('#ur-role-list').html('<div class="text-center text-danger py-4">加载角色数据失败，请重试</div>');
        });
    }

    function renderAssignRoleList(allRoles, assignedIds) {
        if (!Array.isArray(allRoles) || !allRoles.length) {
            $('#ur-role-list').html('<div class="text-center text-muted py-4">暂无角色数据</div>');
            return;
        }
        var assignedSet = {};
        (assignedIds || []).forEach(function (id) { assignedSet[id] = true; });
        var html = '<div class="assign-role-list">';
        allRoles.forEach(function (role) {
            var checked = assignedSet[role.id] ? ' checked' : '';
            var disabled = role.roleStatus !== 1 ? ' disabled' : '';
            var statusBadge = role.roleStatus === 1
                ? '<span class="badge badge-soft-success ml-2">启用</span>'
                : '<span class="badge badge-soft-warning ml-2">禁用</span>';
            html += '<label class="d-block p-2 border rounded mb-2" style="cursor: pointer;">' +
                '<input type="checkbox" class="mr-2 role-assign-checkbox" value="' + role.id + '"' + checked + disabled + '>' +
                '<strong>' + AppCommon.escapeHtml(role.roleName) + '</strong>' +
                '<code class="ml-2 text-muted">' + AppCommon.escapeHtml(role.roleCode) + '</code>' +
                statusBadge +
                (role.description ? '<div class="text-muted text-sm mt-1 ml-4">' + AppCommon.escapeHtml(role.description) + '</div>' : '') +
                '</label>';
        });
        html += '</div>';
        $('#ur-role-list').html(html);
    }

    function submitUserRoleAssign() {
        var ids = [];
        $('#ur-role-list input[type="checkbox"]:checked').each(function () {
            ids.push(Number($(this).val()));
        });

        $.ajax({
            url: '/api/roles/assign-roles',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ userId: rolePageState.pendingAssignUserId, roleIds: ids }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    $('#ur-error-msg').removeClass('d-none').text(resp ? resp.message : '保存失败');
                    return;
                }
                $('#user-role-modal').modal('hide');
                AppCommon.showToast('用户角色分配成功', 'bg-success');
                fetchUserPage();
            }
        });
    }

    window.AppRoles = {
        rolePageState: rolePageState,
        renderScene: renderRolesScene,
        renderRolesScene: renderRolesScene,
        bindRoleEvents: bindRoleEvents,
        fetchRolePage: fetchRolePage,
        renderRoleTable: renderRoleTable,
        renderRolePagination: renderRolePagination,
        updateRolesOverviewCards: updateRolesOverviewCards,
        openRoleFormModal: openRoleFormModal,
        submitRoleForm: submitRoleForm,
        showRfError: showRfError,
        openRoleMenuModal: openRoleMenuModal,
        submitRoleMenuAssign: submitRoleMenuAssign,
        openUserRoleModal: openUserRoleModal,
        submitUserRoleAssign: submitUserRoleAssign,
        toggleRoleStatus: toggleRoleStatus,
        deleteRole: deleteRole
    };
})(window, jQuery);
