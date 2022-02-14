class Scheduler {
  constructor() {
    this.tasks = [];
  }

  addTask(task) {
    this.tasks.push(task);
  }

  runTasks(now) {
    var self = this;
    if (now === undefined) now = Date.now();

    this.tasks.forEach(function (task) {
      var ready =
        task.condition instanceof Function ? task.condition(self, now) : task.condition < now;
      if (ready) {
        if (task.runCallback) task.runCallback(self, now);
        task.run = true;
      }
    });

    this.tasks = this.tasks.filter(function (task) {
      return !task.run;
    });
  }
}

// Easing
class Timer {
  constructor() {
    this.transitions = {};
  }

  // Required: duration?, startVal, endVal
  addTransition(t) {
    if (!t.key) throw new Error("key is required");
    // if (this.transitions[t.key]) throw new Error("key is in use"); // TODO: Just override?

    var now = Date.now();
    t.start = now; // Start and end mutually exclusive with rate
    if (t.duration) t.end = t.duration + now;
    if (!t.type) t.type = "linear";
    this.transitions[t.key] = t;
  }

  // TODO: Check for completion?
  get(key, now) {
    var t = this.transitions[key];
    if (!t) return null;
    if (now === undefined) now = Date.now();

    switch (t.type) {
      case "linear":
        return this.linear(t, now);
      case "iosine":
        return this.iosine(t, now);
      case "constant":
        return this.constant(t, now);
      default:
        throw new Error("transition type was not matched");
    }
  }

  linear(t, now) {
    var res = t.end < now ? 1 : (now - t.start) / t.duration;
    if (t.startVal !== undefined && t.endVal !== undefined)
      res = t.startVal + res * (t.endVal - t.startVal);
    return res;
  }

  iosine(t, now) {
    var d = now - t.start;
    var res = d > t.duration ? 1 : -0.5 * (Math.cos((Math.PI * d) / t.duration) - 1);
    if (t.startVal !== undefined && t.endVal !== undefined)
      res = t.startVal + res * (t.endVal - t.startVal);
    return res;
  }

  // Constant rate
  constant(t, now) {
    return (now - t.start) * t.rate;
  }
}

export { Scheduler, Timer };
