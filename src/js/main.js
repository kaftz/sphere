import { Sphere } from "./Sphere.js";

var testCanvas = document.createElement("canvas");
var testContext = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
var webGL = !!(window.WebGLRenderingContext && testContext);

var camera, scene, renderer, orbit, stats, gui, sphere;
var width = window.innerWidth;
var height = window.innerHeight;
var camX = 0;
var camY = 32;
var camZ = 32;

if (webGL && testContext.getExtension("ANGLE_instanced_arrays")) {
  setup();
  run();
} else {
  var text =
    "Sorry, unable to initialize WebGL and required extensions. https://www.google.com/chrome/browser/";
  var div = document.createElement("div");
  var content = document.createTextNode(text);
  div.appendChild(content);
  div.id = "error";
  document.body.appendChild(div);
}

function setup() {
  camera = new THREE.PerspectiveCamera(40, width / height, 10, 200);
  camera.position.y = camY;
  camera.position.z = camZ;
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  sphere = new Sphere();
  // scene.add(sphere.cMesh);
  // scene.add(sphere.cMesh2);
  scene.add(sphere.lMesh);
  scene.add(sphere.lMesh2);
  scene.add(sphere.lMesh3);

  // gui = new dat.GUI();
  // gui
  //   .add(sphere, "nCircles", 3, sphere.MAX_CIRCLES)
  //   .step(1)
  //   .onChange(function () {
  //     sphere.updateIGAttrs();
  //   });

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  document.body.appendChild(renderer.domElement);

  // orbit = new THREE.OrbitControls(camera, renderer.domElement);
  // orbit.enableZoom = false;

  // stats = new Stats();
  // stats.domElement.setAttribute("id", "stats");
  // document.body.appendChild(stats.domElement);

  sphere.startAnimation();

  // Add event handlers
  window.addEventListener("resize", onResize, false);
  window.addEventListener("mousemove", onMousemove, false);
}

function run() {
  // stats.begin();
  sphere.update();
  renderer.render(scene, camera);
  // stats.end();
  requestAnimationFrame(run);
}

function onResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function onMousemove(e) {
  camera.position.x = camX - ((width / 2 - e.clientX) * 0.4) / width;
  camera.position.y = camY + ((height / 2 - e.clientY) * 0.4) / height;
}
