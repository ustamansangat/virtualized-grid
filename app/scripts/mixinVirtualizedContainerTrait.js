/* jshint devel:true */
(function (define) {
'use strict';
define(function (require, exports, module) {



var _ = require('underscore');
var _s = require('underscore.string');
var $ = require('jquery');
var Backbone = require('backbone');

/* @const */
var LAZY = _.uniqueId('LAZY');

/* @const */
var FORWARD = +1;
/* @const */
var REVERSE = -1;

module.exports = function (self, options) {
  self.events = self.events || {};
  if (self.events.scroll) {
    throw new Error('Scroll event handler not expected');
  }
  self.events.scroll = function () {
    self.render();//since this is de-bounced, we want to suppress passing arguments to it
  };

  if (!self.collection) {
    throw new Error('A backing collection must be provided');
  }
  if (!_.isFunction(self.rowTemplate)) {
    throw new Error('Method rowTemplate() is not implemented');
  }
  if (['auto', 'scroll'].indexOf(self.$el.css('overflow-y')) === -1 ){
    throw new Error('Overflow must be auto or scroll');
  }

  var ROW_HEIGHT = LAZY;

  if (self.render !== Backbone.View.prototype.render) {
    throw new Error('No render implementation expected to be provided');
  }
  self.render = _.debounce(function () {
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
                    render();
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
    var rowModel = self.collection.at($row.data('index'));
    if (!self.isIrregularRow(rowModel)) {
      var actualHeight = getRowHeight($row);
      if (actualHeight !== ROW_HEIGHT) {
        throw new Error(_s.sprintf('Height for %s is expected to be %d but found %d.', JSON.stringify(rowModel.toJSON()), ROW_HEIGHT, actualHeight));
      }
    }
  }

  /** draws the ith row and attaches index and css classes */
  function prepareRow(i) {
    var $row = $(self.rowTemplate(self.collection.at(i))).addClass('item-row').attr('data-index', i);
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
      default:
        throw new Error('Unsupported box-sizing ' + $el.css('box-sizing'));
    }
  }

  function getInstructions($rows, prefix, scrollTop, marks) {
      var deltaScroll;
      var direction;
      var from;

      //Would use let instead of var in here if using ES6
      //find from, direction and deltaScroll
      if ($rows.size() === 0) {
        from = 0;
        direction = FORWARD;
        deltaScroll = 0;
      } else {
        if (scrollTop >= _.last(marks) || scrollTop + self.$el.height() <= prefix) {
          //none of the currently rendered rows will be visible
          from = ROW_HEIGHT === LAZY ? 0 : _.max([0 , Math.floor(scrollTop / ROW_HEIGHT)]);
          deltaScroll = ROW_HEIGHT ? 0 : scrollTop - from * ROW_HEIGHT;
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
        console.log('Rendered', instructions.from, 'to', index - instructions.direction);
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

  function render () {
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

    var instructions = getInstructions($rows, prefix, scrollTop, marks);

    if (self.$('.item-row:first').data('index') === instructions.from && instructions.direction === FORWARD && _.last(marks) >= scrollTop + self.$el.height()) {
      //everything is already in view
      self.$el.scrollTop(instructions.from * ROW_HEIGHT + instructions.deltaScroll);
      console.log('Already rendered', instructions.from);
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
      typeof require === 'function' ? function (factory) {
              'use strict';
              factory(require, exports, module);
            } : function (factory) {
              'use strict';
              var mappings  = {
                underscore: '_',
                'underscore.string': function () {
                  return require('_').string;
                },
                jquery: '$',
                backbone: 'Backbone'
              };
              var require = function (moduleName) {
                if (typeof mappings[moduleName] === 'function') {
                  return mappings[moduleName]();
                }
                return window[moduleName] || window[mappings[moduleName]];
              };
              var module = {
                exports: window
              };
              var exports = module.exports;
              factory(require, exports, module);
              window.mixinVirtualizedContainerTrait = module.exports;
              window._s = window._.string;
            }
));