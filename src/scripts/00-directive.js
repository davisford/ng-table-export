angular.module('ngTableExport', [])
.config(['$compileProvider', function($compileProvider) {
    // allow data links
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|data):/);
}])
.directive('exportCsv', ['$parse', '$timeout', function ($parse, $timeout) {

  var delimiter = '\t';
  var header = 'data:text/csv;charset=UTF-8,';

  return {
      restrict: 'A',
      scope: false,

      /**
       * scope is table scope, element is <table>
       */
      link: function(scope, element, attrs) {

          var data = '';

          // allow pass in of delimiter via directive attrs
          if (attrs.delimiter) { delimiter = attrs.delimiter; }

          function stringify(str) {
            return '"' +
              str.replace(/^\s\s*/, '').replace(/\s*\s$/, '') // trim spaces
                 .replace(/"/g,'""') + // replace quotes with double quotes
              '"';
          }

          /**
           * Parse the table and build up data uri
           */
          function parseTable() {
            data = '';
            var rows = element.find('tr');
            angular.forEach(rows, function(row, i) {
              var tr = angular.element(row),
                tds = tr.find('th'),
                rowData = '';
              if (tr.hasClass('ng-table-filters')) {
                return;
              }
              if (tds.length === 0) {
                tds = tr.find('td');
              }
              if (i !== 1) {
                angular.forEach(tds, function(td) {
                  // respect colspan in row data
                  rowData += stringify(angular.element(td).text()) + Array.apply(null, Array(td.colSpan)).map(function () { return delimiter; }).join('');
                });
                rowData = rowData.slice(0, rowData.length - 1); //remove last semicolon
              }
              data += rowData + '\n';
            });
            // add delimiter hint for excel so it opens without having to import
            data = 'sep=' + delimiter + '\n' + data;
          }

          /**
           * Dynamically generate a link and click it; works in chrome + firefox; unfortunately, safari
           * does not support the `download` attribute, so it ends up opening the file in a new tab https://bugs.webkit.org/show_bug.cgi?id=102914
           */
          function download(dataUri, filename) {
            // tested in chrome / firefox / safari
            var link = document.createElement('a');
            // chrome + firefox
            link.style.display = 'none';
            link.href = dataUri;
            link.download = filename;
            link.target = '_blank';
            // needs to get wrapped to play nicely with angular $digest
            // else may cause '$digest already in progress' errors with other angular controls (e.g. angular-ui dropdown)
            $timeout(function () {
              // must append to body for firefox; chrome & safari don't mind
              document.body.appendChild(link);
              link.click();
              // destroy
              document.body.removeChild(link);
            }, 0, false);
          }

          var csv = {
            /**
             *  Generate data URI from table data
             */
            generate: function(event, filename, table, currentPageOnly) {

              var isNgTable = attrs.ngTable,
                table = table || scope.$parent.tableParams,
                settings = table ? table.settings() : {},
                cnt = table ? table.count() : {},
                total = table ? settings.total : {},
                currentPageOnly = currentPageOnly === undefined ? false : currentPageOnly;

              // is pager on?  if so, we have to disable it temporarily
              if (!currentPageOnly && isNgTable && cnt < total) {
                var $off = settings.$scope.$on('ngTableAfterReloadData', function () {
                  // de-register callback so it won't continue firing
                  $off();
                  // give browser some time to re-render; FIXME - no good way to know when rendering is done?
                  $timeout(function () {
                    // generate data from table
                    parseTable();
                    // finally, restore original table cnt
                    table.count(cnt);
                    table.reload();
                    // dynamically trigger download
                    download(header + encodeURIComponent(data), filename);
                  }, 1000, false);
                });

                // disable the pager and reload the table so we get all the data
                table.count(Infinity);
                table.reload();

              } else {
                // pager isn't on, just parse the table
                parseTable();
                download(header + encodeURIComponent(data), filename);
              }
            }
          };

          // attach csv to table scope
          $parse(attrs.exportCsv).assign(scope.$parent, csv);
      }
  };
}]);
