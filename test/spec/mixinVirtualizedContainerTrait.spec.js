/* global describe, it */
var $ = require('jquery');
var _ = require('underscore');
var _s = require('underscore.string');
var mixinVirtualizedContainerTrait = require('../../lib/mixinVirtualizedContainerTrait');
var Backbone = require('backbone');

var chai = require('chai');
var expect = chai.expect;
var should = chai.should();


describe('mixinVirtualizedContainerTrait', function () {
  var RENDER_DELAY = 16;
  var ROW = 40;
  var VIRTUAL_COUNT = 8;
  var Target, target;

  function visibleRows() {
    var scrollTop = target.$el.scrollTop();
    var scrollBtm = scrollTop + target.$el.height();
    var marks = target.$('.item-row').toArray().reduce(function (acc, el, i) {
      acc.push($(el).height() + acc[i]);
      return acc;
    }, [target.$('prefix').height() || 0]);
    return target.$('.item-row').toArray().filter(function (el, i) {
      return (marks[i] >= scrollTop && marks[i] < scrollBtm) || (marks[i + 1] > scrollTop && marks[i + 1] <= scrollBtm) || (marks[i] <= scrollTop && marks[i+1] >= scrollBtm);
    });
  }

  function rendersRows(x, y, vx, vy) {
    var range = _.range(x, y);
    var renderedRange = target.$('.item-row').map(function (i, el) {
                return $(el).data('index');
              }).toArray();
    renderedRange.push(_.last(renderedRange) + 1);
    var notRendered = _.difference(range, renderedRange);
    expect(notRendered, 'rendered range ' + JSON.stringify(renderedRange)).to.deep.equal([]);
    var renderedButNotExpected = _.difference(renderedRange, range);
    expect(renderedButNotExpected.length, 'too many rendered' + JSON.stringify(renderedButNotExpected)).to.be.lessThan (3);
    if(arguments.length > 2) {
      hasVisibleRows(vx, vy);
    } else {
      hasVisibleRows(x, y);
    }
  }

  function hasVisibleRows(x, y) {
    var range = _.range(x, y);
    var visibleRange = visibleRows().map(function (r){
                         return $.data(r, 'index');
                       });
    visibleRange.push(_.last(visibleRange) + 1);
    var notVisible = _.difference(range, visibleRange);
    expect(notVisible, 'visible range' + JSON.stringify(visibleRange)).to.deep.equal([]);
    var visibleButNotExpected = _.difference(visibleRange, range);
    expect(visibleButNotExpected.length, 'too many visible' + JSON.stringify(visibleButNotExpected)).to.be.lessThan (2);
  }

  function setupSuite(suite, suites, title) {
    var caseNo = suites ? _s.sprintf(' [case %2d]', _.indexOf(suites, suite)) : '';
    title = _s.sprintf('%s%s', title || '', caseNo) ;
    describe(_s.sprintf('%s When scrolled by %d', title , suite.scroll), function (done){
      beforeEach(function (done){
        target.$el.scrollTop(suite.scroll);
        setTimeout(done, RENDER_DELAY * 2);
      });
      it('renders appropriate rows', function (){
        rendersRows.apply(null, suite.expect);
      });
      if (suites) {
        _.without(suites, suite).forEach(function (next) {
          setupSuite(next, null, _s.sprintf('then [case %2d]', _.indexOf(suites, next)) );
        });
      }
      if (suite.additionalNextSteps) {
        suite.additionalNextSteps.forEach(function (next) {
          setupSuite(next, null, _s.sprintf('then also [case %2d]', _.indexOf(suite.additionalNextSteps, next)) );
        });
      }
    });
  }

  describe('Dependencies', function () {
    beforeEach(function (){
      Target = Backbone.View.extend({
        initialize: function (options) {
          Backbone.View.prototype.initialize.apply(this, arguments);
          mixinVirtualizedContainerTrait(this, options);
        }
      });
    });

    it ('Throws if scroll event handler already exists', function (){
      expect(function () {
        new (Target.extend({
              events: {
                scroll: _.identity
              }
        }))();
      }).to.Throw(/scroll event/i);
    });

    it ('Throws if rowTemplate is not specified', function (){
      expect(function () {
        new Target({
          collection: new Backbone.Collection()
        });
      }).to.Throw(/rowTemplate/);
    });

    it ('Throws if render is already overridden', function (){
      expect(function () {
        new (Target.extend({
          rowTemplate: _.constant('yo'),
          render: _.identity()
        }))({
          collection: new Backbone.Collection()
        });
      }).to.Throw(/render/i);
    });

    describe('Proper Template class', function () {

      beforeEach(function (){
        Target = Target.extend({
                     rowTemplate: _.constant('yo')
                 });
      });

      it ('Throws if a collection is not provided', function (){
        expect(function () {
          new Target();
        }).to.Throw(/backing collection/i);
      });

      it ('Throws if an el is not specified', function (){
        expect(function () {
          new Target({
            collection: new Backbone.Collection()
          });
        }).to.Throw();
      });

      it ('Throws if el does not support scrolling', function (){
        expect(function () {
          new Target({
            collection: new Backbone.Collection(),
            el: $('<div style="overflow-y: hidden;"> </div>')
          });
        }).to.Throw(/overflow.*scroll/i);
        expect(function () {
          new Target({
            collection: new Backbone.Collection(),
            el: $('<div style="overflow-y: auto;"> </div>')
          });
        }).not.to.Throw(/overflow.*scroll/i);
        expect(function () {
          new Target({
            collection: new Backbone.Collection(),
            el: $('<div style="overflow-y: scroll;"> </div>')
          });
        }).not.to.Throw(/overflow.*scroll/i);
      });

    });
  });

  describe('With equal height rows and a few irregular ones', function () {
    beforeEach(function (){
      $(_s.sprintf('<div class="ustaman" style="height: %dpx; overflow-y: auto; border: 1px solid red; width: 200px; margin: 30px;"></div>', ROW * VIRTUAL_COUNT)).prependTo('body');
    });

    afterEach(function (done){
      setTimeout(function (){
        target.remove();
        $('.ustaman').remove();
        done();
      }, RENDER_DELAY * 2);
    });

    beforeEach(function (done){

      Target = Backbone.View.extend({

        rowTemplate: function (rowModel) {
          var row = rowModel.toJSON();
          return _s.sprintf('<div style="display:block; box-sizing: border-box; height:%dpx; border: 1px solid black; background-color:%s;"> %s </div>',
            this.isIrregularRow(rowModel) ? (ROW * VIRTUAL_COUNT * 2) : ROW,
            this.isIrregularRow(rowModel) ? 'pink' : 'yellow',
            row.text);
        },

        isIrregularRow: function (row) {
          return row.get('index') === 32;
        },

        initialize: function (options) {
          Backbone.View.prototype.initialize.apply(this, arguments);
          mixinVirtualizedContainerTrait(this, options);
        }

      });

      target = new Target({
        el: $('.ustaman'),
        RENDER_DELAY: RENDER_DELAY,
        collection: new Backbone.Collection()
      });

      _.times(100, function (i) {
        target.collection.add({
            text: _s.sprintf('Row #%02d', i),
            index: i
        });
      });

      target.render();
      setTimeout(done, RENDER_DELAY + 1);
    });

    it('renders as many rows as needed to occupy the view port', function () {
      expect(target.$('.item-row').size()).to.equal(VIRTUAL_COUNT);
    });

    it('the viewport size is ' + (ROW * VIRTUAL_COUNT), function () {
      expect(target.$el.height()).to.equal(ROW * VIRTUAL_COUNT);
    });

    it('renders rows with indexes in them', function () {
      rendersRows(0, VIRTUAL_COUNT);
    });

    it('renders rows with proper contents', function () {
      expect(target.$('.item-row').map(function (i, el) {
        return $(el).text().trim();
      }).toArray())
      .to.deep.equal(_.range(0, VIRTUAL_COUNT).map(function (i){
        return _s.sprintf('Row #%02d', i);
      }));
    });


    [{
      scroll: ROW / 2,
      expect: [0, VIRTUAL_COUNT + 1]
    }, {
      scroll: ROW,
      expect: [1, VIRTUAL_COUNT + 2]
    },{
      scroll: ROW + 20,
      expect: [1, VIRTUAL_COUNT + 2]
    },{
      scroll: ROW + 30,
      expect: [1, VIRTUAL_COUNT + 2]
    }, {
      scroll: ROW * 3,
      expect: [3, VIRTUAL_COUNT + 4]
    },{
      scroll: ROW * 10,
      expect: [10, VIRTUAL_COUNT + 10]
    },{
      scroll: ROW * 33,
      expect: [33, VIRTUAL_COUNT + 33]
    },{
      scroll: ROW * 97,
      expect: [92, 100]
    }].forEach(function (suite, i, suites) {
      setupSuite(suite, suites);
    });

    [{
      scroll: ROW * 32,
      expect: [32, 33],
      additionalNextSteps: [{
        scroll: ROW * 33,
        expect: [32, 33]
      },{
        scroll: ROW * 32 + ROW * VIRTUAL_COUNT,
        expect: [32, 33]
      },{
        scroll: ROW * 32 + ROW * VIRTUAL_COUNT * 2 - 3,
        expect: [32, 41]
      },{
        scroll: ROW * 32 + ROW * VIRTUAL_COUNT * 2 + 1,
        expect: [48, 57]
      }]
    },{
      scroll: ROW * 32 + ROW - 1,
      expect: [32, 33]
    }].forEach(function (suite, i, suites) {
      setupSuite(suite, suites, 'Large Row');
    });

  });

  describe('With all rows marked irregular but with same height', function () {
    beforeEach(function (){
      $(_s.sprintf('<div class="ustaman" style="height: %dpx; overflow-y: auto; border: 1px solid red; width: 200px; margin: 30px;"></div>', ROW * VIRTUAL_COUNT)).prependTo('body');
    });

    afterEach(function (done){
      setTimeout(function (){
        target.remove();
        $('.ustaman').remove();
        done();
      }, RENDER_DELAY * 2);
    });

    beforeEach(function (done){

      Target = Backbone.View.extend({

        rowTemplate: function (rowModel) {
          var row = rowModel.toJSON();
          return _s.sprintf('<div style="display:block; box-sizing: border-box; height:%dpx; border: 1px solid black;"> %s </div>', ROW, row.text);
        },

        isIrregularRow: _.constant(true),

        initialize: function (options) {
          Backbone.View.prototype.initialize.apply(this, arguments);
          mixinVirtualizedContainerTrait(this, options);
        }

      });

      target = new Target({
        el: $('.ustaman'),
        RENDER_DELAY: RENDER_DELAY,
        collection: new Backbone.Collection()
      });

      _.times(100, function (i) {
        target.collection.add({
            text: _s.sprintf('Row #%02d', i),
            index: i
        });
      });

      target.render();
      setTimeout(done, RENDER_DELAY + 1);
    });

    it('renders ALL rows', function () {
      expect(target.$('.item-row').size()).to.equal(100);
    });

    it('the viewport size is ' + (ROW * VIRTUAL_COUNT), function () {
      expect(target.$el.height()).to.equal(ROW * VIRTUAL_COUNT);
    });

    it('renders rows with indexes in them', function () {
      rendersRows(0, 100, 0, VIRTUAL_COUNT + 1);
    });

    it('renders rows with proper contents', function () {
      expect(target.$('.item-row').map(function (i, el) {
        return $(el).text().trim();
      }).toArray())
      .to.deep.equal(_.range(0, 100).map(function (i){
        return _s.sprintf('Row #%02d', i);
      }));
    });

    [{
      scroll: ROW / 2,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    }, {
      scroll: ROW,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    },{
      scroll: ROW + 20,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    },{
      scroll: ROW + 30,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    }, {
      scroll: ROW * 3,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    },{
      scroll: ROW * 10,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    },{
      scroll: ROW * 97,
      expect: [0, 100, 0, VIRTUAL_COUNT + 2]
    }].forEach(function (suite, i, suites) {
      setupSuite(suite, suites);
    });
  });

  describe('With only irregular rows with irregular heights', function () {
    beforeEach(function (){
      $(_s.sprintf('<div class="ustaman" style="height: %dpx; overflow-y: auto; border: 1px solid red; width: 200px; margin: 30px;"></div>', ROW * VIRTUAL_COUNT)).prependTo('body');
    });

    afterEach(function (done){
      setTimeout(function (){
        target.remove();
        $('.ustaman').remove();
        done();
      }, RENDER_DELAY * 2);
    });

    beforeEach(function (done){

      Target = Backbone.View.extend({

        rowTemplate: function (rowModel) {
          var row = rowModel.toJSON();
          return _s.sprintf('<div style="display:block; box-sizing: border-box; height:%dpx; border: 1px solid black;"> %s </div>', (1 + row.index) * 10, row.text);
        },

        isIrregularRow: _.constant(true),

        initialize: function (options) {
          Backbone.View.prototype.initialize.apply(this, arguments);
          mixinVirtualizedContainerTrait(this, options);
        }

      });

      target = new Target({
        el: $('.ustaman'),
        RENDER_DELAY: RENDER_DELAY,
        collection: new Backbone.Collection()
      });

      _.times(100, function (i) {
        target.collection.add({
            text: _s.sprintf('Row #%02d', i),
            index: i
        });
      });

      target.render();
      setTimeout(done, RENDER_DELAY + 1);
    });

    it('renders ALL rows', function () {
      expect(target.$('.item-row').size()).to.equal(100);
    });

    it('the viewport size is ' + (ROW * VIRTUAL_COUNT), function () {
      expect(target.$el.height()).to.equal(ROW * VIRTUAL_COUNT);
    });

    it('renders rows with indexes in them', function () {
      rendersRows(0, 100);
    });

    it('renders rows with proper contents', function () {
      expect(target.$('.item-row').map(function (i, el) {
        return $(el).text().trim();
      }).toArray())
      .to.deep.equal(_.range(0, 100).map(function (i){
        return _s.sprintf('Row #%02d', i);
      }));
    });

    function rendersRows(x, y) {
      var rows = target.$('.item-row').map(function (i, el) {
                  return $(el).data('index');
                }).toArray();
      expect(_.difference(_.range(x, y), rows)).to.deep.equal([]);
    }

    var visibleCount = Math.ceil((Math.sqrt(25 + 20 * ROW * VIRTUAL_COUNT) - 5 ) / 10);
    [{
      scroll: ROW / 2,
      expect: [0, 100, 0, visibleCount]
    }, {
      scroll: ROW,
      expect: [0, 100, 0, visibleCount]
    },{
      scroll: ROW + 20,
      expect: [0, 100, 0, visibleCount]
    },{
      scroll: ROW * 90,
      expect: [0, 100, 0, visibleCount]
    }].forEach(function (suite, i, suites) {
      setupSuite(suite, suites);
    });

  });

});