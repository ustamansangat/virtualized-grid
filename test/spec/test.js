/* global describe, it */

(function () {
  'use strict';

  var _ = this._;
  var mixinVirtualizedContainerTrait = this.mixinVirtualizedContainerTrait;
  var Backbone = this.Backbone;

  describe('mixinVirtualizedContainerTrait', function () {
    describe('With equal height rows', function () {
      var RENDER_DELAY = 16;
      var Target, target;
      var ROW = 40;
      var VIRTUAL_COUNT = 8;
      beforeEach(function (){
        $(_.string.sprintf('<div class="ustaman" style="height: %dpx; overflow-y: auto; border: 1px solid red; width: 200px; margin: 30px;"></div>', ROW * VIRTUAL_COUNT)).prependTo('body');
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

          rowTemplate: function (row) {
            return _.string.sprintf('<div style="display:block; box-sizing: border-box; height:%dpx; border: 1px solid black;"> %s </div>', ROW, row.text);
          },

          getContent: function (index) {
            return $.Deferred().resolve({text: _.string.sprintf('Row #%02d', index)});
          },

          initialize: function (options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            mixinVirtualizedContainerTrait(this, options);
          }

        });

        target = new Target({
          el: $('.ustaman'),
          RENDER_DELAY: RENDER_DELAY,
          model: new Backbone.Model({
            count: 100
          })
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
          return _.string.sprintf('Row #%02d', i);
        }));
      });

      function rendersRows(x, y) {
        var rows = target.$('.item-row').map(function (i, el) {
                    return $(el).data('index');
                  }).toArray();
        expect(_.difference(_.range(x, y), rows)).to.deep.equal([]);
      }

      [{
        scroll: ROW / 2,
        expect: [0, VIRTUAL_COUNT + 1]
      }, {
        scroll: ROW,
        expect: [1, VIRTUAL_COUNT + 1]
      },{
        scroll: ROW + 20,
        expect: [1, VIRTUAL_COUNT + 2]
      },{
        scroll: ROW + 30,
        expect: [1, VIRTUAL_COUNT + 2]
      }, {
        scroll: ROW * 3,
        expect: [3, VIRTUAL_COUNT + 3]
      },{
        scroll: ROW * 10,
        expect: [10, VIRTUAL_COUNT + 10]
      },{
        scroll: ROW * 97,
        expect: [92, 100]
      }].forEach(function (suite, i, suites) {
        setupSuite(i, suites);
      });

      function setupSuite(i, suites, follower) {
        describe(_.string.sprintf('[case %2d] When scrolled by %d', i, suites[i].scroll), function (done){
          beforeEach(function (done){
            target.$el.scrollTop(suites[i].scroll);
            setTimeout(done, RENDER_DELAY * 2);
          });
          it('renders appropriate rows', function (){
            rendersRows.apply(null, suites[i].expect.concat(follower));
          });
          if(!follower) {
            _.chain(0).range(suites.length).without(i).forEach(function (j) {
              setupSuite(j, suites, true);
            }).value();
          }
        });
      }
    });
  });
}).call(this);
