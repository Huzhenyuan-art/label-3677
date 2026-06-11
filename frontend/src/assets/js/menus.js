(function (window, $) {
    'use strict';

    var menuManageState = {
        allMenus: [],
        expandedIds: {},
        pendingDeleteMenuId: null,
        pendingDeleteMenuTitle: '',
        searchKeyword: '',
        filteredMenus: [],
        allRoles: [],
        roleMenuMap: {}
    };

    var menuSearchDebounceTimer = null;

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

    function getCachedMenus() {
        if (window.AppLayout && typeof window.AppLayout.getCachedMenus === 'function') {
            return window.AppLayout.getCachedMenus() || [];
        }
        return [];
    }

    function fetchMenus() {
        if (window.AppDashboard && typeof window.AppDashboard.fetchMenus === 'function') {
            window.AppDashboard.fetchMenus();
        } else {
            $.get('/api/menus', function (resp) {
                if (resp && Number(resp.code) === 0 && Array.isArray(resp.data)) {
                    if (window.AppLayout && typeof window.AppLayout.setCachedMenus === 'function') {
                        window.AppLayout.setCachedMenus(resp.data);
                    }
                    localStorage.setItem(AppCommon.STORAGE_KEYS.MENUS, JSON.stringify(resp.data));
                }
            });
        }
    }

    function fetchAllMenusForManage() {
        $.get('/api/menus/all', function (resp) {
            if (!resp || Number(resp.code) !== 0 || !Array.isArray(resp.data)) {
                renderMenusScene();
                return;
            }
            menuManageState.allMenus = resp.data;
            renderMenusScene();
        }).fail(function () {
            menuManageState.allMenus = getCachedMenus();
            renderMenusScene();
        });
    }

    function renderMenusScene() {
        destroyAllDashboardCharts();
        bindMenuEvents();

        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : getCachedMenus();
        var stats = AppCommon.buildMenuStats(menus);
        setHero(
            '菜单权限预览',
            '关键词检索菜单权限，支持过滤左侧树形与右侧权限矩阵，高亮匹配项。',
            ['只读预览', '关键词检索', '权限矩阵']
        );

        renderOverviewCards([
            { label: '菜单总数', value: stats.total, icon: 'fas fa-sitemap', tone: 'tone-info', note: '含目录与叶子菜单' },
            { label: '一级菜单', value: stats.rootCount, icon: 'fas fa-layer-group', tone: 'tone-success', note: '主导航入口数量' },
            { label: '末级菜单', value: stats.leafCount, icon: 'fas fa-stream', tone: 'tone-warning', note: '可直达页面节点' },
            { label: '最大层级', value: stats.maxDepth, icon: 'fas fa-project-diagram', tone: 'tone-danger', note: '当前菜单树深度' }
        ]);

        setPrimaryPanelTitle('菜单权限预览');
        renderMenuPreviewPanel(menus);

        $('#dynamic-panel-title').text('权限矩阵');
        loadRoleMenuMatrix();
    }

    function renderMenuPreviewPanel(menus) {
        var keyword = menuManageState.searchKeyword || '';
        var displayMenus = keyword ? menuManageState.filteredMenus : menus;

        var headerHtml = '' +
            '<div class="menu-preview-header mb-3">' +
            '<div class="d-flex flex-wrap align-items-center justify-content-between">' +
            '<div class="form-inline">' +
            '<div class="input-group input-group-sm mr-2 mb-2">' +
            '<div class="input-group-prepend">' +
            '<span class="input-group-text"><i class="fas fa-search"></i></span>' +
            '</div>' +
            '<input type="text" id="menu-search-input" class="form-control" placeholder="输入关键词搜索菜单名称、路径、权限码..." ' +
            'value="' + AppCommon.escapeHtml(keyword) + '" style="min-width: 320px;">' +
            '<div class="input-group-append"' + (keyword ? '' : ' style="display:none;"') + '>' +
            '<button type="button" id="menu-search-clear" class="btn btn-outline-secondary"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<span class="text-muted text-sm mb-2">只读预览模式，搜索不会修改任何菜单数据</span>' +
            '</div>' +
            '<span class="text-sm text-info mb-2 menu-search-count"' + (keyword ? '' : ' style="display:none;"') + '>' +
            '<i class="fas fa-filter mr-1"></i>找到 <span id="menu-search-count-num">' + (keyword ? countFilteredMenus(displayMenus) : 0) + '</span> 个匹配项' +
            '</span>' +
            '</div>' +
            '</div>';

        var treeHtml = '<div id="menu-preview-tree-container" class="menu-preview-tree" style="max-height: 500px; overflow-y: auto;">';
        if (!displayMenus || !displayMenus.length) {
            treeHtml += '<div class="text-center text-muted py-5">' + (keyword ? '未找到匹配的菜单' : '暂无菜单数据') + '</div>';
        } else {
            treeHtml += buildPreviewTreeHtml(displayMenus, 1, keyword);
        }
        treeHtml += '</div>';

        $('#primary-panel-body').html(headerHtml + treeHtml);
        bindMenuPreviewEvents();

        var $input = $('#menu-search-input');
        if ($input.length) {
            $input.focus();
            var inputEl = $input[0];
            if (inputEl.setSelectionRange && keyword) {
                var len = keyword.length;
                try { inputEl.setSelectionRange(len, len); } catch (e) {}
            }
        }
    }

    function refreshMenuPreviewTreeOnly() {
        var keyword = menuManageState.searchKeyword || '';
        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : getCachedMenus();
        var displayMenus = keyword ? menuManageState.filteredMenus : menus;

        var treeHtml = '';
        if (!displayMenus || !displayMenus.length) {
            treeHtml = '<div class="text-center text-muted py-5">' + (keyword ? '未找到匹配的菜单' : '暂无菜单数据') + '</div>';
        } else {
            treeHtml = buildPreviewTreeHtml(displayMenus, 1, keyword);
        }

        var $container = $('#menu-preview-tree-container');
        if ($container.length) {
            $container.html(treeHtml);
        }

        var $clearBtn = $('#menu-search-clear');
        if ($clearBtn.length) {
            $clearBtn.closest('.input-group-append').toggle(!!keyword);
        }

        var $countWrap = $('.menu-search-count');
        if ($countWrap.length) {
            $countWrap.toggle(!!keyword);
            $('#menu-search-count-num').text(keyword ? countFilteredMenus(displayMenus) : 0);
        }
    }

    function bindMenuPreviewEvents() {
        $(document).off('input.menuSearch').on('input.menuSearch', '#menu-search-input', function () {
            var $input = $(this);
            var keyword = $.trim($input.val());
            filterMenus(keyword);
        });

        $(document).off('click.menuSearchClear').on('click.menuSearchClear', '#menu-search-clear', function () {
            clearMenuFilter();
        });

        $(document).off('click.menuPreviewToggle').on('click.menuPreviewToggle', '.menu-preview-toggle', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-preview-item');
            var id = Number(row.data('id'));
            toggleMenuExpand(id);
        });
    }

    function filterMenus(keyword) {
        menuManageState.searchKeyword = keyword;
        if (keyword) {
            menuManageState.filteredMenus = filterMenusByKeyword(menuManageState.allMenus.length ? menuManageState.allMenus : getCachedMenus(), keyword);
            expandAllForSearch(menuManageState.filteredMenus);
        } else {
            menuManageState.filteredMenus = [];
        }

        if (menuSearchDebounceTimer) {
            clearTimeout(menuSearchDebounceTimer);
        }
        menuSearchDebounceTimer = setTimeout(function () {
            refreshMenuPreviewTreeOnly();
            renderPermissionMatrix();
        }, 80);
    }

    function clearMenuFilter() {
        menuManageState.searchKeyword = '';
        menuManageState.filteredMenus = [];
        var $input = $('#menu-search-input');
        if ($input.length) {
            $input.val('').focus();
        }
        refreshMenuPreviewTreeOnly();
        renderPermissionMatrix();
    }

    function filterMenusByKeyword(nodes, keyword) {
        if (!keyword || !Array.isArray(nodes)) return [];
        var lowerKeyword = keyword.toLowerCase();

        function matchNode(node) {
            var title = (node.title || '').toLowerCase();
            var path = (node.path || '').toLowerCase();
            var permCode = (node.permCode || '').toLowerCase();
            return title.indexOf(lowerKeyword) !== -1 ||
                   path.indexOf(lowerKeyword) !== -1 ||
                   permCode.indexOf(lowerKeyword) !== -1;
        }

        function filterRecursive(list) {
            var result = [];
            list.forEach(function (node) {
                var newNode = Object.assign({}, node);
                var childrenMatch = [];
                if (Array.isArray(node.children) && node.children.length) {
                    childrenMatch = filterRecursive(node.children);
                }
                if (matchNode(node) || childrenMatch.length > 0) {
                    if (childrenMatch.length > 0) {
                        newNode.children = childrenMatch;
                    } else {
                        newNode.children = node.children;
                    }
                    result.push(newNode);
                }
            });
            return result;
        }

        return filterRecursive(nodes);
    }

    function expandAllForSearch(nodes) {
        if (!Array.isArray(nodes)) return;
        nodes.forEach(function (node) {
            menuManageState.expandedIds[node.id] = true;
            if (Array.isArray(node.children) && node.children.length) {
                expandAllForSearch(node.children);
            }
        });
    }

    function toggleMenuExpand(id) {
        menuManageState.expandedIds[id] = menuManageState.expandedIds[id] === false ? true : false;
        refreshMenuPreviewTreeOnly();
    }

    function toggleAllMenusExpand(expand) {
        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : getCachedMenus();
        function setExpandRecursive(nodes) {
            if (!Array.isArray(nodes)) return;
            nodes.forEach(function (node) {
                menuManageState.expandedIds[node.id] = expand;
                if (Array.isArray(node.children) && node.children.length) {
                    setExpandRecursive(node.children);
                }
            });
        }
        setExpandRecursive(menus);
        refreshMenuPreviewTreeOnly();
    }

    function countFilteredMenus(nodes) {
        if (!Array.isArray(nodes)) return 0;
        var count = 0;
        nodes.forEach(function (node) {
            count++;
            if (Array.isArray(node.children) && node.children.length) {
                count += countFilteredMenus(node.children);
            }
        });
        return count;
    }

    function highlightText(text, keyword) {
        if (!keyword || !text) return AppCommon.escapeHtml(text);
        var lowerText = text.toLowerCase();
        var lowerKeyword = keyword.toLowerCase();
        var index = lowerText.indexOf(lowerKeyword);
        if (index === -1) return AppCommon.escapeHtml(text);

        var result = '';
        var lastIndex = 0;
        while (index !== -1) {
            result += AppCommon.escapeHtml(text.substring(lastIndex, index));
            result += '<mark class="search-highlight">' + AppCommon.escapeHtml(text.substring(index, index + keyword.length)) + '</mark>';
            lastIndex = index + keyword.length;
            index = lowerText.indexOf(lowerKeyword, lastIndex);
        }
        result += AppCommon.escapeHtml(text.substring(lastIndex));
        return result;
    }

    function buildPreviewTreeHtml(nodes, depth, keyword) {
        if (!Array.isArray(nodes) || !nodes.length) return '';
        var html = '<ul class="menu-preview-list">';
        nodes.forEach(function (node) {
            var hasChildren = Array.isArray(node.children) && node.children.length > 0;
            var isExpanded = menuManageState.expandedIds[node.id] !== false;
            var visibleBadge = node.visible === 0
                ? '<span class="badge badge-soft-warning ml-2">已隐藏</span>'
                : '';
            var indent = (depth - 1) * 20;

            html += '<li class="menu-preview-item" data-id="' + node.id + '" data-parent-id="' + (node.parentId || 0) + '">' +
                '<div class="menu-preview-row" style="padding-left:' + indent + 'px;">' +
                '<span class="menu-preview-toggle">';
            if (hasChildren) {
                html += '<i class="fas ' + (isExpanded ? 'fa-chevron-down' : 'fa-chevron-right') + ' text-muted"></i>';
            } else {
                html += '<span class="menu-preview-placeholder"></span>';
            }
            html += '</span>' +
                '<span class="menu-preview-icon"><i class="' + AppCommon.safeIcon(node.icon) + '"></i></span>' +
                '<span class="menu-preview-title">' + highlightText(node.title || '-', keyword) + '</span>' +
                visibleBadge +
                '<span class="menu-preview-path ml-2">' + highlightText(node.path || '#', keyword) + '</span>' +
                '<span class="menu-preview-perm ml-2"><code>' + highlightText(node.permCode || '-', keyword) + '</code></span>' +
                '</div>';

            if (hasChildren && isExpanded) {
                html += buildPreviewTreeHtml(node.children, depth + 1, keyword);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function loadRoleMenuMatrix() {
        $('#dynamic-content').html('<div class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin mr-2"></i>加载权限矩阵中...</div>');

        $.when(
            $.get('/api/roles/list'),
            $.get('/api/menus/all')
        ).done(function (rolesResp, menusResp) {
            var roles = (rolesResp[0] && rolesResp[0].code === 0) ? rolesResp[0].data : [];
            var allMenus = (menusResp[0] && menusResp[0].code === 0) ? menusResp[0].data : [];

            menuManageState.allRoles = roles || [];
            if (!menuManageState.allMenus.length && allMenus.length) {
                menuManageState.allMenus = allMenus;
            }

            var roleRequests = roles.map(function (role) {
                return $.get('/api/roles/' + role.id + '/menus');
            });

            if (roleRequests.length === 0) {
                renderPermissionMatrix();
                return;
            }

            $.when.apply($, roleRequests).done(function () {
                var results = Array.prototype.slice.call(arguments);
                roles.forEach(function (role, index) {
                    var resp = results[index];
                    var menuIds = (resp && resp[0] && resp[0].code === 0) ? resp[0].data : [];
                    menuManageState.roleMenuMap[role.id] = {};
                    (menuIds || []).forEach(function (id) {
                        menuManageState.roleMenuMap[role.id][id] = true;
                    });
                });
                renderPermissionMatrix();
            }).fail(function () {
                $('#dynamic-content').html('<div class="text-center text-danger py-4">加载权限矩阵失败，请刷新页面重试</div>');
            });
        }).fail(function () {
            $('#dynamic-content').html('<div class="text-center text-danger py-4">加载角色数据失败，请刷新页面重试</div>');
        });
    }

    function renderPermissionMatrix() {
        var roles = menuManageState.allRoles || [];
        var menus = menuManageState.allMenus.length ? menuManageState.allMenus : getCachedMenus();
        var keyword = menuManageState.searchKeyword || '';
        var displayMenus = keyword ? menuManageState.filteredMenus : menus;

        if (!roles.length) {
            $('#dynamic-content').html('<div class="text-center text-muted py-4">暂无角色数据</div>');
            return;
        }

        var flatMenus = flattenMenusForMatrix(displayMenus);
        if (!flatMenus.length) {
            $('#dynamic-content').html('<div class="text-center text-muted py-4">' + (keyword ? '未找到匹配的菜单权限' : '暂无菜单数据') + '</div>');
            return;
        }

        var html = '<div class="table-responsive" style="max-height: 500px; overflow-y: auto;">';
        html += '<table class="table table-sm table-bordered table-hover mb-0 permission-matrix-table">';
        html += '<thead class="thead-light sticky-top"><tr><th style="min-width: 180px;">菜单名称</th>';
        roles.forEach(function (role) {
            html += '<th class="text-center" style="min-width: 100px;">' + AppCommon.escapeHtml(role.roleName) + '</th>';
        });
        html += '</tr></thead><tbody>';

        flatMenus.forEach(function (menu) {
            var indent = Math.max((menu.depth - 1) * 14, 0);
            html += '<tr data-menu-id="' + menu.id + '">';
            html += '<td><span style="padding-left:' + indent + 'px;"><i class="' + AppCommon.safeIcon(menu.icon) + ' mr-1 text-muted"></i>' +
                highlightText(menu.title || '-', keyword) +
                '<div class="text-xs text-muted mt-1">权限码: ' + highlightText(menu.permCode || '-', keyword) + '</div>' +
                '</span></td>';
            roles.forEach(function (role) {
                var hasPermission = menuManageState.roleMenuMap[role.id] && menuManageState.roleMenuMap[role.id][menu.id];
                if (hasPermission) {
                    html += '<td class="text-center"><span class="text-success"><i class="fas fa-check-circle"></i></span></td>';
                } else {
                    html += '<td class="text-center"><span class="text-muted"><i class="far fa-circle"></i></span></td>';
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        html += '<div class="mt-2 text-muted text-sm"><i class="fas fa-info-circle mr-1"></i>权限矩阵为只读视图，展示各角色拥有的菜单权限。<span class="text-success"><i class="fas fa-check-circle"></i></span> 表示拥有权限，<span class="text-muted"><i class="far fa-circle"></i></span> 表示无权限。</div>';

        $('#dynamic-content').html(html);
    }

    function flattenMenusForMatrix(list, depth) {
        var out = [];
        var nextDepth = depth || 1;
        if (!Array.isArray(list)) return out;

        list.forEach(function (item) {
            var node = Object.assign({}, item, { depth: nextDepth });
            out.push(node);
            if (Array.isArray(item.children) && item.children.length) {
                out = out.concat(flattenMenusForMatrix(item.children, nextDepth + 1));
            }
        });

        return out;
    }

    function renderMenuManagePanel(menus) {
        var headerHtml = '' +
            '<div class="menu-manage-header mb-3">' +
            '<button type="button" id="menu-add-root-btn" class="btn btn-success btn-sm"><i class="fas fa-plus mr-1"></i>新增顶级菜单</button>' +
            '<span class="ml-3 text-muted text-sm">提示：点击菜单名称可展开/折叠子菜单</span>' +
            '</div>';

        var treeHtml = '<div class="menu-manage-tree">' + buildManageTreeHtml(menus, 1) + '</div>';
        $('#primary-panel-body').html(headerHtml + treeHtml);
    }

    function buildManageTreeHtml(nodes, depth) {
        if (!Array.isArray(nodes) || !nodes.length) {
            return '';
        }
        var html = '<ul class="menu-manage-list">';
        nodes.forEach(function (node) {
            var hasChildren = Array.isArray(node.children) && node.children.length > 0;
            var isExpanded = menuManageState.expandedIds[node.id] !== false;
            var visibleBadge = node.visible === 0
                ? '<span class="badge badge-soft-warning ml-2">已隐藏</span>'
                : '';
            var indent = (depth - 1) * 20;

            html += '<li class="menu-manage-item" data-id="' + node.id + '" data-parent-id="' + (node.parentId || 0) + '">' +
                '<div class="menu-manage-row" style="padding-left:' + indent + 'px;">' +
                '<span class="menu-manage-toggle">';
            if (hasChildren) {
                html += '<i class="fas ' + (isExpanded ? 'fa-chevron-down' : 'fa-chevron-right') + ' text-muted"></i>';
            } else {
                html += '<span class="menu-manage-placeholder"></span>';
            }
            html += '</span>' +
                '<span class="menu-manage-icon"><i class="' + AppCommon.safeIcon(node.icon) + '"></i></span>' +
                '<span class="menu-manage-title">' + AppCommon.escapeHtml(node.title || '-') + '</span>' +
                visibleBadge +
                '<span class="menu-manage-path ml-2">' + AppCommon.escapeHtml(node.path || '#') + '</span>' +
                '<span class="menu-manage-perm ml-2">' + AppCommon.escapeHtml(node.permCode || '-') + '</span>' +
                '<span class="menu-manage-actions ml-auto">' +
                '<button class="btn btn-sm btn-outline-success btn-menu-add-child mr-1" title="添加子菜单" data-id="' + node.id + '" data-title="' + AppCommon.escapeHtml(node.title || '') + '"><i class="fas fa-plus"></i></button>' +
                '<button class="btn btn-sm btn-outline-info btn-menu-edit mr-1" title="编辑"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-secondary btn-menu-move-up mr-1" title="上移"><i class="fas fa-arrow-up"></i></button>' +
                '<button class="btn btn-sm btn-outline-secondary btn-menu-move-down mr-1" title="下移"><i class="fas fa-arrow-down"></i></button>' +
                '<button class="btn btn-sm ' + (node.visible === 0 ? 'btn-outline-success' : 'btn-outline-warning') + ' btn-menu-toggle mr-1" title="' + (node.visible === 0 ? '显示' : '隐藏') + '"><i class="fas ' + (node.visible === 0 ? 'fa-eye' : 'fa-eye-slash') + '"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger btn-menu-delete" title="删除"><i class="fas fa-trash-alt"></i></button>' +
                '</span>' +
                '</div>';

            if (hasChildren && isExpanded) {
                html += buildManageTreeHtml(node.children, depth + 1);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function renderMenuManageHelpPanel() {
        var html = '' +
            '<div class="status-list">' +
            '<div class="status-item"><span>新增顶级菜单</span><span class="badge badge-soft-success">点击顶部按钮</span></div>' +
            '<div class="status-item"><span>新增子菜单</span><span class="badge badge-soft-info">点击父菜单 + 按钮</span></div>' +
            '<div class="status-item"><span>编辑菜单</span><span class="badge badge-soft-primary">修改名称/路径/权限</span></div>' +
            '<div class="status-item"><span>排序调整</span><span class="badge badge-soft-warning">上移 / 下移按钮</span></div>' +
            '<div class="status-item"><span>显示隐藏</span><span class="badge badge-soft-secondary">眼睛图标切换</span></div>' +
            '<div class="status-item"><span>删除菜单</span><span class="badge badge-soft-danger">无子菜单时可删</span></div>' +
            '</div>' +
            '<div class="mt-3 text-muted text-sm">所有保存操作均会实时刷新侧边栏导航菜单，并与后端 perm_code 权限体系保持同步。</div>';
        $('#dynamic-content').html(html);
    }

    function renderMenuTable(menus) {
        renderMenuManagePanel(menus);
        renderMenuManageHelpPanel();
    }

    function renderMenuPagination() {
    }

    function bindMenuEvents() {
        $(document).off('click.menuAddRoot').on('click.menuAddRoot', '#menu-add-root-btn', function () {
            openMenuFormModal(null, 0, '顶级菜单');
        });

        $(document).off('click.menuAddChild').on('click.menuAddChild', '.btn-menu-add-child', function (e) {
            e.stopPropagation();
            var id = Number($(this).data('id'));
            var title = $(this).data('title') || '父级菜单';
            openMenuFormModal(null, id, title);
        });

        $(document).off('click.menuEdit').on('click.menuEdit', '.btn-menu-edit', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            var menuData = findMenuInTree(menuManageState.allMenus, id);
            if (menuData) {
                openMenuFormModal(menuData, menuData.parentId || 0, getMenuTitleById(menuManageState.allMenus, menuData.parentId));
            }
        });

        $(document).off('click.menuToggle').on('click.menuToggle', '.btn-menu-toggle', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            toggleMenuVisible(id);
        });

        $(document).off('click.menuDelete').on('click.menuDelete', '.btn-menu-delete', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            var title = row.find('.menu-manage-title').text();
            confirmDeleteMenu(id, title);
        });

        $(document).off('click.menuMoveUp').on('click.menuMoveUp', '.btn-menu-move-up', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            openMenuMoveModal(id, -1);
        });

        $(document).off('click.menuMoveDown').on('click.menuMoveDown', '.btn-menu-move-down', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            openMenuMoveModal(id, 1);
        });

        $(document).off('click.menuToggleExpand').on('click.menuToggleExpand', '.menu-manage-toggle', function (e) {
            e.stopPropagation();
            var row = $(this).closest('.menu-manage-item');
            var id = Number(row.data('id'));
            menuManageState.expandedIds[id] = menuManageState.expandedIds[id] === false ? true : false;
            renderMenusScene();
        });

        $(document).off('submit.menuForm').on('submit.menuForm', '#menu-form', function (e) {
            e.preventDefault();
            submitMenuForm();
        });

        $(document).off('click.menuDeleteConfirm').on('click.menuDeleteConfirm', '#menu-delete-confirm-btn', function () {
            if (menuManageState.pendingDeleteMenuId) {
                deleteMenu(menuManageState.pendingDeleteMenuId);
            }
            $('#menu-delete-modal').modal('hide');
            menuManageState.pendingDeleteMenuId = null;
        });
    }

    function getMenuTitleById(menus, id) {
        if (!id || id === 0) return '顶级菜单';
        var found = findMenuInTree(menus, id);
        return found ? found.title : '顶级菜单';
    }

    function findMenuInTree(menus, id) {
        if (!Array.isArray(menus)) return null;
        for (var i = 0; i < menus.length; i++) {
            if (menus[i].id === id) return menus[i];
            if (Array.isArray(menus[i].children)) {
                var found = findMenuInTree(menus[i].children, id);
                if (found) return found;
            }
        }
        return null;
    }

    function openMenuFormModal(menuData, parentId, parentTitle) {
        $('#mf-error-msg').addClass('d-none').text('');

        if (menuData && menuData.id) {
            $('#menu-form-label').text('编辑菜单');
            $('#mf-id').val(menuData.id);
            $('#mf-parent-id').val(menuData.parentId || 0);
            $('#mf-parent-title').val(getMenuTitleById(menuManageState.allMenus, menuData.parentId));
            $('#mf-title').val(menuData.title || '');
            $('#mf-path').val(menuData.path || '');
            $('#mf-icon').val(menuData.icon || '');
            $('#mf-perm-code').val(menuData.permCode || '');
            $('#mf-sort-order').val(menuData.sortOrder != null ? menuData.sortOrder : 1);
            $('#mf-visible').val(menuData.visible != null ? String(menuData.visible) : '1');
        } else {
            $('#menu-form-label').text('新增菜单');
            $('#mf-id').val('');
            $('#mf-parent-id').val(parentId || 0);
            $('#mf-parent-title').val(parentTitle || '顶级菜单');
            $('#mf-title').val('');
            $('#mf-path').val('');
            $('#mf-icon').val('');
            $('#mf-perm-code').val('');
            $('#mf-sort-order').val(1);
            $('#mf-visible').val('1');
        }
        $('#menu-form-modal').modal('show');
    }

    function showMenuFormError(msg) {
        $('#mf-error-msg').removeClass('d-none').text(msg);
    }

    function submitMenuForm() {
        var id = $('#mf-id').val();
        var parentId = Number($('#mf-parent-id').val()) || 0;
        var title = $.trim($('#mf-title').val());
        var path = $.trim($('#mf-path').val());
        var icon = $.trim($('#mf-icon').val());
        var permCode = $.trim($('#mf-perm-code').val());
        var sortOrder = Number($('#mf-sort-order').val()) || 0;
        var visible = Number($('#mf-visible').val()) || 0;

        if (!title) { showMenuFormError('菜单名称不能为空'); return; }
        if (!path) { showMenuFormError('菜单路径不能为空'); return; }
        if (!permCode) { showMenuFormError('权限码不能为空'); return; }

        var data = {
            parentId: parentId,
            title: title,
            path: path,
            icon: icon,
            permCode: permCode,
            sortOrder: sortOrder,
            visible: visible
        };

        var method, url;
        if (id) {
            method = 'PUT';
            url = '/api/menus/' + id;
        } else {
            method = 'POST';
            url = '/api/menus';
        }

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    showMenuFormError(resp ? resp.message : '保存失败');
                    return;
                }
                $('#menu-form-modal').modal('hide');
                AppCommon.showToast(id ? '编辑成功' : '新增成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function toggleMenuVisible(id) {
        $.ajax({
            url: '/api/menus/' + id + '/visible',
            method: 'PUT',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '操作失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('状态切换成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function confirmDeleteMenu(id, title) {
        menuManageState.pendingDeleteMenuId = id;
        menuManageState.pendingDeleteMenuTitle = title || '';
        $('#menu-delete-body').text('确定要删除菜单「' + (title || '') + '」吗？请确保该菜单下没有子菜单。');
        $('#menu-delete-modal').modal('show');
    }

    function deleteMenu(id) {
        $.ajax({
            url: '/api/menus/' + id,
            method: 'DELETE',
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '删除失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('删除成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function openMenuMoveModal(id, direction) {
        submitMenuMove(id, direction);
    }

    function submitMenuMove(id, direction) {
        var flat = flattenMenusWithSort(menuManageState.allMenus);
        var target = flat.find(function (m) { return m.id === id; });
        if (!target) return;

        var siblings = flat.filter(function (m) { return (m.parentId || 0) === (target.parentId || 0); });
        siblings.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });

        var idx = siblings.findIndex(function (m) { return m.id === id; });
        var swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= siblings.length) {
            AppCommon.showToast('已到边界，无法继续移动', 'bg-warning');
            return;
        }

        var swapWith = siblings[swapIdx];
        var items = [
            { id: id, sortOrder: swapWith.sortOrder },
            { id: swapWith.id, sortOrder: target.sortOrder }
        ];

        $.ajax({
            url: '/api/menus/sort',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ items: items }),
            success: function (resp) {
                if (!resp || Number(resp.code) !== 0) {
                    AppCommon.showToast(resp ? resp.message : '排序失败', 'bg-danger');
                    return;
                }
                AppCommon.showToast('排序更新成功', 'bg-success');
                refreshMenusAfterChange();
            }
        });
    }

    function flattenMenusWithSort(list, parentId) {
        var out = [];
        if (!Array.isArray(list)) return out;
        list.forEach(function (item) {
            out.push({
                id: item.id,
                parentId: item.parentId || 0,
                sortOrder: item.sortOrder != null ? item.sortOrder : 0
            });
            if (Array.isArray(item.children) && item.children.length) {
                out = out.concat(flattenMenusWithSort(item.children, item.id));
            }
        });
        return out;
    }

    function refreshMenusAfterChange() {
        fetchMenus();
    }

    window.AppMenus = {
        menuManageState: menuManageState,
        renderScene: renderMenusScene,
        renderMenusScene: renderMenusScene,
        bindMenuEvents: bindMenuEvents,
        fetchAllMenusForManage: fetchAllMenusForManage,
        renderMenuTable: renderMenuTable,
        renderMenuPagination: renderMenuPagination,
        openMenuFormModal: openMenuFormModal,
        submitMenuForm: submitMenuForm,
        showMenuFormError: showMenuFormError,
        toggleMenuExpand: toggleMenuExpand,
        toggleAllMenusExpand: toggleAllMenusExpand,
        filterMenus: filterMenus,
        clearMenuFilter: clearMenuFilter,
        openMenuMoveModal: openMenuMoveModal,
        submitMenuMove: submitMenuMove,
        deleteMenu: deleteMenu
    };
})(window, jQuery);
