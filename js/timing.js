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
    var res = d > t.duration ? 1 : -0.5 * (Math.cos(Math.PI * d/t.duration) - 1);
    if (t.startVal !== undefined && t.endVal !== undefined) res = t.startVal + res * (t.endVal - t.startVal);
    return res;
};

// constant rate
Timer.prototype.constant = function(t, now) {
    return (now - t.start) * t.rate;
};


