/* global describe, it */

(function () {
  'use strict';

  var _ = this._;
  var mixinVirtualizedContainerTrait = this.mixinVirtualizedContainerTrait;
  var Backbone = this.Backbone;

  describe('mixinVirtualizedContainerTrait', function () {
  this.timeout(20000);
    describe('With equal height rows', function () {
      var RENDER_DELAY = 32;
      var Target, target;
      var VIEW = 320;
      var ROW = 40;
      beforeEach(function (){
        $(_.string.sprintf('<div class="ustaman" style="height: %dpx; overflow-y: auto; border: 1px solid red; width: 200px; margin: 30px;"></div>', VIEW)).appendTo('body');
      });

      afterEach(function (done){
        setTimeout(function (){
          target.remove();
          $('.ustaman').remove();
          done();
        }, RENDER_DELAY * 2 + 3000);
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

//      it('renders as many rows as needed to occupy the view port', function () {
//        expect($('.item-row').size()).to.equal(VIEW / ROW + 1);
//      });
//
//      it('renders rows have indexes in them', function () {
//        rendersRows(0, VIEW / ROW);
//      });
//
//      it('renders rows with proper contents', function () {
//        expect($('.item-row').map(function (i, el) {
//          return $(el).text().trim();
//        }).toArray())
//        .to.deep.equal(_.range(0, VIEW / ROW + 1).map(function (i){
//          return _.string.sprintf('Row #%02d', i);
//        }));
//      });

      function rendersRows(x, y, linient) {
        var rows = $('.item-row', '.ustaman').map(function (i, el) {
                    return $(el).data('index');
                  }).toArray();
        if (linient && rows[0] === x - 1) {
        debugger;
          expect(y - 1, 'j').to.equal(_.last(rows));
        } else if(linient && rows[0] === x + 1) {
          expect(y + 1).to.equal(_.last(rows));
        } else {
          expect(rows).to.deep.equal(_.range(x, y + 1));
        }
      }

      [{
//        scroll: ROW / 2,
//        expect: [0, Math.ceil(VIEW / ROW)]
//      }, {
        scroll: ROW,
        expect: [0, Math.ceil(VIEW / ROW)]
//      },{
//        scroll: ROW + 20,
//        expect: [1, Math.ceil(VIEW / ROW) + 1]
      },{
        scroll: ROW * 10,
        expect: [10, Math.ceil(VIEW / ROW) + 10]
//      },{
//        scroll: ROW * 97,
//        expect: [92, 99]
//      },{
//        scroll: ROW * 99,
//        expect: [92, 99]
      }].forEach(function (suite, i, suites) {
        setupSuite(i, suites);
      });

      function setupSuite(i, suites, follower) {
        describe(_.string.sprintf('[case %2d] When scrolled by %d', i, suites[i].scroll), function (done){
          beforeEach(function (done){
            $('.ustaman').scrollTop(suites[i].scroll);
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
