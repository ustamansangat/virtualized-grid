/* jshint devel:true */
(function() {
  'use strict';
  var root = this;

  var _ = this._;
  var Backbone = this.Backbone;
  var mixinContentCachingTrait = this.mixinContentCachingTrait;

  /* @const */
  var LAZY = _.uniqueId('LAZY');
  var FORWARD = +1;
  var REVERSE = -1;

  function mixinVirtualizedContainerTrait (self, options) {
    mixinContentCachingTrait(self, options);
    self.events = self.events || {};
    if (self.events.scroll) {
      throw new Error('Scroll event handler Note expected');
    }
    self.events.scroll = function () {
      self.render();//since this is de-bounced, we want to suppress passing arguments to it
    };

    if (!_.isFunction(self.getContent)) {
      throw new Error('Method getContent() is not implemented');
    }
    if (!_.isFunction(self.rowTemplate)) {
      throw new Error('Method rowTemplate() is not implemented');
    }
    if (['auto', 'scroll'].indexOf(self.$el.css('overflow-y')) === -1 ){
      throw new Error('Overflow must be auto or scroll');
    }

    /*
      Expect RENDER_DELAY, MAX_CACHE_COUNT and WING_COUNT to be specified
    */
    var ROW_HEIGHT = LAZY;

    if (self.render !== Backbone.View.prototype.render) {
      throw new Error('No render implementation expected to be provided');
    }
    self.render = _.debounce(function () {
                      //try to find the height of a "regular" row the FIRST time we render one
                      if (ROW_HEIGHT === LAZY) {
                        setupDimensions().always(render);
                      } else {
                        render();
                      }
                      return self;
                    }, options.RENDER_DELAY || 100);

    self.isIrregularRow = self.isIrregularRow || _.constant(false);

//    function findRowByIndex(index) {
//      return self.$(_.string.sprintf('.item-row[data-index=%d]', index));
//    }

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
      self.getContent($row.data('index')).then(function (row) {
        if (!self.isIrregularRow(row)) {
          var actualHeight = parseInt($row.css('height'), 10);
          if (actualHeight !== ROW_HEIGHT) {
            throw new Error(_.string.sprintf('Height for %s is expected to be %d but found %d.', JSON.stringify(row), ROW_HEIGHT, actualHeight));
          }
        }
      });
    }

    /** draws the ith row and attaches index and css classes */
    function prepareRow(i) {
      return self.getContent(i).then(function (content) {
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

      function helper(i){
        return i >= self.model.attributes.count ? $.Deferred().reject() : self.getContent(i).then(function (row) {
          return self.isIrregularRow(row) ? helper(i + 1) : prepareRow(i).then(function ($row) {
            $row.appendTo(self.$el);
            ROW_HEIGHT = parseInt($row.css('height'), 10);
            self.$el.empty();
          });
        });
      }
      return helper(0);
    }

    function getHeight($el) {
      return parseInt($el.css ? $el.css('height') : $.css($el, 'height'), 10);
    }

    function render () {
      /* @const */
      var scrollTop = self.$el.scrollTop();
      var deltaScroll = 0;
      var direction = null;
      var from;

      (function () {
        var $rows = self.$('.item-row');
        if ($rows.size() === 0) {
          from = 0;
          direction = FORWARD;
          return;
        }
        var cumulativeHeights = $rows.map(function (_, r){
          return getHeight(r);
        }).toArray().reduce(function (acc, h, i) {
          acc.push(i === 0 ? h : h + acc[i - 1]);
          return acc;
        }, []);
        var topMark = getHeight(self.$('prefix'));
        var marks = cumulativeHeights.map(function (ah) {
          return ah + topMark;
        });
        var targetMarks = cumulativeHeights.map(function (ah) {
          return ah + scrollTop;
        });
        var index;
        if (scrollTop > _.last(marks) || _.last(targetMarks) < topMark) {
          from = ROW_HEIGHT === LAZY ? 0 : _.max([0 , Math.floor(scrollTop / ROW_HEIGHT)]);
          direction = FORWARD;
        } else {
          if (scrollTop < topMark) {
             //Scrolled Up / Swiped Down / See Previous
            index = _.findIndex(marks, function (m) {
              return m >= _.last(targetMarks);
            }) - 1;
            deltaScroll = _.last(targetMarks) - marks[index];
            direction = REVERSE;
          } else {
            //Scrolled Down / Swiped up / See Next
            index = _.findIndex(marks, function (m) {
              return m >= scrollTop;
            });
            deltaScroll = scrollTop - (marks[index - 1] || topMark);
            direction = FORWARD;
          }
          from = $.data($rows.get(index), 'index');
        }
        if (self.$('.item-row:first').data('index') === from && direction === FORWARD) {
          direction = null;
        }
        if (self.$('.item-row:last').data('index') === from && direction === REVERSE) {
          direction = null;
        }
      }());

      if(!direction) {
        console.log('Already rendered', from);
        return;
      }

      self.$el.empty();
      function stacker(heightToCover, index) {
        if ((heightToCover > 0 || ROW_HEIGHT === LAZY) && index < self.model.attributes.count && index >= 0) {
          prepareRow(index).then(function ($row){
            switch(direction){
              case FORWARD:
                self.$el.append($row);
                break;
              case REVERSE:
                self.$el.prepend($row);
                break;
            }
            validateDimensions($row);
            stacker(heightToCover - getHeight($row), index + direction);
          });
        } else {
          console.log('Rendered', from, 'to', index - direction);
          self.markVisible(from, index); // TODO this should be guessed by the Collection itself instead
          if (ROW_HEIGHT !== LAZY) {
            switch(direction){
              case FORWARD:
                self.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
                  (self.model.attributes.count - index) * ROW_HEIGHT));
                self.$el.prepend(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>',
                  from * ROW_HEIGHT));
                console.log('Scrolling to', from * ROW_HEIGHT + deltaScroll);
                self.$el.scrollTop(from * ROW_HEIGHT + deltaScroll);
                break;
              case REVERSE:
                self.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
                  (self.model.attributes.count - from - 1) * ROW_HEIGHT));
                self.$el.prepend(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>',
                  index * ROW_HEIGHT));
                console.log('Scrolling to', from * ROW_HEIGHT + deltaScroll - heightToCover);
                self.$el.scrollTop(index * ROW_HEIGHT + deltaScroll - heightToCover);
                break;
            }
          }
        }
      }
      //additional ROW_HEIGHT to take into account partially visible rows
      var largestCurrentRow = _.max(self.$('.item-row').toArray().map(getHeight));
      return stacker(getHeight(self.$el) + _.max([largestCurrentRow, ROW_HEIGHT]), from);
    }

    return self;
  }

  var previous = root.mixinVirtualizedContainerTrait;
  this.mixinVirtualizedContainerTrait = mixinVirtualizedContainerTrait;

  mixinVirtualizedContainerTrait.noConflict = function() {
    root.mixinVirtualizedContainerTrait = previous;
    return this;
  };
  mixinVirtualizedContainerTrait.LAZY = LAZY;

}.call(this));
