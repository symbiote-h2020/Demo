var map, featureList;

var sensorsMarkers = Array();
var sensorsName = Array();
var platformsName = Array();
var owners = Array();
var coordinates = Array();
var obsProperties = Array();
var locations = Array();
var resources_type = Array();

var graphDict = {};
var webSockets = {};
var websockets_connection_error = 0;

subscribedResources = Array();

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
    description = e.target.parentNode.getAttribute('description');

    if (description.indexOf('sensor') == -1){
      actuators(e, description);
    }
    else
      sensors(e);
    
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
        content += "<tr><td>" + sensorsName[i] + "</td>" + "<td>" + platformsName[i] + "</td>" + "<td>" + obsProperties[i] + "</td>"+ "<td>" + locations[i] + "</td><td>"+ resources_type[i] + "</td></tr>"
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
    console.log(data);
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
      .row.add( [name, data.locationLongitude, data.locationLatitude, data.locationAltitude, platform, data.observedProperties, data.owner, locationName, data.description, data.resourceType] )
      .draw()
      .node();
      //
      row.setAttribute("id", data.id);
      row.setAttribute("platform_id", data.platformId);
      row.setAttribute("identification", data.name);
      row.setAttribute("class", "clickable-row");
      row.setAttribute("description", data.description);
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

          document.getElementById('timer').innerHTML = 60 + ":" + 00;
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

close_graph.addEventListener('click', function() {
  $('#graphModal').modal('hide');
  $('#infoSensorModal').modal('show');
}, false);


