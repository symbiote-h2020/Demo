var map, featureList;

var sensorsMarkers = Array();
var sensorsName = Array();
var platformsName = Array();
var owners = Array();
var coordinates = Array();
var obsProperties = Array();
var locations = Array();
var resources_type = Array();


var search = Array();

var total = 0;

var table;

var properties = {1:'SO2', 5:'PM10', 7:'O3', 8:'NO2', 10:'CO', 38:'NO', 53:'Pressure', 54:'Temperature', 58:'Relative humidity', 6001:'PM2.5', };

$(window).resize(function() {
  sizeLayerControl();
});

$("#nav-btn").click(function() {
  $(".navbar-collapse").collapse("toggle");
  return false;
});

function sizeLayerControl() {
  $(".leaflet-control-layers").css("max-height", $("#map").height() - 50);
}

/* Basemap Layers */
var cartoLight = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
});
var usgsImagery = L.layerGroup([L.tileLayer("http://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 15,
}), L.tileLayer.wms("http://raster.nationalmap.gov/arcgis/services/Orthoimagery/USGS_EROS_Ortho_SCALE/ImageServer/WMSServer?", {
  minZoom: 16,
  maxZoom: 19,
  layers: "0",
  format: 'image/jpeg',
  transparent: true,
  attribution: "Aerial Imagery courtesy USGS"
})]);

map = L.map("map", {
  zoom: 4,
  center: [47.079069, 16.189928],
  layers: [cartoLight],
  zoomControl: false,
  attributionControl: false
});

/* Attribution control */
function updateAttribution(e) {
  $.each(map._layers, function(index, layer) {
    if (layer.getAttribution) {
      $("#attribution").html((layer.getAttribution()));
    }
  });
}
map.on("layeradd", updateAttribution);
map.on("layerremove", updateAttribution);

var attributionControl = L.control({
  position: "bottomright"
});
attributionControl.onAdd = function (map) {
  var div = L.DomUtil.create("div", "leaflet-control-attribution");
  // div.innerHTML = "<span class='hidden-xs'>Developed by <a href='http://bryanmcbride.com'>bryanmcbride.com</a> | </span><a href='#' onclick='$(\"#attributionModal\").modal(\"show\"); return false;'>Attribution</a>";
  return div;
};
map.addControl(attributionControl);

var zoomControl = L.control.zoom({
  position: "bottomright"
}).addTo(map);

/* GPS enabled geolocation control set to follow the user's location */
var locateControl = L.control.locate({
  position: "bottomright",
  drawCircle: true,
  follow: true,
  setView: true,
  keepCurrentZoomLevel: true,
  markerStyle: {
    weight: 1,
    opacity: 0.8,
    fillOpacity: 0.8
  },
  circleStyle: {
    weight: 1,
    clickable: false
  },
  icon: "fa fa-location-arrow",
  metric: false,
  strings: {
    title: "My location",
    popup: "You are within {distance} {unit} from this point",
    outsideMapBoundsMsg: "You seem located outside the boundaries of the map"
  },
  locateOptions: {
    maxZoom: 18,
    watch: true,
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 10000
  }
}).addTo(map);

/* Larger screens get expanded layer control and visible sidebar */
if (document.body.clientWidth <= 767) {
  var isCollapsed = true;
} else {
  var isCollapsed = false;
}

// ----- FUNCTIONS -----

function expandMap (){
  if(document.getElementById('map').style.height == '85%'){
    var height = '50%';
    document.getElementById("expandButton").value="Expand Map";
  }else{
    var height = '85%';
    document.getElementById("expandButton").value="Reduce Map";
  }
  $('#map').animate({
    height: height
  }, 500, function() {
  });

  var bounds = new L.LatLngBounds(coordinates);
  map.fitBounds(bounds);
}

