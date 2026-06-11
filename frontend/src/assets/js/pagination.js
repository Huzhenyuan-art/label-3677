(function (window, $) {
    'use strict';

    function Pager(options) {
        this.listUrl = options.listUrl;
        this.renderRow = options.renderRow;
        this.paginationEl = options.paginationEl;
        this.tbodyEl = options.tbodyEl;
        this.emptyRowEl = options.emptyRowEl;
        this.totalRecordsEl = options.totalRecordsEl;
        this.currentPageEl = options.currentPageEl;
        this.pageCountEl = options.pageCountEl;
        this.getExtraParams = options.getExtraParams;
        this.onAfterRender = options.onAfterRender;
        this.pageSize = options.pageSize || 10;
        this.pageNumber = 1;
        this.totalRecords = 0;
        this.totalPages = 0;
        this.records = [];
        this._pendingRequest = null;
    }

    Pager.prototype.load = function (pageNumber, pageSize) {
        if (typeof pageNumber !== 'undefined' && pageNumber !== null) {
            this.pageNumber = Math.max(1, Number(pageNumber) || 1);
        }
        if (typeof pageSize !== 'undefined' && pageSize !== null) {
            this.pageSize = Math.max(1, Number(pageSize) || 10);
        }

        var self = this;
        if (self._pendingRequest) {
            try {
                self._pendingRequest.abort();
            } catch (e) {}
        }

        var params = {
            pageNumber: self.pageNumber,
            pageSize: self.pageSize
        };
        if (typeof self.getExtraParams === 'function') {
            var extra = self.getExtraParams() || {};
            for (var k in extra) {
                if (extra.hasOwnProperty(k) && extra[k] !== undefined && extra[k] !== '') {
                    params[k] = extra[k];
                }
            }
        }

        self._pendingRequest = $.ajax({
            url: self.listUrl,
            method: 'GET',
            data: params,
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    self.records = [];
                    self.totalRecords = 0;
                    self.totalPages = 0;
                    self.renderTable();
                    self.renderPagination();
                    return;
                }

                self.records = resp.data && Array.isArray(resp.data.records) ? resp.data.records : [];
                self.totalRecords = Number(resp.data && resp.data.totalRecords) || 0;
                self.totalPages = Number(resp.data && resp.data.totalPages) || 0;
                if (self.totalPages > 0 && self.pageNumber > self.totalPages) {
                    self.pageNumber = self.totalPages;
                }

                self.renderTable();
                self.renderPagination();
                if (typeof self.onAfterRender === 'function') {
                    self.onAfterRender(self.records);
                }
            },
            error: function () {
                self.records = [];
                self.totalRecords = 0;
                self.totalPages = 0;
                self.renderTable();
                self.renderPagination();
            },
            complete: function () {
                self._pendingRequest = null;
            }
        });
        return self._pendingRequest;
    };

    Pager.prototype.renderTable = function () {
        var tbody = $(this.tbodyEl);
        var emptyRow = $(this.emptyRowEl);
        tbody.empty();

        if (!this.records.length) {
            emptyRow.removeClass('d-none');
            if (this.totalRecordsEl) {
                $(this.totalRecordsEl).text('0');
            }
            return;
        }

        emptyRow.addClass('d-none');
        if (this.totalRecordsEl) {
            $(this.totalRecordsEl).text(String(this.totalRecords));
        }

        var self = this;
        $.each(this.records, function (index, item) {
            var row = self.renderRow(item, index);
            if (row) {
                tbody.append(row);
            }
        });
    };

    Pager.prototype.renderPagination = function () {
        var container = $(this.paginationEl);
        var self = this;
        container.off('click', '[data-page]');
        container.off('click', '[data-page-prev]');
        container.off('click', '[data-page-next]');
        container.off('click', '[data-page-jump]');

        var pageCount = this.totalPages || Math.ceil(this.totalRecords / this.pageSize) || 0;
        if (this.currentPageEl) {
            $(this.currentPageEl).text(String(this.pageNumber));
        }
        if (this.pageCountEl) {
            $(this.pageCountEl).text(String(pageCount));
        }

        if (this.totalRecords <= 0) {
            container.empty().append(
                $('<li class="page-item disabled"><span class="page-link text-muted">共 0 条记录</span></li>')
            );
            return;
        }

        var html = '';
        html += '<li class="page-item ' + (this.pageNumber <= 1 ? 'disabled' : '') + '">' +
            '<a class="page-link" href="#" data-page-prev>&laquo; 上一页</a></li>';

        var start = Math.max(1, this.pageNumber - 2);
        var end = Math.min(pageCount, start + 4);
        start = Math.max(1, end - 4);

        if (start > 1) {
            html += '<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>';
            if (start > 2) {
                html += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
            }
        }

        for (var p = start; p <= end; p++) {
            html += '<li class="page-item ' + (p === this.pageNumber ? 'active' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
        }

        if (end < pageCount) {
            if (end < pageCount - 1) {
                html += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
            }
            html += '<li class="page-item">' +
                '<a class="page-link" href="#" data-page="' + pageCount + '">' + pageCount + '</a></li>';
        }

        html += '<li class="page-item ' + (this.pageNumber >= pageCount ? 'disabled' : '') + '">' +
            '<a class="page-link" href="#" data-page-next>下一页 &raquo;</a></li>';

        html += '<li class="page-item ml-2"><div class="input-group" style="width:160px;">' +
            '<input type="number" min="1" max="' + pageCount + '" class="form-control form-control-sm" data-page-input placeholder="跳转">' +
            '<div class="input-group-append">' +
            '<button class="btn btn-outline-secondary btn-sm" type="button" data-page-jump>Go</button>' +
            '</div></div></li>';

        container.html(html);

        container.on('click', '[data-page]', function (e) {
            e.preventDefault();
            var p = Number($(this).attr('data-page'));
            if (p && p !== self.pageNumber) {
                self.load(p);
            }
        });
        container.on('click', '[data-page-prev]', function (e) {
            e.preventDefault();
            if (self.pageNumber > 1) {
                self.load(self.pageNumber - 1);
            }
        });
        container.on('click', '[data-page-next]', function (e) {
            e.preventDefault();
            if (self.pageNumber < pageCount) {
                self.load(self.pageNumber + 1);
            }
        });
        container.on('click', '[data-page-jump]', function (e) {
            e.preventDefault();
            var input = container.find('[data-page-input]');
            var p = Math.max(1, Math.min(pageCount, Number(input.val()) || 1));
            input.val('');
            if (p !== self.pageNumber) {
                self.load(p);
            }
        });
    };

    Pager.prototype.reset = function () {
        this.pageNumber = 1;
    };

    Pager.prototype.abort = function () {
        if (this._pendingRequest) {
            try {
                this._pendingRequest.abort();
            } catch (e) {}
            this._pendingRequest = null;
        }
    };

    function create(options) {
        return new Pager(options);
    }

    window.AppPagination = {
        Pager: Pager,
        create: create
    };
})(window, jQuery);
