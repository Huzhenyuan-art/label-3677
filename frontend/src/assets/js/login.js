(function (window, $) {
    'use strict';

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
                    AppCommon.showToast(resp ? resp.message : '登录失败', 'bg-danger');
                    return;
                }

                localStorage.setItem(AppCommon.STORAGE_KEYS.TOKEN, resp.data.token);
                localStorage.setItem(AppCommon.STORAGE_KEYS.USER, JSON.stringify(resp.data.user || {}));
                localStorage.setItem(AppCommon.STORAGE_KEYS.MENUS, JSON.stringify(resp.data.menus || []));
                AppCommon.showToast('登录成功，正在进入控制台', 'bg-success');
                setTimeout(function () {
                    window.location.href = 'index.html';
                }, 400);
            },
            complete: function () {
                $('#login-btn').prop('disabled', false).text('登录系统');
            }
        });
    }
})(window, jQuery);
