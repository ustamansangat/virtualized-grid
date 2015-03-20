/* jshint devel:true */
(function (define) {
'use strict';
define(function (require, exports, module) {



var _ = require('underscore');
var _s = require('underscore.string');
var $ = require('jquery');
var Backbone = require('backbone');

Backbone.$ = $;

/* @const */
var CLICK_ROW_EVENT = 'click .item-row';

/**
  This implementation assumes that simply marking/un-marking of "expanded"
  is sufficient. If a the template needs to change in more significant ways,
  one should NOT use this mixin.
**/
module.exports = function (self, options) {
  var expandedRows = {};
  var idProperty = options.idProperty || 'id';

  self.events = self.events || {};

  self.events[CLICK_ROW_EVENT] = _.wrap(
    (typeof self.events[CLICK_ROW_EVENT] === 'string' ? self[CLICK_ROW_EVENT] : self.events[CLICK_ROW_EVENT]) || _.noop,
    function (clickListener, event){
      clickListener.apply(self, _.tail(arguments));
      var $row = $(event.target).closest('.item-row');
      var id = $row.data('id');
      var expanded = $row.attr('expanded');
      if(expanded !== undefined) {
        $row.removeAttr('expanded');
        delete expandedRows[id];
        self.render();
      } else {
        $row.attr('expanded', '');
        expandedRows[id] = true;
        //not re-rendering because we assume an expanded row is bigger
      }
    });

  self.isIrregularRow = _.wrap(self.isIrregularRow, function (isIrregularRow, rowModel) {
    return isIrregularRow(rowModel) || expandedRows[rowModel.get(idProperty)];
  });

  self.drawRow = _.wrap(self.drawRow, function (drawRow, rowModel) {
    var $row = drawRow.apply(self, _.tail(arguments));
    if (expandedRows[rowModel.get(idProperty)]) {
      $row.attr('expanded', '');
    }
    return $row;
  });

};



});
}(
    /* global define */
    typeof define === 'function' && define.amd ? define :
                      function (factory) {
                        'use strict';
                        factory(require, exports, module);
                      }
));
