function Sphere(options) {
    this.options = options || {};
    
    // constants
    this.MAX_CIRCLES = 91;
    this.MAX_LINES = this.MAX_CIRCLES * 2;

    // timing
    this.scheduler = new Scheduler();
    this.timer = new Timer();

    this.radius = 10;
    this.cSegments = 128;
    this.nCircles = this.options.nCircles || 25;
    this.nLines = this.nCircles * 2;
    this.waveVN = 10;
    this.waveHN = 20;

    // uniforms
    this.alpha = { value: 1 }; // multiply blending w/ alpha?
    this.c1 = { value: new THREE.Vector3(0, 0, 0) };
    this.c2 = { value: new THREE.Vector3(0.4, 0.4, 0.8) };
    this.c3 = { value: new THREE.Vector3(0.6, 0.9, 1.0) };
    this.gRS = { value: 0 }; // radians
    this.gRS2 = { value: 0 };
    this.gRS3 = { value: 0 }; 

    // wave uniforms
    this.waveVA = { value: 0 };
    this.waveVA2 = { value: 0 };
    this.waveVA3 = { value: 0 };
    this.waveVF = { value: 2 * Math.PI / (2 * this.radius / this.waveVN) };
    this.waveVS = { value: 4 * 2 * Math.PI }; // repeats every 0.25s
    this.waveHA = { value: 0 };
    this.waveHA2 = { value: 0 };
    this.waveHA3 = { value: 0 };
    this.waveHF = { value: this.waveHN };
    this.waveHS = { value: 4 * 2 * Math.PI };

    // attributes
    // previously allocated attrs based on nCircles
    this.cVertices = new Float32Array((this.cSegments + 1) * 3); // static
    this.cOffsets = new Float32Array(this.MAX_CIRCLES * 3);
    this.cScales = new Float32Array(this.MAX_CIRCLES);

    // previously allocated based on nLines
    this.lVertices = new Float32Array((this.MAX_CIRCLES + 2) * 3);
    this.lOffsets = new Float32Array(this.MAX_LINES * 3); // static
    this.lRotations = new Float32Array(this.MAX_LINES); // radians
    this.lDisplayParams = new Float32Array(this.MAX_LINES);

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
            time: { value: 0 },
            waveVA: this.waveVA,
            waveVF: this.waveVF,
            waveVS: this.waveVS,
            waveHA: this.waveHA,
            waveHF: this.waveHF,
            waveHS: this.waveHS,
            alpha: this.alpha,
            sColor: this.c1,
            gRS: this.gRS
        },
        vertexShader: vs,
        fragmentShader: fs,
        transparent: true,
        blending: THREE["MultiplyBlending"]
    });

    var cMaterial2 = cMaterial.clone();
    cMaterial2.uniforms.sColor = this.c2;
    cMaterial2.uniforms.gRS = this.gRS2;

    this.cMesh = new THREE.Line(this.cig, cMaterial);
    this.cMesh2 = new THREE.Line(this.cig, cMaterial2);

    // set lig attributes
    this.updateLineVertices();
    this.updateLineRotations();
    this.updateLineDisplayParams();

    this.lig = new THREE.InstancedBufferGeometry();
    this.lig.addAttribute("position", new THREE.BufferAttribute(this.lVertices, 3));
    this.lig.addAttribute("offset", new THREE.InstancedBufferAttribute(this.lOffsets, 3)); // use in vs required
    this.lig.addAttribute("rotation", new THREE.InstancedBufferAttribute(this.lRotations, 1));
    this.lig.addAttribute("displayParam", new THREE.InstancedBufferAttribute(this.lDisplayParams, 1));

    var vs2 = document.getElementById("vertexShader2").textContent;
    var fs2 = document.getElementById("fragmentShader2").textContent;
    var lMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            waveVA: this.waveVA,
            waveVF: this.waveVF,
            waveVS: this.waveVS,
            waveHA: this.waveHA,
            waveHF: this.waveHF,
            waveHS: this.waveHS,
            alpha: this.alpha,
            sColor: this.c1,
            gRS: this.gRS
        },
        vertexShader: vs2,
        fragmentShader: fs2,
        transparent: true,
        blending: THREE["MultiplyBlending"]
    });

    var lMaterial2 = lMaterial.clone();
    lMaterial2.uniforms.waveVA = this.waveVA2;
    lMaterial2.uniforms.waveHA = this.waveHA2;
    lMaterial2.uniforms.sColor = this.c2;
    lMaterial2.uniforms.gRS = this.gRS2;

    var lMaterial3 = lMaterial.clone();
    lMaterial2.uniforms.waveVA = this.waveVA3;
    lMaterial2.uniforms.waveHA = this.waveHA3;
    lMaterial3.uniforms.sColor = this.c3;
    lMaterial3.uniforms.gRS = this.gRS3;

    this.lMesh = new THREE.Line(this.lig, lMaterial); 
    this.lMesh2 = new THREE.Line(this.lig, lMaterial2); 
    this.lMesh3 = new THREE.Line(this.lig, lMaterial3); 
}

