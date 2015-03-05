/* jshint devel:true */

/** @const **/
var WINDOW = 10;
/** @const **/
var VIEWPORT_HEIGHT = 500;
/** @const **/
var ROW_HEIGHT = 50;
/** @const **/
var SCROLLING = _.uniqueId('SCROLLING');
/** @const **/
var NOT_SCROLLING = _.uniqueId('SCROLLING');


var Container = Backbone.View.extend({
  getHeightByIndex: function (index) {
    return ROW_HEIGHT;
  },
  initialize: function(){
      this._contentPromises = {};
  },
  tileTemplate: _.template('<person data-index="<%- index %>" class="loading"></person>'),
  tileContentTemplate: _.template('<%- name %> (<%- age %>) <address><%- address %></address>'),
  getContent: function (index) {
    var promise = this._contentPromises[index];
    if(!promise) {
      var future = $.Deferred();
      promise = future.promise();
      this._contentPromises[index] = future.promise();
      setTimeout(function (){
        future.resolve({
          index: index,
          age: 16 + (( 2 * index ) % 20),
          name: 'Person#' + _.string.pad(index, 2, '0'),
          address: 'Addres for\n person#' + index
        });
      }, 1000);
    }
    return promise;
  },
  _render : function(scrolling){
    var from = Math.floor(this.$el.scrollTop() / ROW_HEIGHT);
    var till = _.min([from + WINDOW, this.model.get('count')]);
    this.$el.html(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>', from * ROW_HEIGHT));
    _.range(from, till).forEach(function (i){
      var $tile = $(this.tileTemplate({index: i})).appendTo(this.$el);
      if (i == 0) {
        $tile.addClass('first');
      }
      if (i == this.model.get('count') - 1) {
        $tile.addClass('last');
      }
      var preFetched = this._contentPromises[i] && this._contentPromises[i].state() === 'resolved';
      if (scrolling === NOT_SCROLLING || preFetched) {
        this.getContent(i).then(function (content){
          this.$(_.string.sprintf('person[data-index=%d]', i)).html(this.tileContentTemplate(content)).removeClass('loading');
        }.bind(this));
      }
    }.bind(this));
    this.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
      (this.model.get('count') - till) * ROW_HEIGHT));
  },
  render: function (){
    this._render(NOT_SCROLLING);
  }
});

var container = new Container({
  events: {
    'scroll': function (){
      this._render(SCROLLING);
      if(!this._debouncedRender) {
        this._debouncedRender = _.debounce(this.render.bind(this, NOT_SCROLLING), 100);
      }
      this._debouncedRender();
    },
    'click person:not(.loading)' : function (event){
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
  model: new Backbone.Model({
    count: 15
  })
});

container.render();
