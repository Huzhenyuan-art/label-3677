(function (window) {
    'use strict';

    var STORAGE_KEYS = {
        TOKEN: 'admin_token',
        USER: 'admin_user',
        MENUS: 'admin_menus',
        IDLE_TIMEOUT: 'admin_idle_timeout',
        IDLE_LAST_ACTIVITY: 'admin_idle_last_activity'
    };

    var DEFAULT_IDLE_TIMEOUT = 300;
    var MIN_IDLE_TIMEOUT = 60;
    var MAX_IDLE_TIMEOUT = 3600;

    var idleTimer = null;
    var idleCallback = null;
    var isIdleMonitoring = false;

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
        $('#global-loading').removeClass('d-none');
    }

    function hideLoading() {
        $('#global-loading').addClass('d-none');
    }

    function showToast(message, typeClass) {
        var toast = $('#appToast');
        var header = toast.find('.toast-header');
        header.removeClass('bg-primary bg-danger bg-warning bg-success');
        header.addClass(typeClass || 'bg-primary');
        $('#appToastBody').text(message || '操作完成');
        toast.toast('show');
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
                if (!settings.skipGlobalLoading) {
                    showLoading();
                }
                var token = localStorage.getItem(STORAGE_KEYS.TOKEN);
                if (token && !settings.skipAuth) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                }
            },
            complete: function (_, statusText) {
                hideLoading();
                if (statusText === 'timeout') {
                    showToast('请求超时，请检查网络连接', 'bg-warning');
                }
            },
            error: function (xhr) {
                hideLoading();
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

    window.AppCommon = {
        STORAGE_KEYS: STORAGE_KEYS,
        DEFAULT_IDLE_TIMEOUT: DEFAULT_IDLE_TIMEOUT,
        MIN_IDLE_TIMEOUT: MIN_IDLE_TIMEOUT,
        MAX_IDLE_TIMEOUT: MAX_IDLE_TIMEOUT,
        showToast: showToast,
        showLoading: showLoading,
        hideLoading: hideLoading,
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
        updateLastActivity: updateLastActivity
    };
})(window);