// cw along xz
Sphere.prototype.updateCircleVertices = function() {
    var thetaStep = 2 * Math.PI / this.cSegments;
    for (var i = 0; i <= this.cSegments; i++) {
        this.cVertices[i * 3] = this.radius * Math.cos(thetaStep * i);
        this.cVertices[i * 3 + 1] = 0;
        this.cVertices[i * 3 + 2] = this.radius * Math.sin(thetaStep * i);
    }
};

// higher attr indices should be cleared when nCircles is scaled down
// replace vec3 (?), might be able to move calc to vs
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

// re-using circle scales here
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

Sphere.prototype.updateLineDisplayParams = function() {
    this.lDisplayParams.fill(1, 0, this.nLines);
    this.lDisplayParams.fill(0, this.nLines, this.MAX_LINES);
};

// called on nCircles change
// review
Sphere.prototype.updateIGAttrs = function(n) {
    if (n !== undefined) this.nCircles = n;
    //this.updateCircleVertices();
    this.updateCircleOffsets();
    this.updateCircleScales();
    //this.cig.attributes.position.needsUpdate = true;
    //this.cig.attributes.offset.needsUpdate = true;
    //this.cig.attributes.scale.needsUpdate = true;

    this.nLines = this.nCircles * 2;
    this.updateLineVertices();
    this.updateLineRotations();
    this.updateLineDisplayParams();
    this.lig.attributes.position.needsUpdate = true;
    this.lig.attributes.rotation.needsUpdate = true;
    this.lig.attributes.displayParam.needsUpdate = true;
};

Sphere.prototype.timedUpdate = function(ms) {
    this.scheduler.runTasks();
    //this.cMesh.material.uniforms.time.value = (Date.now() / 1000) % 20; // repeats every 20s
    //this.cMesh.material.uniforms.gRS.value = (this.timer.get("cgRS") + this.timer.get("gRS")) % (2 * Math.PI);
    //this.cMesh.material.uniforms.waveVA.value = this.timer.get("waveVA");

    var ns = (Date.now() / 1000) % 20;
    var cgRS = this.timer.get("cgRS");
    var rMod = 2 * Math.PI;

    this.lMesh.material.uniforms.time.value = ns;
    this.lMesh2.material.uniforms.time.value = ns;
    this.lMesh3.material.uniforms.time.value = ns;
    this.lMesh.material.uniforms.gRS.value = (cgRS + this.timer.get("gRS")) % rMod;
    this.lMesh2.material.uniforms.gRS.value = (cgRS + this.timer.get("gRS2")) % rMod;
    this.lMesh3.material.uniforms.gRS.value = (cgRS + this.timer.get("gRS3")) % rMod;
    this.lMesh.material.uniforms.waveVA.value = this.timer.get("waveVA");
    this.lMesh2.material.uniforms.waveVA.value = this.timer.get("waveVA2");
    this.lMesh3.material.uniforms.waveVA.value = this.timer.get("waveVA3");
    this.lMesh.material.uniforms.waveHA.value = this.timer.get("waveHA");
    this.lMesh2.material.uniforms.waveHA.value = this.timer.get("waveHA2");
    this.lMesh3.material.uniforms.waveHA.value = this.timer.get("waveHA3");

    // vertex updates
    var circles = Math.floor(this.timer.get("nCircles")) || this.nCircles;
    if (circles != this.nCircles) this.updateIGAttrs(circles);
};

