/* jshint devel:true */
'use strict';

var _ = require('underscore');
var $ = require('jquery');
var _s = require('underscore.string');
var Backbone = require('backbone');

var mixinVirtualizedContainerTrait = require('../../lib/mixinVirtualizedContainerTrait');

var PeopleView = Backbone.View.extend({

  events: {
    'click .item-row' : function (event){
      var $row = $(event.target).closest('.item-row');
      var id = $row.data('id');
      var expanded = $row.attr('expanded');
      if(expanded !== undefined) {
        $row.removeAttr('expanded');
        delete this._expandedRows[id];
        this.render();
      } else {
        $row.attr('expanded', '');
        this._expandedRows[id] = true;
      }
    }
  },

  idProperty: 'name',

  template: _.template('<div <%= expanded ? "expanded" : ""%> data-id="<%- row.name %>"><%- row.name %> <address><%- row.address %></address></div>'),

  rowTemplate: function (rowModel) {
    return rowModel.get('heading') ?
      _s.sprintf('<div class="header" style="height:%dpx;">%s</div>', rowModel.get('height'), rowModel.get('heading')) :
      this.template({
        expanded: this._expandedRows[rowModel.get(this.idProperty)],
        row: rowModel.toJSON()
      });
  },

  isIrregularRow: function (rowModel) {
    return rowModel.get('heading') || this._expandedRows[rowModel.get(this.idProperty)];
  },

  initialize: function (options) {
    Backbone.View.prototype.initialize.apply(this, arguments);
    mixinVirtualizedContainerTrait(this, options);
    this._expandedRows = {};
    this.idProperty = options.idProperty || this.idProperty;
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
