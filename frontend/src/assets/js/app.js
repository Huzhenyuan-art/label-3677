(function (window, $) {
    'use strict';

    var overviewChart = null;
    var loginTrendChart = null;
    var cachedMenus = [];
    var currentOverview = null;
    var dashboardRenderTimer = null;
    var loginTrendRequestId = 0;
    var loginTrendLoading = false;
    var currentMenu = {
        title: '仪表盘',
        path: '/dashboard',
        permCode: 'dashboard:view'
    };

    var idleRemainingInterval = null;
    var tokenCountdownInterval = null;
    var overviewRefreshTimer = null;
    var OVERVIEW_REFRESH_INTERVAL = 30000;
    var TOKEN_WARNING_THRESHOLD = 300;
    var TOKEN_DANGER_THRESHOLD = 60;
    var tokenExpiredNotified = false;

    function startIdleRemainingTimer() {
        if (window.AppProfile && typeof AppProfile.startIdleRemainingTimer === 'function') {
            AppProfile.startIdleRemainingTimer();
        }
    }

    function stopIdleRemainingTimer() {
        if (window.AppProfile && typeof AppProfile.stopIdleRemainingTimer === 'function') {
            AppProfile.stopIdleRemainingTimer();
        }
    }

    function updateIdleRemainingText() {
        if (window.AppProfile && typeof AppProfile.updateIdleRemainingText === 'function') {
            AppProfile.updateIdleRemainingText();
        }
    }

    function saveIdleTimeout() {
        if (window.AppProfile && typeof AppProfile.saveIdleTimeout === 'function') {
            AppProfile.saveIdleTimeout();
        }
    }

    function startTokenCountdown() {
        if (window.AppAuth && typeof AppAuth.startTokenCountdown === 'function') {
            AppAuth.startTokenCountdown();
        }
    }

    function stopTokenCountdown() {
        if (window.AppAuth && typeof AppAuth.stopTokenCountdown === 'function') {
            AppAuth.stopTokenCountdown();
        }
    }

    function handleTokenExpired() {
        AppCommon.stopIdleMonitoring();
        stopIdleRemainingTimer();
        stopOverviewRefresh();
        stopOnlineSessionRefresh();
        if (window.AppAuth && typeof AppAuth.handleTokenExpired === 'function') {
            AppAuth.handleTokenExpired();
        } else {
            AppCommon.showToast('登录令牌已过期，请重新登录', 'bg-warning');
            localStorage.removeItem(AppCommon.STORAGE_KEYS.LOCKED);
            AppCommon.clearAuth();
            setTimeout(AppCommon.redirectToLogin, 800);
        }
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
            bindGlobalEvents();
            bindSidebarStateEvents();
            loadBaseData();
            startIdleMonitor();
            startTokenCountdown();

            window.AppDashboard = window.AppDashboard || {};
            window.AppDashboard.showLockScreen = showLockScreen;

            var locked = localStorage.getItem(AppCommon.STORAGE_KEYS.LOCKED);
            if (locked === '1') {
                AppCommon.stopIdleMonitoring();
                showLockScreen();
            }
        } catch (err) {
            AppCommon.hideLoading();
            console.error('App init failed:', err);
            AppCommon.showToast('页面初始化失败，请按 Ctrl+F5 强制刷新', 'bg-danger');
        }
    });

    function startIdleMonitor() {
        if (window.AppProfile && typeof AppProfile.startIdleMonitor === 'function') {
            AppProfile.startIdleMonitor();
        } else {
            AppCommon.startIdleMonitoring(function () {
                var lockScreen = $('#lock-screen');
                if (lockScreen.hasClass('d-none')) {
                    AppCommon.showToast('系统空闲超时，已自动锁定', 'bg-warning');
                    showLockScreen();
                }
            });
        }
    }

    function bindGlobalEvents() {
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
            localStorage.removeItem(AppCommon.STORAGE_KEYS.LOCKED);
            AppCommon.clearAuth();
            AppCommon.showToast('已退出登录', 'bg-primary');
            setTimeout(AppCommon.redirectToLogin, 250);
        });

        $(document).off('click.lock').on('click.lock', '#lock-btn', function (event) {
            event.preventDefault();
            showLockScreen();
        });

        $(document).off('submit.unlockForm').on('submit.unlockForm', '#unlock-form', function (event) {
            event.preventDefault();
            unlockScreen();
        });

        $(document).off('click.changePassword').on('click.changePassword', '#change-password-btn', function () {
            resetChangePasswordForm();
            $('#change-password-modal').modal('show');
        });

        $(document).off('submit.changePassword').on('submit.changePassword', '#change-password-form', function (event) {
            event.preventDefault();
            submitChangePassword();
        });

        $(document).off('click.breadcrumbHome').on('click.breadcrumbHome', '#breadcrumb-home', function (event) {
            event.preventDefault();
            handleBreadcrumbClick('/dashboard');
        });

        $(document).off('click.breadcrumbLink').on('click.breadcrumbLink', '.breadcrumb-link', function (event) {
            event.preventDefault();
            var path = $(this).attr('data-menu-path');
            handleBreadcrumbClick(path);
        });

        $(document).off('click.saveIdleTimeout').on('click.saveIdleTimeout', '#save-idle-timeout-btn', function () {
            saveIdleTimeout();
        });
    }

    function showLockScreen() {
        if (window.AppProfile && typeof AppProfile.showLockScreen === 'function') {
            AppProfile.showLockScreen();
        }
    }

    function unlockScreen() {
        if (window.AppProfile && typeof AppProfile.unlockScreen === 'function') {
            AppProfile.unlockScreen();
        }
    }

    function resetChangePasswordForm() {
        if (window.AppProfile && typeof AppProfile.resetChangePasswordForm === 'function') {
            AppProfile.resetChangePasswordForm();
        }
    }

    function submitChangePassword() {
        if (window.AppProfile && typeof AppProfile.submitChangePassword === 'function') {
            AppProfile.submitChangePassword();
        }
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
        renderBreadcrumb(currentMenu);
    }

    function fetchUser() {
        $.get('/api/auth/me', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !resp.data) {
                return;
            }
            localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data));
            syncUserUI(resp.data);
            if (currentMenu.path === '/profile' && window.AppProfile && typeof AppProfile.renderScene === 'function') {
                AppProfile.renderScene();
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
            renderBreadcrumb(currentMenu);
            if (currentMenu.path === '/menus' && window.AppMenus && typeof AppMenus.refreshMenus === 'function') {
                AppMenus.refreshMenus();
            }
        });
    }

    function fetchOverview() {
        $.ajax({
            url: '/api/dashboard/overview',
            method: 'GET',
            timeout: 10000,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    if (resp && resp.message) {
                        AppCommon.showToast(resp.message, 'bg-warning');
                    }
                    if (currentMenu.path === '/dashboard') {
                        renderDashboardScene();
                    }
                    return;
                }
                currentOverview = resp.data;
                if (currentMenu.path === '/dashboard') {
                    renderDashboardScene();
                }
            },
            error: function () {
                if (currentMenu.path === '/dashboard') {
                    if (!currentOverview) {
                        renderDashboardScene();
                    }
                }
            }
        });
    }

    function startOverviewRefresh() {
        if (window.AppDashboard && typeof AppDashboard.startOverviewRefresh === 'function') {
            AppDashboard.startOverviewRefresh();
        }
    }

    function stopOverviewRefresh() {
        if (window.AppDashboard && typeof AppDashboard.stopOverviewRefresh === 'function') {
            AppDashboard.stopOverviewRefresh();
        }
    }

    function stopOnlineSessionRefresh() {
        if (window.AppOnlineSessions && typeof AppOnlineSessions.stopRefresh === 'function') {
            AppOnlineSessions.stopRefresh();
        }
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

    function findMenuChainByPath(path, menus, chain) {
        chain = chain || [];
        if (!Array.isArray(menus)) {
            return null;
        }
        for (var i = 0; i < menus.length; i++) {
            var menu = menus[i];
            var currentChain = chain.concat([menu]);
            if (menu.path === path) {
                return currentChain;
            }
            if (Array.isArray(menu.children) && menu.children.length) {
                var found = findMenuChainByPath(path, menu.children, currentChain);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function findMenuByPath(path, menus) {
        if (!Array.isArray(menus)) {
            return null;
        }
        for (var i = 0; i < menus.length; i++) {
            var menu = menus[i];
            if (menu.path === path) {
                return menu;
            }
            if (Array.isArray(menu.children) && menu.children.length) {
                var found = findMenuByPath(path, menu.children);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function renderBreadcrumb(menu) {
        var nav = $('#breadcrumb-nav');
        if (!nav.length) {
            return;
        }

        var targetPath = normalizePath(menu && menu.path);
        var chain = findMenuChainByPath(targetPath, cachedMenus) || [];

        var realChain = [];
        chain.forEach(function (item) {
            if (item.path && item.path !== '#') {
                realChain.push(item);
            }
        });

        if (realChain.length === 0 && menu) {
            realChain.push({
                title: menu.title || '功能页面',
                path: targetPath
            });
        }

        var html = '';
        html += '<li class="breadcrumb-item"><a href="#" id="breadcrumb-home" data-menu-path="/dashboard"><i class="fas fa-home mr-1"></i>首页</a></li>';

        if (realChain.length <= 1) {
            var singleTitle = realChain.length ? (realChain[0].title || '仪表盘') : (menu && menu.title ? menu.title : '仪表盘');
            html += '<li id="page-subtitle" class="breadcrumb-item active">' + escapeHtml(singleTitle) + '</li>';
        } else {
            for (var i = 0; i < realChain.length; i++) {
                var item = realChain[i];
                var isLast = (i === realChain.length - 1);
                if (isLast) {
                    html += '<li id="page-subtitle" class="breadcrumb-item active">' + escapeHtml(item.title || '-') + '</li>';
                } else {
                    var itemPath = normalizePath(item.path);
                    html += '<li class="breadcrumb-item"><a href="#" class="breadcrumb-link" data-menu-path="' + escapeHtml(itemPath) + '">' + escapeHtml(item.title || '-') + '</a></li>';
                }
            }
        }

        nav.html(html);
    }

    function handleBreadcrumbClick(path) {
        if (!path) {
            path = '/dashboard';
        }
        var targetMenu = findMenuByPath(path, cachedMenus);
        if (!targetMenu) {
            targetMenu = {
                title: '首页',
                path: '/dashboard',
                permCode: 'dashboard:view'
            };
        }
        switchPanel(targetMenu);
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
        renderBreadcrumb(menu);
        syncActiveMenuByPath(currentMenu.path);

        var moduleMap = {
            '/dashboard': { obj: window.AppDashboard, method: 'renderScene', postAction: startOverviewRefresh },
            '/profile': { obj: window.AppProfile, method: 'renderScene' },
            '/menus': { obj: window.AppMenus, method: 'renderScene' },
            '/users': { obj: window.AppUsers, method: 'renderScene' },
            '/roles': { obj: window.AppRoles, method: 'renderScene' },
            '/operation-logs': { obj: window.AppOperationLogs, method: 'renderScene' },
            '/online-sessions': { obj: window.AppOnlineSessions, method: 'renderScene' },
            '/login-logs': { obj: window.AppLoginLogs, method: 'renderScene' },
            '/notices': { obj: window.AppNotices, method: 'renderScene' },
            '/scheduled-tasks': { obj: window.AppScheduledTasks, method: 'renderScene' }
        };

        var module = moduleMap[currentMenu.path];
        if (module && module.obj && typeof module.obj[module.method] === 'function') {
            module.obj[module.method]();
            if (typeof module.postAction === 'function') {
                module.postAction();
            }
            return;
        }

        renderGenericScene();
    }

    function renderGenericScene() {
        setHero(
            currentMenu.title || '功能页面',
            '该功能正在开发中，敬请期待。',
            ['开发中', '敬请期待']
        );
        renderOverviewCards([
            { label: '页面路径', value: currentMenu.path, icon: 'fas fa-link', tone: 'tone-info', note: '当前访问路径' },
            { label: '权限标识', value: currentMenu.permCode, icon: 'fas fa-key', tone: 'tone-danger', note: '接口鉴权码' }
        ]);
        setPrimaryPanelTitle('页面内容');
        $('#primary-panel-body').html('<div class="text-center text-muted py-5"><i class="fas fa-tools fa-4x mb-3"></i><h5>功能开发中</h5><p class="text-sm">该模块正在紧张开发中，敬请期待。</p></div>');
        $('#dynamic-panel-title').text('说明');
        $('#dynamic-content').html('<div class="text-muted text-sm">如果您需要该功能，请联系系统管理员。</div>');
    }

    function setHero(title, subtitle, tags) {
        var heroSection = $('#hero-section');
        if (!heroSection.length) return;
        $('#hero-title').text(title || '');
        $('#hero-subtitle').text(subtitle || '');
        var tagContainer = $('#hero-tags');
        if (tagContainer.length) {
            tagContainer.empty();
            if (Array.isArray(tags) && tags.length) {
                tags.forEach(function (tag) {
                    tagContainer.append('<span class="badge badge-soft-primary mr-1">' + escapeHtml(tag) + '</span>');
                });
            }
        }
    }

    function setPrimaryPanelTitle(title) {
        $('#primary-panel-title').text(title || '');
    }

    function renderOverviewCards(cards) {
        var container = $('#overview-cards');
        if (!container.length || !Array.isArray(cards) || !cards.length) return;
        var html = '<div class="row">';
        cards.forEach(function (card) {
            html += '<div class="col-lg-3 col-6 mb-3">' +
                '<div class="overview-card ' + (card.tone || '') + '">' +
                '<div class="d-flex align-items-center">' +
                '<div class="overview-icon mr-3"><i class="' + (card.icon || 'fas fa-info-circle') + '"></i></div>' +
                '<div class="overview-content flex-grow-1">' +
                '<div class="overview-label text-sm text-muted">' + escapeHtml(card.label || '') + '</div>' +
                '<div class="overview-value font-weight-bold">' + (card.value != null ? escapeHtml(String(card.value)) : '-') + '</div>' +
                '<div class="overview-note text-xs text-muted">' + escapeHtml(card.note || '') + '</div>' +
                '</div></div></div></div>';
        });
        html += '</div>';
        container.html(html);
    }

    function destroyAllDashboardCharts() {
        if (overviewChart) {
            try { overviewChart.destroy(); } catch (e) {}
            overviewChart = null;
        }
        if (loginTrendChart) {
            try { loginTrendChart.destroy(); } catch (e) {}
            loginTrendChart = null;
        }
        clearDashboardRenderTimer();
        loginTrendLoading = false;
    }

    function clearDashboardRenderTimer() {
        if (dashboardRenderTimer) {
            clearTimeout(dashboardRenderTimer);
            dashboardRenderTimer = null;
        }
    }

    function renderDashboardScene() {
        var menuStats = buildMenuStats(cachedMenus);
        var overview = currentOverview || {};
        var hasData = currentOverview !== null;

        destroyAllDashboardCharts();

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

        var panelHtml = '' +
            '<div class="chart-wrapper chart-sm" id="overviewChartWrapper">' +
            '<canvas id="overviewChart"></canvas>' +
            '</div>' +
            '<hr class="chart-section-divider">' +
            '<div class="chart-section-title"><i class="fas fa-chart-line"></i>近七日登录趋势</div>' +
            '<div class="chart-wrapper chart-md" id="loginTrendChartWrapper">' +
            '<canvas id="loginTrendChart"></canvas>' +
            '<div class="chart-loading-mask" id="loginTrendLoading" style="display:none;">' +
            '<div class="spinner-border" role="status"></div>' +
            '</div>' +
            '</div>';

        $('#primary-panel-body').html(panelHtml);

        clearDashboardRenderTimer();
        dashboardRenderTimer = setTimeout(function () {
            dashboardRenderTimer = null;
            try {
                renderChart({
                    userCount: Number(overview.userCount || 0),
                    menuCount: Number(overview.menuCount || menuStats.total || 0),
                    onlineSessions: Number(overview.onlineSessions || 0)
                });
            } catch (e) {
                console.error('Failed to render overview chart:', e);
            }
            try {
                fetchAndRenderLoginTrend();
            } catch (e) {
                console.error('Failed to fetch login trend:', e);
            }
        }, hasData ? 0 : 50);

        $('#dynamic-panel-title').text('运行状态');
        renderDashboardPanel(overview, menuStats);
    }

    function renderChart(data) {
        var context = document.getElementById('overviewChart');
        if (!context) return;
        if (overviewChart) {
            try { overviewChart.destroy(); } catch (e) {}
        }
        overviewChart = new Chart(context, {
            type: 'bar',
            data: {
                labels: ['系统用户', '菜单权限', '在线会话'],
                datasets: [{
                    label: '数量',
                    data: [data.userCount, data.menuCount, data.onlineSessions],
                    backgroundColor: [
                        'rgba(92, 157, 132, 0.7)',
                        'rgba(66, 153, 225, 0.7)',
                        'rgba(237, 137, 54, 0.7)'
                    ],
                    borderColor: [
                        'rgba(92, 157, 132, 1)',
                        'rgba(66, 153, 225, 1)',
                        'rgba(237, 137, 54, 1)'
                    ],
                    borderWidth: 1
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

    function fetchAndRenderLoginTrend() {
        var context = document.getElementById('loginTrendChart');
        if (!context) return;
        if (currentMenu.path !== '/dashboard') return;

        var requestId = ++loginTrendRequestId;
        loginTrendLoading = true;

        var $loading = $('#loginTrendLoading');
        if ($loading.length) $loading.show();

        function isStale() {
            return requestId !== loginTrendRequestId || currentMenu.path !== '/dashboard';
        }

        function buildFallbackData() {
            var labels = [];
            var today = new Date();
            for (var i = 6; i >= 0; i--) {
                var d = new Date(today);
                d.setDate(today.getDate() - i);
                var mm = String(d.getMonth() + 1).padStart(2, '0');
                var dd = String(d.getDate()).padStart(2, '0');
                labels.push(mm + '-' + dd);
            }
            return {
                labels: labels,
                successData: [0, 0, 0, 0, 0, 0, 0],
                failData: [0, 0, 0, 0, 0, 0, 0]
            };
        }

        function renderChartData(labels, successData, failData) {
            if (isStale()) return;
            try {
                if (loginTrendChart) {
                    try { loginTrendChart.destroy(); } catch (e) {}
                }
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
            } catch (e) {
                console.error('Failed to render login trend chart:', e);
            } finally {
                if (!isStale()) {
                    loginTrendLoading = false;
                    if ($loading.length) $loading.hide();
                }
            }
        }

        $.ajax({
            url: '/api/login-logs/trend',
            method: 'GET',
            timeout: 10000,
            success: function (resp) {
                if (isStale()) return;
                var labels = [];
                var successData = [];
                var failData = [];
                if (resp && Number(resp.code) === 0 && Array.isArray(resp.data) && resp.data.length) {
                    resp.data.forEach(function (item) {
                        labels.push(item.date ? item.date.substring(5) : '');
                        successData.push(Number(item.successCount || 0));
                        failData.push(Number(item.failCount || 0));
                    });
                } else {
                    var fb = buildFallbackData();
                    labels = fb.labels;
                    successData = fb.successData;
                    failData = fb.failData;
                }
                renderChartData(labels, successData, failData);
            },
            error: function () {
                if (isStale()) return;
                var fb = buildFallbackData();
                renderChartData(fb.labels, fb.successData, fb.failData);
            }
        });
    }

    function smoothUpdateOverviewCards(curr, prev) {
        if (!window.AppDashboard || typeof AppDashboard.updateOverviewCards === 'function') {
            renderOverviewCards([
                { label: '系统用户数', value: curr.userCount, icon: 'fas fa-users', tone: 'tone-info', note: '含管理员与业务账号' },
                { label: '菜单权限数', value: curr.menuCount, icon: 'fas fa-list', tone: 'tone-success', note: '用于前端动态渲染' },
                { label: '在线会话数', value: curr.onlineSessions, icon: 'fas fa-signal', tone: 'tone-warning', note: '5 分钟内活跃会话' },
                { label: '服务器时间', value: formatTime(curr.serverTime), icon: 'far fa-clock', tone: 'tone-danger', note: '统一来自后端系统时钟' }
            ]);
        } else {
            AppDashboard.updateOverviewCards(curr, prev);
        }
    }

    function smoothUpdateChart(curr) {
        var context = document.getElementById('overviewChart');
        if (!context) return;
        renderChart({
            userCount: Number(curr.userCount || 0),
            menuCount: Number(curr.menuCount || 0),
            onlineSessions: Number(curr.onlineSessions || 0)
        });
    }

    function smoothUpdateDashboardPanel(curr) {
        renderDashboardPanel(curr, buildMenuStats(cachedMenus));
    }

    function renderDashboardPanel(overview, menuStats) {
        var html = '<div class="dashboard-stats">' +
            '<div class="stat-row"><span class="stat-label">总用户数</span><span class="stat-value">' + (overview.userCount || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">启用用户</span><span class="stat-value text-success">' + (overview.activeUserCount || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">禁用用户</span><span class="stat-value text-warning">' + (overview.disabledUserCount || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">总角色数</span><span class="stat-value">' + (overview.roleCount || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">总菜单数</span><span class="stat-value">' + (menuStats.total || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">今日登录</span><span class="stat-value text-info">' + (overview.todayLoginCount || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">今日操作</span><span class="stat-value text-primary">' + (overview.todayOperationCount || 0) + '</span></div>' +
            '</div>';
        $('#dynamic-content').html(html);
    }

    function buildMenuStats(menus) {
        var total = 0, visible = 0, hidden = 0;
        function count(nodes) {
            if (!Array.isArray(nodes)) return;
            nodes.forEach(function (n) {
                total++;
                if (n.visible === 0) hidden++;
                else visible++;
                if (Array.isArray(n.children) && n.children.length) count(n.children);
            });
        }
        count(menus || []);
        return {
            total: total,
            visible: visible,
            hidden: hidden,
            ratio: total > 0 ? Math.round((visible / total) * 100) + '%' : '0%'
        };
    }

    function restoreSidebarCollapsedState() {
        var collapsed = localStorage.getItem('sidebar_collapsed');
        if (collapsed === '1') {
            $('body').addClass('sidebar-collapse');
        } else {
            $('body').removeClass('sidebar-collapse');
        }
    }

    function bindSidebarStateEvents() {
        $('[data-widget="pushmenu"]').on('click', function () {
            setTimeout(function () {
                var isCollapsed = $('body').hasClass('sidebar-collapse');
                localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
            }, 50);
        });
    }

    function restoreSidebarExpandedMenus() {
        var expandedIds = localStorage.getItem('sidebar_expanded_menus');
        if (!expandedIds) return;
        try {
            var ids = JSON.parse(expandedIds);
            if (!Array.isArray(ids)) return;
            ids.forEach(function (id) {
                var item = $('[data-menu-id="' + id + '"]');
                if (item.length) item.addClass('menu-open');
            });
        } catch (e) {}
    }

    function normalizePath(path) {
        if (!path) return '/dashboard';
        path = String(path);
        if (path.charAt(0) !== '/') path = '/' + path;
        return path;
    }

    function safeIcon(icon) {
        if (!icon || typeof icon !== 'string') return 'fas fa-circle';
        if (/^[a-zA-Z0-9-_\s]+$/.test(icon)) return icon;
        return 'fas fa-circle';
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

    function formatTime(ts) {
        if (!ts) return '-';
        var d = new Date(ts);
        if (isNaN(d.getTime())) return '-';
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        var s = String(d.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
    }

    window.App = {
        getCurrentMenu: function () { return currentMenu; },
        getCachedMenus: function () { return cachedMenus; },
        getCurrentOverview: function () { return currentOverview; },
        switchPanel: switchPanel,
        setHero: setHero,
        setPrimaryPanelTitle: setPrimaryPanelTitle,
        renderOverviewCards: renderOverviewCards,
        destroyAllDashboardCharts: destroyAllDashboardCharts,
        showLockScreen: showLockScreen
    };

})(window, jQuery);
