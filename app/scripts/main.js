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
        RENDER_DELAY: options.RENDER_DELAY || 1000,
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
      var renderPlaceholders = this.render.bind(this, true);
      var renderActualRows = _.debounce(this.render.bind(this, false), this.cfg.RENDER_DELAY);
      this.render = function () {
        renderPlaceholders();
        renderActualRows();
      }.bind(this);
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
        for (i = 0; i < index - this.cfg.MAX_CACHE_COUNT/2 && leftDeletions < this.cfg.WING_COUNT; ++i) {
            if (_.has(this._contentPromises, i)) {
              delete this._contentPromises[i];
              ++ leftDeletions;
            }
        }

        var rightDeletions = 0;
        for (i = this.model.get('count') - 1; i > index + this.cfg.MAX_CACHE_COUNT/2 && rightDeletions < this.cfg.WING_COUNT; --i) {
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
  render : function(isScrolling) {
    var from = Math.floor(this.$el.scrollTop() / this.cfg.ROW_HEIGHT);
    var till = _.min([from + this.cfg.WINDOW_COUNT, this.model.get('count')]);
    this.$el.html(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>', from * this.cfg.ROW_HEIGHT));
    if(!isScrolling) {
      _.range(_.max([0, from - this.cfg.WING_COUNT]), from).forEach(function (i) {
        this.getContent(i);
      }.bind(this));
      _.range(till, _.min([till + this.cfg.WING_COUNT, this.model.get('count')])).forEach(function (i) {
        this.getContent(i);
      }.bind(this));
    }
    var placeholders = [];
    var actuals = [];
    _.range(from, till).forEach(function (i){
      var $tile = $(this.tileTemplate({index: i})).appendTo(this.$el);
      if (i == 0) {
        $tile.addClass('first');
      }
      if (i == this.model.get('count') - 1) {
        $tile.addClass('last');
      }
      var resolved = this._contentPromises[i] && this._contentPromises[i].state() === 'resolved';
      if (!isScrolling || resolved) {
        actuals.push(this.getContent(i).then(function (content){
          this.$(_.string.sprintf('person[data-index=%d]', i)).html(this.tileContentTemplate(content)).removeClass('loading');
          return i;
        }.bind(this)));
      } else {
        placeholders.push(i);
      }
    }.bind(this));
    if (actuals.length) {
      $.when.apply($, actuals).then(function (){
        console.debug('Rendering actual rows:', arguments);
      });
    }
    if (placeholders.length) {
      console.debug('Rendering placeholder rows:', placeholders);
    }
    this.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
      (this.model.get('count') - till) * this.cfg.ROW_HEIGHT));
  }
});

var container = new Container({
  MAX_CACHE_COUNT: 64,
  el: $('person-list'),
  model: new Backbone.Model({
    count: 150000
  })
});

container.render();
