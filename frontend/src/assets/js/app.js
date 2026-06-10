(function (window, $) {
    'use strict';

    var overviewChart = null;
    var cachedMenus = [];
    var currentOverview = null;
    var currentMenu = {
        title: '仪表盘',
        path: '/dashboard',
        permCode: 'dashboard:view'
    };

    $(function () {
        AppCommon.setupAjax();

        var token = localStorage.getItem(AppCommon.STORAGE_KEYS.TOKEN);
        if (!token) {
            AppCommon.redirectToLogin();
            return;
        }

        bindEvents();
        loadBaseData();

        window.AppDashboard = {
            showLockScreen: showLockScreen
        };
    });

    function bindEvents() {
        $('#logout-btn').off('click pointerup').on('click pointerup', function (event) {
            event.preventDefault();
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

        $(document).off('click.logout').on('click.logout', '#logout-btn', function (event) {
            event.preventDefault();
            AppCommon.clearAuth();
            AppCommon.showToast('已退出登录', 'bg-primary');
            setTimeout(AppCommon.redirectToLogin, 250);
        });

        $('#unlock-form').on('submit', function (event) {
            event.preventDefault();
            unlockScreen();
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
                renderMenusScene();
            }
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
    }

    function renderTreeMenu(menu) {
        var item = $('<li class="nav-item has-treeview"></li>');
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
    }

    function syncActiveMenuByPath(path) {
        var target = $('#sidebar-menu .nav-link[data-menu-path="' + path + '"]').first();
        if (!target.length) {
            return;
        }
        setActiveMenu(target);
    }

    function switchPanel(menu) {
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
        $('#primary-panel-body').html('<canvas id="overviewChart" height="180"></canvas>');
        renderChart({
            userCount: Number(overview.userCount || 0),
            menuCount: Number(overview.menuCount || menuStats.total || 0),
            onlineSessions: Number(overview.onlineSessions || 0)
        });

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

    function renderMenusScene() {
        destroyOverviewChart();

        var stats = buildMenuStats(cachedMenus);
        setHero(
            '菜单与权限',
            '展示菜单树结构、权限覆盖与层级分布情况。',
            ['菜单结构', '权限矩阵', '层级统计']
        );

        renderOverviewCards([
            { label: '菜单总数', value: stats.total, icon: 'fas fa-sitemap', tone: 'tone-info', note: '含目录与叶子菜单' },
            { label: '一级菜单', value: stats.rootCount, icon: 'fas fa-layer-group', tone: 'tone-success', note: '主导航入口数量' },
            { label: '末级菜单', value: stats.leafCount, icon: 'fas fa-stream', tone: 'tone-warning', note: '可直达页面节点' },
            { label: '最大层级', value: stats.maxDepth, icon: 'fas fa-project-diagram', tone: 'tone-danger', note: '当前菜单树深度' }
        ]);

        setPrimaryPanelTitle('菜单结构预览');
        $('#primary-panel-body').html(renderMenuTreePanel(cachedMenus));

        $('#dynamic-panel-title').text('权限矩阵');
        renderMenusPanel(stats);
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
            '</form>';
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
            }
        });
    }

    function destroyOverviewChart() {
        if (!overviewChart) {
            return;
        }
        overviewChart.destroy();
        overviewChart = null;
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
})(window, jQuery);
