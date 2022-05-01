"use strict";

var canvas;
var gl;
var program;
var skyboxProgram;

var index = 0;

var set = false;

var pointsArray = [];
var normalsArray = [];

var near = -10;
var far = 10;
var radius = 1.5;
var theta  = 0.0;
var phi    = 0.0;
var dr = 5.0 * Math.PI/180.0;

var left = -3.0;
var right = 3.0;
var ytop =3.0;
var bottom = -3.0;

var va = vec4(0.0, 0.0, -1.0,1);
var vb = vec4(0.0, 0.942809, 0.333333, 1);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1);
var vd = vec4(0.816497, -0.471405, 0.333333,1);

var lightPosition = vec4(1.0, 1.0, 1.0, 0.0 );
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialAmbient = vec4( 1.0, 0.0, 1.0, 1.0 );
var materialDiffuse = vec4( 1.0, 0.8, 0.3, 1.0 );
var materialSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialShininess = 1.5;

var ctm;
var ambientColor, diffuseColor, specularColor;

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var normalMatrix, normalMatrixLoc;

var rotationMatrix, rotationMatrixLoc; 
var  angle = 0.0;
var  axis = [0, 0, 1];

var 	trackingMouse = false;
var   trackballMove = false;

var lastPos = [0, 0, 0];
var curx, cury;
var startX, startY;


var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

var texture, texture2;
var texCoordsArray = [];

var u, v; //parametric points for sphere texture

var clouds;

function multq( a,  b)
{
   var s = vec3(a[1], a[2], a[3]);
   var t = vec3(b[1], b[2], b[3]);
   return(vec4(a[0]*b[0] - dot(s,t), add(cross(t, s), add(scale(a[0],t), scale(b[0],s)))));
}
function trackballView( x,  y ) {
    var d, a;
    var v = [];

    v[0] = x;
    v[1] = y;

    d = v[0]*v[0] + v[1]*v[1];
    if (d < 1.0)
      v[2] = Math.sqrt(1.0 - d);
    else {
      v[2] = 0.0;
      a = 1.0 /  Math.sqrt(d);
      v[0] *= a;
      v[1] *= a;
    }
    return v;
}

function mouseMotion( x,  y)
{
    var dx, dy, dz;

    var curPos = trackballView(x, y);
    if(trackingMouse) {
      dx = curPos[0] - lastPos[0];
      dy = curPos[1] - lastPos[1];
      dz = curPos[2] - lastPos[2];

      if (dx || dy || dz) {
	       angle = -0.1 * Math.sqrt(dx*dx + dy*dy + dz*dz);


	       axis[0] = lastPos[1]*curPos[2] - lastPos[2]*curPos[1];
	       axis[1] = lastPos[2]*curPos[0] - lastPos[0]*curPos[2];
	       axis[2] = lastPos[0]*curPos[1] - lastPos[1]*curPos[0];

         lastPos[0] = curPos[0];
	       lastPos[1] = curPos[1];
	       lastPos[2] = curPos[2];
      }
    }
    //render();
    //window.requestAnimFrame(render);
}

function startMotion( x,  y)
{
    trackingMouse = true;
    startX = x;
    startY = y;
    curx = x;
    cury = y;

    lastPos = trackballView(x, y);
	  trackballMove=true;
}

function stopMotion( x,  y)
{
    trackingMouse = false;
    if (startX != x || startY != y) {
    }
    else {
	     angle = 0.0;
	     //trackballMove = false;
    }
    trackballMove = false;
}


function computeParametric(pointsArray) {
    for (var i = 0; i < pointsArray.length; i++)
    {
        var x = pointsArray[i][0] == 0 ? 0 : pointsArray[i][0];
        var y = pointsArray[i][1] == 0 ? 0 : pointsArray[i][1];
        var z = pointsArray[i][2] == 0 ? 0 : pointsArray[i][2];   

        u = Math.atan2(x, z) / (2*Math.PI) + 0.5;
        v = (Math.asin(y) / Math.PI) + 0.5;

        texCoordsArray.push(u,v);
    }
}

function triangle(a, b, c) {

     pointsArray.push(a);
     pointsArray.push(b);
     pointsArray.push(c);
     // normals are vectors

     normalsArray.push(a[0],a[1], a[2], 0.0);
     normalsArray.push(b[0],b[1], b[2], 0.0);
     normalsArray.push(c[0],c[1], c[2], 0.0);

     index += 3;

}



function divideTriangle(a, b, c, count) {
    if ( count > 0 ) {

        var ab = mix( a, b, 0.5);
        var ac = mix( a, c, 0.5);
        var bc = mix( b, c, 0.5);

        ab = normalize(ab, true);
        ac = normalize(ac, true);
        bc = normalize(bc, true);

        divideTriangle( a, ab, ac, count - 1 );
        divideTriangle( ab, b, bc, count - 1 );
        divideTriangle( bc, c, ac, count - 1 );
        divideTriangle( ab, bc, ac, count - 1 );
    }
    else {
        triangle( a, b, c );
    }
}



