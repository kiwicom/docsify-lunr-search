// based on https://github.com/docsifyjs/docsify/blob/master/lib/plugins/search.js
(function () {
    var INDEXS = {};
    var LUNR_INDEX = null;

    var LOCAL_STORAGE = {
      EXPIRE_KEY: 'docsify.search.expires',
      INDEX_KEY: 'docsify.search.index'
    };

    function resolveExpireKey(namespace) {
      return namespace ? ((LOCAL_STORAGE.EXPIRE_KEY) + "/" + namespace) : LOCAL_STORAGE.EXPIRE_KEY
    }
    function resolveIndexKey(namespace) {
      return namespace ? ((LOCAL_STORAGE.INDEX_KEY) + "/" + namespace) : LOCAL_STORAGE.INDEX_KEY
    }

    function escapeHtml(string) {
      var entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
        '/': '&#x2F;'
      };

      return String(string).replace(/[&<>"'/]/g, function (s) { return entityMap[s]; })
    }

    function getAllPaths(router) {
      var paths = [];

      Docsify.dom.findAll('.sidebar-nav a:not(.section-link):not([data-nosearch])').forEach(function (node) {
        var href = node.href;
        var originHref = node.getAttribute('href');
        var path = router.parse(href).path;

        if (
          path &&
          paths.indexOf(path) === -1 &&
          !Docsify.util.isAbsolutePath(originHref)
        ) {
          paths.push(path);
        }
      });

      return paths
    }

    function saveData(maxAge, expireKey, indexKey) {
      localStorage.setItem(expireKey, Date.now() + maxAge);
      localStorage.setItem(indexKey, JSON.stringify(INDEXS));
    }

    function genIndex(path, content, router, depth) {
      if (content === void 0) content = '';

      var tokens = window.marked.lexer(content);
      var slugify = window.Docsify.slugify;
      var index = {};
      var slug;

      tokens.forEach(function (token) {
        if (token.type === 'heading' && token.depth <= depth) {
          slug = router.toURL(path, { id: slugify(token.text) });
          index[slug] = { slug: slug, title: token.text, body: '' };
        } else {
          if (!slug) {
            return
          }
          if (!index[slug]) {
            index[slug] = { slug: slug, title: '', body: '' };
          } else if (index[slug].body) {
            index[slug].body += '\n' + (token.text || '');
          } else {
            index[slug].body = token.text;
          }
        }
      });
      slugify.clear();
      return index
    }

    function findObjectByKey(obj, label) {
      if (Object.hasOwnProperty.bind(obj)(label)) { return obj[label]; }
      for (var i in obj) {
          if (Object.hasOwnProperty.bind(obj)(i)) {
              var foundLabel = findObjectByKey(obj[i], label);
              if (foundLabel) { return foundLabel; }
          }
      }
      return null;
    }

    /**
     * @param {String} query
     * @returns {Array}
     */
    function search(query) {
      if (LUNR_INDEX == null) {
        LUNR_INDEX = lunr(function () {
          this.field('title', {boost: 3})
          this.field('body')
          this.ref('slug')
          this.metadataWhitelist = ['position']

          for (var key in INDEXS) {
            for (var page in INDEXS[key]) {
              this.add(INDEXS[key][page]);
            }
          }
        });
      }

      var matchingResults = [];
      var matches = LUNR_INDEX.search(query);

      for (var idx in matches) {
        var match = matches[idx];
        var page = match.ref;
        var key = page.split("?")[0].replace("#", "");
        var info = INDEXS[key][page];

        var body = findObjectByKey(match.matchData, "body");
        var position = body == null ? null : body.position[0][0]

        var start = 0;
        var end = 0;

        start = position < 21 ? 0 : position - 20;
        end = start === 0 ? 150 : position + query.length + 150;

        var body = info.body === undefined ? "" : info.body;

        if (end > body.length) {
          end = body.length;
        }

        var content = "...";
        if (body != "") {
          var regEx = new RegExp("(" + query + ")", "ig");
          content += escapeHtml(body.substring(start, end)).replace(
            regEx, ("<em class=\"search-keyword\">$1</em>")) + "...";
        }

        var matchingPost = {
          title: escapeHtml(info.title),
          content: content,
          url: page,
        }

        matchingResults.push(matchingPost);
      }

      return matchingResults
    }

    function init$1(config, vm) {
      var isAuto = config.paths === 'auto';

      var expireKey = resolveExpireKey(config.namespace);
      var indexKey = resolveIndexKey(config.namespace);

      var isExpired = localStorage.getItem(expireKey) < Date.now();

      INDEXS = JSON.parse(localStorage.getItem(indexKey));

      if (isExpired) {
        INDEXS = {};
      } else if (!isAuto) {
        return
      }

      var paths = isAuto ? getAllPaths(vm.router) : config.paths;
      var len = paths.length;
      var count = 0;

      paths.forEach(function (path) {
        if (INDEXS[path]) {
          return count++
        }

        Docsify
          .get(vm.router.getFile(path), false, vm.config.requestHeaders)
          .then(function (result) {
            INDEXS[path] = genIndex(path, result, vm.router, config.depth);
            len === ++count && saveData(config.maxAge, expireKey, indexKey);
          });
      });
    }

    var NO_DATA_TEXT = '';
    var options;

    function style() {
      var code = "\n.sidebar {\n  padding-top: 0;\n}\n\n.search {\n  margin-bottom: 20px;\n  padding: 6px;\n  border-bottom: 1px solid #eee;\n}\n\n.search .input-wrap {\n  display: flex;\n  align-items: center;\n}\n\n.search .results-panel {\n  display: none;\n}\n\n.search .results-panel.show {\n  display: block;\n}\n\n.search input {\n  outline: none;\n  border: none;\n  width: 100%;\n  padding: 0 7px;\n  line-height: 36px;\n  font-size: 14px;\n}\n\n.search input::-webkit-search-decoration,\n.search input::-webkit-search-cancel-button,\n.search input {\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n}\n.search .clear-button {\n  width: 36px;\n  text-align: right;\n  display: none;\n}\n\n.search .clear-button.show {\n  display: block;\n}\n\n.search .clear-button svg {\n  transform: scale(.5);\n}\n\n.search h2 {\n  font-size: 17px;\n  margin: 10px 0;\n}\n\n.search a {\n  text-decoration: none;\n  color: inherit;\n}\n\n.search .matching-post {\n  border-bottom: 1px solid #eee;\n}\n\n.search .matching-post:last-child {\n  border-bottom: 0;\n}\n\n.search p {\n  font-size: 14px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  display: -webkit-box;\n  -webkit-line-clamp: 5;\n  -webkit-box-orient: vertical;\n}\n\n.search p.empty {\n  text-align: center;\n}\n\n.app-name.hide, .sidebar-nav.hide {\n  display: none;\n}";

      Docsify.dom.style(code);
    }

    function tpl(defaultValue) {
      if (defaultValue === void 0) defaultValue = '';

      var html =
        "<div class=\"input-wrap\">\n      <input type=\"search\" value=\"" + defaultValue + "\" />\n      <div class=\"clear-button\">\n        <svg width=\"26\" height=\"24\">\n          <circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"#ccc\" />\n          <path stroke=\"white\" stroke-width=\"2\" d=\"M8.25,8.25,15.75,15.75\" />\n          <path stroke=\"white\" stroke-width=\"2\"d=\"M8.25,15.75,15.75,8.25\" />\n        </svg>\n      </div>\n    </div>\n    <div class=\"results-panel\"></div>\n    </div>";
      var el = Docsify.dom.create('div', html);
      var aside = Docsify.dom.find('aside');

      Docsify.dom.toggleClass(el, 'search');
      Docsify.dom.before(aside, el);
    }

    function doSearch(value) {
      var $search = Docsify.dom.find('div.search');
      var $panel = Docsify.dom.find($search, '.results-panel');
      var $clearBtn = Docsify.dom.find($search, '.clear-button');
      var $sidebarNav = Docsify.dom.find('.sidebar-nav');
      var $appName = Docsify.dom.find('.app-name');

      if (!value) {
        $panel.classList.remove('show');
        $clearBtn.classList.remove('show');
        $panel.innerHTML = '';

        if (options.hideOtherSidebarContent) {
          $sidebarNav.classList.remove('hide');
          $appName.classList.remove('hide');
        }
        return
      }
      var matchs = search(value);

      var html = '';
      matchs.forEach(function (post) {
        html += "<div class=\"matching-post\">\n<a href=\"" + (post.url) + "\">\n<h2>" + (post.title) + "</h2>\n<p>" + (post.content) + "</p>\n</a>\n</div>";
      });

      $panel.classList.add('show');
      $clearBtn.classList.add('show');
      $panel.innerHTML = html || ("<p class=\"empty\">" + NO_DATA_TEXT + "</p>");
      if (options.hideOtherSidebarContent) {
        $sidebarNav.classList.add('hide');
        $appName.classList.add('hide');
      }
    }

    function bindEvents() {
      var $search = Docsify.dom.find('div.search');
      var $input = Docsify.dom.find($search, 'input');
      var $inputWrap = Docsify.dom.find($search, '.input-wrap');

      var timeId;
      // Prevent to Fold sidebar
      Docsify.dom.on(
        $search,
        'click',
        function (e) { return e.target.tagName !== 'A' && e.stopPropagation(); }
      );
      Docsify.dom.on($input, 'input', function (e) {
        clearTimeout(timeId);
        timeId = setTimeout(function (_) { return doSearch(e.target.value.trim()); }, 100);
      });
      Docsify.dom.on($inputWrap, 'click', function (e) {
        // Click input outside
        if (e.target.tagName !== 'INPUT') {
          $input.value = '';
          doSearch();
        }
      });
    }

    function updatePlaceholder(text, path) {
      var $input = Docsify.dom.getNode('.search input[type="search"]');

      if (!$input) {
        return
      }
      if (typeof text === 'string') {
        $input.placeholder = text;
      } else {
        var match = Object.keys(text).filter(function (key) { return path.indexOf(key) > -1; })[0];
        $input.placeholder = text[match];
      }
    }

    function updateNoData(text, path) {
      if (typeof text === 'string') {
        NO_DATA_TEXT = text;
      } else {
        var match = Object.keys(text).filter(function (key) { return path.indexOf(key) > -1; })[0];
        NO_DATA_TEXT = text[match];
      }
    }

    function updateOptions(opts) {
      options = opts;
    }

    function init(opts, vm) {
      var keywords = vm.router.parse().query.s;

      updateOptions(opts);
      style();
      tpl(keywords);
      bindEvents();
      keywords && setTimeout(function (_) { return doSearch(keywords); }, 500);
    }

    function update(opts, vm) {
      updateOptions(opts);
      updatePlaceholder(opts.placeholder, vm.route.path);
      updateNoData(opts.noData, vm.route.path);
    }

    var CONFIG = {
      placeholder: 'Type to search',
      noData: 'No Results!',
      paths: 'auto',
      depth: 2,
      maxAge: 86400000, // 1 day
      hideOtherSidebarContent: false,
      namespace: undefined
    };

    var install = function (hook, vm) {
      var util = Docsify.util;
      var opts = vm.config.search || CONFIG;

      if (Array.isArray(opts)) {
        CONFIG.paths = opts;
      } else if (typeof opts === 'object') {
        CONFIG.paths = Array.isArray(opts.paths) ? opts.paths : 'auto';
        CONFIG.maxAge = util.isPrimitive(opts.maxAge) ? opts.maxAge : CONFIG.maxAge;
        CONFIG.placeholder = opts.placeholder || CONFIG.placeholder;
        CONFIG.noData = opts.noData || CONFIG.noData;
        CONFIG.depth = opts.depth || CONFIG.depth;
        CONFIG.hideOtherSidebarContent = opts.hideOtherSidebarContent || CONFIG.hideOtherSidebarContent;
        CONFIG.namespace = opts.namespace || CONFIG.namespace;
      }

      var isAuto = CONFIG.paths === 'auto';

      hook.mounted(function (_) {
        init(CONFIG, vm);
        !isAuto && init$1(CONFIG, vm);
      });
      hook.doneEach(function (_) {
        update(CONFIG, vm);
        isAuto && init$1(CONFIG, vm);
      });
    };

    $docsify.plugins = [].concat(install, $docsify.plugins);

  }());
