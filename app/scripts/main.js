/* jshint devel:true */


var Container = Backbone.View.extend({
  getHeightByIndex: function (index) {
    return ROW_HEIGHT;
  },
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
  /*
    Expect ROW_HEIGHT, RENDER_DELAY and WING_RATIO to be specified
  */
  initialize: function(options){
      this.cfg = {
        VIEWPORT_HEIGHT: parseInt(this.$el.css('height'), 10),
        ROW_HEIGHT: options.ROW_HEIGHT || 50,
        RENDER_DELAY: options.RENDER_DELAY || 500,
        MAX_CACHE_COUNT: options.MAX_CACHE_COUNT || Infinity,
        WING_RATIO: options.WING_RATIO || 1
      };
      this.cfg.WINDOW_COUNT = Math.ceil(this.cfg.VIEWPORT_HEIGHT / this.cfg.ROW_HEIGHT) + 1;
      this.cfg.WING_COUNT = Math.ceil(this.cfg.WING_RATIO * this.cfg.WINDOW_COUNT);
      console.log('cfg', this.cfg);
      if(this.cfg.MAX_CACHE_COUNT < this.cfg.WINDOW_COUNT + 2 * this.cfg.WING_COUNT) {
        throw new Error('We should cache many fold more than the WINDOW + TWICE the WINGs');
      }
      this._contentPromises = {};
      this.render = _.debounce(this.render.bind(this), this.cfg.RENDER_DELAY);
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
          address: 'Address for\n person#' + index
        });
      }, 1000);
      var population = _.size(this._contentPromises);
      if (population > this.cfg.MAX_CACHE_COUNT) {
        var i;

        var leftDeletions = 0;
        var MAX_DELETIONS = _.min([this.cfg.WING_COUNT, this.cfg.WINDOW_COUNT]);
        for (i = 0; i < index - this.cfg.MAX_CACHE_COUNT/2 && leftDeletions < MAX_DELETIONS; ++i) {
            if (_.has(this._contentPromises, i)) {
              delete this._contentPromises[i];
              ++ leftDeletions;
            }
        }

        var rightDeletions = 0;
        for (i = this.model.get('count') - 1; i > index + this.cfg.MAX_CACHE_COUNT/2 && rightDeletions < MAX_DELETIONS; --i) {
            if (_.has(this._contentPromises, i)) {
              delete this._contentPromises[i];
              ++ rightDeletions;
            }
        }
        console.log(_.string.sprintf('Purged %d cached values our of %d', leftDeletions + rightDeletions, population));
      }
    }
    return promise;
  },
  render : function() {
    var from = _.max([0 , Math.floor(this.$el.scrollTop() / this.cfg.ROW_HEIGHT)]);
    var till = _.min([from + this.cfg.WINDOW_COUNT, this.model.get('count')]);
    var self = this;

    function findTileByIndex(index) {
      return self.$(_.string.sprintf('person[data-index=%d]', index));
    }

    if (findTileByIndex(from).size() && findTileByIndex(till).size()) {
      console.log('Already rendered')
      return;
    }

    console.log('Visible range', from, '-', till);
    from = _.max([0 , from - this.cfg.WING_COUNT]);
    till = _.min([till + this.cfg.WING_COUNT, this.model.get('count')]);
    console.log('Rendering', from, '-', till);

    var range = _.range(from, till);

    this.$el.html(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>', from * this.cfg.ROW_HEIGHT));

    var loading = []; //for logging

    range.forEach(function (i){
      var $tile = $(self.tileTemplate({index: i})).appendTo(self.$el);
      if (i == 0) {
        $tile.addClass('first');
      }
      if (i == self.model.get('count') - 1) {
        $tile.addClass('last');
      }
      var contentPromise = self.getContent(i);
      if (contentPromise.state() !== 'resolved') {
        loading.push(i);
      }
      contentPromise.then(function (content){
        findTileByIndex(i).html(self.tileContentTemplate(content)).removeClass('loading');
      });
    });

    if (loading.length) {
      console.debug('Loading', loading.length, 'rows');
    }

    this.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
      (this.model.get('count') - till) * this.cfg.ROW_HEIGHT));
  }
});

var container = new Container({
  MAX_CACHE_COUNT: 128,
  WING_RATIO: 4,
  el: $('person-list'),
  model: new Backbone.Model({
    count: 1000
  })
});

container.render();
