function Scheduler() {
    this.tasks = [];
}

Scheduler.prototype.addTask = function(task) {
    this.tasks.push(task);
};

Scheduler.prototype.runTasks = function(now) {
    var self = this;
    if (now === undefined) now = Date.now();

    this.tasks.forEach(function(task) {
        var ready = task.condition instanceof Function ? task.condition(self, now) : task.condition < now;
        if (ready) {
            if (task.runCallback) task.runCallback(self, now);
            task.run = true;
        }
    });

    this.tasks = this.tasks.filter(function(task) {
        return !task.run;
    });
};


// easing
function Timer() {
    this.transitions = {};
}

// required: duration?, startVal, endVal
Timer.prototype.addTransition = function(t) {
    if (!t.key) throw new Error("key is required");
    //if (this.transitions[t.key]) throw new Error("key is in use"); // just override?

    var now = Date.now();
    t.start = now; // start and end mutually exclusive with rate
    if (t.duration) t.end = t.duration + now;
    if (!t.type) t.type = "linear";
    this.transitions[t.key] = t;
};

// check for completion?
Timer.prototype.get = function(key, now) {
    var t = this.transitions[key];
    if (!t) return null;
    if (now === undefined) now = Date.now();

    switch (t.type) {
        case "linear": return this.linear(t, now);
        case "iosine": return this.iosine(t, now);
        case "constant": return this.constant(t, now);
        default: throw new Error("transition type was not matched");
    }
};

Timer.prototype.linear = function(t, now) {
    var res = t.end < now ? 1 : (now - t.start) / t.duration;
    if (t.startVal !== undefined && t.endVal !== undefined) res = t.startVal + res * (t.endVal - t.startVal);
    return res;
};

Timer.prototype.iosine = function(t, now) {
    var d = now - t.start;
    //var res = d > t.duration ? 1 : d  < t.duration / 2 ? 4 * d * d * d : (d - 1) * (2 * d - 2) * (2 * d - 2) + 1;
    var res = d > t.duration ? 1 : -0.5 * (Math.cos(Math.PI * d/t.duration) - 1);
    if (t.startVal !== undefined && t.endVal !== undefined) res = t.startVal + res * (t.endVal - t.startVal);
    return res;
};

// constant rate
Timer.prototype.constant = function(t, now) {
    return (now - t.start) * t.rate;
};


function Sphere(options) {
    this.options = options || {};
    
    // temp
    this.scheduler = new Scheduler();
    this.timer = new Timer();

    // constants
    this.MAX_CIRCLES = 91;
    this.MAX_LINES = this.MAX_CIRCLES * 2;

    this.radius = 10;
    this.cSegments = 128;
    this.nCircles = this.options.nCircles || 15;
    this.nLines = this.nCircles * 2;

    // wave params (calc time interval)
    this.waveVN = 10;
    this.waveHN = 10;

    // uniforms
    this.alpha = { value: 0.3 };
    this.c1 = { value: new THREE.Vector3(1, 0, 1) };
    this.c2 = { value: new THREE.Vector3(0, 1, 1) };
    this.c3 = { value: new THREE.Vector3(1, 1, 0) };
    this.gRS = { value: 0 }; // radians
    this.gRS2 = { value: 0 };
    this.gRS3 = { value: 0 }; 

    // wave uniforms
    this.waveVA = { value: 0.00 };
    this.waveVF = { value: 2 * Math.PI / (2 * this.radius / this.waveVN) };
    this.waveVS = { value: 2 * Math.PI / 2 };
    this.waveHA = { value: 0.00 };
    this.waveHF = { value: this.waveHN };
    this.waveHS = { value: 2 * Math.PI / 2 };

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
            time: { value: 0 },
            waveVA: this.waveVA,
            waveVF: this.waveVF,
            waveVS: this.waveVS,
            waveHA: this.waveHA,
            waveHF: this.waveHF,
            waveHS: this.waveHS,
            alpha: this.alpha,
            sColor: this.c1,
            gRotation: { value: 0 }
        },
        vertexShader: vs,
        fragmentShader: fs,
        transparent: true,
        blending: "MultiplyBlending"
    });

    var cMaterial2 = cMaterial.clone();
    cMaterial2.uniforms.sColor = this.c2;
    cMaterial2.uniforms.gRS = this.gRS2;

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
    lMaterial2.uniforms.sColor = this.c2;
    lMaterial2.uniforms.gRS = this.gRS2;

    var lMaterial3 = lMaterial.clone();
    lMaterial3.uniforms.sColor = this.c3;
    lMaterial3.uniforms.gRS = this.gRS3;

    this.lMesh = new THREE.Line(this.lig, lMaterial); 
    this.lMesh2 = new THREE.Line(this.lig, lMaterial2); 
    this.lMesh3 = new THREE.Line(this.lig, lMaterial3); 
}

// move radius adjustment to vs?
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
// probably can't optimize this much without moving to vs
// does this have to be a vec3?
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

Sphere.prototype.updateCircleSW = function() {
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
    //if (!this.lastUpdateMS) this.lastUpdateMS = Date.now();
    //this.cMesh.material.uniforms.time.value = (Date.now() / 1000) % 10; // period: 2s
    //this.cMesh2.material.uniforms.time.value = (Date.now() / 1000) % 10;

    /*
    this.lMesh.material.uniforms.time.value = (Date.now() / 1000) % 20;
    this.lMesh2.material.uniforms.time.value = (Date.now() / 1000) % 19;
    this.updateCIGAttrs();
    */

    this.scheduler.runTasks();
    this.lMesh.material.uniforms.gRS.value = (this.timer.get("cgRS") + this.timer.get("gRS")) % (2 * Math.PI);
    this.lMesh2.material.uniforms.gRS.value = (this.timer.get("cgRS") + this.timer.get("gRS2")) % (2 * Math.PI);
    this.lMesh3.material.uniforms.gRS.value = (this.timer.get("cgRS") + this.timer.get("gRS3")) % (2 * Math.PI);
};

Sphere.prototype.startAnimation = function() {
    var self = this;

    // constant stuff
    self.timer.addTransition({
        key: "cgRS",
        rate: 2 * Math.PI / (1000 * 20), // radians per ms
        type: "constant"
    });

    var mainCB = function(scheduler, now) {
        scheduler.addTask({ 
            condition: now + 10000,
            runCallback: mainCB
        });

        var gRS = self.timer.get("gRS", now);
        if (gRS === null) gRS = 0;
        self.timer.addTransition({
            key: "gRS",
            duration: 5000,
            startVal: gRS,
            endVal: gRS + 2 * Math.PI,
            type: "iosine"
        });

        var gRS2 = self.timer.get("gRS2", now);
        if (gRS2 === null) gRS2 = 0;
        self.timer.addTransition({
            key: "gRS2",
            duration: 5050,
            startVal: gRS2,
            endVal: gRS2 + 2 * Math.PI,
            type: "iosine"
        });

        var gRS3 = self.timer.get("gRS3", now);
        if (gRS3 === null) gRS3 = 0;
        self.timer.addTransition({
            key: "gRS3",
            duration: 5120,
            startVal: gRS3,
            endVal: gRS3 + 2 * Math.PI,
            type: "iosine"
        });
    };

    var now = Date.now();
    this.scheduler.addTask({
        condition: now + 1000,
        runCallback: mainCB
    });
};