//  Handle the click in a row that opens a modal with ths historic of the sensor of the clicked line
function handleClickRow(e){
  if (!sessionStorage.getItem("authorization")){
    document.getElementById('errorLabel').innerHTML = 'Please make sure you are signed in to access resources historical data.'
    $('#errorModal').modal('show');
  }
  else{
    authorization_token = sessionStorage.getItem("authorization");

    var table = document.getElementById("historicTable");

    var table = $('#historicTable').DataTable();
    var rows = table.rows().remove().draw();

    var row_url = "https://symbiote-dev.man.poznan.pl:8100/coreInterface/v1/resourceUrls?id=" + e.target.parentNode.id

    var platform_id = e.target.parentNode.getAttribute('platform_id');

    $("#loading").show();

    // Get resource url
    $.ajax({
          url: row_url,
          type: "GET",
          beforeSend: function(xhr){xhr.setRequestHeader('X-Auth-Token', authorization_token);},
          contentType: "application/json",
          cache: false,
          success: function(data){
            var name = e.target.parentNode.getAttribute('identification');
            object_url = data[e.target.parentNode.id]
            console.log(data)

            // Get all platforms tokens
            $.ajax({
                url: 'https://symbiote-dev.man.poznan.pl:8100/coreInterface/v1/get_available_aams',
                type: "GET",
                contentType: "application/json",
                cache: false,
                success: function(data){
                  console.log(data)

                  for (var i = 0; i < data.length; i++){
                    if (data[i].aamInstanceId == platform_id)
                      get_token_url = data[i].aamAddress + '/request_foreign_token'
                  }
                  console.log(get_token_url);
                  //Get the token using the returned url by the previous request
                  $.ajax({
                    url: get_token_url,
                    type: "POST",
                    beforeSend: function(xhr){xhr.setRequestHeader('X-Auth-Token', authorization_token);},
                    contentType: "application/json",
                    cache: false,
                    success: function(data, status, xhr){
                      var resource_token = xhr.getResponseHeader("X-Auth-Token");
                      console.log(resource_token);

                      // Get the historical data for the clicked resource (using url returned by the firs request and the specific token for the pretended platform that the resource belogns)
                      $.ajax({
                        url: object_url + "/Observations",
                        type: "GET",
                        beforeSend: function(xhr){xhr.setRequestHeader('X-Auth-Token', resource_token);},
                        contentType: "application/json",
                        cache: false,
                        success: function(data){
                          var location = data['body']['location']['description']
                          var latitude = data['body']['location']['latitude']
                          var longitude = data['body']['location']['longitude']

                          var observedProperty = data['body']['obsValue']['obsProperty']['label']
                          var unit = data['body']['obsValue']['uom']['symbol']
                          var measurementValue = data['body']['obsValue']['value']

                          var table = $('#historicTable').DataTable();
                          var row = table
                          .row.add( [measurementValue, observedProperty, unit, location, latitude, longitude, type] )
                          .draw()
                          .node();

                          $('#infoSensorModal').modal('show');
                          $('#infoSensorModalTitle').text(name  + " data")
                          $("#loading").hide();

                        },
                        error:function(){
                          $("#loading").hide();
                          // Error code goes here.
                          document.getElementById('errorLabel').innerHTML = 'It was not possible to get resource historical data. Please try again.'
                          $('#errorModal').modal('show');
                        }
                    });

                    },
                    error:function(error){
                      $("#loading").hide();
                      // Error code goes here.
                      document.getElementById('errorLabel').innerHTML = 'It was not possible to get resource historical data. Please try again.'
                      $('#errorModal').modal('show');
                      console.log(error);
                    }
                  });

                },
                error:function(error){
                  $("#loading").hide();
                  // Error code goes here.
                }
            });
          },
          error:function(data){
            //console.log(data)
            $("#loading").hide();
            // Error code goes here.
            document.getElementById('errorLabel').innerHTML = 'It was not possible to get resource historical data. Please try again.'
            $('#errorModal').modal('show');
          }
      });
    
  }
}

// Remove data (sensors) from previous search
function deleteSensor(){
  for (var i = 0; i < sensorsMarkers.length; i++){
    map.removeLayer(sensorsMarkers[i]);
  }
}

