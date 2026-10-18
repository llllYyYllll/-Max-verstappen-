(function () {
    var timeline = document.querySelector(".section3 .s3-timeline");
    if (!timeline) return;

    var nodes = Array.prototype.slice.call(timeline.querySelectorAll(".s3-node"));
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    var svg = timeline.querySelector(".s3-path");
    var path = timeline.querySelector(".s3-path-line");

    function setActive(target, on) {
        nodes.forEach(function (node) {
            var active = on && node === target;
            node.classList.toggle("is-active", active);
            var dot = node.querySelector(".s3-dot");
            if (dot) dot.setAttribute("aria-expanded", active ? "true" : "false");
        });
    }

    function ensureGradient() {
        if (!svg || svg.querySelector("#s3-path-grad")) return;
        var ns = "http://www.w3.org/2000/svg";
        var defs = document.createElementNS(ns, "defs");
        var grad = document.createElementNS(ns, "linearGradient");
        grad.setAttribute("id", "s3-path-grad");
        grad.setAttribute("gradientUnits", "userSpaceOnUse");

        var stop1 = document.createElementNS(ns, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#FFCC00");

        var stop2 = document.createElementNS(ns, "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", "#E8002D");

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
        svg.insertBefore(defs, svg.firstChild);
    }

    function updatePath() {
        if (!svg || !path || window.matchMedia("(max-width: 900px)").matches) return;

        ensureGradient();

        // 坐标相对 SVG 自身，避免 padding / 偏移导致错位
        var svgRect = svg.getBoundingClientRect();
        var w = svgRect.width;
        var h = svgRect.height;
        if (w < 2 || h < 2) return;

        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);

        var points = nodes.map(function (node) {
            var dot = node.querySelector(".s3-dot");
            if (!dot) return null;
            var r = dot.getBoundingClientRect();
            return {
                x: r.left + r.width / 2 - svgRect.left,
                y: r.top + r.height / 2 - svgRect.top
            };
        }).filter(Boolean);

        if (points.length < 2) return;

        var d = "M " + points[0].x.toFixed(1) + " " + points[0].y.toFixed(1);
        for (var i = 1; i < points.length; i++) {
            d += " L " + points[i].x.toFixed(1) + " " + points[i].y.toFixed(1);
        }
        path.setAttribute("d", d);

        var grad = svg.querySelector("#s3-path-grad");
        if (grad) {
            grad.setAttribute("x1", points[0].x);
            grad.setAttribute("y1", points[0].y);
            grad.setAttribute("x2", points[points.length - 1].x);
            grad.setAttribute("y2", points[points.length - 1].y);
        }
    }

    nodes.forEach(function (node) {
        var dot = node.querySelector(".s3-dot");
        if (!dot) return;

        dot.addEventListener("click", function (e) {
            if (finePointer.matches) return;
            e.preventDefault();
            setActive(node, !node.classList.contains("is-active"));
        });

        var panel = node.querySelector(".s3-panel");

        function setExpanded(on) {
            if (!finePointer.matches) return;
            dot.setAttribute("aria-expanded", on ? "true" : "false");
        }

        // 仅在小圆点 / 已展开面板上触发，避免悬停年份、简介时出图
        dot.addEventListener("mouseenter", function () {
            setExpanded(true);
        });
        dot.addEventListener("mouseleave", function () {
            setExpanded(false);
        });
        if (panel) {
            panel.addEventListener("mouseenter", function () {
                setExpanded(true);
            });
            panel.addEventListener("mouseleave", function () {
                setExpanded(false);
            });
        }
    });

    document.addEventListener("click", function (e) {
        if (finePointer.matches) return;
        if (!timeline.contains(e.target)) setActive(null, false);
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setActive(null, false);
    });

    var resizeTimer = null;
    function schedulePathUpdate() {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(updatePath, 40);
    }

    window.addEventListener("resize", schedulePathUpdate);
    window.addEventListener("load", updatePath);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updatePath);
    }

    timeline.querySelectorAll("img").forEach(function (img) {
        if (!img.complete) img.addEventListener("load", schedulePathUpdate);
    });

    if (typeof ResizeObserver !== "undefined") {
        var ro = new ResizeObserver(schedulePathUpdate);
        ro.observe(timeline);
    }

    updatePath();
    window.requestAnimationFrame(function () {
        updatePath();
        window.requestAnimationFrame(updatePath);
    });
})();