graphicalReport.addEventListener('click', function() {
  selected_propertie = $('#selectBox').val();

  // console.log(graphDict[selected_propertie]);

  $('#graphModal').modal('show');
  $('#infoSensorModal').modal('hide');

  var ctx = document.getElementById("graph").getContext('2d');

  var graph_values = [];
  var graph_times = [];

  for (var i = 0; i < graphDict[selected_propertie].length; i++){
    graph_values.push(graphDict[selected_propertie][i][0]);

    time = graphDict[selected_propertie][i][1].split('T')[1].split('.')[0]
    date = graphDict[selected_propertie][i][1].split('T')[0]
    graph_times.push(time + ' ' + date);
  }

  // document.getElementById('graph_title').innerHTML = graphDict[selected_propertie][0][1].split('T')[1] + 'data';

  var myLineChart = new Chart(ctx, {
    type: 'line',
    data: {
    labels: graph_times,
    datasets: [{ 
        data: graph_values,
        label: selected_propertie,
        borderColor: "#3e95cd",
        fill: false
      }
    ]
  },
    options: {
    scales: {
      xAxes: [{
        ticks: {
          autoSkip: false,
          maxRotation: 90,
          minRotation: 90
        }
      }]
    }
  }
});
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

subscribeResource.addEventListener('click', function(event) {
  subscribe_resource_id = event.target.getAttribute('resource_id');
  subscribe_resource_name = event.target.getAttribute('resource_name');
  subscribe_resource_platform = event.target.getAttribute('resource_platform');

  resource_platform_websocket = webSockets[webSockets.indexOf(subscribe_resource_platform)];

  if(subscribedResources.indexOf(subscribe_resource_id) == -1){
    var result = subscriptions(subscribe_resource_id, subscribe_resource_name, subscribe_resource_platform, resource_platform_websocket, 1); //subscribe type = 1

    if (result == 0){ //successfull subscribe
      subscribedResources.push(subscribe_resource_id);
    }else{

    }
  }else{
    var result = subscriptions(subscribe_resource_id, subscribe_resource_name, subscribe_resource_platform, resource_platform_websocket, 0); //unsubscribe type = 0

    if (result == 0){ //successfull unsubscribe
      subscribedResources.pop(subscribe_resource_id);
    }else{

    }
  }

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
  var graphicalReport = document.getElementById('graphicalReport');
  var close_graph = document.getElementById('close_graph');
  var subscribeResource = document.getElementById('subscribeResource');

  startWebsockets();

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
    sessionStorage.removeItem("authorization");
    document.getElementById('session').style.display = 'none';
    document.getElementById("loginStatus").innerHTML = "Your session has expired. Please sign in again";
    document.getElementById("loginStatus").style.color = "firebrick";
  }else{
  
  document.getElementById('timer').innerHTML =
    m + ":" + s;
  setTimeout(startTimer, 1000);
  }
}

function checkSecond(sec) {
  if (sec < 10 && sec >= 0) {sec = "0" + sec}; // add zero in front of numbers < 10
  if (sec < 0) {sec = "59"};
  return sec;
}

function startWebsockets(){
  websockets_connection_error = 0;

  $.ajax({
      url: 'https://symbiote-dev.man.poznan.pl:8100/coreInterface/v1/get_available_aams',
      type: "GET",
      contentType: "application/json",
      cache: false,
      success: function(data){

        for (var i = 0; i < data.length; i++){
            platform_id = data[i].aamInstanceId;
            platform_url = data[i].aamAddress.split('//')[1].split('/')[0].split(':')[0];

            if (!(platform_id in webSockets)){

              var platform_websocket = new WebSocket('ws://' + platform_url + ':8102/notification');
              platform_websocket = platform_websocket
              webSockets[platform_id] = platform_websocket;

              websocketsON(platform_websocket, platform_id, platform_url);
            }
        }
      },
      error:function(error){
        $("#loading").hide();
        alert('Problem getting URLS to start websocket connections.')
      }
  });
}

function subscriptions(subscribe_resource_id, subscribe_resource_name, subscribe_resource_platform, resource_platform_websocket, type){
  var result = 0;

  if(type == 0){ //unsubscribe
    var msg = {
      'action': 'UNSUBSCRIBE',
      'ids':[subscribe_resource_id]
    };

    resource_platform_websocket.send(JSON.stringify(msg));

    document.getElementById('subscribeResource').innerHTML = 'Subscribe'
    result = 0;

  }else{ //subscribe

    var msg = {
      'action': 'SUBSCRIBE',
      'ids':[subscribe_resource_id]
    };

    resource_platform_websocket.send(JSON.stringify(msg));

    document.getElementById('subscribeResource').innerHTML = 'Unsubscribe'
    result = 1;
  
  }
  return result;
}

function websocketsON(websocket, platform_id, platform_url){
  $("#notification").show().delay(10000).fadeOut();

  websocket.onopen = function (event) {
    console.log('Connected to the ' + platform_id + 'websocket')
  };

  websocket.onerror=function(event){
    // document.getElementById('errorModalTitle').innerHTML = 'Something went wrong, please refresh the page: <p></p>'
    // document.getElementById('errorModalClose').style.display = 'none';

    // $('#errorModal').modal({
    //   backdrop: 'static',
    //   keyboard: false
    // }); 

    // $('#searchModal').modal('hide');

    // if (websockets_connection_error != 1 ){
    //   document.getElementById('errorLabel').innerHTML += 'Problem connecting to the following platforms websocket: <p></p>'
    //   websockets_connection_error = 1
    // }

    // document.getElementById('errorLabel').innerHTML += '- ' + platform_id + ' (' + platform_url + ') <p></p>';
    // $('#errorModal').modal('show');

  };

  websocket.onmessage = function(event) {

    var msg = JSON.parse(event.data);
    alert("MESSAGE: " + msg);
  };
}

function actuators(e, description){
    var type = 4;
    var actuatorValue = 0;

    document.getElementById('light_switch').style.display = 'none';
    document.getElementById('light_dimmer').style.display = 'none';
    document.getElementById('curtain_slider').style.display = 'none';
    document.getElementById('light_rgb').style.display = 'none';
    document.getElementById('actuator_explanation').innerHTML = '';

    if(type == 1){
      document.getElementById('actuator_explanation').innerHTML = 'This actuator contains a light that can be turned on/off. <p></p>Use the switch to turn on/off the light of this actuator and the press "Actuate" to send the action.';
      document.getElementById('light_switch').style.display = 'block';

      // switch button
      $("[name='my-checkbox']").bootstrapSwitch();

      $('input[name="my-checkbox"]').on('switchChange.bootstrapSwitch', function(event, state) {
        // console.log(state); // true | false
        actuatorValue = state;
      });
    }

    if(type == 2){
      document.getElementById('actuator_explanation').innerHTML = 'This actuator contains a light whose intesity can by controlled. <p></p>Use the bar to control the light intensity of this actuator and the press "Actuate" to send the action.';
      document.getElementById('light_dimmer').style.display = 'initial';

      //sliders
      $('#ex1').slider({
        formatter: function(value) {
          actuatorValue = value;
          return 'Current value: ' + value;
        }
      });
    }

    if(type == 3){
      document.getElementById('actuator_explanation').innerHTML = 'This actuator contains a curtain whose position can be controlled. <p></p>Use the bar to control the curtain position of this actuator and the press "Actuate" to send the action.';
      document.getElementById('curtain_slider').style.display = 'initial';

      $('#ex2').slider({
        formatter: function(value) {
          actuatorValue = value;
          return 'Current value: ' + value;
        }
      });
    }
    

    if (type == 4){
      document.getElementById('actuator_explanation').innerHTML = 'This actuator contains a RGB light whose color can be changed. <p></p>Use the bar to change the light color of this actuator and the press "Actuate" to send the action.';
      document.getElementById('light_rgb').style.display = 'initial';

      // rgb sliders
      var RGBChange = function() {
        $('#RGB').css('background', 'rgb('+r.getValue()+','+g.getValue()+','+b.getValue()+')')
          actuatorValue = 'rgb('+r.getValue()+','+g.getValue()+','+b.getValue()+')';
        // console.log('rgb('+r.getValue()+','+g.getValue()+','+b.getValue()+')');
      };

      var r = $('#R').slider()
          .on('slide', RGBChange)
          .data('slider');
      var g = $('#G').slider()
          .on('slide', RGBChange)
          .data('slider');
      var b = $('#B').slider()
          .on('slide', RGBChange)
          .data('slider');
    }

    $('#actuatorsModal').modal('show');
}

function sendActuation(){

}

function sensors(e){
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

            click_resource_id = e.target.parentNode.getAttribute('id');
            click_resource_name = e.target.parentNode.getAttribute('identification');
            click_resource_platform = e.target.parentNode.getAttribute('platform_id');

            // Get all platforms tokens
            $.ajax({
                url: 'https://symbiote-dev.man.poznan.pl:8100/coreInterface/v1/get_available_aams',
                type: "GET",
                contentType: "application/json",
                cache: false,
                success: function(data){

                  for (var i = 0; i < data.length; i++){
                    if (data[i].aamInstanceId == platform_id)
                      get_token_url = data[i].aamAddress + '/request_foreign_token'
                  }
                  //Get the token using the returned url by the previous request
                  $.ajax({
                    url: get_token_url,
                    type: "POST",
                    beforeSend: function(xhr){xhr.setRequestHeader('X-Auth-Token', authorization_token);},
                    contentType: "application/json",
                    cache: false,
                    success: function(data, status, xhr){
                      var resource_token = xhr.getResponseHeader("X-Auth-Token");

                      // split_object_url = object_url.split('(');
                      // object_url = split_object_url[0] + 's(' + split_object_url[1];

                      // Get the historical data for the clicked resource (using url returned by the firs request and the specific token for the pretended platform that the resource belogns)
                      $.ajax({
                        url: object_url + "/Observations",
                        type: "GET",
                        beforeSend: function(xhr){xhr.setRequestHeader('X-Auth-Token', resource_token);},
                        contentType: "application/json",
                        cache: false,
                        success: function(data){
                          document.getElementById('subscribeResource').setAttribute('resource_id', click_resource_id);
                          document.getElementById('subscribeResource').setAttribute('resource_name', click_resource_name);
                          document.getElementById('subscribeResource').setAttribute('resource_platform', click_resource_platform);

                          historical_data = JSON.parse(data)
                          
                          graphDict = {}
                          $("#selectBox").empty();

                          for (var i = 0; i < historical_data.length; i ++){
                            if (historical_data[i]['location'])
                              var latitude = historical_data[i]['location']['latitude']
                            else
                              var latitude = "NA"
                            
                            if (historical_data[i]['location'])
                              var longitude = historical_data[i]['location']['longitude']
                            else
                              var longitude = "NA"

                            var observedProperty = historical_data[i]['obsValues'][0]['obsProperty']['label']
                            var unit = historical_data[i]['obsValues'][0]['uom']['symbol']
                            var measurementValue = historical_data[i]['obsValues'][0]['value']
                            var samplingTime = historical_data[i]['samplingTime']

                            if (observedProperty in graphDict){
                                graphDict[observedProperty].push([measurementValue, samplingTime]);
                            }

                            else{
                              graphDict[observedProperty] = []
                              graphDict[observedProperty].push([measurementValue, samplingTime]);
                              $("#selectBox").append('<option value="' + observedProperty + '">' + observedProperty + '</option>');}

                            //console.log(graphDict);

                            var table = $('#historicTable').DataTable();
                            var row = table
                            .row.add( [measurementValue, observedProperty, unit, latitude, longitude, type] )
                            .draw()
                            .node();

                          }

                          $('#infoSensorModal').modal('show');
                          $('#infoSensorModalTitle').text(name  + " data")
                          $("#loading").hide();

                        },
                        error:function(){
                          $("#loading").hide();
                          // Error code goes here.
                          document.getElementById('errorModalTitle').innerHTML = 'Something went wrong <p></p>'
                          document.getElementById('errorModalClose').style.display = 'initial';

                          document.getElementById('errorLabel').innerHTML = 'It was not possible to get resource historical data. Please try again.'
                          $('#errorModal').modal('show');
                        }
                    });

                    },
                    error:function(error){
                      $("#loading").hide();
                      // Error code goes here.
                      document.getElementById('errorModalTitle').innerHTML = 'Something went wrong <p></p>'
                      document.getElementById('errorModalClose').style.display = 'initial';
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
