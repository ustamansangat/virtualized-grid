/* jshint devel:true */
/* @const */
(function () {
  'use strict';
  var _ = this._;

  this.mixinContentCachingTrait = function (self, options) {
    /* A simple FIFO cache; not LRU */

    var contentPromises = {};
    var indexes = [];

    var originalGetContent = self.getContent;

    var MAX_CACHE_COUNT = (options || {}).MAX_CACHE_COUNT || Infinity;

    self.getContent = function (index) {
      var promise = contentPromises[index];
      if (!promise) {
        promise = contentPromises[index] = originalGetContent(index);
        indexes.push(index);
        purgeIfNeeded();
      }
      return promise;
    };

    function purgeIfNeeded() {
      var population = _.size(contentPromises);
      if (population > MAX_CACHE_COUNT) {
        var purgedOnes = []; //for debugging
        _.take(indexes, Math.ceil(indexes.length / 4)).forEach(function (i) {
          purgedOnes.push(i);
          delete contentPromises[i];
        });
        indexes = _.tail(indexes, Math.ceil(indexes.length / 4));
        console.log(_.string.sprintf('Purged %d cached values [%s%s] out of %d.',
          purgedOnes.length, _.string.join(',', _.take(purgedOnes, 5)), purgedOnes.length > 5 ? '...' : '', population));
      }
    };

    return self;
  };
}.call(this));
