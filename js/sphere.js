function Sphere(options) {
    this.options = options || {};

    // constants
    this.MAX_CIRCLES = 91;
    this.MAX_LINES = this.MAX_CIRCLES * 2;

    this.radius = 10;
    this.cSegments = 128;
    this.nCircles = this.options.nCircles || 3;
    this.nLines = this.nCircles * 2;

    // uniforms
    this.waveParam = 8;
    this.alpha = { value: 0.33 };
    this.time = { value: 0 };
    this.c1 = { value: new THREE.Vector3(1, 0, 0) };
    this.c2 = { value: new THREE.Vector3(0, 0, 1) };

    // attributes
    // previously allocated attrs based on nCircles
    this.cVertices = new Float32Array((this.cSegments + 1) * 3); // static
    this.cOffsets = new Float32Array(this.MAX_CIRCLES * 3);
    this.cScales = new Float32Array(this.MAX_CIRCLES);

    // previously allocated based on nLines
    this.lVertices = new Float32Array((this.MAX_CIRCLES + 2) * 3);
    this.lOffsets = new Float32Array(this.MAX_LINES * 3); // static
    this.lRotations = new Float32Array(this.MAX_LINES); // radians
    this.lAlphas = new Float32Array(this.MAX_LINES);

    // set cig attributes
    this.updateCircleVertices();
    this.updateCircleOffsets();
    this.updateCircleScales();

    this.cig = new THREE.InstancedBufferGeometry();
    this.cig.addAttribute("position", new THREE.BufferAttribute(this.cVertices, 3));
    this.cig.addAttribute("offset", new THREE.InstancedBufferAttribute(this.cOffsets, 3));
    this.cig.addAttribute("scale", new THREE.InstancedBufferAttribute(this.cScales, 1));

    var vs = document.getElementById("vertexShader").textContent;
    var fs = document.getElementById("fragmentShader").textContent;
    var cMaterial = new THREE.ShaderMaterial({
        uniforms: {
            sColor: this.c1,
            alpha: this.alpha
        },
        vertexShader: vs,
        fragmentShader: fs,
        transparent: true,
        blending: "MultiplyBlending"
    });
    var cMaterial2 = cMaterial.clone();
    cMaterial2.uniforms.sColor = this.c2;

    this.cMesh = new THREE.Line(this.cig, cMaterial);
    this.cMesh2 = new THREE.Line(this.cig, cMaterial2);

    // set lig attributes
    this.updateLineVertices();
    this.updateLineRotations();
    this.updateLineAlphas();

    this.lig = new THREE.InstancedBufferGeometry();
    this.lig.addAttribute("position", new THREE.BufferAttribute(this.lVertices, 3));
    this.lig.addAttribute("offset", new THREE.InstancedBufferAttribute(this.lOffsets, 3)); // use in vs required
    this.lig.addAttribute("rotation", new THREE.InstancedBufferAttribute(this.lRotations, 1));
    this.lig.addAttribute("alphaParam", new THREE.InstancedBufferAttribute(this.lAlphas, 1));

    var vs2 = document.getElementById("vertexShader2").textContent;
    var fs2 = document.getElementById("fragmentShader2").textContent;
    var lMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: this.time,
            sColor: this.c1,
            waveParam: { value: this.waveParam },
            alpha: this.alpha
        },
        vertexShader: vs2,
        fragmentShader: fs2,
        transparent: true,
        blending: "MultiplyBlending"
    });
    var lMaterial2 = lMaterial.clone();
    lMaterial2.uniforms.sColor = this.c2;

    this.lMesh = new THREE.Line(this.lig, lMaterial); 
    this.lMesh2 = new THREE.Line(this.lig, lMaterial2); 
}

