(function (window) {
    'use strict';

    function parseJson(text, fallback) {
        if (!text) {
            return fallback;
        }
        try {
            return JSON.parse(text);
        } catch (_) {
            return fallback;
        }
    }

    function base64UrlDecode(str) {
        var base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        var padding = (4 - base64.length % 4) % 4;
        base64 += new Array(padding + 1).join('=');
        try {
            var decoded = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join('')
            );
            return decoded;
        } catch (_) {
            return '';
        }
    }

    function parseJwtPayload(token) {
        if (!token) {
            return null;
        }
        var parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        return parseJson(base64UrlDecode(parts[1]), null);
    }

    function isTokenExpired(token) {
        var payload = parseJwtPayload(token);
        if (!payload || !payload.exp) {
            return true;
        }
        return payload.exp * 1000 <= Date.now();
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeIcon(iconClass) {
        return iconClass && String(iconClass).trim() ? iconClass : 'fas fa-circle';
    }

    function syncUserUI(user) {
        var nicknameEl = document.getElementById('user-nickname');
        if (!nicknameEl) {
            return;
        }
        var displayName = (user && (user.nickname || user.username)) || '管理员';
        nicknameEl.textContent = displayName;

        var avatarUrl = (user && user.avatar) || 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg';
        var avatarEl = document.querySelector('.user-panel .image img');
        if (avatarEl) {
            avatarEl.setAttribute('src', avatarUrl);
        }
    }

    function renderMenus(menus) {
        var menuRoot = document.getElementById('sidebar-menu');
        if (!menuRoot || !Array.isArray(menus) || !menus.length) {
            return;
        }

        function renderTree(items, level) {
            var html = '';
            level = level || 0;
            items.forEach(function (item) {
                var path = item.path || item.code || '/dashboard';
                if (path === '#') path = '/dashboard';
                var icon = safeIcon(item.icon);
                var hasChildren = Array.isArray(item.children) && item.children.length > 0;
                var indent = level > 0 ? 'pl-' + Math.min(level * 2 + 1, 5) : '';
                var navItemClass = level === 0 ? 'nav-item has-treeview' : 'nav-item';
                var navLinkClass = level === 0 ? 'nav-link' : 'nav-link ' + indent;

                html += '<li class="' + navItemClass + '">';
                if (hasChildren) {
                    html += '<a href="#" class="' + navLinkClass + '" data-toggle="collapse" aria-expanded="false">' +
                        icon + '<p>' + escapeHtml(item.title || item.name || '-') +
                        '<i class="right fas fa-angle-left"></i></p></a>' +
                        '<ul class="nav nav-treeview collapse">' +
                        renderTree(item.children, level + 1) + '</ul>';
                } else {
                    html += '<a href="#" class="' + navLinkClass + '" data-menu-path="' + escapeHtml(path) + '">' +
                        icon + '<p>' + escapeHtml(item.title || item.name || '-') + '</p></a>';
                }
                html += '</li>';
            });
            return html;
        }

        menuRoot.innerHTML = renderTree(menus, 0);
    }

    function hideGlobalLoading() {
        var loading = document.getElementById('global-loading');
        if (loading) {
            loading.classList.add('d-none');
        }
    }

    function redirectToLogin() {
        window.location.replace('login.html');
    }

    function clearAuth() {
        localStorage.removeItem(AppCommon.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(AppCommon.STORAGE_KEYS.USER);
        localStorage.removeItem(AppCommon.STORAGE_KEYS.MENUS);
    }

    function bootstrap() {
        hideGlobalLoading();

        var token = localStorage.getItem(AppCommon.STORAGE_KEYS.TOKEN);
        if (!token) {
            redirectToLogin();
            return;
        }

        if (isTokenExpired(token)) {
            clearAuth();
            redirectToLogin();
            return;
        }

        var user = parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        var menus = parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.MENUS), []);
        syncUserUI(user);
        renderMenus(menus);
        window.__APP_BOOT_DONE__ = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

    window.addEventListener('error', function (event) {
        if (event && event.filename && event.filename.indexOf('app.js') !== -1) {
            hideGlobalLoading();
            var user = parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
            var menus = parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.MENUS), []);
            syncUserUI(user);
            renderMenus(menus);
        }
    });

    window.AppBoot = {
        bootstrap: bootstrap,
        syncUserUI: syncUserUI,
        renderMenus: renderMenus,
        hideGlobalLoading: hideGlobalLoading,
        redirectToLogin: redirectToLogin
    };
})(window);
