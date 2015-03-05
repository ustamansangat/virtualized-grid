/* jshint devel:true */


var Container = Backbone.View.extend({
  getHeightByIndex: function (index) {
    return ROW_HEIGHT;
  },
  /*
    Expect ROW_HEIGHT, RENDER_DELAY and WING_RATIO to be specified
  */
  initialize: function(options){
      this.cfg = {
        VIEWPORT_HEIGHT : parseInt(this.$el.css('height'), 10),
        ROW_HEIGHT : options.ROW_HEIGHT || 50,
        RENDER_DELAY : options.RENDER_DELAY || 500
      };
      this.cfg.WINDOW_COUNT = Math.ceil(this.cfg.VIEWPORT_HEIGHT / this.cfg.ROW_HEIGHT) + 1;
      this.cfg.WING_COUNT = Math.ceil((options.WING_RATIO || 0.25) * this.cfg.WINDOW_COUNT);
      console.log('cfg', this.cfg);
      this._contentPromises = {};
      var originalRender = this.render.bind(this, true);
      var debouncedRender = _.debounce(this.render.bind(this, false), this.cfg.RENDER_DELAY);
      this.render = function () {
        originalRender();
        debouncedRender();
      }.bind(this);
  },
  tileTemplate: _.template('<person data-index="<%- index %>" class="loading"></person>'),
  tileContentTemplate: _.template('<%- name %> (<%- age %>) <address><%- address %></address>'),
  getContent: function (index, tag) {
    var promise = this._contentPromises[index];
    if(!promise) {
      console.debug(tag || 'fetching row#', index);
      var future = $.Deferred();
      promise = future.promise();
      this._contentPromises[index] = future.promise();
      setTimeout(function (){
        future.resolve({
          index: index,
          age: 16 + (( 2 * index ) % 20),
          name: 'Person#' + _.string.pad(index, 2, '0'),
          address: 'Address for\n person#' + index
        });
      }, 1000);
    }
    return promise;
  },
  render : function(scrolling) {
    var from = Math.floor(this.$el.scrollTop() / this.cfg.ROW_HEIGHT);
    var till = _.min([from + this.cfg.WINDOW_COUNT, this.model.get('count')]);
    this.$el.html(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>', from * this.cfg.ROW_HEIGHT));
    if(!scrolling) {
      _.range(_.max([0, from - this.cfg.WING_COUNT]), from).forEach(function (i) {
        this.getContent(i, 'pre-fetching prefix row#');
      }.bind(this));
      _.range(till, _.min([till + this.cfg.WING_COUNT, this.model.get('count')])).forEach(function (i) {
        this.getContent(i, 'pre-fetching suffix row#');
      }.bind(this));
    }
    _.range(from, till).forEach(function (i){
      var $tile = $(this.tileTemplate({index: i})).appendTo(this.$el);
      if (i == 0) {
        $tile.addClass('first');
      }
      if (i == this.model.get('count') - 1) {
        $tile.addClass('last');
      }
      var resolved = this._contentPromises[i] && this._contentPromises[i].state() === 'resolved';
      if (! scrolling || resolved) {
        this.getContent(i).then(function (content){
          console.debug('Rendering actual row#', i);
          this.$(_.string.sprintf('person[data-index=%d]', i)).html(this.tileContentTemplate(content)).removeClass('loading');
        }.bind(this));
      } else {
          console.debug('Rendering placeholder row#', i);
      }
    }.bind(this));
    this.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
      (this.model.get('count') - till) * this.cfg.ROW_HEIGHT));
  }
});

var container = new Container({
  events: {
    'scroll': 'render',
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
    count: 150
  })
});

container.render();
