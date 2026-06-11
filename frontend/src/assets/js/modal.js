(function (window, $) {
    'use strict';

    function confirmDialog(options) {
        var title = options.title || '确认操作';
        var message = options.message || '确定要执行此操作吗？';
        var confirmText = options.confirmText || '确定';
        var cancelText = options.cancelText || '取消';
        var confirmClass = options.confirmClass || 'btn-primary';
        var onConfirm = options.onConfirm;
        var onCancel = options.onCancel;

        var confirmModal = $('#generic-confirm-modal');
        if (!confirmModal.length) {
            confirmModal = $(
                '<div class="modal fade" id="generic-confirm-modal" tabindex="-1" role="dialog" aria-hidden="true">' +
                '<div class="modal-dialog modal-dialog-centered" role="document">' +
                '<div class="modal-content">' +
                '<div class="modal-header"><h5 class="modal-title"></h5>' +
                '<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
                '<span aria-hidden="true">&times;</span></button></div>' +
                '<div class="modal-body"><p class="confirm-message mb-0"></p></div>' +
                '<div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary btn-confirm-cancel">取消</button>' +
                '<button type="button" class="btn btn-confirm-ok">确定</button>' +
                '</div></div></div></div>'
            );
            $('body').append(confirmModal);
        }

        confirmModal.find('.modal-title').text(title);
        confirmModal.find('.confirm-message').text(message);
        confirmModal.find('.btn-confirm-cancel').text(cancelText);
        confirmModal.find('.btn-confirm-ok').text(confirmText)
            .removeClass('btn-primary btn-danger btn-warning btn-success')
            .addClass(confirmClass);

        confirmModal.off('click.confirm');
        confirmModal.on('click.confirm', '.btn-confirm-ok', function () {
            confirmModal.modal('hide');
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        });
        confirmModal.on('click.confirm', '.btn-confirm-cancel', function () {
            confirmModal.modal('hide');
            if (typeof onCancel === 'function') {
                onCancel();
            }
        });

        confirmModal.modal('show');
        return confirmModal;
    }

    function confirmDelete(options) {
        return confirmDialog({
            title: options.title || '确认删除',
            message: options.message || '确定要删除此记录吗？该操作不可恢复。',
            confirmText: '删除',
            confirmClass: 'btn-danger',
            onConfirm: options.onConfirm,
            onCancel: options.onCancel
        });
    }

    function showModal(modalId, onShown) {
        var $modal = $(modalId);
        if (!$modal.length) return null;
        $modal.modal('show');
        if (typeof onShown === 'function') {
            $modal.one('shown.bs.modal', onShown);
        }
        return $modal;
    }

    function hideModal(modalId, onHidden) {
        var $modal = $(modalId);
        if (!$modal.length) return null;
        $modal.modal('hide');
        if (typeof onHidden === 'function') {
            $modal.one('hidden.bs.modal', onHidden);
        }
        return $modal;
    }

    function resetForm(formSelector) {
        var $form = $(formSelector);
        if (!$form.length) return;
        $form[0].reset();
        $form.find('.is-invalid').removeClass('is-invalid');
        $form.find('.invalid-feedback').remove();
        $form.find('.field-error').text('').addClass('d-none');
    }

    function showFieldErrors(formSelector, errors) {
        var $form = $(formSelector);
        if (!$form.length || !errors) return;
        resetForm(formSelector);

        if (typeof errors === 'string') {
            $form.find('.form-error-msg').removeClass('d-none').text(errors);
            return;
        }

        if (typeof errors === 'object') {
            for (var field in errors) {
                if (errors.hasOwnProperty(field)) {
                    var $field = $form.find('[name="' + field + '"]');
                    var msg = errors[field];
                    if ($field.length) {
                        $field.addClass('is-invalid');
                        var $feedback = $field.siblings('.invalid-feedback');
                        if (!$feedback.length) {
                            $feedback = $('<div class="invalid-feedback"></div>');
                            $field.after($feedback);
                        }
                        $feedback.text(msg);
                    } else {
                        var $error = $form.find('#' + field + '-error, .' + field + '-error');
                        if ($error.length) {
                            $error.removeClass('d-none').text(msg);
                        }
                    }
                }
            }
        }
    }

    function submitForm(options) {
        var formSelector = options.formSelector;
        var url = options.url;
        var method = options.method || 'POST';
        var buildData = options.buildData;
        var validate = options.validate;
        var onSuccess = options.onSuccess;
        var onError = options.onError;
        var onBeforeSubmit = options.onBeforeSubmit;
        var showLoading = options.showLoading !== false;
        var contentJSON = options.contentJSON !== false;

        if (typeof validate === 'function') {
            var validResult = validate();
            if (validResult === false || (typeof validResult === 'object' && validResult)) {
                if (typeof validResult === 'object' && validResult) {
                    showFieldErrors(formSelector, validResult);
                }
                return;
            }
        }

        resetForm(formSelector);
        if (typeof onBeforeSubmit === 'function') {
            onBeforeSubmit();
        }

        var requestData;
        if (typeof buildData === 'function') {
            requestData = buildData();
        } else {
            requestData = $(formSelector).serializeArray().reduce(function (acc, item) {
                acc[item.name] = item.value;
                return acc;
            }, {});
        }

        var ajaxOpts = {
            url: url,
            method: method,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    if (resp && resp.errors) {
                        showFieldErrors(formSelector, resp.errors);
                    }
                    if (typeof onError === 'function') {
                        onError(resp ? resp.message : '操作失败', resp);
                    }
                    return;
                }
                if (typeof onSuccess === 'function') {
                    onSuccess(resp);
                }
            },
            error: function (xhr) {
                var response = xhr.responseJSON;
                if (response && response.errors) {
                    showFieldErrors(formSelector, response.errors);
                }
                if (typeof onError === 'function') {
                    onError(response && response.message ? response.message : '请求失败，请稍后重试', response, xhr);
                }
            }
        };

        if (contentJSON) {
            ajaxOpts.contentType = 'application/json';
            ajaxOpts.data = JSON.stringify(requestData);
        } else {
            ajaxOpts.data = requestData;
        }

        if (!showLoading) {
            ajaxOpts.skipGlobalLoading = true;
        }

        return $.ajax(ajaxOpts);
    }

    function bindModalEnterSubmit(modalId, submitBtnSelector) {
        var $modal = $(modalId);
        if (!$modal.length) return;
        $modal.off('keypress.modalSubmit').on('keypress.modalSubmit', function (e) {
            if (e.key === 'Enter' && !$(e.target).is('textarea')) {
                e.preventDefault();
                $modal.find(submitBtnSelector).click();
            }
        });
    }

    window.AppModal = {
        confirm: confirmDialog,
        confirmDelete: confirmDelete,
        show: showModal,
        hide: hideModal,
        resetForm: resetForm,
        showFieldErrors: showFieldErrors,
        submitForm: submitForm,
        bindEnterSubmit: bindModalEnterSubmit
    };
})(window, jQuery);
