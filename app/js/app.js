/* global $, Hogan, algoliasearch, algoliasearchHelper, google */

$(document).ready(function () {
  // INITIALIZATION
  // ==============
  var APPLICATION_ID = 'JDBD6EJM33';
  var SEARCH_ONLY_API_KEY = '0fe54b2e3991d370c91376981aff9d48';
  var INDEX_NAME = 'Axa_demo2';
  var PARAMS = {hitsPerPage: 60};

  // Client + Helper initialization
  var algolia = algoliasearch(APPLICATION_ID, SEARCH_ONLY_API_KEY);
  var algoliaHelper = algoliasearchHelper(algolia, INDEX_NAME, PARAMS);
  algoliaHelper.setQueryParameter('getRankingInfo', true);

  // DOM and Templates binding
  var $map = $('#map');
  var $hits = $('#hits');
  var $searchInput = $('#search-input');
  var hitsTemplate = Hogan.compile($('#hits-template').text());
  var noResultsTemplate = Hogan.compile($('#no-results-template').text());

  // Map initialization
  var map = new google.maps.Map($map.get(0), {
    streetViewControl: false,
    mapTypeControl: false,
    zoom: 4,
    minZoom: 3,
    maxZoom: 12,
    styles: [{stylers: [{hue: '#3596D2'}]}]
  });
  var fitMapToMarkersAutomatically = true;
  var markers = [];
  var boundingBox;
  var boundingBoxListeners = [];

  // Page states
  var PAGE_STATES = {
    LOAD: 0,
    BOUNDING_BOX_RECTANGLE: 1,
    BOUNDING_BOX_POLYGON: 2,
    AROUND_IP: 4,
    AROUND_NYC: 5,
    AROUND_LONDON: 6,
    AROUND_SYDNEY: 7
  };
  var pageState = PAGE_STATES.LOAD;
  setPageState(PAGE_STATES.BOUNDING_BOX_RECTANGLE);

  // PAGE STATES
  // ===========
  function setPageState(state) {
    resetPageState();
    beginPageState(state);
  }

  function beginPageState(state) {
    pageState = state;

    switch (state) {
      case PAGE_STATES.BOUNDING_BOX_RECTANGLE:
        boundingBox = new google.maps.Rectangle({
          bounds: {north: 49.78257335931457, south: 47, east: 0.26558572958814, west: -4.815234375000005},
          strokeColor: '#EF5362',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#EF5362',
          fillOpacity: 0.15,
          draggable: true,
          editable: true,
          geodesic: true,
          map: map
        });
        algoliaHelper.setQueryParameter('insideBoundingBox', rectangleToAlgoliaParams(boundingBox));
        boundingBoxListeners.push(google.maps.event.addListener(
          boundingBox,
          'bounds_changed',
          throttle(rectangleBoundsChanged, 150)
        ));
        break;

      case PAGE_STATES.BOUNDING_BOX_POLYGON:
        boundingBox = new google.maps.Polygon({
          paths: [
{lat: 49.045175490759156, lng: -1.6868806663731206},
{lat: 48.92532495181448, lng: -0.6630104398816307},
{lat: 48.508801457598985, lng: -0.8335746459300492},
{lat: 48.28110320535117, lng: -0.9730503721794058},
{lat: 48.131070955461716, lng: -1.015628903091692},
{lat: 47.98644061411999, lng: -0.845101417894044},
{lat: 47.94703305906678, lng: -0.6561396236574589},
{lat: 47.87388824780516, lng: -0.6879211853039364},
{lat: 47.83341143821627, lng: -0.6572013453638805},
{lat: 47.7933491718379, lng: -0.7376751846582044},
{lat: 47.75685118369659, lng: -0.8399623987406968},
{lat: 47.86453845430231, lng: -1.2331985643586763},
{lat: 47.83478287687353, lng: -1.5797291275918937},
{lat: 47.65494618187566, lng: -2.0926706111096975},
{lat: 47.40928799225388, lng: -2.406815273436612},
{lat: 47.13061899588295, lng: -3.0155153702112325},
{lat: 47.55851698378252, lng: -4.260899613368696},
{lat: 48.76166506934005, lng: -5.0906738022525655},
{lat: 49.21583747628282, lng: -3.6002488191384043},
{lat: 49.32452652963717, lng: -2.2909737107222}
          ],
          strokeColor: '#EF5362',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#EF5362',
          fillOpacity: 0.15,
          draggable: true,
          editable: true,
          geodesic: true,
          map: map
        });
        algoliaHelper.setQueryParameter('insidePolygon', polygonsToAlgoliaParams(boundingBox));
        boundingBoxListeners.push(google.maps.event.addListener(
          boundingBox.getPath(),
          'set_at',
          throttle(polygonBoundsChanged, 150)
        ));
        boundingBoxListeners.push(google.maps.event.addListener(
          boundingBox.getPath(),
          'insert_at',
          throttle(polygonBoundsChanged, 150)
        ));
        break;

      case PAGE_STATES.AROUND_IP:
        algoliaHelper.setQueryParameter('aroundLatLngViaIP', true);
        break;

      case PAGE_STATES.AROUND_NYC:
        algoliaHelper.setQueryParameter('aroundLatLng', '40.71, -74.01');
        break;

      case PAGE_STATES.AROUND_LONDON:
        algoliaHelper.setQueryParameter('aroundLatLng', '51.50, -0.13');
        break;

      case PAGE_STATES.AROUND_SYDNEY:
        algoliaHelper.setQueryParameter('aroundLatLng', '-33.86, 151.20');
        break;

      default:
        // No-op
    }

    fitMapToMarkersAutomatically = true;
    algoliaHelper.search();
  }

  function resetPageState() {
    if (boundingBox) boundingBox.setMap(null);
    for (var i = 0; i < boundingBoxListeners.length; ++i) {
      google.maps.event.removeListener(boundingBoxListeners[i]);
    }
    boundingBoxListeners = [];
    $searchInput.val('');
    algoliaHelper.setQuery('');
    algoliaHelper.setQueryParameter('insideBoundingBox', undefined);
    algoliaHelper.setQueryParameter('insidePolygon', undefined);
    algoliaHelper.setQueryParameter('aroundLatLng', undefined);
    algoliaHelper.setQueryParameter('aroundLatLngViaIP', undefined);
  }

  // TEXTUAL SEARCH
  // ===============
  $searchInput.on('input propertychange', function (e) {
    var query = e.currentTarget.value;
    if (pageState === PAGE_STATES.BOUNDING_BOX_RECTANGLE || pageState === PAGE_STATES.BOUNDING_BOX_POLYGON) {
      fitMapToMarkersAutomatically = false;
    }
    algoliaHelper.setQuery(query).search();
  });

  // DISPLAY RESULTS
  // ===============
  algoliaHelper.on('result', function (content) {
    renderMap(content);
    renderHits(content);
  });

  algoliaHelper.on('error', function (error) {
    console.log(error);
  });

  function renderHits(content) {
    if (content.hits.length === 0) {
      $hits.html(noResultsTemplate.render());
      return;
    }
    content.hits = content.hits.slice(0, 20);
    for (var i = 0; i < content.hits.length; ++i) {
      var hit = content.hits[i];
      hit.displayCity = (hit.name === hit.city);
      if (hit._rankingInfo.matchedGeoLocation) {
        hit.distance = parseInt(hit._rankingInfo.matchedGeoLocation.distance / 1000, 10) + ' km';
      }
    }
    $hits.html(hitsTemplate.render(content));
  }

  function renderMap(content) {
    removeMarkersFromMap();
    markers = [];

    for (var i = 0; i < content.hits.length; ++i) {
      var hit = content.hits[i];
      var marker = new google.maps.Marker({
        position: {lat: hit._geoloc.lat, lng: hit._geoloc.lng},
        map: map,
        airport_id: hit.objectID,
        title: hit.name + ' - ' + hit.city + ' - ' + hit.country
      });
      markers.push(marker);
      attachInfoWindow(marker, hit);
    }

    if (fitMapToMarkersAutomatically) fitMapToMarkers();
  }

  // EVENTS BINDING
  // ==============
  $('.change_page_state').on('click', function (e) {
    e.preventDefault();
    updateMenu($(this).data('state'), $(this).data('mode'));
    switch ($(this).data('state')) {
      case 'rectangle':
        setPageState(PAGE_STATES.BOUNDING_BOX_RECTANGLE);
        break;
      case 'polygon':
        setPageState(PAGE_STATES.BOUNDING_BOX_POLYGON);
        break;
      case 'ip':
        setPageState(PAGE_STATES.AROUND_IP);
        break;
      case 'nyc':
        setPageState(PAGE_STATES.AROUND_NYC);
        break;
      case 'london':
        setPageState(PAGE_STATES.AROUND_LONDON);
        break;
      case 'sydney':
        setPageState(PAGE_STATES.AROUND_SYDNEY);
        break;
      default:
        // No op
    }
  });

  // HELPER METHODS
  // ==============
  function updateMenu(stateClass, modeClass) {
    $('.change_page_state').removeClass('active');
    $('.change_page_state[data-state="' + stateClass + '"]').addClass('active');
    $('.page_mode').removeClass('active');
    $('.page_mode[data-mode="' + modeClass + '"]').addClass('active');
  }

  function fitMapToMarkers() {
    var mapBounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
      mapBounds.extend(markers[i].getPosition());
    }
    map.fitBounds(mapBounds);
  }

  function removeMarkersFromMap() {
    for (var i = 0; i < markers.length; i++) {
      markers[i].setMap(null);
    }
  }

  function rectangleBoundsChanged() {
    fitMapToMarkersAutomatically = false;
    algoliaHelper.setQueryParameter('insideBoundingBox', rectangleToAlgoliaParams(boundingBox)).search();
  }
  function polygonBoundsChanged() {
    fitMapToMarkersAutomatically = false;
    algoliaHelper.setQueryParameter('insidePolygon', polygonsToAlgoliaParams(boundingBox)).search();
  }

  function rectangleToAlgoliaParams(rectangle) {
    var bounds = rectangle.getBounds();
    var ne = bounds.getNorthEast();
    var sw = bounds.getSouthWest();
    return [ne.lat(), ne.lng(), sw.lat(), sw.lng()].join();
  }

  function polygonsToAlgoliaParams(polygons) {
    var points = [];
    polygons.getPaths().forEach(function (path) {
      path.getArray().forEach(function (latLng) {
        points.push(latLng.lat());
        points.push(latLng.lng());
      });
    });
    return points.join();
  }

  function attachInfoWindow(marker, hit) {
    var message;

    if (hit.name === hit.city) {
      message = hit.name + ' - ' + hit.country;
    } else {
      message = hit.name + ' - ' + hit.city + ' - ' + hit.country;
    }

    var infowindow = new google.maps.InfoWindow({content: message});
    marker.addListener('click', function () {
      setTimeout(function () {infowindow.close();}, 3000);
    });
  }

  function throttle(func, wait) {
    var context;
    var args;
    var result;
    var timeout = null;
    var previous = 0;
    function later() {
      previous = Date.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    }
    return function () {
      var now = Date.now();
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) {
          context = args = null;
        }
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  }
});
