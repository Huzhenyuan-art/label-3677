(function (window, $) {
    'use strict';

    var userPageState = {
        page: 1,
        size: 10,
        username: '',
        nickname: '',
        userStatus: null,
        total: 0,
        pages: 0
    };

    var pendingDeleteUserId = null;

    var assignRoleState = {
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

    function renderUsersScene() {
        destroyAllDashboardCharts();

        setHero(
            '用户管理',
            '管理系统用户账号，支持新增、编辑、启禁用与逻辑删除操作。',
            ['用户列表', '权限管控', '状态切换']
        );

        renderOverviewCards([
            { label: '用户总数', value: userPageState.total || '-', icon: 'fas fa-users', tone: 'tone-info', note: '含所有未删除账号' },
            { label: '当前页码', value: userPageState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: userPageState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'user:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        setPrimaryPanelTitle('用户列表');
        var searchHtml = '' +
            '<div class="user-search-bar">' +
            '<form id="user-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="us-username" class="form-control form-control-sm" placeholder="用户名" maxlength="64" value="' + AppCommon.escapeHtml(userPageState.username) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="us-nickname" class="form-control form-control-sm" placeholder="昵称" maxlength="64" value="' + AppCommon.escapeHtml(userPageState.nickname) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="us-status" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (userPageState.userStatus === 1 ? ' selected' : '') + '>启用</option>' +
            '<option value="0"' + (userPageState.userStatus === 0 ? ' selected' : '') + '>禁用</option>' +
            '</select>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="us-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '<button type="button" id="us-add-btn" class="btn btn-success btn-sm mb-2"><i class="fas fa-plus mr-1"></i>新增用户</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="user-table-container"></div>' +
            '<div id="user-pagination" class="user-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>新增用户</span><span class="badge badge-soft-success">填写用户名/密码/昵称</span></div>' +
            '<div class="status-item"><span>编辑用户</span><span class="badge badge-soft-info">修改昵称和头像</span></div>' +
            '<div class="status-item"><span>启禁用</span><span class="badge badge-soft-warning">一键切换用户状态</span></div>' +
            '<div class="status-item"><span>逻辑删除</span><span class="badge badge-soft-danger">标记删除可恢复</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">所有操作均需要 user:manage 权限，由后端 @PreAuthorize 控制。</div>'
        );

        bindUserEvents();
        fetchUserPage();
    }

    function bindUserEvents() {
        $(document).off('submit.userSearch').on('submit.userSearch', '#user-search-form', function (e) {
            e.preventDefault();
            userPageState.username = $.trim($('#us-username').val());
            userPageState.nickname = $.trim($('#us-nickname').val());
            var statusVal = $('#us-status').val();
            userPageState.userStatus = statusVal !== '' ? Number(statusVal) : null;
            userPageState.page = 1;
            fetchUserPage();
        });

        $(document).off('click.userReset').on('click.userReset', '#us-reset-btn', function () {
            userPageState.username = '';
            userPageState.nickname = '';
            userPageState.userStatus = null;
            userPageState.page = 1;
            $('#us-username').val('');
            $('#us-nickname').val('');
            $('#us-status').val('');
            fetchUserPage();
        });

        $(document).off('click.userAdd').on('click.userAdd', '#us-add-btn', function () {
            openUserFormModal(null);
        });

        $(document).off('submit.userForm').on('submit.userForm', '#user-form', function (e) {
            e.preventDefault();
            submitUserForm();
        });

        $(document).off('click.userEdit').on('click.userEdit', '.btn-user-edit', function () {
            var row = $(this).closest('tr');
            var userData = {
                id: row.data('id'),
                username: row.data('username'),
                nickname: row.data('nickname'),
                avatar: row.data('avatar')
            };
            openUserFormModal(userData);
        });

        $(document).off('click.userAssignRole').on('click.userAssignRole', '.btn-user-assign-role', function () {
            var row = $(this).closest('tr');
            var userId = row.data('id');
            var username = row.data('username');
            var nickname = row.data('nickname');
            openUserRoleModal(userId, nickname || username);
        });

        $(document).off('click.urSave').on('click.urSave', '#ur-save-btn', function () {
            submitUserRoleAssign();
        });

        $(document).off('click.userToggle').on('click.userToggle', '.btn-user-toggle', function () {
            var userId = $(this).closest('tr').data('id');
            toggleUserStatus(userId);
        });

        $(document).off('click.userDelete').on('click.userDelete', '.btn-user-delete', function () {
            pendingDeleteUserId = $(this).closest('tr').data('id');
            $('#user-delete-modal').modal('show');
        });

        $(document).off('click.userDeleteConfirm').on('click.userDeleteConfirm', '#user-delete-confirm-btn', function () {
            if (pendingDeleteUserId) {
                deleteUser(pendingDeleteUserId);
            }
            $('#user-delete-modal').modal('hide');
            pendingDeleteUserId = null;
        });

        $(document).off('click.userPage').on('click.userPage', '.user-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= userPageState.pages) {
                userPageState.page = p;
                fetchUserPage();
            }
        });
    }

    function fetchUserPage() {
        var params = { page: userPageState.page, size: userPageState.size };
        if (userPageState.username) params.username = userPageState.username;
        if (userPageState.nickname) params.nickname = userPageState.nickname;
        if (userPageState.userStatus !== null) params.userStatus = userPageState.userStatus;

        $.ajax({
            url: '/api/users',
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '加载用户列表失败', 'bg-danger');
                    return;
                }
                var page = resp.data;
                userPageState.total = page.total || 0;
                userPageState.pages = page.pages || 0;
                renderUserTable(page.records || []);
                renderUserPagination();
                updateUsersOverviewCards();
            }
        });
    }

    function renderUserTable(records) {
        if (!records.length) {
            $('#user-table-container').html('<div class="text-center text-muted py-4">暂无用户数据</div>');
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 user-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>创建时间</th><th>最后登录</th><th>操作</th>' +
            '</tr></thead><tbody>';

        records.forEach(function (u) {
            var statusBadge = u.userStatus === 1
                ? '<span class="badge badge-soft-success">启用</span>'
                : '<span class="badge badge-soft-warning">禁用</span>';
            var toggleLabel = u.userStatus === 1 ? '禁用' : '启用';
            var toggleIcon = u.userStatus === 1 ? 'fa-ban' : 'fa-check';
            var toggleBtnClass = u.userStatus === 1 ? 'btn-outline-warning' : 'btn-outline-success';

            var rolesHtml = '';
            if (Array.isArray(u.roles) && u.roles.length) {
                u.roles.forEach(function (r) {
                    rolesHtml += '<span class="badge badge-soft-info mr-1 mb-1">' + AppCommon.escapeHtml(r.roleName || r.roleCode) + '</span>';
                });
            } else {
                rolesHtml = '<span class="text-muted">未分配</span>';
            }

            html += '<tr data-id="' + u.id + '" data-username="' + AppCommon.escapeHtml(u.username) + '" data-nickname="' + AppCommon.escapeHtml(u.nickname || '') + '" data-avatar="' + AppCommon.escapeHtml(u.avatar || '') + '">' +
                '<td>' + AppCommon.escapeHtml(String(u.id)) + '</td>' +
                '<td>' + AppCommon.escapeHtml(u.username || '-') + '</td>' +
                '<td>' + AppCommon.escapeHtml(u.nickname || '-') + '</td>' +
                '<td>' + rolesHtml + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + AppCommon.escapeHtml(AppCommon.formatDatetime(u.createdAt)) + '</td>' +
                '<td>' + AppCommon.escapeHtml(AppCommon.formatDatetime(u.lastLoginAt)) + '</td>' +
                '<td class="user-action-col">' +
                '<button class="btn btn-sm btn-outline-info btn-user-edit mr-1" title="编辑"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-secondary btn-user-assign-role mr-1" title="分配角色"><i class="fas fa-user-tag"></i></button>' +
                '<button class="btn btn-sm ' + toggleBtnClass + ' btn-user-toggle mr-1" title="' + toggleLabel + '"><i class="fas ' + toggleIcon + '"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger btn-user-delete" title="删除"><i class="fas fa-trash-alt"></i></button>' +
                '</td></tr>';
        });

        html += '</tbody></table>';
        $('#user-table-container').html(html);
    }

    function renderUserPagination() {
        var total = userPageState.total;
        var pages = userPageState.pages;
        var current = userPageState.page;

        if (pages <= 1) {
            $('#user-pagination').html('<span class="text-muted text-sm">共 ' + total + ' 条记录</span>');
            return;
        }

        var html = '<div class="d-flex align-items-center justify-content-between flex-wrap">' +
            '<span class="text-muted text-sm">共 ' + total + ' 条 / 第 ' + current + ' 页 / 共 ' + pages + ' 页</span>' +
            '<div class="btn-group btn-group-sm">';

        if (current > 1) {
            html += '<button class="btn btn-outline-secondary user-page-btn" data-page="' + (current - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        }

        var start = Math.max(1, current - 2);
        var end = Math.min(pages, current + 2);

        if (start > 1) {
            html += '<button class="btn btn-outline-secondary user-page-btn" data-page="1">1</button>';
            if (start > 2) html += '<span class="btn btn-outline-secondary disabled">...</span>';
        }

        for (var i = start; i <= end; i++) {
            if (i === current) {
                html += '<button class="btn btn-primary user-page-btn" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button class="btn btn-outline-secondary user-page-btn" data-page="' + i + '">' + i + '</button>';
            }
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="btn btn-outline-secondary disabled">...</span>';
            html += '<button class="btn btn-outline-secondary user-page-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        if (current < pages) {
            html += '<button class="btn btn-outline-secondary user-page-btn" data-page="' + (current + 1) + '"><i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div></div>';
        $('#user-pagination').html(html);
    }

    function updateUsersOverviewCards() {
        renderOverviewCards([
            { label: '用户总数', value: userPageState.total || '-', icon: 'fas fa-users', tone: 'tone-info', note: '含所有未删除账号' },
            { label: '当前页码', value: userPageState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: userPageState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'user:manage', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    function openUserFormModal(userData) {
        $('#uf-error-msg').addClass('d-none').text('');
        if (userData && userData.id) {
            $('#user-form-label').text('编辑用户');
            $('#uf-id').val(userData.id);
            $('#uf-username').val(userData.username || '').prop('readonly', true);
            $('#uf-password-group').hide();
            $('#uf-password').removeAttr('required');
            $('#uf-nickname').val(userData.nickname || '');
            $('#uf-avatar').val(userData.avatar || '');
        } else {
            $('#user-form-label').text('新增用户');
            $('#uf-id').val('');
            $('#uf-username').val('').prop('readonly', false);
            $('#uf-password-group').show();
            $('#uf-password').attr('required', 'required');
            $('#uf-password').val('');
            $('#uf-nickname').val('');
            $('#uf-avatar').val('');
        }
        $('#user-form-modal').modal('show');
    }

    function submitUserForm() {
        var id = $('#uf-id').val();
        var nickname = $.trim($('#uf-nickname').val());
        var avatar = $.trim($('#uf-avatar').val());

        if (id) {
            if (!nickname) {
                showUfError('昵称不能为空');
                return;
            }
            $.ajax({
                url: '/api/users/' + id,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify({ nickname: nickname, avatar: avatar }),
                success: function (resp) {
                    if (!resp || Number(resp.code) !== 0) {
                        showUfError(resp ? resp.message : '编辑失败');
                        return;
                    }
                    $('#user-form-modal').modal('hide');
                    AppCommon.showToast('编辑成功', 'bg-success');
                    fetchUserPage();
                }
            });
        } else {
            var username = $.trim($('#uf-username').val());
            var password = $.trim($('#uf-password').val());

            if (!username) { showUfError('用户名不能为空'); return; }
            if (username.length < 2) { showUfError('用户名至少2个字符'); return; }
            if (!password) { showUfError('密码不能为空'); return; }
            if (password.length < 6) { showUfError('密码至少6个字符'); return; }
            if (!nickname) { showUfError('昵称不能为空'); return; }

            $.ajax({
                url: '/api/users',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ username: username, password: password, nickname: nickname, avatar: avatar }),
                success: function (resp) {
                    if (!resp || Number(resp.code) !== 0) {
                        showUfError(resp ? resp.message : '新增失败');
                        return;
                    }
                    $('#user-form-modal').modal('hide');
                    AppCommon.showToast('新增成功', 'bg-success');
                    userPageState.page = 1;
                    fetchUserPage();
                }
            });
        }
    }

    function showUfError(msg) {
        $('#uf-error-msg').removeClass('d-none').text(msg);
    }

    function openUserRoleModal(userId, displayName) {
        assignRoleState.pendingAssignUserId = userId;
        assignRoleState.pendingAssignUserName = displayName || '';
        assignRoleState.assignRoleIds = [];
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
            assignRoleState.assignRoleIds = userRoleIds;
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
            data: JSON.stringify({ userId: assignRoleState.pendingAssignUserId, roleIds: ids }),
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

    function toggleUserStatus(userId) {
        $.ajax({
            url: '/api/users/' + userId + '/status',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '操作失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('状态切换成功', 'bg-success');
                fetchUserPage();
            }
        });
    }

    function deleteUser(userId) {
        $.ajax({
            url: '/api/users/' + userId,
            method: 'DELETE',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('删除成功', 'bg-success');
                fetchUserPage();
            }
        });
    }

    window.AppUsers = {
        userPageState: userPageState,
        pendingDeleteUserId: pendingDeleteUserId,
        renderScene: renderUsersScene,
        renderUsersScene: renderUsersScene,
        bindUserEvents: bindUserEvents,
        fetchUserPage: fetchUserPage,
        renderUserTable: renderUserTable,
        renderUserPagination: renderUserPagination,
        updateUsersOverviewCards: updateUsersOverviewCards,
        openUserFormModal: openUserFormModal,
        submitUserForm: submitUserForm,
        showUfError: showUfError,
        openUserRoleModal: openUserRoleModal,
        submitUserRoleAssign: submitUserRoleAssign,
        toggleUserStatus: toggleUserStatus,
        deleteUser: deleteUser
    };
})(window, jQuery);
