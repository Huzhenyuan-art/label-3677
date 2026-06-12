(function (window, $) {
    'use strict';

    var cachedMenus = [];
    var currentPage = 'dashboard';
    var idleRemainingTimer = null;

    function setCachedMenus(menus) {
        cachedMenus = menus || [];
    }

    function getCachedMenus() {
        return cachedMenus;
    }

    function getCurrentPage() {
        return currentPage;
    }

    function setCurrentPage(page) {
        currentPage = page || 'dashboard';
    }

    function syncUserUI(user) {
        if (!user) return;

        var userJson = user;
        if (typeof userJson === 'string') {
            try { userJson = JSON.parse(userJson); } catch (e) { userJson = {}; }
        }

        var name = userJson.nickname || userJson.username || '用户';
        var role = userJson.roleName || '系统用户';
        var avatar = userJson.avatar || '';

        $('.user-name, .profile-display-name').text(name);
        $('.user-role').text(role);
        $('.profile-nickname').text(name);
        $('.profile-username').text(userJson.username || '');
        $('.profile-role-name').text(role);
        if (avatar) {
            $('.user-avatar').attr('src', avatar).attr('alt', name);
        }
    }

    function renderSidebarMenus(menus) {
        var container = $('#sidebar-menu-container');
        if (!container.length) return;
        container.empty();
        if (!Array.isArray(menus) || !menus.length) return;

        function renderTree(items, level) {
            var html = '';
            level = level || 0;
            $.each(items, function (_, item) {
                var path = AppCommon.normalizePath(item.path || item.code);
                var icon = AppCommon.safeIcon(item.icon);
                var hasChildren = Array.isArray(item.children) && item.children.length > 0;
                var htmlId = 'menu-' + (item.id || item.code).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
                var indent = level > 0 ? 'pl-' + Math.min(level * 2 + 1, 5) : '';
                var navItemClass = level === 0 ? 'nav-item has-treeview' : 'nav-item';
                var navLinkClass = level === 0 ? 'nav-link' : 'nav-link ' + indent;

                html += '<li class="' + navItemClass + '">';
                if (hasChildren) {
                    html += '<a href="#" class="' + navLinkClass + '" data-toggle="collapse" data-target="#' + htmlId + '" aria-expanded="false" aria-controls="' + htmlId + '">' +
                        icon + '<p>' + (item.title || item.name) +
                        '<i class="right fas fa-angle-left"></i></p></a>' +
                        '<ul class="nav nav-treeview collapse" id="' + htmlId + '" data-menu-path="' + path + '">' +
                        renderTree(item.children, level + 1) + '</ul>';
                } else {
                    html += '<a href="#" class="' + navLinkClass + '" data-menu-path="' + path + '">' +
                        icon + '<p>' + (item.title || item.name) + '</p></a>';
                }
                html += '</li>';
            });
            return html;
        }

        container.html(renderTree(menus, 0));
    }

    function syncActiveMenu() {
        var container = $('#sidebar-menu-container');
        if (!container.length) return;

        container.find('.nav-link').removeClass('active');
        container.find('.nav-treeview').removeClass('show');

        var selector = '[data-menu-path="' + currentPage + '"]';
        var link = container.find('a' + selector + ', .nav-treeview' + selector).first();
        if (!link.length) return;

        if (link.is('a')) {
            link.addClass('active');
            link.closest('.nav-treeview').addClass('show').siblings('a').addClass('active');
            link.parents('.nav-treeview').addClass('show').each(function () {
                $(this).siblings('a').addClass('active');
            });
        } else if (link.hasClass('nav-treeview')) {
            link.addClass('show');
            link.siblings('a').addClass('active');
        }
    }

    function renderBreadcrumb() {
        var bc = $('#breadcrumb-container');
        if (!bc.length) return;
        var trail = findMenuTrail(cachedMenus, currentPage);
        if (!trail || !trail.length) trail = [{ title: '仪表盘' }];

        var html = '<li class="breadcrumb-item"><i class="fas fa-tachometer-alt mr-1"></i>首页</li>';
        $.each(trail, function (i, item) {
            if (i === trail.length - 1) {
                html += '<li class="breadcrumb-item active text-muted">' + (item.title || item.name) + '</li>';
            } else {
                html += '<li class="breadcrumb-item">' + (item.title || item.name) + '</li>';
            }
        });
        bc.html(html);

        var title = trail.length ? (trail[trail.length - 1].title || trail[trail.length - 1].name) : '仪表盘';
        $('#hero-title').text(title);
    }

    function findMenuTrail(menus, pagePath, trail) {
        trail = trail || [];
        if (!Array.isArray(menus)) return null;
        for (var i = 0; i < menus.length; i++) {
            var item = menus[i];
            var path = AppCommon.normalizePath(item.path || item.code);
            var nextTrail = trail.concat({
                title: item.title || item.name,
                path: path
            });
            if (path === pagePath) return nextTrail;
            if (Array.isArray(item.children) && item.children.length) {
                var found = findMenuTrail(item.children, pagePath, nextTrail);
                if (found) return found;
            }
        }
        return null;
    }

    function switchPage(pageName) {
        currentPage = pageName || 'dashboard';
        $('.content-section').addClass('d-none');
        $('#page-' + currentPage).removeClass('d-none');
        syncActiveMenu();
        renderBreadcrumb();
        $(window).trigger('page-switch', [currentPage]);
    }

    function bindSidebarMenuClicks() {
        $(document).on('click', '#sidebar-menu-container a[data-menu-path]', function (e) {
            var $link = $(this);
            if ($link.attr('data-toggle') === 'collapse') return;
            e.preventDefault();
            var path = $link.attr('data-menu-path');
            if (path) switchPage(path);
        });
    }

    function bindQuickActions() {
        $('#header-btn-dashboard, .page-brand').on('click', function (e) {
            e.preventDefault();
            switchPage('dashboard');
        });

        $(document).on('click', '[data-page-switch]', function (e) {
            e.preventDefault();
            var page = $(this).attr('data-page-switch');
            if (page) switchPage(page);
        });
    }

    function startIdleRemainingTimer() {
        stopIdleRemainingTimer();
        updateIdleRemainingText();
        idleRemainingTimer = setInterval(updateIdleRemainingText, 1000);
    }

    function stopIdleRemainingTimer() {
        if (idleRemainingTimer) {
            clearInterval(idleRemainingTimer);
            idleRemainingTimer = null;
        }
    }

    function updateIdleRemainingText() {
        var el = $('#idle-remaining');
        if (!el.length) {
            stopIdleRemainingTimer();
            return;
        }
        var remaining = AppCommon.getIdleRemainingTime();
        if (remaining <= 0) {
            el.text('即将锁定');
            return;
        }
        var min = Math.floor(remaining / 60);
        var sec = remaining % 60;
        el.text((min > 0 ? min + ' 分 ' : '') + sec + ' 秒');
    }

    function bindLockScreen() {
        $('#lock-password-form').on('submit', function (e) {
            e.preventDefault();
            var password = $('#lock-password-input').val();
            if (!password) {
                AppCommon.showToast('请输入密码', 'bg-warning');
                return;
            }
            window.AppAuth && window.AppAuth.unlockScreen && window.AppAuth.unlockScreen(password);
        });

        $(document).on('keydown.lockScreenEsc', function (e) {
            if (e.key === 'Escape' && !$('#lock-screen').hasClass('d-none')) {
                e.preventDefault();
            }
        });

        $('#lock-password-input').on('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                $('#lock-password-submit').click();
            }
        });
    }

    function escapeHtml(text) {
        return String(text == null ? '' : String(text))
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderOverviewCards(cards) {
        if (arguments.length === 0) {
            var stats = AppCommon.buildMenuStats(cachedMenus);
            $('.overview-total-menus').text(stats.total);
            $('.overview-visible-menus').text(stats.visible);
            $('.overview-hidden-menus').text(stats.hidden);
            $('.overview-visible-ratio').text(stats.ratio);
            return;
        }

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

    function destroyAllDashboardCharts() {
    }

    function getCurrentMenuPath() {
        return currentPage;
    }

    function buildMenuStats(menus) {
        if (window.App && typeof window.App.getCachedMenus === 'function') {
            var ms = window.App.getCachedMenus();
            if (ms && ms.length) menus = ms;
        }
        return AppCommon.buildMenuStats(menus || cachedMenus);
    }

    function init() {
        bindSidebarMenuClicks();
        bindQuickActions();
        bindLockScreen();
        switchPage('dashboard');
    }

    window.AppLayout = {
        setCachedMenus: setCachedMenus,
        getCachedMenus: getCachedMenus,
        getCurrentPage: getCurrentPage,
        setCurrentPage: setCurrentPage,
        syncUserUI: syncUserUI,
        renderSidebarMenus: renderSidebarMenus,
        syncActiveMenu: syncActiveMenu,
        renderBreadcrumb: renderBreadcrumb,
        findMenuTrail: findMenuTrail,
        switchPage: switchPage,
        startIdleRemainingTimer: startIdleRemainingTimer,
        stopIdleRemainingTimer: stopIdleRemainingTimer,
        renderOverviewCards: renderOverviewCards,
        setHero: setHero,
        setPrimaryPanelTitle: setPrimaryPanelTitle,
        destroyAllDashboardCharts: destroyAllDashboardCharts,
        getCurrentMenuPath: getCurrentMenuPath,
        buildMenuStats: buildMenuStats,
        escapeHtml: escapeHtml,
        init: init
    };
})(window, jQuery);
