/* jshint devel:true */
var  rowTemplate = _.template('<div class="item-row loading" data-index="<%- index %>"></div>');

/* @const */
var LAZY = _.uniqueId("LAZY");

function mixinVirtualizedContainerTrait (self, options) {
  self.events = self.events || {};
  self.events.scroll = 'render';
  /*{
    'scroll': 'render',
    'click .item-row:not(.loading)' : function (event){
      var $tile = $(event.target).closest('.item-row');
      var index = $tile.data('index');
      var expanded = $tile.attr('expanded');
      if(expanded !== undefined) {
        $tile.removeAttr('expanded');
      }  else {
        $tile.attr('expanded', '');
      }
    }
  },*/

  if (!_.isFunction(self.getContent)) {
    throw new Error('Method getContent() is not implemented');
  }
  if (!_.isFunction(self.rowInternalTemplate)) {
    throw new Error('Method rowInternalTemplate() is not implemented');
  }

  /*
    Expect RENDER_DELAY, MAX_CACHE_COUNT and WING_COUNT to be specified
  */
  var cfg = {
    VIEWPORT_HEIGHT: parseInt(self.$el.css('height'), 10),
    RENDER_DELAY: options.RENDER_DELAY || 500,
    MAX_CACHE_COUNT: options.MAX_CACHE_COUNT || Infinity,
    WING_COUNT: options.WING_COUNT || 5,
    ROW_HEIGHT: LAZY,
    WINDOW_COUNT: LAZY
  };

  var expandedRows = {};
  var contentPromises = {};

  if (self.render !== Backbone.View.prototype.render) {
    throw new Error("No render implementation expected to be provided");
  }
  self.render = function() {
    renderOnce();
    renderAlways();
  }

  self.getIrregularRows = self.getIrregularRows || _.constant({});

  function fingRowByIndex(index) {
    return self.$(_.string.sprintf('.item-row[data-index=%d]', index));
  }

  function isIrregularOrExpandedRow(i) {
    return _.has(self.getIrregularRows(), i) || _.has(expandedRows, i);
  }

  function validateDimensions($row){
    if ($row.css('display') !== 'block') {
      throw new Error('display should be block for each row');
    }
    if (parseInt($row.css('margin-top'), 10) || parseInt($row.css('margin-bottom'), 10)) {
      throw new Error('vertical margins should be 0');
    }
    if ($row.css('box-sizing') === 'border-box') {
      if (parseInt($row.css('height'), 10) !== cfg.ROW_HEIGHT) {
        throw new Error(_.string.sprintf('Height for row#%d is expected to be %d but found %d.', cfg.ROW_HEIGHT, $row.css('height')));
      }
    } else {
      throw new Error('Only border-box supported.');
    }
  }

  var renderOnce = _.once(function () {
    self.$el.empty();
    for (var i = 0; i < self.model.attributes.count && i !== cfg.WINDOW_COUNT && cfg.ROW_HEIGHT === LAZY; ++i) {
      var $row = $(rowTemplate({index: i})).appendTo(self.$el);
      if (!isIrregularOrExpandedRow(i) && cfg.ROW_HEIGHT === LAZY) {
        cfg.ROW_HEIGHT = parseInt($row.css('height'), 10);
        cfg.WINDOW_COUNT = Math.ceil(cfg.VIEWPORT_HEIGHT / cfg.ROW_HEIGHT) + 1;
        console.log('cfg', cfg);
        if (cfg.MAX_CACHE_COUNT < cfg.WINDOW_COUNT + 2 * cfg.WING_COUNT) {
          throw new Error(_.string.sprintf('We should cache more than the WINDOW + TWICE the WING (%d + 2 * %d)',
            cfg.WINDOW_COUNT, cfg.WING_COUNT));
        }
        validateDimensions($row, cfg.ROW_HEIGHT);
      }
    }
    self.$el.empty();
    return renderAlways();
  });

  var renderAlways = _.debounce(function () {
    /* @const */
    var scrollTop = self.$el.scrollTop();
    /* @const */
    //inclusive
    var visibleFrom = _.max([0 , Math.floor(scrollTop / cfg.ROW_HEIGHT)]);
    /* @const */
    //exclusive
    var visibleTill = _.min([visibleFrom + cfg.WINDOW_COUNT, self.model.attributes.count]);

    if (visibleFrom === visibleTill) {
      console.log('Nothing is visible');
      return;
    }
    if (fingRowByIndex(visibleFrom).size() && fingRowByIndex(visibleTill - 1).size()) {
      //Already rendered
      console.debug('Visible rows are already in view');
      return;
    }

    var from = _.max([0 , visibleFrom - cfg.WING_COUNT]);
    var till = _.min([visibleTill + cfg.WING_COUNT, self.model.attributes.count]);
    var range = _.range(from, till);

    self.$el.html(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>',
      from * cfg.ROW_HEIGHT));
    range.forEach(function (i){
      self.$el.append(rowTemplate({index: i}));
    });
    self.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
      (self.model.attributes.count - till) * cfg.ROW_HEIGHT));

    self.$el.scrollTop(scrollTop);

    range.forEach(function (i) {
      getCachedContent(i).then(function (content){
        var $row = fingRowByIndex(i);
        if ($row.size()) {
          $row.html(self.rowInternalTemplate(content)).removeClass('loading');
          if (i >= visibleFrom && i < visibleTill && !isIrregularOrExpandedRow (i)) {
            //for performance reasons we only validate these properties for visible rows.
            validateDimensions($row);
          }
          if (i === 0) {
            $row.addClass('item-row-first');
          }
          if (i === self.model.attributes.count - 1) {
            $row.addClass('item-row-last');
          }
        }
      });
    });


    return self;
  }, cfg.RENDER_DELAY);

  function getCachedContent(index) {
    var promise = contentPromises[index];
    if (!promise) {
      promise = contentPromises[index] = self.getContent(index);
      var population = _.size(contentPromises);
      if (population > cfg.MAX_CACHE_COUNT) {
        var firstOne = self.$('.item-row:first').data('index');
        var lastOne = self.$('.item-row:last').data('index');
        var i;

        var purgedOnes = []; //for debugging
        var leftDeletions = 0;
        for (i = 0; i < firstOne; ++i) {
          if (_.has(contentPromises, i)) {
            delete contentPromises[i];
            purgedOnes.push(i);
          }
        }

        var rightDeletions = 0;
        for (i = self.model.attributes.count - 1; i > lastOne; --i) {
          if (_.has(contentPromises, i)) {
            delete contentPromises[i];
            purgedOnes.push(i);
          }
        }

        console.log(_.string.sprintf('Purged %d cached values [%s%s] out of %d, while rendering (%d to %d)',
          purgedOnes.length, _.string.join(',', _.take(purgedOnes, 5)), purgedOnes.length > 5 ? '...' : '', population, firstOne, lastOne));
      }
    }
    return promise;
  }

  return self;
};
