/* jshint devel:true */

(function () {
  'use strict';

  var _ = this._;
  var mixinVirtualizedContainerTrait = this.mixinVirtualizedContainerTrait;
  var Backbone = this.Backbone;

  var PeopleView = Backbone.View.extend({

    events: {
      'click .item-row:not(.loading)' : function (event){
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

    idProperty: 'id',

    template: _.template('<div <%= expanded ? "expanded" : ""%> data-id="<%- row.id %>"><%- row.name %> <address><%- row.address %></address></div>'),

    rowTemplate: function (rowModel) {
      return rowModel.get('heading') ?
        _.string.sprintf('<div class="header" style="height:%dpx;">%s</div>', rowModel.get('height'), rowModel.get('heading')) :
        this.template({
          expanded: this._expandedRows[rowModel.get(this.idProperty)],
          row: rowModel.toJSON()
        });
    },

    isIrregularRow: function (rowModel){
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
    MAX_CACHE_COUNT: Infinity
  });

  _.times(100, function (index) {
    container.collection.add(new Backbone.Model( (index + 1) % 8 === 0 ?
      {
        heading: 'This is a header row',
        height: 10 * index,
        id: 'p' + index
      } : {
        name: 'Person#' + _.string.pad(index, 2, '0'),
        id: 'p' + index
      })
    );
  });

  container.render();
}.call(this));