// de-syncing
Sphere.prototype.startAnimation = function() {
    var self = this;

    // 12200
    var spinCB = function(scheduler, now) {
        scheduler.addTask({ condition: now + 12200, runCallback: spinCB });
        var gRS = self.timer.get("gRS", now);
        if (gRS === null) gRS = 0;
        self.timer.addTransition({ key: "gRS", duration: 8200, startVal: gRS, endVal: gRS + 2 * Math.PI, type: "iosine" });

        var gRS2 = self.timer.get("gRS2", now);
        if (gRS2 === null) gRS2 = 0;
        self.timer.addTransition({ key: "gRS2", duration: 8220, startVal: gRS2, endVal: gRS2 + 2 * Math.PI, type: "iosine" });

        var gRS3 = self.timer.get("gRS3", now);
        if (gRS3 === null) gRS3 = 0;
        self.timer.addTransition({ key: "gRS3", duration: 8250, startVal: gRS3, endVal: gRS3 + 2 * Math.PI, type: "iosine" });
    };

    // 12200 (5600)
    var vwaveCB = function(scheduler, now) {
        scheduler.addTask({ condition: now + 2200, runCallback: vwaveCB2 });
        self.timer.addTransition({ key: "waveVA", duration: 1800, startVal: 0, endVal: 0.06, type: "iosine" });
        self.timer.addTransition({ key: "waveVA2", duration: 2000, startVal: 0, endVal: 0.06, type: "iosine" });
        self.timer.addTransition({ key: "waveVA3", duration: 2200, startVal: 0, endVal: 0.06, type: "iosine" });
    };
    var vwaveCB2 = function(scheduler, now) {
        scheduler.addTask({ condition: now + 10000, runCallback: vwaveCB });
        var waveVA = self.timer.get("waveVA", now) || 0;
        self.timer.addTransition({ key: "waveVA", duration: 3600, startVal: waveVA, endVal: 0, type: "iosine" });
        var waveVA2 = self.timer.get("waveVA2", now) || 0;
        self.timer.addTransition({ key: "waveVA2", duration: 3900, startVal: waveVA2, endVal: 0, type: "iosine" });
        var waveVA3 = self.timer.get("waveVA3", now) || 0;
        self.timer.addTransition({ key: "waveVA3", duration: 4200, startVal: waveVA3, endVal: 0, type: "iosine" });
    };

    // 24400
    var hwaveCB = function(scheduler, now) {
        scheduler.addTask({ condition: now + 2200, runCallback: hwaveCB2 });
        self.timer.addTransition({ key: "waveHA", duration: 1800, startVal: 0, endVal: 0.006, type: "iosine" });
        self.timer.addTransition({ key: "waveHA2", duration: 2000, startVal: 0, endVal: 0.006, type: "iosine" });
        self.timer.addTransition({ key: "waveHA3", duration: 2200, startVal: 0, endVal: 0.006, type: "iosine" });
    };
    var hwaveCB2 = function(scheduler, now) {
        scheduler.addTask({ condition: now + 22200, runCallback: hwaveCB });
        var waveHA = self.timer.get("waveHA", now) || 0;
        self.timer.addTransition({ key: "waveHA", duration: 3600, startVal: waveHA, endVal: 0, type: "iosine" });
        var waveHA2 = self.timer.get("waveHA2", now) || 0;
        self.timer.addTransition({ key: "waveHA2", duration: 3900, startVal: waveHA2, endVal: 0, type: "iosine" });
        var waveHA3 = self.timer.get("waveHA3", now) || 0;
        self.timer.addTransition({ key: "waveHA3", duration: 4200, startVal: waveHA3, endVal: 0, type: "iosine" });
    };

    // 34000
    var circleCB = function(scheduler, now) {
        scheduler.addTask({ condition: now + 22000, runCallback: circleCB2 });
        var nCircles = self.timer.get("nCircles", now);
        if (nCircles === null) nCircles = self.nCircles;
        self.timer.addTransition({ key: "nCircles", duration: 1000, startVal: nCircles, endVal: 75, type: "linear" });
    };
    var circleCB2 = function(scheduler, now) {
        scheduler.addTask({ condition: now + 12000, runCallback: circleCB });
        var nCircles = self.timer.get("nCircles", now);
        if (nCircles === null) nCircles = self.nCircles;
        self.timer.addTransition({ key: "nCircles", duration: 1000, startVal: nCircles, endVal: 25, type: "linear" });
    };

    // constant stuff
    this.timer.addTransition({ key: "cgRS", rate: 2 * Math.PI / (1000 * 30), type: "constant" });

    var now = Date.now();
    this.scheduler.addTask({ condition: now + 1000, runCallback: spinCB });
    this.scheduler.addTask({ condition: now + 3000, runCallback: vwaveCB });
    this.scheduler.addTask({ condition: now + 15200, runCallback: hwaveCB });
    this.scheduler.addTask({ condition: now + 1400, runCallback: circleCB });
};

