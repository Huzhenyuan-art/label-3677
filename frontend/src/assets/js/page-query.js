(function (window, $) {
    'use strict';

    function PageQuery(options) {
        this.options = options || {};
        this.pager = null;
        this._init();
    }

    PageQuery.prototype._init = function () {
        var self = this;
        var opts = self.options;

        self.pager = AppPagination.create({
            listUrl: opts.listUrl,
            renderRow: opts.renderRow,
            paginationEl: opts.paginationEl,
            tbodyEl: opts.tbodyEl,
            emptyRowEl: opts.emptyRowEl,
            totalRecordsEl: opts.totalRecordsEl,
            currentPageEl: opts.currentPageEl,
            pageCountEl: opts.pageCountEl,
            getExtraParams: opts.getExtraParams,
            onAfterRender: opts.onAfterRender,
            pageSize: opts.pageSize || 10
        });

        if (opts.searchBtnEl && opts.searchFormEl) {
            $(opts.searchBtnEl).off('click.pageQuery').on('click.pageQuery', function (e) {
                e.preventDefault();
                self.search();
            });

            $(opts.searchFormEl).off('keypress.pageQuery').on('keypress.pageQuery', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.search();
                }
            });
        }

        if (opts.resetBtnEl && opts.searchFormEl) {
            $(opts.resetBtnEl).off('click.pageQuery').on('click.pageQuery', function (e) {
                e.preventDefault();
                self.reset();
            });
        }

        if (opts.deleteUrl) {
            self._bindDeleteHandlers();
        }
    };

    PageQuery.prototype._bindDeleteHandlers = function () {
        var self = this;
        var opts = self.options;

        if (opts.tbodyEl && opts.deleteBtnSelector) {
            $(opts.tbodyEl).off('click.pageQueryDelete').on('click.pageQueryDelete', opts.deleteBtnSelector, function (e) {
                e.preventDefault();
                var id = $(this).attr('data-id');
                var name = $(this).attr('data-name') || '';
                self.deleteRecord(id, name);
            });
        }
    };

    PageQuery.prototype.load = function (pageNumber, pageSize) {
        return this.pager.load(pageNumber, pageSize);
    };

    PageQuery.prototype.search = function () {
        this.pager.reset();
        return this.pager.load(1);
    };

    PageQuery.prototype.reset = function () {
        var opts = this.options;
        if (opts.searchFormEl) {
            $(opts.searchFormEl)[0].reset();
        }
        this.pager.reset();
        return this.pager.load(1);
    };

    PageQuery.prototype.deleteRecord = function (id, name) {
        var self = this;
        var opts = self.options;
        if (!opts.deleteUrl) return;

        var message = '确定要删除' + (name ? '「' + name + '」' : '此记录') + '吗？该操作不可恢复。';

        AppModal.confirmDelete({
            message: message,
            onConfirm: function () {
                $.ajax({
                    url: opts.deleteUrl + '/' + id,
                    method: 'DELETE',
                    success: function (resp) {
                        if (!resp || Number(resp.code) !== 0) {
                            AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                            return;
                        }
                        AppCommon.showToast('删除成功', 'bg-success');
                        self.pager.load(self.pager.pageNumber);
                    }
                });
            }
        });
    };

    PageQuery.prototype.abort = function () {
        this.pager.abort();
    };

    function create(options) {
        return new PageQuery(options);
    }

    window.AppPageQuery = {
        PageQuery: PageQuery,
        create: create
    };
})(window, jQuery);
