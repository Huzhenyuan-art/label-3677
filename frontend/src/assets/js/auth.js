(function (window, $) {
    'use strict';

    var TOKEN_WARNING_THRESHOLD = 300;
    var TOKEN_DANGER_THRESHOLD = 60;
    var tokenCountdownInterval = null;
    var tokenExpiredNotified = false;

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
        window.AppLayout && window.AppLayout.stopIdleRemainingTimer && window.AppLayout.stopIdleRemainingTimer();
        stopTokenCountdown();
        window.AppDashboard && window.AppDashboard.stopOverviewRefresh && window.AppDashboard.stopOverviewRefresh();
        window.AppSessions && window.AppSessions.stopOnlineSessionRefresh && window.AppSessions.stopOnlineSessionRefresh();
        localStorage.removeItem(AppCommon.STORAGE_KEYS.LOCKED);
        AppCommon.clearAuth();
        setTimeout(AppCommon.redirectToLogin, 800);
    }

    function validateTokenLocal() {
        var token = localStorage.getItem(AppCommon.STORAGE_KEYS.TOKEN);
        if (!token) {
            return false;
        }
        if (AppCommon.isTokenExpired()) {
            AppCommon.clearAuth();
            return false;
        }
        return true;
    }

    function checkAuthAndRedirect() {
        if (!validateTokenLocal()) {
            AppCommon.redirectToLogin();
            return false;
        }
        return true;
    }

    function fetchUser(onSuccess, onError) {
        return $.get({
            url: '/api/auth/me',
            skipGlobalLoading: true,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    if (typeof onError === 'function') {
                        onError(resp);
                    }
                    return;
                }
                localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data));
                window.AppLayout && window.AppLayout.syncUserUI && window.AppLayout.syncUserUI(resp.data);
                if (typeof onSuccess === 'function') {
                    onSuccess(resp.data);
                }
            },
            error: function (xhr) {
                if (typeof onError === 'function') {
                    onError(xhr.responseJSON, xhr);
                }
            }
        });
    }

    function fetchMenus(onSuccess, onError) {
        return $.get({
            url: '/api/menus',
            skipGlobalLoading: true,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                    if (typeof onError === 'function') {
                        onError(resp);
                    }
                    return;
                }
                localStorage.setItem(AppCommon.STORAGE_KEYS.MENUS, JSON.stringify(resp.data));
                window.AppLayout && window.AppLayout.setCachedMenus && window.AppLayout.setCachedMenus(resp.data);
                window.AppLayout && window.AppLayout.renderSidebarMenus && window.AppLayout.renderSidebarMenus(resp.data);
                window.AppLayout && window.AppLayout.syncActiveMenu && window.AppLayout.syncActiveMenu();
                window.AppLayout && window.AppLayout.renderBreadcrumb && window.AppLayout.renderBreadcrumb();
                if (typeof onSuccess === 'function') {
                    onSuccess(resp.data);
                }
            },
            error: function (xhr) {
                if (typeof onError === 'function') {
                    onError(xhr.responseJSON, xhr);
                }
            }
        });
    }

    function initAuth(onComplete) {
        if (!validateTokenLocal()) {
            AppCommon.redirectToLogin();
            return;
        }

        var userData = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), null);
        var menuData = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.MENUS), null);
        var hasCache = userData && menuData;

        function done() {
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }

        if (hasCache) {
            fetchUser(function () {
                fetchMenus(done, done);
            }, function () {
                fetchMenus(done, done);
            });
        } else {
            fetchUser(function () {
                fetchMenus(done, function () {
                    if (!validateTokenLocal()) {
                        AppCommon.redirectToLogin();
                        return;
                    }
                    done();
                });
            }, function () {
                fetchMenus(done, function () {
                    if (!validateTokenLocal()) {
                        AppCommon.redirectToLogin();
                        return;
                    }
                    done();
                });
            });
        }
    }

    function unlockScreen(password, onSuccess) {
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
                localStorage.removeItem(AppCommon.STORAGE_KEYS.LOCKED);
                var lockScreen = $('#lock-screen');
                lockScreen.addClass('d-none');
                $('body').removeClass('lock-mode');
                $(document).off('keydown.lockScreenEsc');

                $('.modal').each(function () {
                    var inst = $(this).data('bs.modal');
                    if (inst) {
                        inst._config.keyboard = true;
                        inst._config.backdrop = true;
                    }
                });

                AppCommon.showToast('解锁成功', 'bg-success');
                if (typeof onSuccess === 'function') {
                    onSuccess();
                }
            }
        });
    }

    function changePassword(oldPassword, newPassword, confirmPassword, onError) {
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
                    if (typeof onError === 'function') {
                        onError(resp ? resp.message : '修改失败');
                    }
                    return;
                }
                if (resp.data && resp.data.token) {
                    localStorage.setItem(AppCommon.STORAGE_KEYS.TOKEN, resp.data.token);
                }
                if (resp.data && resp.data.user) {
                    localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data.user));
                    window.AppLayout && window.AppLayout.syncUserUI && window.AppLayout.syncUserUI(resp.data.user);
                }
                $('#change-password-modal').modal('hide');
                AppCommon.showToast('密码修改成功，其他设备已下线', 'bg-success');
            },
            error: function (xhr) {
                var response = xhr.responseJSON;
                if (typeof onError === 'function') {
                    onError(response && response.message ? response.message : '请求失败，请稍后重试');
                }
            }
        });
    }

    function logout() {
        AppCommon.stopIdleMonitoring();
        window.AppLayout && window.AppLayout.stopIdleRemainingTimer && window.AppLayout.stopIdleRemainingTimer();
        stopTokenCountdown();
        window.AppDashboard && window.AppDashboard.stopOverviewRefresh && window.AppDashboard.stopOverviewRefresh();
        window.AppSessions && window.AppSessions.stopOnlineSessionRefresh && window.AppSessions.stopOnlineSessionRefresh();
        localStorage.removeItem(AppCommon.STORAGE_KEYS.IDLE_TIMEOUT);
        localStorage.removeItem(AppCommon.STORAGE_KEYS.IDLE_LAST_ACTIVITY);
        localStorage.removeItem(AppCommon.STORAGE_KEYS.LOCKED);
        AppCommon.clearAuth();
        AppCommon.showToast('已退出登录', 'bg-primary');
        setTimeout(AppCommon.redirectToLogin, 250);
    }

    window.AppAuth = {
        TOKEN_WARNING_THRESHOLD: TOKEN_WARNING_THRESHOLD,
        TOKEN_DANGER_THRESHOLD: TOKEN_DANGER_THRESHOLD,
        startTokenCountdown: startTokenCountdown,
        stopTokenCountdown: stopTokenCountdown,
        handleTokenExpired: handleTokenExpired,
        validateTokenLocal: validateTokenLocal,
        checkAuthAndRedirect: checkAuthAndRedirect,
        initAuth: initAuth,
        fetchUser: fetchUser,
        fetchMenus: fetchMenus,
        unlockScreen: unlockScreen,
        changePassword: changePassword,
        logout: logout
    };
})(window, jQuery);
