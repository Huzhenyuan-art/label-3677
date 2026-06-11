(function (window, $) {
    'use strict';

    var overviewChart = null;
    var loginTrendChart = null;
    var cachedMenus = [];
    var currentOverview = null;
    var currentMenu = {
        title: '仪表盘',
        path: '/dashboard',
        permCode: 'dashboard:view'
    };

    var userPageState = {
        page: 1,
        size: 10,
        username: '',
        nickname: '',
        userStatus: null,
        total: 0,
        pages: 0
    };

    var menuManageState = {
        allMenus: [],
        expandedIds: {},
        pendingDeleteMenuId: null,
        pendingDeleteMenuTitle: '',
        searchKeyword: '',
        filteredMenus: [],
        allRoles: [],
        roleMenuMap: {}
    };

    var operationLogState = {
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

    var pendingDeleteUserId = null;
    var idleRemainingInterval = null;
    var tokenCountdownInterval = null;
    var overviewRefreshTimer = null;
    var OVERVIEW_REFRESH_INTERVAL = 30000;
    var TOKEN_WARNING_THRESHOLD = 300;
    var TOKEN_DANGER_THRESHOLD = 60;
    var tokenExpiredNotified = false;

    var onlineSessionState = {
        sessions: [],
        loading: false,
        pendingForceLogoutUserId: null,
        pendingForceLogoutUsername: '',
        refreshTimer: null,
        refreshInterval: 10000
    };

    var loginLogState = {
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

    function startIdleRemainingTimer() {
        stopIdleRemainingTimer();
        updateIdleRemainingText();
        idleRemainingInterval = setInterval(updateIdleRemainingText, 1000);
    }

    function stopIdleRemainingTimer() {
        if (idleRemainingInterval) {
            clearInterval(idleRemainingInterval);
            idleRemainingInterval = null;
        }
    }

    function updateIdleRemainingText() {
        var remainingEl = $('#idle-remaining-text');
        if (!remainingEl.length) {
            stopIdleRemainingTimer();
            return;
        }
        var remaining = AppCommon.getRemainingIdleTime();
        var minutes = Math.floor(remaining / 60);
        var seconds = remaining % 60;
        var text = '';
        if (minutes > 0) {
            text += minutes + ' 分 ';
        }
        text += seconds + ' 秒';
        remainingEl.text('距离自动锁屏还剩：' + text);
    }

    function saveIdleTimeout() {
        var selectVal = $('#idle-timeout-select').val();
        var seconds = parseInt(selectVal, 10);
        if (isNaN(seconds)) {
            AppCommon.showToast('请选择有效的超时时间', 'bg-warning');
            return;
        }
        var saved = AppCommon.setIdleTimeout(seconds);
        var minutes = Math.round(saved / 60);
        AppCommon.showToast('空闲超时已设置为 ' + minutes + ' 分钟', 'bg-success');
        updateIdleRemainingText();
    }

    function startTokenCountdown() {
        stopTokenCountdown();
        updateTokenCountdownText();
        tokenCountdownInterval = setInterval(updateTokenCountdownText, 1000);
    }

    function stopTokenCountdown() {
        if (tokenCountdownInterval) {
            clearInterval(tokenCountdownInterval);
            tokenCountdownInterval = null;
        }
    }

    function updateTokenCountdownText() {
        var countdownEl = $('#token-countdown');
        var textEl = $('#token-countdown-text');
        if (!textEl.length) {
            stopTokenCountdown();
            return;
        }

        var remaining = AppCommon.getRemainingTokenTime();
        if (remaining <= 0) {
            stopTokenCountdown();
            textEl.text('已过期');
            countdownEl.removeClass('token-warning token-danger').addClass('token-expired');
            if (!tokenExpiredNotified) {
                tokenExpiredNotified = true;
                handleTokenExpired();
            }
            return;
        }

        var hours = Math.floor(remaining / 3600);
        var minutes = Math.floor((remaining % 3600) / 60);
        var seconds = remaining % 60;
        var text = '';
        if (hours > 0) {
            text += hours + ' 时 ';
        }
        if (minutes > 0 || hours > 0) {
            text += minutes + ' 分 ';
        }
        text += seconds + ' 秒';
        textEl.text(text);

        countdownEl.removeClass('token-warning token-danger token-expired');
        if (remaining <= TOKEN_DANGER_THRESHOLD) {
            countdownEl.addClass('token-danger');
        } else if (remaining <= TOKEN_WARNING_THRESHOLD) {
            countdownEl.addClass('token-warning');
        }
    }

    function handleTokenExpired() {
        AppCommon.showToast('登录令牌已过期，请重新登录', 'bg-warning');
        AppCommon.stopIdleMonitoring();
        stopIdleRemainingTimer();
        stopTokenCountdown();
        stopOverviewRefresh();
        stopOnlineSessionRefresh();
        AppCommon.clearAuth();
        setTimeout(AppCommon.redirectToLogin, 800);
    }

    $(function () {
        try {
            AppCommon.hideLoading();

            var token = localStorage.getItem(AppCommon.STORAGE_KEYS.TOKEN);
            if (!token) {
                AppCommon.redirectToLogin();
                return;
            }

            if (AppCommon.isTokenExpired()) {
                AppCommon.clearAuth();
                AppCommon.redirectToLogin();
                return;
            }

            restoreSidebarCollapsedState();

            AppCommon.setupAjax();
            bindEvents();
            bindSidebarStateEvents();
            loadBaseData();
            startIdleMonitor();
            startTokenCountdown();

            window.AppDashboard = {
                showLockScreen: showLockScreen
            };
        } catch (err) {
            AppCommon.hideLoading();
            console.error('App init failed:', err);
            AppCommon.showToast('页面初始化失败，请按 Ctrl+F5 强制刷新', 'bg-danger');
        }
    });

    function startIdleMonitor() {
        AppCommon.startIdleMonitoring(function () {
            var lockScreen = $('#lock-screen');
            if (lockScreen.hasClass('d-none')) {
                AppCommon.showToast('系统空闲超时，已自动锁定', 'bg-warning');
                showLockScreen();
            }
        });
    }

    function bindEvents() {
        $('#logout-btn').off('click pointerup').on('click pointerup', function (event) {
            event.preventDefault();
            $('#logout-confirm-modal').modal('show');
        });

        $(document).off('click.logout').on('click.logout', '#logout-btn', function (event) {
            event.preventDefault();
            $('#logout-confirm-modal').modal('show');
        });

        $(document).off('click.logoutConfirm').on('click.logoutConfirm', '#logout-confirm-btn', function () {
            $('#logout-confirm-modal').modal('hide');
            AppCommon.stopIdleMonitoring();
            stopIdleRemainingTimer();
            stopTokenCountdown();
            stopOverviewRefresh();
            stopOnlineSessionRefresh();
            localStorage.removeItem(AppCommon.STORAGE_KEYS.IDLE_TIMEOUT);
            localStorage.removeItem(AppCommon.STORAGE_KEYS.IDLE_LAST_ACTIVITY);
            AppCommon.clearAuth();
            AppCommon.showToast('已退出登录', 'bg-primary');
            setTimeout(AppCommon.redirectToLogin, 250);
        });

        $('#lock-btn').off('click pointerup').on('click pointerup', function (event) {
            event.preventDefault();
            showLockScreen();
        });

        $(document).off('click.lock').on('click.lock', '#lock-btn', function (event) {
            event.preventDefault();
            showLockScreen();
        });

        $('#unlock-form').on('submit', function (event) {
            event.preventDefault();
            unlockScreen();
        });

        $(document).off('click.changePassword').on('click.changePassword', '#change-password-btn', function () {
            resetChangePasswordForm();
            $('#change-password-modal').modal('show');
        });

        $('#change-password-form').off('submit.cp').on('submit.cp', function (event) {
            event.preventDefault();
            submitChangePassword();
        });
    }

    function showLockScreen() {
        var lockScreen = $('#lock-screen');
        if (!lockScreen.length) {
            AppCommon.showToast('锁屏组件未加载，请刷新页面', 'bg-danger');
            return;
        }
        var user = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        $('#lock-user').text(user.nickname || user.username || '管理员');
        $('#unlock-password').val('');
        lockScreen.removeClass('d-none');
        $('body').addClass('lock-mode');
        AppCommon.stopIdleMonitoring();
    }

    function loadBaseData() {
        renderUserFromStorage();
        renderMenusFromStorage();
        switchPanel(currentMenu);

        fetchMenus();
        fetchUser();
        fetchOverview();
    }

    function renderUserFromStorage() {
        var user = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        syncUserUI(user);
    }

    function syncUserUI(user) {
        var displayName = (user && (user.nickname || user.username)) || '管理员';
        $('#user-nickname').text(displayName);
        var avatarUrl = (user && user.avatar) || 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg';
        var sidebarAvatar = $('.user-panel .image img');
        if (sidebarAvatar.length) {
            sidebarAvatar.attr('src', avatarUrl);
        }
    }

    function renderMenusFromStorage() {
        var menus = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.MENUS), []);
        if (!Array.isArray(menus) || !menus.length) {
            return;
        }
        cachedMenus = menus;
        renderSidebarMenus(menus);
        syncActiveMenuByPath(currentMenu.path);
    }

    function fetchUser() {
        $.get('/api/auth/me', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !resp.data) {
                return;
            }
            localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data));
            syncUserUI(resp.data);
            if (currentMenu.path === '/profile') {
                renderProfileScene();
            }
        });
    }

    function fetchMenus() {
        $.get('/api/menus', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                return;
            }
            cachedMenus = resp.data;
            localStorage.setItem(AppCommon.STORAGE_KEYS.MENUS, JSON.stringify(resp.data));
            renderSidebarMenus(resp.data);
            syncActiveMenuByPath(currentMenu.path);
            if (currentMenu.path === '/menus') {
                fetchAllMenusForManage();
            }
        });
    }

    function fetchAllMenusForManage() {
        $.get('/api/menus/all', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                renderMenusScene();
                return;
            }
            menuManageState.allMenus = resp.data;
            renderMenusScene();
        }).fail(function () {
            menuManageState.allMenus = cachedMenus;
            renderMenusScene();
        });
    }

    function fetchOverview() {
        $.get('/api/dashboard/overview', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !resp.data) {
                AppCommon.showToast(resp ? resp.message : '加载仪表盘失败', 'bg-warning');
                return;
            }
            currentOverview = resp.data;
            if (currentMenu.path === '/dashboard') {
                renderDashboardScene();
            }
        });
    }

    function startOverviewRefresh() {
        stopOverviewRefresh();
        overviewRefreshTimer = setInterval(function () {
            refreshOverviewData();
        }, OVERVIEW_REFRESH_INTERVAL);
    }

    function stopOverviewRefresh() {
        if (overviewRefreshTimer) {
            clearInterval(overviewRefreshTimer);
            overviewRefreshTimer = null;
        }
    }

    function refreshOverviewData() {
        $.get('/api/dashboard/overview', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !resp.data) {
                return;
            }
            var prev = currentOverview;
            currentOverview = resp.data;
            if (currentMenu.path === '/dashboard') {
                smoothUpdateOverviewCards(currentOverview, prev);
                smoothUpdateChart(currentOverview);
                smoothUpdateDashboardPanel(currentOverview);
            }
        });
    }

    function renderSidebarMenus(menus) {
        var menuRoot = $('#sidebar-menu');
        menuRoot.empty();

        menus.forEach(function (menu) {
            if (Array.isArray(menu.children) && menu.children.length) {
                menuRoot.append(renderTreeMenu(menu));
            } else {
                menuRoot.append(renderSingleMenu(menu));
            }
        });

        restoreSidebarExpandedMenus();
    }

    function renderTreeMenu(menu) {
        var item = $('<li class="nav-item has-treeview"></li>');
        var menuIdentifier = (menu.path && menu.path !== '#') ? menu.path : ('__dir__' + (menu.id != null ? menu.id : menu.title));
        item.attr('data-menu-id', menuIdentifier);
        var link = $('<a href="#" class="nav-link"></a>');
        link.append('<i class="nav-icon ' + safeIcon(menu.icon) + '"></i>');
        link.append('<p>' + escapeHtml(menu.title) + '<i class="right fas fa-angle-left"></i></p>');
        item.append(link);

        var hasRealPath = menu.path && menu.path !== '#';
        if (hasRealPath) {
            link.attr('data-menu-path', menu.path);
            link.on('click', function (event) {
                event.preventDefault();
                setActiveMenu($(this));
                switchPanel(menu);
            });
        }

        var sub = $('<ul class="nav nav-treeview"></ul>');
        menu.children.forEach(function (child) {
            var subItem = $('<li class="nav-item"></li>');
            var subLink = $('<a href="#" class="nav-link"></a>');
            subLink.attr('data-menu-path', child.path || '');
            subLink.append('<i class="far fa-circle nav-icon"></i>');
            subLink.append('<p>' + escapeHtml(child.title) + '</p>');
            subLink.on('click', function (event) {
                event.preventDefault();
                setActiveMenu($(this));
                switchPanel(child);
            });
            subItem.append(subLink);
            sub.append(subItem);
        });

        item.append(sub);
        return item;
    }

    function renderSingleMenu(menu) {
        var item = $('<li class="nav-item"></li>');
        var link = $('<a href="#" class="nav-link"></a>');
        link.attr('data-menu-path', menu.path || '');
        link.append('<i class="nav-icon ' + safeIcon(menu.icon) + '"></i>');
        link.append('<p>' + escapeHtml(menu.title) + '</p>');
        link.on('click', function (event) {
            event.preventDefault();
            setActiveMenu($(this));
            switchPanel(menu);
        });
        item.append(link);
        return item;
    }

    function setActiveMenu(element) {
        $('#sidebar-menu .nav-link').removeClass('active');
        $('#sidebar-menu .nav-item').removeClass('menu-open');
        element.addClass('active');
        element.parents('.has-treeview').addClass('menu-open');
        restoreSidebarExpandedMenus();
    }

    function syncActiveMenuByPath(path) {
        var target = $('#sidebar-menu .nav-link[data-menu-path="' + path + '"]').first();
        if (!target.length) {
            return;
        }
        setActiveMenu(target);
    }

    function switchPanel(menu) {
        stopIdleRemainingTimer();
        stopOverviewRefresh();
        stopOnlineSessionRefresh();

        currentMenu = {
            title: menu && menu.title ? menu.title : '功能面板',
            path: normalizePath(menu && menu.path),
            permCode: menu && menu.permCode ? menu.permCode : '-'
        };

        $('#page-title').text(currentMenu.title);
        $('#page-subtitle').text(currentMenu.title);
        syncActiveMenuByPath(currentMenu.path);

        if (currentMenu.path === '/dashboard') {
            renderDashboardScene();
            startOverviewRefresh();
            return;
        }
        if (currentMenu.path === '/profile') {
            renderProfileScene();
            return;
        }
        if (currentMenu.path === '/menus') {
            renderMenusScene();
            return;
        }
        if (currentMenu.path === '/users') {
            renderUsersScene();
            return;
        }
        if (currentMenu.path === '/roles') {
            renderRolesScene();
            return;
        }
        if (currentMenu.path === '/operation-logs') {
            renderOperationLogsScene();
            return;
        }
        if (currentMenu.path === '/online-sessions') {
            renderOnlineSessionsScene();
            return;
        }
        if (currentMenu.path === '/login-logs') {
            renderLoginLogsScene();
            return;
        }

        renderGenericScene();
    }

    function renderDashboardScene() {
        var menuStats = buildMenuStats(cachedMenus);
        var overview = currentOverview || {};

        setHero(
            '系统总览',
            '实时监控平台核心指标，掌握用户、权限和在线状态。',
            ['实时视图', '关键指标', '运行态势']
        );

        renderOverviewCards([
            { label: '系统用户数', value: overview.userCount, icon: 'fas fa-users', tone: 'tone-info', note: '含管理员与业务账号' },
            { label: '菜单权限数', value: overview.menuCount || menuStats.total, icon: 'fas fa-list', tone: 'tone-success', note: '用于前端动态渲染' },
            { label: '在线会话数', value: overview.onlineSessions, icon: 'fas fa-signal', tone: 'tone-warning', note: '5 分钟内活跃会话' },
            { label: '服务器时间', value: formatTime(overview.serverTime), icon: 'far fa-clock', tone: 'tone-danger', note: '统一来自后端系统时钟' }
        ]);

        setPrimaryPanelTitle('系统趋势');
        $('#primary-panel-body').html(
            '<canvas id="overviewChart" height="180"></canvas>' +
            '<hr class="my-3">' +
            '<h6 class="font-weight-bold mb-2"><i class="fas fa-chart-line mr-1"></i>近七日登录趋势</h6>' +
            '<canvas id="loginTrendChart" height="200"></canvas>'
        );
        renderChart({
            userCount: Number(overview.userCount || 0),
            menuCount: Number(overview.menuCount || menuStats.total || 0),
            onlineSessions: Number(overview.onlineSessions || 0)
        });
        fetchAndRenderLoginTrend();

        $('#dynamic-panel-title').text('运行状态');
        renderDashboardPanel(overview, menuStats);
    }

    function renderProfileScene() {
        destroyOverviewChart();

        var user = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        var displayName = user.nickname || user.username || '管理员';

        setHero(
            '个人中心',
            '查看并编辑账号信息、安全状态与个人资料。',
            ['账户视图', '安全检查', '资料编辑']
        );

        renderOverviewCards([
            { label: '用户编号', value: user.id || '-', icon: 'far fa-id-card', tone: 'tone-info', note: '系统唯一标识' },
            { label: '登录账号', value: user.username || '-', icon: 'fas fa-user-shield', tone: 'tone-success', note: '用于登录认证' },
            { label: '展示昵称', value: displayName, icon: 'far fa-smile', tone: 'tone-warning', note: '可在右侧面板修改' },
            { label: '资料更新时间', value: formatTime(new Date().toISOString()), icon: 'far fa-calendar-check', tone: 'tone-danger', note: '当前页面刷新时间' }
        ]);

        setPrimaryPanelTitle('账号安全');
        $('#primary-panel-body').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>密码策略</span><span class="badge badge-soft-success">已启用</span></div>' +
            '<div class="status-item"><span>JWT 会话</span><span class="badge badge-soft-info">有效中</span></div>' +
            '<div class="status-item"><span>锁屏保护</span><span class="badge badge-soft-warning">可用</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">建议定期更新密码并开启更多认证策略，以提升账户安全等级。</div>'
        );

        $('#dynamic-panel-title').text('编辑个人资料');
        renderProfilePanel(user);
    }

    function renderUsersScene() {
        destroyOverviewChart();

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
            '<input type="text" id="us-username" class="form-control form-control-sm" placeholder="用户名" maxlength="64" value="' + escapeHtml(userPageState.username) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="us-nickname" class="form-control form-control-sm" placeholder="昵称" maxlength="64" value="' + escapeHtml(userPageState.nickname) + '">' +
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
                    rolesHtml += '<span class="badge badge-soft-info mr-1 mb-1">' + escapeHtml(r.roleName || r.roleCode) + '</span>';
                });
            } else {
                rolesHtml = '<span class="text-muted">未分配</span>';
            }

            html += '<tr data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" data-nickname="' + escapeHtml(u.nickname || '') + '" data-avatar="' + escapeHtml(u.avatar || '') + '">' +
                '<td>' + escapeHtml(String(u.id)) + '</td>' +
                '<td>' + escapeHtml(u.username || '-') + '</td>' +
                '<td>' + escapeHtml(u.nickname || '-') + '</td>' +
                '<td>' + rolesHtml + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(formatDatetime(u.createdAt)) + '</td>' +
                '<td>' + escapeHtml(formatDatetime(u.lastLoginAt)) + '</td>' +
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

    function formatDatetime(text) {
        if (!text) return '-';
        return String(text).replace('T', ' ').substring(0, 19);
    }

    function renderMenusScene() {
        destroyOverviewChart();
        bindMenuManageEvents();

        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : cachedMenus;
        var stats = buildMenuStats(menus);
        setHero(
            '菜单权限预览',
            '关键词检索菜单权限，支持过滤左侧树形与右侧权限矩阵，高亮匹配项。',
            ['只读预览', '关键词检索', '权限矩阵']
        );

        renderOverviewCards([
            { label: '菜单总数', value: stats.total, icon: 'fas fa-sitemap', tone: 'tone-info', note: '含目录与叶子菜单' },
            { label: '一级菜单', value: stats.rootCount, icon: 'fas fa-layer-group', tone: 'tone-success', note: '主导航入口数量' },
            { label: '末级菜单', value: stats.leafCount, icon: 'fas fa-stream', tone: 'tone-warning', note: '可直达页面节点' },
            { label: '最大层级', value: stats.maxDepth, icon: 'fas fa-project-diagram', tone: 'tone-danger', note: '当前菜单树深度' }
        ]);

        setPrimaryPanelTitle('菜单权限预览');
        renderMenuPreviewPanel(menus);

        $('#dynamic-panel-title').text('权限矩阵');
        loadRoleMenuMatrix();
    }

    function renderMenuPreviewPanel(menus) {
        var keyword = menuManageState.searchKeyword || '';
        var displayMenus = keyword ? menuManageState.filteredMenus : menus;

        var headerHtml = '' +
            '<div class="menu-preview-header mb-3">' +
            '<div class="d-flex flex-wrap align-items-center justify-content-between">' +
            '<div class="form-inline">' +
            '<div class="input-group input-group-sm mr-2 mb-2">' +
            '<div class="input-group-prepend">' +
            '<span class="input-group-text"><i class="fas fa-search"></i></span>' +
            '</div>' +
            '<input type="text" id="menu-search-input" class="form-control" placeholder="输入关键词搜索菜单名称、路径、权限码..." ' +
            'value="' + escapeHtml(keyword) + '" style="min-width: 320px;">' +
            '<div class="input-group-append"' + (keyword ? '' : ' style="display:none;"') + '>' +
            '<button type="button" id="menu-search-clear" class="btn btn-outline-secondary"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<span class="text-muted text-sm mb-2">只读预览模式，搜索不会修改任何菜单数据</span>' +
            '</div>' +
            '<span class="text-sm text-info mb-2 menu-search-count"' + (keyword ? '' : ' style="display:none;"') + '>' +
            '<i class="fas fa-filter mr-1"></i>找到 <span id="menu-search-count-num">' + (keyword ? countFilteredMenus(displayMenus) : 0) + '</span> 个匹配项' +
            '</span>' +
            '</div>' +
            '</div>';

        var treeHtml = '<div id="menu-preview-tree-container" class="menu-preview-tree" style="max-height: 500px; overflow-y: auto;">';
        if (!displayMenus || !displayMenus.length) {
            treeHtml += '<div class="text-center text-muted py-5">' + (keyword ? '未找到匹配的菜单' : '暂无菜单数据') + '</div>';
        } else {
            treeHtml += buildPreviewTreeHtml(displayMenus, 1, keyword);
        }
        treeHtml += '</div>';

        $('#primary-panel-body').html(headerHtml + treeHtml);
        bindMenuPreviewEvents();

        var $input = $('#menu-search-input');
        if ($input.length) {
            $input.focus();
            var inputEl = $input[0];
            if (inputEl.setSelectionRange && keyword) {
                var len = keyword.length;
                try { inputEl.setSelectionRange(len, len); } catch (e) {}
            }
        }
    }

    function refreshMenuPreviewTreeOnly() {
        var keyword = menuManageState.searchKeyword || '';
        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : cachedMenus;
        var displayMenus = keyword ? menuManageState.filteredMenus : menus;

        var treeHtml = '';
        if (!displayMenus || !displayMenus.length) {
            treeHtml = '<div class="text-center text-muted py-5">' + (keyword ? '未找到匹配的菜单' : '暂无菜单数据') + '</div>';
        } else {
            treeHtml = buildPreviewTreeHtml(displayMenus, 1, keyword);
        }

        var $container = $('#menu-preview-tree-container');
        if ($container.length) {
            $container.html(treeHtml);
        }

        var $clearBtn = $('#menu-search-clear');
        if ($clearBtn.length) {
            $clearBtn.closest('.input-group-append').toggle(!!keyword);
        }

        var $countWrap = $('.menu-search-count');
        if ($countWrap.length) {
            $countWrap.toggle(!!keyword);
            $('#menu-search-count-num').text(keyword ? countFilteredMenus(displayMenus) : 0);
        }
    }

    var menuSearchDebounceTimer = null;

    function bindMenuPreviewEvents() {
        $(document).off('input.menuSearch').on('input.menuSearch', '#menu-search-input', function () {
            var $input = $(this);
            var keyword = $.trim($input.val());
            menuManageState.searchKeyword = keyword;
            if (keyword) {
                menuManageState.filteredMenus = filterMenusByKeyword(menuManageState.allMenus.length ? menuManageState.allMenus : cachedMenus, keyword);
                expandAllForSearch(menuManageState.filteredMenus);
            } else {
                menuManageState.filteredMenus = [];
            }

            if (menuSearchDebounceTimer) {
                clearTimeout(menuSearchDebounceTimer);
            }
            menuSearchDebounceTimer = setTimeout(function () {
                refreshMenuPreviewTreeOnly();
                renderPermissionMatrix();
            }, 80);
        });

        $(document).off('click.menuSearchClear').on('click.menuSearchClear', '#menu-search-clear', function () {
            menuManageState.searchKeyword = '';
            menuManageState.filteredMenus = [];
            var $input = $('#menu-search-input');
            if ($input.length) {
                $input.val('').focus();
            }
            refreshMenuPreviewTreeOnly();
            renderPermissionMatrix();
        });

        $(document).off('click.menuPreviewToggle').on('click.menuPreviewToggle', '.menu-preview-toggle', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-preview-item');
            var id = Number(row.data('id'));
            menuManageState.expandedIds[id] = menuManageState.expandedIds[id] === false ? true : false;
            refreshMenuPreviewTreeOnly();
        });
    }

    function filterMenusByKeyword(nodes, keyword) {
        if (!keyword || !Array.isArray(nodes)) return [];
        var lowerKeyword = keyword.toLowerCase();

        function matchNode(node) {
            var title = (node.title || '').toLowerCase();
            var path = (node.path || '').toLowerCase();
            var permCode = (node.permCode || '').toLowerCase();
            return title.indexOf(lowerKeyword) !== -1 ||
                   path.indexOf(lowerKeyword) !== -1 ||
                   permCode.indexOf(lowerKeyword) !== -1;
        }

        function filterRecursive(list) {
            var result = [];
            list.forEach(function (node) {
                var newNode = Object.assign({}, node);
                var childrenMatch = [];
                if (Array.isArray(node.children) && node.children.length) {
                    childrenMatch = filterRecursive(node.children);
                }
                if (matchNode(node) || childrenMatch.length > 0) {
                    if (childrenMatch.length > 0) {
                        newNode.children = childrenMatch;
                    } else {
                        newNode.children = node.children;
                    }
                    result.push(newNode);
                }
            });
            return result;
        }

        return filterRecursive(nodes);
    }

    function expandAllForSearch(nodes) {
        if (!Array.isArray(nodes)) return;
        nodes.forEach(function (node) {
            menuManageState.expandedIds[node.id] = true;
            if (Array.isArray(node.children) && node.children.length) {
                expandAllForSearch(node.children);
            }
        });
    }

    function countFilteredMenus(nodes) {
        if (!Array.isArray(nodes)) return 0;
        var count = 0;
        nodes.forEach(function (node) {
            count++;
            if (Array.isArray(node.children) && node.children.length) {
                count += countFilteredMenus(node.children);
            }
        });
        return count;
    }

    function highlightText(text, keyword) {
        if (!keyword || !text) return escapeHtml(text);
        var lowerText = text.toLowerCase();
        var lowerKeyword = keyword.toLowerCase();
        var index = lowerText.indexOf(lowerKeyword);
        if (index === -1) return escapeHtml(text);

        var result = '';
        var lastIndex = 0;
        while (index !== -1) {
            result += escapeHtml(text.substring(lastIndex, index));
            result += '<mark class="search-highlight">' + escapeHtml(text.substring(index, index + keyword.length)) + '</mark>';
            lastIndex = index + keyword.length;
            index = lowerText.indexOf(lowerKeyword, lastIndex);
        }
        result += escapeHtml(text.substring(lastIndex));
        return result;
    }

    function buildPreviewTreeHtml(nodes, depth, keyword) {
        if (!Array.isArray(nodes) || !nodes.length) return '';
        var html = '<ul class="menu-preview-list">';
        nodes.forEach(function (node) {
            var hasChildren = Array.isArray(node.children) && node.children.length > 0;
            var isExpanded = menuManageState.expandedIds[node.id] !== false;
            var visibleBadge = node.visible === 0
                ? '<span class="badge badge-soft-warning ml-2">已隐藏</span>'
                : '';
            var indent = (depth - 1) * 20;

            html += '<li class="menu-preview-item" data-id="' + node.id + '" data-parent-id="' + (node.parentId || 0) + '">' +
                '<div class="menu-preview-row" style="padding-left:' + indent + 'px;">' +
                '<span class="menu-preview-toggle">';
            if (hasChildren) {
                html += '<i class="fas ' + (isExpanded ? 'fa-chevron-down' : 'fa-chevron-right') + ' text-muted"></i>';
            } else {
                html += '<span class="menu-preview-placeholder"></span>';
            }
            html += '</span>' +
                '<span class="menu-preview-icon"><i class="' + safeIcon(node.icon) + '"></i></span>' +
                '<span class="menu-preview-title">' + highlightText(node.title || '-', keyword) + '</span>' +
                visibleBadge +
                '<span class="menu-preview-path ml-2">' + highlightText(node.path || '#', keyword) + '</span>' +
                '<span class="menu-preview-perm ml-2"><code>' + highlightText(node.permCode || '-', keyword) + '</code></span>' +
                '</div>';

            if (hasChildren && isExpanded) {
                html += buildPreviewTreeHtml(node.children, depth + 1, keyword);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function loadRoleMenuMatrix() {
        $('#dynamic-content').html('<div class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin mr-2"></i>加载权限矩阵中...</div>');

        $.when(
            $.get('/api/roles/list'),
            $.get('/api/menus/all')
        ).done(function (rolesResp, menusResp) {
            var roles = (rolesResp[0] && rolesResp[0].code === 0) ? rolesResp[0].data : [];
            var allMenus = (menusResp[0] && menusResp[0].code === 0) ? menusResp[0].data : [];

            menuManageState.allRoles = roles || [];
            if (!menuManageState.allMenus.length && allMenus.length) {
                menuManageState.allMenus = allMenus;
            }

            var roleRequests = roles.map(function (role) {
                return $.get('/api/roles/' + role.id + '/menus');
            });

            if (roleRequests.length === 0) {
                renderPermissionMatrix();
                return;
            }

            $.when.apply($, roleRequests).done(function () {
                var results = Array.prototype.slice.call(arguments);
                roles.forEach(function (role, index) {
                    var resp = results[index];
                    var menuIds = (resp && resp[0] && resp[0].code === 0) ? resp[0].data : [];
                    menuManageState.roleMenuMap[role.id] = {};
                    (menuIds || []).forEach(function (id) {
                        menuManageState.roleMenuMap[role.id][id] = true;
                    });
                });
                renderPermissionMatrix();
            }).fail(function () {
                $('#dynamic-content').html('<div class="text-center text-danger py-4">加载权限矩阵失败，请刷新页面重试</div>');
            });
        }).fail(function () {
            $('#dynamic-content').html('<div class="text-center text-danger py-4">加载角色数据失败，请刷新页面重试</div>');
        });
    }

    function renderPermissionMatrix() {
        var roles = menuManageState.allRoles || [];
        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : cachedMenus;
        var keyword = menuManageState.searchKeyword || '';
        var displayMenus = keyword ? menuManageState.filteredMenus : menus;

        if (!roles.length) {
            $('#dynamic-content').html('<div class="text-center text-muted py-4">暂无角色数据</div>');
            return;
        }

        var flatMenus = flattenMenusForMatrix(displayMenus);
        if (!flatMenus.length) {
            $('#dynamic-content').html('<div class="text-center text-muted py-4">' + (keyword ? '未找到匹配的菜单权限' : '暂无菜单数据') + '</div>');
            return;
        }

        var html = '<div class="table-responsive" style="max-height: 500px; overflow-y: auto;">';
        html += '<table class="table table-sm table-bordered table-hover mb-0 permission-matrix-table">';
        html += '<thead class="thead-light sticky-top"><tr><th style="min-width: 180px;">菜单名称</th>';
        roles.forEach(function (role) {
            html += '<th class="text-center" style="min-width: 100px;">' + escapeHtml(role.roleName) + '</th>';
        });
        html += '</tr></thead><tbody>';

        flatMenus.forEach(function (menu) {
            var indent = Math.max((menu.depth - 1) * 14, 0);
            html += '<tr data-menu-id="' + menu.id + '">';
            html += '<td><span style="padding-left:' + indent + 'px;"><i class="' + safeIcon(menu.icon) + ' mr-1 text-muted"></i>' +
                highlightText(menu.title || '-', keyword) +
                '<div class="text-xs text-muted mt-1">权限码: ' + highlightText(menu.permCode || '-', keyword) + '</div>' +
                '</span></td>';
            roles.forEach(function (role) {
                var hasPermission = menuManageState.roleMenuMap[role.id] && menuManageState.roleMenuMap[role.id][menu.id];
                if (hasPermission) {
                    html += '<td class="text-center"><span class="text-success"><i class="fas fa-check-circle"></i></span></td>';
                } else {
                    html += '<td class="text-center"><span class="text-muted"><i class="far fa-circle"></i></span></td>';
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        html += '<div class="mt-2 text-muted text-sm"><i class="fas fa-info-circle mr-1"></i>权限矩阵为只读视图，展示各角色拥有的菜单权限。<span class="text-success"><i class="fas fa-check-circle"></i></span> 表示拥有权限，<span class="text-muted"><i class="far fa-circle"></i></span> 表示无权限。</div>';

        $('#dynamic-content').html(html);
    }

    function flattenMenusForMatrix(list, depth) {
        var out = [];
        var nextDepth = depth || 1;
        if (!Array.isArray(list)) return out;

        list.forEach(function (item) {
            var node = Object.assign({}, item, { depth: nextDepth });
            out.push(node);
            if (Array.isArray(item.children) && item.children.length) {
                out = out.concat(flattenMenusForMatrix(item.children, nextDepth + 1));
            }
        });

        return out;
    }

    function renderMenuManagePanel(menus) {
        var headerHtml = '' +
            '<div class="menu-manage-header mb-3">' +
            '<button type="button" id="menu-add-root-btn" class="btn btn-success btn-sm"><i class="fas fa-plus mr-1"></i>新增顶级菜单</button>' +
            '<span class="ml-3 text-muted text-sm">提示：点击菜单名称可展开/折叠子菜单</span>' +
            '</div>';

        var treeHtml = '<div class="menu-manage-tree">' + buildManageTreeHtml(menus, 1) + '</div>';
        $('#primary-panel-body').html(headerHtml + treeHtml);
    }

    function buildManageTreeHtml(nodes, depth) {
        if (!Array.isArray(nodes) || !nodes.length) {
            return '';
        }
        var html = '<ul class="menu-manage-list">';
        nodes.forEach(function (node) {
            var hasChildren = Array.isArray(node.children) && node.children.length > 0;
            var isExpanded = menuManageState.expandedIds[node.id] !== false;
            var visibleBadge = node.visible === 0
                ? '<span class="badge badge-soft-warning ml-2">已隐藏</span>'
                : '';
            var indent = (depth - 1) * 20;

            html += '<li class="menu-manage-item" data-id="' + node.id + '" data-parent-id="' + (node.parentId || 0) + '">' +
                '<div class="menu-manage-row" style="padding-left:' + indent + 'px;">' +
                '<span class="menu-manage-toggle">';
            if (hasChildren) {
                html += '<i class="fas ' + (isExpanded ? 'fa-chevron-down' : 'fa-chevron-right') + ' text-muted"></i>';
            } else {
                html += '<span class="menu-manage-placeholder"></span>';
            }
            html += '</span>' +
                '<span class="menu-manage-icon"><i class="' + safeIcon(node.icon) + '"></i></span>' +
                '<span class="menu-manage-title">' + escapeHtml(node.title || '-') + '</span>' +
                visibleBadge +
                '<span class="menu-manage-path ml-2">' + escapeHtml(node.path || '#') + '</span>' +
                '<span class="menu-manage-perm ml-2">' + escapeHtml(node.permCode || '-') + '</span>' +
                '<span class="menu-manage-actions ml-auto">' +
                '<button class="btn btn-sm btn-outline-success btn-menu-add-child mr-1" title="添加子菜单" data-id="' + node.id + '" data-title="' + escapeHtml(node.title || '') + '"><i class="fas fa-plus"></i></button>' +
                '<button class="btn btn-sm btn-outline-info btn-menu-edit mr-1" title="编辑"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-secondary btn-menu-move-up mr-1" title="上移"><i class="fas fa-arrow-up"></i></button>' +
                '<button class="btn btn-sm btn-outline-secondary btn-menu-move-down mr-1" title="下移"><i class="fas fa-arrow-down"></i></button>' +
                '<button class="btn btn-sm ' + (node.visible === 0 ? 'btn-outline-success' : 'btn-outline-warning') + ' btn-menu-toggle mr-1" title="' + (node.visible === 0 ? '显示' : '隐藏') + '"><i class="fas ' + (node.visible === 0 ? 'fa-eye' : 'fa-eye-slash') + '"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger btn-menu-delete" title="删除"><i class="fas fa-trash-alt"></i></button>' +
                '</span>' +
                '</div>';

            if (hasChildren && isExpanded) {
                html += buildManageTreeHtml(node.children, depth + 1);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function renderMenuManageHelpPanel() {
        var html = '' +
            '<div class="status-list">' +
            '<div class="status-item"><span>新增顶级菜单</span><span class="badge badge-soft-success">点击顶部按钮</span></div>' +
            '<div class="status-item"><span>新增子菜单</span><span class="badge badge-soft-info">点击父菜单 + 按钮</span></div>' +
            '<div class="status-item"><span>编辑菜单</span><span class="badge badge-soft-primary">修改名称/路径/权限</span></div>' +
            '<div class="status-item"><span>排序调整</span><span class="badge badge-soft-warning">上移 / 下移按钮</span></div>' +
            '<div class="status-item"><span>显示隐藏</span><span class="badge badge-soft-secondary">眼睛图标切换</span></div>' +
            '<div class="status-item"><span>删除菜单</span><span class="badge badge-soft-danger">无子菜单时可删</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">所有保存操作均会实时刷新侧边栏导航菜单，并与后端 perm_code 权限体系保持同步。</div>';
        $('#dynamic-content').html(html);
    }

    function bindMenuManageEvents() {
        $(document).off('click.menuAddRoot').on('click.menuAddRoot', '#menu-add-root-btn', function () {
            openMenuFormModal(null, 0, '顶级菜单');
        });

        $(document).off('click.menuAddChild').on('click.menuAddChild', '.btn-menu-add-child', function (e) {
            e.stopPropagation();
            var id = Number($(this).data('id'));
            var title = $(this).data('title') || '父级菜单';
            openMenuFormModal(null, id, title);
        });

        $(document).off('click.menuEdit').on('click.menuEdit', '.btn-menu-edit', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            var menuData = findMenuInTree(menuManageState.allMenus, id);
            if (menuData) {
                openMenuFormModal(menuData, menuData.parentId || 0, getMenuTitleById(menuManageState.allMenus, menuData.parentId));
            }
        });

        $(document).off('click.menuToggle').on('click.menuToggle', '.btn-menu-toggle', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            toggleMenuVisible(id);
        });

        $(document).off('click.menuDelete').on('click.menuDelete', '.btn-menu-delete', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            var title = row.find('.menu-manage-title').text();
            confirmDeleteMenu(id, title);
        });

        $(document).off('click.menuMoveUp').on('click.menuMoveUp', '.btn-menu-move-up', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            moveMenu(id, -1);
        });

        $(document).off('click.menuMoveDown').on('click.menuMoveDown', '.btn-menu-move-down', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            moveMenu(id, 1);
        });

        $(document).off('click.menuToggleExpand').on('click.menuToggleExpand', '.menu-manage-toggle', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            menuManageState.expandedIds[id] = menuManageState.expandedIds[id] === false ? true : false;
            renderMenusScene();
        });

        $(document).off('submit.menuForm').on('submit.menuForm', '#menu-form', function (e) {
            e.preventDefault();
            submitMenuForm();
        });

        $(document).off('click.menuDeleteConfirm').on('click.menuDeleteConfirm', '#menu-delete-confirm-btn', function () {
            if (menuManageState.pendingDeleteMenuId) {
                deleteMenu(menuManageState.pendingDeleteMenuId);
            }
            $('#menu-delete-modal').modal('hide');
            menuManageState.pendingDeleteMenuId = null;
        });
    }

    function getMenuTitleById(menus, id) {
        if (!id || id === 0) return '顶级菜单';
        var found = findMenuInTree(menus, id);
        return found ? found.title : '顶级菜单';
    }

    function findMenuInTree(menus, id) {
        if (!Array.isArray(menus)) return null;
        for (var i = 0; i < menus.length; i++) {
            if (menus[i].id === id) return menus[i];
            if (Array.isArray(menus[i].children)) {
                var found = findMenuInTree(menus[i].children, id);
                if (found) return found;
            }
        }
        return null;
    }

    function openMenuFormModal(menuData, parentId, parentTitle) {
        $('#mf-error-msg').addClass('d-none').text('');

        if (menuData && menuData.id) {
            $('#menu-form-label').text('编辑菜单');
            $('#mf-id').val(menuData.id);
            $('#mf-parent-id').val(menuData.parentId || 0);
            $('#mf-parent-title').val(getMenuTitleById(menuManageState.allMenus, menuData.parentId));
            $('#mf-title').val(menuData.title || '');
            $('#mf-path').val(menuData.path || '');
            $('#mf-icon').val(menuData.icon || '');
            $('#mf-perm-code').val(menuData.permCode || '');
            $('#mf-sort-order').val(menuData.sortOrder != null ? menuData.sortOrder : 1);
            $('#mf-visible').val(menuData.visible != null ? String(menuData.visible) : '1');
        } else {
            $('#menu-form-label').text('新增菜单');
            $('#mf-id').val('');
            $('#mf-parent-id').val(parentId || 0);
            $('#mf-parent-title').val(parentTitle || '顶级菜单');
            $('#mf-title').val('');
            $('#mf-path').val('');
            $('#mf-icon').val('');
            $('#mf-perm-code').val('');
            $('#mf-sort-order').val(1);
            $('#mf-visible').val('1');
        }
        $('#menu-form-modal').modal('show');
    }

    function showMfError(msg) {
        $('#mf-error-msg').removeClass('d-none').text(msg);
    }

    function submitMenuForm() {
        var id = $('#mf-id').val();
        var parentId = Number($('#mf-parent-id').val()) || 0;
        var title = $.trim($('#mf-title').val());
        var path = $.trim($('#mf-path').val());
        var icon = $.trim($('#mf-icon').val());
        var permCode = $.trim($('#mf-perm-code').val());
        var sortOrder = Number($('#mf-sort-order').val()) || 0;
        var visible = Number($('#mf-visible').val()) || 0;

        if (!title) { showMfError('菜单名称不能为空'); return; }
        if (!path) { showMfError('菜单路径不能为空'); return; }
        if (!permCode) { showMfError('权限码不能为空'); return; }

        var data = {
            parentId: parentId,
            title: title,
            path: path,
            icon: icon,
            permCode: permCode,
            sortOrder: sortOrder,
            visible: visible
        };

        var method, url;
        if (id) {
            method = 'PUT';
            url = '/api/menus/' + id;
        } else {
            method = 'POST';
            url = '/api/menus';
        }

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    showMfError(resp ? resp.message : '保存失败');
                    return;
                }
                $('#menu-form-modal').modal('hide');
                AppCommon.showToast(id ? '编辑成功' : '新增成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function toggleMenuVisible(id) {
        $.ajax({
            url: '/api/menus/' + id + '/visible',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '操作失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('状态切换成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function confirmDeleteMenu(id, title) {
        menuManageState.pendingDeleteMenuId = id;
        menuManageState.pendingDeleteMenuTitle = title || '';
        $('#menu-delete-body').text('确定要删除菜单「' + (title || '') + '」吗？请确保该菜单下没有子菜单。');
        $('#menu-delete-modal').modal('show');
    }

    function deleteMenu(id) {
        $.ajax({
            url: '/api/menus/' + id,
            method: 'DELETE',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('删除成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function moveMenu(id, direction) {
        var flat = flattenMenusWithSort(menuManageState.allMenus);
        var target = flat.find(function (m) { return m.id === id; });
        if (!target) return;

        var siblings = flat.filter(function (m) { return (m.parentId || 0) === (target.parentId || 0); });
        siblings.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });

        var idx = siblings.findIndex(function (m) { return m.id === id; });
        var swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= siblings.length) {
            AppCommon.showToast('已到边界，无法继续移动', 'bg-warning');
            return;
        }

        var swapWith = siblings[swapIdx];
        var items = [
            { id: id, sortOrder: swapWith.sortOrder },
            { id: swapWith.id, sortOrder: target.sortOrder }
        ];

        $.ajax({
            url: '/api/menus/sort',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ items: items }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '排序失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('排序更新成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function flattenMenusWithSort(list, parentId) {
        var out = [];
        if (!Array.isArray(list)) return out;
        list.forEach(function (item) {
            out.push({
                id: item.id,
                parentId: item.parentId || 0,
                sortOrder: item.sortOrder != null ? item.sortOrder : 0
            });
            if (Array.isArray(item.children) && item.children.length) {
                out = out.concat(flattenMenusWithSort(item.children, item.id));
            }
        });
        return out;
    }

    function refreshMenusAfterChange() {
        fetchMenus();
    }

    function renderGenericScene() {
        destroyOverviewChart();

        setHero(
            currentMenu.title || '功能页面',
            '当前菜单为占位业务页，可按真实场景继续扩展组件。',
            ['业务占位', currentMenu.path || '#', currentMenu.permCode || '-']
        );

        renderOverviewCards([
            { label: '当前路径', value: currentMenu.path || '-', icon: 'fas fa-link', tone: 'tone-info', note: '来自菜单配置 path' },
            { label: '权限标识', value: currentMenu.permCode || '-', icon: 'fas fa-key', tone: 'tone-success', note: '用于后端鉴权' },
            { label: '菜单名称', value: currentMenu.title || '-', icon: 'far fa-folder-open', tone: 'tone-warning', note: '当前选中菜单' },
            { label: '刷新时间', value: formatTime(new Date().toISOString()), icon: 'far fa-clock', tone: 'tone-danger', note: '页面本地渲染时间' }
        ]);

        setPrimaryPanelTitle('页面说明');
        $('#primary-panel-body').html(
            '<div class="text-muted mb-3">该页面目前使用通用业务模板，可在后续按模块增加查询表单、图表和数据表格。</div>' +
            '<ul class="mb-0 pl-3 text-sm">' +
            '<li>支持按权限码控制按钮可见性</li>' +
            '<li>支持按菜单路径接入独立接口</li>' +
            '<li>支持根据业务类型切换面板布局</li>' +
            '</ul>'
        );

        $('#dynamic-panel-title').text('功能面板');
        $('#dynamic-content').html(
            '<p class="text-muted mb-2">当前菜单路径：' + escapeHtml(currentMenu.path || '#') + '</p>' +
            '<p class="text-muted mb-0">权限标识：' + escapeHtml(currentMenu.permCode || '-') + '</p>'
        );
    }

    function setPrimaryPanelTitle(title) {
        $('#primary-panel-title').text(title || '主面板');
    }

    function setHero(title, desc, tags) {
        $('#scene-hero-title').text(title || '系统总览');
        $('#scene-hero-desc').text(desc || '欢迎使用管理控制台。');

        var tagHtml = '';
        (Array.isArray(tags) ? tags : []).forEach(function (tag) {
            if (!tag) {
                return;
            }
            tagHtml += '<span class="badge badge-light scene-tag-item mr-1 mb-1">' + escapeHtml(tag) + '</span>';
        });

        if (!tagHtml) {
            tagHtml = '<span class="badge badge-light scene-tag-item">默认视图</span>';
        }
        $('#scene-hero-tags').html(tagHtml);
    }

    function renderOverviewCards(cards) {
        var html = '';
        (Array.isArray(cards) ? cards : []).forEach(function (card) {
            var tone = card.tone || 'tone-info';
            html += '<div class="col-lg-3 col-6">' +
                '<div class="small-box ' + tone + ' shadow-sm">' +
                '<div class="inner">' +
                '<h3>' + escapeHtml(formatCardValue(card.value)) + '</h3>' +
                '<p>' + escapeHtml(card.label || '-') + '</p>' +
                '<div class="metric-caption">' + escapeHtml(card.note || '') + '</div>' +
                '</div>' +
                '<div class="icon"><i class="' + safeIcon(card.icon) + '"></i></div>' +
                '</div>' +
                '</div>';
        });

        if (!html) {
            html = '<div class="col-12"><div class="small-box tone-info"><div class="inner"><h3>-</h3><p>暂无数据</p></div></div></div>';
        }
        $('#overview-cards').html(html);
    }

    function smoothUpdateOverviewCards(overview, prev) {
        var menuStats = buildMenuStats(cachedMenus);
        var metrics = [
            { key: 'userCount', value: overview.userCount },
            { key: 'menuCount', value: overview.menuCount || menuStats.total },
            { key: 'onlineSessions', value: overview.onlineSessions },
            { key: 'serverTime', value: overview.serverTime }
        ];

        var $cards = $('#overview-cards .small-box');
        if (!$cards.length) {
            renderDashboardScene();
            return;
        }

        $cards.each(function (index) {
            if (index >= metrics.length) return;
            var metric = metrics[index];
            var $h3 = $(this).find('h3');
            var newValue = metric.key === 'serverTime'
                ? formatTime(metric.value)
                : formatCardValue(metric.value);

            var oldValue = metric.key === 'serverTime'
                ? formatTime(prev ? prev[metric.key] : null)
                : formatCardValue(prev ? prev[metric.key] : null);

            if (newValue !== oldValue) {
                $h3.addClass('metric-value-updating');
                $h3.text(newValue);
                setTimeout(function () {
                    $h3.removeClass('metric-value-updating');
                }, 500);
            }
        });
    }

    function smoothUpdateChart(overview) {
        if (!overviewChart) return;
        var menuStats = buildMenuStats(cachedMenus);
        overviewChart.data.datasets[0].data = [
            Number(overview.userCount || 0),
            Number(overview.menuCount || menuStats.total || 0),
            Number(overview.onlineSessions || 0)
        ];
        overviewChart.update('none');
    }

    function smoothUpdateDashboardPanel(overview) {
        var menuStats = buildMenuStats(cachedMenus);
        var $items = $('#dynamic-content .status-item strong');
        var values = [
            formatCardValue(overview.userCount),
            formatCardValue(overview.menuCount || menuStats.total),
            formatCardValue(overview.onlineSessions)
        ];
        $items.each(function (index) {
            if (index >= values.length) return;
            var $strong = $(this);
            var newText = values[index];
            if ($strong.text() !== newText) {
                $strong.addClass('metric-value-updating');
                $strong.text(newText);
                setTimeout(function () {
                    $strong.removeClass('metric-value-updating');
                }, 500);
            }
        });
    }

    function renderDashboardPanel(overview, menuStats) {
        var html = '' +
            '<div class="status-list">' +
            '<div class="status-item"><span>用户规模</span><strong>' + escapeHtml(formatCardValue(overview.userCount)) + '</strong></div>' +
            '<div class="status-item"><span>权限资源</span><strong>' + escapeHtml(formatCardValue(overview.menuCount || menuStats.total)) + '</strong></div>' +
            '<div class="status-item"><span>在线会话</span><strong>' + escapeHtml(formatCardValue(overview.onlineSessions)) + '</strong></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">后端已启用 JWT 鉴权、Redis 会话与登录限流策略。</div>';

        $('#dynamic-content').html(html);
    }

    function renderProfilePanel(user) {
        var avatarUrl = user.avatar || 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg';
        var currentTimeout = AppCommon.getIdleTimeout();
        var timeoutMinutes = Math.round(currentTimeout / 60);
        var html = '' +
            '<div class="text-center mb-3">' +
            '<img id="profile-avatar-preview" src="' + escapeHtml(avatarUrl) + '" class="img-circle elevation-2" width="80" height="80" alt="avatar" onerror="this.src=\'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg\'">' +
            '</div>' +
            '<form id="profile-form" novalidate>' +
            '<div class="form-group">' +
            '<label for="profile-nickname">昵称</label>' +
            '<input id="profile-nickname" type="text" class="form-control" maxlength="64" placeholder="请输入昵称" value="' + escapeHtml(user.nickname || '') + '" required>' +
            '<small class="form-text text-muted">昵称将显示在侧边栏与页面各处</small>' +
            '</div>' +
            '<div class="form-group">' +
            '<label for="profile-avatar">头像链接</label>' +
            '<input id="profile-avatar" type="url" class="form-control" maxlength="255" placeholder="请输入头像图片URL" value="' + escapeHtml(user.avatar || '') + '">' +
            '<small class="form-text text-muted">输入图片链接后，上方将实时预览头像效果</small>' +
            '</div>' +
            '<button id="profile-save-btn" type="submit" class="btn btn-primary btn-block py-2 font-weight-bold">保存修改</button>' +
            '</form>' +
            '<hr class="my-4">' +
            '<div class="idle-timeout-config">' +
            '<h6 class="font-weight-bold mb-3">自动锁屏设置</h6>' +
            '<div class="form-group">' +
            '<label for="idle-timeout-select">空闲超时时间</label>' +
            '<select id="idle-timeout-select" class="form-control">' +
            '<option value="60"' + (currentTimeout === 60 ? ' selected' : '') + '>1 分钟</option>' +
            '<option value="180"' + (currentTimeout === 180 ? ' selected' : '') + '>3 分钟</option>' +
            '<option value="300"' + (currentTimeout === 300 ? ' selected' : '') + '>5 分钟（默认）</option>' +
            '<option value="600"' + (currentTimeout === 600 ? ' selected' : '') + '>10 分钟</option>' +
            '<option value="900"' + (currentTimeout === 900 ? ' selected' : '') + '>15 分钟</option>' +
            '<option value="1800"' + (currentTimeout === 1800 ? ' selected' : '') + '>30 分钟</option>' +
            '<option value="3600"' + (currentTimeout === 3600 ? ' selected' : '') + '>60 分钟</option>' +
            '</select>' +
            '<small class="form-text text-muted">系统在指定时间内无操作将自动锁定，需输入密码解锁。</small>' +
            '</div>' +
            '<div class="idle-timeout-status text-muted text-sm mb-3">' +
            '<i class="fas fa-clock mr-1"></i>' +
            '<span id="idle-remaining-text">距离自动锁屏还剩：--</span>' +
            '</div>' +
            '<button id="idle-timeout-save-btn" type="button" class="btn btn-outline-primary btn-block py-2">保存超时设置</button>' +
            '</div>';
        $('#dynamic-content').html(html);

        $('#profile-avatar').off('input.profileAvatar').on('input.profileAvatar', function () {
            var url = $.trim($(this).val());
            var preview = $('#profile-avatar-preview');
            if (url) {
                preview.attr('src', url);
            } else {
                preview.attr('src', 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg');
            }
        });

        $('#profile-form').off('submit.profileSave').on('submit.profileSave', function (event) {
            event.preventDefault();
            saveProfile();
        });

        $('#idle-timeout-save-btn').off('click.idleSave').on('click.idleSave', function () {
            saveIdleTimeout();
        });

        startIdleRemainingTimer();
    }

    function saveProfile() {
        var nickname = $.trim($('#profile-nickname').val());
        var avatar = $.trim($('#profile-avatar').val());

        if (!nickname) {
            AppCommon.showToast('昵称不能为空', 'bg-warning');
            return;
        }

        $('#profile-save-btn').prop('disabled', true).text('保存中...');

        $.ajax({
            url: '/api/auth/profile',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ nickname: nickname, avatar: avatar }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    AppCommon.showToast(resp ? resp.message : '保存失败', 'bg-danger');
                    return;
                }
                localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data));
                syncUserUI(resp.data);
                var newAvatar = resp.data.avatar || 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg';
                $('#profile-avatar-preview').attr('src', newAvatar);
                AppCommon.showToast('资料更新成功', 'bg-success');
            },
            complete: function () {
                AppCommon.hideLoading();
                $('#profile-save-btn').prop('disabled', false).text('保存修改');
            }
        });
    }

    function renderMenusPanel(stats) {
        var rows = flattenMenus(cachedMenus);
        if (!rows.length) {
            $('#dynamic-content').html('<p class="text-muted mb-0">暂无菜单数据</p>');
            return;
        }

        var coverage = stats.total ? Math.round((stats.permCount / stats.total) * 100) : 0;
        var html = '' +
            '<div class="mb-2 text-muted text-sm">权限覆盖率：' + coverage + '%（' + stats.permCount + '/' + stats.total + '）</div>' +
            '<div class="table-responsive"><table class="table table-sm table-hover mb-0">' +
            '<thead><tr><th>层级</th><th>菜单名</th><th>路径</th><th>权限码</th></tr></thead><tbody>';

        rows.forEach(function (menu) {
            var indent = Math.max((menu.depth - 1) * 14, 0);
            html += '<tr>' +
                '<td>' + escapeHtml(String(menu.depth || 1)) + '</td>' +
                '<td><span class="menu-depth-label" style="padding-left:' + indent + 'px;">' + escapeHtml(menu.title || '-') + '</span></td>' +
                '<td>' + escapeHtml(menu.path || '-') + '</td>' +
                '<td>' + escapeHtml(menu.permCode || '-') + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        $('#dynamic-content').html(html);
    }

    function renderMenuTreePanel(menus) {
        if (!Array.isArray(menus) || !menus.length) {
            return '<p class="text-muted mb-0">暂无菜单树数据</p>';
        }
        return '<div class="menu-tree-panel">' + buildTreeHtml(menus) + '</div>';
    }

    function buildTreeHtml(nodes) {
        var html = '<ul class="menu-tree-list">';
        nodes.forEach(function (node) {
            html += '<li>' +
                '<div class="menu-tree-node">' +
                '<span class="menu-tree-title">' + escapeHtml(node.title || '-') + '</span>' +
                '<span class="menu-tree-path">' + escapeHtml(node.path || '#') + '</span>' +
                '</div>';
            if (Array.isArray(node.children) && node.children.length) {
                html += buildTreeHtml(node.children);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function flattenMenus(list, depth) {
        var out = [];
        var nextDepth = depth || 1;
        if (!Array.isArray(list)) {
            return out;
        }

        list.forEach(function (item) {
            var node = Object.assign({}, item, { depth: nextDepth });
            out.push(node);
            if (Array.isArray(item.children) && item.children.length) {
                out = out.concat(flattenMenus(item.children, nextDepth + 1));
            }
        });

        return out;
    }

    function buildMenuStats(list) {
        var rows = flattenMenus(list);
        var rootCount = Array.isArray(list) ? list.length : 0;
        var leafCount = rows.filter(function (item) {
            return !Array.isArray(item.children) || !item.children.length;
        }).length;
        var maxDepth = rows.reduce(function (max, item) {
            return Math.max(max, Number(item.depth || 1));
        }, 1);
        var permCount = rows.filter(function (item) {
            return !!item.permCode;
        }).length;

        return {
            total: rows.length,
            rootCount: rootCount,
            leafCount: leafCount,
            maxDepth: maxDepth,
            permCount: permCount
        };
    }

    function unlockScreen() {
        var password = $('#unlock-password').val();
        if (!password) {
            AppCommon.showToast('请输入解锁密码', 'bg-warning');
            return;
        }

        $.ajax({
            url: '/api/auth/unlock',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ password: password }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '解锁失败', 'bg-danger');
                    return;
                }
                $('#lock-screen').addClass('d-none');
                $('body').removeClass('lock-mode');
                AppCommon.showToast('解锁成功', 'bg-success');
                startIdleMonitor();
                if (currentMenu) {
                    switchPanel(currentMenu);
                }
            }
        });
    }

    function resetChangePasswordForm() {
        $('#cp-old-password').val('');
        $('#cp-new-password').val('');
        $('#cp-confirm-password').val('');
        $('#cp-submit-btn').prop('disabled', false).text('确认修改');
        $('#cp-error-msg').addClass('d-none').text('');
    }

    function showCpError(msg) {
        $('#cp-error-msg').removeClass('d-none').text(msg);
    }

    function submitChangePassword() {
        var oldPassword = $.trim($('#cp-old-password').val());
        var newPassword = $.trim($('#cp-new-password').val());
        var confirmPassword = $.trim($('#cp-confirm-password').val());

        if (!oldPassword) {
            showCpError('请输入旧密码');
            return;
        }
        if (!newPassword) {
            showCpError('请输入新密码');
            return;
        }
        if (newPassword.length < 8) {
            showCpError('新密码长度不能少于8位');
            return;
        }
        if (!/[a-z]/.test(newPassword)) {
            showCpError('新密码须包含小写字母');
            return;
        }
        if (!/[A-Z]/.test(newPassword)) {
            showCpError('新密码须包含大写字母');
            return;
        }
        if (!/\d/.test(newPassword)) {
            showCpError('新密码须包含数字');
            return;
        }
        if (newPassword !== confirmPassword) {
            showCpError('两次输入的新密码不一致');
            return;
        }

        $('#cp-error-msg').addClass('d-none');
        $('#cp-submit-btn').prop('disabled', true).text('提交中...');

        $.ajax({
            url: '/api/auth/password',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                oldPassword: oldPassword,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    showCpError(resp ? resp.message : '修改失败');
                    return;
                }
                if (resp.data && resp.data.token) {
                    localStorage.setItem(AppCommon.STORAGE_KEYS.TOKEN, resp.data.token);
                }
                if (resp.data && resp.data.user) {
                    localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data.user));
                    syncUserUI(resp.data.user);
                }
                $('#change-password-modal').modal('hide');
                AppCommon.showToast('密码修改成功，其他设备已下线', 'bg-success');
            },
            error: function (xhr) {
                var response = xhr.responseJSON;
                if (response && response.message) {
                    showCpError(response.message);
                } else {
                    showCpError('请求失败，请稍后重试');
                }
            },
            complete: function () {
                AppCommon.hideLoading();
                $('#cp-submit-btn').prop('disabled', false).text('确认修改');
            }
        });
    }

    function destroyOverviewChart() {
        if (overviewChart) {
            overviewChart.destroy();
            overviewChart = null;
        }
        destroyLoginTrendChart();
    }

    function destroyLoginTrendChart() {
        if (loginTrendChart) {
            loginTrendChart.destroy();
            loginTrendChart = null;
        }
    }

    function renderChart(data) {
        var context = document.getElementById('overviewChart');
        if (!context) {
            return;
        }

        destroyOverviewChart();

        overviewChart = new Chart(context, {
            type: 'bar',
            data: {
                labels: ['用户数', '菜单数', '在线会话'],
                datasets: [{
                    label: '系统指标',
                    data: [data.userCount, data.menuCount, data.onlineSessions],
                    backgroundColor: ['#6c87b5', '#5c9d84', '#b48a52'],
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: 'rgba(15, 23, 42, 0.08)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function normalizePath(path) {
        if (!path || path === '#') {
            return '/dashboard';
        }
        return path;
    }

    function formatTime(timeText) {
        if (!timeText) {
            return '--:--';
        }
        var normalized = String(timeText).replace('T', ' ');
        return normalized.length > 16 ? normalized.substring(11, 16) : normalized;
    }

    function formatCardValue(value) {
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        return String(value);
    }

    function safeIcon(iconClass) {
        return iconClass && iconClass.trim() ? iconClass : 'fas fa-circle';
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function saveSidebarCollapsedState(collapsed) {
        localStorage.setItem(AppCommon.STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed ? '1' : '0');
    }

    function restoreSidebarCollapsedState() {
        var stored = localStorage.getItem(AppCommon.STORAGE_KEYS.SIDEBAR_COLLAPSED);
        if (stored === '1') {
            $('body').addClass('sidebar-collapse');
        } else if (stored === '0') {
            $('body').removeClass('sidebar-collapse');
        }
    }

    function getSidebarExpandedMenuPaths() {
        var stored = localStorage.getItem(AppCommon.STORAGE_KEYS.SIDEBAR_EXPANDED_MENUS);
        return AppCommon.parseJson(stored, []);
    }

    function saveSidebarExpandedMenuPaths(paths) {
        localStorage.setItem(AppCommon.STORAGE_KEYS.SIDEBAR_EXPANDED_MENUS, JSON.stringify(paths));
    }

    function collectExpandedMenuPaths() {
        var ids = [];
        $('#sidebar-menu .has-treeview').each(function () {
            var item = $(this);
            var submenu = item.children('.nav-treeview');
            var isExpanded = submenu.length && submenu.css('display') !== 'none';
            if (isExpanded) {
                var menuId = item.attr('data-menu-id');
                if (menuId) {
                    ids.push(menuId);
                }
            }
        });
        return ids;
    }

    function restoreSidebarExpandedMenus() {
        var expandedIds = getSidebarExpandedMenuPaths();
        if (!Array.isArray(expandedIds) || expandedIds.length === 0) {
            return;
        }
        expandedIds.forEach(function (menuId) {
            var item = $('#sidebar-menu .has-treeview[data-menu-id="' + menuId + '"]').first();
            if (item.length) {
                item.addClass('menu-open');
                var submenu = item.children('.nav-treeview');
                if (submenu.length) {
                    submenu.css('display', 'block');
                }
            }
        });
    }

    function bindSidebarStateEvents() {
        $(document).off('collapsed.lte.pushmenu').on('collapsed.lte.pushmenu', function () {
            saveSidebarCollapsedState(true);
        });
        $(document).off('expanded.lte.pushmenu').on('expanded.lte.pushmenu', function () {
            saveSidebarCollapsedState(false);
        });

        $('body').on('collapsed.lte.pushmenu', function () {
            saveSidebarCollapsedState(true);
        });
        $('body').on('expanded.lte.pushmenu', function () {
            saveSidebarCollapsedState(false);
        });

        $(document).off('click.sidebarToggle').on('click.sidebarToggle', '[data-widget=\"pushmenu\"]', function () {
            setTimeout(function () {
                var isCollapsed = $('body').hasClass('sidebar-collapse');
                saveSidebarCollapsedState(isCollapsed);
            }, 150);
        });

        $(document).on('click', '#sidebar-menu .has-treeview > .nav-link', function (e) {
            setTimeout(function () {
                var paths = collectExpandedMenuPaths();
                saveSidebarExpandedMenuPaths(paths);
            }, 350);
        });
    }

    function renderOperationLogsScene() {
        destroyOverviewChart();
        bindOperationLogEvents();

        setHero(
            '操作日志',
            '查看系统所有操作记录，支持按操作人、时间范围、操作模块筛选查询。',
            ['审计追踪', '操作回溯', '安全监控']
        );

        renderOverviewCards([
            { label: '日志总数', value: operationLogState.total || '-', icon: 'fas fa-clipboard-list', tone: 'tone-info', note: '系统所有操作记录' },
            { label: '当前页码', value: operationLogState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: operationLogState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'operationLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        setPrimaryPanelTitle('操作日志列表');
        var today = new Date();
        var todayStr = today.toISOString().split('T')[0];
        var weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        var weekAgoStr = weekAgo.toISOString().split('T')[0];

        var searchHtml = '' +
            '<div class="operation-log-search-bar">' +
            '<form id="operation-log-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="ols-username" class="form-control form-control-sm" placeholder="操作人用户名" maxlength="64" value="' + escapeHtml(operationLogState.operatorUsername) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ols-module" class="form-control form-control-sm">' +
            '<option value="">全部模块</option>' +
            '<option value="用户管理"' + (operationLogState.operationModule === '用户管理' ? ' selected' : '') + '>用户管理</option>' +
            '<option value="菜单管理"' + (operationLogState.operationModule === '菜单管理' ? ' selected' : '') + '>菜单管理</option>' +
            '<option value="认证管理"' + (operationLogState.operationModule === '认证管理' ? ' selected' : '') + '>认证管理</option>' +
            '<option value="个人中心"' + (operationLogState.operationModule === '个人中心' ? ' selected' : '') + '>个人中心</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="ols-success" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (operationLogState.success === 1 ? ' selected' : '') + '>成功</option>' +
            '<option value="0"' + (operationLogState.success === 0 ? ' selected' : '') + '>失败</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">开始时间:</label>' +
            '<input type="datetime-local" id="ols-start-time" class="form-control form-control-sm" value="' + escapeHtml(operationLogState.startTime || '') + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">结束时间:</label>' +
            '<input type="datetime-local" id="ols-end-time" class="form-control form-control-sm" value="' + escapeHtml(operationLogState.endTime || '') + '">' +
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

        fetchOperationLogPage();
    }

    function bindOperationLogEvents() {
        $(document).off('submit.operationLogSearch').on('submit.operationLogSearch', '#operation-log-search-form', function (e) {
            e.preventDefault();
            operationLogState.operatorUsername = $.trim($('#ols-username').val());
            operationLogState.operationModule = $('#ols-module').val();
            var successVal = $('#ols-success').val();
            operationLogState.success = successVal !== '' ? Number(successVal) : null;
            operationLogState.startTime = $('#ols-start-time').val() ? $('#ols-start-time').val().replace('T', ' ') + ':00' : '';
            operationLogState.endTime = $('#ols-end-time').val() ? $('#ols-end-time').val().replace('T', ' ') + ':00' : '';
            operationLogState.page = 1;
            fetchOperationLogPage();
        });

        $(document).off('click.operationLogReset').on('click.operationLogReset', '#ols-reset-btn', function () {
            operationLogState.operatorUsername = '';
            operationLogState.operationModule = '';
            operationLogState.success = null;
            operationLogState.startTime = '';
            operationLogState.endTime = '';
            operationLogState.page = 1;
            $('#ols-username').val('');
            $('#ols-module').val('');
            $('#ols-success').val('');
            $('#ols-start-time').val('');
            $('#ols-end-time').val('');
            fetchOperationLogPage();
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
            showOperationLogDetail(logData);
        });

        $(document).off('click.operationLogPage').on('click.operationLogPage', '.operation-log-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= operationLogState.pages) {
                operationLogState.page = p;
                fetchOperationLogPage();
            }
        });
    }

    function fetchOperationLogPage() {
        var params = { page: operationLogState.page, size: operationLogState.size };
        if (operationLogState.operatorUsername) params.operatorUsername = operationLogState.operatorUsername;
        if (operationLogState.operationModule) params.operationModule = operationLogState.operationModule;
        if (operationLogState.success !== null) params.success = operationLogState.success;
        if (operationLogState.startTime) params.startTime = operationLogState.startTime;
        if (operationLogState.endTime) params.endTime = operationLogState.endTime;

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
                operationLogState.total = page.total || 0;
                operationLogState.pages = page.pages || 0;
                renderOperationLogTable(page.records || []);
                renderOperationLogPagination();
                updateOperationLogOverviewCards();
            }
        });
    }

    function renderOperationLogTable(records) {
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

    function renderOperationLogPagination() {
        var total = operationLogState.total;
        var pages = operationLogState.pages;
        var current = operationLogState.page;

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

    function updateOperationLogOverviewCards() {
        renderOverviewCards([
            { label: '日志总数', value: operationLogState.total || '-', icon: 'fas fa-clipboard-list', tone: 'tone-info', note: '系统所有操作记录' },
            { label: '当前页码', value: operationLogState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: operationLogState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'operationLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

    function showOperationLogDetail(log) {
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

    function renderRolesScene() {
        destroyOverviewChart();
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
            '<input type="text" id="rs-role-code" class="form-control form-control-sm" placeholder="角色编码" maxlength="64" value="' + escapeHtml(rolePageState.roleCode) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="rs-role-name" class="form-control form-control-sm" placeholder="角色名称" maxlength="64" value="' + escapeHtml(rolePageState.roleName) + '">' +
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
                ' data-role-code="' + escapeHtml(r.roleCode || '') + '"' +
                ' data-role-name="' + escapeHtml(r.roleName || '') + '"' +
                ' data-description="' + escapeHtml(r.description || '') + '"' +
                ' data-sort-order="' + (r.sortOrder != null ? r.sortOrder : 0) + '"' +
                ' data-role-status="' + (r.roleStatus != null ? r.roleStatus : 1) + '">' +
                '<td>' + escapeHtml(String(r.id)) + '</td>' +
                '<td><code>' + escapeHtml(r.roleCode || '-') + '</code></td>' +
                '<td>' + escapeHtml(r.roleName || '-') + '</td>' +
                '<td>' + escapeHtml(r.description || '-') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(String(r.sortOrder != null ? r.sortOrder : 0)) + '</td>' +
                '<td>' + escapeHtml(formatDatetime(r.createdAt)) + '</td>' +
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
        $('#rm-role-info').html('为角色「<strong>' + escapeHtml(roleName || '') + '</strong>分配菜单权限');
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
                '<i class="' + safeIcon(node.icon) + ' mr-1 text-muted" style="width: 18px;"></i>' +
                escapeHtml(node.title || '-') +
                '<span class="text-muted ml-2 text-sm">(' + escapeHtml(node.permCode || '-') + ')</span>' +
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
        $('#ur-user-info').html('为用户「<strong>' + escapeHtml(displayName || '') + '</strong>分配角色');
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
                '<strong>' + escapeHtml(role.roleName) + '</strong>' +
                '<code class="ml-2 text-muted">' + escapeHtml(role.roleCode) + '</code>' +
                statusBadge +
                (role.description ? '<div class="text-muted text-sm mt-1 ml-4">' + escapeHtml(role.description) + '</div>' : '') +
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

    function renderOnlineSessionsScene() {
        destroyOverviewChart();
        bindOnlineSessionEvents();

        setHero(
            '在线会话',
            '实时查看当前在线用户列表，支持强制下线指定会话，管理系统访问安全。',
            ['实时监控', '会话管理', '强制下线']
        );

        renderOverviewCards([
            { label: '在线用户数', value: onlineSessionState.sessions.length || '-', icon: 'fas fa-users', tone: 'tone-info', note: '当前活跃会话数' },
            { label: '刷新间隔', value: (onlineSessionState.refreshInterval / 1000) + ' 秒', icon: 'fas fa-sync-alt', tone: 'tone-success', note: '自动刷新频率' },
            { label: '权限标识', value: 'session:view', icon: 'fas fa-key', tone: 'tone-warning', note: '查看权限' },
            { label: '管理权限', value: 'session:manage', icon: 'fas fa-user-shield', tone: 'tone-danger', note: '强制下线权限' }
        ]);

        setPrimaryPanelTitle('在线用户列表');

        var headerHtml = '' +
            '<div class="d-flex flex-wrap align-items-center justify-content-between mb-3">' +
            '<div class="d-flex align-items-center">' +
            '<button type="button" id="session-refresh-btn" class="btn btn-primary btn-sm mr-2">' +
            '<i class="fas fa-sync-alt mr-1"></i>刷新' +
            '</button>' +
            '<span class="text-muted text-sm">' +
            '<i class="fas fa-info-circle mr-1"></i>' +
            '数据每 ' + (onlineSessionState.refreshInterval / 1000) + ' 秒自动刷新' +
            '</span>' +
            '</div>' +
            '<span class="text-sm text-info">' +
            '<i class="fas fa-circle text-success mr-1"></i>' +
            '共 <span id="session-count">' + onlineSessionState.sessions.length + '</span> 个在线会话' +
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

        fetchOnlineSessions();
        startOnlineSessionRefresh();
    }

    function bindOnlineSessionEvents() {
        $(document).off('click.sessionRefresh').on('click.sessionRefresh', '#session-refresh-btn', function () {
            fetchOnlineSessions();
        });

        $(document).off('click.forceLogout').on('click.forceLogout', '.btn-force-logout', function () {
            var row = $(this).closest('tr');
            var userId = row.data('user-id');
            var username = row.data('username');
            confirmForceLogout(userId, username);
        });

        $(document).off('click.forceLogoutConfirm').on('click.forceLogoutConfirm', '#force-logout-confirm-btn', function () {
            if (onlineSessionState.pendingForceLogoutUserId) {
                forceLogoutSession(onlineSessionState.pendingForceLogoutUserId);
            }
            $('#force-logout-modal').modal('hide');
            onlineSessionState.pendingForceLogoutUserId = null;
            onlineSessionState.pendingForceLogoutUsername = '';
        });
    }

    function fetchOnlineSessions() {
        if (onlineSessionState.loading) {
            return;
        }
        onlineSessionState.loading = true;

        $.ajax({
            url: '/api/sessions/online',
            method: 'GET',
            skipGlobalLoading: true,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                    AppCommon.showToast(resp ? resp.message : '加载在线会话失败', 'bg-warning');
                    return;
                }
                onlineSessionState.sessions = resp.data;
                renderOnlineSessionTable(resp.data);
                updateSessionOverviewCards();
                updateSessionCount();
                updateDashboardOnlineCount(resp.data.length);

                if (currentOverview) {
                    currentOverview.onlineSessions = resp.data.length;
                }
            },
            error: function () {
                $('#session-table-container').html(
                    '<div class="text-center text-danger py-4">加载失败，请点击刷新按钮重试</div>'
                );
            },
            complete: function () {
                onlineSessionState.loading = false;
            }
        });
    }

    function renderOnlineSessionTable(sessions) {
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

    function updateSessionOverviewCards() {
        if (currentMenu.path !== '/online-sessions') {
            return;
        }
        renderOverviewCards([
            { label: '在线用户数', value: onlineSessionState.sessions.length, icon: 'fas fa-users', tone: 'tone-info', note: '当前活跃会话数' },
            { label: '刷新间隔', value: (onlineSessionState.refreshInterval / 1000) + ' 秒', icon: 'fas fa-sync-alt', tone: 'tone-success', note: '自动刷新频率' },
            { label: '权限标识', value: 'session:view', icon: 'fas fa-key', tone: 'tone-warning', note: '查看权限' },
            { label: '管理权限', value: 'session:manage', icon: 'fas fa-user-shield', tone: 'tone-danger', note: '强制下线权限' }
        ]);
    }

    function updateSessionCount() {
        $('#session-count').text(onlineSessionState.sessions.length);
    }

    function updateDashboardOnlineCount(count) {
        if (currentMenu.path === '/dashboard' && currentOverview) {
            currentOverview.onlineSessions = count;
            smoothUpdateOverviewCards(currentOverview, currentOverview);
            smoothUpdateChart(currentOverview);
            smoothUpdateDashboardPanel(currentOverview);
        }
    }

    function confirmForceLogout(userId, username) {
        onlineSessionState.pendingForceLogoutUserId = userId;
        onlineSessionState.pendingForceLogoutUsername = username || '';
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
                fetchOnlineSessions();
            },
            error: function () {
                AppCommon.showToast('强制下线失败，请稍后重试', 'bg-danger');
            }
        });
    }

    function startOnlineSessionRefresh() {
        stopOnlineSessionRefresh();
        onlineSessionState.refreshTimer = setInterval(function () {
            if (currentMenu.path === '/online-sessions') {
                fetchOnlineSessions();
            }
        }, onlineSessionState.refreshInterval);
    }

    function stopOnlineSessionRefresh() {
        if (onlineSessionState.refreshTimer) {
            clearInterval(onlineSessionState.refreshTimer);
            onlineSessionState.refreshTimer = null;
        }
    }

    function fetchAndRenderLoginTrend() {
        $.get('/api/login-logs/trend', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                return;
            }
            var context = document.getElementById('loginTrendChart');
            if (!context) {
                return;
            }
            destroyLoginTrendChart();

            var labels = [];
            var successData = [];
            var failData = [];
            resp.data.forEach(function (item) {
                labels.push(item.date ? item.date.substring(5) : '');
                successData.push(Number(item.successCount || 0));
                failData.push(Number(item.failCount || 0));
            });

            loginTrendChart = new Chart(context, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '登录成功',
                            data: successData,
                            borderColor: '#5c9d84',
                            backgroundColor: 'rgba(92,157,132,0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: '登录失败',
                            data: failData,
                            borderColor: '#e05555',
                            backgroundColor: 'rgba(224,85,85,0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 },
                            grid: { color: 'rgba(15, 23, 42, 0.08)' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        });
    }

    function renderLoginLogsScene() {
        destroyOverviewChart();
        bindLoginLogEvents();

        setHero(
            '登录日志',
            '查看系统登录记录，支持按用户名、IP、状态与时间范围筛选，可导出 CSV。',
            ['安全审计', '登录追踪', 'CSV导出']
        );

        renderOverviewCards([
            { label: '日志总数', value: loginLogState.total || '-', icon: 'fas fa-sign-in-alt', tone: 'tone-info', note: '系统所有登录记录' },
            { label: '当前页码', value: loginLogState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: loginLogState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'loginLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);

        setPrimaryPanelTitle('登录日志列表');

        var searchHtml = '' +
            '<div class="login-log-search-bar">' +
            '<form id="login-log-search-form" class="form-inline" novalidate>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="lls-username" class="form-control form-control-sm" placeholder="用户名" maxlength="64" value="' + escapeHtml(loginLogState.username) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<select id="lls-status" class="form-control form-control-sm">' +
            '<option value="">全部状态</option>' +
            '<option value="1"' + (loginLogState.loginStatus === 1 ? ' selected' : '') + '>成功</option>' +
            '<option value="0"' + (loginLogState.loginStatus === 0 ? ' selected' : '') + '>失败</option>' +
            '</select>' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<input type="text" id="lls-ip" class="form-control form-control-sm" placeholder="来源IP" maxlength="64" value="' + escapeHtml(loginLogState.clientIp) + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">开始时间:</label>' +
            '<input type="datetime-local" id="lls-start-time" class="form-control form-control-sm" value="' + escapeHtml(loginLogState.startTime || '') + '">' +
            '</div>' +
            '<div class="form-group mr-2 mb-2">' +
            '<label class="mr-1 text-sm">结束时间:</label>' +
            '<input type="datetime-local" id="lls-end-time" class="form-control form-control-sm" value="' + escapeHtml(loginLogState.endTime || '') + '">' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-sm mr-2 mb-2"><i class="fas fa-search mr-1"></i>查询</button>' +
            '<button type="button" id="lls-reset-btn" class="btn btn-outline-secondary btn-sm mr-2 mb-2">重置</button>' +
            '<button type="button" id="lls-export-btn" class="btn btn-outline-success btn-sm mb-2"><i class="fas fa-file-csv mr-1"></i>导出CSV</button>' +
            '</form>' +
            '</div>' +
            '<div class="table-responsive" id="login-log-table-container"></div>' +
            '<div id="login-log-pagination" class="login-log-pagination-bar"></div>';
        $('#primary-panel-body').html(searchHtml);

        $('#dynamic-panel-title').text('操作说明');
        $('#dynamic-content').html(
            '<div class="status-list">' +
            '<div class="status-item"><span>用户名筛选</span><span class="badge badge-soft-success">按用户名模糊搜索</span></div>' +
            '<div class="status-item"><span>IP筛选</span><span class="badge badge-soft-info">按来源IP模糊搜索</span></div>' +
            '<div class="status-item"><span>状态筛选</span><span class="badge badge-soft-warning">成功/失败记录</span></div>' +
            '<div class="status-item"><span>时间筛选</span><span class="badge badge-soft-primary">支持自定义时间范围</span></div>' +
            '<div class="status-item"><span>CSV导出</span><span class="badge badge-soft-danger">按当前筛选条件导出</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">登录日志记录每次登录成败、来源IP与失败原因，便于安全审计和异常追溯。</div>'
        );

        fetchLoginLogPage();
    }

    function bindLoginLogEvents() {
        $(document).off('submit.loginLogSearch').on('submit.loginLogSearch', '#login-log-search-form', function (e) {
            e.preventDefault();
            loginLogState.username = $.trim($('#lls-username').val());
            var statusVal = $('#lls-status').val();
            loginLogState.loginStatus = statusVal !== '' ? Number(statusVal) : null;
            loginLogState.clientIp = $.trim($('#lls-ip').val());
            loginLogState.startTime = $('#lls-start-time').val() ? $('#lls-start-time').val().replace('T', ' ') + ':00' : '';
            loginLogState.endTime = $('#lls-end-time').val() ? $('#lls-end-time').val().replace('T', ' ') + ':00' : '';
            loginLogState.page = 1;
            fetchLoginLogPage();
        });

        $(document).off('click.loginLogReset').on('click.loginLogReset', '#lls-reset-btn', function () {
            loginLogState.username = '';
            loginLogState.loginStatus = null;
            loginLogState.clientIp = '';
            loginLogState.startTime = '';
            loginLogState.endTime = '';
            loginLogState.page = 1;
            $('#lls-username').val('');
            $('#lls-status').val('');
            $('#lls-ip').val('');
            $('#lls-start-time').val('');
            $('#lls-end-time').val('');
            fetchLoginLogPage();
        });

        $(document).off('click.loginLogExport').on('click.loginLogExport', '#lls-export-btn', function () {
            var params = buildLoginLogExportParams();
            var queryParts = [];
            for (var key in params) {
                if (params.hasOwnProperty(key) && params[key] !== '' && params[key] !== null && params[key] !== undefined) {
                    queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
            }
            var url = '/api/login-logs/export' + (queryParts.length ? '?' + queryParts.join('&') : '');
            window.open(url, '_blank');
        });

        $(document).off('click.loginLogPage').on('click.loginLogPage', '.login-log-page-btn', function () {
            var p = Number($(this).data('page'));
            if (p >= 1 && p <= loginLogState.pages) {
                loginLogState.page = p;
                fetchLoginLogPage();
            }
        });
    }

    function buildLoginLogExportParams() {
        var params = {};
        if (loginLogState.username) params.username = loginLogState.username;
        if (loginLogState.loginStatus !== null) params.loginStatus = loginLogState.loginStatus;
        if (loginLogState.clientIp) params.clientIp = loginLogState.clientIp;
        if (loginLogState.startTime) params.startTime = loginLogState.startTime;
        if (loginLogState.endTime) params.endTime = loginLogState.endTime;
        return params;
    }

    function fetchLoginLogPage() {
        var params = { page: loginLogState.page, size: loginLogState.size };
        if (loginLogState.username) params.username = loginLogState.username;
        if (loginLogState.loginStatus !== null) params.loginStatus = loginLogState.loginStatus;
        if (loginLogState.clientIp) params.clientIp = loginLogState.clientIp;
        if (loginLogState.startTime) params.startTime = loginLogState.startTime;
        if (loginLogState.endTime) params.endTime = loginLogState.endTime;

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
                loginLogState.total = page.total || 0;
                loginLogState.pages = page.pages || 0;
                renderLoginLogTable(page.records || []);
                renderLoginLogPagination();
                updateLoginLogOverviewCards();
            }
        });
    }

    function renderLoginLogTable(records) {
        if (!records.length) {
            $('#login-log-table-container').html('<div class="text-center text-muted py-4">暂无登录日志</div>');
            return;
        }

        var html = '<table class="table table-sm table-hover mb-0 login-log-table">' +
            '<thead><tr>' +
            '<th>ID</th><th>用户名</th><th>登录状态</th><th>来源IP</th><th>失败原因</th><th>登录时间</th>' +
            '</tr></thead><tbody>';

        records.forEach(function (log) {
            var statusBadge = log.loginStatus === 1
                ? '<span class="badge badge-soft-success">成功</span>'
                : '<span class="badge badge-soft-danger">失败</span>';

            html += '<tr>' +
                '<td>' + escapeHtml(String(log.id)) + '</td>' +
                '<td>' + escapeHtml(log.username || '-') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + escapeHtml(log.clientIp || '-') + '</td>' +
                '<td>' + (log.loginStatus === 0 ? escapeHtml(log.failReason || '-') : '<span class="text-muted">-</span>') + '</td>' +
                '<td>' + escapeHtml(formatDatetime(log.loginAt)) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        $('#login-log-table-container').html(html);
    }

    function renderLoginLogPagination() {
        var total = loginLogState.total;
        var pages = loginLogState.pages;
        var current = loginLogState.page;

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

    function updateLoginLogOverviewCards() {
        renderOverviewCards([
            { label: '日志总数', value: loginLogState.total || '-', icon: 'fas fa-sign-in-alt', tone: 'tone-info', note: '系统所有登录记录' },
            { label: '当前页码', value: loginLogState.page, icon: 'fas fa-file-alt', tone: 'tone-success', note: '分页查询' },
            { label: '每页条数', value: loginLogState.size, icon: 'fas fa-list-ol', tone: 'tone-warning', note: '默认每页10条' },
            { label: '权限标识', value: 'loginLog:view', icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
    }

})(window, jQuery);
