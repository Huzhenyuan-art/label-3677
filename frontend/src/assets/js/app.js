(function (window, $) {
    'use strict';

    var overviewChart = null;
    var cachedMenus = [];
    var currentOverview = null;

    $(function () {
        AppCommon.setupAjax();

        var token = localStorage.getItem(AppCommon.STORAGE_KEYS.TOKEN);
        if (!token) {
            AppCommon.redirectToLogin();
            return;
        }

        bindEvents();
        loadBaseData();

        // 提供页面级方法，便于内联事件或外部脚本调用
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

        // 防止按钮在重绘或缓存恢复后丢失直接绑定
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

        fetchMenus();
        fetchUser();
        fetchOverview();
    }

    function renderUserFromStorage() {
        var user = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        $('#user-nickname').text(user.nickname || user.username || '管理员');
    }

    function renderMenusFromStorage() {
        var menus = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.MENUS), []);
        if (!Array.isArray(menus) || !menus.length) {
            return;
        }
        cachedMenus = menus;
        renderSidebarMenus(menus);
    }

    function fetchUser() {
        $.get('/api/auth/me', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !resp.data) {
                return;
            }
            localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data));
            $('#user-nickname').text(resp.data.nickname || resp.data.username || '管理员');
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
        });
    }

    function fetchOverview() {
        $.get('/api/dashboard/overview', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !resp.data) {
                AppCommon.showToast(resp ? resp.message : '加载仪表盘失败', 'bg-warning');
                return;
            }
            currentOverview = resp.data;
            $('#metric-users').text(resp.data.userCount);
            $('#metric-menus').text(resp.data.menuCount);
            $('#metric-online').text(resp.data.onlineSessions);
            $('#metric-time').text(formatTime(resp.data.serverTime));

            renderDashboardPanel();
            renderChart(resp.data);
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

        var sub = $('<ul class="nav nav-treeview"></ul>');
        menu.children.forEach(function (child) {
            var subItem = $('<li class="nav-item"></li>');
            var subLink = $('<a href="#" class="nav-link"></a>');
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
        element.addClass('active');
    }

    function switchPanel(menu) {
        $('#page-title').text(menu.title || '功能面板');
        $('#page-subtitle').text(menu.title || '页面');

        if (menu.path === '/dashboard') {
            renderDashboardPanel();
            return;
        }
        if (menu.path === '/profile') {
            renderProfilePanel();
            return;
        }
        if (menu.path === '/menus') {
            renderMenusPanel();
            return;
        }

        $('#dynamic-content').html(
            '<p class="text-muted mb-0">当前菜单路径：' + escapeHtml(menu.path || '#') + '</p>'
        );
    }

    function renderDashboardPanel() {
        if (!currentOverview) {
            return;
        }
        var html = '' +
            '<div class="mb-2"><strong>欢迎回来，系统运行稳定。</strong></div>' +
            '<p class="text-muted mb-2">后端已开启 JWT 鉴权、Redis 会话与登录限流策略。</p>' +
            '<ul class="mb-0 pl-3 text-sm">' +
            '<li>在线会话：' + currentOverview.onlineSessions + '</li>' +
            '<li>用户总数：' + currentOverview.userCount + '</li>' +
            '<li>菜单总数：' + currentOverview.menuCount + '</li>' +
            '</ul>';
        $('#dynamic-content').html(html);
    }

    function renderProfilePanel() {
        var user = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        var html = '' +
            '<dl class="row mb-0">' +
            '<dt class="col-sm-4">用户ID</dt><dd class="col-sm-8">' + escapeHtml(String(user.id || '-')) + '</dd>' +
            '<dt class="col-sm-4">用户名</dt><dd class="col-sm-8">' + escapeHtml(user.username || '-') + '</dd>' +
            '<dt class="col-sm-4">昵称</dt><dd class="col-sm-8">' + escapeHtml(user.nickname || '-') + '</dd>' +
            '</dl>';
        $('#dynamic-content').html(html);
    }

    function renderMenusPanel() {
        var rows = flattenMenus(cachedMenus);
        if (!rows.length) {
            $('#dynamic-content').html('<p class="text-muted mb-0">暂无菜单数据</p>');
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-sm table-hover">' +
            '<thead><tr><th>ID</th><th>菜单名</th><th>路径</th><th>权限码</th></tr></thead><tbody>';

        rows.forEach(function (m) {
            html += '<tr>' +
                '<td>' + escapeHtml(String(m.id || '-')) + '</td>' +
                '<td>' + escapeHtml(m.title || '-') + '</td>' +
                '<td>' + escapeHtml(m.path || '-') + '</td>' +
                '<td>' + escapeHtml(m.permCode || '-') + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        $('#dynamic-content').html(html);
    }

    function flattenMenus(list) {
        var out = [];
        if (!Array.isArray(list)) {
            return out;
        }
        list.forEach(function (item) {
            out.push(item);
            if (Array.isArray(item.children) && item.children.length) {
                item.children.forEach(function (sub) {
                    out.push(sub);
                });
            }
        });
        return out;
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

    function renderChart(data) {
        var context = document.getElementById('overviewChart');
        if (!context) {
            return;
        }

        var labels = ['用户数', '菜单数', '在线会话'];
        var values = [data.userCount, data.menuCount, data.onlineSessions];

        if (overviewChart) {
            overviewChart.destroy();
        }

        overviewChart = new Chart(context, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '系统指标',
                    data: values,
                    backgroundColor: ['#36a2eb', '#2ecc71', '#f39c12'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function formatTime(timeText) {
        if (!timeText) {
            return '-';
        }
        var normalized = String(timeText).replace('T', ' ');
        return normalized.length > 16 ? normalized.substring(11, 16) : normalized;
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
