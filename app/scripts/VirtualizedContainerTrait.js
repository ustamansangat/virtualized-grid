/* jshint devel:true */
/* @const */
var LAZY = _.uniqueId("LAZY");

mixinVirtualizedContainerTrait.LAZY = LAZY;

function mixinVirtualizedContainerTrait (self, options) {

  self.events = self.events || {};
  if (self.events.scroll) {
    throw new Error("Scroll event handler Note expected");
  }
  self.events.scroll = 'render';

  if (!_.isFunction(self.getContent)) {
    throw new Error('Method getContent() is not implemented');
  }
  if (!_.isFunction(self.rowTemplate)) {
    throw new Error('Method rowTemplate() is not implemented');
  }

  /*
    Expect RENDER_DELAY, MAX_CACHE_COUNT and WING_COUNT to be specified
  */
  var cfg = {
    RENDER_DELAY: options.RENDER_DELAY || 100,
    MAX_CACHE_COUNT: options.MAX_CACHE_COUNT || Infinity,
    WING_COUNT: options.WING_COUNT || 0,
    VIEWPORT_HEIGHT: parseInt(self.$el.css('height'), 10),
    ROW_HEIGHT: LAZY,
    WINDOW_COUNT: LAZY
  };

  var contentPromises = {};

  if (self.render !== Backbone.View.prototype.render) {
    throw new Error("No render implementation expected to be provided");
  }
  self.render = _.debounce(render, cfg.RENDER_DELAY);

  self.isIrregularRow = self.isIrregularRow || _.constant(false);

  function findRowByIndex(index) {
    return self.$(_.string.sprintf('.item-row[data-index=%d]', index));
  }

  function validateDimensions($row){
    if ($row.css('display') !== 'block') {
      throw new Error('display should be block for each row');
    }
    if (parseInt($row.css('margin-top'), 10) || parseInt($row.css('margin-bottom'), 10)) {
      throw new Error('vertical margins should be 0');
    }
    if ($row.css('box-sizing') !== 'border-box') {
      throw new Error('Only border-box supported.');
    }
    if(!self.isIrregularRow($row.data('index'))) {
      var actualHeight = parseInt($row.css('height'), 10);
      if (actualHeight !== cfg.ROW_HEIGHT) {
        throw new Error(_.string.sprintf('Height for row#%d is expected to be %d but found %d.', cfg.ROW_HEIGHT, actualHeight));
      }
    }
  }

  function renderRow(i) {
    return getCachedContent(i).then(function (content) {
      var $row = $(self.rowTemplate(content)).addClass('item-row').attr('data-index', i);
      if (i === 0) {
        $row.addClass('item-row-first');
      }
      if (i === self.model.attributes.count - 1) {
        $row.addClass('item-row-last');
      }
      return $row;
    });
  }

  function setupDimensions () {
    self.$el.empty();
    for (var i = 0; i < self.model.attributes.count; ++i) {
      if (!self.isIrregularRow(i)) break;
    }
    return renderRow(i).then(function ($row) {
      $row.appendTo(self.$el);
      cfg.ROW_HEIGHT = parseInt($row.css('height'), 10);
      cfg.WINDOW_COUNT = Math.floor(cfg.VIEWPORT_HEIGHT / cfg.ROW_HEIGHT) + 2; //2 partially visible rows on each end
      console.log(cfg);
      if (cfg.MAX_CACHE_COUNT < cfg.WINDOW_COUNT + 2 * cfg.WING_COUNT) {
        throw new Error(_.string.sprintf('We should cache more than the WINDOW + TWICE the WING (%d + 2 * %d)',
          cfg.WINDOW_COUNT, cfg.WING_COUNT));
      }
      self.$el.empty();
    });
  }

  function render() {
    console.log('SCROLLING ' , arguments);
    cfg.ROW_HEIGHT === LAZY ? setupDimensions().then(renderHelper) : renderHelper();
    return self;
  }

  function renderHelper () {
    if (self.fetching) {
      return;
    }
    /* @const */
    var scrollTop = self.$el.scrollTop();
    /* @const */
    //inclusive
    var visibleFrom = cfg.ROW_HEIGHT === LAZY ? 0 : _.max([0 , Math.floor(scrollTop / cfg.ROW_HEIGHT)]);
    /* @const */
    //exclusive
    var visibleTill = cfg.WINDOW_COUNT === LAZY ? this.model.attributes.count : _.min([visibleFrom + cfg.WINDOW_COUNT, self.model.attributes.count]);

    if (visibleFrom === visibleTill) {
      console.log('Nothing is visible');
      return;
    }
    if (findRowByIndex(visibleFrom).size() && findRowByIndex(visibleTill - 1).size()) {
      //Already rendered
      console.debug('Visible rows', visibleFrom, '-', visibleTill - 1,'are already in view');
      return;
    }

    var from = _.max([0 , visibleFrom - cfg.WING_COUNT]);
    var till = _.min([visibleTill + cfg.WING_COUNT, self.model.attributes.count]);
    var range = _.range(from, till);

    $.when.apply($, range.map(renderRow)).then(function () {
      self.$el.empty();
      if (cfg.ROW_HEIGHT !== LAZY) {
        self.$el.html(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>', from * cfg.ROW_HEIGHT));
      }
      Array.prototype.slice.call(arguments).forEach(function($row){
        self.$el.append($row);
      });
      if (cfg.ROW_HEIGHT !== LAZY) {
        self.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
          (self.model.attributes.count - till) * cfg.ROW_HEIGHT));
      }
      Array.prototype.slice.call(arguments).forEach(function($row){
        validateDimensions($row);
      });
      console.log("Rendered", from, till - 1);
      //self.$el.scrollTop(scrollTop);
      purgeCache(from, till);
    });
  }

  function getCachedContent(index) {
    var promise = contentPromises[index];
    if (!promise) {
      promise = contentPromises[index] = self.getContent(index);
    }
    return promise;
  }

  function purgeCache(from, till) {
    var population = _.size(contentPromises);
    if (population > cfg.MAX_CACHE_COUNT) {
      var i;

      var purgedOnes = []; //for debugging
      var leftDeletions = 0;
      for (i = 0; i < from; ++i) {
        if (_.has(contentPromises, i)) {
          delete contentPromises[i];
          purgedOnes.push(i);
        }
      }

      var rightDeletions = 0;
      for (i = self.model.attributes.count - 1; i > till - 1; --i) {
        if (_.has(contentPromises, i)) {
          delete contentPromises[i];
          purgedOnes.push(i);
        }
      }

      console.log(_.string.sprintf('Purged %d cached values [%s%s] out of %d, while rendering (%d to %d)',
        purgedOnes.length, _.string.join(',', _.take(purgedOnes, 5)), purgedOnes.length > 5 ? '...' : '', population, from, till - 1));
    }
  }

  return self;
};