function setMarker(lat, lon){
  var marker = L.marker([lat, lon]).addTo(map);
  sensorsMarkers.push(marker);

  marker.on('click', function(e) {
    var content = "<table class='table table-striped' cellspacing='0' <thead> <th>Longitude</th> <th>Latitude</th> </thead> <tbody> <tr> <td>" + e.latlng.lng + " </td> <td>" + e.latlng.lat + " </td> </tr></tbody></table> <p></p>"
    content += "<table class='table table-hover table-striped' cellspacing='0'> <thead> <th>Sensor</th> <th>Platform</th> <th> Observed Properties </th> <th> Owner </th> <th> Location </th> <th> Type </th> </thead> <tbody> ";

    for (i = 0; i < sensorsMarkers.length; i++){
      if(sensorsMarkers[i]._latlng.lat  == e.latlng.lat && sensorsMarkers[i]._latlng.lng  == e.latlng.lng){
        content += "<tr><td>" + sensorsName[i] + "</td>" + "<td>" + platformsName[i] + "</td>" + "<td>" + obsProperties[i] + "</td>"+ "<td>" + owners[i] + "</td><td>"+ locations[i] + "</td><td>"+ resources_type[i] + "</td></tr>"
      }
    }
    content += "</tbody></table> <p></p>"
    var popup = L.popup({maxHeight:500, maxWidth:800})
     .setLatLng(e.latlng)
     .setContent(content)
     .openOn(map);
  });

}
 
 // parse sensors data
 function parseSensor(data) {

    $('#searchModal').modal('hide');
    // console.log(data)
    //if(data.locationLatitude && data.locationLongitude){

      var currentCoordinates = Array();
      currentCoordinates.push(data.locationLatitude);
      currentCoordinates.push(data.locationLongitude);
      coordinates.push(currentCoordinates);

      // var bounds = new L.LatLngBounds(coordinates);
      // map.fitBounds(bounds);

      owners.push(data.owner);
      sensorsName.push(data.name);
      platformsName.push(data.platformName);
      obsProperties.push(data.observedProperties);
      locations.push(data.locationName);
      type = data.resourceType[0].split('#')
      resources_type.push(type[type.length-1]);

      if(data.locationLatitude !== null && data.locationLongitude !== null){
        setMarker(data.locationLatitude, data.locationLongitude);
      }

      // if (!data.Name)
      //   name = "unknown"
      // else
      name = data.name
      if (!data.platformName)
        platform = "undefined"
      else
        platform = data.platformName

      var table = $('#sensorsTable').DataTable();

      var locationName = data.locationName.substring(data.locationName.lastIndexOf("/") + 1)

      for (var i = 0; i < data.observedProperties.length; i++) {
        data.observedProperties[i] = data.observedProperties[i].substring(data.observedProperties[i].lastIndexOf("/") + 1 )
      }
      
      for (var i = 0; i < data.resourceType.length; i++) {
        data.resourceType[i] = data.resourceType[i].substring(data.resourceType[i].lastIndexOf("#") + 1 )
      }

      var row = table
      .row.add( [name, data.locationLongitude, data.locationLatitude, data.locationAltitude, platform, data.observedProperties, data.owner, locationName, data.resourceType] )
      .draw()
      .node();
      //
      row.setAttribute("id", data.id);
      row.setAttribute("platform_id", data.platformId);
      row.setAttribute("identification", data.name);
      row.setAttribute("class", "clickable-row");
      row.addEventListener('click', handleClickRow);
    //}

    // console.log("SENSORS MARKER "+sensorsMarkers.length);
    // console.log("SENSORS NAME "+sensorsName.length);
    // console.log("PLATFORMS NAME "+platformsName.length);
    // console.log("OWNERS "+owners.length);
    // console.log("COORDINATES "+coordinates.length);
    // console.log("PROPERTIES "+obsProperties.length);
    // console.log("LOCATIONS "+locations.length);

  };

