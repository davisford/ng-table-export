Export to CSV format for table
==============================

Code licensed under New BSD License.

## Installing via Bower
```
bower install ng-table-export
```

## Example

* [ngTable export to CSV](http://bazalt-cms.com/ng-table/example/15)

## IMPORTANT README
This is my fork of [esvit/ng-table-export](https://github.com/esvit/ng-table-export)

I made some considerable changes -- namely, I needed to [fix it to work with ng-table's pager](https://github.com/esvit/ng-table-export/issues/8).  If the pager is enabled, the export plugin would only export a page of data.  My fix is mostly a re-write, and it isn't perfect, but it seems to work for me.

Since the plugin scrapes the HTML table data, the trick is to force the table to turn off the pager, let the browser re-render the full table, and only **then** parse the table (afterwards restoring the pager, to be nice and all).

In order to make that work, the whole `ng-href="csv.link()"` wasn't going to work anymore, b/c the link would trigger a browser download before it had a chance to finish parsing the table and generate the data uri.  The solution there is to dynamically generate an `<a>` and click it -- only when it is ready.

If the table pager is not enabled, of course, it skips all this nonsense and just parses it and downloads.

I also added a few more tweaks:

* Changed the delmiter from semicolon to tab `,` -- you can change this or bind it via the scope if you want
* Added a small header to the csv so Excel will open it immediately without requiring you to `Import a file` -- it's a hint to Excel to use the right delimiter
* I added the ability to be able to pass in the filename
* Made it respect `colspan`, e.g. `<td colspan="3">` -- normally everything would be left aligned in the output file, and this is bad news when you have things like group headers that may span multiple columns.  It now respects these and the output is identical to the table formatting.

Hopefully someone finds it useful -- would love to hear any improvements -- the use of `$timeout` is pretty shady here, but I couldn't devise an event driven way to figure out when the browser had finished rendering the table so it was safe to parse.  

The usage has changed from the original.  Here's an example of how to use it:

```html
<a ng-click='csv.generate($event, "my-file.csv")' href=''></a>
```

`protip` on the controller $scope that this link would hang off, you can do this trick with angular expressions to dynamically generate the filename:

```html
<a ng-controller='MyCtrl' ng-click='csv.generate($event, filename() + ".csv")' href=''></a>
```

```javascript
angular.controller('MyCtrl', function ($scope) {
  $scope.filename = function () {
    // dynamic filename
    return Math.random();
  };
}
```

The rest of it is the same...place the directive on the table itself:

```html
<table ng-table='tableParams' export-csv='csv'></table>
```
