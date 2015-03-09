/* jshint devel:true */

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
    return this.template({
      expanded: this._expandedRows[row[this.idProperty]],
      rowId: row[this.idProperty],
      row: row
    });
  },

  getContent: function (index) {
    var future = $.Deferred();
    setTimeout(function (){
      future.resolve({
        name: 'Person#' + _.string.pad(index, 2, '0'),
        address: 'Address for\n item-row#' + index
      });
    }, _.random(5) * 100);
    return future.promise();
  },

  isIrregularRow: function (row){
    return this._expandedRows[row[this.idProperty]];
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
    count: 13
  }),
  MAX_CACHE_COUNT: 14,
  WING_COUNT: 0
});

container.render();