function tetrahedron(a, b, c, d, n) {
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}


function configureTexture( image ) {
    texture = gl.createTexture();
    gl.bindTexture( gl.TEXTURE_2D, texture );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image );
    gl.generateMipmap( gl.TEXTURE_2D );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

   gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
}


function createTexture(url)
{
    var image = new Image();
    image.onload = function() {
        configureTexture( image );
    }
    image.src = url;
}


window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    gl.enable(gl.DEPTH_TEST);

    program = initShaders( gl, "vertex-shader", "fragment-shader" );

    gl.useProgram( program );

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);


    tetrahedron(va, vb, vc, vd, 8);
    //NBUFFER
    var nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW );

    //VNORMAL
    var vNormal = gl.getAttribLocation( program, "vNormal" );
    gl.vertexAttribPointer( vNormal, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal);

    //VBUFFER
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    //VPOSITION
    var vPosition = gl.getAttribLocation( program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    computeParametric(pointsArray);

    //Rotation Matrix 
    rotationMatrix = vec4(1,0,0,0);
    rotationMatrixLoc = gl.getUniformLocation(program, "r");
    gl.uniform4fv(rotationMatrixLoc, flatten(rotationMatrix));

    //VBuffer
    var tBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, tBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW );

    //VTex
    var vTexCoord = gl.getAttribLocation( program, "vTexCoord" );
    gl.vertexAttribPointer( vTexCoord, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vTexCoord );

    createTexture("./images/earthcloudless_resize.png");
    clouds = true;

    modelViewMatrixLoc = gl.getUniformLocation( program, "modelViewMatrix" );
    projectionMatrixLoc = gl.getUniformLocation( program, "projectionMatrix" );
    normalMatrixLoc = gl.getUniformLocation( program, "normalMatrix" );

    gl.uniform4fv( gl.getUniformLocation(program,
         "ambientProduct"),flatten(ambientProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
         "diffuseProduct"),flatten(diffuseProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
         "specularProduct"),flatten(specularProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
         "lightPosition"),flatten(lightPosition) );
    gl.uniform1f( gl.getUniformLocation(program,
         "shininess"),materialShininess );

    canvas.addEventListener("mousedown", function(event){
        var x = 2*event.clientX/canvas.width-1;
        var y = 2*(canvas.height-event.clientY)/canvas.height-1;
        startMotion(x, y);
        console.log("Mouse down");
    });
      
    canvas.addEventListener("mouseup", function(event){
        var x = 2*event.clientX/canvas.width-1;
        var y = 2*(canvas.height-event.clientY)/canvas.height-1;
        stopMotion(x, y);
        console.log("Mouse up");
        });
      
    canvas.addEventListener("mousemove", function(event){
        if (trackingMouse == false) return;
        var x = 2*event.clientX/canvas.width-1;
        var y = 2*(canvas.height-event.clientY)/canvas.height-1;
        mouseMotion(x, y);
        console.log("Mouse move");
    } );

    document.getElementById("Button1").onclick = function(){
        var wheelChange = -.1;
        if (ytop + wheelChange > 0.80) {
            left -= wheelChange;
            right += wheelChange;
            bottom -= wheelChange;
            ytop += wheelChange;
        }
    }

    document.getElementById("Button2").onclick = function(){
        var wheelChange = .1;
        if (ytop + wheelChange > 0.80) {
            left -= wheelChange;
            right += wheelChange;
            bottom -= wheelChange;
            ytop += wheelChange;
        }
    }

    document.getElementById("Button0").onclick = function() {
        if (clouds) {
            createTexture("./images/earthwclouds_resize.png");
            clouds = false;
        }
        else {
            createTexture("./images/earthcloudless_resize.png");
            clouds = true;
        }
    }

    render();
}

var rotation;
var c,s;
function render() {

    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor(0, 0, 0, 0.0);

    if(trackballMove) {
        axis = normalize(axis);
        c = Math.cos(angle-0.005/2.0);
        s = Math.sin(angle-0.005/2.0);

        rotation = vec4(c, s*axis[0] , s*axis[1], s*axis[2]);
        rotationMatrix = multq(rotationMatrix, rotation);
        gl.uniform4fv(rotationMatrixLoc, flatten(rotationMatrix));
    }
    
    //Rotation element
    theta += 0.001;

    eye = vec3(radius*Math.sin(theta)*Math.cos(phi),
        radius*Math.sin(theta)*Math.sin(phi), radius*Math.cos(theta));

    modelViewMatrix = lookAt(eye, at , up );
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    //takes the transpose of the modelViewMatrix to rotate normals
    normalMatrix = [
        vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]),
        vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]),
        vec3(modelViewMatrix[0][2], modelViewMatrix[1][2], modelViewMatrix[2][2])
    ];

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix) );
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix) );

    gl.drawArrays( gl.TRIANGLES, 0, 3*index);

    window.requestAnimFrame(render);
}
