// lambda - meters, phase - radians
function Wave(k, lambda, pAmp, phase) {
    this.kNorm = math.divide(k, math.norm(k));
    this.kMag = 2 * Math.PI / lambda;
    this.k = math.multiply(this.kNorm, this.kMag);
    this.f = Math.sqrt(9.81 * this.kMag);

    if (pAmp > 1) pAmp = 1;
    this.amp = pAmp / this.kMag;
    this.phase = phase;
}

// m rows by n cols
function Ocean(options) {
    this.options = options || {};
    this.options.computeNormalMesh = this.options.computeNormals && this.options.computeNormalMesh;

    this.xDistance = options.dx || 40;
    this.zDistance = options.dz || 40;
    this.xPatches = options.px || 32;
    this.zPatches = options.pz || 32;
    this.vertexRows = this.zPatches + 1;
    this.vertexCols = this.xPatches + 1;
    this.vertexCount = this.vertexRows * this.vertexCols;

    // add vertices and normals
    var verticesArray = []; // to be copied into vertices0 
    var normalsArray = [];
    var normalPointsArray = []; // for normal mesh

    var xHalf = this.xDistance / 2;
    var zHalf = this.zDistance / 2;

    for (var m = 0; m < this.vertexRows; m++) {
        for (var n = 0; n < this.vertexCols; n++) {
            var x = (n - this.xPatches / 2) * this.xDistance / this.xPatches;
            var z = (m - this.zPatches / 2) * this.zDistance / this.zPatches;
            verticesArray.push(x, 0, z);
            normalsArray.push(0, 1, 0); // init required?
            normalPointsArray.push(x, 1, z); // updated in eval()
        }
    }

    // add indices
    var indicesArray = [];
    var index;
    for (var m = 0; m < this.zPatches; m++) {
        for (var n = 0; n < this.xPatches; n++) {
            index = m * this.vertexRows + n;
            indicesArray.push(index);
            indicesArray.push(index + this.vertexCols);
            indicesArray.push(index + this.vertexCols + 1);
            indicesArray.push(index);
            indicesArray.push(index + this.vertexCols + 1);
            indicesArray.push(index + 1);
        }
    }

    // set geometry attributes, etc
    this.vertices0 = verticesArray;
    this.vertices = new Float32Array(verticesArray, 0, verticesArray.length);
    this.indices = new Uint16Array(indicesArray, 0, indicesArray.length);
    this.normals = new Float32Array(normalsArray, 0, normalsArray.length);

    if (this.options.computeMesh) {
        this.geometry = new THREE.BufferGeometry();
        this.geometry.addAttribute("position", new THREE.BufferAttribute(this.vertices, 3));
        this.geometry.addAttribute("normal", new THREE.BufferAttribute(this.normals, 3));
        this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
        //this.geometry.dynamic = true;

        var plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
        material = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, clippingPlanes: [plane] });

        this.mesh = new THREE.Mesh(this.geometry, material);
    }

    // add normal mesh
    if (this.options.computeNormalMesh) {
        var normalVerticesArray = verticesArray.concat(normalPointsArray);
        var normalIndicesArray = [];
        for (var i = 0; i < this.vertexCount; i++) {
            normalIndicesArray.push(i, i + this.vertexCount);
        }
        this.normalVertices = new Float32Array(normalVerticesArray, 0, normalVerticesArray.length);
        this.normalIndices = new Uint16Array(normalIndicesArray, 0, normalIndicesArray.length);
        this.normalGeometry = new THREE.BufferGeometry();
        this.normalGeometry.addAttribute("position", new THREE.BufferAttribute(this.normalVertices, 3));
        this.normalGeometry.setIndex(new THREE.BufferAttribute(this.normalIndices, 1));
        var normalMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
        this.normalMesh = new THREE.LineSegments(this.normalGeometry, normalMaterial);
    }

    this.waves = [];
}

Ocean.prototype.addWave = function(k, lambda, pAmp, phase) {
    this.waves.push(new Wave(k, lambda, pAmp, phase));
};

// t in seconds
Ocean.prototype.evaluate = function(t) {
    var self = this;

    var i, index, x, y, z, x0, y0, z0, c, sinc, cosc, temp, n;
    for (i = 0; i < this.vertexCount; i++) {
        index = i * 3;
        x = x0 = this.vertices0[index];
        y = y0 = this.vertices0[index + 1];
        z = z0 = this.vertices0[index + 2];

        if (this.options.computeNormals) n = [0, 0, 0];

        // pull fn out?
        this.waves.forEach(function(wave) {
            c = wave.k[0] * x0 + wave.k[1] * z0 - wave.f * t - wave.phase;
            sinc = Math.sin(c);
            cosc = Math.cos(c);
            temp = wave.amp * sinc;

            if (self.options.computeNormals) {
                n[0] += wave.k[0] * wave.amp * sinc;
                n[1] += 1 - wave.kMag * wave.amp * cosc;
                n[2] += wave.k[1] * wave.amp * sinc;
            }

            x -= wave.kNorm[0] * temp;
            z -= wave.kNorm[1] * temp;
            y += wave.amp * cosc;
        });

        this.vertices[index] = x;
        this.vertices[index + 1] = y;
        this.vertices[index + 2] = z;

        if (this.options.computeNormals) {
            this.normals[index] = n[0];
            this.normals[index + 1] = n[1];
            this.normals[index + 2] = n[2];
        }

        // normalize values first
        if (this.options.computeNormalMesh) {
            var nIndex = index + this.vertices.length;
            this.normalVertices[nIndex] = x0 + x + this.normals[index];
            this.normalVertices[nIndex + 1] = y0 + y + this.normals[index + 1];
            this.normalVertices[nIndex + 2] = z0 + z + this.normals[index + 2];
        }
    }

    if (this.options.computeMesh) {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.normal.needsUpdate = true;
    }

    if (this.options.computeNormalMesh) {
        this.normalVertices.set(this.vertices); // remove, do this in loop
        this.normalGeometry.attributes.position.needsUpdate = true;
    }
};
