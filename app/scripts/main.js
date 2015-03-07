/* jshint devel:true */

var PeopleView = Backbone.View.extend({

  events: {
  'click .item-row:not(.loading)' : function (event){
      var $row = $(event.target).closest('.item-row');
      var index = $row.data('index');
      var expanded = $row.attr('expanded');
      if(expanded !== undefined) {
        $row.removeAttr('expanded');
        delete this._expandedRows[index];
      } else {
        $row.attr('expanded', '');
        this._expandedRows[index] = true;
      }
    }
  },

  rowTemplate: _.template('<div><%- name %> <address><%- address %></address></div>'),

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

  isIrregularRow: function (index){
    return index === 0 || this._expandedRows[index];
  },

  initialize: function (options) {
    Backbone.View.prototype.initialize.apply(this, arguments);
    mixinVirtualizedContainerTrait(this, options);
    this._expandedRows = {};
  }

});

var container = new PeopleView({
  el: $('people'),
  model: new Backbone.Model({
    count: 200000
  }),
  MAX_CACHE_COUNT: 40,
  WING_COUNT: 2
});

container.render();
