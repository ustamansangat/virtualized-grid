/* jshint devel:true */
/* @const */
function mixinContentCachingTrait (self, options) {

  var contentPromises = {};

  var originalGetContent = self.getContent;

  var MAX_CACHE_COUNT = (options || {}).MAX_CACHE_COUNT || Infinity;

  self.getContent = function (index) {
    var promise = contentPromises[index];
    if (!promise) {
      promise = contentPromises[index] = originalGetContent(index);
    }
    return promise;
  }

  self.markVisible = function (from, tillInclusive) {
    var population = _.size(contentPromises);
    if (population > MAX_CACHE_COUNT) {
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
      for (i = self.model.attributes.count - 1; i > till; --i) {
        if (_.has(contentPromises, i)) {
          delete contentPromises[i];
          purgedOnes.push(i);
        }
      }

      console.log(_.string.sprintf('Purged %d cached values [%s%s] out of %d, while rendering (%d to %d)',
        purgedOnes.length, _.string.join(',', _.take(purgedOnes, 5)), purgedOnes.length > 5 ? '...' : '', population, from, till));
    }
  }

  return self;
}