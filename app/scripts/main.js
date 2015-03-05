/* jshint devel:true */
var Container = Backbone.View.extend({
  template: _.template('<person data-id="<%- id %>"> <%- name %> (<%- age %>) <address><%- address %></address></person>'),
  render : function(){
    this.$el.empty();
    this.collection.forEach(function (model){
      this.$el.append(this.template(model.toJSON()))
    }.bind(this));
  }
});

var container = new Container({
  events: {
    'click person' : function (event){
      var $tile = $(event.target).closest('person');
      var personId = $tile.data('id');
      var expanded = $tile.attr('expanded');
      if(expanded !== undefined) {
        $tile.removeAttr('expanded');
      }  else {
        $tile.attr('expanded', '');
      }
    }
  },
  el: $('person-list'),
  collection: new Backbone.Collection()
});

_.times(5000, function(i){
  container.collection.add({
    id: i,
    age: 16 + (( 2 * i ) % 20),
    name: 'Person#' + _.string.pad(i, 2, '0'),
    address: 'Addres for\n person#' + i
  });
});
container.render();