// Get the sensors
function getSensors(){

  $(document).ajaxStop(function() {
    // LAST AJAX CALL Finishes
    $("#loading").hide();

    // var bounds = new L.LatLngBounds(coordinates);
    // map.fitBounds(bounds);


  });
  var url = 'https://symbiote-dev.man.poznan.pl:8100/coreInterface/v1/query';
  if ($('#platform_name').val())
    search.push("platform_name="+$('#platform_name').val())

  if ($('#owner').val())
    search.push("owner="+$('#owner').val())

  if ($('#name').val())
    search.push("name="+$('#name').val())

  if ($('#id').val())
    search.push("id="+$('#id').val())

  if ($('#description').val())
    search.push("description="+$('#description').val())

  if ($('#location_name').val())
    search.push("location_name="+$('#location_name').val())

  if ($('#resource_type').val())
    search.push("type="+$('#resource_type').val())

  // if ($('#latitude').val())
  //   search.push("location_lat="+$('#latitude').val())
  //
  // if ($('#longitude').val())
  //   search.push("location_long="+$('#longitude').val())

  if($('#geoloc').val()){
    var res = $('#geoloc').val().split(",");
    var latitude = res[0].toString();
    var longitude = res[1].toString();

    search.push("location_lat="+latitude)
    search.push("location_long="+longitude)
  }

  if ($('#distance').val())
    search.push("max_distance="+$('#distance').val())

  if ($('#property').val())
    search.push("observed_property="+$('#property').val())

  if (search.length != 0){
    url += "?"
    for (var i = 0; i <search.length; i++){
      url += search[i];
      if(i != search.length-1)
        url += "&"
    }
  }

  $("#loading").show();
  $.ajax({
        url: url,
        type: "GET",
        beforeSend: function(xhr){xhr.setRequestHeader('X-Auth-Token', 'my-token');},
        dataType: "json",
        cache: false,
        success: function(data){
          //console.log(data);
          if(data.resources.length > 0){
            search = [];

            $('#map').animate({
              height: '50%'
            }, 500, function() {
              document.getElementById("expandButton").value="Expand Map";
            });
            document.getElementById("errorFooter").style.display = "none";

            document.getElementById("sensorsContent").style.display = "initial";
            document.getElementById("expandButton").style.display = "initial";

            $.each(data.resources, function( index, each ) {
              parseSensor(each);
            });
          }
          else{
            search = [];

            $('#searchModal').modal('show');

            document.getElementById("errorFooter").style.display = "initial";
            document.getElementById("errorSearch").innerHTML="The search did not return any results."
            //
            document.getElementById("sensorsContent").style.display = "none";
            document.getElementById("expandButton").style.display = "none";

            $('#map').animate({
              height: '85%'
            }, 500, function() {

            });
          }
        },
        error:function(){
          // TODO add error message
          search = [];

          $('#searchModal').modal('show');

          document.getElementById("errorFooter").style.display = "initial";
          document.getElementById("errorSearch").innerHTML="It was not possible to proceed with the search. Please try again."
          //
          document.getElementById("sensorsContent").style.display = "none";
          document.getElementById("expandButton").style.display = "none";

          $('#map').animate({
            height: '85%'
          }, 500, function() {

          });
        }
    });
}

// ----- EVENT LISTENERS -----

// Show modal for search
searchTopBar.addEventListener('click', function() {
  $('#searchModal').modal('show');
  map.closePopup();

  document.getElementById("resetLocation").style.display = "none";

  document.getElementById("errorFooter").style.display = "none";
  document.getElementById("errorSearch").innerHTML="";
  document.getElementById("distance").style.display = "none";

  if($('#geoloc').val()){
    $("#geoloc").val("");
  }
  $('#geoloc').leafletLocationPicker();

  if ($('#platform_name').val())
    $('#platform_name').val("")

  if ($('#owner').val())
    $('#owner').val("")

  if ($('#name').val())
    $('#owner').val("")

  if ($('#id').val())
    $('#id').val("")

  if ($('#description').val())
    $('#description').val("")

  if ($('#location_name').val())
    $('#location_name').val()

  if ($('#distance').val())
    $('#distance').val("")

  if ($('#property').val())
    $('#property').val("")

  if ($('#resource_type').val())
  $('#resource_type').val("")

}, false);


