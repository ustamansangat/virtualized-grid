/* jshint devel:true */
'use strict';

var _ = require('underscore');
var $ = require('jquery');
var _s = require('underscore.string');
var Backbone = require('backbone');

var mixinVirtualizedContainerTrait = require('../../lib/mixinVirtualizedContainerTrait');
var CLICK_ROW_EVENT = 'click .item-row';

/**
  This implementation assumes that simply marking/un-marking of "expanded"
  is sufficient. If a the template needs to change in more significant ways,
  one should NOT use this mixin.
**/
var mixinExpandableRows = function (self, options) {
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

  self.rowTemplate = _.wrap(self.rowTemplate, function (rowTemplate, rowModel) {
    var row = rowTemplate.apply(self, _.tail(arguments));
    if (expandedRows[rowModel.get(idProperty)]) {
      row = $(row).attr('expanded', '')[0].outerHTML;
    }
    return row;
  });

};


var PeopleView = Backbone.View.extend({

  template: _.template('<div data-id="<%- row.name %>"><%- row.name %> <address><%- row.address %></address></div>'),

  rowTemplate: function (rowModel) {
    return rowModel.get('heading') ?
      _s.sprintf('<div class="header" style="height:%dpx;">%s</div>', rowModel.get('height'), rowModel.get('heading')) :
      this.template({
        row: rowModel.toJSON()
      });
  },

  isIrregularRow: function (rowModel) {
    return rowModel.get('heading');
  },

  initialize: function (options) {
    Backbone.View.prototype.initialize.apply(this, arguments);
    mixinVirtualizedContainerTrait(this, options);
    mixinExpandableRows(this, options);
  }

});

var container = new PeopleView({
  el: $('people'),
  idProperty: 'name',
  collection: new Backbone.Collection(),
  RENDER_DELAY: 50,
  MAX_CACHE_COUNT: Infinity
});

_.times(100, function (index) {
  container.collection.add(new Backbone.Model( (index + 1) % 8 === 0 ?
    {
      heading: 'This is a header row',
      height: 10 * index
    } : {
      name: 'Person#' + _s.pad(index, 2, '0')
    })
  );
});

container.render();
