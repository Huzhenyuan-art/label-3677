(function (window, $) {
    'use strict';

    var overviewChart = null;
    var loginTrendChart = null;
    var currentOverview = null;
    var dashboardRenderTimer = null;
    var loginTrendRequestId = 0;
    var loginTrendLoading = false;
    var overviewRefreshTimer = null;
    var currentMenu = {
        title: '仪表盘',
        path: '/dashboard',
        permCode: 'dashboard:view'
    };

    var OVERVIEW_REFRESH_INTERVAL = 30000;

    function setCurrentMenu(menu) {
        if (!menu) return;
        currentMenu = {
            title: menu.title || '功能面板',
            path: menu.path || '/dashboard',
            permCode: menu.permCode || '-'
        };
    }

    function getCurrentMenu() {
        return currentMenu;
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
        $.ajax({
            url: '/api/dashboard/overview',
            method: 'GET',
            timeout: 10000,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    return;
                }
                var prev = currentOverview;
                currentOverview = resp.data;
                if (currentMenu.path === '/dashboard') {
                    try {
                        smoothUpdateOverviewCards(currentOverview, prev);
                        smoothUpdateChart(currentOverview);
                        smoothUpdateDashboardPanel(currentOverview);
                        fetchAndRenderLoginTrend();
                    } catch (e) {
                        console.error('Failed to refresh dashboard:', e);
                    }
                }
            },
            error: function () {
                console.warn('Failed to fetch dashboard overview');
            }
        });
    }

    function destroyOverviewChart() {
        if (overviewChart) {
            try {
                overviewChart.destroy();
            } catch (e) {}
            overviewChart = null;
        }
    }

    function destroyLoginTrendChart() {
        if (loginTrendChart) {
            try {
                loginTrendChart.destroy();
            } catch (e) {}
            loginTrendChart = null;
        }
    }

    function clearDashboardRenderTimer() {
        if (dashboardRenderTimer) {
            clearTimeout(dashboardRenderTimer);
            dashboardRenderTimer = null;
        }
    }

    function destroyAllDashboardCharts() {
        destroyOverviewChart();
        destroyLoginTrendChart();
        clearDashboardRenderTimer();
        loginTrendRequestId++;
        loginTrendLoading = false;
    }

    function setHero(title, desc, tags) {
        $('#scene-hero-title').text(title || '系统总览');
        $('#scene-hero-desc').text(desc || '欢迎使用管理控制台。');

        var tagHtml = '';
        (Array.isArray(tags) ? tags : []).forEach(function (tag) {
            if (!tag) {
                return;
            }
            tagHtml += '<span class="badge badge-light scene-tag-item mr-1 mb-1">' + AppCommon.escapeHtml(tag) + '</span>';
        });

        if (!tagHtml) {
            tagHtml = '<span class="badge badge-light scene-tag-item">默认视图</span>';
        }
        $('#scene-hero-tags').html(tagHtml);
    }

    function setPrimaryPanelTitle(title) {
        $('#primary-panel-title').text(title || '主面板');
    }

    function renderOverviewCards(cards) {
        var html = '';
        (Array.isArray(cards) ? cards : []).forEach(function (card) {
            var tone = card.tone || 'tone-info';
            html += '<div class="col-lg-3 col-6">' +
                '<div class="small-box ' + tone + ' shadow-sm">' +
                '<div class="inner">' +
                '<h3>' + AppCommon.escapeHtml(AppCommon.formatCardValue(card.value)) + '</h3>' +
                '<p>' + AppCommon.escapeHtml(card.label || '-') + '</p>' +
                '<div class="metric-caption">' + AppCommon.escapeHtml(card.note || '') + '</div>' +
                '</div>' +
                '<div class="icon"><i class="' + AppCommon.safeIcon(card.icon) + '"></i></div>' +
                '</div>' +
                '</div>';
        });

        if (!html) {
            html = '<div class="col-12"><div class="small-box tone-info"><div class="inner"><h3>-</h3><p>暂无数据</p></div></div></div>';
        }
        $('#overview-cards').html(html);
    }

    function renderChart(data) {
        var context = document.getElementById('overviewChart');
        if (!context) {
            return;
        }

        destroyOverviewChart();

        var safeData = data || {};
        var userCount = Number(safeData.userCount || 0);
        var menuCount = Number(safeData.menuCount || 0);
        var onlineSessions = Number(safeData.onlineSessions || 0);

        try {
            overviewChart = new Chart(context, {
                type: 'bar',
                data: {
                    labels: ['用户数', '菜单数', '在线会话'],
                    datasets: [{
                        label: '系统指标',
                        data: [userCount, menuCount, onlineSessions],
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
        } catch (e) {
            console.error('Failed to create overview chart:', e);
        }
    }

    function smoothUpdateOverviewCards(overview, prev) {
        var cachedMenus = (window.AppLayout && window.AppLayout.getCachedMenus) ? window.AppLayout.getCachedMenus() : [];
        var menuStats = AppCommon.buildMenuStats(cachedMenus);
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

        try {
            $cards.each(function (index) {
                if (index >= metrics.length) return;
                var metric = metrics[index];
                var $h3 = $(this).find('h3');
                var newValue = metric.key === 'serverTime'
                    ? AppCommon.formatTime(metric.value)
                    : AppCommon.formatCardValue(metric.value);

                var oldValue = metric.key === 'serverTime'
                    ? AppCommon.formatTime(prev ? prev[metric.key] : null)
                    : AppCommon.formatCardValue(prev ? prev[metric.key] : null);

                if (newValue !== oldValue) {
                    $h3.addClass('metric-value-updating');
                    $h3.text(newValue);
                    setTimeout(function () {
                        $h3.removeClass('metric-value-updating');
                    }, 500);
                }
            });
        } catch (e) {
            console.error('Failed to update overview cards:', e);
        }
    }

    function smoothUpdateChart(overview) {
        if (!overviewChart) return;
        var cachedMenus = (window.AppLayout && window.AppLayout.getCachedMenus) ? window.AppLayout.getCachedMenus() : [];
        var menuStats = AppCommon.buildMenuStats(cachedMenus);
        try {
            overviewChart.data.datasets[0].data = [
                Number(overview.userCount || 0),
                Number(overview.menuCount || menuStats.total || 0),
                Number(overview.onlineSessions || 0)
            ];
            overviewChart.update('none');
        } catch (e) {
            console.error('Failed to update overview chart:', e);
        }
    }

    function smoothUpdateDashboardPanel(overview) {
        var cachedMenus = (window.AppLayout && window.AppLayout.getCachedMenus) ? window.AppLayout.getCachedMenus() : [];
        var menuStats = AppCommon.buildMenuStats(cachedMenus);
        var $items = $('#dynamic-content .status-item strong');
        var values = [
            AppCommon.formatCardValue(overview.userCount),
            AppCommon.formatCardValue(overview.menuCount || menuStats.total),
            AppCommon.formatCardValue(overview.onlineSessions)
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
            '<div class="status-item"><span>用户规模</span><strong>' + AppCommon.escapeHtml(AppCommon.formatCardValue(overview.userCount)) + '</strong></div>' +
            '<div class="status-item"><span>权限资源</span><strong>' + AppCommon.escapeHtml(AppCommon.formatCardValue(overview.menuCount || menuStats.total)) + '</strong></div>' +
            '<div class="status-item"><span>在线会话</span><strong>' + AppCommon.escapeHtml(AppCommon.formatCardValue(overview.onlineSessions)) + '</strong></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">后端已启用 JWT 鉴权、Redis 会话与登录限流策略。</div>';

        $('#dynamic-content').html(html);
    }

    function renderDashboardScene() {
        var cachedMenus = (window.AppLayout && window.AppLayout.getCachedMenus) ? window.AppLayout.getCachedMenus() : [];
        var menuStats = AppCommon.buildMenuStats(cachedMenus);
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
            { label: '服务器时间', value: AppCommon.formatTime(overview.serverTime), icon: 'far fa-clock', tone: 'tone-danger', note: '统一来自后端系统时钟' }
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

    function fetchAndRenderLoginTrend() {
        var context = document.getElementById('loginTrendChart');
        if (!context) {
            return;
        }

        if (currentMenu.path !== '/dashboard') {
            return;
        }

        var requestId = ++loginTrendRequestId;
        loginTrendLoading = true;

        var $loading = $('#loginTrendLoading');
        if ($loading.length) {
            $loading.show();
        }

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
            if (isStale()) {
                return;
            }
            try {
                destroyLoginTrendChart();
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
                    if ($loading.length) {
                        $loading.hide();
                    }
                }
            }
        }

        $.ajax({
            url: '/api/login-logs/trend',
            method: 'GET',
            timeout: 10000,
            success: function (resp) {
                if (isStale()) {
                    return;
                }

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
                if (isStale()) {
                    return;
                }
                var fb = buildFallbackData();
                renderChartData(fb.labels, fb.successData, fb.failData);
            }
        });
    }

    function getCurrentOverview() {
        return currentOverview;
    }

    function refreshOverviewCards() {
        if (currentOverview) {
            var cachedMenus = (window.AppLayout && window.AppLayout.getCachedMenus) ? window.AppLayout.getCachedMenus() : [];
            var menuStats = AppCommon.buildMenuStats(cachedMenus);
            renderOverviewCards([
                { label: '系统用户数', value: currentOverview.userCount, icon: 'fas fa-users', tone: 'tone-info', note: '含管理员与业务账号' },
                { label: '菜单权限数', value: currentOverview.menuCount || menuStats.total, icon: 'fas fa-list', tone: 'tone-success', note: '用于前端动态渲染' },
                { label: '在线会话数', value: currentOverview.onlineSessions, icon: 'fas fa-signal', tone: 'tone-warning', note: '5 分钟内活跃会话' },
                { label: '服务器时间', value: AppCommon.formatTime(currentOverview.serverTime), icon: 'far fa-clock', tone: 'tone-danger', note: '统一来自后端系统时钟' }
            ]);
        }
    }

    window.AppDashboard = {
        OVERVIEW_REFRESH_INTERVAL: OVERVIEW_REFRESH_INTERVAL,
        setCurrentMenu: setCurrentMenu,
        getCurrentMenu: getCurrentMenu,
        fetchOverview: fetchOverview,
        getCurrentOverview: getCurrentOverview,
        refreshOverviewCards: refreshOverviewCards,
        startOverviewRefresh: startOverviewRefresh,
        stopOverviewRefresh: stopOverviewRefresh,
        refreshOverviewData: refreshOverviewData,
        renderScene: renderDashboardScene,
        renderDashboardScene: renderDashboardScene,
        destroyAllDashboardCharts: destroyAllDashboardCharts,
        setHero: setHero,
        setPrimaryPanelTitle: setPrimaryPanelTitle,
        renderOverviewCards: renderOverviewCards,
        renderChart: renderChart,
        smoothUpdateOverviewCards: smoothUpdateOverviewCards,
        smoothUpdateChart: smoothUpdateChart,
        smoothUpdateDashboardPanel: smoothUpdateDashboardPanel,
        renderDashboardPanel: renderDashboardPanel,
        fetchAndRenderLoginTrend: fetchAndRenderLoginTrend
    };
})(window, jQuery);