userLogin.addEventListener('click', function(){
  if (!$('#username').val() || !$('#password').val())
    alert("missing credentials");
  else{
    var username = $('#username').val();
    var password = $('#password').val();

    $.ajax({
        url: "https://symbiote-dev.man.poznan.pl:8100/coreInterface/v1/login",
        data: JSON.stringify({ "username": username, "password": password }),
        type: "POST",
        contentType: "application/json",
        cache: false,
        success: function(res, status, xhr) { 
          var token = xhr.getResponseHeader("X-Auth-Token");
          //console.log(token)

          sessionStorage.setItem("authorization", token);

          document.getElementById('session').style.display = 'inline';

          document.getElementById("login").style.display = 'block'
          document.getElementById("loginStatus").innerHTML = "Welcome " + username + "!";
          document.getElementById("loginStatus").style.color = "green";

          document.getElementById('timer').innerHTML = 05 + ":" + 00;
          startTimer();
        },
        error:function(error){
          // TODO add error message
          if(error.status == 401){
            document.getElementById("login").style.display = 'block'
            document.getElementById('session').style.display = 'none';
            document.getElementById("loginStatus").innerHTML = "Invalid Credentials";
            document.getElementById("loginStatus").style.color = "firebrick";
          }
          else{
            document.getElementById("login").style.display = 'block'
            document.getElementById('session').style.display = 'none';
            document.getElementById("loginStatus").innerHTML = "It was not possible to sign in. Please try again later.";
            document.getElementById("loginStatus").style.color = "firebrick";
          }
        }
    });
  }


});


// Submit model search
searchModalButton.addEventListener('click', function() {
  document.getElementById("sensorsContent").style.display = "none";
  document.getElementById("expandButton").style.display = "none";

  $(".leaflet-locpicker-map" ).hide();

  var table = $('#sensorsTable').DataTable();

  var rows = table.rows().remove().draw();

  if($('#geoloc').val()){
    var res = $('#geoloc').val().split(",");
    var latitude = res[0].toString();
    var longitude = res[1].toString();

    map.setView([latitude, longitude], 4);
  }
  else
    map.setView([47.079069, 16.189928], 4);

  $('#map').animate({
    height: '85%'
  }, 1000, function() {
    // Animation complete.
  });

  deleteSensor();
  sensorsMarkers = [];
  sensorsName = [];
  platformsName = [];
  coordinates = [];
  obsProperties = [];
  locations = [];
  owners = [];
  resources_type = [];

  getSensors();
}, false);

closeSearchModalButton.addEventListener('click', function() {
  $(".leaflet-locpicker-map" ).hide();
}, false);

resetLocation.addEventListener('click', function() {
  if($('#geoloc').val()){
    $("#geoloc").val("");
    $('#geoloc').leafletLocationPicker();
  }

  if ($('#distance').val())
    $('#distance').val("")

  document.getElementById("distance").style.display = "none";
  document.getElementById("resetLocation").style.display = "none";
}, false);


// ----- DOCUMENT READY -----
$(document).on("ready", function () {
  $("#loading").hide();

  $('#geoloc').leafletLocationPicker();

  $('#searchModal').modal('show');

  var searchButton = document.getElementById('searchButton');
  var searchTopBar = document.getElementById('searchTopBar');
  var searchModalButton = document.getElementById('searchModalButton');
  var closeSearchModal = document.getElementById('closeSearchModalButton');
  var resetLocation = document.getElementById('resetLocation');
  var login = document.getElementById('userLogin');

});
// Leaflet patch to make layer control scrollable on touch browsers
// var container = $(".leaflet-control-layers")[0];
// if (!L.Browser.touch) {
//   L.DomEvent
//   .disableClickPropagation(container)
//   .disableScrollPropagation(container);
// } else {
//   L.DomEvent.disableClickPropagation(container);
// }

function startTimer() {
  var presentTime = document.getElementById('timer').innerHTML;
  var timeArray = presentTime.split(/[:]+/);
  var m = timeArray[0];
  var s = checkSecond((timeArray[1] - 1));
  if(s==59){m=m-1}
  if(m<0){
    document.getElementById("loginStatus").innerHTML = "Your session has expired. Please sign in again"
  }
  
  document.getElementById('timer').innerHTML =
    m + ":" + s;
  setTimeout(startTimer, 1000);
}

function checkSecond(sec) {
  if (sec < 10 && sec >= 0) {sec = "0" + sec}; // add zero in front of numbers < 10
  if (sec < 0) {sec = "59"};
  return sec;
}