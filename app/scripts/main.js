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
        } else {
          $row.attr('expanded', '');
          this._expandedRows[id] = true;
        }
      }
    },

    idProperty: 'id',

    template: _.template('<div <%= expanded ? "expanded" : ""%> data-id="<%- rowId %>"><%- row.name %> <address><%- row.address %></address></div>'),

    rowTemplate: function (row) {
      return row.heading ? _.string.sprintf('<div class="header" style="height:%dpx;">%s</div>', row.height, row.heading) : this.template({
        expanded: this._expandedRows[row[this.idProperty]],
        rowId: row[this.idProperty],
        row: row
      });
    },

    getContent: function (index) {
      var future = $.Deferred();
      if (index < 0) {
        future.resolve({
          heading: 'This is a header row',
          height: 10 * index
        });
      } else {
        setTimeout(function (){
          future.resolve({
            name: 'Person#' + _.string.pad(index, 2, '0'),
            address: 'Address for\n item-row#' + index
          });
        }, _.random(5) * 0);
      }
      return future.promise();
    },

    isIrregularRow: function (row){
      return row.heading || this._expandedRows[row[this.idProperty]];
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
    model: new Backbone.Model({
      count: 100
    }),
    MAX_CACHE_COUNT: Infinity
  });

  container.render();
}.call(this));
