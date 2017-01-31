angular.module('ngTableExport', [])
.config(['$compileProvider', function($compileProvider) {
    // allow data links
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|data):/);
}])
.directive('exportCsv', ['$parse', '$timeout', 'ngTableEventsChannel', function ($parse, $timeout, ngTableEventsChannel) {

  var delimiter = ',';
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

          // custom for user agent detection
          // http://stackoverflow.com/questions/5916900/how-can-you-detect-the-version-of-a-browser
          function detectBrowser() {
            var ua = navigator.userAgent, tem,
              M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
            if (/trident/i.test(M[1])) {
              tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
              return 'IE ' + (tem[1] || '');
            }
            if (M[1] === 'Chrome') {
              tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
              if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
            }
            M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
            if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
            return M.join(' ');
          }

          // custom extension for IE
          function downloadForIE(dataURI, filename) {

            // http://stackoverflow.com/questions/12168909/blob-from-dataurl
            function dataURItoBlob(dataURI) {

              var decodedURI = decodeURIComponent(dataURI.split(',')[1]);
              var byteString =  decodedURI;

              // separate out the mime component
              var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

              // write the bytes of the string to an ArrayBuffer
              var ab = new ArrayBuffer(byteString.length);
              var ia = new Uint8Array(ab);
              for (var i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }

              // write the ArrayBuffer to a blob, and you're done
              var blob = new Blob([ab], { type: mimeString });
              return blob;

              // Old code
              // var bb = new BlobBuilder();
              // bb.append(ab);
              // return bb.getBlob(mimeString);
            }

            var blob = dataURItoBlob(dataURI);
            window.navigator.msSaveBlob(blob, filename);
          }

          /**
           * Dynamically generate a link and click it; works in chrome + firefox; unfortunately, safari
           * does not support the `download` attribute, so it ends up opening the file in a new tab https://bugs.webkit.org/show_bug.cgi?id=102914
           */
          function download(dataUri, filename, scope) {
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
              try {

                // must append to body for firefox; chrome & safari don't mind
                document.body.appendChild(link);

                var browser = detectBrowser();

                if (browser.indexOf('IE') !== -1 || browser.indexOf('Edge') !== -1) {
                  downloadForIE(dataUri, filename);
                } else {
                  link.click();
                }
                // destroy
                document.body.removeChild(link);

              } catch (err) {
                console.error('NG Table Export Error saving file on client.');
                throw (err);
              }
            }, 0, false);
          }

          var csv = {
            /**
             *  Generate data URI from table data
             */
            generate: function(event, filename, table) {

              var isNgTable = attrs.ngTable,
                table = table || scope.$parent.tableParams,
                settings = table ? table.settings() : {},
                cnt = table ? table.count() : {},
                total = table ? settings.total : {};

              // is pager on?  if so, we have to disable it temporarily
              if (isNgTable && cnt < total) {
                var $off = ngTableEventsChannel.onAfterReloadData(function () {
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
                    download(header + encodeURIComponent(data), filename, scope);
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
