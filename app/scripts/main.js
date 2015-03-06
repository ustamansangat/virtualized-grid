/* jshint devel:true */

var PeopleView = Backbone.View.extend({

  rowInternalTemplate: _.template('<%- name %> <address><%- address %></address>'),

  getContent: function (index) {
    var future = $.Deferred();
    setTimeout(function (){
      future.resolve({
        name: 'Person#' + _.string.pad(index, 2, '0'),
        address: 'Address for\n item-row#' + index
      });
    }, _.random(5) * 200);
    return future.promise();
  },

  initialize: function (options) {
    Backbone.View.prototype.initialize.apply(this, arguments);
    mixinVirtualizedContainerTrait(this, options);
  }

});

var container = new PeopleView({
  MAX_CACHE_COUNT: 70,
  WING_RATIO: 0.1,
  el: $('people'),
  model: new Backbone.Model({
    count: 270
  }),
});

container.render();
