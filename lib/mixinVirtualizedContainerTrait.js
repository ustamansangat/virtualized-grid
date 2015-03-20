/* jshint devel:true */
(function (define) {
'use strict';
define(function (require, exports, module) {



var _ = require('underscore');
var _s = require('underscore.string');
var $ = require('jquery');
var Backbone = require('backbone');

Backbone.$ = $;

/* @const */
var LAZY = _.uniqueId('LAZY');

/* @const */
var FORWARD = +1;
/* @const */
var REVERSE = -1;

/** this mixin adds or modifies isIrregularRow() and render() methods
    and adds scroll listener */
module.exports = function (self, options) {

  options = options || {};
  var idProperty = options.idProperty || 'id';

  self.events = self.events || {};
  self.events.scroll = _.wrap(
      (typeof self.events.scroll === 'string' ? self.scroll : self.events.scroll) || _.noop,
      function (scrollListener) {
        scrollListener.apply(self, _.tail(arguments));
        self.render();
      });

  if (!_.isFunction(self.drawRow)) {
    throw new Error('Method drawRow() is not implemented');
  }
  if (self.render !== Backbone.View.prototype.render) {
    throw new Error('No render implementation expected to be provided');
  }
  if (!self.collection) {
    throw new Error('A backing collection must be provided');
  }
  if(self.$el.parents('html').size() === 0) {
    throw new Error('View should be already be in the DOM!');
  }
  if (['auto', 'scroll'].indexOf(self.$el.css('overflow-y')) === -1 ){
    throw new Error('Overflow must be auto or scroll');
  }

  var ROW_HEIGHT = LAZY;

  function getVisibleIndexes() {
    return self.$('.item-row').toArray().map(function (row) {
      return $(row).data('index');
    });
  }

  self.listenTo(self.collection, 'change', function (model) {
    var index = self.collection.indexOf(model);
    var force = getVisibleIndexes().indexOf(index);
    if(force !== -1) {
      render(true);
    }
  });
  self.listenTo(self.collection, 'remove add reset', function (model) {
    render(true);
  });

  self.render = render;
  if (options.RENDER_DELAY) {
    var debouncedRender = _.debounce(render, options.RENDER_DELAY);
    self.render = function() {
      return debouncedRender() || self; //because the first call might otherwise return undefined
    };
  }

  self.isIrregularRow = self.isIrregularRow || _.constant(false);

//    function findRowByIndex(index) {
//      return self.$(_.string.sprintf('.item-row[data-index=%d]', index));
//    }

  function validateDimensions($row){
    if ($row.css('display') !== 'block') {
      throw new Error('display should be block for each row');
    }
    var rowModel = self.collection.at($row.data('index'));
    if (!self.isIrregularRow(rowModel)) {
      var actualHeight = getRowHeight($row);
      if (actualHeight !== ROW_HEIGHT) {
        throw new Error(_s.sprintf('Height for %s is expected to be %d but found %d.',
          JSON.stringify(rowModel.toJSON()), ROW_HEIGHT, actualHeight));
      }
    }
  }

  /** draws the ith row and attaches index and css classes */
  function prepareRow(i) {
    var rowModel = self.collection.at(i);
    var $row = self.drawRow(rowModel)
                  .addClass('item-row')
                  .attr('data-index', i)
                  .attr('data-id', rowModel.get(idProperty));
    if (i === 0) {
      $row.addClass('item-row-first');
    }
    if (i === self.collection.size() - 1) {
      $row.addClass('item-row-last');
    }
    return $row;
  }

  function getRowHeight(el) {
    var $el = el.jquery ? el : $(el);
    if($el.size() === 0) {
      return 0;
    }
    //since vertical margins collapse, we count only the larger of the two
    var margin = _.max([0, parseInt($el.css('margin-top'), 10), parseInt($el.css('margin-bottom'), 10)]);
    var height = parseInt($el.css('height'), 10);
    switch ($el.css('box-sizing')) {
      case 'content-box':
        var borderTop = parseInt($el.css('border-top-width') || 0, 10);
        var borderBottom = parseInt($el.css('border-bottom-width') || 0, 10);
        var paddingTop = parseInt($el.css('padding-top') || 0, 10);
        var paddingBottom = parseInt($el.css('padding-bottom') || 0, 10);
        return  height + paddingTop + paddingBottom + margin + borderTop + borderBottom;
      case 'border-box':
        return height + margin;
      default:
        throw new Error(_s.sprintf('Unsupported box-sizing "%s" for %s', $el.css('box-sizing'), el[0].outerHTML));
    }
  }

  function getInstructions(force, $rows, prefix, scrollTop, marks) {
      var deltaScroll;
      var direction;
      var from;

      //Would use let instead of var in here if using ES6
      //find from, direction and deltaScroll
      if (force) {
        direction = FORWARD;
        from = self.$('.item-row:first').data('index');
        deltaScroll = scrollTop - prefix;
      } else if ($rows.size() === 0 || scrollTop >= _.last(marks) || scrollTop + self.$el.height() <= prefix) {
        //none of the currently rendered rows will be visible
        from = ROW_HEIGHT === LAZY ? 0 : _.min([_.max([0 , Math.floor(scrollTop / ROW_HEIGHT)]), self.collection.size() - 1]);
        deltaScroll = ROW_HEIGHT === LAZY ? 0 : scrollTop - from * ROW_HEIGHT;
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
            return m >= getFarthestMark(scrollTop);
          });
          deltaScroll =  marks[index] - (scrollTop + self.$el.height());
          from = $.data($rows.get(index), 'index');
          direction = REVERSE;
        }
      }

      return {
        direction: direction,
        deltaScroll: deltaScroll,
        from: from
      };
    }

  function stacker(instructions, heightToCover, index) {
    if ((heightToCover > 0 || ROW_HEIGHT === LAZY) && index < self.collection.size() && index >= 0) {
      var $row = prepareRow(index);
      switch(instructions.direction){
        case FORWARD:
          self.$el.append($row);
          break;
        case REVERSE:
          self.$el.prepend($row);
          break;
      }
      validateDimensions($row);
      stacker(instructions, heightToCover - getRowHeight($row), index + instructions.direction);
    } else {
//        console.log('Rendered', instructions.from, 'to', index - instructions.direction);
      if (ROW_HEIGHT !== LAZY) {
        switch(instructions.direction){
          case FORWARD:
            self.$el.append(_s.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
              (self.collection.size() - index) * ROW_HEIGHT));
            self.$el.prepend(_s.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>',
              instructions.from * ROW_HEIGHT));
            self.$el.scrollTop(instructions.from * ROW_HEIGHT + instructions.deltaScroll);
            break;
          case REVERSE:
            self.$el.append(_s.sprintf('<suffix style="display: block; height: %dpx;"> </suffix>',
              (self.collection.size() - instructions.from - 1) * ROW_HEIGHT));
            self.$el.prepend(_s.sprintf('<prefix style="display: block; height: %dpx;"> </prefix>',
              (index + 1) * ROW_HEIGHT));
            self.$el.scrollTop((index + 1) * ROW_HEIGHT - heightToCover);
            break;
        }
      }
    }
  }

  function getFarthestMark(scrollTop) {
    return scrollTop + self.$el.height() -
         (self.$('.item-row:last').data('index') < self.collection.size() - 1
          ? 0 : _.max([parseInt(self.$('.item-row:last').css('margin-bottom'), 10)]))
  }

  function render (force) {
    if (ROW_HEIGHT === LAZY) {
      //find the height of a "regular" row the FIRST time we render one
      self.$el.empty();
      self.collection.any(function (rowModel, i) {
        if (self.isIrregularRow(rowModel)) {
          return false;
        }
        var $row = prepareRow(i).appendTo(self.$el);
        ROW_HEIGHT = getRowHeight($row);
        $row.remove();
        return true;
      });
    }

    /* @const */
    var scrollTop = self.$el.scrollTop();
    var $rows = self.$('.item-row');
    var prefix = getRowHeight(self.$('prefix')) || 0;
    var marks = $rows
                  .map(function (_, r){
                    return getRowHeight(r);
                  })
                  .toArray()
                  .reduce(function (acc, h, i) {
                    acc.push(i === 0 ? h : h + acc[i - 1]);
                    return acc;
                  }, [])
                  .map(function (ah) {
                    return ah + prefix;
                  });

    var instructions = getInstructions(force, $rows, prefix, scrollTop, marks);

    if (!force
        && self.$('.item-row:first').data('index') === instructions.from
        && instructions.direction === FORWARD
        && _.last(marks) >= getFarthestMark(scrollTop)) {
      //everything is already in view
      self.$el.scrollTop(instructions.from * ROW_HEIGHT + instructions.deltaScroll);
//      console.log('Already rendered', instructions.from);
    } else {
      self.$el.empty();
      stacker(instructions, self.$el.height() + instructions.deltaScroll, instructions.from);
    }
    return self;
  }
};



});
}(
    /* global define */
    typeof define === 'function' && define.amd ? define :
                      function (factory) {
                        'use strict';
                        factory(require, exports, module);
                      }
));
