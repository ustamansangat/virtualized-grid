/* jshint devel:true */
'use strict';

var _ = require('underscore');
var $ = require('jquery');
var _s = require('underscore.string');
var Backbone = require('backbone');

var fs = require('fs');

var mixinVirtualizedContainerTrait = require('../../lib/mixinVirtualizedContainerTrait');
var mixinExpandableRowsTrait = require('../../lib/mixinExpandableRowsTrait');


var rowTemplate = _.template(fs.readFileSync(__dirname + '/row.html', 'utf8'));
var headerTemplate = _.template(fs.readFileSync(__dirname + '/header.html', 'utf8'));

var PeopleView = Backbone.View.extend({

  rowEl: function (rowModel) {
    return $(rowModel.get('heading') ? headerTemplate(rowModel.toJSON()) : rowTemplate(rowModel.toJSON()));
  },

  isIrregularRow: function (rowModel) {
    return rowModel.get('heading');
  },

  initialize: function (options) {
    Backbone.View.prototype.initialize.apply(this, arguments);
    mixinVirtualizedContainerTrait(this, options);
    mixinExpandableRowsTrait(this, options);
  }

});

var container = new PeopleView({
  el: $('people'),
  idProperty: 'name',
  collection: new Backbone.Collection(),
  RENDER_DELAY: 50,
  MAX_CACHE_COUNT: Infinity
});

_.times(100, function (index) {
  container.collection.add(new Backbone.Model( (index + 1) % 8 === 0 ?
    {
      heading: 'This is a header row',
      height: 10 * index
    } : {
      name: 'Person#' + _s.pad(index, 2, '0'),
      address: 'Address of Person#' + _s.pad(index, 2, '0')
    })
  );
});

container.render();

$('.controls input[type=range]').change(function (){
  $('output[name=index]').val($('.controls input[type=range]').val());
});

$('.controls .change').click(function (){
  var model = container.collection.at($('.controls input[type=range]').val());
  model.set(model.get('heading') ? {
    height: (1 + _.random(20)) / 10 * model.get('height'),
    heading: model.get('heading') + '*'
  } : {
    name : model.get('name') + '*'
  });
});
