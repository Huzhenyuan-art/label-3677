(function (window) {
    'use strict';

    var STORAGE_KEYS = {
        TOKEN: 'admin_token',
        USER: 'admin_user',
        MENUS: 'admin_menus',
        IDLE_TIMEOUT: 'admin_idle_timeout',
        IDLE_LAST_ACTIVITY: 'admin_idle_last_activity',
        SIDEBAR_COLLAPSED: 'admin_sidebar_collapsed',
        SIDEBAR_EXPANDED_MENUS: 'admin_sidebar_expanded_menus',
        LOCKED: 'admin_locked'
    };

    var DEFAULT_IDLE_TIMEOUT = 300;
    var MIN_IDLE_TIMEOUT = 60;
    var MAX_IDLE_TIMEOUT = 3600;

    var idleTimer = null;
    var idleCallback = null;
    var isIdleMonitoring = false;

    var pendingAjaxCount = 0;
    var loadingForceHidden = false;

    function getIdleTimeout() {
        var stored = localStorage.getItem(STORAGE_KEYS.IDLE_TIMEOUT);
        var timeout = stored ? parseInt(stored, 10) : DEFAULT_IDLE_TIMEOUT;
        if (isNaN(timeout) || timeout < MIN_IDLE_TIMEOUT) {
            timeout = MIN_IDLE_TIMEOUT;
        } else if (timeout > MAX_IDLE_TIMEOUT) {
            timeout = MAX_IDLE_TIMEOUT;
        }
        return timeout;
    }

    function setIdleTimeout(seconds) {
        var timeout = parseInt(seconds, 10);
        if (isNaN(timeout) || timeout < MIN_IDLE_TIMEOUT) {
            timeout = MIN_IDLE_TIMEOUT;
        } else if (timeout > MAX_IDLE_TIMEOUT) {
            timeout = MAX_IDLE_TIMEOUT;
        }
        localStorage.setItem(STORAGE_KEYS.IDLE_TIMEOUT, String(timeout));
        if (isIdleMonitoring) {
            resetIdleTimer();
        }
        return timeout;
    }

    function updateLastActivity() {
        localStorage.setItem(STORAGE_KEYS.IDLE_LAST_ACTIVITY, String(Date.now()));
    }

    function getLastActivity() {
        var stored = localStorage.getItem(STORAGE_KEYS.IDLE_LAST_ACTIVITY);
        return stored ? parseInt(stored, 10) : Date.now();
    }

    function resetIdleTimer() {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
        updateLastActivity();
        var timeout = getIdleTimeout();
        if (timeout > 0) {
            idleTimer = setTimeout(function () {
                if (typeof idleCallback === 'function') {
                    idleCallback();
                }
            }, timeout * 1000);
        }
    }

    function handleUserActivity() {
        if (isIdleMonitoring) {
            resetIdleTimer();
        }
    }

    function startIdleMonitoring(callback) {
        if (isIdleMonitoring) {
            stopIdleMonitoring();
        }
        idleCallback = callback;
        isIdleMonitoring = true;

        var events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(function (event) {
            document.addEventListener(event, handleUserActivity, true);
        });

        window.addEventListener('storage', function (e) {
            if (e.key === STORAGE_KEYS.IDLE_LAST_ACTIVITY) {
                resetIdleTimer();
            }
        });

        resetIdleTimer();
    }

    function stopIdleMonitoring() {
        isIdleMonitoring = false;
        idleCallback = null;
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
        var events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(function (event) {
            document.removeEventListener(event, handleUserActivity, true);
        });
    }

    function getRemainingIdleTime() {
        var timeout = getIdleTimeout();
        var lastActivity = getLastActivity();
        var elapsed = Math.floor((Date.now() - lastActivity) / 1000);
        return Math.max(0, timeout - elapsed);
    }

    function showLoading() {
        loadingForceHidden = false;
        _incAjaxLoading();
    }

    function hideLoading() {
        _decAjaxLoading();
    }

    function _decAjaxLoading() {
        pendingAjaxCount = Math.max(0, pendingAjaxCount - 1);
        if (pendingAjaxCount === 0) {
            loadingForceHidden = false;
            $('#global-loading').addClass('d-none');
        }
    }

    function _incAjaxLoading() {
        pendingAjaxCount += 1;
        loadingForceHidden = false;
        $('#global-loading').removeClass('d-none');
    }

    function forceClearLoading() {
        pendingAjaxCount = 0;
        loadingForceHidden = false;
        var $el = $('#global-loading');
        if ($el.length) {
            $el.addClass('d-none');
        }
    }

    var toastQueue = [];
    var toastIdCounter = 0;
    var DEFAULT_TOAST_DURATION = 2600;

    function initToastContainer() {
        var container = $('.toast-container');
        if (!container.length) {
            container = $('<div class="toast-container"></div>').appendTo('body');
        }
        container.find('#appToast').remove();
        container.removeClass('p-3');
        return container;
    }

    function showToast(message, typeClass, duration) {
        var id = 'toast-' + (++toastIdCounter);
        var toastDuration = duration || DEFAULT_TOAST_DURATION;
        var type = typeClass || 'bg-primary';

        var toastHtml =
            '<div id="' + id + '" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="' + toastDuration + '">' +
            '  <div class="toast-header ' + type + ' text-white">' +
            '    <strong class="mr-auto">系统提示</strong>' +
            '    <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">' +
            '      <span aria-hidden="true">&times;</span>' +
            '    </button>' +
            '  </div>' +
            '  <div class="toast-body">' + escapeHtml(message || '操作完成') + '</div>' +
            '</div>';

        var container = initToastContainer();
        var toastEl = $(toastHtml).prependTo(container);

        toastEl.toast({
            delay: toastDuration,
            autohide: true
        });

        toastEl.on('hidden.bs.toast', function () {
            $(this).remove();
            var idx = toastQueue.indexOf(id);
            if (idx > -1) {
                toastQueue.splice(idx, 1);
            }
        });

        toastEl.toast('show');
        toastQueue.push(id);

        return id;
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

    function formatDatetime(text) {
        if (!text) return '-';
        return String(text).replace('T', ' ').substring(0, 19);
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

    function normalizePath(path) {
        if (!path || path === '#') {
            return '/dashboard';
        }
        return path;
    }

    function redirectToLogin() {
        window.location.href = 'login.html';
    }

    function clearAuth() {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.MENUS);
    }

    function setupAjax() {
        $(document).off('ajaxSend.appCommon').on('ajaxSend.appCommon', function (_event, _xhr, settings) {
            if (!settings.skipGlobalLoading) {
                _incAjaxLoading();
            }
        });

        $(document).off('ajaxComplete.appCommon').on('ajaxComplete.appCommon', function (_event, _xhr, settings) {
            if (!settings.skipGlobalLoading) {
                _decAjaxLoading();
            }
        });

        $(document).off('ajaxError.appCommon').on('ajaxError.appCommon', function (_event, _xhr, settings) {
            if (!settings.skipGlobalLoading) {
                _decAjaxLoading();
            }
        });

        $.ajaxSetup({
            timeout: 15000,
            dataFilter: function (data, type) {
                if (type === 'json' && typeof data === 'string') {
                    return data.replace(/^\uFEFF/, '');
                }
                return data;
            },
            converters: {
                'text json': function (result) {
                    if (typeof result !== 'string') {
                        return result;
                    }

                    var normalized = result.replace(/^\uFEFF/, '').trim();
                    if (!normalized) {
                        return {};
                    }

                    try {
                        return JSON.parse(normalized);
                    } catch (_) {
                        return {
                            code: 500,
                            message: '响应解析失败，请刷新页面后重试',
                            raw: normalized
                        };
                    }
                }
            },
            beforeSend: function (xhr, settings) {
                var token = localStorage.getItem(STORAGE_KEYS.TOKEN);
                if (token && !settings.skipAuth) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                }
            },
            complete: function (_, statusText) {
                if (statusText === 'timeout') {
                    showToast('请求超时，请检查网络连接', 'bg-warning');
                }
            },
            error: function (xhr, _status, _error) {
                var settings = this;
                if (settings.skipGlobalError) {
                    return;
                }
                var response = xhr.responseJSON;
                if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504) {
                    showToast('后端服务启动中，请稍后再试', 'bg-warning');
                    return;
                }
                if (xhr.status === 0) {
                    showToast('网络不可用或服务暂未就绪', 'bg-warning');
                    return;
                }
                if (response && response.code === 401) {
                    showToast(response.message || '登录已失效，请重新登录', 'bg-warning');
                    clearAuth();
                    setTimeout(redirectToLogin, 600);
                    return;
                }
                if (response && response.message) {
                    showToast(response.message, 'bg-danger');
                    return;
                }
                showToast('请求失败，请稍后重试', 'bg-danger');
            }
        });
    }

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
        var payload = base64UrlDecode(parts[1]);
        return parseJson(payload, null);
    }

    function getTokenExpireTime() {
        var token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) {
            return 0;
        }
        var payload = parseJwtPayload(token);
        if (!payload || !payload.exp) {
            return 0;
        }
        return payload.exp * 1000;
    }

    function getRemainingTokenTime() {
        var expireTime = getTokenExpireTime();
        if (!expireTime) {
            return 0;
        }
        var remaining = Math.floor((expireTime - Date.now()) / 1000);
        return Math.max(0, remaining);
    }

    function isTokenExpired() {
        return getRemainingTokenTime() <= 0;
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

    window.AppCommon = {
        STORAGE_KEYS: STORAGE_KEYS,
        DEFAULT_IDLE_TIMEOUT: DEFAULT_IDLE_TIMEOUT,
        MIN_IDLE_TIMEOUT: MIN_IDLE_TIMEOUT,
        MAX_IDLE_TIMEOUT: MAX_IDLE_TIMEOUT,
        DEFAULT_TOAST_DURATION: DEFAULT_TOAST_DURATION,
        showToast: showToast,
        showLoading: showLoading,
        hideLoading: hideLoading,
        forceClearLoading: forceClearLoading,
        setupAjax: setupAjax,
        clearAuth: clearAuth,
        redirectToLogin: redirectToLogin,
        parseJson: parseJson,
        getIdleTimeout: getIdleTimeout,
        setIdleTimeout: setIdleTimeout,
        startIdleMonitoring: startIdleMonitoring,
        stopIdleMonitoring: stopIdleMonitoring,
        resetIdleTimer: resetIdleTimer,
        getRemainingIdleTime: getRemainingIdleTime,
        updateLastActivity: updateLastActivity,
        parseJwtPayload: parseJwtPayload,
        getTokenExpireTime: getTokenExpireTime,
        getRemainingTokenTime: getRemainingTokenTime,
        isTokenExpired: isTokenExpired,
        escapeHtml: escapeHtml,
        safeIcon: safeIcon,
        formatDatetime: formatDatetime,
        formatTime: formatTime,
        formatCardValue: formatCardValue,
        normalizePath: normalizePath,
        flattenMenus: flattenMenus,
        buildMenuStats: buildMenuStats
    };
})(window);
