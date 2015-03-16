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
          var actualHeight = getHeight($row);
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
            ROW_HEIGHT = getHeight($row);
            self.$el.empty();
          });
        });
      }
      return helper(0);
    }

    function getHeight(el) {
      var $el = el.jquery ? el : $(el);
      var marginTop = parseInt($el.css('margin-top'), 10);
      var marginBottom = parseInt($el.css('margin-bottom'), 10);
      marginTop = $el.prev().size() ? marginTop / 2 : marginTop;
      marginBottom = $el.next().size() ? marginBottom / 2 : marginBottom;
      var height = parseInt($el.css('height'), 10);
      switch ($el.css('box-sizing')) {
        case 'content-box':
          var borderTop = parseInt($el.css('border-top-width'), 10);
          var borderBottom = parseInt($el.css('border-bottom-width'), 10);
          var paddingTop = parseInt($el.css('padding-top'), 10);
          var paddingBottom = parseInt($el.css('padding-bottom'), 10);
          return  height + paddingTop + paddingBottom + marginTop + marginBottom + borderTop + borderBottom;
        case 'border-box':
          return height + marginTop + marginBottom;
        throw new Error('Only border-box supported.');
      }
    }

    function render () {
      /* @const */
      var scrollTop = self.$el.scrollTop();
      var deltaScroll = 0;
      var direction = null;
      var from;

      (function () {
        //adjust 'from', direction and deltaScroll
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
        var prefix = getHeight(self.$('prefix'));
        var marks = cumulativeHeights.map(function (ah) {
          return ah + prefix;
        });
        var targetMarks = cumulativeHeights.map(function (ah) {
          return ah + scrollTop;
        });
        if (scrollTop >= _.last(marks) || scrollTop + self.$el.height() <= prefix) {
          //none of the currently rendered rows will be visible
          from = ROW_HEIGHT === LAZY ? 0 : _.max([0 , Math.floor(scrollTop / ROW_HEIGHT)]);
          deltaScroll = scrollTop - from * ROW_HEIGHT;
          direction = FORWARD;
        } else {
          var index;
          if( scrollTop >= prefix) {
            //Scrolled Down / Swiped up / See Next
            index = _.findIndex(marks, function (m) {
              return m >= scrollTop;
            });
            deltaScroll = scrollTop - (index === 0 ? prefix : marks[index - 1]);
            direction = FORWARD;
            from = $.data($rows.get(index), 'index');
          } else {
             //Scrolled Up / Swiped Down / See Previous
            index = _.findIndex(marks, function (m) {
              return m >= scrollTop + self.$el.height();
            });
            deltaScroll =  marks[index] - (scrollTop + self.$el.height());
            from = $.data($rows.get(index), 'index');
            direction = REVERSE;
          }
        }
        if (self.$('.item-row:first').data('index') === from && direction === FORWARD && _.last(marks) >= scrollTop + self.$el.height()) {
          //this stops the redrawing if everything's already in view
          self.$el.scrollTop(from * ROW_HEIGHT + deltaScroll);
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
                self.$el.scrollTop(from * ROW_HEIGHT + deltaScroll);
                break;
              case REVERSE:
                self.$el.append(_.string.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
                  (self.model.attributes.count - from - 1) * ROW_HEIGHT));
                self.$el.prepend(_.string.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>',
                  (index + 1) * ROW_HEIGHT));
                self.$el.scrollTop((index + 1) * ROW_HEIGHT - heightToCover);
                break;
            }
          }
        }
      }
      return stacker(self.$el.height() + deltaScroll, from);
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
