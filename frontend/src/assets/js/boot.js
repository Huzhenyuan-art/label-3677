(function (window) {
    'use strict';

    var STORAGE_KEYS = {
        TOKEN: 'admin_token',
        USER: 'admin_user',
        MENUS: 'admin_menus'
    };

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
            return decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join('')
            );
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

        var html = '';
        menus.forEach(function (menu) {
            if (Array.isArray(menu.children) && menu.children.length) {
                html += '<li class="nav-item has-treeview">';
                html += '<a href="#" class="nav-link">';
                html += '<i class="nav-icon ' + safeIcon(menu.icon) + '"></i>';
                html += '<p>' + escapeHtml(menu.title || '-') + '<i class="right fas fa-angle-left"></i></p>';
                html += '</a><ul class="nav nav-treeview">';
                menu.children.forEach(function (child) {
                    html += '<li class="nav-item"><a href="#" class="nav-link" data-menu-path="' + escapeHtml(child.path || '') + '">';
                    html += '<i class="far fa-circle nav-icon"></i>';
                    html += '<p>' + escapeHtml(child.title || '-') + '</p></a></li>';
                });
                html += '</ul></li>';
            } else {
                html += '<li class="nav-item"><a href="#" class="nav-link" data-menu-path="' + escapeHtml(menu.path || '') + '">';
                html += '<i class="nav-icon ' + safeIcon(menu.icon) + '"></i>';
                html += '<p>' + escapeHtml(menu.title || '-') + '</p></a></li>';
            }
        });
        menuRoot.innerHTML = html;
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

    function bootstrap() {
        hideGlobalLoading();

        var token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) {
            redirectToLogin();
            return;
        }

        if (isTokenExpired(token)) {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.MENUS);
            redirectToLogin();
            return;
        }

        var user = parseJson(localStorage.getItem(STORAGE_KEYS.USER), {});
        var menus = parseJson(localStorage.getItem(STORAGE_KEYS.MENUS), []);
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
            syncUserUI(parseJson(localStorage.getItem(STORAGE_KEYS.USER), {}));
            renderMenus(parseJson(localStorage.getItem(STORAGE_KEYS.MENUS), []));
        }
    });
})(window);