// move radius adjustment to vs?
// cw along xz
Sphere.prototype.updateCircleVertices = function() {
    var thetaStep = 2 * Math.PI / this.cSegments;
    for (var i = 0; i <= this.cSegments; i++) {
        var adjustedRadius = this.radius + Math.sin(thetaStep * i * this.waveParam);
        this.cVertices[i * 3] = adjustedRadius * Math.cos(thetaStep * i);
        this.cVertices[i * 3 + 1] = 0;
        this.cVertices[i * 3 + 2] = adjustedRadius * Math.sin(thetaStep * i);
    }
};

// higher attr indices should be cleared when nCircles is scaled down
// probably can't optimize this much without moving to vs
Sphere.prototype.updateCircleOffsets = function() {
    var cOffsetStep = 2 * this.radius / (this.nCircles + 1);
    for (var i = 0; i < this.nCircles; i++) {
        this.cOffsets[i * 3] = 0;
        this.cOffsets[i * 3 + 1] = this.radius - (i + 1) * cOffsetStep;
        this.cOffsets[i * 3 + 2] = 0;
    }
    this.cOffsets.fill(0, this.nCircles * 3); // might be unnecessary due to scale clearing
};

Sphere.prototype.updateCircleScales = function() {
    for (var i = 0; i < this.nCircles; i++) {
        var theta = Math.asin(this.cOffsets[i * 3 + 1] / this.radius);
        this.cScales[i] = Math.cos(theta);
    }
    this.cScales.fill(0, this.nCircles);
};

// may reuse circle scale calcs here?
Sphere.prototype.updateLineVertices = function() {
    this.lVertices[0] = 0;
    this.lVertices[1] = this.radius;
    this.lVertices[2] = 0;
    this.lVertices[(this.nCircles + 1) * 3] = 0;
    this.lVertices[(this.nCircles + 1) * 3 + 1] = -this.radius;
    this.lVertices[(this.nCircles + 1) * 3 + 2] = 0;
    for (var i = 0; i < this.nCircles; i++) {
        this.lVertices[(i + 1) * 3] = this.cScales[i] * this.radius; 
        this.lVertices[(i + 1) * 3 + 1] = this.cOffsets[i * 3 + 1];
        this.lVertices[(i + 1) * 3 + 2] = 0;
    }

    // clearing to bottom vertex
    for (var j = this.nCircles + 2; j < this.MAX_CIRCLES + 2; j++) {
        this.lVertices[j * 3] = 0;
        this.lVertices[j * 3 + 1] = -this.radius;
        this.lVertices[j * 3 + 2] = 0;
    }
};

// ccw along xz surface
Sphere.prototype.updateLineRotations = function() {
    var lRotationStep = 2 * Math.PI / this.nLines;
    for (var i = 0; i < this.nLines; i++) {
        this.lRotations[i] = lRotationStep * i;
    }
    this.lRotations.fill(0, this.nLines);
};

// hide extra line vertices (use alpha or try scaling down)
Sphere.prototype.updateLineAlphas = function() {
    this.lAlphas.fill(1, 0, this.nLines);
    this.lAlphas.fill(0, this.nLines, this.MAX_LINES);
};

// called on nCircles change
// review this
Sphere.prototype.updateCIGAttrs = function() {
    this.nLines = this.nCircles * 2;

    this.updateCircleVertices();
    this.updateCircleOffsets();
    this.updateCircleScales();
    this.cig.attributes.position.needsUpdate = true;
    this.cig.attributes.offset.needsUpdate = true;
    this.cig.attributes.scale.needsUpdate = true;

    this.updateLineVertices();
    this.updateLineRotations();
    this.updateLineAlphas();
    this.lig.attributes.position.needsUpdate = true;
    this.lig.attributes.rotation.needsUpdate = true;
    this.lig.attributes.alphaParam.needsUpdate = true;
};

Sphere.prototype.timedUpdate = function(ms) {
    console.log("starting timed update");
    //if (!this.lastUpdateMS) this.lastUpdateMS = Date.now();
    this.time.value = Date.now() / 1000;
    this.updateCIGAttrs();
};
