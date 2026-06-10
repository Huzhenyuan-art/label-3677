(function (window, $) {
    'use strict';

    var countdownTimer = null;

    $(function () {
        AppCommon.setupAjax();

        if (localStorage.getItem(AppCommon.STORAGE_KEYS.TOKEN)) {
            window.location.href = 'index.html';
            return;
        }

        $('#username').val('admin');
        $('#password').val('123456');

        $('#login-form').on('submit', function (event) {
            event.preventDefault();
            submitLogin();
        });
    });

    function submitLogin() {
        var username = $.trim($('#username').val());
        var password = $('#password').val();

        if (!username || !password) {
            AppCommon.showToast('用户名和密码不能为空', 'bg-warning');
            return;
        }

        $('#login-btn').prop('disabled', true).text('登录中...');

        $.ajax({
            url: '/api/auth/login',
            method: 'POST',
            skipAuth: true,
            contentType: 'application/json',
            data: JSON.stringify({
                username: username,
                password: password
            }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0 || !resp.data) {
                    handleLoginError(resp);
                    return;
                }

                hideAttemptInfo();
                localStorage.setItem(AppCommon.STORAGE_KEYS.TOKEN, resp.data.token);
                localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data.user || {}));
                localStorage.setItem(AppCommon.STORAGE_KEYS.MENUS, JSON.stringify(resp.data.menus || []));
                AppCommon.showToast('登录成功，正在进入控制台', 'bg-success');
                setTimeout(function () {
                    window.location.href = 'index.html';
                }, 400);
            },
            complete: function () {
                AppCommon.hideLoading();
                $('#login-btn').prop('disabled', false).text('登录系统');
            }
        });
    }

    function handleLoginError(resp) {
        var status = (resp && resp.data) ? resp.data : null;

        if (!status) {
            AppCommon.showToast(resp ? resp.message : '登录失败', 'bg-danger');
            hideAttemptInfo();
            return;
        }

        if (status.locked) {
            AppCommon.showToast(resp.message || '账户已被锁定', 'bg-danger');
            showLockdown(status.lockTtlSeconds);
        } else {
            AppCommon.showToast(resp.message || '登录失败', 'bg-danger');
            showRemainingAttempts(status.remainingAttempts);
        }
    }

    function showRemainingAttempts(remaining) {
        var $info = $('#login-attempt-info');
        var $remaining = $('#attempt-remaining');
        var $countdown = $('#attempt-countdown');

        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }

        $countdown.addClass('d-none');
        $remaining.text('剩余可尝试次数：' + remaining + ' 次');
        $info.removeClass('d-none');
    }

    function showLockdown(ttlSeconds) {
        var $info = $('#login-attempt-info');
        var $remaining = $('#attempt-remaining');
        var $countdown = $('#attempt-countdown');

        $remaining.text('账户已被锁定，请等待解锁');

        if (countdownTimer) {
            clearInterval(countdownTimer);
        }

        var remaining = ttlSeconds || 0;
        updateCountdownDisplay(remaining);
        $countdown.removeClass('d-none');
        $info.removeClass('d-none');

        countdownTimer = setInterval(function () {
            remaining--;
            if (remaining <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                $countdown.addClass('d-none');
                $remaining.text('账户已解锁，请重新登录');
                $('#login-btn').prop('disabled', false);
                return;
            }
            updateCountdownDisplay(remaining);
        }, 1000);
    }

    function updateCountdownDisplay(seconds) {
        var $countdown = $('#attempt-countdown');
        var min = Math.floor(seconds / 60);
        var sec = seconds % 60;
        var timeStr = (min > 0 ? min + ' 分 ' : '') + sec + ' 秒';
        $countdown.text('解锁倒计时：' + timeStr);
    }

    function hideAttemptInfo() {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        $('#login-attempt-info').addClass('d-none');
        $('#attempt-remaining').text('');
        $('#attempt-countdown').addClass('d-none').text('');
    }
})(window, jQuery);
