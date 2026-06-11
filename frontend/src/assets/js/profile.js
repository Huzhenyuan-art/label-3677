(function (window, $) {
    'use strict';

    var idleRemainingInterval = null;

    function startIdleRemainingTimer() {
        stopIdleRemainingTimer();
        updateIdleRemainingText();
        idleRemainingInterval = setInterval(updateIdleRemainingText, 1000);
    }

    function stopIdleRemainingTimer() {
        if (idleRemainingInterval) {
            clearInterval(idleRemainingInterval);
            idleRemainingInterval = null;
        }
    }

    function updateIdleRemainingText() {
        var remainingEl = $('#idle-remaining-text');
        if (!remainingEl.length) {
            stopIdleRemainingTimer();
            return;
        }
        var remaining = AppCommon.getRemainingIdleTime();
        var minutes = Math.floor(remaining / 60);
        var seconds = remaining % 60;
        var text = '';
        if (minutes > 0) {
            text += minutes + ' 分 ';
        }
        text += seconds + ' 秒';
        remainingEl.text('距离自动锁屏还剩：' + text);
    }

    function saveIdleTimeout() {
        var selectVal = $('#idle-timeout-select').val();
        var seconds = parseInt(selectVal, 10);
        if (isNaN(seconds)) {
            AppCommon.showToast('请选择有效的超时时间', 'bg-warning');
            return;
        }
        var saved = AppCommon.setIdleTimeout(seconds);
        var minutes = Math.round(saved / 60);
        AppCommon.showToast('空闲超时已设置为 ' + minutes + ' 分钟', 'bg-success');
        updateIdleRemainingText();
    }

    function lockScreenKeyDownHandler(e) {
        if (!$('#lock-screen').hasClass('d-none')) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

    function showLockScreen() {
        var lockScreen = $('#lock-screen');
        if (!lockScreen.length) {
            AppCommon.showToast('锁屏组件未加载，请刷新页面', 'bg-danger');
            return;
        }
        localStorage.setItem(AppCommon.STORAGE_KEYS.LOCKED, '1');
        var user = AppCommon.parseJson(localStorage.getItem(AppCommon.STORAGE_KEYS.USER), {});
        $('#lock-user').text(user.nickname || user.username || '管理员');
        $('#unlock-password').val('');
        lockScreen.removeClass('d-none');
        $('body').addClass('lock-mode');

        $('.modal').each(function () {
            var inst = $(this).data('bs.modal');
            if (inst) {
                inst._config.keyboard = false;
                inst._config.backdrop = 'static';
            }
        });

        $(document).off('keydown.lockScreenEsc').on('keydown.lockScreenEsc', lockScreenKeyDownHandler);

        setTimeout(function () {
            $('#unlock-password').focus();
        }, 100);

        AppCommon.stopIdleMonitoring();
    }

    function unlockScreen() {
        var password = $('#unlock-password').val();
        if (!password) {
            AppCommon.showToast('请输入解锁密码', 'bg-warning');
            return;
        }

        AppAuth.unlockScreen(password, function () {
            startIdleMonitor();
            if (window.AppLayout && typeof window.AppLayout.getCurrentPage === 'function') {
                var currentPath = window.AppLayout.getCurrentPage();
                if (currentPath) {
                    renderProfileScene();
                }
            }
        });
    }

    function startIdleMonitor() {
        AppCommon.startIdleMonitoring(function () {
            var lockScreen = $('#lock-screen');
            if (lockScreen.hasClass('d-none')) {
                AppCommon.showToast('系统空闲超时，已自动锁定', 'bg-warning');
                showLockScreen();
            }
        });
    }

    function setHero(title, desc, tags) {
        if (window.AppLayout && typeof window.AppLayout.setHero === 'function') {
            window.AppLayout.setHero(title, desc, tags);
        } else if (window.AppDashboard && typeof window.AppDashboard.setHero === 'function') {
            window.AppDashboard.setHero(title, desc, tags);
        }
    }

    function renderOverviewCards(cards) {
        if (window.AppLayout && typeof window.AppLayout.renderOverviewCards === 'function') {
            window.AppLayout.renderOverviewCards(cards);
        } else if (window.AppDashboard && typeof window.AppDashboard.renderOverviewCards === 'function') {
            window.AppDashboard.renderOverviewCards(cards);
        }
    }

    function setPrimaryPanelTitle(title) {
        if (window.AppLayout && typeof window.AppLayout.setPrimaryPanelTitle === 'function') {
            window.AppLayout.setPrimaryPanelTitle(title);
        } else if (window.AppDashboard && typeof window.AppDashboard.setPrimaryPanelTitle === 'function') {
            window.AppDashboard.setPrimaryPanelTitle(title);
        }
    }

    function destroyAllDashboardCharts() {
        if (window.AppLayout && typeof window.AppLayout.destroyAllDashboardCharts === 'function') {
            window.AppLayout.destroyAllDashboardCharts();
        } else if (window.AppDashboard && typeof window.AppDashboard.destroyAllDashboardCharts === 'function') {
            window.AppDashboard.destroyAllDashboardCharts();
        }
    }

    function syncUserUI(user) {
        if (window.AppLayout && typeof window.AppLayout.syncUserUI === 'function') {
            window.AppLayout.syncUserUI(user);
        }
    }

    function renderProfileScene() {
        destroyAllDashboardCharts();

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
            { label: '资料更新时间', value: AppCommon.formatTime(new Date().toISOString()), icon: 'far fa-calendar-check', tone: 'tone-danger', note: '当前页面刷新时间' }
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

    function renderProfilePanel(user) {
        var avatarUrl = user.avatar || 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg';
        var currentTimeout = AppCommon.getIdleTimeout();
        var html = '' +
            '<div class="text-center mb-3">' +
            '<img id="profile-avatar-preview" src="' + AppCommon.escapeHtml(avatarUrl) + '" class="img-circle elevation-2" width="80" height="80" alt="avatar" onerror="this.src=\'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/img/user2-160x160.jpg\'">' +
            '</div>' +
            '<form id="profile-form" novalidate>' +
            '<div class="form-group">' +
            '<label for="profile-nickname">昵称</label>' +
            '<input id="profile-nickname" type="text" class="form-control" maxlength="64" placeholder="请输入昵称" value="' + AppCommon.escapeHtml(user.nickname || '') + '" required>' +
            '<small class="form-text text-muted">昵称将显示在侧边栏与页面各处</small>' +
            '</div>' +
            '<div class="form-group">' +
            '<label for="profile-avatar">头像链接</label>' +
            '<input id="profile-avatar" type="url" class="form-control" maxlength="255" placeholder="请输入头像图片URL" value="' + AppCommon.escapeHtml(user.avatar || '') + '">' +
            '<small class="form-text text-muted">输入图片链接后，上方将实时预览头像效果</small>' +
            '</div>' +
            '<button id="profile-save-btn" type="submit" class="btn btn-primary btn-block py-2 font-weight-bold">保存修改</button>' +
            '</form>' +
            '<hr class="my-4">' +
            '<div class="idle-timeout-config">' +
            '<h6 class="font-weight-bold mb-3">自动锁屏设置</h6>' +
            '<div class="form-group">' +
            '<label for="idle-timeout-select">空闲超时时间</label>' +
            '<select id="idle-timeout-select" class="form-control">' +
            '<option value="60"' + (currentTimeout === 60 ? ' selected' : '') + '>1 分钟</option>' +
            '<option value="180"' + (currentTimeout === 180 ? ' selected' : '') + '>3 分钟</option>' +
            '<option value="300"' + (currentTimeout === 300 ? ' selected' : '') + '>5 分钟（默认）</option>' +
            '<option value="600"' + (currentTimeout === 600 ? ' selected' : '') + '>10 分钟</option>' +
            '<option value="900"' + (currentTimeout === 900 ? ' selected' : '') + '>15 分钟</option>' +
            '<option value="1800"' + (currentTimeout === 1800 ? ' selected' : '') + '>30 分钟</option>' +
            '<option value="3600"' + (currentTimeout === 3600 ? ' selected' : '') + '>60 分钟</option>' +
            '</select>' +
            '<small class="form-text text-muted">系统在指定时间内无操作将自动锁定，需输入密码解锁。</small>' +
            '</div>' +
            '<div class="idle-timeout-status text-muted text-sm mb-3">' +
            '<i class="fas fa-clock mr-1"></i>' +
            '<span id="idle-remaining-text">距离自动锁屏还剩：--</span>' +
            '</div>' +
            '<button id="idle-timeout-save-btn" type="button" class="btn btn-outline-primary btn-block py-2">保存超时设置</button>' +
            '</div>';
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

        $('#idle-timeout-save-btn').off('click.idleSave').on('click.idleSave', function () {
            saveIdleTimeout();
        });

        startIdleRemainingTimer();
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
                AppCommon.hideLoading();
                $('#profile-save-btn').prop('disabled', false).text('保存修改');
            }
        });
    }

    function openChangePasswordModal() {
        resetChangePasswordForm();
        $('#change-password-modal').modal('show');
    }

    function resetChangePasswordForm() {
        $('#cp-old-password').val('');
        $('#cp-new-password').val('');
        $('#cp-confirm-password').val('');
        $('#cp-submit-btn').prop('disabled', false).text('确认修改');
        $('#cp-error-msg').addClass('d-none').text('');
    }

    function showCpError(msg) {
        $('#cp-error-msg').removeClass('d-none').text(msg);
    }

    function submitChangePassword() {
        var oldPassword = $.trim($('#cp-old-password').val());
        var newPassword = $.trim($('#cp-new-password').val());
        var confirmPassword = $.trim($('#cp-confirm-password').val());

        if (!oldPassword) {
            showCpError('请输入旧密码');
            return;
        }
        if (!newPassword) {
            showCpError('请输入新密码');
            return;
        }
        if (newPassword.length < 8) {
            showCpError('新密码长度不能少于8位');
            return;
        }
        if (!/[a-z]/.test(newPassword)) {
            showCpError('新密码须包含小写字母');
            return;
        }
        if (!/[A-Z]/.test(newPassword)) {
            showCpError('新密码须包含大写字母');
            return;
        }
        if (!/\d/.test(newPassword)) {
            showCpError('新密码须包含数字');
            return;
        }
        if (newPassword !== confirmPassword) {
            showCpError('两次输入的新密码不一致');
            return;
        }

        $('#cp-error-msg').addClass('d-none');
        $('#cp-submit-btn').prop('disabled', true).text('提交中...');

        AppAuth.changePassword(oldPassword, newPassword, confirmPassword, function (errMsg) {
            showCpError(errMsg || '请求失败，请稍后重试');
            AppCommon.hideLoading();
            $('#cp-submit-btn').prop('disabled', false).text('确认修改');
        });
    }

    window.AppProfile = {
        saveIdleTimeout: saveIdleTimeout,
        renderScene: renderProfileScene,
        renderProfileScene: renderProfileScene,
        renderProfilePanel: renderProfilePanel,
        openChangePasswordModal: openChangePasswordModal,
        resetChangePasswordForm: resetChangePasswordForm,
        submitChangePassword: submitChangePassword,
        saveProfile: saveProfile,
        showLockScreen: showLockScreen,
        unlockScreen: unlockScreen,
        startIdleRemainingTimer: startIdleRemainingTimer,
        stopIdleRemainingTimer: stopIdleRemainingTimer,
        updateIdleRemainingText: updateIdleRemainingText,
        startIdleMonitor: startIdleMonitor
    };
})(window, jQuery);
